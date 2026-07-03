import { useState } from 'react';
import api, { errorMessage } from '../api/client';
import { fmtDateTime, fmtDuration } from '../utils/format';
import SessionForm from './SessionForm.jsx';

export default function SessionList({ sessions, tags, onChanged }) {
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  async function remove(id) {
    if (!window.confirm('Delete this session?')) return;
    setDeletingId(id);
    setError(null);
    try {
      await api.delete(`/sessions/${id}`);
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setDeletingId(null);
    }
  }

  if (sessions.length === 0) {
    return <p className="text-muted">No sessions yet — run the timer or add one manually.</p>;
  }

  return (
    <div className="session-list">
      {error && <div className="alert">{error}</div>}
      {sessions.map((s) =>
        editingId === s.id ? (
          <div key={s.id} className="session-row session-row-editing">
            <SessionForm
              tags={tags}
              session={s}
              onDone={() => {
                setEditingId(null);
                onChanged();
              }}
              onCancel={() => setEditingId(null)}
            />
          </div>
        ) : (
          <div key={s.id} className="session-row">
            <span
              className="tag-dot"
              style={{ background: s.tag_color ?? 'var(--muted)' }}
              title={s.tag_name ?? 'No tag'}
            />
            <div className="session-main">
              <span className="session-title">
                {s.tag_name ?? 'Untagged'} · {fmtDuration(s.duration_minutes)}
              </span>
              <span className="text-muted session-sub">
                {fmtDateTime(s.started_at)}
                {s.note ? ` — ${s.note}` : ''}
              </span>
            </div>
            <div className="session-actions">
              <button className="btn btn-ghost btn-sm" onClick={() => setEditingId(s.id)}>
                Edit
              </button>
              <button
                className="btn btn-ghost btn-sm btn-danger-text"
                onClick={() => remove(s.id)}
                disabled={deletingId === s.id}
              >
                {deletingId === s.id ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        )
      )}
    </div>
  );
}
