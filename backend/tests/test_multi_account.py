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


@pytest.mark.anyio
async def test_api_history_deletion(monkeypatch):
    from main import delete_rebalance_record
    from services.supabase_db import SupabaseDB
    import requests

    # 1. Test API endpoint routing
    monkeypatch.setattr(SupabaseDB, "delete_history", lambda rid: {"status": "success", "message": "mocked delete", "id": rid})
    res = await delete_rebalance_record("12345")
    assert res["status"] == "success"
    assert res["id"] == "12345"

    # 2. Test SupabaseDB.delete_history local prefix direct fallback
    monkeypatch.setattr(SupabaseDB, "delete_local", lambda rid: {"status": "success", "message": "local success", "id": rid})
    res_local = SupabaseDB.delete_history("local_9999")
    assert res_local["status"] == "success"
    assert res_local["id"] == "local_9999"

    # 3. Test SupabaseDB.delete_history Supabase failure fallback to local
    monkeypatch.setattr(SupabaseDB, "is_configured", lambda: True)
    
    # Mock requests.delete to return a 401 (e.g. RLS error)
    class MockResponse:
        status_code = 401
        text = "RLS restriction"
    
    monkeypatch.setattr(requests, "delete", lambda *args, **kwargs: MockResponse())
    
    # Test delete_history should fallback to delete_local
    res_fallback = SupabaseDB.delete_history("supabase-uuid-123")
    assert res_fallback["status"] == "success"
    assert res_fallback["id"] == "supabase-uuid-123"

