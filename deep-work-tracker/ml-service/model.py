"""
model.py — predicts a user's best focus hours from their past sessions.

The idea in one sentence:
    "When this user starts a session at hour H on weekday W, how long do
    they usually manage to focus?" — then rank the hours by that number.

Features (model inputs):  hour of day (0-23), day of week (0=Mon .. 6=Sun)
Target (model output):    duration_minutes of the session

The dataset is tiny (one user's sessions), so we retrain on every request —
training a small decision tree on ~100 rows takes well under a millisecond.
"""
from datetime import datetime

from sklearn.tree import DecisionTreeRegressor

# We only score "waking" hours: 6:00 through 23:00.
HOURS = range(6, 24)
WEEKDAYS = range(7)


def build_training_data(sessions):
    """Turn raw sessions into (X, y) arrays that scikit-learn understands.

    X is a list of feature rows, one per session: [hour, weekday]
    y is the matching list of targets: how many minutes that session lasted.
    """
    X, y = [], []
    for s in sessions:
        # fromisoformat parses strings like '2026-07-03T09:30:00'.
        # .replace() makes a trailing 'Z' (UTC marker) parseable too.
        dt = datetime.fromisoformat(str(s["started_at"]).replace("Z", "+00:00"))
        X.append([dt.hour, dt.weekday()])
        y.append(float(s["duration_minutes"]))
    return X, y


def predict_best_hours(sessions):
    """Train a decision tree on the user's sessions, then ask it to predict
    the focus duration for every hour of the day. Returns the full hourly
    curve plus the top 3 hours."""
    X, y = build_training_data(sessions)

    # A decision tree learns rules like: "if hour < 12 and weekday < 5,
    # predict 85 minutes". Parameters keep the tree small so it captures
    # broad patterns instead of memorizing individual sessions:
    #   max_depth=4        -> at most 4 yes/no questions per prediction
    #   min_samples_leaf=3 -> a rule must be backed by >= 3 real sessions
    #   random_state=42    -> same tree every time (reproducible)
    model = DecisionTreeRegressor(max_depth=4, min_samples_leaf=3, random_state=42)
    model.fit(X, y)

    hourly = []
    for hour in HOURS:
        # The model needs a weekday to make a prediction, but we want a
        # general "how good is 9am?" answer — so we predict 9am for all
        # 7 weekdays and average the results.
        rows = [[hour, weekday] for weekday in WEEKDAYS]
        predictions = model.predict(rows)
        average = sum(predictions) / len(predictions)
        hourly.append({"hour": hour, "predicted_minutes": round(average, 1)})

    # Sort a copy by predicted minutes (highest first) and keep the top 3.
    top3 = sorted(hourly, key=lambda h: h["predicted_minutes"], reverse=True)[:3]

    return {
        "hourly": hourly,                          # full 6:00-23:00 curve
        "best_hours": [h["hour"] for h in top3],   # e.g. [9, 8, 10]
        "trained_on": len(sessions),               # how much data we had
    }
