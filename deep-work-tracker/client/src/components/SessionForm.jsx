import { useState } from 'react';
import api, { errorMessage } from '../api/client';

// datetime-local wants 'YYYY-MM-DDTHH:mm'; server timestamps come back ISO-ish
function toInputValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * One form for both jobs:
 *   - manual entry of a past session (no `session` prop → POST)
 *   - editing an existing one (`session` prop set → PUT)
 */
export default function SessionForm({ tags, session, onDone, onCancel }) {
  const editing = !!session;
  const [startedAt, setStartedAt] = useState(toInputValue(session?.started_at));
  const [duration, setDuration] = useState(session?.duration_minutes ?? 25);
  const [tagId, setTagId] = useState(session?.tag_id ?? '');
  const [note, setNote] = useState(session?.note ?? '');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const payload = {
      started_at: `${startedAt}:00`, // add seconds; stays naive local time
      duration_minutes: Number(duration),
      tag_id: tagId ? Number(tagId) : null,
      note: note.trim() || null,
    };
    try {
      if (editing) await api.put(`/sessions/${session.id}`, payload);
      else await api.post('/sessions', payload);
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="session-form" onSubmit={onSubmit}>
      {error && <div className="alert">{error}</div>}
      <div className="form-row">
        <label>
          Start time
          <input
            type="datetime-local"
            value={startedAt}
            onChange={(e) => setStartedAt(e.target.value)}
            max={toInputValue(new Date())} // can't log the future
            required
          />
        </label>
        <label>
          Duration (min)
          <input
            type="number"
            min={1}
            max={1440}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            required
          />
        </label>
      </div>
      <div className="form-row">
        <label>
          Tag
          <select value={tagId ?? ''} onChange={(e) => setTagId(e.target.value)}>
            <option value="">No tag</option>
            {tags.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Note
          <input
            placeholder="Optional"
            value={note ?? ''}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
      </div>
      <div className="form-actions">
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : editing ? 'Save changes' : 'Add session'}
        </button>
        {onCancel && (
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
