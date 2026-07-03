import { Router } from 'express';
import { query } from '../db/index.js';

const router = Router();

const MAX_DURATION = 24 * 60; // sanity cap: one day

function parseId(raw) {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function isValidDate(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function isValidDuration(value) {
  return Number.isInteger(value) && value > 0 && value <= MAX_DURATION;
}

// A tag_id may only reference the caller's own tag
async function ownsTag(tagId, userId) {
  const { rows } = await query('SELECT 1 FROM tags WHERE id = $1 AND user_id = $2', [
    tagId,
    userId,
  ]);
  return rows.length > 0;
}

const SESSION_SELECT = `
  SELECT s.id, s.tag_id, s.started_at, s.duration_minutes, s.note,
         t.name AS tag_name, t.color AS tag_color
  FROM sessions s
  LEFT JOIN tags t ON t.id = s.tag_id
`;

// GET /api/sessions?from=&to=&tag_id= — list with optional filters
router.get('/', async (req, res, next) => {
  try {
    const { from, to, tag_id } = req.query;

    const conditions = ['s.user_id = $1'];
    const params = [req.userId];

    if (from !== undefined) {
      if (!isValidDate(from)) return res.status(400).json({ error: '`from` must be a valid date' });
      params.push(from);
      conditions.push(`s.started_at >= $${params.length}`);
    }
    if (to !== undefined) {
      if (!isValidDate(to)) return res.status(400).json({ error: '`to` must be a valid date' });
      params.push(to);
      conditions.push(`s.started_at <= $${params.length}`);
    }
    if (tag_id !== undefined) {
      const tagId = parseId(tag_id);
      if (!tagId) return res.status(400).json({ error: '`tag_id` must be a positive integer' });
      params.push(tagId);
      conditions.push(`s.tag_id = $${params.length}`);
    }

    const { rows } = await query(
      `${SESSION_SELECT} WHERE ${conditions.join(' AND ')} ORDER BY s.started_at DESC`,
      params
    );
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
});

// POST /api/sessions — log a session
router.post('/', async (req, res, next) => {
  try {
    const { started_at, duration_minutes, tag_id, note } = req.body || {};

    if (!isValidDate(started_at)) {
      return res.status(400).json({ error: '`started_at` must be a valid date string' });
    }
    if (!isValidDuration(duration_minutes)) {
      return res
        .status(400)
        .json({ error: `\`duration_minutes\` must be an integer between 1 and ${MAX_DURATION}` });
    }
    if (note !== undefined && note !== null && typeof note !== 'string') {
      return res.status(400).json({ error: '`note` must be a string' });
    }
    if (tag_id !== undefined && tag_id !== null) {
      if (!parseId(tag_id)) return res.status(400).json({ error: '`tag_id` must be a positive integer' });
      if (!(await ownsTag(tag_id, req.userId))) {
        return res.status(400).json({ error: 'Unknown tag_id' });
      }
    }

    const { rows } = await query(
      `INSERT INTO sessions (user_id, tag_id, started_at, duration_minutes, note)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, tag_id, started_at, duration_minutes, note`,
      [req.userId, tag_id ?? null, started_at, duration_minutes, note ?? null]
    );
    return res.status(201).json(rows[0]);
  } catch (err) {
    return next(err);
  }
});

// PUT /api/sessions/:id — partial update of any field
router.put('/:id', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid session id' });

    const body = req.body || {};
    const sets = [];
    const params = [];

    if ('started_at' in body) {
      if (!isValidDate(body.started_at)) {
        return res.status(400).json({ error: '`started_at` must be a valid date string' });
      }
      params.push(body.started_at);
      sets.push(`started_at = $${params.length}`);
    }
    if ('duration_minutes' in body) {
      if (!isValidDuration(body.duration_minutes)) {
        return res
          .status(400)
          .json({ error: `\`duration_minutes\` must be an integer between 1 and ${MAX_DURATION}` });
      }
      params.push(body.duration_minutes);
      sets.push(`duration_minutes = $${params.length}`);
    }
    if ('tag_id' in body) {
      if (body.tag_id !== null) {
        if (!parseId(body.tag_id)) {
          return res.status(400).json({ error: '`tag_id` must be a positive integer or null' });
        }
        if (!(await ownsTag(body.tag_id, req.userId))) {
          return res.status(400).json({ error: 'Unknown tag_id' });
        }
      }
      params.push(body.tag_id);
      sets.push(`tag_id = $${params.length}`);
    }
    if ('note' in body) {
      if (body.note !== null && typeof body.note !== 'string') {
        return res.status(400).json({ error: '`note` must be a string or null' });
      }
      params.push(body.note);
      sets.push(`note = $${params.length}`);
    }
    if (sets.length === 0) {
      return res.status(400).json({ error: 'Provide at least one field to update' });
    }

    params.push(id, req.userId);
    const { rows } = await query(
      `UPDATE sessions SET ${sets.join(', ')}
       WHERE id = $${params.length - 1} AND user_id = $${params.length}
       RETURNING id, tag_id, started_at, duration_minutes, note`,
      params
    );

    if (rows.length === 0) return res.status(404).json({ error: 'Session not found' });
    return res.json(rows[0]);
  } catch (err) {
    return next(err);
  }
});

// DELETE /api/sessions/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid session id' });

    const { rows } = await query(
      'DELETE FROM sessions WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.userId]
    );

    if (rows.length === 0) return res.status(404).json({ error: 'Session not found' });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

export default router;
