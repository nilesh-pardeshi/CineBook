from typing import Literal, Optional
from pydantic import BaseModel, Field


class SeatRecommendationRequest(BaseModel):
    show_id: int = Field(gt=0)
    group_size: int = Field(default=2, ge=1, le=8)
    max_budget_per_seat: Optional[int] = Field(default=None, ge=0, le=100000)
    preferred_tier: Optional[Literal["regular", "premium", "recliner"]] = None
    prefer_aisle: bool = False
    accessibility_required: bool = False


class SeatClusterRecommendation(BaseModel):
    seats: list[str]
    tier: str
    price_per_seat: int
    total_price: int
    score: float
    reasons: list[str]


class SeatRecommendationResponse(BaseModel):
    show_id: int
    group_size: int
    recommendations: list[SeatClusterRecommendation]
    explanation: str
    algorithm: str = "weighted_geometry_v1"


class CrowdPredictionResponse(BaseModel):
    show_id: int
    capacity: int
    occupied_seats: int
    current_fill_rate: float
    expected_fill_rate: float
    rush_level: Literal["Low", "Moderate", "High", "Very High"]
    signals: list[str]
    model_type: str = "deterministic_baseline_v1"
    limitation: str = "Baseline estimate; not a trained model. Collect occupancy snapshots and train the model before reporting ML accuracy."
    model_samples: Optional[int] = None
    model_metrics: Optional[dict] = None
    model_samples: Optional[int] = None
    model_metrics: Optional[dict] = None


class ConciergeRequest(BaseModel):
    prompt: str = Field(min_length=2, max_length=500)
    city: Optional[str] = Field(default=None, max_length=80)
    language: Optional[str] = Field(default=None, max_length=40)
    budget: Optional[int] = Field(default=None, ge=0, le=100000)
    group_size: int = Field(default=2, ge=1, le=8)

