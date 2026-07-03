import { useState } from 'react';
import api, { errorMessage } from '../api/client';
import { useFetch } from '../hooks/useFetch';

const DEFAULT_COLOR = '#6366f1';

function TagRow({ tag, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(tag.name);
  const [color, setColor] = useState(tag.color);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.put(`/tags/${tag.id}`, { name: name.trim(), color });
      setEditing(false);
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (
      !window.confirm(
        `Delete "${tag.name}"? Its sessions are kept — they just lose the tag.`
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      await api.delete(`/tags/${tag.id}`);
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <form className="tag-row" onSubmit={save}>
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          aria-label="Tag color"
        />
        <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        <div className="session-actions">
          <button className="btn btn-primary btn-sm" disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setEditing(false);
              setName(tag.name);
              setColor(tag.color);
              setError(null);
            }}
          >
            Cancel
          </button>
        </div>
        {error && <div className="alert">{error}</div>}
      </form>
    );
  }

  return (
    <div className="tag-row">
      <span className="tag-dot tag-dot-lg" style={{ background: tag.color }} />
      <span className="tag-name">{tag.name}</span>
      <div className="session-actions">
        <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>
          Edit
        </button>
        <button
          className="btn btn-ghost btn-sm btn-danger-text"
          onClick={remove}
          disabled={busy}
        >
          {busy ? 'Deleting…' : 'Delete'}
        </button>
      </div>
      {error && <div className="alert">{error}</div>}
    </div>
  );
}

export default function Tags() {
  const tagsQ = useFetch(() => api.get('/tags'));
  const [name, setName] = useState('');
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function create(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post('/tags', { name: name.trim(), color });
      setName('');
      setColor(DEFAULT_COLOR);
      tagsQ.reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1>Tags</h1>

      <section className="card">
        <h2>New tag</h2>
        {error && <div className="alert">{error}</div>}
        <form className="tag-row" onSubmit={create}>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            aria-label="Tag color"
          />
          <input
            placeholder="e.g. Deep Reading"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <button className="btn btn-primary" disabled={busy}>
            {busy ? 'Adding…' : 'Add tag'}
          </button>
        </form>
      </section>

      <section className="card">
        <h2>Your tags</h2>
        {tagsQ.loading && <p className="text-muted">Loading tags…</p>}
        {tagsQ.error && (
          <div className="alert">
            {tagsQ.error}{' '}
            <button className="btn btn-ghost btn-sm" onClick={tagsQ.reload}>
              Retry
            </button>
          </div>
        )}
        {!tagsQ.loading && !tagsQ.error && (
          <div className="tag-list">
            {tagsQ.data.length === 0 && (
              <p className="text-muted">No tags yet — create your first one above.</p>
            )}
            {tagsQ.data.map((t) => (
              <TagRow key={t.id} tag={t} onChanged={tagsQ.reload} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
