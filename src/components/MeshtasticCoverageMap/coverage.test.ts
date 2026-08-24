import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

import * as topojson from 'topojson-client';
import {describe, expect, it} from 'vitest';

import {
  buildCoverage,
  classifyUnit,
  createUnitIndex,
  locateUnitId,
  toPresetChannel,
} from './coverage';
import snapshot from './nodes-snapshot.json';
import type {MeshviewNode, NutsUnitFeature} from './types';

const topology = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL('../../../static/data/greece-nuts3.topo.json', import.meta.url),
    ),
    'utf8',
  ),
);

const features = (
  topojson.feature(topology, topology.objects.nuts3) as unknown as {
    features: NutsUnitFeature[];
  }
).features;
const index = createUnitIndex(features);
const nodes = snapshot.nodes as MeshviewNode[];

describe('Greek NUTS 3 geometry', () => {
  it('ships every περιφερειακή ενότητα and nothing else', () => {
    expect(features).toHaveLength(52);
    expect(
      features.every((feature) => feature.properties.id.startsWith('EL')),
    ).toBe(true);
  });
});

describe('locating nodes', () => {
  it('places a node inside its unit', () => {
    // Λευκός Πύργος, Θεσσαλονίκη.
    expect(locateUnitId(index, [22.9481, 40.6263])).toBe('EL522');
  });

  it('snaps a coastal node that the generalised border misses', () => {
    // Πειραιάς waterfront: outside every polygon by ~1.4 km.
    expect(locateUnitId(index, [23.6118, 37.9331])).toBe('EL307');
  });

  it('leaves nodes beyond the fallback radius unplaced', () => {
    expect(locateUnitId(index, [27.2, 38.4])).toBeNull(); // Ιζμίρ
    expect(locateUnitId(index, [21.0, 34.5])).toBeNull(); // ανοιχτή θάλασσα
  });
});

describe('classifying a unit', () => {
  it('gives the unit to a single preset', () => {
    expect(classifyUnit(4, 0)).toBe('LongFast');
    expect(classifyUnit(0, 5)).toBe('NarrowSlow');
  });

  it('calls it mixed once the runner-up holds 25%', () => {
    expect(classifyUnit(3, 1)).toBe('Mixed');
    expect(classifyUnit(11, 3)).toBe('LongFast');
    expect(classifyUnit(9, 6)).toBe('Mixed');
  });

  it('has no state to report without positioned nodes', () => {
    expect(classifyUnit(0, 0)).toBe('None');
  });
});

describe('reading channels', () => {
  it('keeps only the two presets the mesh runs', () => {
    expect(toPresetChannel('LongFast')).toBe('LongFast');
    expect(toPresetChannel('MediumFast')).toBeNull();
    expect(toPresetChannel(null)).toBeNull();
  });
});

describe('coverage over the 24 Aug 2026 snapshot', () => {
  const coverage = buildCoverage(index, nodes);

  it('places every positioned node', () => {
    expect(nodes).toHaveLength(129);
    expect(coverage.placedTotal).toBe(87);
    expect(coverage.placedByPreset).toEqual({LongFast: 60, NarrowSlow: 27});
    expect(coverage.outsideCount).toBe(0);
  });

  it('counts the nodes that never share a position', () => {
    expect(coverage.positionlessByPreset).toEqual({
      LongFast: 33,
      NarrowSlow: 9,
    });
    expect(coverage.positionlessTotal).toBe(42);
  });

  it('splits the 52 units across the four states', () => {
    expect(coverage.stateCounts).toEqual({
      LongFast: 8,
      NarrowSlow: 4,
      Mixed: 4,
      None: 36,
    });
    expect(coverage.unitsWithNodes).toBe(16);
    expect(coverage.unitCount).toBe(52);
  });

  it('labels units in Greek and tallies their gateways', () => {
    expect(coverage.unitsById.EL303).toMatchObject({
      name: 'Κεντρικός Τομέας Αθηνών',
      longFast: 7,
      narrowSlow: 5,
      gateways: 4,
      state: 'Mixed',
    });
    expect(coverage.unitsById.EL641).toMatchObject({
      name: 'Βοιωτία',
      state: 'NarrowSlow',
    });
  });
});
