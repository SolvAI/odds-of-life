// The life-event table. Every event rolls its own yearly probability; several can
// fire in one year. Base rates are rough real-world figures (WHO, UNODC, UNICEF,
// GBD), bent by age, sex, wealth, health, country, traits, statuses and world events.
// Outcome branches carry the odds the gauge spins on.
import { A, D, H, HK, M, R, S, SEC, T, W, bill, deathOdds, inCountry, type Ctx } from '../engine/ctx';
import type { Category } from '../engine/types';
import type { EventDef } from './eventTypes';
import { MORE_EVENTS } from './events_more';

export type { EventDef, OutcomeDef, Tag } from './eventTypes';

// Country flavour helpers
export const alcohol = (c: Ctx) =>
  inCountry(c, 'PK', 'AF', 'YE', 'SO', 'IR', 'EG', 'BD', 'ID') ? 0.15 : inCountry(c, 'TR', 'AE') ? 0.4 : inCountry(c, 'RU') ? 2.5 : inCountry(c, 'KR') ? 1.5 : 1;
export const drugs = (c: Ctx) =>
  ({ US: 4, CA: 2, GB: 2, AU: 1.5, IR: 2, AF: 3, ZA: 1.5, MX: 1.3 } as Record<string, number>)[c.country.code] ?? 1;
export const arranged = (c: Ctx) =>
  ({ IN: 1, PK: 1.2, BD: 1, AF: 1.5, YE: 1.3, SO: 1, TD: 0.8, EG: 0.5, IR: 0.4, NG: 0.4, ET: 0.3 } as Record<string, number>)[c.country.code] ?? 0;
export const tropical = (c: Ctx) => c.country.x.malaria > 0 || inCountry(c, 'VN', 'TH', 'BR', 'MX', 'CO', 'PH', 'ID', 'IN', 'BD');
const femaleSmoking = (c: Ctx) => T(c, 0.1, 0.1, 0.25, 0.75);
export const lvl = (n: number, table: number[]) => table[n] ?? 0;
/** Where money says you should live: 0 street .. 5 mansion. */
export const homeTarget = (c: Ctx) => (c.money < 8 ? 1 : c.money < 25 ? 2 : c.money < 50 ? 3 : c.money < 80 ? 4 : 5);

const CORE: EventDef[] = [
  // ───────────── Health: infections ─────────────
  {
    id: 'flu', title: 'Nasty flu', cat: 'health', ages: [0, 100], weight: 1, tags: ['infection'],
    p: (c) => 0.05 * H(c),
    outcomes: [
      { id: 'bed', label: 'a miserable week in bed', good: true, w: 1, deltas: { health: -2 } },
      { id: 'complications', label: 'it turns into something worse', good: false, w: (c) => A(c.age, [[0, 0.06], [5, 0.01], [60, 0.02], [80, 0.08]]) * H(c), deltas: { health: -10 } },
      { id: 'dies', label: 'it kills you', good: false, w: (c) => A(c.age, [[0, 0.003], [5, 0.0002], [65, 0.001], [85, 0.01]]) * D(c), death: 'the flu' },
    ],
  },
  {
    id: 'pneumonia', title: 'Pneumonia', cat: 'health', ages: [0, 100], weight: 3, question: 'Will your lungs pull through?', tags: ['infection'],
    p: (c) => A(c.age, [[0, 0.03], [5, 0.006], [50, 0.005], [65, 0.012], [80, 0.03]]) * T(c, 1.8, 1.4, 1.1, 1) * H(c) * S(c, 'smoker', 1.5) * S(c, 'malnourished', 2) * S(c, 'hiv', 2) * HK(c, { street: 2, slum: 1.4 }),
    outcomes: [
      { id: 'recover', label: 'you recover', good: true, w: 1, deltas: (c) => ({ health: -6, money: bill(c, 3) }) },
      { id: 'long', label: 'months of recovery', good: false, w: 0.25, deltas: (c) => ({ health: -15, money: bill(c, 5) }) },
      { id: 'dies', label: 'you die', good: false, w: (c) => A(c.age, [[0, 0.05], [5, 0.015], [50, 0.03], [70, 0.08], [85, 0.15]]) * D(c), death: 'pneumonia' },
    ],
  },
  {
    id: 'malaria', title: 'Malaria', cat: 'health', ages: [0, 100], weight: 2, question: 'Will the fever break?', tags: ['infection'],
    p: (c) => lvl(c.country.x.malaria, [0, 0.01, 0.06, 0.2]) * A(c.age, [[0, 1.5], [5, 1], [15, 0.6]]) * W(c, 1.3, 1, 0.5) * R(c, 1.4, 0.7),
    outcomes: [
      { id: 'recover', label: 'the fever breaks', good: true, w: 1, deltas: { health: -5 } },
      { id: 'severe', label: 'severe malaria', good: false, w: 0.08, deltas: { health: -15 } },
      { id: 'dies', label: 'you die', good: false, w: (c) => A(c.age, [[0, 0.012], [5, 0.005], [15, 0.002]]) * D(c), death: 'malaria' },
    ],
  },
  {
    id: 'diarrhoea', title: 'Severe diarrhoea', cat: 'health', ages: [0, 6], weight: 2, question: 'Will you stay hydrated?', tags: ['infection'],
    p: (c) => T(c, 0.12, 0.08, 0.03, 0.01) * W(c, 1.5, 1, 0.4) * HK(c, { street: 1.8, slum: 1.5 }),
    outcomes: [
      { id: 'recover', label: 'you pull through', good: true, w: 1, deltas: { health: -4 } },
      { id: 'dehydrated', label: 'badly dehydrated', good: false, w: 0.1, deltas: { health: -10 } },
      { id: 'dies', label: 'you die', good: false, w: (c) => 0.012 * D(c) * A(c.age, [[0, 1.5], [3, 0.6]]), death: 'diarrhoea' },
    ],
  },
  {
    id: 'measles', title: 'Measles', cat: 'health', ages: [0, 12], weight: 2, question: 'Will the measles pass?', tags: ['infection'],
    p: (c) => T(c, 0.02, 0.01, 0.002, 0.0003) * W(c, 1.5, 1, 0.3),
    outcomes: [
      { id: 'recover', label: 'spots, then nothing', good: true, w: 1, deltas: { health: -4 } },
      { id: 'complications', label: 'complications', good: false, w: 0.1, deltas: { health: -12 } },
      { id: 'dies', label: 'you die', good: false, w: (c) => 0.02 * D(c), death: 'measles' },
    ],
  },
  {
    id: 'tb', title: 'Tuberculosis', cat: 'health', ages: [10, 100], weight: 3, question: 'Can you get treatment in time?', tags: ['infection'],
    p: (c) => T(c, 0.003, 0.002, 0.0006, 0.00005) * (inCountry(c, 'ZA') ? 3 : 1) * W(c, 1.8, 1, 0.4) * S(c, 'hiv', 10) * S(c, 'malnourished', 2) * S(c, 'smoker', 1.5) * S(c, 'homeless', 3) * S(c, 'in_prison', 3) * HK(c, { slum: 1.5 }),
    outcomes: [
      { id: 'cured', label: 'six months of pills, cured', good: true, w: (c) => c.care, deltas: { health: -10 } },
      { id: 'scarred', label: 'cured, lungs scarred', good: false, w: 0.3, deltas: { health: -15 }, add: ['lung_disease'] },
      { id: 'dies', label: 'it kills you', good: false, w: (c) => 0.4 * (1 - c.care) + 0.03, death: 'tuberculosis' },
    ],
  },
  {
    id: 'hiv_infection', title: 'HIV positive', cat: 'health', ages: [15, 65], weight: 3, tags: ['hiv'],
    when: (c) => !c.has('hiv'),
    p: (c) => c.country.x.hiv * 0.0003 * A(c.age, [[15, 1], [25, 1.3], [40, 0.7], [55, 0.3]]) * S(c, 'drug_addiction', 5) * M(c, 0.8, 1.3),
    deltas: { happiness: -15 }, add: ['hiv'],
  },
  {
    id: 'dengue', title: 'Dengue fever', cat: 'health', ages: [0, 100], weight: 1, tags: ['infection'],
    when: tropical,
    p: () => 0.01,
    outcomes: [
      { id: 'recover', label: 'bone-breaking fever, then recovery', good: true, w: 1, deltas: { health: -5 } },
      { id: 'severe', label: 'severe dengue', good: false, w: 0.05, deltas: { health: -12 } },
      { id: 'dies', label: 'you die', good: false, w: (c) => 0.003 * D(c), death: 'dengue' },
    ],
  },
  {
    id: 'cholera', title: 'Cholera', cat: 'health', ages: [0, 100], weight: 2, question: 'Clean water and a drip, in time?', tags: ['infection'],
    when: (c) => inCountry(c, 'YE', 'HT', 'SO', 'CD', 'NG', 'ET', 'TD'),
    p: (c) => 0.004 * W(c, 2, 1, 0.2) * HK(c, { street: 2, slum: 1.6 }),
    outcomes: [
      { id: 'recover', label: 'you survive it', good: true, w: 1, deltas: { health: -8 } },
      { id: 'dies', label: 'you die', good: false, w: (c) => 0.03 * D(c), death: 'cholera' },
    ],
  },
  {
    id: 'snakebite', title: 'Snakebite', cat: 'accident', ages: [3, 90], weight: 2, question: 'Antivenom in time?',
    when: (c) => inCountry(c, 'IN', 'NG', 'BD', 'PK', 'CD', 'TZ', 'KE', 'ET', 'TD', 'SO', 'BR'),
    p: (c) => 0.0006 * W(c, 2, 1, 0.2) * R(c, 2, 0.3) * SEC(c, { farming: 2 }),
    outcomes: [
      { id: 'fine', label: 'antivenom in time', good: true, w: (c) => c.care + 0.2, deltas: { health: -5 } },
      { id: 'limb', label: 'you keep your life, not the use of your leg', good: false, w: 0.1, deltas: { health: -15 }, add: ['disability'] },
      { id: 'dies', label: 'you die', good: false, w: (c) => 0.06 * D(c), death: 'a snakebite' },
    ],
  },
  {
    id: 'dog_bite', title: 'Bitten by a stray dog', cat: 'accident', ages: [2, 90], weight: 2, question: 'Rabies shots in time?',
    when: (c) => c.tier !== 'high',
    p: (c) => (inCountry(c, 'IN') ? 0.006 : 0.002) * W(c, 1.5, 1, 0.4),
    outcomes: [
      { id: 'shots', label: 'shots in time', good: true, w: (c) => c.care + 0.1, deltas: { health: -2 } },
      { id: 'rabies', label: 'rabies', good: false, w: (c) => 0.004 * (1 - c.care), death: 'rabies' },
    ],
  },
  {
    id: 'food_poisoning', title: 'Food poisoning', cat: 'health', ages: [2, 100], weight: 1,
    p: (c) => 0.03 * T(c, 1.5, 1.3, 1, 0.8), deltas: { health: -3 },
  },

  // ───────────── Health: chronic and deadly ─────────────
  {
    id: 'cancer', title: 'Cancer diagnosis', cat: 'health', ages: [0, 100], weight: 3, question: 'Caught early enough?',
    when: (c) => !c.has('cancer'),
    p: (c) => A(c.age, [[0, 0.0002], [20, 0.0003], [30, 0.0006], [40, 0.0015], [50, 0.004], [60, 0.008], [70, 0.014], [80, 0.02]]) * S(c, 'smoker', 1.7) * S(c, 'obese', 1.3) * S(c, 'alcoholism', 1.3) * (c.sex === 'male' && c.age > 60 ? 1.2 : 1),
    outcomes: [
      { id: 'early', label: 'caught early', good: true, w: (c) => 0.25 + 0.5 * c.care, deltas: (c) => ({ health: -10, happiness: -10, money: bill(c, 8) }), add: ['cancer'] },
      { id: 'advanced', label: 'already advanced', good: false, w: (c) => 0.15 + 0.5 * (1 - c.care), deltas: (c) => ({ health: -20, happiness: -15, money: bill(c, 10) }), add: ['cancer'] },
    ],
  },
  {
    id: 'cancer_fight', title: 'Fighting cancer', cat: 'health', ages: [0, 100], weight: 3, question: 'Does the treatment work?',
    when: (c) => c.has('cancer'),
    p: () => 1,
    outcomes: [
      { id: 'remission', label: 'remission', good: true, w: (c) => 0.25 + 0.35 * c.care, deltas: { happiness: 15 }, remove: ['cancer'], add: ['cancer_survivor'] },
      { id: 'fighting', label: 'still fighting', good: false, w: 0.4, deltas: (c) => ({ health: -10, money: bill(c, 10) }) },
      { id: 'dies', label: 'it wins', good: false, w: (c) => 0.15 + 0.4 * (1 - c.care), death: 'cancer' },
    ],
  },
  {
    id: 'heart_attack', title: 'Heart attack', cat: 'health', ages: [30, 100], weight: 3, question: 'Will your heart restart?',
    p: (c) => A(c.age, [[30, 0.0003], [40, 0.0012], [50, 0.003], [60, 0.006], [70, 0.011], [80, 0.02], [90, 0.035]]) * M(c, 1.6, 0.7) * S(c, 'smoker', 2) * S(c, 'hypertension', 1.8) * S(c, 'diabetes', 1.8) * S(c, 'obese', 1.4) * S(c, 'heart_disease', 2.5) * S(c, 'fitness', 0.7) * S(c, 'stress', 1.3),
    outcomes: [
      { id: 'recover', label: 'stents and a second chance', good: true, w: 0.6, deltas: (c) => ({ health: -10, money: bill(c, 10) }), add: ['heart_disease'] },
      { id: 'weakened', label: 'you survive, badly weakened', good: false, w: 0.25, deltas: (c) => ({ health: -25, money: bill(c, 10) }), add: ['heart_disease'] },
      { id: 'dies', label: 'it kills you', good: false, w: (c) => (0.12 + 0.3 * (1 - c.care) + A(c.age, [[40, 0], [80, 0.1]])), death: 'a heart attack' },
    ],
  },
  {
    id: 'stroke', title: 'Stroke', cat: 'health', ages: [35, 100], weight: 3, question: 'Will you come back from it?',
    p: (c) => A(c.age, [[35, 0.0003], [50, 0.0012], [60, 0.003], [70, 0.007], [80, 0.015], [90, 0.025]]) * S(c, 'hypertension', 2.5) * S(c, 'smoker', 1.8) * S(c, 'diabetes', 1.6) * S(c, 'obese', 1.3) * T(c, 1.4, 1.3, 1.2, 1),
    outcomes: [
      { id: 'recover', label: 'full recovery', good: true, w: (c) => 0.35 + 0.2 * c.care, deltas: (c) => ({ health: -8, money: bill(c, 6) }) },
      { id: 'damage', label: 'lasting damage', good: false, w: 0.4, deltas: (c) => ({ health: -20, happiness: -10, money: bill(c, 8) }), add: ['stroke_damage'] },
      { id: 'dies', label: 'it kills you', good: false, w: (c) => 0.15 + 0.2 * (1 - c.care), death: 'a stroke' },
    ],
  },
  {
    id: 'diabetes', title: 'Diagnosed with diabetes', cat: 'health', ages: [25, 100], weight: 2,
    when: (c) => !c.has('diabetes'),
    p: (c) => A(c.age, [[25, 0.001], [40, 0.004], [55, 0.008], [70, 0.009]]) * S(c, 'obese', 3) * T(c, 0.8, 1.2, 1.3, 1) * W(c, 0.7, 1, 1.1),
    deltas: { health: -5, happiness: -3 }, add: ['diabetes'],
  },
  {
    id: 'hypertension', title: 'High blood pressure', cat: 'health', ages: [30, 100], weight: 1,
    when: (c) => !c.has('hypertension'),
    p: (c) => A(c.age, [[30, 0.006], [50, 0.02], [70, 0.03]]) * S(c, 'obese', 1.8) * S(c, 'alcoholism', 1.5) * S(c, 'stress', 1.3),
    deltas: { health: -2 }, add: ['hypertension'],
  },
  {
    id: 'dementia', title: 'Dementia', cat: 'health', ages: [60, 100], weight: 3,
    when: (c) => !c.has('dementia'),
    p: (c) => A(c.age, [[60, 0.001], [70, 0.005], [80, 0.02], [90, 0.05]]) * S(c, 'stroke_damage', 2) * S(c, 'alcoholism', 1.5) * S(c, 'diabetes', 1.3),
    deltas: { happiness: -10 }, add: ['dementia'],
  },
  {
    id: 'appendicitis', title: 'Appendicitis', cat: 'health', ages: [5, 50], weight: 2, question: 'Surgery in time?',
    p: () => 0.0012,
    outcomes: [
      { id: 'surgery', label: 'out it comes', good: true, w: (c) => c.care + 0.05, deltas: (c) => ({ health: -5, money: bill(c, 4) }) },
      { id: 'burst', label: 'it bursts', good: false, w: 0.1, deltas: (c) => ({ health: -15, money: bill(c, 6) }) },
      { id: 'dies', label: 'you die', good: false, w: (c) => 0.06 * (1 - c.care), death: 'a burst appendix' },
    ],
  },
  {
    id: 'kidney_stone', title: 'Kidney stone', cat: 'health', ages: [25, 75], weight: 1,
    p: () => 0.003, deltas: (c) => ({ health: -4, money: bill(c, 2) }),
  },
  {
    id: 'back_pain', title: 'Your back gives out', cat: 'health', ages: [25, 85], weight: 1,
    when: (c) => !c.has('chronic_pain'),
    p: (c) => 0.015 * SEC(c, { labour: 2, farming: 1.8, factory: 1.5, domestic: 1.4, office: 0.8 }) * S(c, 'obese', 1.5),
    deltas: { health: -3, happiness: -3 }, add: ['chronic_pain'],
  },
  {
    id: 'malnutrition', title: 'Not enough to eat', cat: 'health', ages: [0, 14], weight: 2, tags: ['famine'],
    when: (c) => !c.has('malnourished'),
    p: (c) => T(c, 0.05, 0.03, 0.006, 0.001) * W(c, 1.6, 0.6, 0.05) * (c.country.x.drought >= 2 ? 1.5 : 1),
    deltas: { health: -8 }, add: ['malnourished'],
  },
  {
    id: 'burnout', title: 'Burnout', cat: 'health', ages: [22, 65], weight: 1,
    when: (c) => c.employed,
    p: (c) => 0.015 * T(c, 0.6, 0.8, 1.2, 1.5) * S(c, 'stress', 2) * SEC(c, { professional: 1.6, office: 1.3, business: 1.4 }),
    deltas: { happiness: -8, health: -4 }, add: ['stress'],
  },
  {
    id: 'depression', title: 'Depression', cat: 'health', ages: [12, 100], weight: 2,
    when: (c) => !c.has('depression'),
    p: (c) => Math.min(0.06, 0.006 * S(c, 'grieving', 2.5) * S(c, 'unemployed', 2) * S(c, 'in_debt', 1.6) * S(c, 'loneliness', 2) * S(c, 'abusive_partner', 3) * S(c, 'alcoholism', 2) * S(c, 'homeless', 2) * S(c, 'bullied', 2) * S(c, 'chronic_pain', 1.5) * S(c, 'ptsd', 2) * S(c, 'supportive_family', 0.7) * S(c, 'in_love', 0.6) * (c.happiness < 30 ? 2 : c.happiness > 70 ? 0.5 : 1) * M(c, 0.7, 1.3)),
    deltas: { happiness: -12 }, add: ['depression'],
  },

  // ───────────── Health: habits ─────────────
  {
    id: 'start_smoking', title: 'You start smoking', cat: 'health', ages: [12, 30], weight: 1,
    when: (c) => !c.has('smoker'),
    p: (c) => (c.country.x.smoking / 100) * (c.sex === 'male' ? 1 : femaleSmoking(c)) * 0.12 * A(c.age, [[12, 0.6], [16, 1.3], [22, 1], [30, 0.3]]) * (c.year < 1990 ? 1.6 : 1),
    deltas: { happiness: 2 }, add: ['smoker'],
  },
  {
    id: 'quit_smoking', title: 'You quit smoking', cat: 'health', ages: [18, 100], weight: 1,
    when: (c) => c.has('smoker'),
    p: (c) => 0.04 * T(c, 0.6, 0.8, 1, 1.5) * (c.has('heart_disease') || c.has('lung_disease') || c.has('cancer') ? 3 : 1),
    deltas: { health: 3 }, remove: ['smoker'],
  },
  {
    id: 'obesity', title: 'The weight piles on', cat: 'health', ages: [10, 80], weight: 1,
    when: (c) => !c.has('obese'),
    p: (c) => (c.country.x.obesity / 100) * 0.04 * W(c, 0.6, 1, 1.1) * S(c, 'depression', 1.4) * S(c, 'fitness', 0.3) * SEC(c, { office: 1.3 }),
    deltas: { health: -3, happiness: -2 }, add: ['obese'],
  },
  {
    id: 'lose_weight', title: 'You lose the weight', cat: 'health', ages: [14, 85], weight: 1,
    when: (c) => c.has('obese'),
    p: (c) => 0.05 * S(c, 'fitness', 3),
    deltas: { health: 5, happiness: 5 }, remove: ['obese'],
  },
  {
    id: 'get_fit', title: 'You get into shape', cat: 'health', ages: [14, 75], weight: 1,
    when: (c) => !c.has('fitness'),
    p: (c) => T(c, 0.01, 0.015, 0.03, 0.05) * W(c, 0.5, 1, 1.6) * (c.happiness > 50 ? 1.3 : 0.8),
    deltas: { health: 4, happiness: 3 }, add: ['fitness'],
  },
  {
    id: 'alcoholism', title: 'Drinking gets out of hand', cat: 'health', ages: [15, 80], weight: 2,
    when: (c) => !c.has('alcoholism'),
    p: (c) => 0.006 * M(c, 2, 0.6) * alcohol(c) * S(c, 'depression', 2.5) * S(c, 'unemployed', 1.5) * S(c, 'grieving', 1.5) * S(c, 'ptsd', 2),
    deltas: { happiness: -4 }, add: ['alcoholism'],
  },
  {
    id: 'drugs', title: 'Hooked on drugs', cat: 'health', ages: [14, 60], weight: 3, tags: ['drugs'],
    when: (c) => !c.has('drug_addiction'),
    p: (c) => 0.002 * drugs(c) * S(c, 'depression', 2) * S(c, 'homeless', 3) * S(c, 'gang_member', 3) * W(c, 1.5, 1, 1.2) * A(c.age, [[14, 1], [20, 1.5], [35, 1], [50, 0.4]]),
    deltas: { happiness: -5, money: -5 }, add: ['drug_addiction'],
  },
  {
    id: 'recovery', title: 'You get clean', cat: 'health', ages: [16, 90], weight: 2,
    when: (c) => c.has('alcoholism') || c.has('drug_addiction') || c.has('gambling_addiction'),
    p: (c) => 0.08 * S(c, 'supportive_family', 1.5) * S(c, 'faith', 1.3) * W(c, 0.7, 1, 1.5),
    deltas: { happiness: 10, health: 5 }, remove: ['alcoholism', 'drug_addiction', 'gambling_addiction'],
  },

  // ───────────── Accidents ─────────────
  {
    id: 'road_accident', title: 'Road accident', cat: 'accident', ages: [3, 100], weight: 3, question: 'Do you walk away?',
    p: (c) => c.country.x.road * 0.00025 * M(c, 1.5, 0.7) * A(c.age, [[3, 0.5], [15, 1.2], [20, 1.6], [30, 1.1], [60, 0.9], [75, 1.2]]) * S(c, 'alcoholism', 2) * S(c, 'drug_addiction', 1.5) * S(c, 'car_owner', 1.3) * (c.year < 1990 && c.tier === 'high' ? 2.5 : 1),
    outcomes: [
      { id: 'bruises', label: 'you walk away with bruises', good: true, w: 0.7, deltas: { health: -3 } },
      { id: 'serious', label: 'serious injuries', good: false, w: 0.22, deltas: (c) => ({ health: -20, money: bill(c, 6) }), add: ['injury'] },
      { id: 'disabled', label: 'you never walk the same again', good: false, w: 0.03, deltas: (c) => ({ health: -25, happiness: -15, money: bill(c, 8) }), add: ['disability'] },
      { id: 'dies', label: 'you die at the scene', good: false, w: (c) => 0.04 * D(c), death: 'a road accident' },
    ],
  },
  {
    id: 'drowning', title: 'Swept under the water', cat: 'accident', ages: [1, 90], weight: 3, question: 'Does someone pull you out?', tags: ['flood'],
    p: (c) => T(c, 0.0002, 0.00015, 0.00008, 0.00004) * A(c.age, [[1, 2.5], [5, 1], [15, 1.3], [30, 0.7]]) * (c.country.x.flood >= 2 ? 1.3 : 1) * M(c, 1.8, 0.6) * S(c, 'alcoholism', 2) * R(c, 1.5, 0.8),
    outcomes: [
      { id: 'rescued', label: 'pulled out coughing', good: true, w: 0.6, deltas: { health: -4 } },
      { id: 'dies', label: 'you drown', good: false, w: 0.4, death: 'drowning' },
    ],
  },
  {
    id: 'fall', title: 'A bad fall', cat: 'accident', ages: [65, 100], weight: 2, question: 'Does the hip hold?',
    p: (c) => A(c.age, [[65, 0.03], [80, 0.07], [90, 0.12]]) * S(c, 'dementia', 2) * S(c, 'alcoholism', 1.5) * S(c, 'failing_sight', 1.6),
    outcomes: [
      { id: 'bruised', label: 'bruised pride', good: true, w: 0.8, deltas: { health: -3 } },
      { id: 'hip', label: 'broken hip', good: false, w: 0.15, deltas: (c) => ({ health: -20, money: bill(c, 6) }), add: ['injury'] },
      { id: 'dies', label: 'you never get up', good: false, w: (c) => 0.03 * D(c), death: 'a fall' },
    ],
  },
  {
    id: 'broken_bone', title: 'Broken bone', cat: 'accident', ages: [3, 64], weight: 1,
    p: (c) => A(c.age, [[3, 0.02], [12, 0.025], [25, 0.01], [50, 0.008]]) * S(c, 'fitness', 1.3),
    outcomes: [
      { id: 'heals', label: 'it heals', good: true, w: 1, deltas: (c) => ({ health: -4, money: bill(c, 2) }) },
      { id: 'badly', label: 'it heals crooked', good: false, w: (c) => 0.1 + 0.3 * (1 - c.care), deltas: { health: -8 }, add: ['chronic_pain'] },
    ],
  },
  {
    id: 'house_fire', title: 'House fire', cat: 'accident', ages: [0, 100], weight: 3, question: 'Do you get out in time?',
    p: (c) => T(c, 0.004, 0.003, 0.0015, 0.0008) * W(c, 1.8, 1, 0.6) * S(c, 'smoker', 1.5) * S(c, 'alcoholism', 1.5) * HK(c, { slum: 2, street: 0.5 }),
    outcomes: [
      { id: 'escape', label: 'you get out, the house does not', good: true, w: 0.75, deltas: { money: -8, happiness: -5 }, effect: 'loseHome' },
      { id: 'burned', label: 'badly burned', good: false, w: 0.2, deltas: (c) => ({ health: -18, money: -10 + bill(c, 6) }), effect: 'loseHome' },
      { id: 'dies', label: 'you die in the fire', good: false, w: 0.01, death: 'a house fire' },
    ],
  },
  {
    id: 'work_accident', title: 'Accident at work', cat: 'accident', ages: [8, 75], weight: 2, question: 'How bad is it?',
    when: (c) => c.employed || c.has('child_labour'),
    p: (c) => T(c, 0.012, 0.01, 0.006, 0.002) * SEC(c, { labour: 2.2, farming: 1.5, factory: 1.8, military: 2, skilled: 1.3, office: 0.2, professional: 0.2, public: 0.4, creative: 0.3 }) * S(c, 'child_labour', 1.5) * S(c, 'migrant_worker', 1.8) * M(c, 1.4, 0.7),
    outcomes: [
      { id: 'minor', label: 'a scare and some stitches', good: true, w: 0.7, deltas: { health: -4 } },
      { id: 'serious', label: 'a serious injury', good: false, w: 0.25, deltas: { health: -18, money: -3 }, add: ['injury'] },
      { id: 'dies', label: 'you die on the job', good: false, w: 0.015, death: 'a workplace accident' },
    ],
  },
  {
    id: 'sports_injury', title: 'Sports injury', cat: 'accident', ages: [10, 55], weight: 1,
    p: (c) => 0.008 * S(c, 'fitness', 2.5),
    outcomes: [
      { id: 'heals', label: 'it heals', good: true, w: 1, deltas: { health: -4 } },
      { id: 'lingers', label: 'it never quite heals', good: false, w: 0.2, deltas: { health: -6 }, add: ['chronic_pain'] },
    ],
  },

  // ───────────── Violence and crime ─────────────
  {
    id: 'mugged', title: 'Mugged', cat: 'violence', ages: [12, 95], weight: 1, tags: ['violence'],
    p: (c) => (0.004 + c.country.x.homicide * 0.0012) * W(c, 1.3, 1, 0.8) * M(c, 1.3, 0.8) * R(c, 0.5, 1.2),
    outcomes: [
      { id: 'shaken', label: 'they take your stuff, you keep your teeth', good: true, w: 0.8, deltas: { money: -3, happiness: -4 } },
      { id: 'beaten', label: 'they beat you anyway', good: false, w: 0.2, deltas: { health: -10, money: -4, happiness: -6 } },
    ],
  },
  {
    id: 'assault', title: 'Violent attack', cat: 'violence', ages: [12, 95], weight: 3, question: 'Do you survive the attack?', tags: ['violence'],
    p: (c) => c.country.x.homicide * 0.0004 * M(c, 1.8, 0.4) * A(c.age, [[12, 0.5], [18, 1.6], [30, 1.2], [50, 0.6], [70, 0.3]]) * W(c, 1.6, 1, 0.5) * S(c, 'drug_addiction', 3) * S(c, 'alcoholism', 1.5) * S(c, 'homeless', 2) * S(c, 'gang_member', 5) * SEC(c, { crime: 4 }),
    outcomes: [
      { id: 'survive', label: 'you get away', good: true, w: 0.75, deltas: { health: -10, happiness: -8 } },
      { id: 'hurt', label: 'left badly hurt', good: false, w: 0.2, deltas: (c) => ({ health: -25, happiness: -10, money: bill(c, 5) }), add: ['injury'] },
      { id: 'killed', label: 'you are killed', good: false, w: 0.025, death: 'murder' },
    ],
  },
  {
    id: 'domestic_abuse', title: 'Your partner turns violent', cat: 'violence', ages: [14, 90], weight: 3, aboutPartner: true,
    when: (c) => c.partnered && !c.has('abusive_partner'),
    p: (c) => 0.012 * M(c, 0.3, 1) * T(c, 1.8, 1.5, 1.1, 0.8) * W(c, 1.3, 1, 0.7),
    deltas: { happiness: -12, health: -6 }, add: ['abusive_partner'],
  },
  {
    id: 'leave_abuser', title: 'You leave the abuser', cat: 'love', ages: [14, 90], weight: 3, group: 'love', aboutPartner: true,
    when: (c) => c.has('abusive_partner') && c.partnered,
    p: (c) => 0.15 * T(c, 0.5, 0.7, 1, 1.3) * W(c, 0.7, 1, 1.4) * S(c, 'supportive_family', 1.5),
    deltas: { happiness: 8 }, remove: ['abusive_partner'], effect: 'divorce',
  },
  {
    id: 'burglary', title: 'Burgled', cat: 'violence', ages: [18, 100], weight: 1, tags: ['violence'],
    when: (c) => c.homeKind !== 'street',
    p: (c) => 0.02 * (c.country.x.homicide > 10 ? 1.8 : 1) * W(c, 0.8, 1, 1.5),
    deltas: (c) => ({ money: c.wealth === 'wealthy' ? -8 : -5, happiness: -3 }),
  },
  {
    id: 'scammed', title: 'Scammed', cat: 'money', ages: [16, 100], weight: 1,
    p: (c) => 0.02 * A(c.age, [[16, 0.8], [40, 1], [70, 1.8]]) * S(c, 'dementia', 3) * T(c, 0.8, 1.2, 1.2, 1),
    deltas: (c) => ({ money: c.wealth === 'wealthy' ? -12 : -6, happiness: -4 }),
  },
  {
    id: 'arrested', title: 'Arrested', cat: 'violence', ages: [12, 80], weight: 3, question: 'Will you walk free?', tags: ['arrest'],
    when: (c) => c.free,
    p: (c) => c.country.x.prison * 0.00004 * M(c, 2.2, 0.3) * A(c.age, [[12, 0.4], [18, 1.8], [25, 1.5], [35, 1], [50, 0.4]]) * W(c, 1.8, 1, 0.6) * S(c, 'drug_addiction', 4) * S(c, 'alcoholism', 1.5) * S(c, 'homeless', 2.5) * S(c, 'gang_member', 5) * S(c, 'criminal_record', 2) * S(c, 'undocumented', 2) * SEC(c, { crime: 6 }),
    outcomes: [
      { id: 'released', label: 'released without charge', good: true, w: 0.6, deltas: { happiness: -3 } },
      { id: 'fined', label: 'a fine and a record', good: false, w: 0.25, deltas: { money: -6, happiness: -4 }, add: ['legal_trouble', 'criminal_record'] },
      { id: 'prison', label: 'prison', good: false, w: (c) => 0.15 * W(c, 1.5, 1, 0.5) * SEC(c, { crime: 2 }), deltas: { happiness: -15 }, add: ['in_prison', 'criminal_record'], effect: 'fired' },
    ],
  },
  {
    id: 'kidnapped', title: 'Kidnapped', cat: 'violence', ages: [5, 85], weight: 3, question: 'Will they let you go?', tags: ['violence'],
    when: (c) => inCountry(c, 'NG', 'MX', 'HT', 'CO', 'YE', 'SO', 'AF', 'PH'),
    p: (c) => 0.0008 * W(c, 0.5, 1, 3),
    outcomes: [
      { id: 'ransom', label: 'the family pays', good: true, w: 0.75, deltas: { money: -20, happiness: -10 } },
      { id: 'escape', label: 'you escape', good: true, w: 0.17, deltas: { health: -5, happiness: -8 } },
      { id: 'killed', label: 'they kill you', good: false, w: 0.08, death: 'kidnappers' },
    ],
  },

  // ───────────── Disasters and war ─────────────
  {
    id: 'conflict', title: 'Caught in the fighting', cat: 'disaster', ages: [0, 100], weight: 3, question: 'Do you make it out?',
    p: (c) => lvl(c.conflict, [0, 0.004, 0.012, 0.03]) * M(c, 1.4, 0.8) * A(c.age, [[0, 0.6], [15, 1.2], [40, 0.8]]),
    outcomes: [
      { id: 'survive', label: 'you survive it', good: true, w: 0.6, deltas: { happiness: -10, money: -6 } },
      { id: 'displaced', label: 'you lose your home', good: false, w: 0.3, deltas: { money: -20, happiness: -15 }, add: ['displaced'], effect: 'loseHome' },
      { id: 'injured', label: 'you are wounded', good: false, w: 0.08, deltas: { health: -25 }, add: ['injury'] },
      { id: 'killed', label: 'you are killed', good: false, w: 0.03, death: 'the war' },
    ],
  },
  {
    id: 'conscription', title: 'Called up for military service', cat: 'disaster', ages: [18, 26], weight: 2, once: true, question: 'A quiet service?', tags: ['draft'],
    when: (c) => c.sex === 'male' && c.free && (c.country.x.conscription > 0 || !!c.world.mult.draft),
    p: (c) => (c.country.x.conscription === 2 ? 0.15 : c.country.x.conscription === 1 ? 0.5 : 0.08),
    outcomes: [
      { id: 'quiet', label: 'boots, boredom and bad food', good: true, w: 0.9, deltas: { happiness: -5, health: 2 } },
      { id: 'combat', label: 'you see combat', good: false, w: (c) => 0.02 + 0.1 * ((c.world.mult.draft ?? 1) - 1) + (c.conflict >= 2 ? 0.2 : 0), deltas: { health: -20, happiness: -10 }, add: ['injury', 'veteran', 'ptsd'] },
      { id: 'killed', label: 'you come home in a box', good: false, w: (c) => 0.002 + 0.02 * ((c.world.mult.draft ?? 1) - 1) + (c.conflict >= 2 ? 0.04 : 0), death: 'the war' },
    ],
  },
  {
    id: 'mobilized', title: 'Mobilised for the front', cat: 'disaster', ages: [20, 55], weight: 3, question: 'Do you come back?',
    when: (c) => c.sex === 'male' && inCountry(c, 'RU') && c.year >= 2022 && c.year <= 2027 && c.free,
    p: () => 0.006,
    outcomes: [
      { id: 'back', label: 'you come back', good: true, w: 0.55, deltas: { happiness: -12 }, add: ['veteran'] },
      { id: 'wounded', label: 'you come back in pieces', good: false, w: 0.3, deltas: { health: -25, happiness: -15 }, add: ['injury', 'veteran', 'ptsd'] },
      { id: 'killed', label: 'you do not come back', good: false, w: 0.15, death: 'the war in Ukraine' },
    ],
  },
  {
    id: 'earthquake', title: 'Earthquake', cat: 'disaster', ages: [0, 100], weight: 3, question: 'Does the building hold?',
    p: (c) => (c.world.disaster === 'quake' ? 0.35 : lvl(c.country.x.quake, [0, 0.002, 0.006, 0.012])),
    outcomes: [
      { id: 'shaken', label: 'cracked walls, everyone alive', good: true, w: 0.8, deltas: { money: -3 } },
      { id: 'destroyed', label: 'your home is rubble', good: false, w: (c) => 0.17 * HK(c, { slum: 2, room: 1.3, mansion: 0.4 }), deltas: { money: -20, happiness: -10 }, add: ['displaced'], effect: 'loseHome' },
      { id: 'dies', label: 'you are buried', good: false, w: (c) => (c.world.disaster === 'quake' ? 0.03 : 0.004) * T(c, 3, 2, 1, 0.3) * HK(c, { slum: 2 }), death: 'an earthquake' },
    ],
  },
  {
    id: 'tsunami', title: 'The wave', cat: 'disaster', ages: [0, 100], weight: 3, question: 'Can you outrun the water?',
    when: (c) => c.world.disaster === 'tsunami',
    p: (c) => R(c, 0.15, 0.25),
    outcomes: [
      { id: 'run', label: 'you reach high ground', good: true, w: 0.75, deltas: { money: -10, happiness: -10 } },
      { id: 'lost', label: 'the sea takes everything you own', good: false, w: 0.2, deltas: { money: -25, happiness: -15 }, add: ['displaced'], effect: 'loseHome' },
      { id: 'dies', label: 'the sea takes you', good: false, w: 0.05, death: 'a tsunami' },
    ],
  },
  {
    id: 'cyclone', title: 'Cyclone', cat: 'disaster', ages: [0, 100], weight: 3, question: 'Will the shelter hold?',
    when: (c) => c.world.disaster === 'storm',
    p: (c) => R(c, 0.45, 0.25) * HK(c, { slum: 1.4, mansion: 0.5 }),
    outcomes: [
      { id: 'hold', label: 'the shelter holds', good: true, w: 0.7, deltas: { money: -6, happiness: -6 } },
      { id: 'flattened', label: 'your home is flattened', good: false, w: 0.25, deltas: { money: -18, happiness: -12 }, add: ['displaced'], effect: 'loseHome' },
      { id: 'dies', label: 'the storm surge takes you', good: false, w: (c) => 0.03 * T(c, 2, 1.5, 1, 0.3), death: 'a cyclone' },
    ],
  },
  {
    id: 'flood', title: 'Flood', cat: 'disaster', ages: [0, 100], weight: 2, question: 'Does the water stop in time?', tags: ['flood'],
    p: (c) => (c.world.disaster === 'flood' ? 0.4 : lvl(c.country.x.flood, [0, 0.003, 0.01, 0.03])) * W(c, 1.8, 1, 0.4) * HK(c, { slum: 1.6, street: 1.6 }),
    outcomes: [
      { id: 'wet', label: 'wet floors, nothing more', good: true, w: 0.75, deltas: { money: -2 } },
      { id: 'lost', label: 'you lose everything', good: false, w: 0.23, deltas: { money: -15, happiness: -10 }, add: ['displaced'], effect: 'loseHome' },
      { id: 'dies', label: 'you drown in it', good: false, w: (c) => 0.002 * T(c, 3, 2, 1, 0.3), death: 'a flood' },
    ],
  },
  {
    id: 'famine', title: 'Drought and hunger', cat: 'disaster', ages: [0, 100], weight: 3, question: 'Will there be food?', tags: ['famine'],
    p: (c) => lvl(c.country.x.drought, [0, 0.001, 0.015, 0.05]) * W(c, 2, 0.8, 0.1) * R(c, 1.4, 0.7),
    outcomes: [
      { id: 'tighten', label: 'you tighten your belt', good: true, w: 0.7, deltas: { health: -5, money: -4 } },
      { id: 'hunger', label: 'real hunger', good: false, w: 0.27, deltas: { health: -15 }, add: ['malnourished'] },
      { id: 'dies', label: 'you starve', good: false, w: (c) => 0.02 * A(c.age, [[0, 3], [5, 1], [60, 1.5]]), death: 'famine' },
    ],
  },
  {
    id: 'heatwave', title: 'Killer heatwave', cat: 'disaster', ages: [0, 100], weight: 1, question: 'Can you stay cool?', tags: ['heat'],
    p: (c) => lvl(c.country.x.heat, [0, 0.01, 0.03, 0.06]) * A(c.age, [[0, 1], [60, 1.5], [75, 3]]) * HK(c, { street: 2, slum: 1.5, mansion: 0.3 }),
    outcomes: [
      { id: 'sweat', label: 'you sweat it out', good: true, w: 0.9, deltas: { health: -2 } },
      { id: 'stroke', label: 'heatstroke', good: false, w: 0.09, deltas: { health: -10 } },
      { id: 'dies', label: 'the heat kills you', good: false, w: (c) => 0.01 * A(c.age, [[0, 0.3], [70, 1], [85, 3]]), death: 'heatstroke' },
    ],
  },

  // ───────────── Childhood and school ─────────────
  {
    id: 'child_labour', title: 'Sent out to work', cat: 'work', ages: [6, 14], weight: 2,
    when: (c) => !c.has('child_labour'),
    p: (c) => T(c, 0.04, 0.025, 0.006, 0.0005) * W(c, 1.8, 0.3, 0) * R(c, 1.3, 0.8) * (c.year < 1990 ? 1.6 : 1),
    deltas: { money: 2, happiness: -5 }, add: ['child_labour'],
  },
  {
    id: 'drop_out', title: 'You leave school', cat: 'education', ages: [10, 17], weight: 2, once: true,
    when: (c) => !c.has('dropped_out'),
    p: (c) => T(c, 0.08, 0.05, 0.02, 0.01) * W(c, 2, 0.8, 0.2) * S(c, 'child_labour', 2) * R(c, 1.3, 0.9) * (c.sex === 'female' && inCountry(c, 'AF') && c.year >= 2021 ? 10 : 1),
    deltas: { happiness: -2 }, add: ['dropped_out'],
  },
  {
    id: 'bullied', title: 'Bullied at school', cat: 'social', ages: [6, 16], weight: 1,
    when: (c) => !c.has('bullied') && !c.has('dropped_out'),
    p: (c) => 0.04 * S(c, 'disability', 2) * S(c, 'obese', 1.8) * W(c, 1.4, 1, 0.8),
    deltas: { happiness: -8 }, add: ['bullied'],
  },
  {
    id: 'school_star', title: 'Top of the class', cat: 'education', ages: [8, 18], weight: 1,
    when: (c) => !c.has('dropped_out') && !c.has('child_labour'),
    p: (c) => 0.08 * W(c, 0.6, 1, 1.4) * S(c, 'talented', 2),
    deltas: { happiness: 5 },
  },
  {
    id: 'talent', title: 'A talent shows', cat: 'education', ages: [6, 18], weight: 1,
    when: (c) => !c.has('talented'),
    p: () => 0.012, deltas: { happiness: 5 }, add: ['talented'],
  },
  {
    id: 'scholarship', title: 'Scholarship', cat: 'education', ages: [16, 22], weight: 2, once: true,
    when: (c) => !c.has('dropped_out') && !c.has('student') && c.free,
    p: (c) => 0.02 * S(c, 'talented', 2.5) * W(c, 1, 1, 0.3),
    deltas: { happiness: 10, money: 4 }, add: ['student'],
  },
  {
    id: 'graduate', title: 'Graduation', cat: 'education', ages: [19, 40], weight: 2,
    when: (c) => c.has('student'),
    p: () => 0.35,
    deltas: { happiness: 10 }, remove: ['student'], add: ['university_degree'],
  },
  {
    id: 'uni_dropout', title: 'You drop out of university', cat: 'education', ages: [17, 40], weight: 2,
    when: (c) => c.has('student'),
    p: (c) => 0.06 * W(c, 2, 1, 0.6) * S(c, 'depression', 2),
    deltas: { happiness: -6 }, remove: ['student'],
  },
  {
    id: 'orphaned', title: 'Orphaned', cat: 'family', ages: [0, 17], weight: 3, group: 'parents',
    when: (c) => c.parents === 0 && !c.has('orphan'),
    p: () => 1, deltas: { happiness: -10, money: -10 }, add: ['orphan'],
  },

  // ───────────── Work and money ─────────────
  {
    id: 'first_job', title: 'Your first job', cat: 'work', ages: [12, 35], weight: 2, group: 'job',
    when: (c) => !c.employed && !c.student && !c.has('unemployed') && !c.has('retired') && c.free,
    p: (c) => A(c.age, [[12, 0.03], [15, 0.1], [18, 0.3], [22, 0.4]]) * T(c, 1.5, 1.2, 1, 0.8) * S(c, 'university_degree', 1.5),
    deltas: { money: 5, happiness: 3 }, effect: 'newJob', remove: ['child_labour'],
  },
  {
    id: 'promotion', title: 'Promotion', cat: 'work', ages: [18, 70], weight: 2, group: 'job', tags: [],
    when: (c) => c.employed && c.level < 5 && c.sector !== 'business',
    p: (c) => 0.08 * S(c, 'university_degree', 1.4) * S(c, 'depression', 0.6) * S(c, 'alcoholism', 0.5) * S(c, 'connections', 1.4) * (c.happiness > 60 ? 1.2 : 1) / (c.world.mult.economy ?? 1),
    deltas: { money: 8, happiness: 4 }, effect: 'promotion',
  },
  {
    id: 'laid_off', title: 'Laid off', cat: 'work', ages: [16, 70], weight: 2, group: 'job', tags: ['economy', 'layoff'],
    when: (c) => c.employed && c.sector !== 'business' && c.sector !== 'crime',
    p: (c) => T(c, 0.06, 0.05, 0.04, 0.03) * S(c, 'alcoholism', 2) * S(c, 'drug_addiction', 2) * S(c, 'depression', 1.5) * S(c, 'university_degree', 0.7) * SEC(c, { public: 0.4, professional: 0.6 }),
    deltas: { money: -6, happiness: -8 }, effect: 'fired', add: ['unemployed'],
  },
  {
    id: 'find_job', title: 'Back in work', cat: 'work', ages: [16, 70], weight: 2, group: 'job',
    when: (c) => c.has('unemployed') && c.free,
    p: (c) => 0.4 * S(c, 'university_degree', 1.3) * S(c, 'drug_addiction', 0.4) * S(c, 'criminal_record', 0.6) * S(c, 'connections', 1.5) * A(c.age, [[18, 1], [50, 0.7], [60, 0.4]]) / (c.world.mult.economy ?? 1),
    deltas: { money: 5, happiness: 6 }, effect: 'newJob', remove: ['unemployed'],
  },
  {
    id: 'start_business', title: 'You start a business', cat: 'work', ages: [20, 62], weight: 2, group: 'job', question: 'Does it take off?', tags: ['economy'],
    when: (c) => !c.has('business_owner') && c.free,
    p: (c) => 0.015 * W(c, 0.5, 1, 2) * S(c, 'talented', 1.5),
    outcomes: [
      { id: 'boom', label: 'it takes off', good: true, w: 0.35, deltas: { money: 15, happiness: 8 }, add: ['business_owner'], effect: 'business' },
      { id: 'struggle', label: 'it limps along', good: false, w: 0.4, deltas: { money: -8, happiness: -3 }, add: ['business_owner', 'stress'], effect: 'business' },
      { id: 'flop', label: 'it flops and eats your savings', good: false, w: 0.25, deltas: { money: -15, happiness: -8 }, add: ['in_debt'] },
    ],
  },
  {
    id: 'business_boom', title: 'Business booms', cat: 'money', ages: [20, 80], weight: 2,
    when: (c) => c.has('business_owner'), p: (c) => 0.12 / (c.world.mult.economy ?? 1), deltas: { money: 15, happiness: 6 },
  },
  {
    id: 'bankrupt', title: 'Business goes bust', cat: 'money', ages: [20, 80], weight: 2, tags: ['economy'],
    when: (c) => c.has('business_owner'),
    p: (c) => 0.08 * W(c, 1.5, 1, 0.7),
    deltas: { money: -20, happiness: -10 }, remove: ['business_owner'], add: ['in_debt', 'unemployed'], effect: 'fired',
  },
  {
    id: 'debt', title: 'Drowning in debt', cat: 'money', ages: [18, 95], weight: 2, tags: ['economy'],
    when: (c) => !c.has('in_debt'),
    p: (c) => 0.015 * W(c, 2, 1, 0.2) * S(c, 'alcoholism', 2) * S(c, 'drug_addiction', 3) * S(c, 'unemployed', 2) * S(c, 'gambling_addiction', 4),
    deltas: { money: -5, happiness: -5 }, add: ['in_debt'],
  },
  {
    id: 'debt_free', title: 'Debt paid off', cat: 'money', ages: [18, 100], weight: 2,
    when: (c) => c.has('in_debt'),
    p: (c) => 0.15 * W(c, 0.5, 1, 2) * (c.employed ? 1.5 : 0.5),
    deltas: { happiness: 6 }, remove: ['in_debt'],
  },
  {
    id: 'inheritance', title: 'A distant relative leaves you money', cat: 'luck', ages: [18, 90], weight: 2,
    p: (c) => 0.005 * W(c, 0.3, 1, 2), deltas: { money: 12, happiness: 4 },
  },
  {
    id: 'lottery_small', title: 'Lottery win', cat: 'luck', ages: [18, 100], weight: 1,
    p: (c) => 0.004 * W(c, 1.5, 1, 0.5), deltas: { money: 6, happiness: 5 },
  },
  {
    id: 'jackpot', title: 'JACKPOT', cat: 'luck', ages: [18, 100], weight: 3,
    p: () => 0.000005, deltas: { money: 60, happiness: 15 }, add: ['savings'],
  },
  {
    id: 'bad_investment', title: 'An investment goes to zero', cat: 'money', ages: [22, 90], weight: 1, tags: ['economy'],
    when: (c) => c.money >= 40, p: () => 0.03, deltas: { money: -10, happiness: -4 },
  },
  {
    id: 'good_investment', title: 'An investment pays off', cat: 'money', ages: [22, 90], weight: 1,
    when: (c) => c.money >= 40, p: (c) => 0.05 * W(c, 0, 1, 1.5) / (c.world.mult.economy ?? 1), deltas: { money: 8, happiness: 3 },
  },
  {
    id: 'gulf_job', title: 'A job in the Gulf', cat: 'work', ages: [20, 45], weight: 3, group: 'job', moveTo: 'AE',
    when: (c) => inCountry(c, 'IN', 'PK', 'BD', 'PH', 'NG', 'EG', 'KE', 'ET') && !c.has('migrant_worker') && c.free && c.year >= 1973,
    p: (c) => 0.012 * W(c, 1.5, 1, 0.2) * M(c, 2, 0.6),
    deltas: { money: 6, happiness: -6 }, add: ['migrant_worker'], effect: 'migrate',
  },
  {
    id: 'retire', title: 'Retirement', cat: 'work', ages: [55, 80], weight: 2, group: 'job',
    when: (c) => c.employed && c.sector !== 'crime',
    p: (c) => A(c.age, [[55, 0.03], [60, 0.15], [65, 0.4], [70, 0.5]]) * T(c, 0.4, 0.5, 1, 1.2) * W(c, 0.4, 1, 1.5) * SEC(c, { public: 1.5, military: 1.5 }),
    deltas: { happiness: 8 }, effect: 'retire', add: ['retired'],
  },
  {
    id: 'pension_loss', title: 'The pension shrinks', cat: 'money', ages: [60, 100], weight: 1, tags: ['economy'],
    when: (c) => c.has('retired'), p: (c) => 0.02 * T(c, 1.5, 1.3, 1, 0.6), deltas: { money: -10, happiness: -4 },
  },
  {
    id: 'viral', title: 'You go viral', cat: 'luck', ages: [12, 60], weight: 3, once: true,
    when: (c) => c.year >= 2006,
    p: (c) => 0.0008 * T(c, 0.5, 1, 1, 1.3) * S(c, 'talented', 3), deltas: { money: 10, happiness: 10 }, add: ['famous', 'influencer'],
  },
  {
    id: 'award', title: 'Public recognition', cat: 'work', ages: [20, 85], weight: 1,
    when: (c) => c.employed, p: (c) => 0.01 * S(c, 'talented', 3) * S(c, 'university_degree', 1.5), deltas: { happiness: 8, money: 4 },
  },

  // ───────────── Home ─────────────
  {
    id: 'buy_home', title: 'You buy a home', cat: 'money', ages: [22, 75], weight: 2, group: 'home',
    when: (c) => !c.owned && c.free && c.homeKind !== 'street',
    p: (c) => 0.04 * W(c, 0.05, 1, 2.5) * T(c, 0.6, 0.8, 1, 1) * (c.relationship === 'married' ? 1.5 : 0.8) / (c.world.mult.economy ?? 1),
    deltas: { money: -10, happiness: 8 }, effect: 'buyHome',
  },
  {
    id: 'evicted', title: 'Evicted', cat: 'money', ages: [18, 100], weight: 2, group: 'home', question: 'Somewhere to sleep tonight?', tags: ['economy'],
    when: (c) => !c.owned && c.homeKind !== 'street' && c.free && c.age >= 18,
    p: (c) => 0.008 * W(c, 2.5, 0.6, 0) * S(c, 'in_debt', 2) * S(c, 'unemployed', 2),
    outcomes: [
      { id: 'family', label: 'a cousin takes you in', good: true, w: 0.7, deltas: { money: -5, happiness: -8 }, effect: 'homeDown' },
      { id: 'street', label: 'the street', good: false, w: (c) => 0.3 * S(c, 'drug_addiction', 2) * S(c, 'supportive_family', 0.3), deltas: { happiness: -12 }, add: ['homeless'], effect: 'evicted' },
    ],
  },
  {
    id: 'off_streets', title: 'Off the streets', cat: 'money', ages: [16, 100], weight: 2, group: 'home',
    when: (c) => c.homeKind === 'street',
    p: (c) => 0.25 * S(c, 'drug_addiction', 0.4) * (c.employed ? 2 : 1),
    deltas: { happiness: 10, health: 3 }, remove: ['homeless'], effect: 'homeUp',
  },
  {
    id: 'move_up', title: 'A better place', cat: 'social', ages: [18, 90], weight: 1, group: 'home',
    when: (c) => c.free && c.homeKind !== 'street' && homeTarget(c) > c.homeRung,
    p: () => 0.2, deltas: { happiness: 5, money: -3 }, effect: 'homeUp',
  },
  {
    id: 'downsize', title: 'Downsizing', cat: 'money', ages: [18, 100], weight: 1, group: 'home',
    when: (c) => c.free && c.homeKind !== 'street' && homeTarget(c) < c.homeRung && !(c.owned && c.homeRung <= 4),
    p: () => 0.2, deltas: { happiness: -4, money: 3 }, effect: 'homeDown',
  },
  {
    id: 'to_city', title: 'Off to the city', cat: 'social', ages: [15, 40], weight: 2, group: 'home',
    when: (c) => c.rural && c.free,
    p: (c) => A(c.age, [[15, 0.02], [18, 0.05], [25, 0.04], [40, 0.01]]) * T(c, 1.2, 1.3, 1, 0.7) * S(c, 'dropped_out', 0.7),
    deltas: { happiness: 2, money: 2 }, effect: 'toCity',
  },

  // ───────────── Love ─────────────
  {
    id: 'fall_in_love', title: 'Someone new', cat: 'love', ages: [15, 90], weight: 2, group: 'love', newPerson: { role: 'partner', sex: 'other' },
    when: (c) => !c.partnered && c.free,
    p: (c) => A(c.age, [[15, 0.08], [18, 0.18], [25, 0.22], [35, 0.15], [50, 0.08], [70, 0.03]]) * (arranged(c) > 0.5 ? 0.4 : 1) * S(c, 'famous', 1.5) * S(c, 'depression', 0.5) * (c.happiness > 60 ? 1.2 : 1),
    deltas: { happiness: 10 }, add: ['in_love'], effect: 'newPartner',
  },
  {
    id: 'arranged_marriage', title: 'An arranged marriage', cat: 'love', ages: [16, 32], weight: 3, group: 'love', question: 'Will it be a good match?', newPerson: { role: 'partner', sex: 'other' },
    when: (c) => !c.partnered && c.free && arranged(c) > 0,
    p: (c) => A(c.age, [[16, 0.03], [18, 0.12], [22, 0.18], [26, 0.15], [32, 0.06]]) * M(c, 1, 1.3) * arranged(c) * (c.year < 1990 ? 1.3 : 1),
    effect: 'arranged',
    outcomes: [
      { id: 'lovely', label: 'it turns out lovely', good: true, w: 0.5, deltas: { happiness: 8 }, add: ['supportive_family'] },
      { id: 'miserable', label: 'a miserable match', good: false, w: 0.5, deltas: { happiness: -10 } },
    ],
  },
  {
    id: 'child_marriage', title: 'Married off as a child', cat: 'love', ages: [12, 17], weight: 3, group: 'love', newPerson: { role: 'partner', sex: 'male' },
    when: (c) => c.sex === 'female' && !c.partnered,
    p: (c) => (1 - Math.pow(1 - c.country.x.childMarriage / 100, 1 / 5)) * W(c, 1.6, 0.8, 0.1) * R(c, 1.4, 0.7) * (c.year < 1990 ? 1.5 : 1),
    deltas: { happiness: -15, health: -3 }, add: ['dropped_out'], effect: 'arranged',
  },
  {
    id: 'engaged', title: 'Engaged', cat: 'love', ages: [16, 90], weight: 2, group: 'love', aboutPartner: true,
    when: (c) => c.relationship === 'dating', p: (c) => 0.2 * (c.age > 25 ? 1.2 : 0.8), deltas: { happiness: 8 }, effect: 'engaged',
  },
  {
    id: 'wedding', title: 'Wedding', cat: 'love', ages: [16, 95], weight: 2, group: 'love', aboutPartner: true,
    when: (c) => c.relationship === 'engaged', p: () => 0.45, deltas: (c) => ({ happiness: 10, money: -6 * W(c, 0.5, 1, 2) }), effect: 'married',
  },
  {
    id: 'breakup', title: 'Breakup', cat: 'love', ages: [14, 95], weight: 2, group: 'love', aboutPartner: true,
    when: (c) => c.relationship === 'dating' || c.relationship === 'engaged',
    p: (c) => (c.relationship === 'dating' ? 0.22 : 0.08), deltas: { happiness: -10 }, remove: ['in_love'], effect: 'breakup',
  },
  {
    id: 'divorce', title: 'Divorce', cat: 'love', ages: [18, 95], weight: 3, group: 'love', aboutPartner: true,
    when: (c) => c.relationship === 'married',
    p: (c) => 0.015 * c.country.x.divorce * (c.year < 1975 ? 0.4 : 1) * S(c, 'alcoholism', 2) * S(c, 'in_debt', 1.5) * S(c, 'unemployed', 1.3) * S(c, 'stress', 1.3) * S(c, 'gambling_addiction', 2),
    deltas: { happiness: -10, money: -8 }, remove: ['in_love'], effect: 'divorce',
  },
  {
    id: 'affair', title: 'An affair', cat: 'love', ages: [20, 75], weight: 2, question: 'Will anyone find out?', aboutPartner: true,
    when: (c) => c.relationship === 'married' && c.free,
    p: (c) => 0.025 * M(c, 1.3, 0.8) * S(c, 'stress', 1.3),
    outcomes: [
      { id: 'secret', label: 'nobody finds out', good: true, w: 0.6, deltas: { happiness: 3 } },
      { id: 'caught', label: 'caught', good: false, w: 0.4, deltas: { happiness: -10 }, add: ['stress', 'scandal'] },
    ],
  },
  {
    id: 'cheated_on', title: 'Cheated on', cat: 'love', ages: [16, 85], weight: 2, aboutPartner: true,
    when: (c) => c.partnered, p: () => 0.02, deltas: { happiness: -12 }, add: ['stress'],
  },

  // ───────────── Family ─────────────
  {
    id: 'baby', title: 'A baby on the way', cat: 'family', ages: [15, 60], weight: 3, group: 'kid', question: 'Will mother and baby make it?', newPerson: { role: 'child', sex: 'any' },
    when: (c) => c.partnered && c.free && !c.has('infertile') && (c.sex === 'female' ? c.age <= 46 : c.partnerAge <= 46 || c.partnerAge === 0),
    p: (c) => (c.country.x.tfr / 15) * (c.year < 1990 ? 1.6 : 1) * (inCountry(c, 'CN') && c.year >= 1980 && c.year <= 2015 && c.kids >= 1 ? 0.15 : 1) * A(c.sex === 'female' ? c.age : c.partnerAge || c.age - 3, [[15, 0.3], [18, 0.8], [22, 1.2], [28, 1.3], [33, 1], [38, 0.5], [42, 0.15], [45, 0.03], [50, 0]]) * ({ married: 1, engaged: 0.4, dating: 0.15 } as Record<string, number>)[c.relationship] * (c.kids >= 4 ? 0.6 : 1),
    outcomes: [
      { id: 'healthy', label: 'a healthy baby', good: true, w: 1, deltas: (c) => ({ happiness: 12, money: -4 * W(c, 0.5, 1, 1.5), health: c.sex === 'female' ? -3 : 0 }), effect: 'kid' },
      { id: 'complications', label: 'a hard birth', good: false, w: (c) => 0.08 * D(c), deltas: (c) => ({ happiness: 6, health: c.sex === 'female' ? -12 : 0, money: bill(c, 4) }), effect: 'kid' },
      { id: 'stillbirth', label: 'the baby does not make it', good: false, w: (c) => 0.012 * D(c), deltas: { happiness: -25 }, add: ['grieving'] },
      { id: 'mother_dies', label: 'the mother does not make it', good: false, w: (c) => (c.country.x.mmr / 100000) * (c.year < 1990 ? 2.5 : 1), death: 'childbirth' },
    ],
  },
  {
    id: 'teen_pregnancy', title: 'Teenage pregnancy', cat: 'family', ages: [13, 19], weight: 3, group: 'kid', question: 'Will mother and baby make it?', newPerson: { role: 'child', sex: 'any' },
    when: (c) => c.sex === 'female' && !c.partnered,
    p: (c) => T(c, 0.04, 0.025, 0.012, 0.006) * W(c, 2, 1, 0.3),
    outcomes: [
      { id: 'healthy', label: 'a healthy baby', good: true, w: 1, deltas: { happiness: 2, money: -4, health: -4 }, add: ['dropped_out'], effect: 'kid' },
      { id: 'complications', label: 'a hard birth', good: false, w: (c) => 0.12 * D(c), deltas: (c) => ({ health: -14, money: bill(c, 4) }), add: ['dropped_out'], effect: 'kid' },
      { id: 'mother_dies', label: 'you do not make it', good: false, w: (c) => (c.country.x.mmr * 1.5) / 100000, death: 'childbirth' },
    ],
  },
  {
    id: 'sibling_born', title: 'A new sibling', cat: 'family', ages: [1, 14], weight: 1, newPerson: { role: 'sibling', sex: 'any' },
    when: (c) => c.people('mother').some((m) => m.age <= 43),
    p: (c) => (c.country.x.tfr / 15) * (c.year < 1990 ? 1.6 : 1) * (inCountry(c, 'CN') && c.year >= 1980 && c.year <= 2015 ? 0.1 : 1) * 0.9,
    deltas: { happiness: -1 }, effect: 'kid',
  },
  {
    id: 'parent_dies', title: 'A parent dies', cat: 'family', ages: [0, 95], weight: 3, group: 'parents', question: 'What do they leave behind?',
    target: (c) => c.people('mother', 'father').map((s) => ({ ...s, w: deathOdds(c, s.age) })),
    p: () => 1, effect: 'personDies',
    outcomes: [
      { id: 'inheritance', label: 'an inheritance', good: true, w: (c) => W(c, 0.1, 0.4, 0.9), deltas: (c) => ({ happiness: -12, money: W(c, 4, 10, 20) }), add: ['grieving'] },
      { id: 'memories', label: 'only memories', good: false, w: 0.6, deltas: { happiness: -15 }, add: ['grieving'] },
      { id: 'debts', label: 'their debts', good: false, w: (c) => W(c, 0.3, 0.1, 0.02), deltas: { happiness: -15, money: -8 }, add: ['grieving'] },
    ],
  },
  {
    id: 'sibling_dies', title: 'You lose a sibling', cat: 'family', ages: [0, 100], weight: 3,
    target: (c) => c.people('sibling').map((s) => ({ ...s, w: deathOdds(c, s.age) * 1.2 })),
    p: () => 1, deltas: { happiness: -18 }, add: ['grieving'], effect: 'personDies',
  },
  {
    id: 'child_dies', title: 'You lose a child', cat: 'family', ages: [16, 100], weight: 3,
    target: (c) => c.people('child').map((s) => ({ ...s, w: deathOdds(c, s.age) * W(c, 1.5, 1, 0.6) })),
    p: () => 1, deltas: { happiness: -30 }, add: ['grieving'], effect: 'personDies',
  },
  {
    id: 'spouse_dies', title: 'Widowed', cat: 'family', ages: [18, 100], weight: 3, group: 'love', aboutPartner: true,
    when: (c) => c.relationship === 'married',
    p: (c) => deathOdds(c, c.partnerAge),
    deltas: { happiness: -30 }, add: ['grieving'], remove: ['in_love'], effect: 'widowed',
  },
  {
    id: 'grandchild', title: 'A grandchild', cat: 'family', ages: [36, 100], weight: 1,
    target: (c) => c.people('child').filter((s) => s.age >= 18 && s.age <= 45).map((s) => ({ ...s, w: 0.08 })),
    p: () => 1, deltas: { happiness: 8 },
  },
  {
    id: 'kid_leaves', title: 'A child moves far away', cat: 'family', ages: [38, 95], weight: 1,
    target: (c) => c.people('child').filter((s) => s.age >= 18 && s.age <= 40).map((s) => ({ ...s, w: 0.04 })),
    p: () => 1, deltas: { happiness: -4 }, add: ['loneliness'],
  },
  {
    id: 'family_feud', title: 'Family feud', cat: 'family', ages: [10, 95], weight: 1,
    target: (c) => c.people('mother', 'father', 'sibling', 'child').filter((s) => s.age >= 12).map((s) => ({ ...s, w: 0.006 })),
    p: () => 1, deltas: { happiness: -6 }, remove: ['supportive_family'], add: ['grudge'],
  },

  // ───────────── Social life ─────────────
  {
    id: 'best_friend', title: 'A friend for life', cat: 'social', ages: [5, 85], weight: 1, newPerson: { role: 'friend', sex: 'any' },
    when: (c) => c.people('friend').length < 3 && c.free,
    p: (c) => 0.06 * (c.happiness > 50 ? 1.2 : 0.8) / (1 + c.people('friend').length), deltas: { happiness: 5 }, add: ['loyal_friends'], remove: ['loneliness'], effect: 'newPerson',
  },
  {
    id: 'friend_dies', title: 'A friend dies', cat: 'social', ages: [20, 100], weight: 2,
    target: (c) => c.people('friend').map((s) => ({ ...s, w: deathOdds(c, s.age) * 1.3 })),
    p: () => 1, deltas: { happiness: -10 }, add: ['grieving'], effect: 'personDies',
  },
  {
    id: 'lonely', title: 'Lonely years', cat: 'social', ages: [16, 100], weight: 1,
    when: (c) => !c.partnered && c.people('friend').length === 0 && !c.has('loneliness'),
    p: (c) => 0.05 * A(c.age, [[16, 1], [40, 0.8], [75, 2]]), deltas: { happiness: -6 }, add: ['loneliness'],
  },
  {
    id: 'pet', title: 'A pet adopts you', cat: 'social', ages: [5, 90], weight: 1,
    when: (c) => !c.has('pet') && c.free && c.homeKind !== 'street', p: (c) => 0.06 * W(c, 0.4, 1, 1.4), deltas: { happiness: 6 }, add: ['pet'],
  },
  {
    id: 'pet_dies', title: 'Your pet dies', cat: 'social', ages: [5, 100], weight: 1,
    when: (c) => c.has('pet'), p: () => 0.08, deltas: { happiness: -8 }, remove: ['pet'],
  },
  {
    id: 'faith', title: 'You find faith', cat: 'social', ages: [14, 95], weight: 1,
    when: (c) => !c.has('faith'), p: (c) => 0.008 * S(c, 'grieving', 3) * S(c, 'depression', 2) * S(c, 'in_prison', 3), deltas: { happiness: 5 }, add: ['faith'],
  },
  {
    id: 'holiday', title: 'A trip abroad', cat: 'social', ages: [18, 85], weight: 1,
    when: (c) => c.free, p: (c) => 0.02 * W(c, 0, 1, 3) * T(c, 0.2, 0.4, 1, 1.5) * (c.year < 1980 ? 0.4 : 1), deltas: { happiness: 6, money: -3 },
  },
  {
    id: 'old_thread', title: 'Something from the past', cat: 'luck', ages: [8, 100], weight: 2, thread: true, question: 'How does it come back?',
    when: (c) => c.threads > 0,
    p: () => 0.08,
    outcomes: [
      { id: 'good', label: 'it comes back in your favour', good: true, w: 0.5, deltas: { happiness: 6, money: 3 } },
      { id: 'bad', label: 'it comes back to bite you', good: false, w: 0.5, deltas: { happiness: -6, money: -3 } },
    ],
  },
];

export const EVENTS: EventDef[] = [...CORE, ...MORE_EVENTS];

/** Balance pass: multipliers on top of each event's own odds, tuned with `npm run sim`. */
export const TUNING: Record<string, number> = {
  loan_shark: 0.3, bribe: 0.4, sibling_loan: 0.4, dental_disaster: 0.4, misdiagnosis: 0.3, meet_celebrity: 0.2,
  catfished: 0.4, witness_crime: 0.5, new_rival: 0.5, teacher_beating: 0.6, arrested: 0.7, diarrhoea: 0.7,
  gambling: 0.2, pilgrimage: 0.5, lawsuit: 0.6,
};

/** Category groups that cannot happen behind bars. */
export const BLOCKED_IN_PRISON = new Set<Category>(['love', 'work', 'education', 'social', 'luck']);
