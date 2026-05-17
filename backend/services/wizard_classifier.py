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
        "00934": "高股息", "00940": "高股息", "00915": "高股息", "00918": "高股息", "00712": "高股息", "00881": "高股息",
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
        智慧解析文字並依資產類別進行分組與合併
        相容新舊格式：
        1. 類別目標分配比：市值型 50%, 高股息型 40%, 債券型 5%, 現金 5%
        2. 持股成分股數/均價：006208 1516股 均價109.14 或 台幣活存 50000
        """
        # 初始化預設四大類別
        groups = {
            "市值": {"category": "市值型股票", "target_pct": 0.0, "assets": []},
            "高股息": {"category": "高股息型", "target_pct": 0.0, "assets": []},
            "美債": {"category": "美國公債", "target_pct": 0.0, "assets": []},
            "現金": {"category": "現金", "target_pct": 0.0, "assets": []}
        }

        # 用於匹配類別目標比例的 Regex
        pat_cat = re.compile(
            r'(市值型|市值|高股息型|高股息|債券型|債券|美債|美國公債|現金|CASH)\s*[:=\s]?\s*(\d+(?:\.\d+)?)\s*%?',
            re.IGNORECASE
        )

        # 用於匹配成份股持股的 Regex
        pat_hold = re.compile(
            r'^([a-zA-Z0-9_\.\u4e00-\u9fa5]+)\s+(\d+(?:\.\d+)?)\s*(?:股|元)?\s*(?:均價|平均成本|成本|price)?\s*(\d+(?:\.\d+)?)?$',
            re.IGNORECASE
        )

        # 按行切分
        lines = re.split(r'[\n,;]+', input_text)
        
        # 1. 偵測是否含有類別目標比例宣告 (e.g. 市值型 50%)
        has_cat_targets = False
        for line in lines:
            if pat_cat.search(line):
                if any(x in line for x in ["型", "%", "百分比", "配置", "比例"]):
                    has_cat_targets = True
                    break
                matches = pat_cat.findall(line)
                if len(matches) >= 2:
                    has_cat_targets = True
                    break

        holdings_to_classify = []

        if has_cat_targets:
            # 2A. 新格式：兩階段智慧配置導入
            for line in lines:
                line = line.strip()
                if not line:
                    continue

                # 解析類別比例
                cat_matches = pat_cat.findall(line)
                if cat_matches and (any(x in line for x in ["型", "%", "百分比", "配置", "比例", "先配置"]) or len(cat_matches) >= 2):
                    for cat_label, pct_str in cat_matches:
                        val = float(pct_str)
                        if cat_label in ["市值型", "市值"]:
                            groups["市值"]["target_pct"] = val
                        elif cat_label in ["高股息型", "高股息"]:
                            groups["高股息"]["target_pct"] = val
                        elif cat_label in ["債券型", "債券", "美債", "美國公債"]:
                            groups["美債"]["target_pct"] = val
                        elif cat_label in ["現金", "CASH"]:
                            groups["現金"]["target_pct"] = val
                    continue

                # 解析持股成分股數/均價
                cleaned_line = re.sub(r'^\d+[\.\)\]、]\s*', '', line).strip()
                hold_match = pat_hold.match(cleaned_line)
                if hold_match:
                    ticker = hold_match.group(1).strip()
                    val1 = float(hold_match.group(2).strip())
                    val2_str = hold_match.group(3)
                    val2 = float(val2_str.strip()) if val2_str else None
                    
                    holdings_to_classify.append((ticker, val1, val2))
            is_fallback_mode = False

        else:
            # 2B. 舊格式：純比例回退導入
            fallback_pattern = re.compile(r'([a-zA-Z0-9_\.\u4e00-\u9fa5]+)\s*[:=\s]+\s*(\d+(?:\.\d+)?)\s*%?')
            for line in lines:
                line = line.strip()
                if not line:
                    continue
                match = fallback_pattern.search(line)
                if match:
                    ticker = match.group(1).strip()
                    pct = float(match.group(2).strip())
                    holdings_to_classify.append((ticker, pct, None))
            is_fallback_mode = True

        if holdings_to_classify:
            # 異步分類所有標的
            tasks = [cls.classify_ticker_async(item[0]) for item in holdings_to_classify]
            categories = await asyncio.gather(*tasks)

            for (ticker, val1, val2), cat_name in zip(holdings_to_classify, categories):
                is_cash = cat_name == "現金"
                
                if is_cash:
                    ticker_upper = ticker.upper()
                    if not ticker_upper.startswith("CASH_") and ticker_upper != "CASH":
                        resolved_ticker = f"CASH_{ticker_upper}" if ticker_upper else "CASH"
                    else:
                        resolved_ticker = ticker_upper
                    
                    if is_fallback_mode:
                        shares = 0.0
                        avg_cost = 1.0
                        groups[cat_name]["target_pct"] += val1
                    else:
                        shares = val1
                        avg_cost = 1.0
                else:
                    resolved_ticker = RebalanceEngine.resolve_ticker(ticker)
                    if is_fallback_mode:
                        shares = 0.0
                        avg_cost = 0.0
                        groups[cat_name]["target_pct"] += val1
                    else:
                        shares = val1
                        avg_cost = val2 if val2 is not None else 1.0

                asset_detail = {
                    "ticker": resolved_ticker,
                    "shares": shares,
                    "average_cost": avg_cost
                }

                if cat_name in groups:
                    groups[cat_name]["assets"].append(asset_detail)

        # 整理輸出
        result = []
        for cat_data in groups.values():
            cat_data["target_pct"] = round(cat_data["target_pct"], 2)
            if cat_data["target_pct"] > 0 or len(cat_data["assets"]) > 0:
                result.append(cat_data)

        return result
