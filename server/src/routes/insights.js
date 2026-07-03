import { Router } from 'express';
import { query } from '../db/index.js';

const router = Router();

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5001';
const ML_SHARED_SECRET = process.env.ML_SHARED_SECRET; // must match the Flask service in prod
const MIN_SESSIONS = 10; // below this the model would just memorize noise
const ML_TIMEOUT_MS = 5_000;

/**
 * GET /api/insights/best-hours
 * Proxies the user's sessions to the Flask ML service and returns its
 * prediction. Degrades gracefully: whatever goes wrong on the ML side,
 * the client always gets a 200 with { available: false, reason }.
 */
router.get('/best-hours', async (req, res, next) => {
  try {
    // to_char sends started_at as the naive local timestamp it was stored
    // as (e.g. '2026-07-03T09:00:00'). Letting pg serialize it as a JS Date
    // would shift it to UTC and change the hour — the model's main feature.
    const { rows: sessions } = await query(
      `SELECT to_char(started_at, 'YYYY-MM-DD"T"HH24:MI:SS') AS started_at,
              duration_minutes
       FROM sessions
       WHERE user_id = $1`,
      [req.userId]
    );

    if (sessions.length < MIN_SESSIONS) {
      return res.json({ available: false, reason: 'Not enough data yet' });
    }

    let mlResponse;
    try {
      mlResponse = await fetch(`${ML_SERVICE_URL}/predict`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(ML_SHARED_SECRET ? { 'X-ML-Secret': ML_SHARED_SECRET } : {}),
        },
        body: JSON.stringify({ sessions }),
        signal: AbortSignal.timeout(ML_TIMEOUT_MS),
      });
    } catch {
      // Connection refused, DNS failure, timeout — Flask is unreachable
      return res.json({ available: false, reason: 'Insights temporarily unavailable' });
    }

    if (!mlResponse.ok) {
      // Flask answered but with an error — treat the same as unreachable
      console.error(`ML service returned ${mlResponse.status}`);
      return res.json({ available: false, reason: 'Insights temporarily unavailable' });
    }

    const prediction = await mlResponse.json();
    return res.json({ available: true, ...prediction });
  } catch (err) {
    return next(err); // real errors (e.g. our own DB down) still 500
  }
});

export default router;
