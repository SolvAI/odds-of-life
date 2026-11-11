import { countryByCode } from '../data/world';
import { SOFT_TAGS, STATUSES } from '../data/statuses';
import { DREAMS, TRAITS } from '../data/traits';
import { HOME_LABEL, dreamCameTrue, moneyLabel, stageOf } from '../engine/life';
import { activeWorld } from '../engine/world';
import { SYSTEM } from './narrator';
import type { ChoicePlan, EventsPlan, Life, MontagePlan, Person, RolledEvent, Stats } from '../engine/types';

export interface Prompt {
  system: string;
  user: string;
  schema: Record<string, unknown>;
  maxTokens: number;
}


const STAGE_LABEL = { baby: 'a baby', child: 'a child', teen: 'a teenager', young: 'a young adult', adult: 'an adult', senior: 'old' };
const word = (v: number, low: string, mid: string, high: string) => (v < 35 ? low : v < 70 ? mid : high);
const str = (max: number) => ({ type: 'string', maxLength: max });
const ROLE_LABEL: Record<string, string> = { mother: 'mother', father: 'father', sibling: 'sibling', child: 'child', ex: 'ex', friend: 'friend', rival: 'rival', mentor: 'mentor', boss: 'boss', other: '' };

function personLine(life: Life, p: Person): string {
  const age = life.age - p.bornAge;
  const rel = p.role === 'sibling' ? (p.sex === 'male' ? 'brother' : 'sister') : p.role === 'child' ? (p.sex === 'male' ? 'son' : 'daughter') : ROLE_LABEL[p.role];
  return `${rel ? `${rel} ` : ''}${p.name}${p.alive ? ` (${age})` : ' (dead)'}${p.note ? `: ${p.note}` : ''}`;
}

function worldLine(life: Life, year: number): string {
  const active = activeWorld(life, year).filter((e) => e.id !== 'cn_onechild' || life.country === 'CN');
  const news = active.filter((e) => e.from === year).map((e) => e.label);
  const ongoing = active.filter((e) => e.from !== year && e.to < 9000).map((e) => e.label);
  const parts = [];
  if (news.length) parts.push(`starting this year: ${news.join('; ')}`);
  if (ongoing.length) parts.push(`ongoing: ${ongoing.join('; ')}`);
  return parts.join('. ') || 'nothing world-shaking';
}

/** Everything the narrator needs to stay consistent. */
export function lifeBlock(life: Life, age: number, recentCards = 2): string {
  const year = life.birthYear + age;
  const born = countryByCode(life.birthCountry).name;
  const now = countryByCode(life.country).name;
  const p = life.partner;
  const partner = p
    ? `${life.relationship === 'married' ? (p.sex === 'male' ? 'husband' : 'wife') : life.relationship === 'engaged' ? 'fiancé(e)' : 'partner'} ${p.name} (${age - p.bornAge}${p.country !== life.country ? `, from ${countryByCode(p.country).name}` : ''})${p.note ? `: ${p.note}` : ''}`
    : life.relationship;
  const job = life.job ? `${life.job.title} (${life.job.sector} work, level ${life.job.level} of 5, since age ${life.job.since})` : life.statuses.some((s) => s.id === 'student') ? 'university student' : age < 14 ? 'none, still a child' : 'none';
  const home = `${HOME_LABEL[life.home.kind]}${life.home.kind === 'street' ? '' : life.home.owned ? ', owned' : ', rented'}${life.home.desc ? `: ${life.home.desc}` : ''}${life.home.place ? `, in ${life.home.place}` : ''}`;
  const living = life.cast.filter((x) => x.alive);
  const dead = life.cast.filter((x) => !x.alive && ['mother', 'father', 'sibling', 'child', 'other'].includes(x.role));
  const good = life.statuses.filter((s) => STATUSES[s.id]?.kind === 'benefiting').map((s) => s.label);
  const bad = life.statuses.filter((s) => STATUSES[s.id]?.kind !== 'benefiting').map((s) => `${s.label} (since ${s.since})`);
  const cards = life.history.slice(-recentCards).map((h) => `- age ${h.age}${h.toAge ? `-${h.toAge}` : ''}, "${h.title}": ${h.text}`).join('\n');
  return `YEAR ${year}. You are ${age}, ${STAGE_LABEL[stageOf(age)]}.
World: ${worldLine(life, year)}.

LIFE
${life.name}, ${life.sex}, ${life.traits.map((t) => TRAITS[t].label).join(' and ')}. Born ${life.birthYear} in ${born}, ${life.rural ? 'a village or the countryside' : 'a town or city'}${life.country !== life.birthCountry ? `; lives in ${now} now` : ''}.
Dream: ${life.dream ? DREAMS[life.dream].label : 'none yet'}.
Wealth: ${moneyLabel(life.stats.money)}. Health: ${word(life.stats.health, 'poor', 'fair', 'excellent')}. Mood: ${word(life.stats.happiness, 'miserable', 'okay', 'happy')}.
Home: ${home}.
Job: ${job}.
Partner: ${partner}.
People: ${living.map((x) => personLine(life, x)).join('; ') || 'nobody'}.${dead.length ? `\nGone: ${dead.map((x) => personLine(life, x)).join('; ')}.` : ''}
Dealing with: ${bad.join('; ') || 'nothing in particular'}.
Benefiting from: ${good.join('; ') || 'nothing in particular'}.
Story so far: ${life.story || 'just beginning'}
Open threads: ${life.threads.length ? life.threads.map((t) => `\n- ${t}`).join('') : 'none'}
Facts: ${life.facts.slice(-8).join('; ') || 'none yet'}
${cards ? `Last cards:\n${cards}` : ''}`;
}

function effectsInWords(deltas: Partial<Stats>): string {
  const parts = Object.entries(deltas)
    .filter(([, v]) => v)
    .map(([k, v]) => {
      const size = Math.abs(v!) < 8 ? 'a little' : Math.abs(v!) < 20 ? 'a lot' : 'massively';
      return `${k} ${v! > 0 ? 'up' : 'down'} ${size}`;
    });
  return parts.join(', ') || 'nothing measurable';
}

function newPersonPhrase(life: Life, e: RolledEvent): string {
  const n = e.newPerson!;
  const sex = n.sex === 'male' ? 'a man' : 'a woman';
  const from = n.country !== life.country ? ` from ${countryByCode(n.country).name}` : '';
  switch (n.role) {
    case 'partner': return e.id === 'child_marriage' ? `your husband, an older man${from}` : `your new partner, ${sex}${from}`;
    case 'child': return `your baby ${n.sex === 'male' ? 'son' : 'daughter'}`;
    case 'sibling': return `your new baby ${n.sex === 'male' ? 'brother' : 'sister'}`;
    default: return `a new ${n.role} (${sex})`;
  }
}

function eventLine(e: RolledEvent, i: number): string {
  const about = e.target ? ` (about ${e.target.role === 'partner' ? 'your partner' : `your ${e.target.role}`} ${e.target.name}, ${e.target.age})` : '';
  return `${i + 1}. ${e.title}${e.outcome ? `: ${e.outcome.label}` : ''}${about} [${e.good ? 'GOOD' : 'BAD'}]${e.thread ? ' (an old thread comes back: resolve one of the open threads that way and drop it)' : ''}`;
}

/** Status and cast bookkeeping fields shared by year and montage cards. */
function recordsSchema(life: Life, newNames: number) {
  const present = life.statuses.map((s) => s.id);
  const addable = SOFT_TAGS.filter((t) => !present.includes(t));
  const removable = present.filter((t) => SOFT_TAGS.includes(t));
  const props: Record<string, unknown> = {
    story: str(900),
    threads: { type: 'array', maxItems: 4, items: str(110) },
    home: str(80),
    place: str(40),
    job: str(40),
    new_person: {
      anyOf: [
        { type: 'null' },
        { type: 'object', properties: { role: { type: 'string', enum: ['friend', 'rival', 'mentor', 'boss', 'other'] }, name: str(40), note: str(80) }, required: ['role', 'name', 'note'] },
      ],
    },
    people: { type: 'array', maxItems: 4, items: { type: 'object', properties: { name: str(40), note: str(90) }, required: ['name', 'note'] } },
    status_add: { type: 'array', maxItems: 1, items: { type: 'object', properties: { tag: { type: 'string', enum: addable }, label: str(40) }, required: ['tag', 'label'] } },
  };
  if (removable.length) props.status_remove = { type: 'array', items: { type: 'string', enum: removable } };
  if (newNames) props.new_names = { type: 'array', minItems: newNames, maxItems: newNames, items: str(40) };
  const guide = `Then update the records:
- home: the place you live now in at most 10 words, consistent with "${HOME_LABEL[life.home.kind]}"${life.home.kind === 'street' ? '' : life.home.owned ? ' (owned)' : ' (rented)'}; place: the town, city or village (a real name).
- job: your job title in at most 4 words${life.job ? ` (you work in ${life.job.sector}, level ${life.job.level} of 5)` : ', or "none"'}.
- new_person: at most one recurring character this year's story introduced: one human being with a first name (a friend, rival, mentor, boss or other), or null. Never a group, a pet or an animal, never someone already in People.
- people notes: who they are to you now, no ages.
- people: up to 4 short updated notes on existing people (by exact name) whose relationship with you changed.
- status_add: at most one new ongoing condition the story clearly created, from: ${addable.map((t) => t).join(', ')}; with a specific label. Empty when none.${removable.length ? `\n- status_remove: conditions among [${removable.join(', ')}] that clearly ended.` : ''}${newNames ? `\n- new_names: names for the ${newNames} new ${newNames > 1 ? 'people' : 'person'} listed above, in order, fitting the culture and the year.` : ''}`;
  return { props, guide };
}

export function yearPrompt(life: Life, plan: EventsPlan): Prompt {
  const created = plan.events.filter((e) => e.newPerson);
  const { props, guide } = recordsSchema(life, created.length);
  const all: Record<string, unknown> = { title: str(60), text: str(700), fact: str(90), ...props };
  const death = plan.events.find((e) => e.death);
  const total: Partial<Stats> = {};
  for (const e of plan.events) for (const [k, v] of Object.entries(e.deltas) as [keyof Stats, number][]) total[k] = (total[k] ?? 0) + v;
  let year: string;
  if (plan.events.length) {
    year = `THIS YEAR. Everything below happens; put all of it in the story:
${plan.events.map(eventLine).join('\n')}
${created.length ? `New people this year: ${created.map((e) => newPersonPhrase(life, e)).join('; ')}.\n` : ''}Overall effect: ${effectsInWords(total)}.${death ? `\nYOU DIE THIS YEAR, of ${death.death}. End the card with your death.` : ''}
Write a title (2 to 6 words, never a reused title) and the text: 3 to 5 sentences, 50 to 90 words.`;
  } else {
    year = `THIS YEAR: nothing major happens${plan.world.length ? ` to you, but the world news reaches you: ${plan.world.map((w) => w.label).join('; ')}` : ''}.
Write a title and the text: 2 or 3 sentences, at most 50 words, of ordinary life in this year and place.`;
  }
  return {
    system: SYSTEM,
    user: `${lifeBlock(life, plan.age)}\n\n${year}\n${guide}\nfact: one new lasting detail worth remembering, or an empty string.`,
    schema: { type: 'object', properties: all, required: Object.keys(all) },
    maxTokens: 1600,
  };
}

export function montagePrompt(life: Life, plan: MontagePlan): Prompt {
  const { props, guide } = recordsSchema(life, 0);
  const all: Record<string, unknown> = { title: str(60), text: str(700), fact: str(90), ...props };
  const toYear = life.birthYear + plan.toAge;
  return {
    system: SYSTEM,
    user: `${lifeBlock(life, plan.age)}

YEARS ${plan.year} TO ${toYear} (ages ${plan.age} to ${plan.toAge}) pass without major events.
Write a montage: a title, and 3 or 4 sentences (at most 80 words) moving through those years: the texture of ordinary life in that time and place, the people around you getting older, small changes. No major events.
${guide}
fact: one new lasting detail worth remembering, or an empty string.`,
    schema: { type: 'object', properties: all, required: Object.keys(all) },
    maxTokens: 1600,
  };
}

export function choicePrompt(life: Life, plan: ChoicePlan): Prompt {
  const n = plan.options.length;
  return {
    system: SYSTEM,
    user: `${lifeBlock(life, plan.age)}

BIG DECISION (age ${plan.age}, year ${plan.year})
Situation: ${plan.situation}
Options, keep this order and meaning:
${plan.options.map((o, i) => `${i + 1}. ${o.gist}`).join('\n')}
Write a title, a text (2 or 3 sentences, at most 60 words, setting up the dilemma in this life with its people and stakes, without revealing outcomes) and one button label per option (at most 7 words each, same order, in the voice of the life).`,
    schema: {
      type: 'object',
      properties: { title: str(60), text: str(420), labels: { type: 'array', items: str(60), minItems: n, maxItems: n } },
      required: ['title', 'text', 'labels'],
    },
    maxTokens: 400,
  };
}

export function birthPrompt(life: Life): Prompt {
  const c = countryByCode(life.birthCountry);
  const family = life.cast.map((p) => `${p.role === 'sibling' ? `older ${p.sex === 'male' ? 'brother' : 'sister'}` : p.role} (${-p.bornAge} years older than you${p.alive ? '' : ', already gone'})`);
  const hard = life.hardStarts.length
    ? `This is a brutal start: ${life.hardStarts.map((h) => (h === 'poverty' ? 'a poor family' : 'a disability from birth')).join(' and ')}. Make that hit hard, with dark humour.`
    : '';
  return {
    system: SYSTEM,
    user: `BIRTH. ${life.birthYear}, ${c.name}, ${life.rural ? 'in a village or the countryside' : 'in a town or city'}.
World: ${worldLine(life, life.birthYear)}.
You: ${life.sex}, ${life.traits.map((t) => TRAITS[t].label).join(' and ')} (it will show later). Family wealth: ${moneyLabel(life.stats.money)}. Home: ${HOME_LABEL[life.home.kind]}.
Family, in this order: ${family.join('; ')}.
${hard}
Write: name (your own first name, the kind of name this family would really give a ${life.sex === 'male' ? 'boy' : 'girl'} in that region, religion, class and year), a title, the birth card (4 or 5 sentences, 60 to 100 words: the year, the place, the family, one telling detail of that era), home (where the family lives, at most 10 words), place (a real town, city or village name in ${c.name}), family (one entry per family member in the order above: a first name fitting the culture and generation, and a short note on who they are: job, temper, one detail, no age), story (the life so far in at most 60 words), threads (0 to 2 seeds that could matter later).`,
    schema: {
      type: 'object',
      properties: {
        name: str(30), title: str(60), text: str(700), home: str(80), place: str(40),
        family: { type: 'array', minItems: life.cast.length, maxItems: life.cast.length, items: { type: 'object', properties: { name: str(40), note: str(90) }, required: ['name', 'note'] } },
        story: str(500), threads: { type: 'array', maxItems: 2, items: str(110) },
      },
      required: ['name', 'title', 'text', 'home', 'place', 'family', 'story', 'threads'],
    },
    maxTokens: 1600,
  };
}

export function epiloguePrompt(life: Life): Prompt {
  const dream = life.dream ? `${DREAMS[life.dream].label} (${dreamCameTrue(life) ? 'it came true' : 'it never came true'})` : 'never had one';
  const timeline = life.history.map((h) => `${h.age}${h.toAge ? `-${h.toAge}` : ''}: ${h.title}`).join('; ');
  return {
    system: SYSTEM,
    user: `${lifeBlock(life, life.age, 3)}

DEATH. You died in ${life.birthYear + life.age}, aged ${life.age}, of ${life.causeOfDeath}. Dream: ${dream}.
Every card title: ${timeline}

Write the ending: headline (a local newspaper headline about this death, at most 12 words), text (the obituary, 80 to 120 words, darkly funny and true to this life: who they were, what they did, who outlived them), legacy (at most 30 words: what was left behind and to whom, what people remember), epitaph (what is carved on the grave, at most 10 words).`,
    schema: {
      type: 'object',
      properties: { headline: str(100), text: str(900), legacy: str(240), epitaph: str(90) },
      required: ['headline', 'text', 'legacy', 'epitaph'],
    },
    maxTokens: 1200,
  };
}
