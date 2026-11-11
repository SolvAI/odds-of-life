import { newLife, miracleSpin, type MiracleResult } from '../engine/life';
import { planYear, respinEvent } from '../engine/plan';
import { applyChoice, applyMontage, applyYear } from '../engine/apply';
import { PRESENT } from '../engine/world';
import { writeBirth, writeChoice, writeEpilogue, writeYear, type BirthText, type Written } from '../llm/writer';
import type { Backend, LlmConfig } from '../llm/client';
import type { ChoicePlan, ChoiceText, EventsPlan, HardStart, Life, RolledEvent, Stats, YearPlan, YearText } from '../engine/types';

export type Screen = 'title' | 'birth' | 'year' | 'death';
export type Step = 'ready' | 'spinning' | 'spun' | 'writing' | 'choosing';
export type Era = 'random' | 'today';

/** What the big card in the middle of the screen shows after a year is applied. */
export interface Card {
  age: number;
  toAge?: number;
  year: number;
  title: string;
  text: string;
  events?: RolledEvent[];
  news?: string[];
  deltas?: Partial<Stats>;
  added?: string[];
  removed?: string[];
  born?: string[];
  lost?: string[];
  note?: string;
  died?: string;
  source?: 'llm' | 'fallback';
}

export interface MiracleState {
  kind: HardStart;
  result: MiracleResult;
  spinning: boolean;
}

const CONFIGS: Record<Backend, LlmConfig> = {
  local: { backend: 'local', baseUrl: '/llm', timeoutMs: 40000, temperature: 0.6 },
  // '/narrate' is served by the Vite dev server; production builds point at the Cloudflare Worker.
  deepseek: { backend: 'deepseek', baseUrl: import.meta.env.VITE_NARRATOR_URL || '/narrate', timeoutMs: 45000, temperature: 1.0 },
};

const load = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const save = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode: the setting just won't persist */
  }
};

export class Game {
  screen: Screen = 'title';
  step: Step = 'ready';
  life: Life | null = null;
  card: Card | null = null;
  birth: Written<BirthText> | null = null;
  plan: YearPlan | null = null;
  planText: Written<YearText | ChoiceText> | null = null;
  spinOrder: number[] = []; // indices of events that get a gauge spin
  spinCursor = 0;
  miracle: MiracleState | null = null;
  spinId = 0;
  backend: Backend = import.meta.env.DEV && load('ool.backend') === 'local' ? 'local' : 'deepseek';
  era: Era = load('ool.era') === 'today' ? 'today' : 'random';
  notice: string | null = null; // set when the narrator endpoint rate-limits us
  lastWriteMs = 0;
  epilogueLoading = false;
  private version = 0;
  private listeners = new Set<() => void>();
  private writeToken = 0;

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getVersion = () => this.version;
  private emit() {
    this.version++;
    this.listeners.forEach((fn) => fn());
  }

  setBackend(b: Backend) {
    this.backend = b;
    save('ool.backend', b);
    this.emit();
  }

  setEra(e: Era) {
    this.era = e;
    save('ool.era', e);
    this.emit();
  }

  private get cfg() {
    return CONFIGS[this.backend];
  }

  /** Remember why the narrator fell back to plain text, so the player knows it isn't a bug. */
  private track(w: Written<unknown>) {
    if (w.source === 'llm') this.notice = null;
    else if (w.error?.includes('HTTP 429')) {
      this.notice = w.error.includes('burst')
        ? 'Too fast for the narrator, so that card is plain text.'
        : "The narrator's daily budget is used up. Cards stay plain text until midnight UTC.";
    }
  }

  get yearPlan(): EventsPlan | null {
    return this.plan?.kind === 'year' ? this.plan : null;
  }

  get currentSpin(): RolledEvent | null {
    const p = this.yearPlan;
    return p ? p.events[this.spinOrder[this.spinCursor]] ?? null : null;
  }

  start() {
    this.life = newLife((Math.random() * 2 ** 31) | 0, { birthYear: this.era === 'today' ? PRESENT : undefined });
    this.miracle = null;
    this.birth = null;
    this.card = null;
    this.screen = 'birth';
    this.emit();
    this.writeBirthCard();
  }

  private writeBirthCard() {
    const life = this.life!;
    const token = ++this.writeToken;
    this.birth = null;
    writeBirth(this.cfg, life).then((w) => {
      if (token !== this.writeToken || this.life !== life) return;
      this.track(w);
      this.birth = w;
      // The narrator names you and your family, and sets the scene.
      if (w.text.name && /^[\p{L}' .-]{2,30}$/u.test(w.text.name)) life.name = w.text.name;
      w.text.family.forEach((f, i) => {
        const p = life.cast[i];
        if (p && f.name) p.name = f.name;
        if (p && f.note) p.note = p.alive ? f.note : `${f.note} (gone before you were born)`;
      });
      if (w.text.home) life.home.desc = w.text.home;
      if (w.text.place) life.home.place = w.text.place;
      if (w.text.story) life.story = w.text.story;
      life.threads = w.text.threads;
      this.emit();
    });
  }

  spinMiracle(kind: HardStart) {
    const life = this.life!;
    if (life.respins <= 0) return;
    this.miracle = { kind, result: miracleSpin(life, kind), spinning: true };
    this.spinId++;
    this.emit();
  }

  miracleDone() {
    if (!this.miracle) return;
    this.miracle.spinning = false;
    if (this.miracle.result.won) this.writeBirthCard();
    this.emit();
  }

  beginLife() {
    const life = this.life!;
    const b = this.birth?.text;
    if (b) life.history.push({ age: 0, year: life.birthYear, title: b.title, text: b.text, deltas: {}, kind: 'birth' });
    this.card = b ? { age: 0, year: life.birthYear, title: b.title, text: b.text, source: this.birth?.source } : null;
    this.screen = 'year';
    this.prepareNext();
  }

  /** Plan next year and start writing its card right away, while the player reads. */
  private prepareNext() {
    this.plan = planYear(this.life!);
    this.planText = null;
    this.step = 'ready';
    this.writePlan();
    this.emit();
  }

  private writePlan() {
    const life = this.life!;
    const plan = this.plan!;
    const token = ++this.writeToken;
    const job = plan.kind === 'choice' ? writeChoice(this.cfg, life, plan) : writeYear(this.cfg, life, plan);
    job.then((w) => {
      if (token !== this.writeToken) return;
      this.track(w);
      this.planText = w;
      this.lastWriteMs = w.ms;
      if (this.step === 'writing') this.finishYear();
      else this.emit();
    });
  }

  /** Main button: open the decision, or roll into the year's gauges. */
  live() {
    const plan = this.plan;
    if (!plan) return;
    if (plan.kind === 'choice') {
      this.step = 'choosing';
      return this.emit();
    }
    this.spinOrder = plan.kind === 'year' ? plan.events.map((e, i) => (e.spin ? i : -1)).filter((i) => i >= 0) : [];
    this.spinCursor = 0;
    if (this.spinOrder.length) {
      this.step = 'spinning';
      this.spinId++;
      this.emit();
    } else {
      this.step = 'writing';
      this.finishYear();
    }
  }

  spinDone() {
    this.step = 'spun';
    this.emit();
  }

  canRespin() {
    const e = this.currentSpin;
    return this.step === 'spun' && !!e && !e.good && (this.life?.respins ?? 0) > 0;
  }

  respin() {
    if (!this.canRespin()) return;
    this.plan = respinEvent(this.life!, this.yearPlan!, this.spinOrder[this.spinCursor]);
    this.planText = null;
    this.writePlan();
    this.step = 'spinning';
    this.spinId++;
    this.emit();
  }

  /** Accept the current gauge result and move to the next one, or to the year card. */
  nextSpin() {
    if (this.spinCursor < this.spinOrder.length - 1 && !this.currentSpin?.death) {
      this.spinCursor++;
      this.step = 'spinning';
      this.spinId++;
      return this.emit();
    }
    this.step = 'writing';
    this.finishYear();
  }

  private finishYear() {
    const plan = this.plan;
    const w = this.planText as Written<YearText> | null;
    if (!plan || plan.kind === 'choice' || !w) return this.emit(); // the text is still being written
    const life = this.life!;
    if (plan.kind === 'montage') {
      const result = applyMontage(life, plan, w.text);
      this.card = {
        age: plan.age, toAge: life.age, year: plan.year, title: w.text.title, text: w.text.text, deltas: life.history.at(-1)?.deltas,
        added: result.added, removed: result.removed, died: result.died ? result.cause : undefined, source: w.source,
      };
    } else {
      const result = applyYear(life, plan, w.text);
      this.card = {
        age: plan.age, year: plan.year, title: w.text.title, text: w.text.text, events: plan.events, news: plan.world.map((x) => x.label),
        deltas: life.history.at(-1)?.deltas, added: result.added, removed: result.removed, born: result.born, lost: result.lost,
        died: result.died ? result.cause : undefined, source: w.source,
      };
    }
    this.afterYear();
  }

  choose(index: number) {
    const life = this.life!;
    const plan = this.plan as ChoicePlan;
    const w = this.planText as Written<ChoiceText> | null;
    if (!w) return;
    const result = applyChoice(life, plan, index, w.text);
    const label = w.text.labels[index] ?? plan.options[index].gist;
    const gamble = result.gambleWon === undefined ? '' : result.gambleWon ? ' It paid off.' : ' It blew up in your face.';
    this.card = {
      age: plan.age, year: plan.year, title: w.text.title, text: w.text.text, note: `You chose: ${label}.${gamble}`, deltas: life.history.at(-1)?.deltas,
      added: result.added, removed: result.removed, died: result.died ? result.cause : undefined, source: w.source,
    };
    this.afterYear();
  }

  private afterYear() {
    const life = this.life!;
    if (life.dead) {
      this.plan = null;
      this.step = 'ready';
      this.writeEpilogueCard();
      return this.emit();
    }
    this.prepareNext();
  }

  private writeEpilogueCard() {
    const life = this.life!;
    this.epilogueLoading = true;
    writeEpilogue(this.cfg, life).then((w) => {
      if (this.life !== life) return;
      this.track(w);
      life.epilogue = w.text;
      this.epilogueLoading = false;
      this.emit();
    });
  }

  showDeath() {
    this.screen = 'death';
    this.emit();
  }

  quit() {
    this.writeToken++;
    this.screen = 'title';
    this.life = null;
    this.emit();
  }
}

export const game = new Game();
