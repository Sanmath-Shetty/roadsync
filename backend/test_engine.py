"""Run with: python test_engine.py  (also works with pytest)"""
from engine import check_conflicts, find_coordination, suggest_route
from seed import DEMO_CLEAR_LINE, DEMO_TELECOM_LINE, WORK_ORDERS, assets_as_features


def test_flags_known_gas_crossing():
    conflicts = check_conflicts(DEMO_TELECOM_LINE, assets_as_features())

    # Exactly one conflict, and it is the gas line.
    assert len(conflicts) == 1, conflicts
    hit = conflicts[0]
    assert hit["asset_id"] == "gas-1"
    assert hit["type"] == "gas"

    # The point should be the known crossing [74.8450, 12.8750] (within ~1 m).
    lng, lat = hit["point"]
    assert abs(lng - 74.8450) < 0.00001
    assert abs(lat - 12.8750) < 0.00001


def test_clear_line_returns_nothing():
    assert check_conflicts(DEMO_CLEAR_LINE, assets_as_features()) == []


def test_reroute_is_conflict_free():
    route = suggest_route(DEMO_TELECOM_LINE, assets_as_features())
    assert route is not None
    assert check_conflicts(route["geometry"], assets_as_features()) == []
    print(f"  reroute offset: {route['offset_m']} m")


def test_coordination_matches_mcc():
    orders = [dict(w, id=i + 1) for i, w in enumerate(WORK_ORDERS)]
    matches = find_coordination(DEMO_TELECOM_LINE, "2026-10-06", "2026-10-08", "Airtel", orders)
    assert len(matches) == 1 and "MCC" in matches[0]["org"]
    # Far-away dates -> no match
    assert find_coordination(DEMO_TELECOM_LINE, "2026-12-01", "2026-12-03", "Airtel", orders) == []


if __name__ == "__main__":
    test_flags_known_gas_crossing()
    print("PASS: known gas crossing flagged")
    test_clear_line_returns_nothing()
    print("PASS: clear line returns no conflicts")
    test_reroute_is_conflict_free()
    print("PASS: reroute avoids every asset")
    test_coordination_matches_mcc()
    print("PASS: coordination matches MCC order")
