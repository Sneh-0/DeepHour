import { Router } from 'express';
import { query } from '../db/index.js';

const router = Router();

const HEX_RE = /^#[0-9a-f]{6}$/i;
const DEFAULT_COLOR = '#6366f1'; // keep in sync with schema default

function parseId(raw) {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// GET /api/tags — list the logged-in user's tags
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query(
      'SELECT id, name, color FROM tags WHERE user_id = $1 ORDER BY name',
      [req.userId]
    );
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
});

// POST /api/tags — create a tag
router.post('/', async (req, res, next) => {
  try {
    const { name, color } = req.body || {};

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }
    if (color !== undefined && (typeof color !== 'string' || !HEX_RE.test(color))) {
      return res.status(400).json({ error: 'Color must be a hex string like #3b82f6' });
    }

    const { rows } = await query(
      `INSERT INTO tags (user_id, name, color)
       VALUES ($1, $2, $3)
       RETURNING id, name, color`,
      [req.userId, name.trim(), color ?? DEFAULT_COLOR]
    );
    return res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'You already have a tag with this name' });
    }
    return next(err);
  }
});

// PUT /api/tags/:id — update name and/or color
router.put('/:id', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid tag id' });

    const { name, color } = req.body || {};
    const sets = [];
    const params = [];

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'Name must be a non-empty string' });
      }
      params.push(name.trim());
      sets.push(`name = $${params.length}`);
    }
    if (color !== undefined) {
      if (typeof color !== 'string' || !HEX_RE.test(color)) {
        return res.status(400).json({ error: 'Color must be a hex string like #3b82f6' });
      }
      params.push(color);
      sets.push(`color = $${params.length}`);
    }
    if (sets.length === 0) {
      return res.status(400).json({ error: 'Provide name and/or color to update' });
    }

    params.push(id, req.userId);
    const { rows } = await query(
      `UPDATE tags SET ${sets.join(', ')}
       WHERE id = $${params.length - 1} AND user_id = $${params.length}
       RETURNING id, name, color`,
      params
    );

    if (rows.length === 0) return res.status(404).json({ error: 'Tag not found' });
    return res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'You already have a tag with this name' });
    }
    return next(err);
  }
});

// DELETE /api/tags/:id — sessions keep existing (tag_id becomes NULL via FK)
router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid tag id' });

    const { rows } = await query(
      'DELETE FROM tags WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.userId]
    );

    if (rows.length === 0) return res.status(404).json({ error: 'Tag not found' });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

export default router;
