# Traffic Jakarta — future speed forecasting (XGBoost)

This directory holds **training pipeline skeleton only**. No model is trained in the app repo yet.

## Legal constraints

- Do **not** store TomTom historical flow data unless your TomTom agreement explicitly allows it.
- Prefer **first-party community features** (`src/intelligence/collectMlSnapshot.ts`) and lawful public datasets for offline training.
- Published research aggregates (e.g. time-period GeoPackage) are **not** sufficient for 15/30 minute speed labels without timestamped raw series.

## Layout

- `features/` — feature definitions aligned with `src/intelligence/forecast/features.ts`
- `data/` — placeholders for exported training rows (gitignored when large)
- `train/` — future XGBoost training script
- `evaluate/` — holdout metrics
- `models/` — exported model artifacts (not committed until licensed)

## Current app behavior

Forecasts return `status: insufficient_training_data` until a model is trained and integrated via a server endpoint.
