// Plays many lives with placeholder text and random choices, then prints lifespans,
// causes of death and how often each event happens. Used to tune the event table.
import { newLife, score } from '../src/engine/life';
import { planYear } from '../src/engine/plan';
import { applyChoice, applyMontage, applyYear } from '../src/engine/apply';
import { dreamCameTrue } from '../src/engine/life';
import { countryByCode } from '../src/data/world';
import { EVENTS } from '../src/data/events';
import { STATUSES } from '../src/data/statuses';
import type { Life } from '../src/engine/types';

const N = Number(process.argv[2] ?? 10000);

// Typos in status ids would silently do nothing, so check the table first.
for (const e of EVENTS) {
  for (const id of [...(e.add ?? []), ...(e.remove ?? []), ...(e.outcomes ?? []).flatMap((o) => [...(o.add ?? []), ...(o.remove ?? [])])]) {
    if (!STATUSES[id]) throw new Error(`event ${e.id} references unknown status ${id}`);
  }
}

const eventLives = new Map<string, number>();
const eventCount = new Map<string, number>();
let quietYears = 0;
let totalYears = 0;
let spins = 0;
let montages = 0;
let cards = 0;
const dreams = { yes: 0, no: 0 };

function play(seed: number): Life {
  const life = newLife(seed);
  const seen = new Set<string>();
  while (!life.dead) {
    const plan = planYear(life);
    totalYears++;
    cards++;
    if (plan.kind === 'choice') {
      applyChoice(life, plan, (seed + life.age) % plan.options.length, { title: '', text: '', labels: [] });
      continue;
    }
    if (plan.kind === 'montage') {
      montages++;
      quietYears += plan.years.length;
      totalYears += plan.years.length - 1;
      applyMontage(life, plan, { title: '', text: '', fact: '' });
      continue;
    }
    if (!plan.events.length) quietYears++;
    for (const e of plan.events) {
      eventCount.set(e.id, (eventCount.get(e.id) ?? 0) + 1);
      seen.add(e.id);
      if (e.spin) spins++;
    }
    applyYear(life, plan, { title: '', text: '', fact: '' });
  }
  for (const id of seen) eventLives.set(id, (eventLives.get(id) ?? 0) + 1);
  const d = dreamCameTrue(life);
  if (d !== null) dreams[d ? 'yes' : 'no']++;
  return life;
}

const groups = new Map<string, { ages: number[]; scores: number[]; infant: number }>();
const add = (key: string, age: number, s: number) => {
  const g = groups.get(key) ?? { ages: [], scores: [], infant: 0 };
  g.ages.push(age);
  g.scores.push(s);
  if (age < 5) g.infant++;
  groups.set(key, g);
};
const causes = new Map<string, number>();
for (let i = 1; i <= N; i++) {
  const life = play(i * 7919);
  const key = life.hardStarts.length ? `hard:${life.hardStarts.join('+')}` : `normal:${countryByCode(life.birthCountry).tier}`;
  add(key, life.age, score(life));
  add('ALL', life.age, score(life));
  causes.set(life.causeOfDeath, (causes.get(life.causeOfDeath) ?? 0) + 1);
}

const pct = (xs: number[], q: number) => [...xs].sort((a, b) => a - b)[Math.floor(q * (xs.length - 1))];
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
console.log(`\n${N} lives · ${(totalYears / N).toFixed(0)} years each · ${(cards / N).toFixed(0)} cards each · ${((100 * quietYears) / totalYears).toFixed(0)}% quiet years · ${(montages / N).toFixed(1)} montages · ${(spins / N).toFixed(1)} gauge spins per life · dream came true ${((100 * dreams.yes) / Math.max(1, dreams.yes + dreams.no)).toFixed(0)}%\n`);
console.log('start'.padEnd(26), 'share  median  p10  p90  >=80  <5   score');
for (const [k, g] of [...groups.entries()].sort()) {
  const n = g.ages.length;
  console.log(k.padEnd(26), `${((100 * n) / N).toFixed(1)}%`.padStart(5), String(pct(g.ages, 0.5)).padStart(7), String(pct(g.ages, 0.1)).padStart(4), String(pct(g.ages, 0.9)).padStart(4),
    `${((100 * g.ages.filter((a) => a >= 80).length) / n).toFixed(0)}%`.padStart(5), `${((100 * g.infant) / n).toFixed(0)}%`.padStart(4), mean(g.scores).toFixed(1).padStart(6));
}
console.log('\ncauses of death:');
console.log([...causes.entries()].sort((a, b) => b[1] - a[1]).map(([c, n]) => `  ${((100 * n) / N).toFixed(1).padStart(5)}%  ${c}`).join('\n'));
console.log('\nevents: % of lives that see it at least once · times per 100 lives');
const rows = EVENTS.map((e) => [e.id, eventLives.get(e.id) ?? 0, eventCount.get(e.id) ?? 0] as const).sort((a, b) => b[1] - a[1]);
for (let i = 0; i < rows.length; i += 3) {
  console.log(rows.slice(i, i + 3).map(([id, l, c]) => `${id.padEnd(18)} ${((100 * l) / N).toFixed(1).padStart(5)}% ${String(Math.round((100 * c) / N)).padStart(5)}`).join('   '));
}
