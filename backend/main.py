import os
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# Load .env file for local development
load_dotenv()

from services.rebalancer import RebalanceRequest, RebalanceEngine
from services.supabase_db import SupabaseDB

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
    【儲存配置與歷史】計算當前狀態並將其存入 Supabase 歷史紀錄中。
    """
    try:
        result = await RebalanceEngine.execute(request)
        
        # 儲存至 Supabase
        db_res = SupabaseDB.save_history(
            total_nav=result["total_nav"],
            total_cost=result["total_cost_basis"],
            unrealized_pnl=result["total_unrealized_pnl"],
            roi_pct=result["total_roi_pct"],
            snapshot=request.model_dump()
        )
        
        if db_res["status"] == "error":
            raise HTTPException(status_code=500, detail=db_res["message"])
            
        return {"status": "success", "data": result}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/rebalance/history")
async def get_rebalance_history():
    """
    【獲取歷史紀錄】從 Supabase 獲取歷次存檔的資產變化紀錄。
    """
    if not SupabaseDB.is_configured():
        # 若未設定 Supabase 金鑰，回傳空陣列而非報錯，方便本機端測試
        return []
    return SupabaseDB.get_history()

@app.put("/api/allocations/targets")
async def save_allocation_targets(request: dict):
    """
    【儲存設定】更新資料庫中該用戶的目標配置比例 (Mock 實作)
    """
    return {"message": "Not implemented yet"}
