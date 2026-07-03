"""Deep-Work Tracker ML service — Phase 1 scaffold."""
import os

from dotenv import load_dotenv
from flask import Flask, jsonify

load_dotenv()

app = Flask(__name__)


@app.get("/")
def hello():
    return jsonify({"service": "ml-service", "status": "ok"})


@app.get("/health")
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    app.run(host="127.0.0.1", port=port, debug=True)
