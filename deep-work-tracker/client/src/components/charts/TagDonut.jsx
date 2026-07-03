import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { fmtDuration } from '../../utils/format';
import ChartTooltip from './ChartTooltip.jsx';

/**
 * Donut of minutes per tag. Slice colors are the tags' own colors — color
 * follows the entity everywhere in the app. The legend list beside the donut
 * carries the names and values in text ink (identity is never color-alone).
 * A 2px surface-colored stroke keeps adjacent slices separated.
 */
export default function TagDonut({ data }) {
  const rows = data.filter((d) => d.minutes > 0);
  if (rows.length === 0) return <p className="text-muted">No tagged sessions yet.</p>;

  return (
    <div className="donut-wrap">
      <ResponsiveContainer width="45%" height={200}>
        <PieChart>
          <Pie
            data={rows}
            dataKey="minutes"
            nameKey="name"
            innerRadius="62%"
            outerRadius="95%"
            stroke="var(--surface)"
            strokeWidth={2}
          >
            {rows.map((r) => (
              <Cell key={r.tag_id} fill={r.color} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <ul className="donut-legend">
        {rows.map((r) => (
          <li key={r.tag_id}>
            <span className="tag-dot" style={{ background: r.color }} />
            <span className="donut-legend-name">{r.name}</span>
            <span className="text-muted">{fmtDuration(r.minutes)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
