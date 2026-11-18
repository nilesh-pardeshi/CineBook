"""Train and evaluate CineBook's Random Forest occupancy forecaster.

Run from backend/: python train_crowd_model.py
Training examples pair an earlier snapshot with the same show's near-start
snapshot (within six hours of showtime). Evaluation is grouped by show_id to
avoid leakage of observations from the same show into both train and test.
"""
from collections import defaultdict
import json

from sqlalchemy import select
from app.database import SessionLocal
from app.models import ShowOccupancySnapshot
from app.ai.crowd_ml import MODEL_PATH

MIN_ROWS = 30
MIN_SHOWS = 10


def main() -> int:
    try:
        import joblib
        import numpy as np
        from sklearn.ensemble import RandomForestRegressor
        from sklearn.feature_extraction import DictVectorizer
        from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
        from sklearn.model_selection import GroupShuffleSplit
        from sklearn.pipeline import Pipeline
    except ImportError as exc:
        print(f"Missing ML dependency: {exc}. Run: pip install -r requirements.txt")
        return 2

    db = SessionLocal()
    try:
        rows = db.scalars(
            select(ShowOccupancySnapshot).order_by(
                ShowOccupancySnapshot.show_id,
                ShowOccupancySnapshot.captured_at,
            )
        ).all()
        by_show = defaultdict(list)
        for row in rows:
            by_show[row.show_id].append(row)

        features, targets, groups = [], [], []
        for show_id, snapshots in by_show.items():
            if len(snapshots) < 2:
                continue
            terminal = snapshots[-1]
            if abs(float(terminal.hours_to_start)) > 6:
                continue
            target = float(terminal.fill_rate)
            for snap in snapshots[:-1]:
                elapsed = (terminal.captured_at - snap.captured_at).total_seconds()
                if elapsed < 1800:
                    continue
                if not 0 <= float(snap.fill_rate) <= 100 or not 0 <= target <= 100:
                    continue
                features.append({
                    "capacity": int(snap.capacity),
                    "current_fill_rate": float(snap.fill_rate),
                    "hours_to_start": float(max(0, snap.hours_to_start)),
                    "weekday": int(snap.weekday),
                    "start_hour": int(snap.start_hour),
                    "is_weekend": bool(snap.is_weekend),
                    "show_format": str(snap.show_format),
                    "language": str(snap.language),
                    "city": str(snap.city),
                })
                targets.append(target)
                groups.append(show_id)

        distinct_shows = len(set(groups))
        print(f"Usable paired rows: {len(features)} from {distinct_shows} distinct shows")
        if len(features) < MIN_ROWS or distinct_shows < MIN_SHOWS:
            print(
                f"Insufficient temporal history. Need at least {MIN_ROWS} paired rows "
                f"across {MIN_SHOWS} shows. Keep collecting snapshots at least 30 minutes apart; "
                "each show's final snapshot must be within six hours of showtime."
            )
            return 1

        splitter = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=42)
        train_idx, test_idx = next(splitter.split(features, targets, groups))
        train_shows = set(groups[i] for i in train_idx)
        test_shows = set(groups[i] for i in test_idx)
        if not train_idx.size or not test_idx.size or train_shows.intersection(test_shows):
            print("Unable to create a valid show-level train/test split. Collect more distinct shows.")
            return 1

        pipeline = Pipeline([
            ("vectorizer", DictVectorizer(sparse=False)),
            ("model", RandomForestRegressor(
                n_estimators=300,
                min_samples_leaf=2,
                max_features=0.9,
                random_state=42,
                n_jobs=-1,
            )),
        ])
        X_train = [features[i] for i in train_idx]
        X_test = [features[i] for i in test_idx]
        y_train = [targets[i] for i in train_idx]
        y_test = [targets[i] for i in test_idx]
        pipeline.fit(X_train, y_train)
        predictions = np.clip(pipeline.predict(X_test), 0, 100)
        metrics = {
            "mae_percentage_points": round(float(mean_absolute_error(y_test, predictions)), 3),
            "rmse_percentage_points": round(float(np.sqrt(mean_squared_error(y_test, predictions))), 3),
            "r2": round(float(r2_score(y_test, predictions)), 3) if len(y_test) > 1 else None,
            "test_rows": len(test_idx),
            "train_shows": len(train_shows),
            "test_shows": len(test_shows),
            "split_strategy": "GroupShuffleSplit by show_id",
        }
        MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
        bundle = {
            "pipeline": pipeline,
            "samples": len(features),
            "shows": distinct_shows,
            "metrics": metrics,
            "feature_version": "cinebook_occupancy_v1",
        }
        joblib.dump(bundle, MODEL_PATH)
        print(json.dumps({"model": str(MODEL_PATH), "samples": len(features), "shows": distinct_shows, "metrics": metrics}, indent=2))
        print("Model saved. Review held-out metrics before describing its predictive quality in your report.")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
