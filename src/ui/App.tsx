import { useCallback, useSyncExternalStore } from 'react';
import { game, type Card } from './game';
import { Gauge } from './components/Gauge';
import { Avatar } from './components/Avatar';
import { StatBars } from './components/StatBars';
import { StatusPanel } from './components/StatusPanel';
import { PeoplePanel } from './components/PeoplePanel';
import { countryByCode } from '../data/world';
import { STATUSES } from '../data/statuses';
import { DREAMS, TRAITS } from '../data/traits';
import { CONFIG } from '../engine/config';
import { dreamCameTrue, moneyLabel, score } from '../engine/life';
import type { Category, ChoiceText, Life, RolledEvent } from '../engine/types';

const ICON: Record<Category, string> = {
  health: '🩺', accident: '🚑', violence: '🔪', disaster: '🌪', money: '💰', work: '💼',
  education: '🎓', love: '❤', family: '👪', social: '🫂', luck: '🍀',
};

export function App() {
  useSyncExternalStore(game.subscribe, game.getVersion);
  return (
    <main className="app">
      {game.screen === 'title' && <TitleScreen />}
      {game.screen === 'birth' && game.life && <BirthScreen life={game.life} />}
      {game.screen === 'year' && game.life && <YearScreen life={game.life} />}
      {game.screen === 'death' && game.life && <DeathScreen life={game.life} />}
    </main>
  );
}

function TitleScreen() {
  return (
    <section className="screen title-screen">
      <div className="title-block">
        <h1 className="logo">ODDS<br />OF LIFE</h1>
        <p className="tagline">8 billion tickets. One of them is yours. Spin your way to 100, or die trying.</p>
      </div>
      <button className="btn btn-main" onClick={() => game.start()}>Be born</button>
      <div className="backend">
        <span>Born when</span>
        <div className="segmented">
          <button className={game.era === 'random' ? 'on' : ''} onClick={() => game.setEra('random')}>Any year since 1950</button>
          <button className={game.era === 'today' ? 'on' : ''} onClick={() => game.setEra('today')}>Today</button>
        </div>
        {import.meta.env.DEV && (
          <>
            <span>Narrator</span>
            <div className="segmented">
              <button className={game.backend === 'deepseek' ? 'on' : ''} onClick={() => game.setBackend('deepseek')}>DeepSeek</button>
              <button className={game.backend === 'local' ? 'on' : ''} onClick={() => game.setBackend('local')}>Local LFM3</button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function Header({ life }: { life: Life }) {
  const c = countryByCode(life.country);
  return (
    <header className="hud">
      <div className="hud-who">
        <strong>{life.name}</strong>
        <span>{life.birthYear + life.age} · age {life.age}</span>
      </div>
      <div className="hud-where" title={c.name}>
        <span className="flag">{c.flag}</span> {c.name}
      </div>
      <div className="hud-respins" title="Respins left">🎲 {life.respins}</div>
    </header>
  );
}

function BirthScreen({ life }: { life: Life }) {
  const c = countryByCode(life.birthCountry);
  const b = game.birth;
  const m = game.miracle;
  const onMiracleDone = useCallback(() => game.miracleDone(), []);
  return (
    <section className="screen">
      <Header life={life} />
      <div className="birth-reveal">
        <span className="birth-flag">{c.flag}</span>
        <div>
          <div className="eyebrow">You were born in {life.birthYear}, in</div>
          <h2 className="birth-country">{c.name}</h2>
          <div className="birth-meta">{life.sex === 'male' ? 'Boy' : 'Girl'} · {moneyLabel(life.stats.money)} family · {life.rural ? 'village' : 'city'}</div>
        </div>
      </div>
      <div className="chips trait-chips">
        {life.traits.map((t) => <span key={t} className="chip chip-trait">{TRAITS[t].label}</span>)}
      </div>
      <Avatar life={life} />
      <StatBars stats={life.stats} />
      {b ? (
        <div className="card">
          <div className="card-age">{life.birthYear} · birth{b.source === 'fallback' && <span className="tag">offline text</span>}</div>
          <h3>{b.text.title}</h3>
          <p>{b.text.text}</p>
        </div>
      ) : <div className="card writing">Writing your arrival…</div>}
      {b && <StatusPanel life={life} />}
      {b && <PeoplePanel life={life} open />}
      {life.hardStarts.length > 0 && !(m && m.result.won) && (
        <div className="hard-start">
          <h3>Hard start</h3>
          <p>
            {life.hardStarts.map((h) => (h === 'poverty' ? `Born poor in ${c.name}.` : 'Born with a disability.')).join(' ')} Disease, hunger and
            bad luck hit the poor harder and kill them younger. Play it for the challenge, gamble a respin on a miracle, or try another birth.
          </p>
          {m && (
            <Gauge pGood={m.result.odds} outcome={m.result.won ? 'good' : 'bad'} spinId={game.spinId} spinning={m.spinning} onDone={onMiracleDone}
              goodLabel={m.kind === 'poverty' ? 'rich family' : 'fame'} badLabel="no miracle" />
          )}
          {m && !m.spinning && <p className={m.result.won ? 'good-text' : 'bad-text'}>{m.result.text}</p>}
          <div className="row">
            {life.hardStarts.map((h) => (
              <button key={h} className="btn btn-alt" disabled={life.respins <= 0 || !!m?.spinning} onClick={() => game.spinMiracle(h)}>
                Miracle spin ({Math.round(CONFIG.miracleOdds[h] * 100)}%{h === 'poverty' ? ', rich family' : ', fame'})
              </button>
            ))}
          </div>
        </div>
      )}
      {m?.result.won && !m.spinning && <p className="good-text center">{m.result.text}</p>}
      <div className="actions">
        <button className="btn btn-ghost" onClick={() => game.start()} disabled={!!m?.spinning}>Reroll birth</button>
        <button className="btn btn-main" onClick={() => game.beginLife()} disabled={!!m?.spinning || !b}>Live this life</button>
      </div>
    </section>
  );
}

function EventChips({ events, hidden = [], current = -1 }: { events: RolledEvent[]; hidden?: number[]; current?: number }) {
  return (
    <ul className="event-list">
      {events.map((e, i) => {
        const shown = !hidden.includes(i);
        return (
          <li key={i} className={`ev ${i === current ? 'ev-current' : ''} ${shown ? (e.good ? 'ev-good' : 'ev-bad') : 'ev-pending'}`}>
            <span className="ev-icon" aria-hidden>{ICON[e.cat]}</span>
            <span className="ev-title">{e.title}{e.target ? ` · ${e.target.name}` : ''}</span>
            {shown && e.outcome && <span className="ev-outcome">{e.outcome.label}</span>}
          </li>
        );
      })}
    </ul>
  );
}

function YearScreen({ life }: { life: Life }) {
  const plan = game.plan;
  const step = game.step;
  const onSpinDone = useCallback(() => game.spinDone(), []);
  const yp = game.yearPlan;
  const spin = game.currentSpin;
  const inSpin = step === 'spinning' || step === 'spun';
  const label = !plan ? '' : plan.kind === 'choice' ? `Age ${plan.age}: a decision` : plan.kind === 'montage' ? `Live ages ${plan.age} to ${plan.toAge}` : `Live age ${plan.age}`;

  return (
    <section className="screen">
      <Header life={life} />
      <Avatar life={life} />
      <StatBars stats={life.stats} deltas={step === 'ready' ? game.card?.deltas : undefined} />
      <StatusPanel life={life} fresh={step === 'ready' ? game.card?.added : []} />
      <PeoplePanel life={life} />

      {inSpin && yp && spin?.spin && (
        <div className="spin-box">
          <div className="card-age">{yp.year} · age {yp.age} · {yp.events.length} event{yp.events.length > 1 ? 's' : ''} this year</div>
          <EventChips events={yp.events} current={game.spinOrder[game.spinCursor]}
            hidden={game.spinOrder.filter((_, k) => k > game.spinCursor || (k === game.spinCursor && step === 'spinning'))} />
          <h3 className="spin-q">{ICON[spin.cat]} {spin.title}{spin.target ? ` (${spin.target.name})` : ''}: {spin.question ?? 'How does it turn out?'}</h3>
          <Gauge pGood={spin.spin.pGood} outcome={spin.spin.roll < spin.spin.pGood ? 'good' : 'bad'} spinId={game.spinId} spinning={step === 'spinning'}
            onDone={onSpinDone} goodLabel={spin.spin.goodLabel} badLabel={spin.spin.badLabel} />
          {step === 'spun' && spin.outcome && <p className={`spin-result ${spin.good ? 'good-text' : 'bad-text'}`}>→ {spin.outcome.label}{spin.death ? '. This kills you.' : ''}</p>}
        </div>
      )}
      {step === 'writing' && (
        <div className="card writing">
          {yp && yp.events.length > 0 && <EventChips events={yp.events} />}
          Fate is writing {plan?.kind === 'montage' ? 'these years' : 'your year'}…
        </div>
      )}
      {step === 'ready' && <CardView card={game.card} />}
      {step === 'choosing' && plan?.kind === 'choice' && <ChoiceView life={life} />}

      <div className="actions">
        {step === 'ready' && !life.dead && plan && (
          <>
            <button className="btn btn-ghost" onClick={() => game.start()}>Give up</button>
            <button className="btn btn-main" onClick={() => game.live()}>{label}</button>
          </>
        )}
        {step === 'ready' && life.dead && <button className="btn btn-main" onClick={() => game.showDeath()}>See how it ended</button>}
        {step === 'spun' && (
          <>
            {game.canRespin() && <button className="btn btn-alt" onClick={() => game.respin()}>Respin ({life.respins} left)</button>}
            <button className="btn btn-main" onClick={() => game.nextSpin()}>{spin?.good ? 'Phew' : 'Accept fate'}</button>
          </>
        )}
      </div>
      <footer className="writer-note">
        {game.notice ?? (
          <>
            {game.backend === 'local' ? 'Local LFM3-1.7B' : 'DeepSeek'}
            {game.lastWriteMs ? ` · last card ${(game.lastWriteMs / 1000).toFixed(1)}s` : ''}
          </>
        )}
      </footer>
    </section>
  );
}

function ChoiceView({ life }: { life: Life }) {
  const plan = game.plan;
  const w = game.planText;
  if (plan?.kind !== 'choice') return null;
  if (!w) return <div className="card writing">A decision is taking shape…</div>;
  const t = w.text as ChoiceText;
  return (
    <div className="card card-choice">
      <div className="card-age">{plan.year} · age {plan.age} · decision</div>
      <h3>{t.title}</h3>
      <p>{t.text}</p>
      <div className="choice-options">
        {t.labels.map((label, i) => (
          <button key={i} className="btn btn-option" onClick={() => game.choose(i)} disabled={life.dead}>
            {label}
            {plan.options[i].death && <span className="risk"> · could kill you</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

function CardView({ card }: { card: Card | null }) {
  if (!card) return null;
  const tone = card.events?.length ? (card.events.every((e) => e.good) ? 'card-good' : card.events.some((e) => !e.good) ? 'card-bad' : '') : '';
  const label = (id: string) => STATUSES[id]?.label ?? id;
  const shownAdded = (card.added ?? []).filter((id) => id !== 'homeowner' && id !== 'homeless');
  const shownRemoved = (card.removed ?? []).filter((id) => id !== 'homeowner' && id !== 'homeless');
  return (
    <div className={`card ${tone}`}>
      <div className="card-age">
        {card.toAge && card.toAge !== card.age ? `${card.year} to ${card.year + card.toAge - card.age} · ages ${card.age} to ${card.toAge}` : `${card.year} · age ${card.age}`}
        {card.events && card.events.length === 0 && !card.news?.length && <span className="tag">quiet year</span>}
        {card.source === 'fallback' && <span className="tag">offline text</span>}
      </div>
      {card.news && card.news.length > 0 && <div className="news">🌍 {card.news.join(' · ')}</div>}
      {card.events && card.events.length > 0 && <EventChips events={card.events} />}
      <h3>{card.title}</h3>
      <p>{card.text}</p>
      {card.note && <p className="card-note">{card.note}</p>}
      {(card.born?.length || card.lost?.length) ? (
        <div className="people-changes">
          {card.born?.map((n) => <span key={`b${n}`} className="chip chip-benefiting">+ {n}</span>)}
          {card.lost?.map((n) => <span key={`l${n}`} className="chip chip-gone">† {n}</span>)}
        </div>
      ) : null}
      {(shownAdded.length || shownRemoved.length) ? (
        <div className="status-changes">
          {shownAdded.map((id) => <span key={`a${id}`} className={`chip chip-${STATUSES[id]?.kind}`}>+ {label(id)}</span>)}
          {shownRemoved.map((id) => <span key={`r${id}`} className="chip chip-gone">− {label(id)}</span>)}
        </div>
      ) : null}
      {card.died && <div className="card-died">☠ You died of {card.died} at {card.toAge ?? card.age}.</div>}
    </div>
  );
}

function DeathScreen({ life }: { life: Life }) {
  const born = countryByCode(life.birthCountry);
  const died = countryByCode(life.country);
  const e = life.epilogue;
  const dream = dreamCameTrue(life);
  return (
    <section className="screen death-screen">
      <div className="death-head">
        <div className="eyebrow">{life.birthYear} to {life.birthYear + life.age}</div>
        <h2>{life.name}</h2>
        <p>Died at {life.age} of {life.causeOfDeath} in {died.flag} {died.name}. Born in {born.flag} {born.name}.</p>
      </div>
      <Avatar life={life} />
      {e ? (
        <div className="card obituary">
          <div className="card-age">Obituary</div>
          <h3>{e.headline}</h3>
          {e.text && <p>{e.text}</p>}
          {e.legacy && <p className="card-note">{e.legacy}</p>}
          <p className="epitaph">“{e.epitaph}”</p>
        </div>
      ) : <div className="card writing">{game.epilogueLoading ? 'The local paper is writing your obituary…' : ''}</div>}
      <div className="score">
        <span>Score</span>
        <strong>{score(life)}</strong>
        <small>
          age × how well off and happy you were
          {life.dream ? ` · dream "${DREAMS[life.dream].label}" ${dream ? 'came true (+25%)' : 'never came true'}` : ''}
        </small>
      </div>
      <StatBars stats={life.stats} />
      <StatusPanel life={life} />
      <PeoplePanel life={life} open />
      {life.facts.length > 0 && (
        <div className="card">
          <h3>A life in facts</h3>
          <ul className="facts">{life.facts.map((f, i) => <li key={i}>{f}</li>)}</ul>
        </div>
      )}
      <div className="card timeline">
        <h3>Year by year</h3>
        <ol>
          {life.history.map((h, i) => (
            <li key={i} className={h.good === undefined ? '' : h.good ? 't-good' : 't-bad'}>
              <span className="t-age">{h.age}{h.toAge ? ` to ${h.toAge}` : ''}</span> {h.title}
              {h.events && h.events.length > 0 && <span className="t-events">{h.events.join(' · ')}</span>}
            </li>
          ))}
        </ol>
      </div>
      <div className="actions">
        <button className="btn btn-ghost" onClick={() => game.quit()}>Title</button>
        <button className="btn btn-main" onClick={() => game.start()}>Live again</button>
      </div>
    </section>
  );
}
