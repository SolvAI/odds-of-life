import type { Ctx, Someone } from '../engine/ctx';
import type { Category, EffectName, Role, Stats } from '../engine/types';

export type Num = number | ((c: Ctx) => number);
export type Deltas = Partial<Stats> | ((c: Ctx) => Partial<Stats>);

/** World events scale tagged events (a recession multiplies everything tagged 'economy'). */
export type Tag = 'infection' | 'hiv' | 'economy' | 'layoff' | 'famine' | 'violence' | 'arrest' | 'drugs' | 'heat' | 'flood' | 'draft';

export interface OutcomeDef {
  id: string;
  label: string;
  good: boolean;
  w: Num;
  deltas?: Deltas;
  add?: string[];
  remove?: string[];
  effect?: EffectName;
  death?: string;
}

export interface EventDef {
  id: string;
  title: string;
  cat: Category;
  ages: [number, number];
  /** Yearly probability. With `target`, it multiplies the combined odds of the candidates. */
  p: (c: Ctx) => number;
  when?: (c: Ctx) => boolean;
  weight?: 1 | 2 | 3; // how much it matters when too many events fire
  group?: string; // at most one event per group per year
  once?: boolean;
  question?: string; // shown above the gauge
  tags?: Tag[];
  deltas?: Deltas;
  add?: string[];
  remove?: string[];
  effect?: EffectName;
  outcomes?: OutcomeDef[];
  /** The event is about one cast member: each candidate carries its own yearly odds. */
  target?: (c: Ctx) => (Someone & { w: number })[];
  /** The event is about your partner. */
  aboutPartner?: boolean;
  /** The event brings someone new into the cast (the LLM names them). */
  newPerson?: { role: Role | 'partner'; sex?: 'male' | 'female' | 'other' | 'any' };
  /** Destination for migration effects (country code), or a picker. */
  moveTo?: string | ((c: Ctx) => string);
  /** The LLM must resolve one of the open story threads, well or badly. */
  thread?: boolean;
}
