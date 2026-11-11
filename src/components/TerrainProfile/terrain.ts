import {formatNumber} from '../teaching/format';

export const TERRAIN_DISTANCES_KM = [2, 5, 10, 20] as const;
export const TERRAIN_HILLS_M = [0, 25, 80] as const;
export const ANTENNA_HEIGHTS_M = [2, 10, 30] as const;

export interface TerrainInput {
  distanceKm: number;
  hillM: number;
  heightAM: number;
  heightBM: number;
}

export const DEFAULT_TERRAIN: TerrainInput = {distanceKm: 10, hillM: 25, heightAM: 2, heightBM: 10};

export type PathStatus = 'clear' | 'partial' | 'blocked';

export const PATH_STATUS_LABELS: Record<PathStatus, string> = {
  clear: 'Η ζώνη Fresnel είναι ελεύθερη',
  partial: 'Το έδαφος μπαίνει στη ζώνη Fresnel',
  blocked: 'Οι κεραίες δεν βλέπονται',
};

const FREQ_GHZ = 0.869;
const SAMPLES = 64;

export function fresnelRadiusM(d1Km: number, d2Km: number): number {
  const total = d1Km + d2Km;
  if (d1Km <= 0 || d2Km <= 0 || total <= 0) return 0;
  return 17.32 * Math.sqrt((d1Km * d2Km) / (FREQ_GHZ * total));
}

export function groundHeightM(xKm: number, input: TerrainInput): number {
  const d = input.distanceKm;
  const centre = 0.45 * d;
  const sigma = 0.13 * d;
  const hill = input.hillM * Math.exp(-((xKm - centre) ** 2) / (2 * sigma ** 2));
  return hill + (xKm * (d - xKm)) / 12.74;
}

export function freeSpaceLossDb(distanceKm: number): number {
  return 32.44 + 20 * Math.log10(distanceKm) + 20 * Math.log10(869);
}

export function knifeEdgeLossDb(clearanceRatio: number): number {
  const v = -Math.SQRT2 * clearanceRatio;
  if (v <= -0.78) return 0;
  return 6.9 + 20 * Math.log10(Math.sqrt((v - 0.1) ** 2 + 1) + v - 0.1);
}

export interface ProfilePoint {
  xKm: number;
  groundM: number;
  losM: number;
  radiusM: number;
}

export interface TerrainResult {
  status: PathStatus;
  clearanceRatio: number;
  obstacleLossDb: number;
  freeSpaceLossDb: number;
  midRadiusM: number;
  rangeFactor: number;
  profile: ProfilePoint[];
}

export function analyzeTerrain(input: TerrainInput): TerrainResult {
  const d = input.distanceKm;
  const profile: ProfilePoint[] = [];
  let worst = Infinity;
  for (let i = 0; i <= SAMPLES; i++) {
    const xKm = (d * i) / SAMPLES;
    const losM = input.heightAM + ((input.heightBM - input.heightAM) * i) / SAMPLES;
    const groundM = groundHeightM(xKm, input);
    const radiusM = fresnelRadiusM(xKm, d - xKm);
    profile.push({xKm, groundM, losM, radiusM});
    if (i > 0 && i < SAMPLES) worst = Math.min(worst, (losM - groundM) / radiusM);
  }
  const obstacleLossDb = knifeEdgeLossDb(worst);
  return {
    status: worst < 0 ? 'blocked' : worst < 0.6 ? 'partial' : 'clear',
    clearanceRatio: worst,
    obstacleLossDb,
    freeSpaceLossDb: freeSpaceLossDb(d),
    midRadiusM: fresnelRadiusM(d / 2, d / 2),
    rangeFactor: 10 ** (obstacleLossDb / 20),
    profile,
  };
}

export function profileHeightMaxM(input: TerrainInput): number {
  const d = input.distanceKm;
  const mid = fresnelRadiusM(d / 2, d / 2);
  return Math.max(40, input.hillM + d ** 2 / 50.96, Math.max(input.heightAM, input.heightBM) + mid) * 1.12;
}

export function terrainCaption(input: TerrainInput, result: TerrainResult): string {
  const lead = `Σε ${input.distanceKm} km η απόσταση μόνη της κοστίζει περίπου ${Math.round(result.freeSpaceLossDb)} dB.`;
  const j = Math.round(result.obstacleLossDb);
  if (result.status === 'clear') {
    return `${lead} Το έδαφος μένει έξω από τη ζώνη Fresnel και δεν προσθέτει απώλειες.`;
  }
  if (result.status === 'partial') {
    const tail = j === 0 ? 'λιγότερο από 1 dB' : `περίπου ${j} dB`;
    return `${lead} Οι κεραίες βλέπονται, αλλά το έδαφος μπαίνει στη ζώνη Fresnel και προσθέτει ${tail}.`;
  }
  const cause = input.hillM === 0 ? 'Η καμπυλότητα της Γης' : 'Ο λόφος';
  return `${lead} ${cause} κόβει τη νοητή γραμμή ανάμεσα στις κεραίες. Το σήμα φτάνει μόνο με περίθλαση και χάνει περίπου ${j} dB επιπλέον.`;
}

export function obstacleCost(result: TerrainResult): {value: string; hint: string} {
  const j = Math.round(result.obstacleLossDb);
  if (j === 0) {
    return result.status === 'clear'
      ? {value: '0 dB', hint: 'Σαν να ήταν σε ανοιχτό χώρο.'}
      : {value: '< 1 dB', hint: 'Σχεδόν σαν σε ανοιχτό χώρο.'};
  }
  const f = result.rangeFactor;
  const factor = formatNumber(f < 10 ? Math.round(f * 10) / 10 : Math.round(f));
  return {value: `${j} dB`, hint: `Σαν να ήταν ο B ${factor} φορές πιο μακριά σε ανοιχτό χώρο.`};
}
