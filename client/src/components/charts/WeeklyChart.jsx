import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { fmtWeekday } from '../../utils/format';
import ChartTooltip from './ChartTooltip.jsx';

// Single series → one hue (sequential blue), no legend: the title names it.
export default function WeeklyChart({ data }) {
  const rows = data.map((d) => ({ ...d, day: fmtWeekday(d.date) }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={rows} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--grid)" />
        <XAxis
          dataKey="day"
          tickLine={false}
          axisLine={{ stroke: 'var(--axis)' }}
          tick={{ fill: 'var(--muted)', fontSize: 12 }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fill: 'var(--muted)', fontSize: 12 }}
        />
        <Tooltip cursor={{ fill: 'var(--hover-wash)' }} content={<ChartTooltip />} />
        {/* thin bars, 4px rounded top anchored to the baseline */}
        <Bar dataKey="minutes" fill="var(--chart-accent)" barSize={26} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
