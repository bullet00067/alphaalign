import pytest
from services.wizard_classifier import WizardClassifier

@pytest.mark.anyio
async def test_classify_ticker_local():
    # 測試本地字典檔快速解析
    assert WizardClassifier.classify_ticker_sync("0050") == "市值"
    assert WizardClassifier.classify_ticker_sync("0056") == "高股息"
    assert WizardClassifier.classify_ticker_sync("00679B") == "美債"
    assert WizardClassifier.classify_ticker_sync("TLT") == "美債"
    assert WizardClassifier.classify_ticker_sync("CASH") == "現金"
    assert WizardClassifier.classify_ticker_sync("台幣活存") == "現金"

@pytest.mark.anyio
async def test_parse_and_group_basic():
    # 測試多種寫法混合的字串解析與分類彙整
    input_text = "0050 30%, 0056:25%, 00679B=20, 台幣活存 25%"
    result = await WizardClassifier.parse_and_group(input_text)
    
    # 預計會解析出四個類別
    assert len(result) == 4
    
    # 驗證類別 target_pct 是否正確
    categories = {item["category"]: item for item in result}
    
    assert "市值型股票" in categories
    assert categories["市值型股票"]["target_pct"] == 30.0
    assert categories["市值型股票"]["assets"][0]["ticker"] == "0050.TW"
    
    assert "高股息型" in categories
    assert categories["高股息型"]["target_pct"] == 25.0
    assert categories["高股息型"]["assets"][0]["ticker"] == "0056.TW"
    
    assert "美國公債" in categories
    assert categories["美國公債"]["target_pct"] == 20.0
    assert categories["美國公債"]["assets"][0]["ticker"] == "00679B.TWO"
    
    assert "現金" in categories
    assert categories["現金"]["target_pct"] == 25.0
    assert categories["現金"]["assets"][0]["ticker"] == "CASH_台幣活存"

@pytest.mark.anyio
async def test_parse_and_group_aggregation():
    # 測試多檔相同類別標的之比例合併
    input_text = "0050 20%, 006208 15%, TLT 30%, BND 10%"
    result = await WizardClassifier.parse_and_group(input_text)
    
    categories = {item["category"]: item for item in result}
    
    # 市值應為 20% + 15% = 35%
    assert categories["市值型股票"]["target_pct"] == 35.0
    assert len(categories["市值型股票"]["assets"]) == 2
    assert categories["市值型股票"]["assets"][0]["ticker"] == "0050.TW"
    assert categories["市值型股票"]["assets"][1]["ticker"] == "006208.TW"
    
    # 美債應為 30% + 10% = 40%
    assert categories["美國公債"]["target_pct"] == 40.0
    assert len(categories["美國公債"]["assets"]) == 2

@pytest.mark.anyio
async def test_parse_two_stage_holdings():
    # 測試使用者提供的兩階段真實數據
    input_text = """
    1.先配置資產類型百分比
    市值型 50%, 高股息型 40%, 債券型 5%, 現金 5%

    2.設定成分股後， 自動將這些成分股依照系統判斷排入各項資產類型
    006208 1516股 均價109.14
    00679B 3306股 均價 28.32
    00712 3201股 均價 9.57
    00878 22856股 均價 19.74
    00881 2000股 均價 15.13
    2330 11股 均價 1847.72
    台幣活存 50000
    """
    
    result = await WizardClassifier.parse_and_group(input_text)
    
    assert len(result) == 4
    categories = {item["category"]: item for item in result}
    
    # 驗證目標配置百分比
    assert categories["市值型股票"]["target_pct"] == 50.0
    assert categories["高股息型"]["target_pct"] == 40.0
    assert categories["美國公債"]["target_pct"] == 5.0
    assert categories["現金"]["target_pct"] == 5.0
    
    # 驗證成分股股數與成交均價
    # 市值型股票: 006208, 2330
    market_assets = {a["ticker"]: a for a in categories["市值型股票"]["assets"]}
    assert "006208.TW" in market_assets
    assert market_assets["006208.TW"]["shares"] == 1516.0
    assert market_assets["006208.TW"]["average_cost"] == 109.14
    
    assert "2330.TW" in market_assets
    assert market_assets["2330.TW"]["shares"] == 11.0
    assert market_assets["2330.TW"]["average_cost"] == 1847.72
    
    # 美國公債: 00679B
    bond_assets = {a["ticker"]: a for a in categories["美國公債"]["assets"]}
    assert "00679B.TWO" in bond_assets
    assert bond_assets["00679B.TWO"]["shares"] == 3306.0
    assert bond_assets["00679B.TWO"]["average_cost"] == 28.32
    
    # 高股息型: 00712, 00878, 00881
    dividend_assets = {a["ticker"]: a for a in categories["高股息型"]["assets"]}
    assert "00712.TW" in dividend_assets
    assert dividend_assets["00712.TW"]["shares"] == 3201.0
    assert dividend_assets["00712.TW"]["average_cost"] == 9.57
    
    assert "00878.TW" in dividend_assets
    assert dividend_assets["00878.TW"]["shares"] == 22856.0
    assert dividend_assets["00878.TW"]["average_cost"] == 19.74
    
    assert "00881.TW" in dividend_assets
    assert dividend_assets["00881.TW"]["shares"] == 2000.0
    assert dividend_assets["00881.TW"]["average_cost"] == 15.13
    
    # 現金: 台幣活存
    cash_assets = {a["ticker"]: a for a in categories["現金"]["assets"]}
    assert "CASH_台幣活存" in cash_assets
    assert cash_assets["CASH_台幣活存"]["shares"] == 50000.0
    assert cash_assets["CASH_台幣活存"]["average_cost"] == 1.0
