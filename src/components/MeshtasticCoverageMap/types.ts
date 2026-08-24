import type {Feature, MultiPolygon, Polygon} from 'geojson';

/** The two presets the Greek mesh actually runs; anything else is ignored. */
export const PRESET_CHANNELS = ['LongFast', 'NarrowSlow'] as const;

export type PresetChannel = (typeof PRESET_CHANNELS)[number];

/** What colours a unit: a single preset, both, or no positioned nodes at all. */
export type CoverageState = PresetChannel | 'Mixed' | 'None';

export const COVERAGE_STATES = [
  'LongFast',
  'NarrowSlow',
  'Mixed',
  'None',
] as const satisfies readonly CoverageState[];

/** Only the Meshview `/api/nodes` fields this map reads. */
export type MeshviewNode = {
  last_lat: number | null;
  last_long: number | null;
  channel: string | null;
  is_mqtt_gateway: boolean | null;
};

export type NutsUnitProperties = {
  /** NUTS 2024 level 3 identifier, e.g. `EL522`. */
  id: string;
  /** Latin transliteration from Eurostat, used when no Greek override exists. */
  na: string;
};

export type NutsUnitFeature = Feature<
  Polygon | MultiPolygon,
  NutsUnitProperties
>;

export type UnitCoverage = {
  name: string;
  longFast: number;
  narrowSlow: number;
  gateways: number;
  total: number;
  state: CoverageState;
};

export type Coverage = {
  unitsById: Record<string, UnitCoverage>;
  /** Units in the shipped topology, i.e. the denominator the panel reports. */
  unitCount: number;
  /** How many *units* sit in each state. */
  stateCounts: Record<CoverageState, number>;
  placedByPreset: Record<PresetChannel, number>;
  placedTotal: number;
  unitsWithNodes: number;
  positionlessByPreset: Record<PresetChannel, number>;
  positionlessTotal: number;
  /**
   * Positioned nodes too far from any unit to assign (open sea, Turkish
   * coast). Counted, never placed.
   */
  outsideCount: number;
};
