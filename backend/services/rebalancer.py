import asyncio
import re
import yfinance as yf
import requests
from bs4 import BeautifulSoup
from typing import Dict, List, Any
from pydantic import BaseModel

# ==========================================
# 1. API 資料結構定義 (Pydantic Models)
# ==========================================
class AssetInput(BaseModel):
    ticker: str          # 例如: "QQQM", "2330.TW"
    current_shares: float # 持有股數

class CategoryAllocation(BaseModel):
    category: str        # 例如: "市值型股票", "現金"
    target_pct: float    # 目標比例 (0.0 ~ 1.0)
    assets: List[AssetInput]

class RebalanceRequest(BaseModel):
    deposit_cash: float  # 本次預計額外投入的資金
    current_free_cash: float # 目前未投入的閒置現金
    allocations: List[CategoryAllocation]


# ==========================================
# 2. 雙重驗證報價系統 (Dual-Verification)
# ==========================================
class PriceFetcher:
    @staticmethod
    def get_price_via_api(ticker: str) -> float:
        """第一層：透過 yfinance API 獲取價格"""
        try:
            stock = yf.Ticker(ticker)
            # 優先獲取最新一筆交易價
            price = stock.fast_info.get('last_price')
            if price is not None:
                return float(price)
            # 備援機制：獲取歷史最後一筆
            hist = stock.history(period="1d")
            if not hist.empty:
                return float(hist['Close'].iloc[-1])
            raise ValueError(f"無法透過 API 獲取 {ticker} 的價格")
        except Exception as e:
            print(f"API Fetch Error for {ticker}: {e}")
            return 0.0

    @staticmethod
    def get_price_via_scraper(ticker: str) -> float:
        """第二層：透過輕量爬蟲抓取 Yahoo Finance 網頁即時價格"""
        try:
            # 根據台股或美股調整 Yahoo Finance URL 格式
            url = f"https://finance.yahoo.com/quote/{ticker}"
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
            response = requests.get(url, headers=headers, timeout=5)
            if response.status_code != 200:
                return 0.0
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Yahoo Finance 傳統上將即時價格放在 fin-streamer 標籤中
            # 尋找含有 data-field="regularMarketPrice" 且 data-symbol 等於 ticker 的元素
            price_element = soup.find("fin-streamer", {"data-field": "regularMarketPrice", "data-symbol": ticker})
            
            if price_element and price_element.get("value"):
                return float(price_element["value"])
            
            # 備援正則表達式尋找（防止前端變更 class）
            match = re.search(r'"regularMarketPrice":\s*([0-9.]+)', response.text)
            if match:
                return float(match.group(1))
                
            return 0.0
        except Exception as e:
            print(f"Scraper Fetch Error for {ticker}: {e}")
            return 0.0

    @classmethod
    def get_verified_price(cls, ticker: str) -> float:
        """雙重驗證邏輯主入口"""
        api_price = cls.get_price_via_api(ticker)
        scraper_price = cls.get_price_via_scraper(ticker)
        
        if api_price == 0.0 and scraper_price == 0.0:
            raise Exception(f"【錯誤】標的 {ticker} 無法獲取任何市場報價，請檢查代號是否正確。")
        
        # 如果兩者皆有值，比對偏差度
        if api_price > 0.0 and scraper_price > 0.0:
            deviation = abs(api_price - scraper_price) / api_price
            if deviation > 0.005: # 偏差超過 0.5% 時，以網頁爬蟲即時價格為準
                print(f"【警報】{ticker} API ({api_price}) 與爬蟲 ({scraper_price}) 偏差過大，採用爬蟲價格。")
                return scraper_price
            return api_price
        
        # 某一邊失效時，採用另一邊的數值
        return api_price if api_price > 0.0 else scraper_price


# ==========================================
# 3. 再平衡與交易成本計算引擎
# ==========================================
class RebalanceEngine:
    @staticmethod
    def calculate_fee_and_tax(ticker: str, amount: float, is_sell: bool) -> float:
        """
        估算交易成本
        台股 (.TW): 手續費 0.1425%, 賣出證交稅 0.3%
        美股 (無 .TW): 假設為海外券商或複委託固定成本 (此處以微量交易滑價 0.05% 暫代)
        """
        cost = 0.0
        if ticker.endswith(".TW"):
            # 台股手續費 (假設券商打 6 折)
            broker_fee = amount * 0.001425 * 0.6
            cost += max(broker_fee, 20.0) # 台股通常有最低手續費 20 元限制
            if is_sell:
                cost += amount * 0.003 # 證交稅 0.3%
        else:
            # 美股基本成本模擬
            cost += amount * 0.0005 
        return cost

    @classmethod
    def execute(cls, request: RebalanceRequest) -> Dict[str, Any]:
        # 1. 獲取所有標的的驗證價格，並計算目前的各類別市值
        verified_prices = {}
        category_current_values = {}
        total_asset_value = 0.0

        for cat in request.allocations:
            cat_value = 0.0
            for asset in cat.assets:
                price = PriceFetcher.get_verified_price(asset.ticker)
                verified_prices[asset.ticker] = price
                cat_value += asset.current_shares * price
            
            category_current_values[cat.category] = cat_value
            total_asset_value += cat_value

        # 納入活水資金與閒置現金
        total_nav = total_asset_value + request.deposit_cash + request.current_free_cash
        
        rebalance_reports = []
        estimated_total_cost = 0.0

        # 2. 依據自訂比例計算各類別差額
        for cat in request.allocations:
            target_value = total_nav * cat.target_pct
            current_value = category_current_values[cat.category]
            diff_amount = target_value - current_value # 正數代表要買，負數代表要賣
            
            asset_actions = []
            
            if len(cat.assets) > 0 and abs(diff_amount) > 10: # 忽略小於 10 元的微小偏差
                # 若該類別有多檔股票，此處採簡單的「均分買賣資金」策略（可依需求調整為依權重分配）
                share_of_diff = diff_amount / len(cat.assets)
                
                for asset in cat.assets:
                    price = verified_prices[asset.ticker]
                    # 計算理想買賣股數
                    ideal_shares_diff = share_of_diff / price
                    
                    # 判斷買賣屬性與處理碎股邏輯
                    if ideal_shares_diff > 0:
                        action = "BUY"
                        # 台股向下取整至整數股，美股支援碎股
                        exec_shares = int(ideal_shares_diff) if asset.ticker.endswith(".TW") else round(ideal_shares_diff, 2)
                        exec_amount = exec_shares * price
                        cost = cls.calculate_fee_and_tax(asset.ticker, exec_amount, is_sell=False)
                    else:
                        action = "SELL"
                        exec_shares = int(abs(ideal_shares_diff)) if asset.ticker.endswith(".TW") else round(abs(ideal_shares_diff), 2)
                        exec_amount = exec_shares * price
                        cost = cls.calculate_fee_and_tax(asset.ticker, exec_amount, is_sell=True)
                    
                    estimated_total_cost += cost
                    
                    if exec_shares > 0:
                        asset_actions.append({
                            "ticker": asset.ticker,
                            "action": action,
                            "shares": exec_shares,
                            "price": price,
                            "estimated_value": round(exec_amount, 2),
                            "estimated_cost": round(cost, 2)
                        })

            rebalance_reports.append({
                "category": cat.category,
                "target_pct": f"{cat.target_pct * 100}%",
                "current_value": round(current_value, 2),
                "target_value": round(target_value, 2),
                "diff_amount": round(diff_amount, 2),
                "actions": asset_actions
            })

        return {
            "total_nav": round(total_nav, 2),
            "estimated_total_transaction_cost": round(estimated_total_cost, 2),
            "reports": rebalance_reports
        }
