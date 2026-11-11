import type { HardStart, IncomeTier } from './types';

// Global balance knobs; per-event odds live in src/data/events.ts. Tuned with `npm run sim`.
export const CONFIG = {
  maxAge: 100,
  respins: 3,
  disabilityOdds: 0.03,
  miracleOdds: { poverty: 0.03, disability: 0.02 } as Record<HardStart, number>,

  money: {
    tierBase: { low: 3, lowerMid: 8, upperMid: 22, high: 40 } as Record<IncomeTier, number>,
    income: { low: 0.3, lowerMid: 0.6, upperMid: 1.0, high: 1.4 } as Record<IncomeTier, number>,
    hardStartPct: 0.75, // family below this percentile in a low/lowerMid country = poverty hard start
  },

  mortality: {
    gompertzB: 0.085,
    // Explicit events (heart attacks, cancer, accidents...) cover part of real deaths,
    // so the background "everything else" hazard is scaled down.
    background: 0.55,
    medianOffset: { low: 0, lowerMid: 0, upperMid: 2, high: 5 } as Record<IncomeTier, number>,
    neonatal: { low: 0.025, lowerMid: 0.015, upperMid: 0.006, high: 0.002 } as Record<IncomeTier, number>,
    healthScale: 30, // hazard × e^((60 - health) / scale)
  },

  choice: { firstAge: [14, 18], gap: [5, 10] },
} as const;
