import { countryByCode } from '../data/world';
import { worldMods, type WorldMods } from './world';
import type { Country, Dream, HomeKind, IncomeTier, Life, Person, Relationship, Role, Sector, Sex, Stage, TraitId, WealthTier } from './types';

export interface Someone {
  person: Person;
  age: number;
}

/** Everything an event's probability may depend on, computed once per year. */
export interface Ctx {
  age: number;
  year: number;
  sex: Sex;
  stage: Stage;
  country: Country;
  tier: IncomeTier;
  rural: boolean;
  wealth: WealthTier;
  money: number;
  health: number;
  happiness: number;
  relationship: Relationship;
  partnered: boolean;
  partnerAge: number;
  kids: number; // living children
  parents: number; // living parents
  employed: boolean;
  sector: Sector | null;
  level: number;
  homeKind: HomeKind;
  homeRung: number; // 0 street .. 5 mansion
  owned: boolean;
  student: boolean;
  free: boolean; // not in prison
  care: number; // 0..1 access to decent medical care
  conflict: number; // effective conflict level this year
  world: WorldMods;
  traits: TraitId[];
  dream: Dream | null;
  abroad: boolean;
  threads: number; // open story threads kept by the LLM
  has: (id: string) => boolean;
  trait: (id: TraitId) => boolean;
  once: (id: string) => boolean; // already happened
  people: (...roles: Role[]) => Someone[]; // living cast members with their current age
}

export function stageOf(age: number): Stage {
  if (age <= 2) return 'baby';
  if (age <= 12) return 'child';
  if (age <= 19) return 'teen';
  if (age <= 34) return 'young';
  if (age <= 64) return 'adult';
  return 'senior';
}

export const wealthTier = (money: number): WealthTier => (money < 25 ? 'rags' : money < 65 ? 'regular' : 'wealthy');
export const HOME_RUNGS: HomeKind[] = ['street', 'slum', 'room', 'flat', 'house', 'mansion'];

export function makeCtx(life: Life, age = life.age): Ctx {
  const country = countryByCode(life.country);
  const ids = new Set(life.statuses.map((s) => s.id));
  const wealth = wealthTier(life.stats.money);
  const year = life.birthYear + age;
  const world = worldMods(life, year, country.x.conflict);
  const living = (roles: Role[]) =>
    life.cast.filter((p) => p.alive && roles.includes(p.role)).map((p) => ({ person: p, age: age - p.bornAge }));
  return {
    age,
    year,
    sex: life.sex,
    stage: stageOf(age),
    country,
    tier: country.tier,
    rural: life.rural,
    wealth,
    money: life.stats.money,
    health: life.stats.health,
    happiness: life.stats.happiness,
    relationship: life.relationship,
    partnered: life.relationship === 'dating' || life.relationship === 'engaged' || life.relationship === 'married',
    partnerAge: life.partner ? age - life.partner.bornAge : 0,
    kids: life.cast.filter((p) => p.alive && p.role === 'child').length,
    parents: life.cast.filter((p) => p.alive && (p.role === 'mother' || p.role === 'father')).length,
    employed: !!life.job,
    sector: life.job?.sector ?? null,
    level: life.job?.level ?? 0,
    homeKind: life.home.kind,
    homeRung: HOME_RUNGS.indexOf(life.home.kind),
    owned: life.home.owned,
    student: ids.has('student'),
    free: !ids.has('in_prison'),
    care: Math.min(0.98, careQuality(country, wealth, life.rural) + world.care),
    conflict: world.conflict,
    world,
    traits: life.traits,
    dream: life.dream,
    abroad: life.country !== life.birthCountry,
    threads: life.threads.length,
    has: (id) => ids.has(id),
    trait: (id) => life.traits.includes(id),
    once: (id) => life.doneOnce.includes(id),
    people: (...roles) => living(roles),
  };
}

/** Access to decent care: country level, then money buys you in or out of it. */
function careQuality(c: Country, wealth: WealthTier, rural: boolean): number {
  let q = { low: 0.2, lowerMid: 0.45, upperMid: 0.7, high: 0.9 }[c.tier];
  if (wealth === 'wealthy') q += 0.2;
  if (wealth === 'rags') q -= c.care === 'universal' ? 0.05 : c.care === 'private' ? 0.25 : 0.15;
  if (rural && c.tier !== 'high') q -= 0.1;
  return Math.max(0.05, Math.min(0.98, q));
}

// ---- helpers used by the event table -------------------------------------------------

/** Multiplier by country income tier. */
export const T = (c: Ctx, low: number, lowerMid: number, upperMid: number, high: number) =>
  ({ low, lowerMid, upperMid, high })[c.tier];

/** Multiplier by personal wealth. */
export const W = (c: Ctx, rags: number, regular: number, wealthy: number) => ({ rags, regular, wealthy })[c.wealth];

/** Multiplier by sex. */
export const M = (c: Ctx, male: number, female: number) => (c.sex === 'male' ? male : female);

/** Multiplier when a status is active. */
export const S = (c: Ctx, id: string, factor: number) => (c.has(id) ? factor : 1);

/** Multiplier by job sector (1 when unlisted or jobless). */
export const SEC = (c: Ctx, table: Partial<Record<Sector, number>>) => (c.sector ? table[c.sector] ?? 1 : 1);

/** Multiplier by kind of home. */
export const HK = (c: Ctx, table: Partial<Record<HomeKind, number>>) => table[c.homeKind] ?? 1;

/** Multiplier for village life (rural, urban). */
export const R = (c: Ctx, rural: number, urban: number) => (c.rural ? rural : urban);

/** Piecewise-linear curve over age, flat beyond both ends. */
export function A(age: number, pts: [number, number][]): number {
  if (age <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x0, y0] = pts[i - 1];
    if (age <= x1) return y0 + ((y1 - y0) * (age - x0)) / (x1 - x0);
  }
  return pts[pts.length - 1][1];
}

/** Poor health makes illness more likely. */
export const H = (c: Ctx) => Math.max(0.5, Math.min(2.5, 1 + (60 - c.health) / 60));

/** Bad care raises fatality: 1 at perfect care, up to ~1.6 with none. */
export const D = (c: Ctx) => 1.6 - 0.6 * c.care - 0.4 * c.care * c.care;

/** A medical bill in money points, scaled by the care system and your class. */
export const bill = (c: Ctx, n: number) =>
  -Math.round(n * { universal: 0.2, mixed: 0.7, private: 1.5 }[c.country.care] * (c.wealth === 'wealthy' ? 1.3 : 1));

export const inCountry = (c: Ctx, ...codes: string[]) => codes.includes(c.country.code);

/** Yearly death odds for a relative of a given age, from a crude life table. */
export const deathOdds = (c: Ctx, age: number) =>
  Math.min(0.6, 0.00008 * Math.exp(0.085 * age) * T(c, 2.2, 1.7, 1.25, 1)) +
  (age < 1 ? T(c, 0.04, 0.025, 0.008, 0.003) : age < 5 ? T(c, 0.012, 0.007, 0.002, 0.0005) : 0) * c.world.era;
