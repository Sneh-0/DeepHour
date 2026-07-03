import { Router } from 'express';
import { query } from '../db/index.js';

const router = Router();

/**
 * GET /api/analytics/weekly
 * Total minutes per day for the last 7 days, INCLUDING days with zero sessions.
 *
 * How the query works:
 *  - generate_series(CURRENT_DATE - 6, CURRENT_DATE, '1 day') manufactures one
 *    row per calendar day — 7 rows — regardless of whether any sessions exist.
 *    This is the standard way to "zero-fill" gaps: you can't GROUP BY a day
 *    that has no rows, so you generate the days first and join data onto them.
 *  - LEFT JOIN keeps every generated day even when no session matches.
 *  - date_trunc('day', s.started_at) normalizes each session's timestamp to
 *    midnight of its day, so it can be compared to the generated day.
 *  - The join condition also carries user_id, so other users' sessions never
 *    match (filtering in the JOIN, not WHERE — a WHERE on s.user_id would
 *    turn the LEFT JOIN back into an INNER JOIN and drop the zero days).
 *  - COALESCE(SUM(...), 0) turns the NULL sum of a session-less day into 0.
 */
router.get('/weekly', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT d.day::date AS date,
              COALESCE(SUM(s.duration_minutes), 0)::int AS minutes
       FROM generate_series(CURRENT_DATE - 6, CURRENT_DATE, '1 day') AS d(day)
       LEFT JOIN sessions s
         ON s.user_id = $1
        AND date_trunc('day', s.started_at) = d.day
       GROUP BY d.day
       ORDER BY d.day`,
      [req.userId]
    );
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
});

/**
 * GET /api/analytics/tags
 * Total minutes grouped by tag, with the tag's name and color.
 *
 * How the query works:
 *  - We start FROM tags (not sessions) and LEFT JOIN sessions onto them, so a
 *    freshly created tag with no sessions still shows up with 0 minutes.
 *  - GROUP BY t.id folds all of a tag's sessions into one row; SUM adds up
 *    their durations. (name/color are in GROUP BY because any selected column
 *    must be either aggregated or grouped.)
 *  - Ordered by minutes DESC so the most-worked tag comes first.
 */
router.get('/tags', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT t.id AS tag_id,
              t.name,
              t.color,
              COALESCE(SUM(s.duration_minutes), 0)::int AS minutes
       FROM tags t
       LEFT JOIN sessions s
         ON s.tag_id = t.id
        AND s.user_id = $1
       WHERE t.user_id = $1
       GROUP BY t.id, t.name, t.color
       ORDER BY minutes DESC, t.name`,
      [req.userId]
    );
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
});

/**
 * GET /api/analytics/heatmap
 * { date, minutes } per day over the last 365 days.
 *
 * Convention: days with zero sessions are OMITTED (not zero-filled).
 * react-calendar-heatmap expects exactly this — you pass startDate/endDate to
 * the component and give it only the days that have values; missing dates
 * automatically render as empty cells. Omitting also keeps the payload small
 * (~90 rows instead of a guaranteed 365).
 *
 * How the query works:
 *  - started_at::date truncates the timestamp to its calendar day (same idea
 *    as date_trunc('day', ...) but returns a DATE, which serializes as a plain
 *    'YYYY-MM-DD' string — exactly what the heatmap component wants).
 *  - GROUP BY that day, SUM the durations, keep only the last 365 days.
 */
router.get('/heatmap', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT started_at::date AS date,
              SUM(duration_minutes)::int AS minutes
       FROM sessions
       WHERE user_id = $1
         AND started_at >= CURRENT_DATE - 364
       GROUP BY started_at::date
       ORDER BY date`,
      [req.userId]
    );
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
});

/**
 * GET /api/analytics/streaks
 * { current_streak, longest_streak } — consecutive days with >= 1 session.
 *
 * THE "date minus row_number" TRICK, step by step:
 *
 *  Step 1 (days CTE): collapse sessions to DISTINCT calendar days. Multiple
 *  sessions on one day must count as a single streak day.
 *      e.g. days = 2026-07-01, 2026-07-02, 2026-07-03, 2026-07-06, 2026-07-07
 *
 *  Step 2 (grouped CTE): number the days 1,2,3,... in date order with
 *  ROW_NUMBER(), then compute  day - row_number.
 *
 *      day          row_number   day - row_number
 *      2026-07-01   1            2026-06-30   ┐
 *      2026-07-02   2            2026-06-30   ├─ same anchor → same streak
 *      2026-07-03   3            2026-06-30   ┘
 *      2026-07-06   4            2026-07-02   ┐
 *      2026-07-07   5            2026-07-02   ┘─ new anchor → new streak
 *
 *  Why it works: within a run of consecutive days, the date increases by 1
 *  AND the row number increases by 1, so their difference stays constant.
 *  The moment there's a gap, the date jumps by more than 1 while row_number
 *  still increments by exactly 1 — the difference changes, starting a new
 *  group. The difference itself ("grp") is a meaningless date; it's just a
 *  stable label shared by every day of one streak.
 *
 *  Step 3 (streaks CTE): GROUP BY that label. COUNT(*) = streak length,
 *  MAX(day) = the day the streak ended.
 *
 *  Step 4 (final SELECT):
 *   - longest_streak: MAX(length) over all streaks.
 *   - current_streak: the length of the streak whose last day is today OR
 *     yesterday. "Yesterday" keeps a streak alive if the user simply hasn't
 *     logged anything *yet* today; if the last session day is older than
 *     yesterday, the streak is broken → FILTER matches nothing → 0.
 *     (At most one streak can satisfy this filter — two different streaks
 *     can't end on consecutive days, or they'd be the same streak.)
 */
router.get('/streaks', async (req, res, next) => {
  try {
    const { rows } = await query(
      `WITH days AS (
         SELECT DISTINCT started_at::date AS day
         FROM sessions
         WHERE user_id = $1
       ),
       grouped AS (
         SELECT day,
                day - ROW_NUMBER() OVER (ORDER BY day)::int AS grp
         FROM days
       ),
       streaks AS (
         SELECT COUNT(*)::int AS length,
                MAX(day)      AS last_day
         FROM grouped
         GROUP BY grp
       )
       SELECT COALESCE(MAX(length), 0) AS longest_streak,
              COALESCE(MAX(length) FILTER (WHERE last_day >= CURRENT_DATE - 1), 0)
                AS current_streak
       FROM streaks`,
      [req.userId]
    );
    return res.json(rows[0]);
  } catch (err) {
    return next(err);
  }
});

export default router;
