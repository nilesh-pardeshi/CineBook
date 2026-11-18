from __future__ import annotations
from typing import Optional
from ..layout import ROW_LETTERS, row_category


def _clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def recommend_seat_clusters(screen, show, occupied: set[str], group_size: int,
                            max_budget_per_seat: Optional[int] = None,
                            preferred_tier: Optional[str] = None,
                            prefer_aisle: bool = False,
                            accessibility_required: bool = False,
                            limit: int = 3) -> list[dict]:
    """Rank contiguous seat blocks using documented geometry, price and preference features.

    Row A is nearest the screen. The target viewing row is 60% of the way from
    the screen to the back wall. Scores are deterministic and are not a trained ML model.
    """
    if screen.rows > len(ROW_LETTERS):
        return []
    accessible = {x.strip().upper() for x in (screen.accessible_seat_labels or "").split(",") if x.strip()}
    if accessibility_required and not accessible:
        return []

    target_row = (screen.rows - 1) * 0.60
    center_col = (screen.cols + 1) / 2
    candidates = []
    for row_idx in range(screen.rows):
        row_letter = ROW_LETTERS[row_idx]
        tier = row_category(screen, row_idx)
        price = show.price_for(tier)
        if max_budget_per_seat is not None and price > max_budget_per_seat:
            continue
        if preferred_tier and tier != preferred_tier:
            continue
        for start in range(1, screen.cols - group_size + 2):
            labels = [f"{row_letter}{col}" for col in range(start, start + group_size)]
            if any(label in occupied for label in labels):
                continue
            if accessibility_required and not any(label in accessible for label in labels):
                continue

            midpoint_col = (start + (group_size - 1) / 2)
            row_distance = abs(row_idx - target_row) / max(1, screen.rows - 1)
            horizontal_distance = abs(midpoint_col - center_col) / max(1, (screen.cols - 1) / 2)
            geometry_score = 1 - (0.65 * row_distance + 0.35 * horizontal_distance)
            tier_score = 1.0 if not preferred_tier or tier == preferred_tier else 0.65
            if max_budget_per_seat is None:
                budget_score = 1.0
            else:
                budget_score = _clamp(1 - (price / max(1, max_budget_per_seat)) * 0.25)
            edge_distance = min(start - 1, screen.cols - (start + group_size - 1))
            aisle_score = 1 - _clamp(edge_distance / max(1, screen.cols / 2))
            score = 100 * (0.65 * geometry_score + 0.15 * tier_score + 0.10 * budget_score + 0.10 * (aisle_score if prefer_aisle else 0.75))
            reasons = []
            if geometry_score >= 0.82:
                reasons.append("Near the recommended central viewing zone")
            elif horizontal_distance <= 0.25:
                reasons.append("Well aligned with the screen centre")
            else:
                reasons.append("Available contiguous group seating")
            if prefer_aisle and aisle_score >= 0.65:
                reasons.append("Close to an aisle")
            if preferred_tier:
                reasons.append(f"Matches your {preferred_tier} tier preference")
            if max_budget_per_seat is not None:
                reasons.append(f"Within ₹{max_budget_per_seat:,} per-seat budget")
            if accessibility_required:
                reasons.append("Includes a seat marked accessible in this screen layout")
            candidates.append({"seats": labels, "tier": tier, "price_per_seat": price,
                               "total_price": price * group_size, "score": round(score, 1),
                               "reasons": reasons})
    candidates.sort(key=lambda item: (-item["score"], item["total_price"], item["seats"][0]))
    return candidates[:limit]
