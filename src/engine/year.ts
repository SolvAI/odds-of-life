import { BLOCKED_IN_PRISON, EVENTS, TUNING, type EventDef, type OutcomeDef } from '../data/events';
import { DREAMS, TRAITS, type Bias } from '../data/traits';
import { COUNTRIES } from '../data/world';
import { makeCtx, type Ctx, type Someone } from './ctx';
import { newsThisYear } from './world';
import { Rng } from './rng';
import type { EventsPlan, Life, RolledEvent, Sex, Stats, Target } from './types';

export const MAX_EVENTS_PER_YEAR = 3;
const byId = new Map(EVENTS.map((e) => [e.id, e]));

const num = (n: number | ((c: Ctx) => number), c: Ctx) => Math.max(0, typeof n === 'function' ? n(c) : n);
const deltasOf = (d: EventDef['deltas'], c: Ctx): Partial<Stats> => (typeof d === 'function' ? d(c) : d ?? {});

function merge(a: Partial<Stats>, b: Partial<Stats>): Partial<Stats> {
  const out: Partial<Stats> = { ...a };
  for (const [k, v] of Object.entries(b) as [keyof Stats, number][]) out[k] = Math.round((out[k] ?? 0) + v);
  return out;
}

const biasOf = (b: Bias, def: EventDef) => b.ids?.[def.id] ?? b.cats?.[def.cat] ?? 1;

/** Traits, the life dream and world events bend every event's odds. */
function modifier(def: EventDef, c: Ctx): number {
  let m = TUNING[def.id] ?? 1;
  for (const t of c.traits) m *= biasOf(TRAITS[t], def);
  if (c.dream) m *= biasOf(DREAMS[c.dream], def);
  for (const tag of def.tags ?? []) {
    if (tag === 'layoff') m *= c.sector === 'office' || c.sector === 'service' || c.sector === 'factory' ? c.world.mult.automation ?? 1 : 1;
    else if (tag === 'heat' || tag === 'flood') m *= c.world.climate;
    else m *= c.world.mult[tag] ?? 1;
  }
  if (def.tags?.includes('infection')) m *= c.world.era;
  return m;
}

/** Every event in the table rolls its yearly odds; the most important few are kept. */
export function rollYear(life: Life, age: number, rng: Rng): EventsPlan {
  const c = makeCtx(life, age);
  const fired: { def: EventDef; tie: number; who?: Someone }[] = [];
  for (const def of EVENTS) {
    if (age < def.ages[0] || age > def.ages[1]) continue;
    if (def.once && c.once(def.id)) continue;
    if (!c.free && BLOCKED_IN_PRISON.has(def.cat)) continue;
    if (def.when && !def.when(c)) continue;
    let p = def.p(c) * modifier(def, c);
    let who: Someone | undefined;
    if (def.target) {
      const cands = def.target(c).filter((x) => x.w > 0);
      if (!cands.length) continue;
      p *= 1 - cands.reduce((acc, x) => acc * (1 - Math.min(1, x.w)), 1);
      who = rng.weighted(cands, (x) => x.w);
    }
    if (rng.next() < Math.min(1, p)) fired.push({ def, tie: rng.next(), who });
  }
  fired.sort((a, b) => (b.def.weight ?? 2) - (a.def.weight ?? 2) || a.tie - b.tie);
  const groups = new Set<string>();
  const events: RolledEvent[] = [];
  for (const { def, who } of fired) {
    if (def.group) {
      if (groups.has(def.group)) continue;
      groups.add(def.group);
    }
    events.push(resolve(def, c, life, rng, who));
    if (events.length >= MAX_EVENTS_PER_YEAR) break;
  }
  return { kind: 'year', age, year: c.year, events, world: newsThisYear(life, c.year), rngAfter: rng.state };
}

/** Spend a respin: the gauge spins again for one event and may land elsewhere. */
export function respinEvent(life: Life, plan: EventsPlan, index: number): EventsPlan {
  const rng = new Rng(plan.rngAfter);
  const old = plan.events[index];
  const def = byId.get(old.id)!;
  const c = makeCtx(life, plan.age);
  const events = plan.events.slice();
  const keep = old.target ? { person: life.cast.find((p) => p.id === old.target!.id)!, age: old.target.age } : undefined;
  events[index] = { ...resolve(def, c, life, rng, keep?.person ? keep : undefined), newPerson: old.newPerson, moveTo: old.moveTo };
  life.respins -= 1;
  return { ...plan, events, rngAfter: rng.state };
}

const luckShift = (c: Ctx) => c.traits.reduce((s, t) => s + (TRAITS[t].luck ?? 0), 0);

function pickSex(rule: NonNullable<EventDef['newPerson']>['sex'], self: Sex, rng: Rng): Sex {
  if (rule === 'male' || rule === 'female') return rule;
  if (rule === 'other') return self === 'male' ? 'female' : 'male';
  return rng.next() < 0.5 ? 'male' : 'female';
}

function resolve(def: EventDef, c: Ctx, life: Life, rng: Rng, who?: Someone): RolledEvent {
  let outcome: OutcomeDef | null = null;
  let spin: RolledEvent['spin'] = null;
  if (def.outcomes?.length) {
    const ws = def.outcomes.map((o) => num(o.w, c));
    const total = ws.reduce((a, b) => a + b, 0) || 1;
    const goodW = def.outcomes.reduce((s, o, i) => s + (o.good ? ws[i] : 0), 0);
    const both = goodW > 0 && goodW < total;
    const pGood = both ? Math.min(0.995, Math.max(0.005, goodW / total + luckShift(c))) : goodW / total;
    const roll = rng.next();
    const side = roll < pGood;
    const pool = def.outcomes.map((o, i) => ({ o, w: o.good === side ? ws[i] : 0 }));
    outcome = rng.weighted(pool, (x) => x.w).o;
    const heaviest = (good: boolean) =>
      def.outcomes!.map((o, i) => ({ o, w: ws[i] })).filter((x) => x.o.good === good).sort((a, b) => b.w - a.w)[0]?.o.label;
    if (both && ((def.weight ?? 2) >= 2 || 1 - pGood >= 0.1)) {
      spin = { pGood, roll, goodLabel: heaviest(true) || 'it goes well', badLabel: heaviest(false) || 'it goes badly' };
    }
  }
  const deltas = merge(deltasOf(def.deltas, c), deltasOf(outcome?.deltas, c));
  const effect = outcome?.effect ?? def.effect;
  let target: Target | undefined;
  if (who) target = { id: who.person.id, name: who.person.name, role: who.person.role, age: who.age };
  else if (def.aboutPartner && life.partner) target = { id: -1, name: life.partner.name, role: 'partner', age: c.partnerAge };
  let newPerson: RolledEvent['newPerson'];
  if (def.newPerson) {
    const sex = pickSex(def.newPerson.sex, life.sex, rng);
    let country = life.country;
    if (def.newPerson.role === 'partner' && effect === 'newPartner' && rng.next() < (c.abroad ? 0.4 : 0.12)) {
      country = rng.weighted(COUNTRIES.filter((x) => x.code !== life.country), (x) => x.births).code;
    }
    newPerson = { role: def.newPerson.role, sex, country };
  }
  if (newPerson?.role === 'child' && effect !== 'kid') newPerson = undefined; // e.g. stillbirth
  if (newPerson?.role === 'partner' && effect !== 'newPartner' && effect !== 'arranged') newPerson = undefined;
  const moveTo = typeof def.moveTo === 'function' ? def.moveTo(c) : def.moveTo;
  const sum = Object.values(deltas).reduce((a, b) => a + (b ?? 0), 0);
  return {
    id: def.id,
    title: def.title,
    cat: def.cat,
    question: def.question,
    outcome: outcome ? { id: outcome.id, label: outcome.label, good: outcome.good } : null,
    spin,
    good: outcome ? outcome.good && !outcome.death : sum >= 0,
    deltas,
    add: [...(def.add ?? []), ...(outcome?.add ?? [])],
    remove: [...(def.remove ?? []), ...(outcome?.remove ?? [])],
    effect,
    death: outcome?.death,
    target,
    newPerson,
    moveTo,
    thread: def.thread,
  };
}
