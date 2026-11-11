import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import type { Polarity } from '../../engine/types';

const TILES = 64;
const TARGET = 54;
const TILE_W = 52;
const DURATION = 3400;
const pct = (p: number) => (p > 0 && p < 0.01 ? '<1%' : p < 1 && p > 0.99 ? '>99%' : `${Math.round(p * 100)}%`);

interface Props {
  pGood: number;
  outcome: Polarity;
  spinId: number;
  spinning: boolean;
  onDone: () => void;
  goodLabel?: string;
  badLabel?: string;
}

/** Case-opening strip: tiles scroll under a fixed marker and slow down onto the outcome. */
export function Gauge({ pGood, outcome, spinId, spinning, onDone, goodLabel = 'good', badLabel = 'bad' }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const tiles = useMemo(() => {
    let s = spinId * 9301 + 49297;
    const rnd = () => ((s = (s * 233280 + 12345) % 2147483647) % 10000) / 10000;
    const t = Array.from({ length: TILES }, () => (rnd() < pGood ? 'good' : 'bad'));
    t[TARGET] = outcome;
    return t;
  }, [spinId, pGood, outcome]);
  const jitter = useMemo(() => 0.12 + ((spinId * 7919) % 76) / 100, [spinId]);

  useLayoutEffect(() => {
    const el = strip.current;
    const w = box.current?.clientWidth ?? 320;
    if (!el) return;
    const end = -(TARGET * TILE_W + jitter * TILE_W - w / 2);
    if (!spinning) {
      el.style.transition = 'none';
      el.style.transform = `translateX(${end}px)`;
      return;
    }
    el.style.transition = 'none';
    el.style.transform = `translateX(${w / 2 - TILE_W * 2}px)`;
    void el.offsetWidth; // restart from the left before animating
    el.style.transition = `transform ${DURATION}ms cubic-bezier(0.06, 0.72, 0.16, 1)`;
    el.style.transform = `translateX(${end}px)`;
  }, [spinId, spinning, jitter]);

  useEffect(() => {
    if (!spinning) return;
    const t = setTimeout(onDone, DURATION + 150);
    return () => clearTimeout(t);
  }, [spinId, spinning, onDone]);

  return (
    <div className="gauge">
      <div className="gauge-window" ref={box}>
        <div className="gauge-strip" ref={strip}>
          {tiles.map((t, i) => (
            <div key={i} className={`gauge-tile ${t}`} style={{ width: TILE_W }}>
              {t === 'good' ? '✚' : '✖'}
            </div>
          ))}
        </div>
        <div className="gauge-marker" />
      </div>
      <div className="gauge-odds">
        <span className="good-text">{pct(pGood)} {goodLabel}</span>
        <span className="bad-text">{pct(1 - pGood)} {badLabel}</span>
      </div>
    </div>
  );
}
