import os
import requests
from typing import List, Dict, Any

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

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
