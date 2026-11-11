import { Rng } from './rng';
import { COUNTRIES, countryByCode } from '../data/world';
import { DREAMS } from '../data/traits';
import { rollYear, respinEvent } from './year';
import { applyYear } from './apply';
import type { ChoiceOption, ChoicePlan, Dream, Life, MontagePlan, YearPlan } from './types';

export { respinEvent };

const MAX_MONTAGE = 4;
const EMPTY = { title: '', text: '', fact: '' };
const inPrison = (l: Life) => l.statuses.some((s) => s.id === 'in_prison');
const choiceDue = (l: Life, age: number) => age >= 13 && age >= l.nextChoiceAge && !inPrison(l);

/**
 * Next thing to play: a decision, a year of events, or a montage of quiet years.
 * Quiet years are looked ahead on a copy of the life, so applying them later replays exactly.
 */
export function planYear(life: Life): YearPlan {
  const age = life.age + 1;
  if (choiceDue(life, age)) {
    const choice = planChoice(life, age);
    if (choice) return choice;
  }
  const first = rollYear(life, age, new Rng(life.rng));
  if (first.events.length || first.world.length) return first;
  const years = [first];
  const sim: Life = structuredClone(life);
  applyYear(sim, first, EMPTY, { quiet: true });
  while (!sim.dead && years.length < MAX_MONTAGE) {
    const nextAge = sim.age + 1;
    if (choiceDue(sim, nextAge)) break;
    const next = rollYear(sim, nextAge, new Rng(sim.rng));
    if (next.events.length || next.world.length) break;
    years.push(next);
    applyYear(sim, next, EMPTY, { quiet: true });
  }
  if (years.length === 1) return first;
  const last = years[years.length - 1];
  const montage: MontagePlan = { kind: 'montage', age: first.age, toAge: last.age, year: first.year, years, rngAfter: last.rngAfter };
  return montage;
}

interface Domain {
  weight: (life: Life, age: number) => number;
  build: (life: Life, rng: Rng) => { situation: string; options: ChoiceOption[] };
}

const has = (l: Life, id: string) => l.statuses.some((s) => s.id === id);
const tierOf = (l: Life) => countryByCode(l.country).tier;
const HIGH_INCOME = COUNTRIES.filter((c) => c.tier === 'high');
const EUROPE = ['IT', 'ES', 'DE', 'FR', 'GB', 'SE'];

// Branch points every 5 to 10 years: they change where, how and with whom the rest of the life happens.
const DOMAINS: Record<string, Domain> = {
  dream: {
    weight: (l, age) => (!l.dream && age >= 13 && age <= 20 ? 30 : 0),
    build: (_l, rng) => {
      const all = Object.keys(DREAMS) as Dream[];
      const picks: Dream[] = [];
      while (picks.length < 4) {
        const d = rng.pick(all);
        if (!picks.includes(d)) picks.push(d);
      }
      return { situation: 'What do you actually want out of this life?', options: picks.map((d) => ({ gist: DREAMS[d].gist, dream: d, deltas: { happiness: 2 } })) };
    },
  },
  partnerAbroad: {
    weight: (l) => (l.partner && l.partner.country !== l.country && l.relationship !== 'single' ? 6 : 0),
    build: (l) => {
      const p = l.partner!;
      const where = countryByCode(p.country).name;
      return {
        situation: `${p.name} wants to move back to ${where}.`,
        options: [
          { gist: `Follow ${p.name} to ${where}`, move: p.country, job: 'none', deltas: { happiness: 6, money: -8 }, remove: ['migrant_worker'], add: ['expat'] },
          { gist: 'Stay and try a long-distance relationship', deltas: { happiness: -4 }, gamble: { stat: 'happiness', amount: 10 } },
          { gist: `Stay and break up with ${p.name}`, dropPartner: true, relationship: l.relationship === 'married' ? 'divorced' : 'single', deltas: { happiness: -12, money: 4 }, remove: ['in_love'] },
        ],
      };
    },
  },
  emigrate: {
    weight: (l, age) => (tierOf(l) !== 'high' && age >= 18 && age <= 50 && !has(l, 'undocumented') ? 2 : 0),
    build: (_l, rng) => {
      const dest = rng.weighted(HIGH_INCOME, (c) => c.births);
      return {
        situation: `A chance to emigrate legally to ${dest.name} comes up.`,
        options: [
          { gist: `Pack everything and move to ${dest.name}`, move: dest.code, job: 'none', add: ['expat'], deltas: { money: -10, happiness: -4 }, momentum: 0.06 },
          { gist: 'Stay home with what you know', deltas: { happiness: 3 } },
        ],
      };
    },
  },
  smuggler: {
    weight: (l, age) => ((tierOf(l) === 'low' || tierOf(l) === 'lowerMid') && age >= 16 && age <= 40 && l.stats.money < 40 && l.country === l.birthCountry ? 1.5 : 0),
    build: (l, rng) => {
      const americas = ['MX', 'HT', 'CO'].includes(l.country);
      const dest = americas ? 'US' : rng.pick(EUROPE);
      const route = americas ? 'a walk through the desert and a hole in a fence' : 'a seat on an overloaded boat across the Mediterranean';
      return {
        situation: `A smuggler offers you ${route}, to ${countryByCode(dest).name}. No papers.`,
        options: [
          { gist: 'Pay the smuggler and go', move: dest, job: 'none', add: ['undocumented'], deltas: { money: -15, happiness: -5 }, momentum: 0.05, death: { odds: americas ? 0.01 : 0.025, cause: americas ? 'the desert crossing' : 'the crossing, at sea' } },
          { gist: 'Stay and take your chances at home', deltas: { happiness: -2 } },
        ],
      };
    },
  },
  education: {
    weight: (l, age) => (age >= 16 && age <= 22 && !has(l, 'student') && !has(l, 'university_degree') && !has(l, 'dropped_out') ? 8 : 0),
    build: () => ({
      situation: 'School is over. What now?',
      options: [
        { gist: 'Go to university', job: 'none', add: ['student'], deltas: { money: -8 }, momentum: 0.06 },
        { gist: 'Start working right away', job: 'auto', deltas: { money: 8, happiness: -3 } },
        { gist: 'Take a year to travel or drift', deltas: { happiness: 10, money: -6 } },
      ],
    }),
  },
  gang: {
    weight: (l, age) => (age >= 13 && age <= 25 && !l.rural && l.stats.money < 30 && !has(l, 'gang_member') ? (l.sex === 'male' ? 2.5 : 0.6) * (countryByCode(l.country).x.homicide > 10 ? 2 : 0.5) : 0),
    build: () => ({
      situation: 'The local gang wants you. They pay, they protect, they own you.',
      options: [
        { gist: 'Join the gang', job: 'crime', add: ['gang_member'], deltas: { money: 8, happiness: 2 } },
        { gist: 'Refuse and keep your head down', deltas: { health: -4, happiness: -3 } },
      ],
    }),
  },
  career: {
    weight: (l, age) => (age >= 23 && age <= 60 && l.job && l.job.sector !== 'business' ? 3 : 0),
    build: () => ({
      situation: 'A risky opportunity lands in your lap.',
      options: [
        { gist: 'Quit and start your own business', job: 'business', add: ['business_owner'], deltas: { happiness: 3 }, gamble: { stat: 'money', amount: 25 } },
        { gist: 'Keep the steady job', deltas: { money: 3, happiness: -2 } },
        { gist: 'Retrain for a completely different career', job: 'auto', deltas: { money: -6, happiness: 6 }, momentum: 0.04 },
      ],
    }),
  },
  whistle: {
    weight: (l, age) => (age >= 22 && age <= 62 && l.job && ['office', 'public', 'professional', 'business'].includes(l.job.sector) ? 1.5 : 0),
    build: () => ({
      situation: 'You find proof that your boss is stealing, a lot.',
      options: [
        { gist: 'Blow the whistle', job: 'none', add: ['scandal'], deltas: { happiness: 4 }, gamble: { stat: 'money', amount: 15 } },
        { gist: 'Say nothing and keep your job', deltas: { happiness: -4 } },
        { gist: 'Ask for a cut', add: ['legal_trouble'], deltas: { money: 12 }, gamble: { stat: 'happiness', amount: 10 } },
      ],
    }),
  },
  caregiver: {
    weight: (l, age) => (age >= 30 && age <= 70 && l.cast.some((p) => p.alive && (p.role === 'mother' || p.role === 'father') && age - p.bornAge >= 75) && !has(l, 'caregiver') ? 4 : 0),
    build: (l) => {
      const parent = l.cast.find((p) => p.alive && (p.role === 'mother' || p.role === 'father') && l.age + 1 - p.bornAge >= 75)!;
      return {
        situation: `Your ${parent.role} ${parent.name} can no longer live alone.`,
        options: [
          { gist: `Take ${parent.name} in and care for them yourself`, add: ['caregiver'], deltas: { money: -4, happiness: -2 } },
          { gist: 'Pay for a care home', deltas: { money: -12, happiness: -3 } },
          { gist: 'Leave it to the rest of the family', add: ['grudge'], deltas: { happiness: -5 } },
        ],
      };
    },
  },
  commit: {
    weight: (l, age) => ((l.relationship === 'dating' || l.relationship === 'engaged') && age >= 18 ? 4 : 0),
    build: (l) => ({
      situation: `Things are getting serious with ${l.partner?.name ?? 'your partner'}.`,
      options: [
        { gist: 'Get married', relationship: 'married', deltas: { happiness: 10, money: -6 } },
        { gist: 'Keep things as they are', deltas: {} },
        { gist: 'End it before it gets heavier', dropPartner: true, relationship: 'single', deltas: { happiness: -8 }, remove: ['in_love'] },
      ],
    }),
  },
  old_flame: {
    weight: (l, age) => (l.relationship === 'married' && age >= 28 && age <= 65 ? 1.5 : 0),
    build: (l) => {
      const ex = l.cast.find((p) => p.alive && p.role === 'ex');
      return {
        situation: ex ? `${ex.name}, your ex, is back in town and still looks at you that way.` : 'An old flame turns up, and the spark is still there.',
        options: [
          { gist: 'Start an affair', deltas: { happiness: 6 }, gamble: { stat: 'happiness', amount: 14 }, add: ['stress'] },
          { gist: 'Shut it down and go home', deltas: { happiness: -2 } },
        ],
      };
    },
  },
  retire: {
    weight: (l, age) => (age >= 60 && age <= 72 && l.job && l.job.sector !== 'crime' ? 6 : 0),
    build: () => ({
      situation: 'Retirement is knocking.',
      options: [
        { gist: 'Retire now and enjoy it', job: 'none', add: ['retired'], deltas: { happiness: 10, money: -5 } },
        { gist: 'Keep working a few more years', deltas: { money: 8, health: -5 } },
      ],
    }),
  },
  lifestyle: {
    weight: (l, age) => (age >= 14 ? (l.stats.health < 50 ? 4 : 1) : 0),
    build: () => ({
      situation: 'Your body sends you a warning.',
      options: [
        { gist: 'Overhaul your lifestyle: diet, exercise, no vices', add: ['fitness'], remove: ['smoker'], deltas: { health: 8, happiness: -4 } },
        { gist: 'Enjoy life and ignore it', deltas: { happiness: 6 }, gamble: { stat: 'health', amount: 12 } },
      ],
    }),
  },
  shady: {
    weight: (_l, age) => (age >= 15 && age <= 45 ? 2 : 0),
    build: () => ({
      situation: 'Someone offers you a shady shortcut to easy money.',
      options: [
        { gist: 'Take the shady deal', deltas: { happiness: 2 }, gamble: { stat: 'money', amount: 20 }, add: ['legal_trouble'] },
        { gist: 'Walk away', deltas: { happiness: -1 } },
      ],
    }),
  },
};

function planChoice(life: Life, age: number): ChoicePlan | null {
  const rng = new Rng(life.rng);
  const options = Object.entries(DOMAINS).filter(([, d]) => d.weight(life, age) > 0);
  if (!options.length) return null;
  const [domain, d] = rng.weighted(options, ([, dd]) => dd.weight(life, age));
  return { kind: 'choice', age, year: life.birthYear + age, domain, ...d.build(life, rng), rngAfter: rng.state };
}
