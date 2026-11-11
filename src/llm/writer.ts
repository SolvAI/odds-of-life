import { completeJson, type LlmConfig } from './client';
import { birthPrompt, choicePrompt, epiloguePrompt, montagePrompt, yearPrompt } from './prompts';
import { countryByCode } from '../data/world';
import { moneyLabel } from '../engine/life';
import type { ChoicePlan, ChoiceText, Epilogue, EventsPlan, Life, MontagePlan, Role, YearText } from '../engine/types';

export interface Written<T> {
  text: T;
  source: 'llm' | 'fallback';
  ms: number;
  error?: string;
}

export interface BirthText {
  name: string;
  title: string;
  text: string;
  home: string;
  place: string;
  family: { name: string; note: string }[];
  story: string;
  threads: string[];
}

const clean = (s: unknown, max = 900) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const strings = (a: unknown, max: number) => (Array.isArray(a) ? a.map((x) => clean(x, max)).filter(Boolean) : []);
const ROLES: Role[] = ['friend', 'rival', 'mentor', 'boss', 'other'];

function parseYear(d: Record<string, unknown>): YearText {
  const np = d.new_person as Record<string, unknown> | null | undefined;
  const people = Array.isArray(d.people) ? (d.people as Record<string, unknown>[]) : [];
  const adds = Array.isArray(d.status_add) ? (d.status_add as Record<string, unknown>[]) : [];
  return {
    title: clean(d.title, 80),
    text: clean(d.text),
    fact: clean(d.fact, 90),
    home: clean(d.home, 80) || undefined,
    place: clean(d.place, 40) || undefined,
    job: clean(d.job, 40) || undefined,
    story: clean(d.story) || undefined,
    threads: Array.isArray(d.threads) ? strings(d.threads, 110) : undefined,
    newNames: strings(d.new_names, 40),
    newPerson: np && typeof np === 'object' && ROLES.includes(np.role as Role) && clean(np.name)
      ? { role: np.role as Role, name: clean(np.name, 40), note: clean(np.note, 80) }
      : null,
    people: people.filter((p) => p && typeof p === 'object').map((p) => ({ name: clean(p.name, 40), note: clean(p.note, 90) })).filter((p) => p.name && p.note),
    statusAdd: adds.filter((a) => a && typeof a.tag === 'string').map((a) => ({ tag: String(a.tag), label: clean(a.label, 40) })),
    statusRemove: strings(d.status_remove, 40),
  };
}

export async function writeYear(cfg: LlmConfig, life: Life, plan: EventsPlan | MontagePlan, signal?: AbortSignal): Promise<Written<YearText>> {
  try {
    const prompt = plan.kind === 'montage' ? montagePrompt(life, plan) : yearPrompt(life, plan);
    const r = await completeJson<Record<string, unknown>>(cfg, prompt, signal);
    const text = parseYear(r.data);
    if (!text.title || !text.text) throw new Error('empty card');
    return { text, source: 'llm', ms: r.ms };
  } catch (e) {
    return { text: fallbackYear(plan), source: 'fallback', ms: 0, error: String(e) };
  }
}

export async function writeChoice(cfg: LlmConfig, life: Life, plan: ChoicePlan, signal?: AbortSignal): Promise<Written<ChoiceText>> {
  try {
    const r = await completeJson<Record<string, unknown>>(cfg, choicePrompt(life, plan), signal);
    const labels = strings(r.data.labels, 60);
    if (labels.length !== plan.options.length) throw new Error('bad labels');
    const text: ChoiceText = { title: clean(r.data.title, 80), text: clean(r.data.text), labels };
    if (!text.title || !text.text) throw new Error('empty card');
    return { text, source: 'llm', ms: r.ms };
  } catch (e) {
    return { text: { title: 'A fork in the road', text: plan.situation, labels: plan.options.map((o) => o.gist) }, source: 'fallback', ms: 0, error: String(e) };
  }
}

export async function writeBirth(cfg: LlmConfig, life: Life, signal?: AbortSignal): Promise<Written<BirthText>> {
  try {
    const r = await completeJson<Record<string, unknown>>(cfg, birthPrompt(life), signal);
    const d = r.data;
    const family = Array.isArray(d.family) ? (d.family as Record<string, unknown>[]).map((f) => ({ name: clean(f?.name, 40), note: clean(f?.note, 90) })) : [];
    const text: BirthText = {
      name: clean(d.name, 30), title: clean(d.title, 80), text: clean(d.text), home: clean(d.home, 80), place: clean(d.place, 40),
      family, story: clean(d.story, 500), threads: strings(d.threads, 110).slice(0, 2),
    };
    if (!text.title || !text.text) throw new Error('empty card');
    return { text, source: 'llm', ms: r.ms };
  } catch (e) {
    const c = countryByCode(life.birthCountry);
    return {
      text: {
        name: life.name, title: `Born in ${c.name}`, text: `You arrive screaming in ${c.name} in ${life.birthYear}, into a ${moneyLabel(life.stats.money)} family. Nobody asked you.`,
        home: '', place: '', family: [], story: '', threads: [],
      },
      source: 'fallback', ms: 0, error: String(e),
    };
  }
}

export async function writeEpilogue(cfg: LlmConfig, life: Life, signal?: AbortSignal): Promise<Written<Epilogue>> {
  try {
    const r = await completeJson<Record<string, unknown>>(cfg, epiloguePrompt(life), signal);
    const d = r.data;
    const text: Epilogue = { headline: clean(d.headline, 100), text: clean(d.text), legacy: clean(d.legacy, 240), epitaph: clean(d.epitaph, 90) };
    if (!text.text) throw new Error('empty epilogue');
    return { text, source: 'llm', ms: r.ms };
  } catch (e) {
    return {
      text: { headline: `${life.name}, ${life.age}, dies of ${life.causeOfDeath}`, text: '', legacy: '', epitaph: 'Here lies someone who was born, and then was not.' },
      source: 'fallback', ms: 0, error: String(e),
    };
  }
}

/** Offline text: plain but correct, built from the rolled events. */
export function fallbackYear(plan: EventsPlan | MontagePlan): YearText {
  if (plan.kind === 'montage') return { title: 'Years go by', text: `Ages ${plan.age} to ${plan.toAge} pass without anything worth writing down.`, fact: '' };
  if (!plan.events.length) return { title: 'A quiet year', text: 'Nothing much happens. You will not remember this year at all.', fact: '' };
  const lines = plan.events.map((e) => (e.outcome ? `${e.title}: ${e.outcome.label}.` : `${e.title}.`));
  return { title: plan.events[0].title, text: lines.join(' '), fact: '' };
}
