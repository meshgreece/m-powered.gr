import {useEffect, useMemo, useState} from 'react';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import {geoMercator, geoPath} from 'd3-geo';
import * as topojson from 'topojson-client';
import type {GeometryCollection, Topology} from 'topojson-specification';

import {buildCoverage, createUnitIndex} from './coverage';
import styles from './styles.module.css';
import {COVERAGE_STATES} from './types';
import type {
  Coverage,
  CoverageState,
  MeshviewNode,
  NutsUnitFeature,
  NutsUnitProperties,
  PresetChannel,
  UnitCoverage,
} from './types';

const MESHVIEW_NODES_ENDPOINT = 'https://meshview.m-powered.gr/api/nodes';
const MESHVIEW_URL = 'https://meshview.m-powered.gr/';
const GENERATOR_URL = '/docs/configuration-generator';
const DAYS_ACTIVE = 14;

const VIEWBOX_WIDTH = 640;
const VIEWBOX_HEIGHT = 560;
const VIEWBOX_PADDING = 12;

const STATE_LABELS: Record<CoverageState, string> = {
  LongFast: 'LongFast',
  NarrowSlow: 'NarrowSlow',
  Mixed: 'Μεικτό',
  None: 'Χωρίς κόμβους με θέση',
};

/** A Mixed or empty unit has no preset of its own; LongFast is the default. */
function getSuggestedPreset(state: CoverageState): PresetChannel {
  return state === 'NarrowSlow' ? 'NarrowSlow' : 'LongFast';
}

/** The NUTS 2 prefix of a unit id, i.e. the περιφέρεια it belongs to. */
function getNuts2Group(geometry: {properties?: unknown}): string {
  return String(
    (geometry.properties as NutsUnitProperties | undefined)?.id,
  ).slice(0, 4);
}

type MapGeometry = {
  coastPath: string;
  seamPath: string;
  units: {id: string; path: string; centroid: [number, number]}[];
};

type MapData = {
  geometry: MapGeometry;
  coverage: Coverage;
};

function buildMapData(topology: Topology, nodes: MeshviewNode[]): MapData {
  const collection = topology.objects
    .nuts3 as GeometryCollection<NutsUnitProperties>;
  const featureCollection = topojson.feature(
    topology,
    collection,
  ) as unknown as {
    features: NutsUnitFeature[];
  };
  const projection = geoMercator().fitExtent(
    [
      [VIEWBOX_PADDING, VIEWBOX_PADDING],
      [VIEWBOX_WIDTH - VIEWBOX_PADDING, VIEWBOX_HEIGHT - VIEWBOX_PADDING],
    ],
    featureCollection as never,
  );
  const path = geoPath(projection);

  return {
    geometry: {
      coastPath: path(topojson.mesh(topology, collection)) ?? '',
      // Seams between NUTS 2 groups, so the 13 περιφέρειες read as groups.
      seamPath:
        path(
          topojson.mesh(
            topology,
            collection,
            (a, b) => a !== b && getNuts2Group(a) !== getNuts2Group(b),
          ),
        ) ?? '',
      units: featureCollection.features.map((feature) => ({
        id: feature.properties.id,
        path: path(feature) ?? '',
        centroid: path.centroid(feature) as [number, number],
      })),
    },
    coverage: buildCoverage(createUnitIndex(featureCollection.features), nodes),
  };
}

function CountList({rows}: {rows: readonly (readonly [string, number])[]}) {
  return (
    <dl className={styles.counts}>
      {rows.map(([label, value]) => (
        <div className={styles.count} key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function MeshtasticCoverageMap() {
  const topologyUrl = useBaseUrl('/data/greece-nuts3.topo.json');
  const [data, setData] = useState<MapData | null>(null);
  const [hasError, setHasError] = useState(false);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [activeUnitId, setActiveUnitId] = useState<string | null>(null);
  const [hiddenStates, setHiddenStates] = useState<readonly CoverageState[]>(
    [],
  );

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const [topologyResponse, nodesResponse] = await Promise.all([
          fetch(topologyUrl, {headers: {accept: 'application/json'}}),
          fetch(`${MESHVIEW_NODES_ENDPOINT}?days_active=${DAYS_ACTIVE}`, {
            headers: {accept: 'application/json'},
          }),
        ]);

        if (!topologyResponse.ok || !nodesResponse.ok) {
          throw new Error(
            `Coverage request failed with status ${topologyResponse.status}/${nodesResponse.status}`,
          );
        }

        const topology = (await topologyResponse.json()) as Topology;
        const {nodes} = (await nodesResponse.json()) as {
          nodes?: MeshviewNode[];
        };

        if (!isMounted) return;

        setData(buildMapData(topology, nodes ?? []));
      } catch (error) {
        if (isMounted) setHasError(true);
        console.error(error);
      }
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, [topologyUrl]);

  const selectedUnit = useMemo(
    () =>
      data === null || selectedUnitId === null
        ? null
        : (data.coverage.unitsById[selectedUnitId] ?? null),
    [data, selectedUnitId],
  );
  const activeUnit = useMemo(
    () =>
      data === null || activeUnitId === null
        ? null
        : (data.coverage.unitsById[activeUnitId] ?? null),
    [data, activeUnitId],
  );
  const activeCentroid = useMemo(
    () =>
      data === null || activeUnitId === null
        ? null
        : (data.geometry.units.find((unit) => unit.id === activeUnitId)
            ?.centroid ?? null),
    [data, activeUnitId],
  );

  function toggleState(state: CoverageState) {
    setHiddenStates((current) =>
      current.includes(state)
        ? current.filter((hidden) => hidden !== state)
        : [...current, state],
    );
  }

  function toggleSelection(unitId: string) {
    setSelectedUnitId((current) => (current === unitId ? null : unitId));
  }

  const suggestedPreset =
    selectedUnit === null ? null : getSuggestedPreset(selectedUnit.state);

  function describeUnit(unit: UnitCoverage) {
    return unit.total === 0
      ? `${unit.name}: ${STATE_LABELS.None}`
      : `${unit.name}: ${STATE_LABELS[unit.state]}, LongFast ${unit.longFast}, NarrowSlow ${unit.narrowSlow}`;
  }

  return (
    <section
      aria-label="Κατανομή preset ανά περιοχή"
      className={styles.coverage}
    >
      <div className={styles.layout}>
        <div className={styles.mapFrame}>
          {data === null ? (
            <div className={styles.placeholder}>
              {hasError
                ? 'Δεν ήταν δυνατή η φόρτωση των κόμβων.'
                : 'Φόρτωση κόμβων…'}
            </div>
          ) : (
            <div className={styles.mapCanvas}>
              {/* `group`, not `img`: an image role would hide the per-unit
                  buttons from assistive technology. */}
              <svg
                aria-label="Χάρτης με το επικρατέστερο preset ανά περιφερειακή ενότητα"
                className={styles.map}
                role="group"
                viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
              >
                <path className={styles.coast} d={data.geometry.coastPath} />
                <g>
                  {data.geometry.units.map((unit) => {
                    const coverage = data.coverage.unitsById[unit.id];
                    const isMuted = hiddenStates.includes(coverage.state);

                    return (
                      <path
                        aria-label={describeUnit(coverage)}
                        aria-pressed={selectedUnitId === unit.id}
                        className={`${styles.unit} ${
                          styles[`state${coverage.state}`]
                        } ${isMuted ? styles.unitMuted : ''}`}
                        d={unit.path}
                        key={unit.id}
                        onBlur={() => setActiveUnitId(null)}
                        onClick={() => toggleSelection(unit.id)}
                        onFocus={() => setActiveUnitId(unit.id)}
                        onKeyDown={(event) => {
                          if (event.key !== 'Enter' && event.key !== ' ')
                            return;
                          event.preventDefault();
                          toggleSelection(unit.id);
                        }}
                        onMouseEnter={() => setActiveUnitId(unit.id)}
                        onMouseLeave={() => setActiveUnitId(null)}
                        role="button"
                        tabIndex={0}
                      />
                    );
                  })}
                </g>
                <path className={styles.seam} d={data.geometry.seamPath} />
              </svg>

              {activeUnit !== null && activeCentroid !== null && (
                <div
                  className={styles.tooltip}
                  style={{
                    left: `${(activeCentroid[0] / VIEWBOX_WIDTH) * 100}%`,
                    top: `${(activeCentroid[1] / VIEWBOX_HEIGHT) * 100}%`,
                  }}
                >
                  <span className={styles.tooltipName}>{activeUnit.name}</span>
                  <span className={styles.tooltipCounts}>
                    LongFast {activeUnit.longFast} · NarrowSlow{' '}
                    {activeUnit.narrowSlow}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <aside className={styles.panel}>
          <p className={styles.eyebrow}>Preset</p>

          <ul className={styles.legend}>
            {COVERAGE_STATES.map((state) => (
              <li key={state}>
                <button
                  aria-pressed={!hiddenStates.includes(state)}
                  className={`${styles.legendRow} ${
                    hiddenStates.includes(state) ? styles.legendRowOff : ''
                  }`}
                  onClick={() => toggleState(state)}
                  type="button"
                >
                  <span
                    aria-hidden="true"
                    className={`${styles.swatch} ${styles[`state${state}`]}`}
                  />
                  <span className={styles.legendLabel}>
                    {STATE_LABELS[state]}
                  </span>
                  <span className={styles.legendCount}>
                    {data === null ? '–' : data.coverage.stateCounts[state]}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <div className={styles.detail}>
            {data === null &&
              (hasError ? (
                <p className={styles.error} role="status">
                  Δεν ήταν δυνατή η φόρτωση των δεδομένων. Δοκίμασε ξανά ή δες
                  τους κόμβους στο <Link to={MESHVIEW_URL}>Meshview</Link>.
                </p>
              ) : (
                <p className={styles.detailLead} role="status">
                  Φόρτωση δεδομένων…
                </p>
              ))}

            {data !== null && selectedUnit === null && (
              <>
                <p className={styles.detailLead}>
                  <strong>{data.coverage.placedTotal}</strong> κόμβοι με θέση,
                  σε <strong>{data.coverage.unitsWithNodes}</strong> από{' '}
                  {data.coverage.unitCount} περιφερειακές ενότητες
                </p>
                <CountList
                  rows={[
                    ['LongFast', data.coverage.placedByPreset.LongFast],
                    ['NarrowSlow', data.coverage.placedByPreset.NarrowSlow],
                  ]}
                />

                <div className={styles.positionless}>
                  <p className={styles.detailTitle}>Χωρίς κοινοποίηση θέσης</p>
                  <CountList
                    rows={[
                      ['LongFast', data.coverage.positionlessByPreset.LongFast],
                      [
                        'NarrowSlow',
                        data.coverage.positionlessByPreset.NarrowSlow,
                      ],
                      ['Σύνολο', data.coverage.positionlessTotal],
                    ]}
                  />
                </div>
              </>
            )}

            {selectedUnit !== null && (
              <>
                <p className={styles.detailTitle}>{selectedUnit.name}</p>
                <p className={styles.detailState}>
                  {STATE_LABELS[selectedUnit.state]}
                </p>
                <CountList
                  rows={[
                    ['LongFast', selectedUnit.longFast],
                    ['NarrowSlow', selectedUnit.narrowSlow],
                    ['Gateways', selectedUnit.gateways],
                  ]}
                />
                <Link
                  className={styles.cta}
                  to={`${GENERATOR_URL}?preset=${suggestedPreset}`}
                >
                  Ρυθμίσεις {suggestedPreset} →
                </Link>
              </>
            )}
          </div>
        </aside>
      </div>

      <p className={styles.footnote}>
        Το χρώμα δείχνει τι <strong>επικρατεί</strong>, όχι τι υπάρχει
        αποκλειστικά. Μετρώνται μόνο κόμβοι που στέλνουν θέση στο MQTT, και όπου
        είναι λίγοι, ένας αρκεί για να αλλάξει το χρώμα — αν είσαι σε όριο,
        κοίτα τους γείτονές σου στο <Link to={MESHVIEW_URL}>Meshview</Link>.
      </p>

      <p className={styles.attribution}>
        Όρια: © EuroGeographics / Eurostat NUTS 2024
      </p>
    </section>
  );
}
