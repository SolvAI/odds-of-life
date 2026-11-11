import { CONFIG } from './config';
import { Rng } from './rng';
import { makeCtx } from './ctx';
import { STATUSES } from '../data/statuses';
import { EVENTS } from '../data/events';
import { countryByCode } from '../data/world';
import {
  SECTOR_TITLE, addPerson, addStatus, applyDeltas, backgroundMortality, clamp, drift, hasStatus, kindAt, luck, pickSector,
  placeholderName, removeStatus, rungOf,
} from './life';
import type { ChoicePlan, ChoiceText, EventsPlan, Life, MontagePlan, Person, Role, RolledEvent, Sector, Stats, YearResult, YearText } from './types';

const MAX_FACTS = 14;
const EVENT_ONCE = new Set(EVENTS.filter((e) => e.once).map((e) => e.id));
const TRIP_EVENTS = new Set(['holiday', 'pilgrimage', 'work_abroad']);
const BAD_JOB_TITLES = /^(none|n\/a|unemployed|student|retired|no job|jobless|-)$/i;
const LLM_ROLES: Role[] = ['friend', 'rival', 'mentor', 'boss', 'other'];
const EMPTY: YearText = { title: '', text: '', fact: '' };

function addFact(life: Life, fact: string): void {
  const f = fact.trim().replace(/\.$/, '');
  if (!f || life.facts.some((x) => x.toLowerCase() === f.toLowerCase())) return;
  if (/^born in\b|\b(happiness|health|money|mood)\b.*\b(up|down|drop|rose|fell)/i.test(f)) return; // restated stats, not facts
  life.facts.push(f);
  if (life.facts.length > MAX_FACTS) life.facts.splice(1, 1); // keep the oldest (often the birth fact)
}

const cleanJob = (t?: string) => (t && !BAD_JOB_TITLES.test(t.trim()) ? t.trim().slice(0, 40) : '');
const otherSex = (life: Life) => (life.sex === 'male' ? 'female' : 'male');
const castNames = (life: Life) => [life.name, life.partner?.name ?? '', ...life.cast.map((p) => p.name)];

/** Names for people created this year come from the LLM, in event order; placeholders otherwise. */
class NameQueue {
  private i = 0;
  constructor(private names: string[] = []) {}
  next(life: Life, country: string, sex: 'male' | 'female', rng: Rng): string {
    const n = this.names[this.i++]?.trim();
    return n && n.length <= 40 ? n : placeholderName(country, sex, rng, castNames(life));
  }
}

export function applyYear(life: Life, plan: EventsPlan, text: YearText, opts: { quiet?: boolean } = {}): YearResult {
  life.age = plan.age;
  const rng = new Rng(plan.rngAfter);
  const result: YearResult = { died: false, cause: '', added: [], removed: [], born: [], lost: [] };
  const total: Partial<Stats> = {};
  const names = new NameQueue(text.newNames);
  let death: string | undefined;

  for (const e of plan.events) {
    applyDeltas(life, e.deltas);
    for (const [k, v] of Object.entries(e.deltas) as [keyof Stats, number][]) total[k] = (total[k] ?? 0) + v;
    for (const id of e.remove) if (removeStatus(life, id)) result.removed.push(id);
    for (const id of e.add) if (addStatus(life, id, rng)) result.added.push(id);
    applyEffect(life, e, text, rng, names, result);
    if (EVENT_ONCE.has(e.id)) life.doneOnce.push(e.id);
    if (TRIP_EVENTS.has(e.id)) life.tally.trips++;
    death ??= e.death;
  }
  syncHome(life, rng, result);

  // The LLM's share of the bookkeeping. Skipped in the year you die: models like to write "home: grave".
  if (!death && !opts.quiet) applyLlmUpdates(life, text, result, rng);

  if (!opts.quiet) {
    life.history.push({
      age: life.age,
      year: plan.year,
      title: text.title,
      text: text.text,
      events: plan.events.map((e) => (e.outcome ? `${e.title}: ${e.outcome.label}` : e.title)),
      good: plan.events.length ? plan.events.every((e) => e.good) : undefined,
      deltas: total,
      kind: 'year',
    });
  }
  if (death) return die(life, rng, { ...result, cause: death });
  return endOfYear(life, rng, result);
}

/** Several quiet years in a row, told as one card. */
export function applyMontage(life: Life, plan: MontagePlan, text: YearText): YearResult {
  let result: YearResult = { died: false, cause: '', added: [], removed: [] };
  const start = { ...life.stats };
  for (const y of plan.years) {
    const r = applyYear(life, y, EMPTY, { quiet: true });
    result = { ...r, added: [...result.added, ...r.added], removed: [...result.removed, ...r.removed] };
    if (life.dead) break;
  }
  if (!life.dead) applyLlmUpdates(life, text, result, new Rng(life.rng));
  const deltas: Partial<Stats> = {};
  for (const k of ['health', 'money', 'happiness'] as const) deltas[k] = Math.round(life.stats[k] - start[k]);
  life.history.push({ age: plan.age, toAge: life.age, year: plan.year, title: text.title, text: text.text, deltas, kind: 'montage' });
  return result;
}

function applyEffect(life: Life, e: RolledEvent, text: YearText, rng: Rng, names: NameQueue, result: YearResult): void {
  const c = makeCtx(life);
  const np = e.newPerson;
  const newJob = (sector: Sector, level = 1) => {
    life.job = { sector, level, since: life.age, title: cleanJob(text.job) || SECTOR_TITLE[sector] };
    removeStatus(life, 'unemployed');
  };
  // Anyone an event brings in joins the cast, whatever else the event does.
  if (np && np.role !== 'partner') {
    const bornAge = np.role === 'child' || np.role === 'sibling' ? life.age
      : np.role === 'mentor' ? life.age - rng.int(15, 30)
      : np.role === 'boss' ? life.age - rng.int(5, 20)
      : life.age + rng.int(-3, 3);
    const p = addPerson(life, np.role, np.sex, bornAge, names.next(life, life.country, np.sex, rng));
    result.born?.push(p.name);
    if (np.role === 'child') addFact(life, `${p.name} born when you were ${life.age}`);
  }
  switch (e.effect) {
    case 'newPartner':
    case 'arranged': {
      const country = np?.country ?? life.country;
      const sex = np?.sex ?? otherSex(life);
      const older = e.id === 'child_marriage' ? rng.int(6, 18) : e.effect === 'arranged' ? rng.int(0, 8) : rng.int(-4, 5);
      const name = names.next(life, country, sex, rng);
      life.partner = { name, country, sex, bornAge: life.age - Math.max(16, life.age + older), note: '' };
      life.relationship = e.effect === 'arranged' ? 'married' : 'dating';
      const from = country !== life.country ? ` from ${countryByCode(country).name}` : '';
      addFact(life, `${e.effect === 'arranged' ? 'married off to' : 'fell for'} ${name}${from} at ${life.age}`);
      result.born?.push(name);
      break;
    }
    case 'engaged':
      life.relationship = 'engaged';
      break;
    case 'married':
      life.relationship = 'married';
      addFact(life, `married ${life.partner?.name} at ${life.age}`);
      break;
    case 'breakup':
    case 'divorce':
      if (life.partner) {
        addPerson(life, 'ex', life.partner.sex, life.partner.bornAge, life.partner.name, life.partner.note || `your ex since you were ${life.age}`);
        if (e.effect === 'divorce' && life.relationship === 'married') addFact(life, `divorced ${life.partner.name} at ${life.age}`);
      }
      life.relationship = e.effect === 'divorce' && life.relationship === 'married' ? 'divorced' : 'single';
      life.partner = null;
      removeStatus(life, 'abusive_partner');
      break;
    case 'widowed':
      if (life.partner) {
        const late = addPerson(life, 'other', life.partner.sex, life.partner.bornAge, life.partner.name, `your late ${life.partner.sex === 'male' ? 'husband' : 'wife'}`);
        late.alive = false;
        addFact(life, `${life.partner.name} died when you were ${life.age}`);
        result.lost?.push(life.partner.name);
      }
      life.relationship = 'widowed';
      life.partner = null;
      removeStatus(life, 'abusive_partner');
      break;
    case 'personDies': {
      const p = life.cast.find((x) => x.id === e.target?.id);
      if (p) {
        p.alive = false;
        result.lost?.push(p.name);
        addFact(life, `${p.name} (${p.role === 'child' ? 'your child' : `your ${p.role}`}) died when you were ${life.age}`);
      }
      break;
    }
    case 'newJob':
      newJob(pickSector(c, rng), c.has('university_degree') ? 2 : 1);
      break;
    case 'crimeJob':
      newJob('crime');
      break;
    case 'business':
      newJob('business', 2);
      break;
    case 'promotion':
    case 'demotion':
      if (life.job) {
        life.job.level = clamp(life.job.level + (e.effect === 'promotion' ? 1 : -1), 1, 5);
        life.job.title = cleanJob(text.job) || life.job.title;
      }
      break;
    case 'fired':
    case 'retire':
      life.job = null;
      break;
    case 'migrate':
      moveCountry(life, e.moveTo ?? 'AE');
      newJob(life.sex === 'female' && rng.next() < 0.5 ? 'domestic' : 'labour');
      addFact(life, `left to work in ${countryByCode(life.country).name} at ${life.age}`);
      break;
    case 'emigrate':
      if (e.moveTo) {
        moveCountry(life, e.moveTo);
        life.job = null;
        life.home = { kind: 'room', owned: false, desc: '', place: '' };
        addFact(life, `emigrated to ${countryByCode(life.country).name} at ${life.age}`);
      }
      break;
    case 'deported':
      moveCountry(life, life.birthCountry);
      life.job = null;
      life.home = { kind: 'room', owned: false, desc: '', place: '' };
      removeStatus(life, 'undocumented');
      addFact(life, `deported back to ${countryByCode(life.country).name} at ${life.age}`);
      break;
    case 'evicted':
      life.home = { ...life.home, kind: 'street', owned: false };
      break;
    case 'homeDown':
      life.home = { ...life.home, kind: kindAt(Math.max(1, rungOf(life.home.kind) - 1)), owned: false };
      break;
    case 'homeUp':
      life.home = { ...life.home, kind: kindAt(Math.max(2, rungOf(life.home.kind) + 1)), owned: life.home.kind !== 'street' && life.home.owned };
      break;
    case 'buyHome':
      life.home = { ...life.home, owned: true, kind: kindAt(Math.max(rungOf(life.home.kind), life.rural || life.stats.money >= 50 ? 4 : 3)) };
      addFact(life, `bought a home at ${life.age}`);
      break;
    case 'loseHome':
      life.home = { ...life.home, kind: life.rural ? 'slum' : 'room', owned: false };
      break;
    case 'toCity':
      life.rural = false;
      life.job = null;
      life.home = { kind: life.stats.money < 15 ? 'slum' : 'room', owned: false, desc: '', place: '' };
      addFact(life, `left the village for the city at ${life.age}`);
      break;
  }
}

function moveCountry(life: Life, code: string): void {
  life.country = code;
  if (!life.tally.countries.includes(code)) life.tally.countries.push(code);
}

/** Homeless and homeowner statuses follow the home itself. */
function syncHome(life: Life, rng: Rng, result: YearResult): void {
  const street = life.home.kind === 'street';
  if (street && addStatus(life, 'homeless', rng)) result.added.push('homeless');
  if (!street && removeStatus(life, 'homeless')) result.removed.push('homeless');
  if (life.home.owned && addStatus(life, 'homeowner', rng)) result.added.push('homeowner');
  if (!life.home.owned && removeStatus(life, 'homeowner')) result.removed.push('homeowner');
}

function findPerson(life: Life, name: string): Person | { note: string } | null {
  const n = name.trim().toLowerCase();
  if (life.partner && life.partner.name.toLowerCase() === n) return life.partner;
  return life.cast.find((p) => p.name.toLowerCase() === n) ?? null;
}

function applyLlmUpdates(life: Life, text: YearText, result: YearResult, rng: Rng): void {
  if (text.home?.trim()) life.home.desc = text.home.trim().slice(0, 80);
  if (text.place?.trim()) life.home.place = text.place.trim().slice(0, 40);
  if (life.job && cleanJob(text.job)) life.job.title = cleanJob(text.job);
  for (const tag of text.statusRemove ?? []) {
    if (STATUSES[tag]?.soft && !result.added.includes(tag) && removeStatus(life, tag)) result.removed.push(tag);
  }
  for (const s of (text.statusAdd ?? []).slice(0, 1)) {
    if (STATUSES[s.tag]?.soft && !result.removed.includes(s.tag) && addStatus(life, s.tag, rng, s.label)) result.added.push(s.tag);
  }
  const np = text.newPerson;
  if (np && LLM_ROLES.includes(np.role) && np.name?.trim() && !findPerson(life, np.name) && life.cast.length < 24) {
    const bornAge = np.role === 'mentor' ? life.age - rng.int(15, 30) : np.role === 'boss' ? life.age - rng.int(5, 20) : life.age + rng.int(-4, 4);
    addPerson(life, np.role, rng.next() < 0.5 ? 'male' : 'female', bornAge, np.name.trim().slice(0, 40), np.note?.slice(0, 80) ?? '');
    result.born?.push(np.name.trim());
  }
  for (const u of (text.people ?? []).slice(0, 4)) {
    const p = findPerson(life, u.name ?? '');
    if (p && u.note?.trim()) p.note = u.note.trim().slice(0, 90);
  }
  if (text.story?.trim()) life.story = text.story.trim().slice(0, 900);
  if (Array.isArray(text.threads)) life.threads = text.threads.map((t) => String(t).trim().slice(0, 110)).filter(Boolean).slice(0, 4);
  addFact(life, text.fact);
}

export function applyChoice(life: Life, plan: ChoicePlan, index: number, text: ChoiceText): YearResult {
  life.age = plan.age;
  const rng = new Rng(plan.rngAfter);
  const o = plan.options[index];
  const result: YearResult = { died: false, cause: '', added: [], removed: [], born: [], lost: [] };
  const deltas = { ...o.deltas };
  if (o.gamble) {
    result.gambleWon = rng.next() < luck(life);
    deltas[o.gamble.stat] = (deltas[o.gamble.stat] ?? 0) + (result.gambleWon ? o.gamble.amount : -o.gamble.amount);
  }
  applyDeltas(life, deltas);
  if (o.move) {
    moveCountry(life, o.move);
    life.home = { kind: life.stats.money < 25 ? 'room' : 'flat', owned: false, desc: '', place: '' };
    life.rural = false;
    addFact(life, `moved to ${countryByCode(o.move).name} at ${life.age}`);
  }
  if (o.dropPartner && life.partner) {
    addPerson(life, 'ex', life.partner.sex, life.partner.bornAge, life.partner.name, `your ex since you were ${life.age}`);
    life.partner = null;
  }
  if (o.relationship) life.relationship = o.relationship;
  if (o.job === 'none') life.job = null;
  else if (o.job === 'auto') life.job = { sector: pickSector(makeCtx(life), rng), level: 1, since: life.age, title: '' };
  else if (o.job) life.job = { sector: o.job, level: o.job === 'business' ? 2 : 1, since: life.age, title: SECTOR_TITLE[o.job] };
  if (life.job && !life.job.title) life.job.title = SECTOR_TITLE[life.job.sector];
  if (o.dream) life.dream = o.dream;
  for (const id of o.remove ?? []) if (removeStatus(life, id)) result.removed.push(id);
  for (const id of o.add ?? []) if (addStatus(life, id, rng)) result.added.push(id);
  syncHome(life, rng, result);
  if (o.momentum) life.momentum = { value: o.momentum, until: life.age + 10 };
  const label = text.labels[index] ?? o.gist;
  addFact(life, `chose to ${label.charAt(0).toLowerCase()}${label.slice(1).replace(/[.!]$/, '')} at ${life.age}`);
  life.history.push({ age: life.age, year: plan.year, title: text.title, text: `${text.text} You chose: ${label}.`, deltas, kind: 'choice', good: result.gambleWon });
  life.nextChoiceAge = life.age + rng.int(CONFIG.choice.gap[0], CONFIG.choice.gap[1]);
  if (o.death && rng.next() < o.death.odds) return die(life, rng, { ...result, cause: o.death.cause });
  return endOfYear(life, rng, result);
}

/** Ongoing statuses tick, tallies, slow drift, then the background mortality roll. */
function endOfYear(life: Life, rng: Rng, result: YearResult): YearResult {
  const c = makeCtx(life);
  for (const s of [...life.statuses]) {
    const def = STATUSES[s.id];
    if (def?.death && rng.next() < def.death(c)) return die(life, rng, { ...result, cause: def.cause ?? s.label });
    if (s.until !== undefined && life.age >= s.until) {
      removeStatus(life, s.id);
      result.removed.push(s.id);
      if (s.id === 'student' && addStatus(life, 'university_degree', rng)) result.added.push('university_degree');
      if (s.id === 'migrant_worker') {
        moveCountry(life, life.birthCountry);
        life.job = null;
        addFact(life, `came home from abroad at ${life.age}`);
      }
      if (s.id === 'in_prison') {
        life.job = null;
        addFact(life, `released from prison at ${life.age}`);
      }
    }
  }
  const t = life.tally;
  t.maxMoney = Math.max(t.maxMoney, life.stats.money);
  if (life.relationship === 'married') t.marriedYears++;
  if (hasStatus(life, 'famous')) t.wasFamous = true;
  drift(life);
  if (life.stats.health <= 0) {
    const drag = (id: string) => STATUSES[id]?.drift?.health ?? 0;
    const worst = [...life.statuses].sort((a, b) => drag(a.id) - drag(b.id)).find((s) => drag(s.id) < 0);
    return die(life, rng, { ...result, cause: worst ? `a body worn down by ${worst.label}` : 'failing health' });
  }
  if (rng.next() < backgroundMortality(life) || life.age >= CONFIG.maxAge) {
    const cause = life.age >= 65 ? 'old age' : life.age < 1 ? 'complications at birth' : life.age < 5 ? 'a childhood illness' : 'a sudden illness';
    return die(life, rng, { ...result, cause });
  }
  life.statSum.money += life.stats.money;
  life.statSum.happiness += life.stats.happiness;
  life.statSum.years += 1;
  life.rng = rng.state;
  return result;
}

function die(life: Life, rng: Rng, result: YearResult): YearResult {
  life.dead = true;
  life.causeOfDeath = result.cause;
  life.statSum.money += life.stats.money;
  life.statSum.happiness += life.stats.happiness;
  life.statSum.years += 1;
  life.rng = rng.state;
  return { ...result, died: true };
}
