import { fmtDuration } from '../../utils/format';

// Shared Recharts tooltip, styled with the app's tokens (Recharts' default
// inline styles don't follow dark mode).
export default function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-label">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="chart-tooltip-row">
          <span className="tag-dot" style={{ background: p.payload.fill ?? p.color }} />
          {fmtDuration(p.value)}
        </div>
      ))}
    </div>
  );
}
