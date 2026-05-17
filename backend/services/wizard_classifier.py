import re
import time
import asyncio
from typing import List, Dict, Any
import yfinance as yf
from services.rebalancer import RebalanceEngine

class WizardClassifier:
    # 常用本地字典檔（加速判定，減少 API 調用）
    LOCAL_MAPPING = {
        # 現金類
        "CASH": "現金", "TWD": "現金", "NTD": "現金", "USD": "現金", "EUR": "現金", "JPY": "現金", "CNY": "現金",
        "現金": "現金", "活存": "現金", "定存": "現金",
        
        # 債券/美債類
        "TLT": "美債", "IEF": "美債", "SHY": "美債", "BND": "美債", "AGG": "美債", "EDV": "美債", "BIL": "美債", "GOVT": "美債",
        
        # 高股息類
        "0056": "高股息", "00878": "高股息", "00919": "高股息", "00929": "高股息", "00713": "高股息",
        "00934": "高股息", "00940": "高股息", "00915": "高股息", "00918": "高股息",
        "SCHD": "高股息", "VYM": "高股息", "SDY": "高股息", "DVY": "高股息", "DGRO": "高股息",
        
        # 市值型
        "0050": "市值", "006208": "市值", "2330": "市值", "2317": "市值", "2454": "市值",
        "VOO": "市值", "IVV": "市值", "SPY": "市值", "QQQ": "市值", "QQQM": "市值", "VTI": "市值", "VT": "市值", "AAPL": "市值", "MSFT": "市值", "TSLA": "市值"
    }

    @classmethod
    def classify_ticker_sync(cls, ticker: str) -> str:
        """根據 Ticker 判斷資產類別 (同步版)"""
        ticker_cleaned = ticker.strip().upper()
        
        # 0. 清除點後綴以進行比對 (如 0050.TW -> 0050)
        symbol_only = ticker_cleaned.split('.')[0]

        # 1. 現金關鍵字比對
        if "現金" in ticker_cleaned or "活存" in ticker_cleaned or "定存" in ticker_cleaned or ticker_cleaned.startswith("CASH"):
            return "現金"

        # 2. 本地字典比對
        if symbol_only in cls.LOCAL_MAPPING:
            return cls.LOCAL_MAPPING[symbol_only]
        if ticker_cleaned in cls.LOCAL_MAPPING:
            return cls.LOCAL_MAPPING[ticker_cleaned]

        # 3. 台灣代碼啟發式判定
        if symbol_only.isdigit():
            # 以 'B' 結尾的台股代號為債券 ETF
            if ticker_cleaned.endswith('B') or symbol_only.endswith('B'):
                return "美債"
            # 預設純數字台股歸類為市值型 (除非在本地高股息字典中)
            return "市值"

        # 4. 美股/海外標的主動向 yfinance 獲取名稱比對
        resolved_symbol = RebalanceEngine.resolve_ticker(ticker_cleaned)
        try:
            stock = yf.Ticker(resolved_symbol)
            info = stock.info
            long_name = info.get('longName', '').upper()
            
            # 美債/債券關鍵字
            if any(k in long_name for k in ["BOND", "TREASURY", "FIXED INCOME", "債券", "國債", "美債"]):
                return "美債"
            
            # 高股息關鍵字
            if any(k in long_name for k in ["DIVIDEND", "HIGH YIELD", "高股息", "配息", "優息", "紅利"]):
                return "高股息"
                
        except Exception as e:
            print(f"[WizardClassifier] yfinance metadata fetch failed for {resolved_symbol}: {e}")

        # 5. 安全回退：預設為市值型
        return "市值"

    @classmethod
    async def classify_ticker_async(cls, ticker: str) -> str:
        """非同步版資產類別判定 (避免阻塞)"""
        return await asyncio.to_thread(cls.classify_ticker_sync, ticker)

    @classmethod
    async def parse_and_group(cls, input_text: str) -> List[Dict[str, Any]]:
        """
        解析文字並依資產類別進行分組與合併
        範例輸入: "0050 30%, 0056 20%, 00679B 30%, 現金 20%"
        """
        # 正則表達式：提取標的名稱/代碼 與 百分比比例
        # 支持 "0050 30%", "VOO:25", "00679B=20", "台幣活存 15%"
        pattern = re.compile(r'([a-zA-Z0-9_\.\u4e00-\u9fa5]+)\s*[:=\s]+\s*(\d+(?:\.\d+)?)\s*%?')
        
        raw_items = []
        # 分行或分逗號/分號解析
        lines = re.split(r'[\n,;]+', input_text)
        for line in lines:
            line = line.strip()
            if not line:
                continue
            match = pattern.search(line)
            if match:
                ticker_part = match.group(1).strip()
                pct_part = float(match.group(2).strip())
                raw_items.append((ticker_part, pct_part))

        if not raw_items:
            return []

        # 非同步併發判定所有標的類別
        tasks = [cls.classify_ticker_async(item[0]) for item in raw_items]
        categories = await asyncio.gather(*tasks)

        # 彙整至四大類別
        # 初始化預設四大卡片
        groups = {
            "市值": {"category": "市值", "target_pct": 0.0, "assets": []},
            "高股息": {"category": "高股息", "target_pct": 0.0, "assets": []},
            "美債": {"category": "美債", "target_pct": 0.0, "assets": []},
            "現金": {"category": "現金", "target_pct": 0.0, "assets": []}
        }

        for (ticker, pct), cat_name in zip(raw_items, categories):
            # 智慧代碼解析補完 (.TW / .TWO / CASH_)
            is_cash = cat_name == "現金"
            
            if is_cash:
                ticker_upper = ticker.upper()
                if not ticker_upper.startswith("CASH_") and ticker_upper != "CASH":
                    resolved_ticker = f"CASH_{ticker_upper}" if ticker_upper else "CASH"
                else:
                    resolved_ticker = ticker_upper
                avg_cost = 1.0
            else:
                resolved_ticker = RebalanceEngine.resolve_ticker(ticker)
                avg_cost = 0.0 # 預設待填
            
            # 加入資產明細
            asset_detail = {
                "ticker": resolved_ticker,
                "shares": 0.0,      # 智慧建置初始持股預設為 0
                "average_cost": avg_cost
            }
            
            # 將比例加總至該分類
            if cat_name in groups:
                groups[cat_name]["target_pct"] += pct
                groups[cat_name]["assets"].append(asset_detail)
            else:
                # 容錯處理：若有其他自訂類別，動態新增
                if cat_name not in groups:
                    groups[cat_name] = {"category": cat_name, "target_pct": 0.0, "assets": []}
                groups[cat_name]["target_pct"] += pct
                groups[cat_name]["assets"].append(asset_detail)

        # 整理輸出，過濾掉比例為 0 且沒有資產的空卡片，並取小數兩位
        result = []
        for cat_data in groups.values():
            cat_data["target_pct"] = round(cat_data["target_pct"], 2)
            if cat_data["target_pct"] > 0 or len(cat_data["assets"]) > 0:
                result.append(cat_data)

        return result
