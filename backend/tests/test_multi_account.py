import pytest
from main import get_rebalance_history
from services.rebalancer import RebalanceRequest

def test_rebalance_request_account_id():
    # Verify that RebalanceRequest accepts and defaults account_id
    req = RebalanceRequest(
        deposit_cash=1000,
        current_free_cash=500,
        allocations=[]
    )
    assert req.account_id == "default"

    req_custom = RebalanceRequest(
        account_id="custom_acc",
        deposit_cash=1000,
        current_free_cash=500,
        allocations=[]
    )
    assert req_custom.account_id == "custom_acc"

@pytest.mark.anyio
async def test_api_history_filtering(monkeypatch):
    # Mock SupabaseDB methods to return pre-defined history data
    mock_history = [
        {
            "id": "1",
            "created_at": "2026-05-18T10:00:00Z",
            "snapshot": {
                "account_id": "default",
                "deposit_cash": 100,
                "current_free_cash": 0,
                "allocations": []
            }
        },
        {
            "id": "2",
            "created_at": "2026-05-18T11:00:00Z",
            "snapshot": {
                "account_id": "acc_fubon",
                "deposit_cash": 200,
                "current_free_cash": 0,
                "allocations": []
            }
        },
        {
            "id": "3",
            "created_at": "2026-05-18T12:00:00Z",
            "snapshot": {
                # Legacy record without account_id should default to "default"
                "deposit_cash": 300,
                "current_free_cash": 0,
                "allocations": []
            }
        }
    ]

    from services.supabase_db import SupabaseDB
    monkeypatch.setattr(SupabaseDB, "is_configured", lambda: True)
    monkeypatch.setattr(SupabaseDB, "get_history", lambda: mock_history)
    monkeypatch.setattr(SupabaseDB, "get_local", lambda: [])

    # Test filtering for default account (should return id 1 and id 3 as fallback)
    data = await get_rebalance_history(account_id="default")
    assert len(data) == 2
    ids = [item["id"] for item in data]
    assert "1" in ids
    assert "3" in ids

    # Test filtering for custom account fubon (should return only id 2)
    data_fubon = await get_rebalance_history(account_id="acc_fubon")
    assert len(data_fubon) == 1
    assert data_fubon[0]["id"] == "2"
