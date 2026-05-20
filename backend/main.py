import os
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from pydantic import BaseModel
# Load .env file for local development
load_dotenv()

from services.rebalancer import RebalanceRequest, RebalanceEngine
from services.supabase_db import SupabaseDB

class WizardRequest(BaseModel):
    input_text: str

app = FastAPI(
    title="AlphaAlign API",
    description="Interactive Asset Rebalancing & Monitoring Platform API",
    version="1.0.0"
)

# Enable CORS for the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/portfolio")
async def get_portfolio():
    """
    獲取當前所有資產庫存與目標比例 (Mock 實作)
    """
    return {"message": "Not implemented yet"}

@app.post("/api/rebalance/calculate")
async def calculate_rebalance(request: RebalanceRequest):
    """
    【僅單次試算】接收臨時比例與金額，執行雙重驗證並回傳買賣建議。
    """
    try:
        result = await RebalanceEngine.execute(request)
        return result
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/rebalance/save")
async def save_rebalance(request: RebalanceRequest):
    """
    【儲存配置與歷史】計算當前狀態並將其存入 Supabase/本地 歷史紀錄中。
    """
    try:
        result = await RebalanceEngine.execute(request)
        
        # 嘗試儲存至 Supabase
        db_res = SupabaseDB.save_history(
            total_nav=result["total_nav"],
            total_cost=result["total_cost_basis"],
            unrealized_pnl=result["total_unrealized_pnl"],
            roi_pct=result["total_roi_pct"],
            snapshot=request.model_dump()
        )
        
        # 【自癒降級機制】若 Supabase 儲存失敗（例如 RLS 政策阻擋或連線問題），自動改存至本地 JSON
        if db_res["status"] == "error":
            print(f"Supabase 儲存失敗 ({db_res['message']})，自動啟用本地備份資料庫...")
            local_res = SupabaseDB.save_local(
                total_nav=result["total_nav"],
                total_cost=result["total_cost_basis"],
                unrealized_pnl=result["total_unrealized_pnl"],
                roi_pct=result["total_roi_pct"],
                snapshot=request.model_dump()
            )
            if local_res["status"] == "error":
                raise HTTPException(status_code=500, detail=local_res["message"])
            
        return {"status": "success", "data": result}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/rebalance/history")
async def get_rebalance_history(account_id: str = "default"):
    """
    【獲取歷史紀錄】整合 Supabase 雲端與本地 JSON 備份的資產變化歷史，並按 account_id 過濾。
    """
    history = []
    if SupabaseDB.is_configured():
        history = SupabaseDB.get_history()
        
    local_history = SupabaseDB.get_local()
    
    # 整合兩者（以ID去重並依照創建時間排序）
    combined = []
    seen_ids = set()
    
    for item in history:
        # 從 snapshot 解析關聯的 account_id，若無則歸為 "default"
        snap = item.get("snapshot", {}) or {}
        item_account_id = snap.get("account_id", "default")
        if item_account_id == account_id:
            combined.append(item)
            if "id" in item:
                seen_ids.add(item["id"])
            
    for item in local_history:
        if item.get("id") not in seen_ids:
            snap = item.get("snapshot", {}) or {}
            item_account_id = snap.get("account_id", "default")
            if item_account_id == account_id:
                combined.append(item)
            
    combined.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return combined

@app.put("/api/allocations/targets")
async def save_allocation_targets(request: dict):
    """
    【儲存設定】更新資料庫中該用戶的目標配置比例 (Mock 實作)
    """
    return {"message": "Not implemented yet"}

@app.post("/api/rebalance/parse-wizard")
async def parse_wizard(request: WizardRequest):
    """
    【智慧一鍵配置精靈】解析輸入文字並返回智慧分類歸納後的卡片配置
    """
    try:
        from services.wizard_classifier import WizardClassifier
        result = await WizardClassifier.parse_and_group(request.input_text)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/api/rebalance/history/{record_id}")
async def delete_rebalance_record(record_id: str):
    """
    【刪除歷史紀錄】根據指定快照 ID 安全移除歷史再平衡快照 (支援雲端與本地自癒降級刪除)。
    """
    res = SupabaseDB.delete_history(record_id)
    if res["status"] == "error":
        raise HTTPException(status_code=400, detail=res["message"])
    return res


