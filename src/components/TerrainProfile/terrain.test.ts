import {describe, expect, it} from 'vitest';
import {
  ANTENNA_HEIGHTS_M,
  DEFAULT_TERRAIN,
  TERRAIN_DISTANCES_KM,
  TERRAIN_HILLS_M,
  analyzeTerrain,
  freeSpaceLossDb,
  fresnelRadiusM,
  knifeEdgeLossDb,
  obstacleCost,
  profileHeightMaxM,
  terrainCaption,
} from './terrain';

const run = (distanceKm: number, hillM: number, heightAM: number, heightBM: number) => {
  const input = {distanceKm, hillM, heightAM, heightBM};
  const result = analyzeTerrain(input);
  return {input, result, caption: terrainCaption(input, result), cost: obstacleCost(result)};
};

describe('terrain primitives', () => {
  it('fresnel radius', () => {
    expect(fresnelRadiusM(5, 5)).toBeCloseTo(29.4, 1);
    expect(fresnelRadiusM(0, 10)).toBe(0);
  });
  it('free space loss', () => {
    expect(freeSpaceLossDb(10)).toBeCloseTo(111.2, 1);
  });
  it('knife edge', () => {
    expect(knifeEdgeLossDb(0)).toBeCloseTo(6.0, 1);
    expect(knifeEdgeLossDb(1)).toBe(0);
  });
  it('profile height max', () => {
    expect(profileHeightMaxM(DEFAULT_TERRAIN)).toBeCloseTo(44.8, 1);
  });
});

describe('analyzeTerrain', () => {
  it('default is blocked', () => {
    const {result} = run(10, 25, 2, 10);
    expect(result.status).toBe('blocked');
    expect(result.obstacleLossDb).toBeCloseTo(14.15, 2);
    expect(result.midRadiusM).toBeCloseTo(29.4, 1);
    expect(result.profile).toHaveLength(65);
  });
  it('20 km, 80 m hill', () => {
    const {result, cost} = run(20, 80, 2, 10);
    expect(result.status).toBe('blocked');
    expect(result.obstacleLossDb).toBeCloseTo(21.9, 1);
    expect(cost).toEqual({value: '22 dB', hint: 'Σαν να ήταν ο B 12 φορές πιο μακριά σε ανοιχτό χώρο.'});
  });
  it('default range factor uses a decimal comma', () => {
    expect(run(10, 25, 2, 10).cost.hint).toContain('5,1 φορές');
  });
  it('curvature only', () => {
    const {result, caption} = run(20, 0, 2, 2);
    expect(result.status).toBe('blocked');
    expect(caption).toContain('Η καμπυλότητα της Γης κόβει τη νοητή γραμμή');
    expect(caption).not.toContain('λόφος');
  });
  it('partial', () => {
    const {result, caption} = run(10, 0, 2, 30);
    expect(result.status).toBe('partial');
    expect(caption).toContain('προσθέτει περίπου 3 dB');
  });
  it('partial with J rounding to 0', () => {
    const {result, cost, caption} = run(2, 0, 2, 30);
    expect(result.status).toBe('partial');
    expect(cost).toEqual({value: '< 1 dB', hint: 'Σχεδόν σαν σε ανοιχτό χώρο.'});
    expect(caption).toContain('λιγότερο από 1 dB');
  });
  it('clear', () => {
    const {result, cost, caption} = run(2, 0, 30, 30);
    expect(result.status).toBe('clear');
    expect(cost.value).toBe('0 dB');
    expect(caption).toContain('Το έδαφος μένει έξω από τη ζώνη Fresnel και δεν προσθέτει απώλειες.');
  });
  it('default caption', () => {
    const {caption} = run(10, 25, 2, 10);
    expect(caption.startsWith('Σε 10 km η απόσταση μόνη της κοστίζει περίπου 111 dB.')).toBe(true);
    expect(caption).toContain('Ο λόφος κόβει τη νοητή γραμμή');
  });
  it('all 108 combinations are sane', () => {
    let n = 0;
    for (const d of TERRAIN_DISTANCES_KM)
      for (const h of TERRAIN_HILLS_M)
        for (const a of ANTENNA_HEIGHTS_M)
          for (const b of ANTENNA_HEIGHTS_M) {
            n++;
            const {result, caption, cost} = run(d, h, a, b);
            for (const v of [result.clearanceRatio, result.obstacleLossDb, result.freeSpaceLossDb, result.midRadiusM, result.rangeFactor]) {
              expect(Number.isFinite(v)).toBe(true);
            }
            expect(['clear', 'partial', 'blocked']).toContain(result.status);
            expect(caption.length).toBeGreaterThan(0);
            if (result.status === 'partial') {
              expect(caption).not.toContain('περίπου 0 dB');
              expect(cost.value).not.toBe('0 dB');
            }
          }
    expect(n).toBe(108);
  });
});
