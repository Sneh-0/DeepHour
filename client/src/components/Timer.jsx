import { useEffect, useRef, useState } from 'react';
import api, { errorMessage } from '../api/client';
import { fmtElapsed, toLocalISO } from '../utils/format';

/**
 * Focus timer. Three states:
 *   idle     → big Start button
 *   running  → live elapsed clock + Stop
 *   saving   → the finished session's details (tag, note) before saving
 */
export default function Timer({ tags, onSaved }) {
  const [startedAt, setStartedAt] = useState(null); // Date while running
  const [elapsed, setElapsed] = useState(0); // seconds
  const [finished, setFinished] = useState(null); // { startedAt, seconds }
  const [tagId, setTagId] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const intervalRef = useRef(null);

  // Tick once a second while running. Recomputing from Date.now() (instead of
  // elapsed+1) keeps the clock honest even if the tab was backgrounded.
  useEffect(() => {
    if (!startedAt) return undefined;
    intervalRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [startedAt]);

  function start() {
    setStartedAt(new Date());
    setElapsed(0);
    setError(null);
  }

  function stop() {
    setFinished({ startedAt, seconds: Math.floor((Date.now() - startedAt.getTime()) / 1000) });
    setStartedAt(null);
  }

  function discard() {
    setFinished(null);
    setElapsed(0);
    setNote('');
    setError(null);
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api.post('/sessions', {
        started_at: toLocalISO(finished.startedAt),
        duration_minutes: Math.max(1, Math.round(finished.seconds / 60)),
        tag_id: tagId ? Number(tagId) : null,
        note: note.trim() || null,
      });
      discard();
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  // --- saving state: session ended, collect details ---
  if (finished) {
    return (
      <div className="timer">
        <div className="timer-clock">{fmtElapsed(finished.seconds)}</div>
        <p className="text-muted">
          Nice work — {Math.max(1, Math.round(finished.seconds / 60))} min of focus. Save it?
        </p>
        {error && <div className="alert">{error}</div>}
        <div className="timer-save-row">
          <select value={tagId} onChange={(e) => setTagId(e.target.value)} aria-label="Tag">
            <option value="">No tag</option>
            {tags.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <input
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <div className="timer-actions">
          <button className="btn btn-primary" onClick={save} disabled={busy}>
            {busy ? 'Saving…' : 'Save session'}
          </button>
          <button className="btn btn-ghost" onClick={discard} disabled={busy}>
            Discard
          </button>
        </div>
      </div>
    );
  }

  // --- running state ---
  if (startedAt) {
    return (
      <div className="timer">
        <div className="timer-clock timer-running">{fmtElapsed(elapsed)}</div>
        <p className="text-muted">Focusing… stay with it.</p>
        <button className="btn btn-danger" onClick={stop}>
          Stop
        </button>
      </div>
    );
  }

  // --- idle state ---
  return (
    <div className="timer">
      <div className="timer-clock">0:00</div>
      <p className="text-muted">Start a focus session — the clock keeps time for you.</p>
      <button className="btn btn-primary" onClick={start}>
        Start focus
      </button>
    </div>
  );
}
