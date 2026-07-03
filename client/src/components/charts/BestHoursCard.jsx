import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { fmtHour } from '../../utils/format';
import ChartTooltip from './ChartTooltip.jsx';

/**
 * ML prediction card. The API always answers 200; when `available` is false
 * (too little data, or the ML service is down) we show the reason kindly
 * instead of an error state — this is a nice-to-have insight, not a failure.
 */
export default function BestHoursCard({ data }) {
  if (!data.available) {
    const friendly =
      data.reason === 'Not enough data yet'
        ? 'Log at least 10 sessions and your prediction will appear here.'
        : 'Predictions are taking a little break — check back soon.';
    return <p className="text-muted">{friendly}</p>;
  }

  const rows = data.hourly.map((h) => ({ ...h, label: fmtHour(h.hour) }));

  return (
    <>
      <div className="best-hours-chips">
        {data.best_hours.map((h, i) => (
          <span key={h} className={`chip ${i === 0 ? 'chip-primary' : ''}`}>
            {fmtHour(h)}
          </span>
        ))}
      </div>
      <p className="text-muted">
        Predicted focus duration by starting hour, learned from your {data.trained_on} sessions.
      </p>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={rows} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={{ stroke: 'var(--axis)' }}
            tick={{ fill: 'var(--muted)', fontSize: 11 }}
            interval={2}
          />
          <YAxis tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} />
          <Tooltip cursor={{ fill: 'var(--hover-wash)' }} content={<ChartTooltip />} />
          <Bar
            dataKey="predicted_minutes"
            fill="var(--chart-accent)"
            barSize={12}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </>
  );
}
