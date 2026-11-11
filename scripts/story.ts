// Plays one full life with DeepSeek and writes a readable report: every card with the
// rolled events, status and cast changes, and the obituary. Used to judge storytelling.
//   npx tsx scripts/story.ts [seed] [maxYears] [birthYear]
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { newLife } from '../src/engine/life';
import { planYear } from '../src/engine/plan';
import { applyChoice, applyMontage, applyYear } from '../src/engine/apply';
import { writeBirth, writeChoice, writeEpilogue, writeYear } from '../src/llm/writer';
import type { LlmConfig } from '../src/llm/client';
import { countryByCode } from '../src/data/world';
import { TRAITS } from '../src/data/traits';
import type { ChoiceText, YearText } from '../src/engine/types';

const seed = Number(process.argv[2] ?? Date.now() % 100000);
const maxYears = Number(process.argv[3] ?? 100);
const birthYear = process.argv[4] ? Number(process.argv[4]) : undefined;
const env = Object.fromEntries(readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n').filter(Boolean).map((l) => l.split('=') as [string, string]));
const cfg: LlmConfig = { backend: 'deepseek', baseUrl: 'https://api.deepseek.com', apiKey: env.DEEPSEEK_API_KEY, timeoutMs: 90000, temperature: 1.0 };

const life = newLife(seed, { birthYear });
const out: string[] = [];
const times: number[] = [];
let fallbacks = 0;
const t0 = Date.now();

const b = await writeBirth(cfg, life);
if (b.text.name) life.name = b.text.name;
b.text.family.forEach((f, i) => { if (life.cast[i]) { life.cast[i].name = f.name || life.cast[i].name; life.cast[i].note = f.note; } });
life.home.desc = b.text.home; life.home.place = b.text.place; life.story = b.text.story; life.threads = b.text.threads;
life.history.push({ age: 0, year: life.birthYear, title: b.text.title, text: b.text.text, deltas: {}, kind: 'birth' });
out.push(`# ${life.name}, born ${life.birthYear} in ${countryByCode(life.birthCountry).name}`,
  `${life.sex}, ${life.traits.map((t) => TRAITS[t].label).join(' and ')}, ${life.rural ? 'village' : 'city'}, hard start: ${life.hardStarts.join(', ') || 'none'}`,
  `Family: ${life.cast.map((p) => `${p.role} ${p.name} (${p.note})`).join('; ')}`, '',
  `## ${life.birthYear} · birth: ${b.text.title}`, b.text.text, `_home: ${life.home.desc}, ${life.home.place} · threads: ${life.threads.join(' | ') || 'none'}_`, '');

let n = 0;
while (!life.dead && n++ < maxYears) {
  const plan = planYear(life);
  if (plan.kind === 'choice') {
    const w = await writeChoice(cfg, life, plan);
    const pick = (seed + plan.age) % plan.options.length;
    const r = applyChoice(life, plan, pick, w.text as ChoiceText);
    out.push(`## ${plan.year} · age ${plan.age} · DECISION: ${w.text.title}`, w.text.text, `Options: ${w.text.labels.map((l, i) => (i === pick ? `**${l}**` : l)).join(' / ')}${r.gambleWon === undefined ? '' : r.gambleWon ? ' → paid off' : ' → backfired'}`, '');
    if (w.source === 'llm') times.push(w.ms); else fallbacks++;
    continue;
  }
  const w = await writeYear(cfg, life, plan);
  if (w.source === 'llm') times.push(w.ms); else fallbacks++;
  const t = w.text as YearText;
  if (plan.kind === 'montage') {
    const r = applyMontage(life, plan, t);
    out.push(`## ${plan.year}–${life.birthYear + life.age} · ages ${plan.age}–${life.age} · ${t.title}`, t.text, r.died ? `**Died: ${r.cause}**` : '');
  } else {
    const events = plan.events.map((e) => `${e.title}${e.target ? ` (${e.target.name})` : ''}${e.outcome ? ` → ${e.outcome.label}` : ''}`).join(' | ');
    const r = applyYear(life, plan, t);
    out.push(`## ${plan.year} · age ${plan.age} · ${t.title}`, `\`${events || 'quiet year'}\`${plan.world.length ? ` 🌍 ${plan.world.map((x) => x.label).join('; ')}` : ''}`, t.text,
      [r.born?.length ? `+people: ${r.born.join(', ')}` : '', r.lost?.length ? `†: ${r.lost.join(', ')}` : '', r.added.length ? `+status: ${r.added.join(', ')}` : '', r.removed.length ? `−status: ${r.removed.join(', ')}` : '', r.died ? `**Died: ${r.cause}**` : ''].filter(Boolean).join(' · '));
  }
  out.push(`_health ${Math.round(life.stats.health)} · money ${Math.round(life.stats.money)} · happiness ${Math.round(life.stats.happiness)} · home: ${life.home.desc}, ${life.home.place} · job: ${life.job?.title ?? 'none'} · statuses: ${life.statuses.map((s) => s.id).join(',')} · threads: ${life.threads.join(' | ') || 'none'}_`, '');
  process.stdout.write(`${plan.kind} age ${plan.age} ${(w.ms / 1000).toFixed(1)}s ${w.source}${w.error ? ` ${w.error.slice(0, 160)}` : ''}\n`);
}
if (life.dead) {
  const e = await writeEpilogue(cfg, life);
  out.push(`# Obituary: ${e.text.headline}`, e.text.text, `Legacy: ${e.text.legacy}`, `Epitaph: “${e.text.epitaph}”`, '',
    `Story so far: ${life.story}`, `Cast: ${life.cast.map((p) => `${p.role} ${p.name}${p.alive ? '' : ' †'}: ${p.note}`).join('; ')}`);
}
const avg = times.reduce((a, b) => a + b, 0) / Math.max(1, times.length) / 1000;
const summary = `${times.length} cards, ${fallbacks} fallbacks, avg ${avg.toFixed(1)}s, total ${((Date.now() - t0) / 1000).toFixed(0)}s`;
out.splice(3, 0, summary);
mkdirSync(new URL('../reports', import.meta.url), { recursive: true });
const file = new URL(`../reports/story-${seed}.md`, import.meta.url);
writeFileSync(file, out.join('\n'));
console.log(`\n${summary}\nreport: ${file.pathname}`);
