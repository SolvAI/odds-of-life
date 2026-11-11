import { STATUSES } from '../../data/statuses';
import { HOME_LABEL } from '../../engine/life';
import type { Life } from '../../engine/types';

export function StatusPanel({ life, fresh = [] }: { life: Life; fresh?: string[] }) {
  const h = life.home;
  const student = life.statuses.some((s) => s.id === 'student');
  const homeText = h.desc || HOME_LABEL[h.kind];
  return (
    <div className="status-panel">
      <div className="status-line">
        <span title={`${HOME_LABEL[h.kind]}${h.owned ? ', owned' : ''}`}>
          🏠 {homeText}{h.place ? `, ${h.place}` : ''} <span className="tag">{HOME_LABEL[h.kind]}{h.kind !== 'street' ? (h.owned ? ' · owned' : ' · rented') : ''}</span>
        </span>
        {life.job ? (
          <span>💼 {life.job.title} <span className="tag">{life.job.sector} · {'★'.repeat(life.job.level)}</span></span>
        ) : student ? <span>🎓 university student</span> : null}
      </div>
      {life.statuses.length > 0 && (
        <div className="chips">
          {life.statuses.filter((s) => s.id !== 'homeowner' && s.id !== 'homeless' && s.id !== 'student').map((s) => (
            <span key={s.id} className={`chip chip-${STATUSES[s.id]?.kind ?? 'situation'} ${fresh.includes(s.id) ? 'chip-new' : ''}`} title={`since age ${s.since}`}>
              {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
