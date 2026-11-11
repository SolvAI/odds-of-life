import type { Ctx } from '../engine/ctx';
import type { Stats } from '../engine/types';

export type StatusKind = 'suffering' | 'benefiting' | 'situation';

export interface StatusDef {
  label: string;
  kind: StatusKind;
  /** Soft statuses are story-level: the LLM may add or end them. Hard ones only change through events. */
  soft?: boolean;
  years?: [number, number]; // ends on its own after this many years
  drift?: Partial<Stats>; // applied every year while active
  death?: (c: Ctx) => number; // extra yearly death chance
  cause?: string;
}

export const STATUSES: Record<string, StatusDef> = {
  // Bodies
  disability: { label: 'disability', kind: 'suffering', drift: { happiness: -0.5 } },
  diabetes: { label: 'type 2 diabetes', kind: 'suffering', drift: { health: -1 }, death: (c) => 0.004 * (1.6 - c.care), cause: 'diabetes complications' },
  hypertension: { label: 'high blood pressure', kind: 'suffering', drift: { health: -0.5 } },
  heart_disease: { label: 'heart disease', kind: 'suffering', drift: { health: -1 }, death: (c) => 0.012 * (1.6 - c.care), cause: 'heart failure' },
  hiv: { label: 'HIV', kind: 'suffering', drift: { health: -1, happiness: -1 }, death: (c) => 0.004 + 0.08 * (1 - c.care), cause: 'AIDS' },
  cancer: { label: 'cancer', kind: 'suffering', drift: { health: -6, happiness: -3 } },
  dementia: { label: 'dementia', kind: 'suffering', drift: { health: -3, happiness: -3 }, death: () => 0.09, cause: 'dementia' },
  stroke_damage: { label: 'after-effects of a stroke', kind: 'suffering', drift: { health: -1, happiness: -2 }, death: () => 0.02, cause: 'a second stroke' },
  lung_disease: { label: 'damaged lungs', kind: 'suffering', drift: { health: -2 }, death: (c) => 0.015 * (1.6 - c.care), cause: 'lung disease' },
  alcoholism: { label: 'alcohol addiction', kind: 'suffering', drift: { health: -3, money: -2, happiness: -1 }, death: () => 0.007, cause: 'liver failure' },
  drug_addiction: { label: 'drug addiction', kind: 'suffering', drift: { health: -4, money: -4, happiness: -1 }, death: (c) => (c.country.code === 'US' ? 0.025 : 0.01), cause: 'an overdose' },
  smoker: { label: 'smoking', kind: 'suffering', drift: { health: -0.5 } },
  obese: { label: 'obesity', kind: 'suffering', drift: { health: -0.8 } },
  malnourished: { label: 'malnutrition', kind: 'suffering', years: [1, 3], drift: { health: -3 } },
  injury: { label: 'a bad injury', kind: 'suffering', years: [1, 2], drift: { health: -1 } },
  depression: { label: 'depression', kind: 'suffering', soft: true, years: [1, 4], drift: { happiness: -4 } },
  // Situations
  unemployed: { label: 'unemployed', kind: 'suffering', drift: { money: -2, happiness: -2 } },
  homeless: { label: 'homelessness', kind: 'suffering', drift: { health: -4, happiness: -4, money: -1 }, death: () => 0.02, cause: 'life on the street' },
  in_prison: { label: 'prison', kind: 'suffering', years: [1, 6], drift: { happiness: -6, health: -2 } },
  child_labour: { label: 'child labour', kind: 'suffering', drift: { health: -1, happiness: -2 } },
  dropped_out: { label: 'left school early', kind: 'situation' },
  displaced: { label: 'displaced from home', kind: 'suffering', years: [1, 4], drift: { happiness: -3, money: -2 } },
  abusive_partner: { label: 'an abusive partner', kind: 'suffering', drift: { happiness: -4, health: -1 } },
  orphan: { label: 'orphaned', kind: 'situation', drift: { happiness: -1 } },
  student: { label: 'university student', kind: 'situation', years: [3, 5], drift: { money: -1 } },
  university_degree: { label: 'university degree', kind: 'benefiting' },
  homeowner: { label: 'owns a home', kind: 'benefiting', drift: { happiness: 1 } },
  business_owner: { label: 'runs a business', kind: 'benefiting' },
  migrant_worker: { label: 'migrant worker abroad', kind: 'situation', years: [2, 8], drift: { money: 3, happiness: -2 } },
  famous: { label: 'famous', kind: 'benefiting', drift: { money: 2, happiness: 1 } },
  retired: { label: 'retired', kind: 'situation' },
  cancer_survivor: { label: 'cancer survivor', kind: 'situation' },
  gambling_addiction: { label: 'gambling addiction', kind: 'suffering', drift: { money: -3, happiness: -1 } },
  arthritis: { label: 'arthritis', kind: 'suffering', drift: { health: -0.5, happiness: -1 } },
  kidney_disease: { label: 'kidney disease', kind: 'suffering', drift: { health: -2 }, death: (c) => 0.012 * (1.6 - c.care), cause: 'kidney failure' },
  hepatitis: { label: 'hepatitis', kind: 'suffering', drift: { health: -1 }, death: (c) => 0.004 * (1.6 - c.care), cause: 'liver failure' },
  parkinsons: { label: "Parkinson's disease", kind: 'suffering', drift: { health: -2, happiness: -2 }, death: () => 0.04, cause: "Parkinson's disease" },
  failing_sight: { label: 'failing eyesight', kind: 'suffering', drift: { happiness: -1 } },
  hearing_loss: { label: 'going deaf', kind: 'suffering', drift: { happiness: -0.5 } },
  ptsd: { label: 'war trauma', kind: 'suffering', drift: { happiness: -3 } },
  lingering_illness: { label: 'a lingering illness', kind: 'suffering', years: [1, 3], drift: { health: -1.5, happiness: -1 } },
  infertile: { label: 'infertility', kind: 'situation' },
  criminal_record: { label: 'a criminal record', kind: 'situation' },
  gang_member: { label: 'in a gang', kind: 'situation', drift: { money: 2 } },
  on_the_run: { label: 'on the run', kind: 'suffering', years: [1, 3], drift: { happiness: -3 } },
  undocumented: { label: 'no papers', kind: 'suffering', drift: { money: -1, happiness: -1 } },
  refugee: { label: 'refugee', kind: 'suffering', years: [2, 8], drift: { money: -2, happiness: -2 } },
  expat: { label: 'living abroad', kind: 'situation' },
  veteran: { label: 'war veteran', kind: 'situation' },
  caregiver: { label: 'caring for a sick parent', kind: 'suffering', years: [2, 6], drift: { happiness: -2, money: -1 } },
  car_owner: { label: 'owns a car', kind: 'benefiting', drift: { happiness: 0.5 } },
  influencer: { label: 'an online following', kind: 'benefiting', drift: { money: 1 } },
  politician: { label: 'local politician', kind: 'benefiting', drift: { money: 1 } },
  // Soft: the LLM may add or end these as the story goes
  chronic_pain: { label: 'chronic pain', kind: 'suffering', soft: true, drift: { happiness: -2 } },
  grieving: { label: 'grief', kind: 'suffering', soft: true, years: [1, 2], drift: { happiness: -5 } },
  stress: { label: 'stress', kind: 'suffering', soft: true, years: [1, 3], drift: { happiness: -2, health: -1 } },
  loneliness: { label: 'loneliness', kind: 'suffering', soft: true, drift: { happiness: -3 } },
  in_debt: { label: 'debt', kind: 'suffering', soft: true, drift: { money: -2, happiness: -2 } },
  bullied: { label: 'bullied', kind: 'suffering', soft: true, years: [1, 2], drift: { happiness: -3 } },
  legal_trouble: { label: 'legal trouble', kind: 'suffering', soft: true, years: [1, 3], drift: { money: -1, happiness: -1 } },
  fitness: { label: 'in great shape', kind: 'benefiting', soft: true, drift: { health: 1.5 } },
  loyal_friends: { label: 'loyal friends', kind: 'benefiting', soft: true, drift: { happiness: 1 } },
  supportive_family: { label: 'a supportive family', kind: 'benefiting', soft: true, drift: { happiness: 1 } },
  faith: { label: 'faith', kind: 'benefiting', soft: true, drift: { happiness: 1 } },
  pet: { label: 'a pet', kind: 'benefiting', soft: true, years: [8, 14], drift: { happiness: 1 } },
  in_love: { label: 'in love', kind: 'benefiting', soft: true, years: [1, 3], drift: { happiness: 2 } },
  talented: { label: 'a real talent', kind: 'benefiting', soft: true },
  savings: { label: 'some savings', kind: 'benefiting', soft: true, drift: { money: 0.5 } },
  insomnia: { label: 'insomnia', kind: 'suffering', soft: true, drift: { happiness: -1, health: -0.5 } },
  scandal: { label: 'a scandal', kind: 'suffering', soft: true, years: [1, 2], drift: { happiness: -2 } },
  grudge: { label: 'a grudge', kind: 'suffering', soft: true, drift: { happiness: -1 } },
  side_hustle: { label: 'a side hustle', kind: 'benefiting', soft: true, drift: { money: 1 } },
  hobby: { label: 'a passion', kind: 'benefiting', soft: true, drift: { happiness: 1 } },
  community: { label: 'a close community', kind: 'benefiting', soft: true, drift: { happiness: 1 } },
  connections: { label: 'useful connections', kind: 'benefiting', soft: true },
};

// Soft conditions fade unless the story renews them: default lifetimes when none is set.
for (const d of Object.values(STATUSES)) {
  if (d.soft && !d.years) d.years = d.kind === 'benefiting' ? [4, 10] : [3, 8];
}

export const SOFT_TAGS = Object.entries(STATUSES).filter(([, d]) => d.soft).map(([id]) => id);
export const MAX_SOFT = 6;
