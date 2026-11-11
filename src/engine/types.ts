export type Sex = 'male' | 'female';
export type Stage = 'baby' | 'child' | 'teen' | 'young' | 'adult' | 'senior';
export type WealthTier = 'rags' | 'regular' | 'wealthy';
export type HealthTier = 'healthy' | 'normal' | 'sick';
export type Skin = 'pale' | 'light' | 'medium' | 'brown' | 'dark';
export type IncomeTier = 'low' | 'lowerMid' | 'upperMid' | 'high';
export type CareSystem = 'universal' | 'mixed' | 'private';
export type StatKey = 'health' | 'money' | 'happiness';
export type Stats = Record<StatKey, number>;
export type Relationship = 'single' | 'dating' | 'engaged' | 'married' | 'divorced' | 'widowed';
export type Polarity = 'good' | 'bad';
export type HardStart = 'poverty' | 'disability';
export type Category = 'health' | 'accident' | 'violence' | 'disaster' | 'money' | 'work' | 'education' | 'love' | 'family' | 'social' | 'luck';

export type TraitId =
  | 'reckless' | 'cautious' | 'charming' | 'awkward' | 'ambitious' | 'lazy' | 'brilliant' | 'dim' | 'athletic' | 'sickly'
  | 'hot_tempered' | 'gentle' | 'greedy' | 'lucky' | 'unlucky' | 'devout' | 'rebellious' | 'anxious' | 'resilient' | 'beautiful' | 'funny';
export type Dream = 'wealth' | 'family' | 'fame' | 'adventure' | 'long_life' | 'love';

export type Sector =
  | 'farming' | 'labour' | 'factory' | 'domestic' | 'street' | 'service' | 'office' | 'skilled'
  | 'professional' | 'public' | 'creative' | 'crime' | 'business' | 'military';
export interface Job {
  title: string; // LLM-written
  sector: Sector;
  level: number; // 1..5, promotions move it up
  since: number;
}

export type HomeKind = 'street' | 'slum' | 'room' | 'flat' | 'house' | 'mansion';
export interface Home {
  kind: HomeKind; // engine-owned rung of the housing ladder
  owned: boolean;
  desc: string; // LLM-written, consistent with kind
  place: string; // LLM-written town or city
}

export type Role = 'mother' | 'father' | 'sibling' | 'child' | 'ex' | 'friend' | 'rival' | 'mentor' | 'boss' | 'other';
/** Someone in the life's cast. Ages are relative: age = player age - bornAge. */
export interface Person {
  id: number;
  name: string;
  role: Role;
  sex: Sex;
  bornAge: number;
  alive: boolean;
  note: string; // LLM-kept one-liner about the relationship
}

/** Real-world-ish country statistics that drive event odds. */
export interface CountryStats {
  homicide: number; // per 100k per year
  road: number; // road deaths per 100k per year
  malaria: 0 | 1 | 2 | 3;
  conflict: 0 | 1 | 2 | 3;
  quake: 0 | 1 | 2 | 3;
  flood: 0 | 1 | 2 | 3;
  drought: 0 | 1 | 2 | 3;
  heat: 0 | 1 | 2 | 3;
  tfr: number; // births per woman
  mmr: number; // maternal deaths per 100k births
  hiv: number; // adult prevalence %
  childMarriage: number; // % of women married before 18
  conscription: 0 | 1 | 2; // 2 = lottery (Thailand)
  divorce: number; // relative to the US
  smoking: number; // % of men who smoke
  obesity: number; // % of adults
  prison: number; // incarcerated per 100k
}

export interface Country {
  code: string;
  name: string;
  births: number; // thousands per year, approx. 2024
  tier: IncomeTier;
  lifeExp: number;
  care: CareSystem;
  flag: string;
  x: CountryStats;
}

export interface Partner {
  name: string;
  country: string; // country code
  sex: Sex;
  bornAge: number;
  note: string;
}

/** An ongoing condition: illness, situation or advantage. */
export interface Status {
  id: string;
  label: string;
  since: number;
  until?: number; // age when it ends on its own
}

/** Multipliers a world event applies to tagged events while it lasts. */
export interface WorldFx {
  conflict?: number; // sets the country's conflict level
  infection?: number;
  hiv?: number;
  economy?: number; // layoffs, bankruptcies, debt
  famine?: number;
  violence?: number;
  arrest?: number;
  drugs?: number;
  automation?: number; // layoffs in office, service and factory jobs
  disaster?: 'quake' | 'flood' | 'tsunami' | 'storm'; // one-off: strikes in the first year
  draft?: number; // extra conscription odds for young men
  care?: number; // added to care quality (medical breakthroughs)
}

export interface WorldEvent {
  id: string;
  label: string;
  from: number; // calendar years, inclusive
  to: number;
  where: string[] | 'ALL';
  fx: WorldFx;
}

export interface YearRecord {
  age: number;
  year: number;
  title: string;
  text: string;
  events?: string[];
  good?: boolean;
  deltas: Partial<Stats>;
  kind: 'birth' | 'year' | 'choice' | 'montage';
  toAge?: number; // for montages
}

export interface Tally {
  maxMoney: number;
  marriedYears: number;
  countries: string[];
  trips: number;
  wasFamous: boolean;
}

export interface Life {
  seed: number;
  rng: number; // RNG state, so a saved life replays identically
  name: string;
  sex: Sex;
  skin: Skin;
  birthYear: number;
  birthCountry: string;
  country: string;
  rural: boolean;
  familyPct: number;
  traits: TraitId[];
  dream: Dream | null;
  age: number;
  stats: Stats;
  relationship: Relationship;
  partner: Partner | null;
  cast: Person[];
  nextPersonId: number;
  job: Job | null;
  home: Home;
  statuses: Status[];
  facts: string[];
  story: string; // LLM-kept rolling summary
  threads: string[]; // LLM-kept open storylines
  future: WorldEvent[]; // generated world events after the present day
  history: YearRecord[];
  respins: number;
  hardStarts: HardStart[];
  momentum: { value: number; until: number };
  nextChoiceAge: number;
  doneOnce: string[]; // ids of once-in-a-life events already rolled
  tally: Tally;
  statSum: { money: number; happiness: number; years: number };
  dead: boolean;
  causeOfDeath: string;
  epilogue?: Epilogue;
}

export interface Epilogue {
  headline: string;
  text: string;
  legacy: string;
  epitaph: string;
}

export type EffectName =
  | 'newPartner' | 'engaged' | 'married' | 'arranged' | 'breakup' | 'divorce' | 'widowed'
  | 'kid' | 'personDies' | 'newPerson' | 'newJob' | 'promotion' | 'demotion' | 'fired' | 'retire' | 'migrate'
  | 'business' | 'crimeJob' | 'evicted' | 'homeUp' | 'homeDown' | 'buyHome' | 'loseHome' | 'toCity' | 'deported' | 'emigrate';

/** Somebody an event is about, picked by the engine from the cast. */
export interface Target {
  id: number;
  name: string;
  role: Role | 'partner';
  age: number;
}

/** One event rolled for this year, with its outcome already decided. */
export interface RolledEvent {
  id: string;
  title: string;
  cat: Category;
  question?: string; // shown above the gauge
  outcome: { id: string; label: string; good: boolean } | null;
  spin: { pGood: number; roll: number; goodLabel: string; badLabel: string } | null;
  good: boolean;
  deltas: Partial<Stats>;
  add: string[];
  remove: string[];
  effect?: EffectName;
  death?: string;
  target?: Target;
  newPerson?: { role: Role | 'partner'; sex: Sex; country: string };
  moveTo?: string; // country code for migration effects
  thread?: boolean; // resolves one of the open story threads
}

export interface EventsPlan {
  kind: 'year';
  age: number;
  year: number;
  events: RolledEvent[];
  world: WorldEvent[]; // world events that start this year where you live
  rngAfter: number;
}

/** Several quiet years told as one card. */
export interface MontagePlan {
  kind: 'montage';
  age: number; // first year
  toAge: number;
  year: number;
  years: EventsPlan[];
  rngAfter: number;
}

export interface ChoiceOption {
  gist: string; // what the option does, for the LLM to turn into a label
  deltas: Partial<Stats>;
  move?: string; // country code
  relationship?: Relationship;
  dropPartner?: boolean;
  job?: Sector | 'auto' | 'none';
  add?: string[];
  remove?: string[];
  gamble?: { stat: StatKey; amount: number }; // bold: wins with luck, loses otherwise
  momentum?: number;
  dream?: Dream;
  death?: { odds: number; cause: string }; // a risky option can kill you outright
}

export interface ChoicePlan {
  kind: 'choice';
  age: number;
  year: number;
  domain: string;
  situation: string;
  options: ChoiceOption[];
  rngAfter: number;
}

export type YearPlan = EventsPlan | ChoicePlan | MontagePlan;

/** A person the LLM introduces or updates. */
export interface PersonUpdate {
  name: string;
  note: string;
}

/** What the LLM writes for a year, including its share of the status bookkeeping. */
export interface YearText {
  title: string;
  text: string;
  fact: string;
  home?: string;
  place?: string;
  job?: string;
  statusAdd?: { tag: string; label: string }[];
  statusRemove?: string[];
  newNames?: string[]; // names for the people this year's events create, in order
  newPerson?: { role: Role; name: string; note: string } | null; // someone the story introduces
  people?: PersonUpdate[];
  story?: string;
  threads?: string[];
}

export interface ChoiceText {
  title: string;
  text: string;
  labels: string[];
}

export interface YearResult {
  died: boolean;
  cause: string;
  added: string[];
  removed: string[];
  gambleWon?: boolean;
  born?: string[]; // names of people who appeared
  lost?: string[]; // names of people who died
}
