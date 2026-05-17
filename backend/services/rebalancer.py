import asyncio
import re
import time
import yfinance as yf
import requests
from bs4 import BeautifulSoup
from typing import Dict, List, Any
from pydantic import BaseModel
from fastapi import HTTPException

# ==========================================
# 1. API 資料結構定義 (Pydantic Models)
# ==========================================
class AssetInput(BaseModel):
    ticker: str          # 例如: "QQQM", "2330.TW"
    current_shares: float # 持有股數
    average_cost: float = 0.0 # 平均成本

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
# 簡單的記憶體快取 (Memory Cache) 避免短時間內重複打 API 被鎖 IP
_PRICE_CACHE = {}
CACHE_TTL = 300 # 5 分鐘過期

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
            return 0.0
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
    def get_verified_price_sync(cls, ticker: str) -> float:
        """同步雙重驗證邏輯主入口"""
        # 檢查快取
        cached_data = _PRICE_CACHE.get(ticker)
        if cached_data and (time.time() - cached_data['timestamp']) < CACHE_TTL:
            return cached_data['price']

        api_price = cls.get_price_via_api(ticker)
        scraper_price = cls.get_price_via_scraper(ticker)
        
        final_price = 0.0
        if api_price == 0.0 and scraper_price == 0.0:
            raise HTTPException(status_code=400, detail=f"查無標的：{ticker}。無法獲取市場報價，請檢查代號是否正確 (台股請記得加上 .TW)。")
        
        # 如果兩者皆有值，比對偏差度
        if api_price > 0.0 and scraper_price > 0.0:
            deviation = abs(api_price - scraper_price) / api_price
            if deviation > 0.005: # 偏差超過 0.5% 時，以網頁爬蟲即時價格為準
                print(f"【警報】{ticker} API ({api_price}) 與爬蟲 ({scraper_price}) 偏差過大，採用爬蟲價格。")
                final_price = scraper_price
            else:
                final_price = api_price
        else:
            # 某一邊失效時，採用另一邊的數值
            final_price = api_price if api_price > 0.0 else scraper_price
            
        # 存入快取
        _PRICE_CACHE[ticker] = {
            'price': final_price,
            'timestamp': time.time()
        }
        return final_price

    @classmethod
    async def get_verified_price_async(cls, ticker: str) -> float:
        """非同步雙重驗證邏輯主入口 (透過 asyncio.to_thread 防止阻塞)"""
        return await asyncio.to_thread(cls.get_verified_price_sync, ticker)

# ==========================================
# 3. 再平衡與交易成本計算引擎
# ==========================================
class RebalanceEngine:
    @classmethod
    def resolve_ticker(cls, ticker: str) -> str:
        """
        智慧代碼解析 (防呆機制)：
        如果輸入不含 '.' 且看起來像是台股 (純數字如 0050, 或 00679B 這種含字母代碼)：
        1. 優先嘗試加 '.TW' (上市股票/ETF)
        2. 若沒找到，嘗試加 '.TWO' (上櫃股票/ETF)
        3. 若都找不到或不符合台股特徵，則維持原樣 (當作美股處理如 QQQM)
        """
        ticker_cleaned = ticker.strip().upper()
        if "." in ticker_cleaned:
            return ticker_cleaned

        # 判斷是否符合台股特徵：
        # 1. 4-6位純數字 (如 2330, 0050, 006208)
        # 2. 5-6位數字加字母 (如 00679B, 00715L, 00632R)
        if re.match(r'^\d+[A-Z]?$', ticker_cleaned):
            # 嘗試 .TW
            tw_candidate = f"{ticker_cleaned}.TW"
            try:
                stock_tw = yf.Ticker(tw_candidate)
                # fast_info.get 如果順利代表是有效的上市標的
                if stock_tw.fast_info.get('last_price') is not None:
                    return tw_candidate
            except Exception:
                pass

            # 嘗試 .TWO
            two_candidate = f"{ticker_cleaned}.TWO"
            try:
                stock_two = yf.Ticker(two_candidate)
                if stock_two.fast_info.get('last_price') is not None:
                    return two_candidate
            except Exception:
                pass

            # 啟發式安全回退：如果是以 'B' 結尾的通常是上櫃債券 ETF
            if ticker_cleaned.endswith('B'):
                return two_candidate
            return tw_candidate

        return ticker_cleaned

    @staticmethod
    def calculate_fee_and_tax(ticker: str, amount: float, is_sell: bool) -> float:
        """
        估算交易成本
        台股 (.TW 或 .TWO): 手續費 0.1425%, 賣出證交稅 0.3% (債券 ETF 免徵證交稅)
        美股 (其他): 假設為海外券商或複委託固定成本 (此處以微量交易滑價 0.05% 暫代)
        """
        cost = 0.0
        if ticker.endswith(".TW") or ticker.endswith(".TWO"):
            # 台股手續費 (假設券商打 6 折)
            broker_fee = amount * 0.001425 * 0.6
            cost += max(broker_fee, 20.0) # 台股通常有最低手續費 20 元限制
            
            # 判斷是否為債券 ETF (代碼尾數為 B，如 00679B)，政府免徵證交稅
            symbol_part = ticker.split(".")[0]
            is_bond_etf = symbol_part.endswith("B")
            
            if is_sell and not is_bond_etf:
                cost += amount * 0.003 # 證交稅 0.3%
        else:
            # 美股基本成本模擬
            cost += amount * 0.0005 
        return cost

    @classmethod
    async def execute(cls, request: RebalanceRequest) -> Dict[str, Any]:
        # 0. 智慧解析與校正所有標的代號 (防呆機制)
        for cat in request.allocations:
            for asset in cat.assets:
                asset.ticker = cls.resolve_ticker(asset.ticker)

        # 1. 收集所有需要報價的 Ticker 並非同步併發獲取
        unique_tickers = set()
        for cat in request.allocations:
            for asset in cat.assets:
                unique_tickers.add(asset.ticker)
        
        # 併發執行所有價格請求
        fetch_tasks = [PriceFetcher.get_verified_price_async(ticker) for ticker in unique_tickers]
        fetched_prices = await asyncio.gather(*fetch_tasks)
        
        # 建立 Ticker 到 Price 的映射表
        verified_prices = dict(zip(unique_tickers, fetched_prices))
        
        category_current_values = {}
        total_asset_value = 0.0
        total_cost_basis = 0.0

        for cat in request.allocations:
            cat_value = 0.0
            cat_cost_basis = 0.0
            for asset in cat.assets:
                price = verified_prices[asset.ticker]
                asset_value = asset.current_shares * price
                cat_value += asset_value
                cat_cost_basis += asset.current_shares * asset.average_cost
            
            category_current_values[cat.category] = {
                "value": cat_value,
                "cost_basis": cat_cost_basis,
                "unrealized_pnl": cat_value - cat_cost_basis if cat_cost_basis > 0 else 0
            }
            total_asset_value += cat_value
            total_cost_basis += cat_cost_basis

        total_unrealized_pnl = total_asset_value - total_cost_basis if total_cost_basis > 0 else 0
        total_roi = (total_unrealized_pnl / total_cost_basis) if total_cost_basis > 0 else 0

        # 納入活水資金與閒置現金
        total_nav = total_asset_value + request.deposit_cash + request.current_free_cash
        
        rebalance_reports = []
        estimated_total_cost = 0.0

        # 2. 依據自訂比例計算各類別差額
        for cat in request.allocations:
            target_value = total_nav * cat.target_pct
            current_value = category_current_values[cat.category]["value"]
            diff_amount = target_value - current_value # 正數代表要買，負數代表要賣
            
            asset_actions = []
            
            if len(cat.assets) > 0 and abs(diff_amount) > 10:
                # 排序：優先找股數最多的一檔
                sorted_assets = sorted(cat.assets, key=lambda x: x.current_shares, reverse=True)
                
                if diff_amount > 0:
                    # 需要買入 (BUY)，全額買入股數最多的一檔
                    primary_asset = sorted_assets[0]
                    price = verified_prices[primary_asset.ticker]
                    ideal_shares = diff_amount / price
                    
                    exec_shares = int(ideal_shares) if primary_asset.ticker.endswith(".TW") else round(ideal_shares, 2)
                    exec_amount = exec_shares * price
                    if exec_shares > 0:
                        cost = cls.calculate_fee_and_tax(primary_asset.ticker, exec_amount, is_sell=False)
                        estimated_total_cost += cost
                        asset_actions.append({
                            "ticker": primary_asset.ticker,
                            "action": "BUY",
                            "shares": round(exec_shares, 2),
                            "price": round(price, 2),
                            "estimated_value": round(exec_amount, 2),
                            "estimated_cost": round(cost, 2)
                        })
                else:
                    # 需要賣出 (SELL)，從股數最多的一檔開始賣，若不夠賣則找下一檔
                    remaining_sell_amount = abs(diff_amount)
                    for asset in sorted_assets:
                        if remaining_sell_amount <= 10:
                            break
                        
                        price = verified_prices[asset.ticker]
                        asset_value = asset.current_shares * price
                        
                        if asset_value <= 0:
                            continue
                            
                        # 決定要賣多少金額
                        sell_amount = min(remaining_sell_amount, asset_value)
                        ideal_shares = sell_amount / price
                        
                        exec_shares = int(ideal_shares) if asset.ticker.endswith(".TW") else round(ideal_shares, 2)
                        
                        # 防呆保護：確保不賣超過目前持有
                        if exec_shares > asset.current_shares:
                            exec_shares = asset.current_shares
                            
                        if exec_shares > 0:
                            exec_amount = exec_shares * price
                            cost = cls.calculate_fee_and_tax(asset.ticker, exec_amount, is_sell=True)
                            estimated_total_cost += cost
                            
                            asset_actions.append({
                                "ticker": asset.ticker,
                                "action": "SELL",
                                "shares": round(exec_shares, 2),
                                "price": round(price, 2),
                                "estimated_value": round(exec_amount, 2),
                                "estimated_cost": round(cost, 2)
                            })
                            
                            remaining_sell_amount -= exec_amount

            rebalance_reports.append({
                "category": cat.category,
                "target_pct": f"{round(cat.target_pct * 100, 2)}%",
                "current_value": round(current_value, 2),
                "unrealized_pnl": round(category_current_values[cat.category]["unrealized_pnl"], 2),
                "target_value": round(target_value, 2),
                "diff_amount": round(diff_amount, 2),
                "actions": asset_actions
            })

        return {
            "total_nav": round(total_nav, 2),
            "total_asset_value": round(total_asset_value, 2),
            "total_cost_basis": round(total_cost_basis, 2),
            "total_unrealized_pnl": round(total_unrealized_pnl, 2),
            "total_roi_pct": round(total_roi * 100, 2),
            "estimated_total_transaction_cost": round(estimated_total_cost, 2),
            "reports": rebalance_reports
        }
