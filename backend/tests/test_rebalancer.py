import pytest
from services.rebalancer import RebalanceEngine, RebalanceRequest, CategoryAllocation, AssetInput

def test_calculate_fee_tw_stock():
    # 測試台股買入手續費 (最低 20 元)
    fee1 = RebalanceEngine.calculate_fee_and_tax("2330.TW", amount=10000, is_sell=False)
    assert fee1 == 20.0  # 10000 * 0.001425 * 0.6 = 8.55 (小於 20，取 20)

    # 測試台股賣出手續費 + 證交稅
    fee2 = RebalanceEngine.calculate_fee_and_tax("2330.TW", amount=100000, is_sell=True)
    expected_broker_fee = 100000 * 0.001425 * 0.6  # 85.5
    expected_tax = 100000 * 0.003  # 300
    assert fee2 == expected_broker_fee + expected_tax

def test_calculate_fee_us_stock():
    # 測試美股手續費 (0.05%)
    fee = RebalanceEngine.calculate_fee_and_tax("AAPL", amount=10000, is_sell=False)
    assert fee == 5.0  # 10000 * 0.0005

@pytest.mark.anyio
async def test_rebalancer_momentum_mode(monkeypatch):
    # Mock price fetching to return 100 for QQQM and 150 for AAPL
    async def mock_get_verified_price_async(ticker):
        prices = {"QQQM": 100.0, "AAPL": 150.0}
        return prices.get(ticker, 1.0)
        
    from services.rebalancer import PriceFetcher
    monkeypatch.setattr(PriceFetcher, "get_verified_price_async", mock_get_verified_price_async)

    # -------------------------------------------------------------
    # 1. 測試：風險分散模式 (momentum_mode = False)
    # 應買入「持股數量最多」的標的
    # QQQM (50股) > AAPL (10股)，所以應優先買入 QQQM
    # -------------------------------------------------------------
    req_diversified = RebalanceRequest(
        account_id="test_acc",
        deposit_cash=1000.0,
        current_free_cash=0.0,
        momentum_mode=False,
        allocations=[
            CategoryAllocation(
                category="市值型股票",
                target_pct=1.0,
                assets=[
                    AssetInput(ticker="QQQM", current_shares=50.0, average_cost=120.0),
                    AssetInput(ticker="AAPL", current_shares=10.0, average_cost=100.0)
                ]
            )
        ]
    )

    result_div = await RebalanceEngine.execute(req_diversified)
    reports_div = result_div["reports"][0]
    actions_div = reports_div["actions"]
    
    assert len(actions_div) == 1
    assert actions_div[0]["action"] == "BUY"
    assert actions_div[0]["ticker"] == "QQQM"

    # -------------------------------------------------------------
    # 2. 測試：強勢股加碼模式 (momentum_mode = True)
    # 應買入「歷史報酬率最高」的強勢標的
    # AAPL ROI = (150-100)/100 = 50.0%
    # QQQM ROI = (100-120)/120 = -16.6%
    # AAPL (50.0%) > QQQM (-16.6%)，所以應優先買入 AAPL
    # -------------------------------------------------------------
    req_momentum = RebalanceRequest(
        account_id="test_acc",
        deposit_cash=1000.0,
        current_free_cash=0.0,
        momentum_mode=True,
        allocations=[
            CategoryAllocation(
                category="市值型股票",
                target_pct=1.0,
                assets=[
                    AssetInput(ticker="QQQM", current_shares=50.0, average_cost=120.0),
                    AssetInput(ticker="AAPL", current_shares=10.0, average_cost=100.0)
                ]
            )
        ]
    )

    result_mom = await RebalanceEngine.execute(req_momentum)
    reports_mom = result_mom["reports"][0]
    actions_mom = reports_mom["actions"]
    
    assert len(actions_mom) == 1
    assert actions_mom[0]["action"] == "BUY"
    assert actions_mom[0]["ticker"] == "AAPL"

