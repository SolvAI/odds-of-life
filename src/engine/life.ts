import { CONFIG } from './config';
import { Rng } from './rng';
import { A, HOME_RUNGS, T, W, makeCtx, stageOf, wealthTier, type Ctx } from './ctx';
import { MAX_SOFT, STATUSES } from '../data/statuses';
import { TRAITS, TRAIT_IDS } from '../data/traits';
import { COUNTRIES, countryByCode, namesFor, skinOdds } from '../data/world';
import { generateFuture, randomBirthYear } from './world';
import type { HardStart, HealthTier, Home, HomeKind, IncomeTier, Life, Person, Role, Sector, Sex, Stats, TraitId } from './types';

export { stageOf, wealthTier };

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export const healthTier = (health: number): HealthTier => (health >= 75 ? 'healthy' : health < 35 ? 'sick' : 'normal');

export const moneyLabel = (money: number) =>
  money < 10 ? 'destitute' : money < 25 ? 'poor' : money < 45 ? 'getting by' : money < 65 ? 'comfortable' : money < 85 ? 'rich' : 'filthy rich';

export const HOME_LABEL: Record<HomeKind, string> = {
  street: 'on the street', slum: 'a shack', room: 'a rented room', flat: 'a flat', house: 'a house', mansion: 'a mansion',
};

export function applyDeltas(life: Life, deltas: Partial<Stats>): void {
  for (const [k, v] of Object.entries(deltas) as [keyof Stats, number][]) {
    life.stats[k] = clamp(Math.round(life.stats[k] + v), 0, 100);
  }
}

export const hasStatus = (life: Life, id: string) => life.statuses.some((s) => s.id === id);

/** Adds a known status once; durations come from the status table. Returns false if nothing changed. */
export function addStatus(life: Life, id: string, rng: Rng, label?: string): boolean {
  const def = STATUSES[id];
  if (!def || hasStatus(life, id)) return false;
  let until = def.years ? life.age + rng.int(def.years[0], def.years[1]) : undefined;
  if (id === 'child_labour') until = Math.max(life.age + 1, 15);
  if (def.soft) {
    const soft = life.statuses.filter((s) => STATUSES[s.id]?.soft).sort((x, y) => x.since - y.since);
    if (soft.length >= MAX_SOFT) removeStatus(life, soft[0].id); // the oldest story detail fades out
  }
  life.statuses.push({ id, label: label?.trim() || def.label, since: life.age, until });
  return true;
}

export function removeStatus(life: Life, id: string): boolean {
  const before = life.statuses.length;
  life.statuses = life.statuses.filter((s) => s.id !== id);
  return life.statuses.length !== before;
}

// ---- people -------------------------------------------------------------------------

export function addPerson(life: Life, role: Role, sex: Sex, bornAge: number, name: string, note = ''): Person {
  const p: Person = { id: life.nextPersonId++, name, role, sex, bornAge, alive: true, note };
  life.cast.push(p);
  // Keep the cast readable: drop the oldest dead minor characters first.
  while (life.cast.length > 24) {
    const i = life.cast.findIndex((x) => !x.alive && !['mother', 'father', 'child'].includes(x.role));
    if (i < 0) break;
    life.cast.splice(i, 1);
  }
  return p;
}

export const personAge = (life: Life, p: { bornAge: number }) => life.age - p.bornAge;

export function placeholderName(country: string, sex: Sex, rng: Rng, avoid: string[]): string {
  const pool = namesFor(country, sex).filter((n) => !avoid.includes(n));
  return pool.length ? rng.pick(pool) : rng.pick(namesFor(country, sex));
}

// ---- jobs ---------------------------------------------------------------------------

export const SECTOR_PAY: Record<Sector, number> = {
  farming: 0.5, labour: 0.7, factory: 0.8, domestic: 0.5, street: 0.6, service: 0.8, office: 1.2, skilled: 1.1,
  professional: 1.8, public: 1.1, creative: 1, crime: 1.6, business: 1.4, military: 1,
};

export const SECTOR_TITLE: Record<Sector, string> = {
  farming: 'farm hand', labour: 'labourer', factory: 'factory worker', domestic: 'housemaid', street: 'street vendor', service: 'waiter',
  office: 'office clerk', skilled: 'mechanic', professional: 'engineer', public: 'civil servant', creative: 'designer',
  crime: 'small-time crook', business: 'shop owner', military: 'soldier',
};

/** Which kind of work you can realistically get, given schooling, place and sex. */
export function pickSector(c: Ctx, rng: Rng): Sector {
  const degree = c.has('university_degree');
  const noSchool = c.has('dropped_out') || c.age < 16;
  const w: Partial<Record<Sector, number>> = noSchool
    ? { farming: c.rural ? 3 : 0.3, labour: 2, domestic: c.sex === 'female' ? 1.5 : 0.3, street: 1.5, factory: T(c, 0.5, 1.2, 1.2, 0.5), service: 0.8 }
    : degree
      ? { office: 3, professional: 2.5, public: 1.5, creative: 0.8, skilled: 1 }
      : {
          factory: T(c, 0.8, 1.5, 1.8, 0.8), service: 2, labour: 1.5, skilled: 1.5, office: T(c, 0.3, 0.6, 1.2, 1.8), public: 0.8,
          farming: c.rural ? 2.5 : 0.1, street: T(c, 1.5, 1.2, 0.5, 0.1), domestic: c.sex === 'female' ? T(c, 1, 1, 0.5, 0.2) : 0,
          military: c.sex === 'male' ? 0.3 : 0.05, creative: 0.3,
        };
  return rng.weighted(Object.entries(w) as [Sector, number][], ([, x]) => x)[0];
}

// ---- homes --------------------------------------------------------------------------

export function initialHome(money: number, rural: boolean, tier: IncomeTier): Home {
  let kind: HomeKind;
  if (rural) kind = money < 25 ? 'slum' : money < 85 ? 'house' : 'mansion';
  else kind = money < 10 ? (tier === 'high' ? 'room' : 'slum') : money < 25 ? 'room' : money < 50 ? 'flat' : money < 85 ? 'house' : 'mansion';
  return { kind, owned: rural || money >= 65, desc: '', place: '' };
}

export const rungOf = (kind: HomeKind) => HOME_RUNGS.indexOf(kind);
export const kindAt = (rung: number) => HOME_RUNGS[clamp(rung, 0, 5)];

// ---- birth --------------------------------------------------------------------------

function rollTraits(rng: Rng): TraitId[] {
  const first = rng.pick(TRAIT_IDS);
  const rest = TRAIT_IDS.filter((t) => t !== first && TRAITS[t].opposite !== first && TRAITS[first].opposite !== t);
  return [first, rng.pick(rest)];
}

export function newLife(seed: number, opts: { birthYear?: number } = {}): Life {
  const rng = new Rng(seed);
  const birthYear = opts.birthYear ?? randomBirthYear(rng);
  const country = rng.weighted(COUNTRIES, (c) => c.births);
  const sex: Sex = rng.next() < 0.51 ? 'male' : 'female';
  const skin = rng.weighted(skinOdds(country.code), ([, w]) => w)[0];
  const pct = rng.next();
  const hardStarts: HardStart[] = [];
  if ((country.tier === 'low' || country.tier === 'lowerMid') && pct < CONFIG.money.hardStartPct) hardStarts.push('poverty');
  const disabled = rng.next() < CONFIG.disabilityOdds;
  if (disabled) hardStarts.push('disability');
  const old = birthYear < 1980 ? 0.15 : 0;
  const rural = rng.next() < { low: 0.7, lowerMid: 0.6, upperMid: 0.35, high: 0.2 }[country.tier] + old;

  const money = clamp(CONFIG.money.tierBase[country.tier] + pct * pct * 35 + (pct > 0.98 ? 25 : 0), 1, 98);
  const health = disabled ? 28 + rng.int(0, 10) : clamp(76 + rng.normal() * 9 - (country.tier === 'low' ? 8 : 0), 40, 98);
  const happiness = clamp(60 + rng.normal() * 12, 25, 95);

  const life: Life = {
    seed,
    rng: 0,
    name: rng.pick(namesFor(country.code, sex)),
    sex,
    skin,
    birthYear,
    birthCountry: country.code,
    country: country.code,
    rural,
    familyPct: pct,
    traits: rollTraits(rng),
    dream: null,
    age: 0,
    stats: { health: Math.round(health), money: Math.round(money), happiness: Math.round(happiness) },
    relationship: 'single',
    partner: null,
    cast: [],
    nextPersonId: 1,
    job: null,
    home: initialHome(money, rural, country.tier),
    statuses: [],
    facts: [],
    story: '',
    threads: [],
    future: generateFuture(birthYear, country.code, rng),
    history: [],
    respins: CONFIG.respins,
    hardStarts,
    momentum: { value: 0, until: 0 },
    nextChoiceAge: rng.int(CONFIG.choice.firstAge[0], CONFIG.choice.firstAge[1]),
    doneOnce: [],
    tally: { maxMoney: money, marriedYears: 0, countries: [country.code], trips: 0, wasFamous: false },
    statSum: { money: 0, happiness: 0, years: 0 },
    dead: false,
    causeOfDeath: '',
  };

  // Family: how many children your mother had, and where you sit among them.
  const fertility = country.x.tfr * (birthYear < 1990 ? 1.6 : 1) * (country.code === 'CN' && birthYear >= 1980 && birthYear <= 2015 ? 0.5 : 1);
  const kids = clamp(Math.round(fertility * (0.5 + rng.next())), 1, 9);
  const older = rng.int(0, kids - 1);
  const motherAge = clamp(rng.int(17, 24) + older * 2 + (country.tier === 'high' ? 6 : 0), 15, 44);
  const used: string[] = [life.name];
  const name = (s: Sex) => {
    const n = placeholderName(country.code, s, rng, used);
    used.push(n);
    return n;
  };
  const mother = addPerson(life, 'mother', 'female', -motherAge, name('female'));
  const father = addPerson(life, 'father', 'male', -(motherAge + rng.int(1, 8)), name('male'));
  if (rng.next() < (country.tier === 'low' ? 0.03 : 0.01)) {
    const gone = rng.next() < 0.7 ? father : mother;
    gone.alive = false;
    gone.note = 'gone before you were born';
  }
  for (let i = older; i > 0; i--) {
    const s: Sex = rng.next() < 0.5 ? 'male' : 'female';
    addPerson(life, 'sibling', s, -(i * 2 + rng.int(0, 1)), name(s));
  }
  if (disabled) addStatus(life, 'disability', rng, 'born with a disability');
  life.rng = rng.state;
  return life;
}

export interface MiracleResult {
  won: boolean;
  roll: number;
  odds: number;
  text: string;
}

/** Spend a respin on a long-shot rescue from a hard start. */
export function miracleSpin(life: Life, kind: HardStart): MiracleResult {
  const rng = new Rng(life.rng);
  const odds = CONFIG.miracleOdds[kind];
  const roll = rng.next();
  const won = roll < odds;
  life.respins -= 1;
  let text = kind === 'poverty' ? 'The universe checked again. Still poor.' : 'No miracle. Life goes on, the hard way.';
  if (won && kind === 'poverty') {
    life.familyPct = 0.999;
    life.stats.money = 80;
    life.home = initialHome(80, life.rural, countryByCode(life.country).tier);
    life.hardStarts = life.hardStarts.filter((h) => h !== 'poverty');
    life.facts.push('born into one of the richest families in the country');
    text = 'Plot twist: you were born into the top 0.1%. Servants, drivers, a trust fund.';
  } else if (won) {
    addStatus(life, 'famous', rng, 'famous since birth');
    applyDeltas(life, { money: 50, happiness: 20 });
    text = 'A viral story made you famous before you could walk. Sponsors lined up.';
  }
  life.rng = rng.state;
  return { won, roll, odds, text };
}

/** Odds of a bold choice paying off. */
export function luck(life: Life): number {
  let p = 0.5 + (life.stats.money - 40) * 0.003 + (life.stats.health - 60) * 0.002;
  for (const t of life.traits) p += TRAITS[t].luck ?? 0;
  if (life.age < life.momentum.until) p += life.momentum.value;
  return clamp(p, 0.15, 0.85);
}

/** Yearly chance of dying of everything the event table does not model. */
export function backgroundMortality(life: Life): number {
  const m = CONFIG.mortality;
  const c = makeCtx(life);
  const country = c.country;
  const median = countryByCode(life.birthCountry).lifeExp * 0.3 + country.lifeExp * 0.7 + m.medianOffset[country.tier];
  const a = (m.gompertzB * Math.LN2) / (Math.exp(m.gompertzB * median) - 1);
  let q = a * Math.exp(m.gompertzB * life.age) * m.background;
  if (life.age === 0) q += m.neonatal[country.tier] * c.world.era;
  q *= Math.exp((60 - life.stats.health) / m.healthScale);
  return clamp(q, 0, 0.9);
}

/** Slow background changes: aging, income, statuses, home, mood regressing to the mean. */
export function drift(life: Life): void {
  const c = makeCtx(life);
  const age = life.age;
  // Health heals toward what is normal for your age; chronic conditions keep dragging it down.
  const target = A(age, [[0, 80], [25, 86], [45, 80], [60, 70], [75, 56], [85, 44], [95, 32]]) + W(c, -5, 0, 5);
  const d: Stats = { health: (target - life.stats.health) * 0.12, money: 0, happiness: (55 - life.stats.happiness) * 0.06 };
  if (life.job && age >= 10) d.money = CONFIG.money.income[c.tier] * SECTOR_PAY[life.job.sector] * (1 + 0.25 * (life.job.level - 1)) * (c.has('university_degree') ? 1.2 : 1);
  else if (c.has('retired')) d.money = c.tier === 'high' || c.tier === 'upperMid' ? -0.2 : -0.8;
  if (life.home.kind === 'slum') d.health -= 1;
  if (life.home.kind === 'mansion') d.health += 0.5;
  for (const t of life.traits) {
    d.health += TRAITS[t].health ?? 0;
    d.happiness += TRAITS[t].happiness ?? 0;
  }
  // Hard conditions count in full; story-level (soft) ones together only nudge mood and money.
  const soft: Stats = { health: 0, money: 0, happiness: 0 };
  for (const s of life.statuses) {
    const def = STATUSES[s.id];
    for (const [k, v] of Object.entries(def?.drift ?? {}) as [keyof Stats, number][]) (def?.soft ? soft : d)[k] += v;
  }
  d.health += clamp(soft.health, -2, 1.5);
  d.money += clamp(soft.money, -3, 1.5);
  d.happiness += clamp(soft.happiness, -5, 2.5);
  life.stats.health = clamp(life.stats.health + d.health, 0, 100);
  life.stats.money = clamp(life.stats.money + d.money, 0, 100);
  life.stats.happiness = clamp(life.stats.happiness + d.happiness, 0, 100);
}

/** Did the dream picked in the teens come true? null when no dream was picked. */
export function dreamCameTrue(life: Life): boolean | null {
  const t = life.tally;
  switch (life.dream) {
    case 'wealth': return t.maxMoney >= 80;
    case 'family': return life.cast.filter((p) => p.role === 'child').length >= 3 && t.marriedYears > 0;
    case 'fame': return t.wasFamous;
    case 'adventure': return t.countries.length >= 2 || t.trips >= 3;
    case 'long_life': return life.age >= 90;
    case 'love': return t.marriedYears >= 25;
    default: return null;
  }
}

export function score(life: Life): number {
  const years = Math.max(1, life.statSum.years);
  const avg = (life.statSum.money + life.statSum.happiness) / 2 / years;
  return Math.round(life.age * (0.5 + 0.5 * (avg / 100)) * (dreamCameTrue(life) ? 1.25 : 1));
}
