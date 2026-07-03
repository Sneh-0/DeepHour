import CalendarHeatmap from 'react-calendar-heatmap';
import 'react-calendar-heatmap/dist/styles.css';
import { fmtDuration } from '../../utils/format';

const DAY_MS = 86_400_000;

// Bucket minutes into 4 sequential steps (light→dark of one hue; the CSS
// classes hm-1..hm-4 hold the actual colors for both light and dark mode).
function classForValue(value) {
  if (!value || !value.count) return 'hm-empty';
  if (value.count <= 45) return 'hm-1';
  if (value.count <= 90) return 'hm-2';
  if (value.count <= 150) return 'hm-3';
  return 'hm-4';
}

export default function HeatmapCard({ data }) {
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - 364 * DAY_MS);
  const values = data.map((d) => ({ date: d.date, count: d.minutes }));

  return (
    <div className="heatmap-wrap">
      <CalendarHeatmap
        startDate={startDate}
        endDate={endDate}
        values={values}
        classForValue={classForValue}
        titleForValue={(v) =>
          v && v.count ? `${v.date}: ${fmtDuration(v.count)}` : 'No sessions'
        }
        showWeekdayLabels
        gutterSize={2}
      />
      <div className="heatmap-scale text-muted">
        Less
        <span className="hm-swatch hm-empty" />
        <span className="hm-swatch hm-1" />
        <span className="hm-swatch hm-2" />
        <span className="hm-swatch hm-3" />
        <span className="hm-swatch hm-4" />
        More
      </div>
    </div>
  );
}
