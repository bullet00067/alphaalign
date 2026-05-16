import pytest
from services.rebalancer import RebalanceEngine

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
