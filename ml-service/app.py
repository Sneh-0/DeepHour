"""Deep-Work Tracker ML service — trains per-request on the caller's data."""
import os

from dotenv import load_dotenv
from flask import Flask, jsonify, request

from model import predict_best_hours

load_dotenv()

app = Flask(__name__)

# When deployed, the ML service has a public URL but no user auth. Setting
# ML_SHARED_SECRET (same value on the API) requires callers to present it,
# so only our Express server can reach /predict. Unset in local dev = open.
ML_SHARED_SECRET = os.environ.get("ML_SHARED_SECRET")


@app.before_request
def require_shared_secret():
    # Health/root probes stay open so the host's uptime checks don't need the
    # secret; everything else must match when a secret is configured.
    if not ML_SHARED_SECRET or request.path in ("/", "/health"):
        return None
    if request.headers.get("X-ML-Secret") != ML_SHARED_SECRET:
        return jsonify({"error": "Unauthorized"}), 401
    return None


@app.get("/")
def hello():
    return jsonify({"service": "ml-service", "status": "ok"})


@app.get("/health")
def health():
    return jsonify({"status": "ok"})


@app.post("/predict")
def predict():
    """Body: { "sessions": [{ "started_at": ISO string, "duration_minutes": int }] }"""
    body = request.get_json(silent=True)

    sessions = body.get("sessions") if isinstance(body, dict) else None
    if not isinstance(sessions, list) or len(sessions) == 0:
        return jsonify({"error": "Body must be JSON with a non-empty 'sessions' array"}), 400

    try:
        result = predict_best_hours(sessions)
    except (KeyError, TypeError, ValueError) as exc:
        # A session was missing a field or had an unparseable date/number.
        return jsonify({"error": f"Bad session data: {exc}"}), 400

    return jsonify(result)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    app.run(host="127.0.0.1", port=port, debug=True)
