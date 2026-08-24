import {geoBounds, geoContains, geoDistance} from 'd3-geo';

import {getUnitName} from './labels';
import type {
  Coverage,
  CoverageState,
  MeshviewNode,
  NutsUnitFeature,
  PresetChannel,
  UnitCoverage,
} from './types';
import {COVERAGE_STATES, PRESET_CHANNELS} from './types';

/** A unit is Mixed once the runner-up preset holds this share of its nodes. */
const MIXED_RUNNER_UP_SHARE = 0.25;

/**
 * The 03M generalised borders leave hairline seams along the coast, so a
 * handful of real nodes (central Athens, Crete) fall inside no polygon at all.
 * Those snap to the nearest unit boundary within this distance; anything
 * further out is genuinely outside Greece and stays unplaced.
 */
const NEAREST_UNIT_FALLBACK_KM = 15;

const EARTH_RADIUS_KM = 6371;
/** Rough degree padding around a unit's bounds for the fallback prefilter. */
const FALLBACK_BOUNDS_PADDING_DEGREES = 0.25;

type Point = [longitude: number, latitude: number];

type IndexedUnit = {
  feature: NutsUnitFeature;
  bounds: [Point, Point];
  boundaryPoints: Point[];
};

export type UnitIndex = IndexedUnit[];

function collectBoundaryPoints(coordinates: unknown, into: Point[]): void {
  if (!Array.isArray(coordinates)) return;

  if (typeof coordinates[0] === 'number') {
    into.push(coordinates as unknown as Point);
    return;
  }

  for (const nested of coordinates) {
    collectBoundaryPoints(nested, into);
  }
}

/**
 * Precomputes bounds and boundary vertices once, so classifying a node stays a
 * cheap lookup even when the fallback has to run.
 */
export function createUnitIndex(features: NutsUnitFeature[]): UnitIndex {
  return features.map((feature) => {
    const boundaryPoints: Point[] = [];
    collectBoundaryPoints(feature.geometry.coordinates, boundaryPoints);

    return {
      feature,
      bounds: geoBounds(feature) as [Point, Point],
      boundaryPoints,
    };
  });
}

function isNearBounds(
  unit: IndexedUnit,
  [longitude, latitude]: Point,
): boolean {
  const [[minLongitude, minLatitude], [maxLongitude, maxLatitude]] =
    unit.bounds;

  return (
    longitude >= minLongitude - FALLBACK_BOUNDS_PADDING_DEGREES &&
    longitude <= maxLongitude + FALLBACK_BOUNDS_PADDING_DEGREES &&
    latitude >= minLatitude - FALLBACK_BOUNDS_PADDING_DEGREES &&
    latitude <= maxLatitude + FALLBACK_BOUNDS_PADDING_DEGREES
  );
}

/** Returns the unit a point belongs to, or null when it is outside Greece. */
export function locateUnitId(index: UnitIndex, point: Point): string | null {
  for (const unit of index) {
    if (geoContains(unit.feature, point)) {
      return unit.feature.properties.id;
    }
  }

  let nearestId: string | null = null;
  let nearestDistanceKm = NEAREST_UNIT_FALLBACK_KM;

  for (const unit of index) {
    if (!isNearBounds(unit, point)) continue;

    for (const boundaryPoint of unit.boundaryPoints) {
      const distanceKm = geoDistance(boundaryPoint, point) * EARTH_RADIUS_KM;

      if (distanceKm <= nearestDistanceKm) {
        nearestDistanceKm = distanceKm;
        nearestId = unit.feature.properties.id;
      }
    }
  }

  return nearestId;
}

export function toPresetChannel(
  channel: string | null | undefined,
): PresetChannel | null {
  return PRESET_CHANNELS.find((preset) => preset === channel) ?? null;
}

export function classifyUnit(
  longFast: number,
  narrowSlow: number,
): CoverageState {
  const total = longFast + narrowSlow;
  if (total === 0) return 'None';

  const runnerUp = Math.min(longFast, narrowSlow);
  if (runnerUp / total >= MIXED_RUNNER_UP_SHARE) return 'Mixed';

  return longFast >= narrowSlow ? 'LongFast' : 'NarrowSlow';
}

function createEmptyPresetCounts(): Record<PresetChannel, number> {
  return {LongFast: 0, NarrowSlow: 0};
}

export function buildCoverage(
  index: UnitIndex,
  nodes: readonly MeshviewNode[],
): Coverage {
  const tallies = new Map(
    index.map((unit) => [
      unit.feature.properties.id,
      {longFast: 0, narrowSlow: 0, gateways: 0},
    ]),
  );
  const placedByPreset = createEmptyPresetCounts();
  const positionlessByPreset = createEmptyPresetCounts();
  let outsideCount = 0;

  for (const node of nodes) {
    const preset = toPresetChannel(node.channel);
    if (preset === null) continue;

    if (node.last_lat === null || node.last_long === null) {
      positionlessByPreset[preset] += 1;
      continue;
    }

    // Meshview stores coordinates as 1e-7 degree integers.
    const unitId = locateUnitId(index, [
      node.last_long / 1e7,
      node.last_lat / 1e7,
    ]);
    const tally = unitId === null ? undefined : tallies.get(unitId);

    if (tally === undefined) {
      outsideCount += 1;
      continue;
    }

    if (preset === 'LongFast') tally.longFast += 1;
    else tally.narrowSlow += 1;

    if (node.is_mqtt_gateway) tally.gateways += 1;
    placedByPreset[preset] += 1;
  }

  const stateCounts = Object.fromEntries(
    COVERAGE_STATES.map((state) => [state, 0]),
  ) as Record<CoverageState, number>;
  const unitsById: Record<string, UnitCoverage> = {};

  let unitsWithNodes = 0;

  for (const {feature} of index) {
    const {id, na} = feature.properties;
    const tally = tallies.get(id)!;
    const unit: UnitCoverage = {
      name: getUnitName(id, na),
      longFast: tally.longFast,
      narrowSlow: tally.narrowSlow,
      gateways: tally.gateways,
      total: tally.longFast + tally.narrowSlow,
      state: classifyUnit(tally.longFast, tally.narrowSlow),
    };

    stateCounts[unit.state] += 1;
    unitsById[id] = unit;

    if (unit.total > 0) unitsWithNodes += 1;
  }

  return {
    unitsById,
    unitCount: index.length,
    stateCounts,
    placedByPreset,
    placedTotal: placedByPreset.LongFast + placedByPreset.NarrowSlow,
    unitsWithNodes,
    positionlessByPreset,
    positionlessTotal:
      positionlessByPreset.LongFast + positionlessByPreset.NarrowSlow,
    outsideCount,
  };
}
