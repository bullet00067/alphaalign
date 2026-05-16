from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from services.rebalancer import RebalanceRequest, RebalanceEngine

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

@app.put("/api/allocations/targets")
async def save_allocation_targets(request: dict):
    """
    【儲存設定】更新資料庫中該用戶的目標配置比例 (Mock 實作)
    """
    return {"message": "Not implemented yet"}
