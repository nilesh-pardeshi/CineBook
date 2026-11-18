from types import SimpleNamespace
from datetime import datetime, timedelta
from app.ai.seat_recommender import recommend_seat_clusters
from app.ai.crowd_predictor import predict_crowd


def test_seat_recommender_returns_contiguous_available_seats():
    screen = SimpleNamespace(rows=10, cols=12, premium_rows=2, recliner_rows=1, accessible_seat_labels="A1")
    show = SimpleNamespace(price_regular=150, price_premium=250, price_recliner=400,
                           price_for=lambda tier: {"regular":150,"premium":250,"recliner":400}[tier])
    results = recommend_seat_clusters(screen, show, {"F6"}, 2, max_budget_per_seat=200, prefer_aisle=False)
    assert results
    assert len(results[0]["seats"]) == 2
    assert results[0]["seats"][1][1:] == str(int(results[0]["seats"][0][1:]) + 1)
    assert "F6" not in results[0]["seats"]


def test_accessibility_requires_configured_labels():
    screen = SimpleNamespace(rows=5, cols=8, premium_rows=1, recliner_rows=0, accessible_seat_labels="")
    show = SimpleNamespace(price_regular=100, price_premium=200, price_recliner=300,
                           price_for=lambda tier: {"regular":100,"premium":200,"recliner":300}[tier])
    assert recommend_seat_clusters(screen, show, set(), 1, accessibility_required=True) == []


def test_crowd_predictor_is_bounded_and_explainable():
    show = SimpleNamespace(start_time=datetime.now() + timedelta(days=2), format="IMAX 2D")
    result = predict_crowd(show, 100, 30)
    assert 30 <= result["expected_fill_rate"] <= 98
    assert result["model_type"] == "deterministic_baseline_v1"
    assert result["signals"]
