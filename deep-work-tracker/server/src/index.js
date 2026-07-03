import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import tagRoutes from './routes/tags.js';
import sessionRoutes from './routes/sessions.js';
import { requireAuth } from './middleware/auth.js';

dotenv.config();

if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET is not set. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

const app = express();

// CORS for local dev: Vite client (5173) and Flask ml-service (5001)
app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173', 'http://localhost:5001'],
    credentials: true,
  })
);

app.use(express.json());

// Malformed JSON body → 400 instead of a 500 stack trace
app.use((err, _req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }
  return next(err);
});

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/tags', requireAuth, tagRoutes);
app.use('/api/sessions', requireAuth, sessionRoutes);

// Example protected route — proves the JWT middleware works end to end
app.get('/api/me', requireAuth, (req, res) => {
  res.json({ userId: req.userId });
});

// 404 for unknown API routes
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// Central error handler — keep last
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, () => {
  console.log(`Deep-Work Tracker API listening on http://localhost:${PORT}`);
});
