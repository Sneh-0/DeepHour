import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useFetch } from '../hooks/useFetch';
import Timer from '../components/Timer.jsx';
import SessionForm from '../components/SessionForm.jsx';
import SessionList from '../components/SessionList.jsx';

const RECENT_COUNT = 10;

export default function Dashboard() {
  const tagsQ = useFetch(() => api.get('/tags'));
  const sessionsQ = useFetch(() => api.get('/sessions'));
  const [showManual, setShowManual] = useState(false);

  const tags = tagsQ.data ?? [];
  const sessions = sessionsQ.data ?? [];

  return (
    <>
      <h1>Dashboard</h1>

      {/* empty state for a brand-new account: point them at tags first */}
      {!tagsQ.loading && !tagsQ.error && tags.length === 0 && (
        <div className="card info-banner">
          Welcome! Sessions can be tagged by what you worked on —{' '}
          <Link to="/tags">create your first tag</Link> to get nicer analytics (or just start the
          timer, tags are optional).
        </div>
      )}

      <div className="dash-grid">
        <section className="card">
          <h2>Focus timer</h2>
          <Timer tags={tags} onSaved={sessionsQ.reload} />
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Log a past session</h2>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowManual((v) => !v)}>
              {showManual ? 'Hide' : 'Show'}
            </button>
          </div>
          {showManual ? (
            <SessionForm
              tags={tags}
              onDone={() => {
                setShowManual(false);
                sessionsQ.reload();
              }}
            />
          ) : (
            <p className="text-muted">Forgot to run the timer? Add the session manually.</p>
          )}
        </section>
      </div>

      <section className="card">
        <h2>Recent sessions</h2>
        {sessionsQ.loading && <p className="text-muted">Loading sessions…</p>}
        {sessionsQ.error && (
          <div className="alert">
            {sessionsQ.error}{' '}
            <button className="btn btn-ghost btn-sm" onClick={sessionsQ.reload}>
              Retry
            </button>
          </div>
        )}
        {!sessionsQ.loading && !sessionsQ.error && (
          <SessionList
            sessions={sessions.slice(0, RECENT_COUNT)}
            tags={tags}
            onChanged={sessionsQ.reload}
          />
        )}
      </section>
    </>
  );
}
