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
    
    assert "市值" in categories
    assert categories["市值"]["target_pct"] == 30.0
    assert categories["市值"]["assets"][0]["ticker"] == "0050.TW"
    
    assert "高股息" in categories
    assert categories["高股息"]["target_pct"] == 25.0
    assert categories["高股息"]["assets"][0]["ticker"] == "0056.TW"
    
    assert "美債" in categories
    assert categories["美債"]["target_pct"] == 20.0
    assert categories["美債"]["assets"][0]["ticker"] == "00679B.TWO"
    
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
    assert categories["市值"]["target_pct"] == 35.0
    assert len(categories["市值"]["assets"]) == 2
    assert categories["市值"]["assets"][0]["ticker"] == "0050.TW"
    assert categories["市值"]["assets"][1]["ticker"] == "006208.TW"
    
    # 美債應為 30% + 10% = 40%
    assert categories["美債"]["target_pct"] == 40.0
    assert len(categories["美債"]["assets"]) == 2
