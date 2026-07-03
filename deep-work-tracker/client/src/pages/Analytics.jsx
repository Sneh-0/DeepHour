import api from '../api/client';
import { useFetch } from '../hooks/useFetch';
import WeeklyChart from '../components/charts/WeeklyChart.jsx';
import TagDonut from '../components/charts/TagDonut.jsx';
import HeatmapCard from '../components/charts/HeatmapCard.jsx';
import BestHoursCard from '../components/charts/BestHoursCard.jsx';

// Every card owns its request: one failing endpoint never blanks the page.
function Card({ title, query, children }) {
  return (
    <section className="card">
      <h2>{title}</h2>
      {query.loading && <p className="text-muted">Loading…</p>}
      {query.error && (
        <div className="alert">
          {query.error}{' '}
          <button className="btn btn-ghost btn-sm" onClick={query.reload}>
            Retry
          </button>
        </div>
      )}
      {!query.loading && !query.error && children(query.data)}
    </section>
  );
}

export default function Analytics() {
  const weekly = useFetch(() => api.get('/analytics/weekly'));
  const tags = useFetch(() => api.get('/analytics/tags'));
  const heatmap = useFetch(() => api.get('/analytics/heatmap'));
  const streaks = useFetch(() => api.get('/analytics/streaks'));
  const insights = useFetch(() => api.get('/insights/best-hours'));

  return (
    <>
      <h1>Analytics</h1>

      <div className="analytics-grid">
        <Card title="This week" query={weekly}>
          {(data) => <WeeklyChart data={data} />}
        </Card>

        <Card title="Streaks" query={streaks}>
          {(data) => (
            <div className="streak-tiles">
              <div className="stat-tile">
                <span className="stat-value">{data.current_streak}</span>
                <span className="stat-label text-muted">
                  day{data.current_streak === 1 ? '' : 's'} current streak
                </span>
              </div>
              <div className="stat-tile">
                <span className="stat-value">{data.longest_streak}</span>
                <span className="stat-label text-muted">
                  day{data.longest_streak === 1 ? '' : 's'} longest streak
                </span>
              </div>
            </div>
          )}
        </Card>

        <Card title="Time by tag" query={tags}>
          {(data) => <TagDonut data={data} />}
        </Card>

        <Card title="Your best focus hours" query={insights}>
          {(data) => <BestHoursCard data={data} />}
        </Card>
      </div>

      <Card title="Last 12 months" query={heatmap}>
        {(data) => <HeatmapCard data={data} />}
      </Card>
    </>
  );
}
