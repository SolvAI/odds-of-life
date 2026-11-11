import type { Stats } from '../../engine/types';
import { moneyLabel } from '../../engine/life';

const ROWS: { key: keyof Stats; label: string; icon: string }[] = [
  { key: 'health', label: 'Health', icon: '❤' },
  { key: 'money', label: 'Money', icon: '$' },
  { key: 'happiness', label: 'Happiness', icon: '☺' },
];

export function StatBars({ stats, deltas }: { stats: Stats; deltas?: Partial<Stats> }) {
  return (
    <div className="stats">
      {ROWS.map((r) => {
        const v = Math.round(stats[r.key]);
        const d = deltas?.[r.key];
        return (
          <div key={r.key} className={`stat stat-${r.key}`}>
            <span className="stat-icon" aria-hidden>{r.icon}</span>
            <span className="stat-label">{r.key === 'money' ? moneyLabel(v) : r.label}</span>
            <div className="stat-track">
              <div className="stat-fill" style={{ width: `${v}%` }} />
            </div>
            <span className="stat-value">{v}</span>
            {d ? <span className={`stat-delta ${d > 0 ? 'up' : 'down'}`}>{d > 0 ? `+${d}` : d}</span> : <span className="stat-delta" />}
          </div>
        );
      })}
    </div>
  );
}
