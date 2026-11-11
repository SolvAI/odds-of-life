import { useEffect, useRef, useState } from 'react';
import { healthTier, stageOf, wealthTier } from '../../engine/life';
import type { HealthTier, Life, Skin } from '../../engine/types';

// Every sprite is generated with medium tan skin; this recolors it per character.
const SKIN_RGB: Record<Skin, [number, number, number]> = {
  pale: [232, 196, 170],
  light: [224, 172, 138],
  medium: [198, 134, 66],
  brown: [141, 85, 36],
  dark: [82, 52, 32],
};

const EMOJI = { baby: '👶', child: '🧒', teen: '🧑', young: '🧑', adult: '🧑', senior: '🧓' };

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn;
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const f = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [f(p, q, h + 1 / 3) * 255, f(p, q, h) * 255, f(p, q, h - 1 / 3) * 255];
}

/** Skin = warm orange-tan pixels bright enough not to be hair or outline. */
function isSkin(r: number, g: number, b: number): boolean {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const v = mx / 255;
  const s = mx ? (mx - mn) / mx : 0;
  if (v < 0.45 || s < 0.12 || (v > 0.95 && s < 0.15)) return false;
  const d = mx - mn || 1;
  let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return h >= 8 && h <= 45;
}

function recolor(img: HTMLImageElement, skin: Skin, health: HealthTier): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, c.width, c.height);
  const px = data.data;
  const mask: number[] = [];
  const lights: number[] = [];
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] > 0 && isSkin(px[i], px[i + 1], px[i + 2])) {
      mask.push(i);
      lights.push(rgbToHsl(px[i], px[i + 1], px[i + 2])[2]);
    }
  }
  lights.sort((a, b) => a - b);
  const median = lights[Math.floor(lights.length / 2)] ?? 0.5;
  let [th, ts, tl] = rgbToHsl(...SKIN_RGB[skin]);
  if (health === 'sick') { ts *= 0.55; tl = Math.min(1, tl + 0.04); }
  if (health === 'healthy') { ts = Math.min(1, ts * 1.12); tl = Math.min(1, tl + 0.02); }
  const k = tl > 0.35 ? 0.9 : 0.6;
  for (let j = 0; j < mask.length; j++) {
    const i = mask[j];
    const l = Math.max(0, Math.min(1, tl + (lights.length ? rgbToHsl(px[i], px[i + 1], px[i + 2])[2] - median : 0) * k));
    const [r, g, b] = hslToRgb(th, ts, l);
    px[i] = r; px[i + 1] = g; px[i + 2] = b;
  }
  if (health === 'sick') {
    for (let i = 0; i < px.length; i += 4) {
      if (!px[i + 3]) continue;
      px[i] = px[i] * 0.88 + 150 * 0.12;
      px[i + 1] = px[i + 1] * 0.88 + 165 * 0.12;
      px[i + 2] = px[i + 2] * 0.88 + 140 * 0.12;
    }
  }
  ctx.putImageData(data, 0, 0);
  return c;
}

const cache = new Map<string, string>();

export function Avatar({ life, size = 'large' }: { life: Life; size?: 'large' | 'small' }) {
  const stage = stageOf(life.age);
  const health = healthTier(life.stats.health);
  const key = `${stage}_${life.sex}_${wealthTier(life.stats.money)}_${health}`;
  const cacheKey = `${key}_${life.skin}`;
  const [src, setSrc] = useState<string | null>(cache.get(cacheKey) ?? null);
  const [failed, setFailed] = useState(false);
  const current = useRef(cacheKey);

  useEffect(() => {
    current.current = cacheKey;
    setFailed(false);
    const hit = cache.get(cacheKey);
    if (hit) return setSrc(hit);
    const img = new Image();
    img.onload = () => {
      const url = recolor(img, life.skin, health).toDataURL();
      cache.set(cacheKey, url);
      if (current.current === cacheKey) setSrc(url);
    };
    img.onerror = () => current.current === cacheKey && setFailed(true);
    img.src = `${import.meta.env.BASE_URL}sprites/${key}.png`;
  }, [cacheKey, key, life.skin, health]);

  return (
    <div className={`avatar avatar-${size} health-${health}`}>
      {failed || !src ? <span className="avatar-emoji">{EMOJI[stage]}</span> : <img src={src} alt="" draggable={false} />}
    </div>
  );
}
