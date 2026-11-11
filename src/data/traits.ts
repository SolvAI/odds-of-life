import type { Category, Dream, TraitId } from '../engine/types';

export interface Bias {
  cats?: Partial<Record<Category, number>>; // multiplies every event of that category
  ids?: Record<string, number>; // multiplies specific events (wins over cats)
}

export interface TraitDef extends Bias {
  label: string;
  opposite?: TraitId;
  luck?: number; // shifts every gauge's green zone
  health?: number; // yearly drift
  happiness?: number;
}

// Two traits are rolled at birth. They bend the odds and give the narrator a character to write.
export const TRAITS: Record<TraitId, TraitDef> = {
  reckless: { label: 'reckless', opposite: 'cautious', cats: { accident: 1.6, violence: 1.4 }, ids: { arrested: 1.5, start_business: 1.4, drugs: 1.5, affair: 1.4, gambling: 1.8, border_crossing: 1.5 } },
  cautious: { label: 'cautious', opposite: 'reckless', cats: { accident: 0.6, violence: 0.7 }, ids: { start_business: 0.6, drugs: 0.5, gambling: 0.5, affair: 0.6 } },
  charming: { label: 'charming', opposite: 'awkward', cats: { love: 1.4 }, ids: { promotion: 1.2, best_friend: 1.4, divorce: 0.8, hired_big: 1.4 } },
  awkward: { label: 'awkward', opposite: 'charming', cats: { love: 0.6 }, ids: { best_friend: 0.7, lonely: 1.6, bullied: 1.5 } },
  ambitious: { label: 'ambitious', opposite: 'lazy', ids: { promotion: 1.5, start_business: 1.8, burnout: 1.8, first_job: 1.2, side_hustle: 1.8, hired_big: 1.5, run_for_office: 3 } },
  lazy: { label: 'lazy', opposite: 'ambitious', ids: { promotion: 0.5, laid_off: 1.5, burnout: 0.5, start_business: 0.5, obesity: 1.5, side_hustle: 0.3 } },
  brilliant: { label: 'brilliant', opposite: 'dim', ids: { school_star: 2.5, scholarship: 3, graduate: 1.4, promotion: 1.3, uni_dropout: 0.5, big_exam: 1.5, invention: 4 } },
  dim: { label: 'not the sharpest', opposite: 'brilliant', ids: { school_star: 0.3, scholarship: 0.2, scammed: 1.8, drop_out: 1.5, big_exam: 0.6 } },
  athletic: { label: 'athletic', opposite: 'sickly', health: 1, ids: { get_fit: 2.5, sports_injury: 2, obesity: 0.5, sports_glory: 4 } },
  sickly: { label: 'sickly', opposite: 'athletic', health: -1, cats: { health: 1.35 } },
  hot_tempered: { label: 'hot-tempered', opposite: 'gentle', cats: { violence: 1.5 }, ids: { arrested: 1.6, divorce: 1.5, family_feud: 1.8, laid_off: 1.3, road_rage: 3 } },
  gentle: { label: 'gentle', opposite: 'hot_tempered', ids: { best_friend: 1.5, family_feud: 0.6, scammed: 1.4, assault: 0.7 } },
  greedy: { label: 'greedy', cats: { money: 1.3 }, ids: { scammed: 1.3, good_investment: 1.4, bad_investment: 1.4, affair: 1.2, bribe: 2.5, embezzle: 3 } },
  lucky: { label: 'lucky', opposite: 'unlucky', luck: 0.06, ids: { lottery_small: 3, jackpot: 5, inheritance: 2, found_money: 3 } },
  unlucky: { label: 'unlucky', opposite: 'lucky', luck: -0.06, ids: { found_money: 0.3 } },
  devout: { label: 'devout', opposite: 'rebellious', ids: { faith: 5, alcoholism: 0.4, affair: 0.5, drugs: 0.5, pilgrimage: 6 } },
  rebellious: { label: 'rebellious', opposite: 'devout', ids: { drop_out: 1.6, arrested: 1.5, drugs: 1.6, start_smoking: 1.8, protest_arrest: 3, run_away: 3, tattoo: 3 } },
  anxious: { label: 'anxious', opposite: 'resilient', happiness: -0.5, cats: { accident: 0.8 }, ids: { depression: 1.8, burnout: 1.5, insomnia: 2.5 } },
  resilient: { label: 'resilient', opposite: 'anxious', ids: { depression: 0.5, recovery: 1.8, ptsd: 0.4 } },
  beautiful: { label: 'strikingly good-looking', cats: { love: 1.3 }, ids: { viral: 2, model_scout: 6, affair: 1.3 } },
  funny: { label: 'funny', ids: { best_friend: 1.4, viral: 1.5, stand_up: 4 }, cats: { love: 1.1 } },
};

export const TRAIT_IDS = Object.keys(TRAITS) as TraitId[];

export interface DreamDef extends Bias {
  label: string;
  gist: string; // choice button meaning
}

// Chosen in the teens. Bends the odds a little, and pays a score bonus if it comes true.
export const DREAMS: Record<Dream, DreamDef> = {
  wealth: { label: 'get rich', gist: 'Get rich, whatever it takes', cats: { money: 1.2, work: 1.2 }, ids: { start_business: 1.6, side_hustle: 1.8 } },
  family: { label: 'a big family', gist: 'A big, loud family of your own', cats: { love: 1.2 }, ids: { baby: 1.4, wedding: 1.3 } },
  fame: { label: 'become famous', gist: 'Become famous', ids: { viral: 4, talent: 2, stand_up: 3, model_scout: 2, sports_glory: 2 } },
  adventure: { label: 'see the world', gist: 'See the world', ids: { holiday: 3, gulf_job: 1.5, work_abroad: 3, border_crossing: 1.5 }, cats: { accident: 1.15 } },
  long_life: { label: 'live to a hundred', gist: 'Live to a hundred', cats: { accident: 0.8 }, ids: { get_fit: 2, start_smoking: 0.4, quit_smoking: 2, drugs: 0.4 } },
  love: { label: 'find true love', gist: 'Find the love of your life', cats: { love: 1.35 }, ids: { divorce: 0.7 } },
};
