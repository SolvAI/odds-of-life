import type { CareSystem, Country, IncomeTier, Sex, Skin } from '../engine/types';

// Approximate 2019-2024 figures (UN WPP, World Bank, WHO, UNODC, UNICEF). Maternal mortality: World Bank
// SH.STA.MMRT, 2023. Check against the World Bank API with: python3 scripts/check-data.py
// Columns after the flag: homicide/100k, road deaths/100k, malaria 0-3, conflict 0-3, quake 0-3, flood 0-3,
// drought 0-3, heat 0-3, fertility, maternal deaths/100k births, HIV %, child marriage %, conscription
// (0 none, 1 men, 2 lottery), divorce vs US, male smokers %, obesity %, prisoners/100k.
type Row = [string, string, number, IncomeTier, number, CareSystem, string, ...number[]];
const ROWS: Row[] = [
  ['IN', 'India', 23000, 'lowerMid', 72, 'mixed', '🇮🇳', 3, 16, 1, 0, 1, 2, 1, 2, 2.0, 80, 0.2, 23, 0, 0.05, 38, 4, 40],
  ['CN', 'China', 9000, 'upperMid', 78, 'mixed', '🇨🇳', 0.5, 17, 0, 0, 2, 2, 0, 1, 1.0, 16, 0.1, 3, 0, 0.6, 50, 7, 120],
  ['NG', 'Nigeria', 7500, 'lowerMid', 54, 'private', '🇳🇬', 16, 21, 3, 2, 0, 2, 1, 1, 5.1, 993, 1.3, 30, 0, 0.2, 10, 9, 35],
  ['PK', 'Pakistan', 6500, 'lowerMid', 67, 'private', '🇵🇰', 4, 15, 1, 1, 2, 2, 1, 3, 3.5, 155, 0.1, 18, 0, 0.1, 30, 8, 40],
  ['ID', 'Indonesia', 4500, 'upperMid', 71, 'mixed', '🇮🇩', 0.4, 11, 1, 0, 2, 2, 0, 0, 2.1, 140, 0.4, 11, 0, 0.4, 70, 7, 100],
  ['CD', 'DR Congo', 4500, 'low', 61, 'private', '🇨🇩', 13, 34, 3, 2, 0, 1, 1, 0, 6.0, 427, 0.7, 29, 0, 0.3, 20, 6, 30],
  ['ET', 'Ethiopia', 4000, 'low', 67, 'private', '🇪🇹', 8, 27, 2, 2, 1, 1, 2, 0, 4.0, 195, 0.9, 40, 0, 0.3, 8, 2, 100],
  ['US', 'United States', 3600, 'high', 78, 'private', '🇺🇸', 6.5, 13, 0, 0, 1, 1, 0, 1, 1.6, 17, 0.4, 0, 0, 1.0, 13, 42, 530],
  ['BD', 'Bangladesh', 3000, 'lowerMid', 74, 'private', '🇧🇩', 2.3, 15, 1, 0, 1, 3, 0, 1, 1.9, 115, 0.1, 51, 0, 0.2, 45, 4, 50],
  ['BR', 'Brazil', 2500, 'upperMid', 76, 'mixed', '🇧🇷', 22, 16, 1, 0, 0, 1, 0, 0, 1.6, 67, 0.6, 26, 0, 0.6, 15, 22, 390],
  ['TZ', 'Tanzania', 2200, 'lowerMid', 67, 'private', '🇹🇿', 6, 30, 3, 0, 0, 1, 1, 0, 4.6, 276, 4.4, 29, 0, 0.3, 20, 9, 50],
  ['EG', 'Egypt', 2000, 'lowerMid', 71, 'mixed', '🇪🇬', 1.3, 19, 0, 0, 0, 0, 0, 1, 2.8, 17, 0.1, 17, 1, 0.4, 45, 32, 120],
  ['MX', 'Mexico', 1800, 'upperMid', 75, 'mixed', '🇲🇽', 28, 13, 0, 1, 2, 1, 0, 0, 1.8, 42, 0.3, 21, 0, 0.5, 20, 36, 170],
  ['PH', 'Philippines', 1700, 'lowerMid', 72, 'mixed', '🇵🇭', 4, 11, 1, 1, 2, 3, 0, 0, 1.9, 84, 0.2, 15, 0, 0.1, 40, 7, 200],
  ['KE', 'Kenya', 1500, 'lowerMid', 63, 'private', '🇰🇪', 5, 28, 2, 0, 0, 1, 2, 0, 3.3, 149, 3.7, 23, 0, 0.3, 20, 7, 100],
  ['AF', 'Afghanistan', 1400, 'low', 66, 'private', '🇦🇫', 6, 15, 1, 2, 2, 1, 2, 0, 4.5, 521, 0.1, 28, 0, 0.1, 25, 6, 50],
  ['VN', 'Vietnam', 1400, 'lowerMid', 74, 'mixed', '🇻🇳', 1.5, 18, 0, 0, 0, 2, 0, 0, 1.9, 48, 0.3, 15, 0, 0.3, 45, 2, 130],
  ['RU', 'Russia', 1200, 'upperMid', 73, 'mixed', '🇷🇺', 7, 12, 0, 1, 0, 0, 0, 0, 1.4, 9, 1.2, 6, 1, 1.4, 45, 23, 300],
  ['IR', 'Iran', 1000, 'upperMid', 77, 'mixed', '🇮🇷', 3, 20, 0, 0, 3, 1, 1, 1, 1.7, 16, 0.1, 17, 1, 0.4, 20, 25, 230],
  ['TR', 'Turkey', 1000, 'upperMid', 78, 'universal', '🇹🇷', 2.5, 7, 0, 0, 3, 1, 0, 0, 1.6, 15, 0.1, 15, 1, 0.4, 40, 32, 340],
  ['YE', 'Yemen', 1000, 'low', 64, 'private', '🇾🇪', 7, 25, 1, 3, 0, 1, 3, 1, 3.6, 118, 0.1, 32, 0, 0.3, 25, 17, 50],
  ['ZA', 'South Africa', 1000, 'upperMid', 62, 'mixed', '🇿🇦', 42, 22, 0, 0, 0, 1, 1, 0, 2.3, 118, 17, 4, 0, 0.4, 30, 28, 250],
  ['SO', 'Somalia', 800, 'low', 56, 'private', '🇸🇴', 8, 30, 2, 3, 0, 1, 3, 1, 6.1, 563, 0.1, 45, 0, 0.3, 20, 8, 40],
  ['TD', 'Chad', 750, 'low', 53, 'private', '🇹🇩', 9, 27, 3, 1, 0, 1, 2, 1, 6.1, 748, 1.1, 61, 0, 0.2, 10, 6, 40],
  ['JP', 'Japan', 730, 'high', 84, 'universal', '🇯🇵', 0.2, 2.7, 0, 0, 3, 1, 0, 1, 1.2, 3, 0.1, 0, 0, 0.6, 28, 4, 35],
  ['GB', 'United Kingdom', 680, 'high', 81, 'universal', '🇬🇧', 1.1, 2.6, 0, 0, 0, 1, 0, 0, 1.5, 8, 0.2, 0, 0, 0.8, 13, 28, 130],
  ['DE', 'Germany', 680, 'high', 81, 'universal', '🇩🇪', 0.9, 3.4, 0, 0, 0, 1, 0, 0, 1.4, 4, 0.1, 0, 0, 0.8, 22, 22, 70],
  ['FR', 'France', 660, 'high', 83, 'universal', '🇫🇷', 1.1, 4.9, 0, 0, 0, 1, 0, 1, 1.7, 7, 0.3, 0, 0, 0.8, 30, 17, 110],
  ['TH', 'Thailand', 460, 'upperMid', 79, 'universal', '🇹🇭', 2.3, 25, 1, 0, 0, 2, 0, 1, 1.2, 34, 1.1, 20, 2, 0.5, 35, 10, 400],
  ['CO', 'Colombia', 450, 'upperMid', 77, 'mixed', '🇨🇴', 26, 16, 1, 1, 1, 1, 0, 0, 1.6, 59, 0.4, 23, 1, 0.5, 12, 22, 190],
  ['AR', 'Argentina', 450, 'upperMid', 77, 'mixed', '🇦🇷', 4.6, 12, 0, 0, 0, 1, 0, 0, 1.5, 33, 0.4, 16, 0, 0.6, 25, 28, 230],
  ['IT', 'Italy', 380, 'high', 83, 'universal', '🇮🇹', 0.5, 4.8, 0, 0, 2, 1, 0, 1, 1.2, 6, 0.2, 0, 0, 0.6, 25, 20, 95],
  ['CA', 'Canada', 350, 'high', 82, 'universal', '🇨🇦', 2.1, 5, 0, 0, 0, 0, 0, 0, 1.3, 12, 0.2, 0, 0, 0.8, 12, 30, 100],
  ['ES', 'Spain', 320, 'high', 84, 'universal', '🇪🇸', 0.7, 3.6, 0, 0, 1, 1, 1, 1, 1.2, 3, 0.3, 0, 0, 0.8, 25, 24, 120],
  ['AU', 'Australia', 300, 'high', 83, 'universal', '🇦🇺', 0.9, 4.4, 0, 0, 0, 1, 1, 1, 1.6, 2, 0.1, 0, 0, 0.8, 13, 30, 170],
  ['HT', 'Haiti', 270, 'lowerMid', 64, 'private', '🇭🇹', 41, 15, 1, 2, 2, 2, 1, 0, 2.7, 328, 1.7, 15, 0, 0.3, 15, 22, 100],
  ['KR', 'South Korea', 240, 'high', 84, 'universal', '🇰🇷', 0.6, 6, 0, 0, 0, 1, 0, 0, 0.72, 4, 0.1, 0, 1, 0.7, 34, 6, 105],
  ['AE', 'UAE', 100, 'high', 79, 'mixed', '🇦🇪', 0.7, 5, 0, 0, 0, 0, 0, 2, 1.4, 3, 0.1, 0, 1, 0.4, 25, 30, 200],
  ['SE', 'Sweden', 100, 'high', 83, 'universal', '🇸🇪', 1.1, 2.2, 0, 0, 0, 0, 0, 0, 1.5, 4, 0.1, 0, 0, 0.9, 10, 16, 70],
  ['CH', 'Switzerland', 80, 'high', 84, 'mixed', '🇨🇭', 0.5, 2.3, 0, 0, 1, 1, 0, 0, 1.4, 5, 0.2, 0, 1, 0.7, 25, 12, 80],
  ['NO', 'Norway', 52, 'high', 83, 'universal', '🇳🇴', 0.5, 1.7, 0, 0, 0, 0, 0, 0, 1.4, 1, 0.1, 0, 0, 0.9, 10, 23, 55],
];

export const COUNTRIES: Country[] = ROWS.map(([code, name, births, tier, lifeExp, care, flag, ...n]) => ({
  code, name, births, tier, lifeExp, care, flag,
  x: {
    homicide: n[0], road: n[1], malaria: n[2] as 0, conflict: n[3] as 0, quake: n[4] as 0, flood: n[5] as 0,
    drought: n[6] as 0, heat: n[7] as 0, tfr: n[8], mmr: n[9], hiv: n[10], childMarriage: n[11],
    conscription: n[12] as 0, divorce: n[13], smoking: n[14], obesity: n[15], prison: n[16],
  },
}));

export const countryByCode = (code: string): Country => COUNTRIES.find((c) => c.code === code) ?? COUNTRIES[0];

type Region = 'southAsia' | 'eastAsia' | 'seAsia' | 'africa' | 'mena' | 'latam' | 'west';

const REGION: Record<string, Region> = {
  IN: 'southAsia', PK: 'southAsia', BD: 'southAsia', AF: 'southAsia',
  CN: 'eastAsia', JP: 'eastAsia', KR: 'eastAsia', VN: 'eastAsia', TH: 'eastAsia',
  ID: 'seAsia', PH: 'seAsia',
  NG: 'africa', CD: 'africa', ET: 'africa', TZ: 'africa', KE: 'africa', SO: 'africa', TD: 'africa', ZA: 'africa', HT: 'africa',
  EG: 'mena', IR: 'mena', TR: 'mena', YE: 'mena', AE: 'mena',
  BR: 'latam', MX: 'latam', CO: 'latam', AR: 'latam',
};
const regionOf = (code: string): Region => REGION[code] ?? 'west';

const SKIN_ODDS: Record<Region, Partial<Record<Skin, number>>> = {
  southAsia: { light: 0.1, medium: 0.45, brown: 0.4, dark: 0.05 },
  eastAsia: { pale: 0.3, light: 0.6, medium: 0.1 },
  seAsia: { light: 0.2, medium: 0.6, brown: 0.2 },
  africa: { medium: 0.05, brown: 0.3, dark: 0.65 },
  mena: { light: 0.35, medium: 0.55, brown: 0.1 },
  latam: { pale: 0.1, light: 0.3, medium: 0.4, brown: 0.15, dark: 0.05 },
  west: { pale: 0.55, light: 0.25, medium: 0.08, brown: 0.07, dark: 0.05 },
};

export const skinOdds = (code: string) => Object.entries(SKIN_ODDS[regionOf(code)]) as [Skin, number][];

const NAMES: Record<Region, Record<Sex, string[]>> = {
  southAsia: { male: ['Arjun', 'Rahul', 'Imran', 'Ayaan', 'Vikram', 'Faisal'], female: ['Priya', 'Ananya', 'Fatima', 'Aisha', 'Sana', 'Meera'] },
  eastAsia: { male: ['Wei', 'Hiroshi', 'Min-jun', 'Minh', 'Kenji', 'Somchai'], female: ['Mei', 'Yuki', 'Ji-woo', 'Lan', 'Hana', 'Mali'] },
  seAsia: { male: ['Budi', 'Jose', 'Rizal', 'Agus', 'Paolo', 'Dimas'], female: ['Siti', 'Maria', 'Putri', 'Angel', 'Dewi', 'Rosa'] },
  africa: { male: ['Chinedu', 'Kwame', 'Abebe', 'Juma', 'Tunde', 'Musa'], female: ['Amara', 'Ngozi', 'Zawadi', 'Hana', 'Ayan', 'Thandi'] },
  mena: { male: ['Omar', 'Ali', 'Mehmet', 'Karim', 'Reza', 'Yusuf'], female: ['Layla', 'Fatma', 'Zahra', 'Noor', 'Elif', 'Mariam'] },
  latam: { male: ['Mateo', 'João', 'Diego', 'Santiago', 'Luis', 'Jean'], female: ['Sofia', 'Ana', 'Valentina', 'Camila', 'Lucia', 'Marie'] },
  west: { male: ['Liam', 'Lucas', 'Leon', 'Marco', 'Oliver', 'Ivan'], female: ['Emma', 'Olivia', 'Mia', 'Chloé', 'Giulia', 'Anna'] },
};

// Countries big enough in the lottery to deserve their own names.
const COUNTRY_NAMES: Record<string, Record<Sex, string[]>> = {
  CN: { male: ['Wei', 'Hao', 'Jun', 'Lei', 'Yang', 'Chen'], female: ['Mei', 'Xiu', 'Ling', 'Fang', 'Yan', 'Jing'] },
  JP: { male: ['Hiroshi', 'Kenji', 'Haruto', 'Ren'], female: ['Yuki', 'Sakura', 'Aoi', 'Hina'] },
  KR: { male: ['Min-jun', 'Seo-jun', 'Ji-ho'], female: ['Ji-woo', 'Seo-yeon', 'Min-seo'] },
  IN: { male: ['Arjun', 'Rahul', 'Vikram', 'Aarav', 'Rohan', 'Sanjay'], female: ['Priya', 'Ananya', 'Meera', 'Kavya', 'Pooja', 'Divya'] },
  PK: { male: ['Imran', 'Bilal', 'Usman', 'Hamza', 'Faisal', 'Zain'], female: ['Ayesha', 'Fatima', 'Sana', 'Hina', 'Mahnoor', 'Zainab'] },
  BD: { male: ['Rahim', 'Karim', 'Sabbir', 'Tanvir', 'Arif', 'Shakil'], female: ['Nusrat', 'Farzana', 'Sumaiya', 'Taslima', 'Rupa', 'Mitu'] },
  AF: { male: ['Ahmad', 'Mohammad', 'Hamid', 'Wahid', 'Naveed', 'Farid'], female: ['Malalai', 'Zahra', 'Shabnam', 'Freshta', 'Mariam', 'Laila'] },
  ID: { male: ['Budi', 'Agus', 'Rizky', 'Dimas', 'Andi', 'Fajar'], female: ['Siti', 'Dewi', 'Putri', 'Ayu', 'Rina', 'Indah'] },
  NG: { male: ['Chinedu', 'Tunde', 'Musa', 'Emeka', 'Ibrahim', 'Femi'], female: ['Ngozi', 'Amina', 'Funke', 'Chioma', 'Hauwa', 'Aisha'] },
};

export const namesFor = (code: string, sex: Sex) => (COUNTRY_NAMES[code] ?? NAMES[regionOf(code)])[sex];

/** Random theme words nudge a small model away from writing the same event twice. */
export const THEMES = [
  'storm', 'neighbour', 'inheritance', 'stray dog', 'wedding', 'scam', 'lottery ticket', 'old friend', 'fire',
  'promotion', 'rumour', 'police', 'festival', 'flood', 'social media', 'teacher', 'rival', 'secret', 'debt',
  'bicycle', 'phone', 'religion', 'politics', 'cooking', 'gambling', 'gym', 'landlord', 'cousin', 'boss',
  'holiday', 'pet', 'car', 'music', 'garden', 'exam', 'sports', 'theft', 'gift', 'betrayal', 'luck',
];
