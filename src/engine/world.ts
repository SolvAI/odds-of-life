import { HISTORY } from '../data/history';
import { countryByCode } from '../data/world';
import { Rng } from './rng';
import type { Life, WorldEvent, WorldFx } from './types';

export const PRESENT = 2026;

const RECESSIONS = ['a global recession', 'a stock market crash', 'a sovereign debt crisis', 'a housing market crash', 'a tech bubble bursting'];
const PANDEMICS = ['a new coronavirus pandemic', 'a bird-flu pandemic', 'a drug-resistant plague', 'a mystery fever pandemic'];
const UNREST = ['civil unrest', 'an insurgency', 'a border war', 'a coup and its aftermath', 'a civil war'];

/** Every run gets its own future: recessions, pandemics, an AI wave, local wars, maybe a cure. */
export function generateFuture(birthYear: number, countryCode: string, rng: Rng): WorldEvent[] {
  const out: WorldEvent[] = [];
  const start = Math.max(PRESENT, birthYear);
  const end = birthYear + 100;
  const tier = countryByCode(countryCode).tier;
  const proneness = { low: 2, lowerMid: 1.2, upperMid: 0.6, high: 0.2 }[tier];
  for (let y = start; y <= end; y++) {
    if (rng.next() < 0.08) out.push({ id: `rec${y}`, label: rng.pick(RECESSIONS), from: y, to: y + rng.int(0, 2), where: 'ALL', fx: { economy: 1.8 } });
    if (rng.next() < 0.012) out.push({ id: `pan${y}`, label: rng.pick(PANDEMICS), from: y, to: y + rng.int(1, 2), where: 'ALL', fx: { infection: 2.5, economy: 1.4 } });
    if (rng.next() < 0.012 * proneness) {
      out.push({ id: `war${y}`, label: rng.pick(UNREST), from: y, to: y + rng.int(2, 7), where: [countryCode], fx: { conflict: rng.next() < 0.4 ? 3 : 2, draft: 1.5 } });
      y += 5;
    }
  }
  const ai = PRESENT + 2 + rng.int(0, 15);
  if (ai <= end) out.push({ id: 'ai_wave', label: 'the AI automation wave', from: ai, to: ai + 8, where: 'ALL', fx: { automation: 2.5 } });
  if (rng.next() < 0.6) {
    const cure = rng.int(2035, 2065);
    if (cure <= end) out.push({ id: 'cure', label: 'cheap cures for most cancers', from: cure, to: 9999, where: 'ALL', fx: { care: 0.15 } });
  }
  return out;
}

const applies = (e: WorldEvent, year: number, country: string) =>
  year >= e.from && year <= e.to && (e.where === 'ALL' || e.where.includes(country));

export function activeWorld(life: Life, year: number): WorldEvent[] {
  return [...HISTORY, ...life.future].filter((e) => applies(e, year, life.country));
}

/** World events starting this year where you live (shown as news). */
export function newsThisYear(life: Life, year: number): WorldEvent[] {
  return activeWorld(life, year).filter((e) => e.from === year);
}

export interface WorldMods {
  conflict: number;
  mult: Record<string, number>; // multiplier per event tag
  disaster?: WorldFx['disaster'];
  care: number;
  era: number; // older years: more infections and child deaths
  climate: number; // future years: more heat and floods
}

/** Combined effect of everything happening in the world this year. */
export function worldMods(life: Life, year: number, baseConflict: number): WorldMods {
  const active = activeWorld(life, year);
  const mult: Record<string, number> = {};
  let conflict = year >= 2015 ? baseConflict : 0;
  let care = 0;
  let disaster: WorldFx['disaster'];
  for (const e of active) {
    const fx = e.fx;
    for (const k of ['infection', 'hiv', 'economy', 'famine', 'violence', 'arrest', 'drugs', 'automation', 'draft'] as const) {
      if (fx[k]) mult[k] = (mult[k] ?? 1) * fx[k]!;
    }
    if (fx.conflict) conflict = Math.max(conflict, fx.conflict);
    if (fx.care) care += fx.care;
    if (fx.disaster && e.from === year) disaster = fx.disaster;
  }
  const tier = countryByCode(life.country).tier;
  const k = { low: 0.35, lowerMid: 0.35, upperMid: 0.2, high: 0.1 }[tier];
  const era = 1 + (k * Math.max(0, 2015 - year)) / 10;
  const climate = 1 + 0.025 * Math.max(0, year - PRESENT);
  return { conflict, mult, disaster, care, era, climate };
}

export const randomBirthYear = (rng: Rng) => rng.int(1950, 2025);
