// More life events, same format as events.ts. Kept apart so the core table stays readable.
// Rates are rough real-world figures (UNICEF, WHO, ILO, UNODC, UNHCR, IOM, Transparency
// International, national surveys), bent by age, sex, wealth, country, era and statuses.
import { A, D, HK, M, R, S, SEC, T, W, bill, inCountry, type Ctx } from '../engine/ctx';
import type { EventDef } from './eventTypes';

// ---- local helpers (no import from './events' to avoid a cycle) ----------------------

/** Where irregular crossings from each origin usually head. */
const CROSSING_ORIGINS = ['NG', 'ET', 'SO', 'AF', 'YE', 'PK', 'BD', 'TD', 'CD', 'EG', 'IR', 'MX', 'HT', 'CO'];
const crossingDest = (c: Ctx) => {
  const code = c.country.code;
  if (['MX', 'HT', 'CO'].includes(code)) return 'US';
  if (['AF', 'PK', 'BD', 'IR', 'YE'].includes(code)) return ['DE', 'GB', 'FR'][c.year % 3];
  return ['IT', 'ES', 'FR'][c.year % 3];
};
/** Skilled emigration: the usual magnets, never your own country. */
const skilledDest = (c: Ctx) => {
  const list = ['US', 'GB', 'DE', 'CA', 'AU', 'AE'].filter((x) => x !== c.country.code);
  return list[c.year % list.length];
};
/** How hard the state comes down on dissent (Freedom House-ish, 0.6 = open democracy). */
const authoritarian = (c: Ctx) =>
  ({ CN: 3, IR: 3, RU: 2.5, EG: 2.5, TR: 2, VN: 2, AF: 2, YE: 1.5, ET: 1.5, AE: 1.5, TD: 1.5, PK: 1.3, SO: 1.2 } as Record<string, number>)[c.country.code] ?? 0.6;
const muslimMajority = (c: Ctx) => inCountry(c, 'PK', 'BD', 'ID', 'EG', 'IR', 'TR', 'NG', 'AF', 'YE', 'SO', 'AE', 'TD');
const violentCountry = (c: Ctx) => c.country.x.homicide / 10 + 0.5;

export const MORE_EVENTS: EventDef[] = [
  // ───────────── Childhood ─────────────
  // Primary enrolment: ~80% in low-income countries, ~99% in rich ones.
  {
    id: 'start_school', title: 'First day of school', cat: 'education', ages: [5, 8], weight: 1, once: true,
    when: (c) => !c.has('dropped_out') && !c.has('child_labour'),
    p: (c) => T(c, 0.45, 0.6, 0.85, 0.95) * W(c, 0.8, 1, 1) * (c.year < 1975 ? 0.8 : 1),
    deltas: { happiness: 2 },
  },
  {
    id: 'first_crush', title: 'First crush', cat: 'love', ages: [9, 15], weight: 1, once: true,
    p: () => 0.15, deltas: { happiness: 4 },
  },
  {
    id: 'school_fight', title: 'Schoolyard fight', cat: 'social', ages: [7, 16], weight: 1, question: 'Who walks away standing?',
    when: (c) => !c.has('dropped_out'),
    p: (c) => 0.04 * M(c, 1.6, 0.6) * S(c, 'bullied', 1.8),
    outcomes: [
      { id: 'win', label: 'you win, and everyone saw', good: true, w: 0.55, deltas: { happiness: 4, health: -2 } },
      { id: 'lose', label: 'you get flattened in front of everyone', good: false, w: 0.45, deltas: { happiness: -5, health: -4 } },
    ],
  },
  // Corporal punishment in schools: still legal or common in much of South Asia and Africa, near-universal anywhere before ~1980.
  {
    id: 'teacher_beating', title: 'The teacher’s cane', cat: 'education', ages: [6, 15], weight: 1,
    when: (c) => !c.has('dropped_out'),
    p: (c) => T(c, 0.08, 0.06, 0.03, 0.005) * (c.year < 1985 ? 2 : 1),
    deltas: { happiness: -5, health: -2 },
  },
  {
    id: 'lost_in_city', title: 'Lost in the crowd', cat: 'accident', ages: [4, 10], weight: 2, once: true, question: 'Will they find you?',
    p: (c) => 0.01 * R(c, 0.5, 1.2),
    outcomes: [
      { id: 'found', label: 'found by evening, with a lecture', good: true, w: 0.85, deltas: { happiness: -2 } },
      { id: 'days', label: 'two nights alone on the streets', good: false, w: 0.15, deltas: { happiness: -6, health: -3 } },
    ],
  },
  // ~1.5%/yr of US teens run away at least overnight; more when home is bad.
  {
    id: 'run_away', title: 'You run away from home', cat: 'family', ages: [11, 17], weight: 2, once: true, question: 'Do you come back?',
    when: (c) => c.free,
    p: (c) => 0.008 * (c.parents < 2 ? 1.5 : 1) * S(c, 'bullied', 1.5) * S(c, 'orphan', 2) * W(c, 1.5, 1, 0.7),
    outcomes: [
      { id: 'home', label: 'back home in a week, grounded forever', good: true, w: 0.75, deltas: { happiness: -2 } },
      { id: 'street', label: 'months on the street', good: false, w: 0.25, deltas: { health: -8, happiness: -8 }, add: ['dropped_out'] },
    ],
  },

  // ───────────── Teens ─────────────
  {
    id: 'big_exam', title: 'The big exam', cat: 'education', ages: [17, 18], weight: 2, once: true, question: 'Do you ace it?',
    when: (c) => !c.has('dropped_out') && !c.has('child_labour') && c.free,
    p: (c) => (inCountry(c, 'CN', 'IN', 'KR', 'JP', 'VN', 'TR', 'IR', 'EG', 'FR') ? 0.55 : 0.35) * W(c, 0.7, 1, 1),
    outcomes: [
      { id: 'ace', label: 'top marks, doors open', good: true, w: 0.25, deltas: { happiness: 10, money: 2 }, add: ['connections'] },
      { id: 'pass', label: 'you scrape through', good: true, w: 0.5, deltas: { happiness: 2 } },
      { id: 'fail', label: 'you fail it', good: false, w: (c) => 0.25 * W(c, 1.4, 1, 0.7), deltas: { happiness: -10 }, add: ['stress'] },
    ],
  },
  // Licensing: ~70% of US 18-year-olds, a few % in poor countries.
  {
    id: 'driving_licence', title: 'Driving licence', cat: 'social', ages: [16, 30], weight: 1, once: true,
    when: (c) => c.free,
    p: (c) => T(c, 0.005, 0.02, 0.08, 0.15) * W(c, 0.3, 1, 1.5) * (c.year < 1970 ? 0.6 : 1),
    deltas: { happiness: 3 },
  },
  {
    id: 'buy_car', title: 'Your own car', cat: 'money', ages: [18, 80], weight: 1,
    when: (c) => c.once('driving_licence') && !c.has('car_owner') && c.free,
    p: (c) => 0.06 * W(c, 0.1, 1, 2) * T(c, 0.3, 0.5, 1, 1.2),
    deltas: { money: -6, happiness: 3 }, add: ['car_owner'],
  },
  {
    id: 'teen_police', title: 'Picked up by the police', cat: 'violence', ages: [13, 19], weight: 2, question: 'Just a warning?', tags: ['arrest'],
    when: (c) => c.free,
    p: (c) => 0.012 * M(c, 2, 0.5) * W(c, 1.6, 1, 0.7) * S(c, 'gang_member', 3) * S(c, 'dropped_out', 1.5),
    outcomes: [
      { id: 'warning', label: 'a warning and a call home', good: true, w: 0.7, deltas: { happiness: -3 } },
      { id: 'record', label: 'a juvenile record', good: false, w: 0.3, deltas: { happiness: -5 }, add: ['criminal_record'] },
    ],
  },
  // Teen part-time work: ~30% of US 16-19s; much less where teens already work full time.
  {
    id: 'part_time_job', title: 'A part-time job', cat: 'work', ages: [14, 19], weight: 1,
    when: (c) => !c.employed && !c.has('dropped_out') && !c.has('child_labour'),
    p: (c) => T(c, 0.02, 0.03, 0.06, 0.12) * W(c, 1.2, 1, 0.4),
    deltas: { money: 3, happiness: 1 },
  },
  {
    id: 'tattoo', title: 'A tattoo', cat: 'social', ages: [15, 60], weight: 1, once: true, question: 'Will you love it forever?',
    p: (c) => 0.006 * T(c, 0.5, 0.6, 1, 1.6) * (c.year < 1990 ? 0.4 : 1) * S(c, 'gang_member', 4) * S(c, 'in_prison', 3),
    outcomes: [
      { id: 'love', label: 'you love it', good: true, w: 0.8, deltas: { happiness: 3 } },
      { id: 'regret', label: 'a spelling mistake, forever', good: false, w: 0.2, deltas: { happiness: -3 } },
    ],
  },

  // ───────────── Work ─────────────
  {
    id: 'hired_big', title: 'The big break', cat: 'work', ages: [20, 55], weight: 2, group: 'job', tags: ['economy'],
    when: (c) => c.employed && c.level < 5 && c.free,
    p: (c) => 0.02 * S(c, 'university_degree', 2.5) * S(c, 'connections', 2) * T(c, 0.3, 0.6, 1, 1.3) / (c.world.mult.economy ?? 1),
    deltas: { money: 10, happiness: 6 }, effect: 'promotion',
  },
  // Gig work boomed after ~2010; ~1 in 3 adults in many countries have some side income.
  {
    id: 'side_hustle', title: 'A side hustle', cat: 'work', ages: [16, 75], weight: 1,
    when: (c) => !c.has('side_hustle') && c.free,
    p: (c) => 0.02 * T(c, 1.3, 1.2, 1, 1) * (c.year >= 2010 ? 1.5 : 1),
    deltas: { money: 3 }, add: ['side_hustle'],
  },
  // ILO: ~1 in 5 workers report harassment at some point; reporting often backfires.
  {
    id: 'harassment', title: 'Harassed at work', cat: 'work', ages: [16, 70], weight: 2, question: 'Does speaking up work?',
    when: (c) => c.employed,
    p: (c) => 0.015 * M(c, 0.4, 1),
    outcomes: [
      { id: 'won', label: 'you speak up and they listen', good: true, w: (c) => T(c, 0.2, 0.25, 0.35, 0.5), deltas: { happiness: 2 } },
      { id: 'fired', label: 'you speak up and lose your job', good: false, w: 0.25, deltas: { happiness: -10, money: -4 }, add: ['unemployed'], effect: 'fired' },
      { id: 'quiet', label: 'you keep quiet and take it', good: false, w: 0.4, deltas: { happiness: -8 }, add: ['stress'] },
    ],
  },
  {
    id: 'strike', title: 'On strike', cat: 'work', ages: [18, 65], weight: 2, question: 'Do the bosses cave?', tags: ['economy'],
    when: (c) => c.employed && ['factory', 'public', 'labour', 'skilled'].includes(c.sector ?? ''),
    p: (c) => 0.02 * T(c, 0.8, 1, 1.2, 1),
    outcomes: [
      { id: 'raise', label: 'a raise for everyone', good: true, w: 0.55, deltas: { money: 5, happiness: 4 } },
      { id: 'sacked', label: 'the ringleaders get sacked, you included', good: false, w: 0.2, deltas: { money: -6, happiness: -8 }, add: ['unemployed'], effect: 'fired' },
      { id: 'nothing', label: 'weeks without pay for nothing', good: false, w: 0.25, deltas: { money: -4, happiness: -3 } },
    ],
  },
  // Only fires during an automation wave (world event); base 2%/yr times the wave's strength.
  {
    id: 'automation_layoff', title: 'Replaced by a machine', cat: 'work', ages: [18, 67], weight: 2, group: 'job',
    when: (c) => c.employed && ['office', 'service', 'factory'].includes(c.sector ?? ''),
    p: (c) => 0.02 * ((c.world.mult.automation ?? 1) - 1),
    deltas: { money: -8, happiness: -8 }, add: ['unemployed'], effect: 'fired',
  },
  {
    id: 'demotion', title: 'Demoted', cat: 'work', ages: [22, 65], weight: 1, group: 'job', tags: ['economy'],
    when: (c) => c.employed && c.level > 1,
    p: (c) => 0.015 * S(c, 'alcoholism', 2) * S(c, 'depression', 1.5),
    deltas: { money: -5, happiness: -6 }, effect: 'demotion',
  },
  {
    id: 'career_change', title: 'A whole new career', cat: 'work', ages: [25, 55], weight: 2, group: 'job',
    when: (c) => c.employed && c.free && c.sector !== 'crime',
    p: () => 0.02, deltas: { money: -3, happiness: 5 }, effect: 'newJob',
  },
  // Gang membership: a few % of young men in high-homicide cities (Central America, Cape Flats, favelas).
  {
    id: 'join_gang', title: 'You join a gang', cat: 'violence', ages: [13, 35], weight: 3, group: 'job', tags: ['violence'],
    when: (c) => !c.has('gang_member') && c.free,
    p: (c) => (0.002 + c.country.x.homicide * 0.0002) * M(c, 2.5, 0.3) * W(c, 2, 0.7, 0.2) * R(c, 0.5, 1.3) * S(c, 'dropped_out', 2) * S(c, 'homeless', 2) * A(c.age, [[13, 1], [18, 1.5], [30, 0.5]]),
    deltas: { money: 6, happiness: 2 }, add: ['gang_member'], effect: 'crimeJob',
  },
  {
    id: 'leave_gang', title: 'Getting out of the gang', cat: 'violence', ages: [15, 70], weight: 3, question: 'Do they let you walk away?', tags: ['violence'],
    when: (c) => c.has('gang_member') && c.free,
    p: (c) => 0.08 * S(c, 'faith', 2) * S(c, 'supportive_family', 1.5) * (c.age > 30 ? 1.5 : 1),
    outcomes: [
      { id: 'walk', label: 'they let you walk away', good: true, w: 0.7, deltas: { happiness: 6, money: -4 }, remove: ['gang_member'], effect: 'fired' },
      { id: 'hunted', label: 'they come after you', good: false, w: 0.25, deltas: { health: -15, happiness: -8 }, remove: ['gang_member'], add: ['on_the_run'], effect: 'fired' },
      { id: 'killed', label: 'they make an example of you', good: false, w: 0.04, death: 'gang reprisal' },
    ],
  },
  {
    id: 'embezzle', title: 'Fingers in the till', cat: 'money', ages: [22, 70], weight: 3, question: 'Will they catch you?', tags: ['arrest'],
    when: (c) => c.employed && c.free && ['office', 'public', 'business', 'professional'].includes(c.sector ?? ''),
    p: (c) => 0.004 * S(c, 'gambling_addiction', 4) * S(c, 'in_debt', 2),
    outcomes: [
      { id: 'clean', label: 'nobody notices', good: true, w: 0.55, deltas: { money: 15, happiness: 3 } },
      { id: 'fired', label: 'caught and sacked', good: false, w: 0.3, deltas: { money: -10, happiness: -10 }, add: ['criminal_record', 'legal_trouble', 'unemployed'], effect: 'fired' },
      { id: 'jailed', label: 'caught and jailed', good: false, w: 0.15, deltas: { money: -10, happiness: -15 }, add: ['criminal_record', 'in_prison'], effect: 'fired' },
    ],
  },
  // Transparency International: ~1 in 4 people paid a bribe for a public service in the past year (Africa, Asia).
  {
    id: 'bribe', title: 'An envelope under the table', cat: 'money', ages: [18, 85], weight: 1, question: 'Does the envelope work?', tags: ['arrest'],
    when: (c) => c.free,
    p: (c) => T(c, 0.06, 0.05, 0.025, 0.005) * SEC(c, { public: 2, business: 2 }),
    outcomes: [
      { id: 'works', label: 'everything moves faster', good: true, w: 0.85, deltas: { money: -3, happiness: 2 } },
      { id: 'sweep', label: 'caught in an anti-corruption sweep', good: false, w: 0.15, deltas: { money: -8, happiness: -6 }, add: ['legal_trouble'] },
    ],
  },
  {
    id: 'loan_shark', title: 'A loan shark', cat: 'money', ages: [18, 80], weight: 2, question: 'Can you pay them back?', tags: ['violence', 'economy'],
    when: (c) => c.free && (c.wealth === 'rags' || c.has('in_debt')),
    p: (c) => 0.015 * W(c, 2, 0.8, 0) * S(c, 'in_debt', 2) * S(c, 'gambling_addiction', 3) * T(c, 1.5, 1.3, 1, 0.6),
    outcomes: [
      { id: 'paid', label: 'you pay, with interest that hurts', good: true, w: 0.6, deltas: { money: -6 } },
      { id: 'fingers', label: 'they break your fingers', good: false, w: 0.25, deltas: { health: -12, money: -5 }, add: ['in_debt'] },
      { id: 'everything', label: 'they take everything you own', good: false, w: 0.15, deltas: { money: -15, happiness: -8 }, effect: 'homeDown' },
    ],
  },
  // Microfinance reached ~140M borrowers, mostly women in South Asia and Africa; many tiny businesses stall.
  {
    id: 'microloan', title: 'A microloan', cat: 'money', ages: [18, 65], weight: 2, question: 'Does the little business work?', tags: ['economy'],
    when: (c) => (c.tier === 'low' || c.tier === 'lowerMid') && c.wealth !== 'wealthy' && c.free && c.year >= 1980,
    p: (c) => 0.02 * W(c, 1.5, 1, 0) * M(c, 0.6, 1.5),
    outcomes: [
      { id: 'thrives', label: 'the stall thrives', good: true, w: 0.55, deltas: { money: 6, happiness: 4 }, add: ['side_hustle'] },
      { id: 'hunger', label: 'you repay it by skipping meals', good: false, w: 0.45, deltas: { money: -4, health: -3 }, add: ['in_debt'] },
    ],
  },
  {
    id: 'crypto', title: 'All in on crypto', cat: 'money', ages: [18, 70], weight: 2, question: 'Moon or crater?', tags: ['economy'],
    when: (c) => c.year >= 2013 && c.money >= 25 && c.free,
    p: (c) => 0.02 * M(c, 1.8, 0.6) * A(c.age, [[18, 1.5], [35, 1], [60, 0.4]]),
    outcomes: [
      { id: 'moon', label: 'to the moon', good: true, w: 0.4, deltas: { money: 12, happiness: 5 } },
      { id: 'crater', label: 'a crater where your savings were', good: false, w: 0.6, deltas: { money: -12, happiness: -6 } },
    ],
  },
  {
    id: 'tax_audit', title: 'Tax audit', cat: 'money', ages: [25, 90], weight: 1, question: 'Are your books clean?',
    when: (c) => (c.employed || c.has('business_owner')) && (c.tier === 'upperMid' || c.tier === 'high'),
    p: (c) => 0.01 * S(c, 'business_owner', 3) * W(c, 0.3, 1, 2),
    outcomes: [
      { id: 'clean', label: 'clean books, wasted weeks', good: true, w: 0.7, deltas: { happiness: -2 } },
      { id: 'fine', label: 'a fat fine', good: false, w: 0.3, deltas: { money: -8, happiness: -4 }, add: ['legal_trouble'] },
    ],
  },
  {
    id: 'house_boom', title: 'Your home doubles in value', cat: 'money', ages: [25, 95], weight: 1,
    when: (c) => c.owned,
    p: (c) => 0.04 / (c.world.mult.economy ?? 1) * T(c, 0.5, 0.8, 1, 1.2), deltas: { money: 8, happiness: 3 },
  },
  {
    id: 'lawsuit', title: 'Sued', cat: 'money', ages: [20, 90], weight: 2, question: 'Does the judge side with you?',
    p: (c) => 0.006 * T(c, 0.5, 0.6, 1, 1.4) * (inCountry(c, 'US') ? 2 : 1) * W(c, 0.6, 1, 2),
    outcomes: [
      { id: 'win', label: 'you win, they pay', good: true, w: 0.5, deltas: { money: 6, happiness: 4 } },
      { id: 'lose', label: 'you lose, you pay', good: false, w: 0.5, deltas: { money: -10, happiness: -6 }, add: ['legal_trouble'] },
    ],
  },
  {
    id: 'found_money', title: 'Money on the pavement', cat: 'luck', ages: [5, 95], weight: 1,
    p: () => 0.006, deltas: { money: 3, happiness: 3 },
  },
  // Problem gambling: ~1-3% of adults, rising with online betting after ~2010.
  {
    id: 'gambling', title: 'Hooked on gambling', cat: 'money', ages: [16, 85], weight: 2,
    when: (c) => !c.has('gambling_addiction'),
    p: (c) => 0.004 * M(c, 2, 0.6) * S(c, 'alcoholism', 2) * (inCountry(c, 'US', 'GB', 'AU') ? 1.5 : muslimMajority(c) ? 0.3 : 1) * (c.year >= 2010 ? 1.4 : 1),
    deltas: { money: -5, happiness: -2 }, add: ['gambling_addiction'],
  },

  // ───────────── Love ─────────────
  // ~30% of couples in rich countries now meet online (post-2010); nearly zero before ~2000.
  {
    id: 'online_match', title: 'A match online', cat: 'love', ages: [18, 75], weight: 2, group: 'love', newPerson: { role: 'partner', sex: 'other' },
    when: (c) => !c.partnered && c.free && c.year >= 2005,
    p: (c) => 0.04 * T(c, 0.3, 0.5, 1, 1.4) * (c.year >= 2012 ? 1.5 : 1),
    deltas: { happiness: 8 }, add: ['in_love'], effect: 'newPartner',
  },
  {
    id: 'catfished', title: 'Catfished', cat: 'love', ages: [16, 85], weight: 1,
    when: (c) => c.year >= 2005,
    p: (c) => 0.008 * A(c.age, [[16, 1], [60, 1.5]]) * S(c, 'loneliness', 2),
    deltas: { money: -6, happiness: -8 },
  },
  {
    id: 'partner_ill', title: 'Your partner falls ill', cat: 'family', ages: [18, 100], weight: 2, question: 'Will they pull through?', aboutPartner: true,
    when: (c) => c.partnered,
    p: (c) => A(c.partnerAge, [[20, 0.005], [50, 0.02], [70, 0.05], [85, 0.08]]),
    outcomes: [
      { id: 'recovers', label: 'they recover', good: true, w: (c) => 0.5 + 0.3 * c.care, deltas: (c) => ({ happiness: -4, money: bill(c, 4) }) },
      { id: 'long', label: 'a long illness you nurse them through', good: false, w: 0.4, deltas: (c) => ({ happiness: -10, money: bill(c, 8) }), add: ['stress'] },
    ],
  },
  // Multigenerational homes: the norm across South Asia and Africa, rare in rich countries.
  {
    id: 'in_laws', title: 'The in-laws move in', cat: 'family', ages: [20, 70], weight: 1, aboutPartner: true,
    when: (c) => c.relationship === 'married',
    p: (c) => 0.02 * T(c, 2, 1.6, 1, 0.5), deltas: { happiness: -5 }, add: ['stress'],
  },
  {
    id: 'elopement', title: 'You elope', cat: 'love', ages: [16, 40], weight: 2, group: 'love', aboutPartner: true,
    when: (c) => c.relationship === 'dating',
    p: (c) => 0.02 * T(c, 1.5, 1.5, 1, 0.6) * (inCountry(c, 'IN', 'PK', 'BD', 'AF') ? 2 : 1),
    deltas: { happiness: 10 }, add: ['grudge'], effect: 'married',
  },
  // Polygyny: legal and fairly common in the Sahel, Somalia, northern Nigeria, Afghanistan, Yemen.
  {
    id: 'co_wife', title: 'Your husband takes a second wife', cat: 'love', ages: [20, 60], weight: 2, aboutPartner: true,
    when: (c) => c.sex === 'female' && c.relationship === 'married' && inCountry(c, 'NG', 'TD', 'SO', 'AF', 'YE'),
    p: (c) => 0.012 * W(c, 0.7, 1, 1.5),
    deltas: { happiness: -10 }, add: ['stress'],
  },
  // ~10-15% of couples face infertility.
  {
    id: 'infertility', title: 'No baby comes', cat: 'family', ages: [22, 45], weight: 2,
    when: (c) => c.partnered && c.kids === 0 && !c.has('infertile'),
    p: () => 0.025, deltas: { happiness: -10 }, add: ['infertile'],
  },

  // ───────────── Your kids, parents and siblings ─────────────
  {
    id: 'kid_sick', title: 'Your child falls ill', cat: 'family', ages: [16, 90], weight: 2, question: 'Will they recover?',
    target: (c) => c.people('child').filter((s) => s.age <= 15).map((s) => ({ ...s, w: 0.03 * T(c, 2, 1.5, 1, 0.7) })),
    p: () => 1,
    outcomes: [
      { id: 'recovers', label: 'they bounce back', good: true, w: (c) => 0.7 + 0.2 * c.care, deltas: (c) => ({ happiness: -3, money: bill(c, 3) }) },
      { id: 'hospital', label: 'weeks in hospital', good: false, w: 0.25, deltas: (c) => ({ happiness: -8, money: bill(c, 8) }), add: ['stress'] },
    ],
  },
  {
    id: 'kid_trouble', title: 'Your child in trouble with the law', cat: 'family', ages: [28, 90], weight: 2, question: 'Can you get them out of it?', tags: ['arrest'],
    target: (c) => c.people('child').filter((s) => s.age >= 13 && s.age <= 25).map((s) => ({ ...s, w: 0.015 * W(c, 1.5, 1, 0.8) * S(c, 'alcoholism', 1.5) })),
    p: () => 1,
    outcomes: [
      { id: 'off', label: 'they get off with a warning', good: true, w: (c) => W(c, 0.4, 0.6, 0.8), deltas: { happiness: -3, money: -3 } },
      { id: 'record', label: 'a record that follows them', good: false, w: 0.4, deltas: { happiness: -8, money: -5 } },
    ],
  },
  {
    id: 'kid_graduates', title: 'Your child graduates', cat: 'family', ages: [36, 95], weight: 1,
    target: (c) => c.people('child').filter((s) => s.age >= 21 && s.age <= 26).map((s) => ({ ...s, w: 0.06 * W(c, 0.3, 1, 1.8) * T(c, 0.4, 0.6, 1, 1.3) })),
    p: () => 1, deltas: { happiness: 8 },
  },
  {
    id: 'kid_marries', title: 'Your child gets married', cat: 'family', ages: [34, 100], weight: 1,
    target: (c) => c.people('child').filter((s) => s.age >= 18 && s.age <= 40).map((s) => ({ ...s, w: 0.06 })),
    p: () => 1, deltas: (c) => ({ happiness: 6, money: -4 * W(c, 0.5, 1, 1.5) }),
  },
  // Emigration of grown children: very common from the Philippines, India, Nigeria, Mexico.
  {
    id: 'kid_emigrates', title: 'Your child emigrates', cat: 'family', ages: [36, 100], weight: 1,
    target: (c) => c.people('child').filter((s) => s.age >= 18 && s.age <= 40).map((s) => ({ ...s, w: 0.01 * T(c, 2, 2, 1.2, 0.6) })),
    p: () => 1, deltas: (c) => ({ happiness: -6, money: c.tier === 'low' || c.tier === 'lowerMid' ? 3 : 0 }), add: ['loneliness'],
  },
  {
    id: 'caregiver', title: 'Caring for a sick parent', cat: 'family', ages: [25, 80], weight: 2,
    when: (c) => !c.has('caregiver') && c.free,
    target: (c) => c.people('mother', 'father').filter((s) => s.age >= 65).map((s) => ({ ...s, w: A(s.age, [[65, 0.01], [80, 0.04], [90, 0.08]]) * M(c, 0.6, 1.4) })),
    p: () => 1, deltas: { happiness: -4, money: -2 }, add: ['caregiver'],
  },
  {
    id: 'sibling_loan', title: 'A sibling needs money', cat: 'family', ages: [18, 90], weight: 1, question: 'Will they pay you back?',
    target: (c) => c.people('sibling').filter((s) => s.age >= 18).map((s) => ({ ...s, w: 0.012 })),
    p: () => 1,
    outcomes: [
      { id: 'repaid', label: 'they pay you back, eventually', good: true, w: 0.4, deltas: { happiness: 2 } },
      { id: 'gone', label: 'you never see that money again', good: false, w: 0.6, deltas: { money: -6, happiness: -3 }, add: ['grudge'] },
    ],
  },
  // Nursing-home use: ~4% of over-65s in rich countries, far higher with dementia; rare where families care at home.
  {
    id: 'nursing_home', title: 'Into a care home', cat: 'family', ages: [75, 100], weight: 2, once: true,
    p: (c) => 0.03 * T(c, 0.1, 0.2, 0.6, 1.2) * S(c, 'dementia', 3) * (c.kids === 0 ? 1.5 : 1),
    deltas: { happiness: -6, money: -5 }, add: ['loneliness'],
  },
  {
    id: 'centenarian', title: 'Ninety-nine and counting', cat: 'luck', ages: [99, 100], weight: 2, once: true,
    p: () => 1, deltas: { happiness: 10 },
  },
  {
    id: 'outlived', title: 'Everyone else is gone', cat: 'social', ages: [85, 100], weight: 1,
    when: (c) => c.people('friend', 'sibling').length === 0 && !c.partnered && !c.has('loneliness'),
    p: () => 0.1, deltas: { happiness: -6 }, add: ['loneliness'],
  },

  // ───────────── New faces ─────────────
  {
    id: 'new_rival', title: 'An enemy is made', cat: 'social', ages: [8, 80], weight: 1, newPerson: { role: 'rival', sex: 'any' },
    when: (c) => c.free && c.people('rival').length === 0,
    p: () => 0.04, deltas: { happiness: -3 }, add: ['grudge'], effect: 'newPerson',
  },
  {
    id: 'new_mentor', title: 'Someone takes you under their wing', cat: 'social', ages: [12, 50], weight: 1, newPerson: { role: 'mentor', sex: 'any' },
    when: (c) => c.free && c.people('mentor').length === 0,
    p: (c) => 0.025 * S(c, 'talented', 1.5) * S(c, 'student', 1.5), deltas: { happiness: 4 }, add: ['connections'], effect: 'newPerson',
  },
  {
    id: 'new_boss', title: 'A new boss', cat: 'work', ages: [16, 65], weight: 1, question: 'Decent human or tyrant?', newPerson: { role: 'boss', sex: 'any' },
    when: (c) => c.employed && c.people('boss').length === 0 && c.sector !== 'business',
    p: () => 0.06, effect: 'newPerson',
    outcomes: [
      { id: 'decent', label: 'a decent human being', good: true, w: 0.65, deltas: { happiness: 3 } },
      { id: 'tyrant', label: 'a small tyrant', good: false, w: 0.35, deltas: { happiness: -6 }, add: ['stress'] },
    ],
  },

  // ───────────── Health ─────────────
  // Arthritis: ~20% of adults over 60, more in women and manual workers.
  {
    id: 'arthritis', title: 'Arthritis', cat: 'health', ages: [40, 100], weight: 1,
    when: (c) => !c.has('arthritis'),
    p: (c) => A(c.age, [[40, 0.003], [60, 0.012], [75, 0.02]]) * S(c, 'obese', 1.8) * SEC(c, { labour: 1.4, farming: 1.4 }) * M(c, 0.7, 1.3),
    deltas: { health: -3, happiness: -2 }, add: ['arthritis'],
  },
  // Chronic kidney disease: ~10% prevalence, driven by diabetes and blood pressure.
  {
    id: 'kidney_disease', title: 'Your kidneys are failing', cat: 'health', ages: [30, 100], weight: 2,
    when: (c) => !c.has('kidney_disease'),
    p: (c) => A(c.age, [[30, 0.0005], [60, 0.003], [75, 0.006]]) * S(c, 'diabetes', 4) * S(c, 'hypertension', 2.5) * T(c, 1.5, 1.3, 1, 1),
    deltas: (c) => ({ health: -8, money: bill(c, 6) }), add: ['kidney_disease'],
  },
  // Hep B is endemic in China and Vietnam, hep C in Egypt and Pakistan; injecting drugs multiplies it.
  {
    id: 'hepatitis', title: 'Hepatitis', cat: 'health', ages: [5, 90], weight: 2, tags: ['infection'],
    when: (c) => !c.has('hepatitis'),
    p: (c) => T(c, 0.003, 0.002, 0.0008, 0.0002) * S(c, 'drug_addiction', 8) * (inCountry(c, 'EG') ? 3 : inCountry(c, 'CN', 'PK', 'VN') ? 2 : 1),
    deltas: { health: -6, happiness: -4 }, add: ['hepatitis'],
  },
  {
    id: 'parkinsons', title: 'A tremor that will not stop', cat: 'health', ages: [50, 100], weight: 3,
    when: (c) => !c.has('parkinsons'),
    p: (c) => A(c.age, [[50, 0.0002], [65, 0.001], [80, 0.003]]) * M(c, 1.4, 0.8),
    deltas: { happiness: -8, health: -4 }, add: ['parkinsons'],
  },
  // Cataract blindness is mostly untreated cataracts in poor countries.
  {
    id: 'failing_sight', title: 'The world goes blurry', cat: 'health', ages: [45, 100], weight: 1,
    when: (c) => !c.has('failing_sight'),
    p: (c) => A(c.age, [[45, 0.003], [65, 0.015], [80, 0.03]]) * S(c, 'diabetes', 2) * T(c, 2, 1.6, 1, 0.6),
    deltas: { happiness: -4 }, add: ['failing_sight'],
  },
  {
    id: 'hearing_loss', title: 'Going deaf', cat: 'health', ages: [50, 100], weight: 1,
    when: (c) => !c.has('hearing_loss'),
    p: (c) => A(c.age, [[50, 0.003], [70, 0.02], [85, 0.04]]) * SEC(c, { factory: 2, labour: 1.5, military: 2 }) * S(c, 'veteran', 1.5),
    deltas: { happiness: -3 }, add: ['hearing_loss'],
  },
  // Post-viral syndromes: a few % after serious infections, spiking in pandemics.
  {
    id: 'lingering_illness', title: 'An illness that will not leave', cat: 'health', ages: [5, 100], weight: 1, tags: ['infection'],
    when: (c) => !c.has('lingering_illness'),
    p: () => 0.004, deltas: { health: -5, happiness: -3 }, add: ['lingering_illness'],
  },
  {
    id: 'cosmetic_surgery', title: 'Under the knife, by choice', cat: 'health', ages: [20, 75], weight: 1, question: 'Happy with the result?',
    when: (c) => c.wealth === 'wealthy' && c.free,
    p: (c) => 0.01 * M(c, 0.4, 1.6) * (inCountry(c, 'KR', 'BR', 'US', 'IR') ? 2.5 : 1) * (c.year < 1980 ? 0.3 : 1),
    outcomes: [
      { id: 'younger', label: 'ten years younger', good: true, w: 0.8, deltas: { happiness: 6, money: -6 } },
      { id: 'botched', label: 'botched', good: false, w: 0.2, deltas: { happiness: -8, money: -8, health: -3 } },
    ],
  },
  {
    id: 'dental_disaster', title: 'Toothache from hell', cat: 'health', ages: [10, 100], weight: 1,
    when: (c) => c.wealth === 'rags',
    p: (c) => 0.03 * T(c, 1.5, 1.3, 1, 0.8), deltas: { health: -3, happiness: -4 },
  },
  // Diagnostic error affects ~5% of outpatient visits in the US; worse where doctors are scarce.
  {
    id: 'misdiagnosis', title: 'The wrong diagnosis', cat: 'health', ages: [10, 100], weight: 2, question: 'Does anyone catch the mistake?',
    p: (c) => 0.006 * T(c, 2, 1.6, 1.1, 0.8) * W(c, 1.3, 1, 0.7),
    outcomes: [
      { id: 'caught', label: 'a second opinion saves you', good: true, w: (c) => 0.4 + 0.4 * c.care, deltas: (c) => ({ money: bill(c, 3) }) },
      { id: 'months', label: 'months of the wrong treatment', good: false, w: 0.4, deltas: (c) => ({ health: -10, money: bill(c, 5) }) },
    ],
  },
  {
    id: 'near_death', title: 'A near-death experience', cat: 'health', ages: [10, 100], weight: 2,
    p: (c) => 0.002 * D(c), deltas: { health: -8, happiness: 4 }, add: ['faith'],
  },
  {
    id: 'breakdown', title: 'Breakdown', cat: 'health', ages: [16, 85], weight: 2, question: 'Do you get help in time?',
    p: (c) => 0.004 * S(c, 'stress', 3) * S(c, 'depression', 3) * S(c, 'grieving', 1.5) * S(c, 'insomnia', 1.5),
    outcomes: [
      { id: 'help', label: 'therapy, rest, a way back', good: true, w: (c) => 0.3 + 0.5 * c.care, deltas: (c) => ({ happiness: -4, money: bill(c, 3) }), remove: ['stress'] },
      { id: 'years', label: 'it takes years to climb out', good: false, w: 0.5, deltas: { happiness: -12 }, add: ['depression'] },
    ],
  },
  // Chronic insomnia: ~10% of adults, more with stress and age.
  {
    id: 'insomnia', title: 'Sleep stops coming', cat: 'health', ages: [16, 100], weight: 1,
    when: (c) => !c.has('insomnia'),
    p: (c) => 0.015 * S(c, 'stress', 2) * S(c, 'depression', 2) * A(c.age, [[16, 0.6], [40, 1], [70, 1.5]]),
    deltas: { happiness: -3 }, add: ['insomnia'],
  },
  // PTSD: roughly 10-30% of people exposed to war or displacement.
  {
    id: 'ptsd', title: 'The war comes home with you', cat: 'health', ages: [12, 100], weight: 2,
    when: (c) => !c.has('ptsd') && (c.has('veteran') || c.has('displaced') || c.has('refugee')),
    p: (c) => 0.08 * S(c, 'veteran', 1.5) * S(c, 'supportive_family', 0.6),
    deltas: { happiness: -8 }, add: ['ptsd'],
  },
  {
    id: 'air_pollution', title: 'The smog season', cat: 'health', ages: [0, 100], weight: 1, question: 'Do your lungs shrug it off?',
    when: (c) => inCountry(c, 'IN', 'CN', 'PK', 'BD', 'EG', 'NG') && !c.rural,
    p: (c) => 0.03 * A(c.age, [[0, 1.5], [10, 1], [60, 1.5]]) * (c.year >= 1995 ? 1.3 : 1),
    outcomes: [
      { id: 'cough', label: 'a winter of coughing', good: true, w: 0.92, deltas: { health: -2 } },
      { id: 'lungs', label: 'your lungs never recover', good: false, w: 0.08, deltas: { health: -6 }, add: ['lung_disease'] },
    ],
  },

  // ───────────── Accidents and disasters ─────────────
  // Two-wheelers are 40-60% of road deaths in South-East and South Asia (WHO).
  {
    id: 'motorbike_crash', title: 'Motorbike crash', cat: 'accident', ages: [14, 75], weight: 3, question: 'Helmet or no helmet?',
    when: (c) => inCountry(c, 'VN', 'TH', 'ID', 'IN', 'PH', 'PK', 'BD', 'NG', 'BR', 'CO'),
    p: (c) => 0.006 * M(c, 1.6, 0.6) * A(c.age, [[14, 1], [20, 1.6], [35, 1], [60, 0.7]]) * S(c, 'alcoholism', 2),
    outcomes: [
      { id: 'bruises', label: 'gravel rash and a dented pride', good: true, w: 0.72, deltas: { health: -4 } },
      { id: 'serious', label: 'a smashed leg', good: false, w: 0.25, deltas: (c) => ({ health: -20, money: bill(c, 5) }), add: ['injury'] },
      { id: 'dies', label: 'no helmet', good: false, w: (c) => 0.02 * D(c), death: 'a motorbike crash' },
    ],
  },
  // Rana Plaza (2013) killed 1,134; unsafe buildings and factories collapse every year in South Asia.
  {
    id: 'building_collapse', title: 'The building comes down', cat: 'accident', ages: [8, 90], weight: 3, question: 'Do they dig you out?',
    when: (c) => inCountry(c, 'BD', 'IN', 'PK', 'NG', 'EG', 'HT', 'KE'),
    p: (c) => 0.001 * SEC(c, { factory: 3, labour: 2 }) * HK(c, { slum: 2 }),
    outcomes: [
      { id: 'dug', label: 'they dig you out alive', good: true, w: 0.6, deltas: { health: -10, happiness: -8 } },
      { id: 'crushed', label: 'crushed legs', good: false, w: 0.25, deltas: { health: -25, happiness: -12 }, add: ['disability'] },
      { id: 'dies', label: 'buried in the rubble', good: false, w: 0.15, death: 'a building collapse' },
    ],
  },
  {
    id: 'train_accident', title: 'Train crash', cat: 'accident', ages: [5, 90], weight: 3, question: 'Which carriage were you in?',
    when: (c) => inCountry(c, 'IN', 'PK', 'BD', 'EG', 'CN'),
    p: (c) => 0.0006 * R(c, 0.8, 1.2),
    outcomes: [
      { id: 'walk', label: 'you walk away shaking', good: true, w: 0.7, deltas: { happiness: -4 } },
      { id: 'hurt', label: 'pinned in the wreck', good: false, w: 0.25, deltas: { health: -15 }, add: ['injury'] },
      { id: 'dies', label: 'the wrong carriage', good: false, w: 0.05, death: 'a train crash' },
    ],
  },
  // Overloaded ferries sink every year in Bangladesh, the Philippines, Indonesia, Congo, Tanzania.
  {
    id: 'boat_capsized', title: 'The ferry capsizes', cat: 'accident', ages: [3, 90], weight: 3, question: 'Can you swim?',
    when: (c) => inCountry(c, 'BD', 'PH', 'ID', 'CD', 'TZ', 'NG', 'HT', 'VN'),
    p: (c) => 0.0008 * R(c, 1.5, 0.6) * W(c, 1.5, 1, 0.3),
    outcomes: [
      { id: 'shore', label: 'you swim to shore', good: true, w: 0.65, deltas: { happiness: -5, money: -3 } },
      { id: 'half', label: 'pulled out half-drowned', good: false, w: 0.2, deltas: { health: -8, happiness: -6 } },
      { id: 'dies', label: 'the river keeps you', good: false, w: 0.15, death: 'a capsized ferry' },
    ],
  },
  {
    id: 'landslide', title: 'Landslide', cat: 'disaster', ages: [0, 100], weight: 3, question: 'Does the hill hold?', tags: ['flood'],
    when: (c) => inCountry(c, 'PH', 'ID', 'CN', 'CO', 'BR', 'IN', 'ET', 'KE', 'HT', 'JP'),
    p: (c) => 0.0006 * R(c, 1.6, 0.7) * HK(c, { slum: 2 }) * c.world.climate,
    outcomes: [
      { id: 'stops', label: 'it stops at your door', good: true, w: 0.75, deltas: { happiness: -4 } },
      { id: 'buried', label: 'your home is buried, you are not', good: false, w: 0.2, deltas: { money: -15, happiness: -10 }, effect: 'loseHome' },
      { id: 'dies', label: 'the mud takes you', good: false, w: 0.05, death: 'a landslide' },
    ],
  },
  {
    id: 'volcano', title: 'The volcano wakes up', cat: 'disaster', ages: [0, 100], weight: 3, question: 'How far does the ash reach?',
    when: (c) => inCountry(c, 'ID', 'PH', 'JP', 'IT', 'CO', 'MX'),
    p: (c) => (inCountry(c, 'ID', 'PH') ? 0.0006 : 0.0002),
    outcomes: [
      { id: 'evacuated', label: 'evacuated in time', good: true, w: 0.8, deltas: { money: -4, happiness: -3 } },
      { id: 'ash', label: 'your home under a metre of ash', good: false, w: 0.19, deltas: { money: -15, happiness: -8 }, add: ['displaced'], effect: 'loseHome' },
      { id: 'dies', label: 'the pyroclastic flow', good: false, w: 0.01, death: 'a volcanic eruption' },
    ],
  },
  // Wildfire seasons are getting longer with every degree of warming.
  {
    id: 'wildfire', title: 'Wildfire', cat: 'disaster', ages: [0, 100], weight: 3, question: 'Does the wind turn?', tags: ['heat'],
    when: (c) => inCountry(c, 'AU', 'US', 'CA', 'ES', 'TR', 'BR'),
    p: (c) => 0.002 * c.world.climate * R(c, 2, 0.5),
    outcomes: [
      { id: 'smoke', label: 'smoke, fear, and the wind turns', good: true, w: 0.8, deltas: { money: -2, happiness: -3 } },
      { id: 'burns', label: 'your home burns', good: false, w: 0.19, deltas: { money: -15, happiness: -10 }, effect: 'loseHome' },
      { id: 'dies', label: 'trapped on the road out', good: false, w: 0.005, death: 'a wildfire' },
    ],
  },
  {
    id: 'road_rage', title: 'Road rage', cat: 'violence', ages: [17, 85], weight: 2, question: 'How far does it go?', tags: ['violence'],
    when: (c) => !c.rural && c.free,
    p: (c) => 0.005 * M(c, 1.8, 0.6) * S(c, 'car_owner', 2),
    outcomes: [
      { id: 'shout', label: 'a shouting match and a dented door', good: true, w: 0.8, deltas: { happiness: -2 } },
      { id: 'fists', label: 'fists on the hard shoulder', good: false, w: 0.18, deltas: { health: -8 }, add: ['legal_trouble'] },
      { id: 'shot', label: 'he had a gun', good: false, w: (c) => 0.003 * violentCountry(c) * (inCountry(c, 'US') ? 3 : 1), death: 'road rage' },
    ],
  },

  // ───────────── Migration ─────────────
  // IOM: ~1-2% of Mediterranean crossers die; deserts and the Darién are worse.
  {
    id: 'border_crossing', title: 'A crossing by night', cat: 'disaster', ages: [16, 45], weight: 3, group: 'home', question: 'Do you make it across?', moveTo: crossingDest,
    when: (c) => !c.abroad && c.free && CROSSING_ORIGINS.includes(c.country.code),
    p: (c) => 0.004 * W(c, 1.5, 1, 0.2) * (c.conflict >= 2 ? 4 : 1) * M(c, 2, 0.6) * A(c.age, [[16, 1], [25, 1.5], [45, 0.5]]) * (c.year >= 1990 ? 1 : 0.3),
    effect: 'emigrate',
    outcomes: [
      { id: 'across', label: 'you make it across, with no papers', good: true, w: (c) => (c.conflict >= 2 ? 0.25 : 0.65), deltas: { money: -10, happiness: 5 }, add: ['undocumented'] },
      { id: 'asylum', label: 'you make it and claim asylum', good: true, w: (c) => (c.conflict >= 2 ? 0.5 : 0.1), deltas: { money: -10, happiness: 3 }, add: ['refugee'] },
      { id: 'caught', label: 'caught and sent back with nothing', good: false, w: 0.2, deltas: { money: -12, happiness: -10 }, effect: 'deported' },
      { id: 'dies', label: 'the sea, or the desert, keeps you', good: false, w: 0.025, death: 'a border crossing' },
    ],
  },
  {
    id: 'deportation', title: 'Immigration raid', cat: 'violence', ages: [16, 90], weight: 3, question: 'Can a lawyer stop it?', tags: ['arrest'],
    when: (c) => c.has('undocumented') && c.abroad,
    p: (c) => 0.04 * (inCountry(c, 'US') ? 1.5 : 1) * S(c, 'criminal_record', 3),
    outcomes: [
      { id: 'lawyer', label: 'a lawyer buys you time', good: true, w: 0.55, deltas: { money: -6, happiness: -4 } },
      { id: 'deported', label: 'deported', good: false, w: 0.45, deltas: { happiness: -15, money: -10 }, remove: ['undocumented'], effect: 'deported' },
    ],
  },
  {
    id: 'asylum_granted', title: 'Papers at last', cat: 'luck', ages: [10, 90], weight: 2,
    when: (c) => (c.has('undocumented') || c.has('refugee')) && c.abroad,
    p: (c) => 0.12 * (c.has('refugee') ? 1.5 : 0.6),
    deltas: { happiness: 10 }, remove: ['undocumented', 'refugee'],
  },
  // UNHCR: displacement camps hold millions in Somalia, Congo, Ethiopia, Yemen, Afghanistan.
  {
    id: 'refugee_camp', title: 'The camp', cat: 'disaster', ages: [0, 95], weight: 2,
    when: (c) => c.has('displaced') && !c.has('refugee') && c.conflict >= 2,
    p: () => 0.15, deltas: { health: -4, happiness: -6 }, add: ['refugee'],
  },
  {
    id: 'xenophobic_attack', title: 'Go back where you came from', cat: 'violence', ages: [10, 90], weight: 2, question: 'Do you get away?', tags: ['violence'],
    when: (c) => c.abroad,
    p: (c) => 0.006 * (inCountry(c, 'ZA') ? 4 : 1) * S(c, 'undocumented', 1.5),
    outcomes: [
      { id: 'shaken', label: 'shaken, not hurt', good: true, w: 0.8, deltas: { happiness: -5 } },
      { id: 'beaten', label: 'badly beaten', good: false, w: 0.18, deltas: { health: -15, happiness: -8 }, add: ['injury'] },
      { id: 'dies', label: 'the mob does not stop', good: false, w: (c) => (inCountry(c, 'ZA') ? 0.03 : 0.005), death: 'a xenophobic mob' },
    ],
  },
  // Brain drain: ~1 in 9 tertiary-educated Africans and ~1 in 20 Indians live in rich countries.
  {
    id: 'work_abroad', title: 'A job offer abroad', cat: 'work', ages: [22, 45], weight: 3, group: 'job', moveTo: skilledDest,
    when: (c) => c.has('university_degree') && !c.abroad && c.free,
    p: (c) => 0.012 * T(c, 2, 2, 1.3, 0.6) * (c.year >= 1970 ? 1 : 0.5),
    deltas: { money: 8, happiness: 2 }, add: ['expat'], effect: 'emigrate',
  },

  // ───────────── Crime and the law ─────────────
  {
    id: 'witness_crime', title: 'You saw everything', cat: 'violence', ages: [10, 90], weight: 1, question: 'Do you testify?', tags: ['violence'],
    p: (c) => 0.01 * violentCountry(c),
    outcomes: [
      { id: 'justice', label: 'justice is done', good: true, w: 0.6, deltas: { happiness: 3 } },
      { id: 'talked', label: 'they find out who talked', good: false, w: 0.4, deltas: { health: -6, happiness: -8 }, add: ['grudge'] },
    ],
  },
  {
    id: 'extortion', title: 'Protection money', cat: 'violence', ages: [18, 90], weight: 2, question: 'Do you pay?', tags: ['violence'],
    when: (c) => c.has('business_owner') || c.sector === 'street' || c.sector === 'business',
    p: (c) => 0.03 * (c.country.x.homicide > 10 ? 2 : 1) * T(c, 1.3, 1.2, 1, 0.3),
    outcomes: [
      { id: 'pay', label: 'you pay and they leave you alone', good: true, w: 0.75, deltas: { money: -6, happiness: -3 } },
      { id: 'refuse', label: 'you refuse; the shop burns', good: false, w: 0.25, deltas: { money: -15, health: -5, happiness: -8 } },
    ],
  },
  {
    id: 'blackmail', title: 'Blackmailed', cat: 'violence', ages: [18, 90], weight: 2, question: 'Pay or be exposed?',
    when: (c) => c.has('scandal') || c.has('criminal_record') || c.has('famous'),
    p: (c) => 0.01 * S(c, 'scandal', 4) * S(c, 'famous', 2),
    outcomes: [
      { id: 'pay', label: 'you pay, and it stays buried', good: true, w: 0.55, deltas: { money: -8 } },
      { id: 'exposed', label: 'everyone finds out', good: false, w: 0.45, deltas: { happiness: -10 }, add: ['scandal'] },
    ],
  },
  {
    id: 'carjacking', title: 'Carjacked', cat: 'violence', ages: [18, 90], weight: 3, question: 'Do you hand over the keys?', tags: ['violence'],
    when: (c) => c.has('car_owner') && inCountry(c, 'ZA', 'BR', 'MX', 'CO', 'NG', 'HT'),
    p: (c) => 0.006 * (c.country.x.homicide / 20),
    outcomes: [
      { id: 'keys', label: 'they take the car, not you', good: true, w: 0.8, deltas: { money: -8, happiness: -6 }, remove: ['car_owner'] },
      { id: 'shot', label: 'shot in the arm', good: false, w: 0.15, deltas: { health: -20, money: -8 }, add: ['injury'], remove: ['car_owner'] },
      { id: 'dies', label: 'you hesitated', good: false, w: 0.05, death: 'a carjacking' },
    ],
  },
  // Exoneration studies put wrongful convictions at a few % of prison populations.
  {
    id: 'wrongful_conviction', title: 'Convicted of something you did not do', cat: 'violence', ages: [16, 80], weight: 3, tags: ['arrest'],
    when: (c) => c.free,
    p: (c) => 0.0004 * W(c, 2, 1, 0.3) * T(c, 1.5, 1.3, 1, 0.8) * (inCountry(c, 'US') ? 2 : 1),
    deltas: { happiness: -20 }, add: ['in_prison', 'criminal_record'], effect: 'fired',
  },
  {
    id: 'prison_riot', title: 'Prison riot', cat: 'violence', ages: [16, 95], weight: 3, question: 'Do you stay out of it?', tags: ['violence'],
    when: (c) => c.has('in_prison'),
    p: (c) => 0.05 * T(c, 1.8, 1.5, 1.2, 0.6) * (inCountry(c, 'BR', 'MX', 'PH', 'HT') ? 2 : 1),
    outcomes: [
      { id: 'hide', label: 'you hide in your cell', good: true, w: 0.75, deltas: { health: -2 } },
      { id: 'stabbed', label: 'stabbed in the chaos', good: false, w: 0.22, deltas: { health: -18 }, add: ['injury'] },
      { id: 'dies', label: 'killed in the chaos', good: false, w: 0.03, death: 'a prison riot' },
    ],
  },
  {
    id: 'early_release', title: 'Out early', cat: 'violence', ages: [16, 100], weight: 2,
    when: (c) => c.has('in_prison'),
    p: (c) => 0.12 * T(c, 0.6, 0.8, 1, 1.3) * S(c, 'faith', 1.3),
    deltas: { happiness: 12 }, remove: ['in_prison'],
  },
  {
    id: 'protest_arrest', title: 'Arrested at a protest', cat: 'violence', ages: [16, 80], weight: 3, question: 'How long will they hold you?', tags: ['arrest'],
    when: (c) => c.free,
    p: (c) => 0.003 * authoritarian(c) * A(c.age, [[16, 1], [25, 1.5], [50, 0.5]]) * (c.has('university_degree') || c.student ? 1.8 : 1),
    outcomes: [
      { id: 'night', label: 'a night in a cell', good: true, w: 0.6, deltas: { happiness: -3 } },
      { id: 'beaten', label: 'beaten in custody', good: false, w: 0.3, deltas: { health: -12, happiness: -6 }, add: ['criminal_record'] },
      { id: 'years', label: 'years in prison', good: false, w: (c) => 0.05 * authoritarian(c), deltas: { happiness: -15 }, add: ['in_prison', 'criminal_record'], effect: 'fired' },
    ],
  },

  // ───────────── Luck, fame and belonging ─────────────
  {
    id: 'tv_game_show', title: 'On a TV game show', cat: 'luck', ages: [18, 85], weight: 2, question: 'Take the money or the box?',
    when: (c) => c.year >= 1960,
    p: (c) => 0.0015 * T(c, 0.3, 0.5, 1, 1.3),
    outcomes: [
      { id: 'win', label: 'you walk off with the money', good: true, w: 0.5, deltas: { money: 10, happiness: 6 } },
      { id: 'humiliated', label: 'humiliated on national TV', good: false, w: 0.5, deltas: { happiness: -6 }, add: ['scandal'] },
    ],
  },
  {
    id: 'meet_celebrity', title: 'A brush with fame', cat: 'luck', ages: [8, 90], weight: 1,
    p: (c) => 0.008 * R(c, 0.5, 1.3), deltas: { happiness: 4 },
  },
  {
    id: 'join_cult', title: 'The group that has all the answers', cat: 'social', ages: [16, 70], weight: 2, question: 'Do you get out?',
    when: (c) => c.free,
    p: (c) => 0.0015 * S(c, 'loneliness', 3) * S(c, 'depression', 2) * S(c, 'grieving', 2),
    outcomes: [
      { id: 'out', label: 'you see through it within a year', good: true, w: 0.6, deltas: { money: -5, happiness: -2 } },
      { id: 'years', label: 'they take years and your savings', good: false, w: 0.4, deltas: { money: -15, happiness: -8 }, add: ['grudge'] },
    ],
  },
  {
    id: 'conversion', title: 'A new religion', cat: 'social', ages: [14, 90], weight: 1,
    when: (c) => !c.has('faith'),
    p: () => 0.003, deltas: { happiness: 3 }, add: ['faith', 'community'],
  },
  {
    id: 'community_leader', title: 'People start coming to you', cat: 'social', ages: [30, 90], weight: 1,
    when: (c) => !c.has('community') && c.free,
    p: (c) => 0.008 * S(c, 'faith', 2) * R(c, 1.5, 0.8) * S(c, 'famous', 1.5), deltas: { happiness: 5 }, add: ['community', 'connections'],
  },
  // Hajj alone draws ~2M a year; Kumbh Mela tens of millions.
  {
    id: 'pilgrimage', title: 'Pilgrimage', cat: 'social', ages: [18, 90], weight: 2, once: true,
    when: (c) => c.free,
    p: (c) => 0.006 * S(c, 'faith', 4) * (muslimMajority(c) ? 1.5 : inCountry(c, 'IN') ? 1.2 : 0.6) * W(c, 0.3, 1, 1.5),
    deltas: { happiness: 8, money: -5 }, add: ['community'],
  },
  {
    id: 'invention', title: 'You invent something', cat: 'work', ages: [16, 80], weight: 3, question: 'Does anyone buy it?',
    p: (c) => 0.0008 * S(c, 'talented', 3) * S(c, 'university_degree', 2),
    outcomes: [
      { id: 'sells', label: 'it sells', good: true, w: 0.4, deltas: { money: 20, happiness: 10 }, add: ['connections'] },
      { id: 'stolen', label: 'someone bigger steals it', good: false, w: 0.6, deltas: { happiness: -6 }, add: ['grudge'] },
    ],
  },
  {
    id: 'sports_glory', title: 'The final', cat: 'social', ages: [12, 35], weight: 3, question: 'Do you win it?',
    when: (c) => c.has('fitness') || c.has('talented'),
    p: (c) => 0.002 * S(c, 'fitness', 3) * S(c, 'talented', 2),
    outcomes: [
      { id: 'win', label: 'you win it all', good: true, w: 0.4, deltas: { happiness: 12, money: 6 }, add: ['famous'] },
      { id: 'lose', label: 'you lose the final', good: false, w: 0.6, deltas: { happiness: -5 } },
    ],
  },
  {
    id: 'model_scout', title: 'Scouted on the street', cat: 'luck', ages: [14, 30], weight: 2, once: true, question: 'Real agency or a scam?',
    when: (c) => c.year >= 1960 && !c.rural,
    p: () => 0.002,
    outcomes: [
      { id: 'contract', label: 'a real contract', good: true, w: 0.45, deltas: { money: 10, happiness: 6 }, add: ['influencer'] },
      { id: 'scam', label: 'a scam with a nice logo', good: false, w: 0.55, deltas: { money: -5, happiness: -6 } },
    ],
  },
  {
    id: 'stand_up', title: 'Open mic night', cat: 'social', ages: [16, 60], weight: 2, once: true, question: 'Do they laugh?',
    when: (c) => c.free && !c.rural,
    p: (c) => 0.002 * S(c, 'talented', 2) * T(c, 0.3, 0.6, 1, 1.2),
    outcomes: [
      { id: 'laugh', label: 'they love you', good: true, w: 0.45, deltas: { happiness: 8, money: 3 }, add: ['hobby'] },
      { id: 'silence', label: 'silence, then one cough', good: false, w: 0.55, deltas: { happiness: -6 } },
    ],
  },
  {
    id: 'run_for_office', title: 'You run for office', cat: 'social', ages: [25, 75], weight: 3, once: true, question: 'Do you win the vote?',
    when: (c) => c.free && !c.has('politician') && !c.has('criminal_record'),
    p: (c) => 0.002 * S(c, 'community', 4) * S(c, 'connections', 2) * S(c, 'university_degree', 1.5),
    outcomes: [
      { id: 'win', label: 'you win', good: true, w: 0.45, deltas: { happiness: 8, money: 4 }, add: ['politician', 'connections'] },
      { id: 'lose', label: 'you lose, publicly', good: false, w: 0.55, deltas: { happiness: -6, money: -5 } },
    ],
  },
];
