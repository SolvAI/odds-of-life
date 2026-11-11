import { countryByCode } from '../../data/world';
import { DREAMS, TRAITS } from '../../data/traits';
import type { Life, Person } from '../../engine/types';

const ROLE: Record<string, (p: { sex: string }) => string> = {
  mother: () => 'mother', father: () => 'father', sibling: (p) => (p.sex === 'male' ? 'brother' : 'sister'),
  child: (p) => (p.sex === 'male' ? 'son' : 'daughter'), ex: () => 'ex', friend: () => 'friend', rival: () => 'rival',
  mentor: () => 'mentor', boss: () => 'boss', other: () => '',
};
const ORDER = ['child', 'mother', 'father', 'sibling', 'friend', 'mentor', 'boss', 'rival', 'ex', 'other'];

function Row({ life, p }: { life: Life; p: Person }) {
  return (
    <li className={p.alive ? '' : 'gone'}>
      <span className="who">{p.name}</span>
      <span className="role">{ROLE[p.role]?.(p)}{p.alive ? ` · ${life.age - p.bornAge}` : ' · †'}</span>
      {p.note && <span className="note">{p.note}</span>}
    </li>
  );
}

export function PeoplePanel({ life, open = false }: { life: Life; open?: boolean }) {
  const living = life.cast.filter((p) => p.alive).sort((a, b) => ORDER.indexOf(a.role) - ORDER.indexOf(b.role));
  const gone = life.cast.filter((p) => !p.alive && ['mother', 'father', 'sibling', 'child', 'other'].includes(p.role));
  const p = life.partner;
  return (
    <details className="people" open={open}>
      <summary>
        <span className="traits">{life.traits.map((t) => TRAITS[t].label).join(' · ')}</span>
        {life.dream && <span className="dream">dream: {DREAMS[life.dream].label}</span>}
        <span className="count">{living.length + (p ? 1 : 0)} people</span>
      </summary>
      <ul>
        {p && (
          <li className="partner">
            <span className="who">{p.name}</span>
            <span className="role">{life.relationship === 'married' ? (p.sex === 'male' ? 'husband' : 'wife') : life.relationship === 'engaged' ? 'fiancé(e)' : 'partner'} · {life.age - p.bornAge}{p.country !== life.country ? ` · ${countryByCode(p.country).flag}` : ''}</span>
            {p.note && <span className="note">{p.note}</span>}
          </li>
        )}
        {living.map((x) => <Row key={x.id} life={life} p={x} />)}
        {gone.map((x) => <Row key={x.id} life={life} p={x} />)}
      </ul>
    </details>
  );
}
