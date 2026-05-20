import os
import requests
import json
from datetime import datetime
from typing import List, Dict, Any

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
LOCAL_DB_FILE = "rebalance_history.json"

class SupabaseDB:
    @staticmethod
    def is_configured() -> bool:
        return bool(SUPABASE_URL and SUPABASE_KEY)

    @classmethod
    def get_headers(cls) -> Dict[str, str]:
        return {
            "apikey": SUPABASE_KEY or "",
            "Authorization": f"Bearer {SUPABASE_KEY}" if SUPABASE_KEY else "",
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        }

    @classmethod
    def save_history(cls, total_nav: float, total_cost: float, unrealized_pnl: float, roi_pct: float, snapshot: List[Any]) -> Dict[str, Any]:
        if not cls.is_configured():
            return {"status": "error", "message": "Supabase credentials not configured in environment variables."}

        url = f"{SUPABASE_URL}/rest/v1/rebalance_history"
        payload = {
            "total_nav": total_nav,
            "total_cost": total_cost,
            "unrealized_pnl": unrealized_pnl,
            "roi_pct": roi_pct,
            "snapshot": snapshot
        }

        try:
            response = requests.post(url, headers=cls.get_headers(), json=payload, timeout=5)
            if response.status_code in [200, 201]:
                return {"status": "success", "data": response.json()}
            else:
                error_msg = response.text
                if "42501" in error_msg or "row-level security" in error_msg.lower():
                    error_msg += " (提示：Supabase 的資料列安全性原則 (RLS) 已啟用。最推薦的解決方法是將 backend/.env 中的 SUPABASE_KEY 換成您的 'service_role' 金鑰以安全地繞過限制；或是至 Supabase SQL 編輯器輸入指令以關閉 rebalance_history 資料表的 RLS 機制。)"
                print(f"Supabase Save Error: {response.status_code} - {error_msg}")
                return {"status": "error", "message": f"Supabase API returned {response.status_code}: {error_msg}"}
        except Exception as e:
            print(f"Supabase Connection Exception: {e}")
            return {"status": "error", "message": str(e)}

    @classmethod
    def get_history(cls) -> List[Dict[str, Any]]:
        if not cls.is_configured():
            print("Supabase get_history: Not configured.")
            return []

        url = f"{SUPABASE_URL}/rest/v1/rebalance_history?order=created_at.desc"
        try:
            response = requests.get(url, headers=cls.get_headers(), timeout=5)
            if response.status_code == 200:
                return response.json()
            else:
                print(f"Supabase Get Error: {response.status_code} - {response.text}")
                return []
        except Exception as e:
            print(f"Supabase Connection Exception: {e}")
            return []

    # --- Local Database Fallback (Self-Healing) ---
    @classmethod
    def save_local(cls, total_nav: float, total_cost: float, unrealized_pnl: float, roi_pct: float, snapshot: List[Any]) -> Dict[str, Any]:
        try:
            records = []
            if os.path.exists(LOCAL_DB_FILE):
                with open(LOCAL_DB_FILE, "r", encoding="utf-8") as f:
                    try:
                        records = json.load(f)
                    except Exception:
                        records = []

            new_record = {
                "id": f"local_{int(datetime.utcnow().timestamp())}",
                "created_at": datetime.utcnow().isoformat() + "Z",
                "total_nav": total_nav,
                "total_cost": total_cost,
                "unrealized_pnl": unrealized_pnl,
                "roi_pct": roi_pct,
                "snapshot": snapshot,
                "is_local": True
            }
            records.insert(0, new_record)

            with open(LOCAL_DB_FILE, "w", encoding="utf-8") as f:
                json.dump(records, f, ensure_ascii=False, indent=2)

            return {"status": "success", "data": new_record}
        except Exception as e:
            print(f"Local Fallback Save Error: {e}")
            return {"status": "error", "message": f"Local storage fallback failed: {e}"}

    @classmethod
    def get_local(cls) -> List[Dict[str, Any]]:
        try:
            if os.path.exists(LOCAL_DB_FILE):
                with open(LOCAL_DB_FILE, "r", encoding="utf-8") as f:
                    return json.load(f)
            return []
        except Exception as e:
            print(f"Local Fallback Load Error: {e}")
            return []

    @classmethod
    def delete_history(cls, record_id: str) -> Dict[str, Any]:
        """
        刪除指定歷史快照。優先判斷字首是否為本地快照，若是則直接自本地檔案刪除；
        若為雲端快照，則發送 DELETE 請求；若發送失敗自動進行本地降級刪除。
        """
        if str(record_id).startswith("local_"):
            return cls.delete_local(record_id)
            
        if not cls.is_configured():
            # 未配置 Supabase 時，嘗試在本地備份中刪除
            return cls.delete_local(record_id)

        url = f"{SUPABASE_URL}/rest/v1/rebalance_history?id=eq.{record_id}"
        try:
            response = requests.delete(url, headers=cls.get_headers(), timeout=5)
            if response.status_code in [200, 204]:
                return {"status": "success", "message": "Record deleted successfully from Supabase."}
            else:
                # 雲端刪除失敗（可能為 RLS 或權限問題），嘗試自本地快照搜尋並刪除
                local_res = cls.delete_local(record_id)
                if local_res["status"] == "success":
                    return local_res
                return {"status": "error", "message": f"Supabase API returned {response.status_code}: {response.text}"}
        except Exception as e:
            # 連線異常，啟用自癒降級本地刪除
            local_res = cls.delete_local(record_id)
            if local_res["status"] == "success":
                return local_res
            return {"status": "error", "message": f"Supabase delete failed: {str(e)}"}

    @classmethod
    def delete_local(cls, record_id: str) -> Dict[str, Any]:
        """
        自本地 JSON 檔案中刪除特定 ID 的歷史紀錄快照。
        """
        try:
            if not os.path.exists(LOCAL_DB_FILE):
                return {"status": "error", "message": "Local database file does not exist."}
                
            with open(LOCAL_DB_FILE, "r", encoding="utf-8") as f:
                records = json.load(f)
                
            original_len = len(records)
            # 以字串做 ID 去重比較，相容 uuid 與 local_ timestamp 格式
            records = [r for r in records if str(r.get("id")) != str(record_id)]
            
            if len(records) == original_len:
                return {"status": "error", "message": f"Record with ID {record_id} not found in local database."}
                
            with open(LOCAL_DB_FILE, "w", encoding="utf-8") as f:
                json.dump(records, f, ensure_ascii=False, indent=2)
                
            return {"status": "success", "message": "Record deleted successfully from local database."}
        except Exception as e:
            print(f"Local Fallback Delete Error: {e}")
            return {"status": "error", "message": f"Local storage fallback delete failed: {e}"}
