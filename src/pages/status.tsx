import {useEffect, useRef, useState} from 'react';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import styles from './status.module.css';
import {
  EMPTY_ACTIVITY_SERIES,
  MESHVIEW_BASE_URL,
  ONE_DAY_US,
  TELEMETRY_PORTNUM,
  buildActivitySeriesFromPackets,
  fetchJson,
  floorToUtcHourMs,
  getMeshviewApiUrl,
  getNewestPacketImportTimeUs,
  parseImportTimeUs,
  parseTelemetry,
} from '../lib/meshview';
import type {
  MeshviewNode,
  NodesResponse,
  PacketsResponse,
  TelemetryData,
} from '../lib/meshview';

const AUTO_REFRESH_INTERVAL_MS = 60_000;
const REFRESH_COUNTDOWN_TICK_MS = 1_000;
/** Node records barely change, so refetch the list every 5th cycle. */
const NODE_RECORDS_TTL_MS = 5 * AUTO_REFRESH_INTERVAL_MS;
// ponytail: limit 200 against a measured max of 41 packets/24h. If a node ever
// fills the page the bars under-report - add a /stats fallback if that happens.
const PACKET_PAGE_LIMIT = 200;
const MAP_TILE_SIZE = 256;
const MAP_ZOOM = 10;
const MAP_VIEWPORT_WIDTH = 320;
const MAP_VIEWPORT_HEIGHT = 136;
const MAP_RING_RADIUS = 12;
const LOCALE = 'el-GR';

type CoreNodeReference = {
  nodeId: string;
  prefecture: string;
  temporary?: boolean;
};

type NodeCardData = CoreNodeReference & {
  name: string;
  shortName: string;
  role: string;
  preset: string;
  hexId: string;
  latitude: number | null;
  longitude: number | null;
  lastSeen: string;
  /** No packets in the last 24h, i.e. the node is down. */
  isStale: boolean;
  packets24h: number;
  battery: number | null;
  voltage: number | null;
  activity24h: number[];
  batterySeries: number[];
  voltageSeries: number[];
  airUtilTxSeries: number[];
  channelUtilizationSeries: number[];
  isLoading: boolean;
};

type NodeSeries = {
  activity24h: number[];
  packets24h: number;
  lastPacketUs: number | null;
  telemetry: TelemetryData;
};

type PositionedNode = NodeCardData & {
  latitude: number;
  longitude: number;
};

const CORE_NODE_REFERENCES: CoreNodeReference[] = [
  {
    nodeId: '2854973388',
    prefecture: 'Νομός Ευβοίας',
  },
  {
    nodeId: '3461419339',
    prefecture: 'Νομός Αττικής',
  },
  {
    nodeId: '2794858800',
    prefecture: 'Νομός Αττικής',
    temporary: true,
  },
  {
    nodeId: '3650121153',
    prefecture: 'Νομός Αττικής',
  },
  {
    nodeId: '1978752052',
    prefecture: 'Νομός Βοιωτίας',
  },
  {
    nodeId: '1966387221',
    prefecture: 'Νομός Αττικής',
  },
  {
    nodeId: '574382240',
    prefecture: 'Νομός Αττικής',
  },
];

const PREFECTURE_ORDER = [
  'Νομός Αττικής',
  'Νομός Βοιωτίας',
  'Νομός Ευβοίας',
] as const;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function projectToWorldPixels(
  latitude: number,
  longitude: number,
  zoom: number,
): {x: number; y: number} {
  const limitedLatitude = clamp(latitude, -85.05112878, 85.05112878);
  const scale = MAP_TILE_SIZE * 2 ** zoom;
  const x = ((longitude + 180) / 360) * scale;
  const sinLatitude = Math.sin((limitedLatitude * Math.PI) / 180);
  const y =
    (0.5 -
      Math.log((1 + sinLatitude) / (1 - sinLatitude)) / (4 * Math.PI)) *
    scale;

  return {
    x,
    y,
  };
}

function mod(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function hasPosition(node: NodeCardData): node is PositionedNode {
  return node.latitude !== null && node.longitude !== null;
}

function getLocalMapLayout(latitude: number, longitude: number): {
  originX: number;
  originY: number;
  startTileX: number;
  endTileX: number;
  startTileY: number;
  endTileY: number;
} {
  const center = projectToWorldPixels(latitude, longitude, MAP_ZOOM);
  const originX = center.x - MAP_VIEWPORT_WIDTH / 2;
  const originY = center.y - MAP_VIEWPORT_HEIGHT / 2;

  return {
    originX,
    originY,
    startTileX: Math.floor(originX / MAP_TILE_SIZE) - 1,
    endTileX:
      Math.floor((originX + MAP_VIEWPORT_WIDTH - 1) / MAP_TILE_SIZE) + 1,
    startTileY: Math.floor(originY / MAP_TILE_SIZE) - 1,
    endTileY:
      Math.floor((originY + MAP_VIEWPORT_HEIGHT - 1) / MAP_TILE_SIZE) + 1,
  };
}

function getMapPoint(
  latitude: number,
  longitude: number,
  originX: number,
  originY: number,
): {x: number; y: number} {
  const projected = projectToWorldPixels(latitude, longitude, MAP_ZOOM);

  return {
    x: Number((projected.x - originX).toFixed(2)),
    y: Number((projected.y - originY).toFixed(2)),
  };
}

function getBounds(values: number[]): [number, number] {
  const finiteValues = values.filter((value) => Number.isFinite(value));

  if (!finiteValues.length) {
    return [0, 1];
  }

  const minimum = Math.min(...finiteValues);
  const maximum = Math.max(...finiteValues);

  if (minimum === maximum) {
    return [minimum - 1, maximum + 1];
  }

  return [minimum, maximum];
}

function getPointsInBand(
  values: number[],
  left: number,
  right: number,
  top: number,
  bottom: number,
): Array<[number, number]> {
  const [minimum, maximum] = getBounds(values);
  const range = maximum - minimum || 1;

  return values.map((value, index) => {
    const x =
      left + (index / Math.max(values.length - 1, 1)) * (right - left);
    const normalized = (value - minimum) / range;
    const y = bottom - normalized * (bottom - top);
    return [Number(x.toFixed(2)), Number(y.toFixed(2))];
  });
}

function getPercentPointsInBand(
  values: number[],
  left: number,
  right: number,
  top: number,
  bottom: number,
): Array<[number, number]> {
  return values.map((value, index) => {
    const x =
      left + (index / Math.max(values.length - 1, 1)) * (right - left);
    const normalized = clamp(value, 0, 100) / 100;
    const y = bottom - normalized * (bottom - top);
    return [Number(x.toFixed(2)), Number(y.toFixed(2))];
  });
}

function getLinePath(points: Array<[number, number]>): string {
  return points
    .map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${x} ${y}`)
    .join(' ');
}

function resampleSeries(values: number[], targetLength: number): number[] {
  if (!values.length) {
    return [];
  }

  if (values.length === targetLength) {
    return values;
  }

  if (values.length === 1) {
    return Array.from({length: targetLength}, () => values[0]);
  }

  const sourceLastIndex = values.length - 1;

  return Array.from({length: targetLength}, (_, index) => {
    const position = (index / Math.max(targetLength - 1, 1)) * sourceLastIndex;
    const leftIndex = Math.floor(position);
    const rightIndex = Math.ceil(position);

    if (leftIndex === rightIndex) {
      return values[leftIndex];
    }

    const ratio = position - leftIndex;
    return values[leftIndex] + (values[rightIndex] - values[leftIndex]) * ratio;
  });
}

function padNumber(value: number): string {
  return value.toString().padStart(2, '0');
}

function formatRelativeTime(importTimeUs: number | null, nowMs: number): string {
  if (importTimeUs === null) {
    return '—';
  }

  const diffMs = Math.max(0, nowMs - importTimeUs / 1000);
  const minutes = Math.floor(diffMs / 60_000);

  if (minutes < 1) {
    return 'μόλις τώρα';
  }

  if (minutes < 60) {
    return `${minutes} λεπτά πριν`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours < 24) {
    if (remainingMinutes === 0) {
      return hours === 1 ? '1 ώρα πριν' : `${hours} ώρες πριν`;
    }

    return `${hours} ώρες και ${remainingMinutes} λεπτά πριν`;
  }

  const days = Math.floor(hours / 24);
  return days === 1 ? '1 ημέρα πριν' : `${days} ημέρες πριν`;
}

function createInitialNodeCardData(reference: CoreNodeReference): NodeCardData {
  return {
    ...reference,
    name: `Κόμβος ${reference.nodeId}`,
    shortName: reference.nodeId.slice(-4),
    role: '—',
    preset: '—',
    hexId: '—',
    latitude: null,
    longitude: null,
    lastSeen: 'Φόρτωση…',
    isStale: false,
    packets24h: 0,
    battery: null,
    voltage: null,
    activity24h: [...EMPTY_ACTIVITY_SERIES],
    batterySeries: [],
    voltageSeries: [],
    airUtilTxSeries: [],
    channelUtilizationSeries: [],
    isLoading: true,
  };
}

function createInitialNodeCards(): NodeCardData[] {
  return CORE_NODE_REFERENCES.map(createInitialNodeCardData);
}

function getPrefectureSections(nodes: NodeCardData[]) {
  return PREFECTURE_ORDER.map((prefecture) => ({
    prefecture,
    nodes: nodes.filter((node) => node.prefecture === prefecture),
  })).filter(({nodes: prefectureNodes}) => prefectureNodes.length > 0);
}

function logUnlessAborted(error: unknown): void {
  if (error instanceof Error && error.name === 'AbortError') {
    return;
  }

  console.error(error);
}

/** One request for every node: the endpoint returns the whole list. */
async function fetchNodeRecords(
  signal: AbortSignal,
): Promise<Map<string, MeshviewNode>> {
  const data = await fetchJson<NodesResponse>(
    getMeshviewApiUrl('nodes'),
    signal,
  );

  return new Map(
    (data.nodes ?? []).map((node) => [String(node.node_id), node]),
  );
}

/**
 * One request per node with no portnum filter, which yields the newest packet,
 * the telemetry subset and the hourly activity buckets all at once.
 */
async function fetchNodeSeries(
  nodeId: string,
  anchorHourMs: number,
  signal: AbortSignal,
): Promise<NodeSeries> {
  const data = await fetchJson<PacketsResponse>(
    getMeshviewApiUrl('packets', {
      from_node_id: nodeId,
      since: anchorHourMs * 1000 - ONE_DAY_US,
      limit: PACKET_PAGE_LIMIT,
    }),
    signal,
  );

  const packets = data.packets ?? [];
  // Anchored on the current hour, not on the node's newest active hour, so the
  // rightmost bar means now and a silent node shows a trailing gap.
  const activity24h = buildActivitySeriesFromPackets(packets, anchorHourMs);

  return {
    activity24h,
    // Sum of the buckets, not packets.length: the hour-aligned `since` can return
    // packets older than the window the bars actually show.
    packets24h: activity24h.reduce((total, value) => total + value, 0),
    lastPacketUs: getNewestPacketImportTimeUs(packets),
    telemetry: parseTelemetry(
      packets.filter((packet) => Number(packet.portnum) === TELEMETRY_PORTNUM),
    ),
  };
}

/**
 * The two requests fail independently, so each half falls back to what the card
 * already showed: identity from /nodes, series from /packets.
 */
function mergeNodeCard(
  reference: CoreNodeReference,
  previous: NodeCardData,
  record: MeshviewNode | undefined,
  series: NodeSeries | null,
  nowMs: number,
): NodeCardData {
  const lastPacketUs = series?.lastPacketUs ?? null;

  return {
    // Start from what was already on screen, then overlay whatever arrived fresh.
    ...previous,
    ...reference,
    ...(record && {
      name: record.long_name ?? previous.name,
      shortName: record.short_name ?? previous.shortName,
      role: record.role ?? previous.role,
      preset: record.channel ?? previous.preset,
      hexId: record.id ?? previous.hexId,
      latitude: typeof record.last_lat === 'number' ? record.last_lat / 1e7 : null,
      longitude: typeof record.last_long === 'number' ? record.last_long / 1e7 : null,
    }),
    ...(series
      ? {
          activity24h: series.activity24h,
          packets24h: series.packets24h,
          ...series.telemetry,
          isStale: lastPacketUs === null,
          lastSeen: formatRelativeTime(
            lastPacketUs ?? parseImportTimeUs(record?.last_seen_us),
            nowMs,
          ),
        }
      : {lastSeen: previous.isLoading ? '—' : previous.lastSeen}),
    isLoading: false,
  };
}

function LoadingLine({className}: {className?: string}) {
  return <span className={`${styles.loadingLine} ${className ?? ''}`} aria-hidden="true" />;
}

function VitalsCell({
  label,
  value,
  isLoading = false,
  isStale = false,
}: {
  label: string;
  value: string;
  isLoading?: boolean;
  isStale?: boolean;
}) {
  return (
    <div
      className={styles.vitalCell}
      data-state={isStale && !isLoading ? 'stale' : undefined}
      title={
        isStale && !isLoading
          ? 'Χωρίς πακέτα το τελευταίο 24ωρο.'
          : undefined
      }>
      <p className={styles.vitalLabel}>{label}</p>
      {isLoading ? (
        <LoadingLine className={styles.loadingVitalValue} />
      ) : (
        <p className={styles.vitalValue}>{value}</p>
      )}
    </div>
  );
}

function MiniMap({
  node,
  allNodes,
}: {
  node: NodeCardData;
  allNodes: NodeCardData[];
}) {
  if (node.latitude === null || node.longitude === null) {
    return (
      <div className={`${styles.mapPanel} ${styles.mapPanelUnavailable}`}>
        <div className={styles.mapUnavailableLabel}>
          {node.isLoading ? 'Φόρτωση χάρτη…' : 'Χωρίς θέση'}
        </div>
      </div>
    );
  }

  const mapLayout = getLocalMapLayout(node.latitude, node.longitude);
  const worldTileCount = 2 ** MAP_ZOOM;
  const tileColumns = Array.from(
    {length: mapLayout.endTileX - mapLayout.startTileX + 1},
    (_, index) => mapLayout.startTileX + index,
  );
  const tileRows = Array.from(
    {length: mapLayout.endTileY - mapLayout.startTileY + 1},
    (_, index) => mapLayout.startTileY + index,
  );
  const currentPosition = getMapPoint(
    node.latitude,
    node.longitude,
    mapLayout.originX,
    mapLayout.originY,
  );
  const visibleGhostNodes = allNodes
    .filter((otherNode) => otherNode.nodeId !== node.nodeId && hasPosition(otherNode))
    .map((otherNode) => ({
      nodeId: otherNode.nodeId,
      point: getMapPoint(
        otherNode.latitude,
        otherNode.longitude,
        mapLayout.originX,
        mapLayout.originY,
      ),
    }))
    .filter(
      ({point}) =>
        point.x >= -12 &&
        point.x <= MAP_VIEWPORT_WIDTH + 12 &&
        point.y >= -12 &&
        point.y <= MAP_VIEWPORT_HEIGHT + 12,
    );

  return (
    <div className={styles.mapPanel}>
      <div className={styles.mapTiles} aria-hidden="true">
        {tileRows.map((tileY) =>
          tileColumns.map((tileX) => {
            const wrappedTileX = mod(tileX, worldTileCount);
            const clampedTileY = clamp(tileY, 0, worldTileCount - 1);
            const left = tileX * MAP_TILE_SIZE - mapLayout.originX;
            const top = tileY * MAP_TILE_SIZE - mapLayout.originY;

            return (
              <img
                key={`${tileX}-${tileY}`}
                className={styles.mapTile}
                src={`https://tile.openstreetmap.org/${MAP_ZOOM}/${wrappedTileX}/${clampedTileY}.png`}
                alt=""
                loading="lazy"
                decoding="async"
                width={MAP_TILE_SIZE}
                height={MAP_TILE_SIZE}
                style={{left, top}}
              />
            );
          }),
        )}
      </div>

      <div className={styles.mapShade} aria-hidden="true" />

      <svg
        className={styles.mapSvg}
        viewBox={`0 0 ${MAP_VIEWPORT_WIDTH} ${MAP_VIEWPORT_HEIGHT}`}
        aria-hidden="true">
        {visibleGhostNodes.map(({nodeId, point}) => (
          <circle
            key={nodeId}
            className={styles.mapGhostMarker}
            cx={point.x}
            cy={point.y}
            r="3.2"
          />
        ))}
        <circle
          className={styles.mapMarkerRing}
          cx={currentPosition.x}
          cy={currentPosition.y}
          r={MAP_RING_RADIUS}
        />
        <circle
          className={styles.mapMarker}
          cx={currentPosition.x}
          cy={currentPosition.y}
          r="4.5"
        />
      </svg>

      <div className={styles.mapLabel}>
        <span>{node.shortName}</span>
      </div>

      <div className={styles.mapLabel + ' ' + styles.mapPresetLabel}>
        <span>{node.preset}</span>
      </div>

      <div className={styles.mapAttribution}>© OpenStreetMap</div>
    </div>
  );
}

function Combined24hPlot({
  activity,
  battery,
  voltage,
  airUtilTx,
  channelUtilization,
}: {
  activity: number[];
  battery: number[];
  voltage: number[];
  airUtilTx: number[];
  channelUtilization: number[];
}) {
  const width = 360;
  const height = 180;
  const plotLeft = 10;
  const plotRight = width - 10;
  const powerLabelY = 16;
  const powerTop = 24;
  const powerBottom = 62;
  const rfLabelY = 82;
  const rfTop = 90;
  const rfBottom = 116;
  const activityLabelY = 136;
  const activityBandTop = 144;
  const activityBottom = 166;
  const xAxisY = 168;
  // +1.6 centres the letters themselves (cap height plus descenders) rather than
  // their baseline, so the gap above and below the label comes out equal.
  // Tuned for the font-size: 7px in .plotXAxisLabel.
  const xAxisLabelY = (xAxisY + height) / 2 + 1.6;
  const powerSeparatorY = 72;
  const rfSeparatorY = 126;
  const hasBattery = battery.length > 0;
  const hasVoltage = voltage.length > 0;
  const hasAirUtilTx = airUtilTx.length > 0;
  const hasChannelUtilization = channelUtilization.length > 0;
  const hasPower = hasBattery || hasVoltage;
  const hasRfUtilization = hasAirUtilTx || hasChannelUtilization;
  const hasActivity = activity.some((value) => value > 0);
  const batteryPoints = hasBattery
    ? getPointsInBand(
        resampleSeries(battery, activity.length),
        plotLeft,
        plotRight,
        powerTop,
        powerBottom,
      )
    : [];
  const voltagePoints = hasVoltage
    ? getPointsInBand(
        resampleSeries(voltage, activity.length),
        plotLeft,
        plotRight,
        powerTop,
        powerBottom,
      )
    : [];
  const airUtilTxPoints = hasAirUtilTx
    ? getPercentPointsInBand(
        resampleSeries(airUtilTx, activity.length),
        plotLeft,
        plotRight,
        rfTop,
        rfBottom,
      )
    : [];
  const channelUtilizationPoints = hasChannelUtilization
    ? getPercentPointsInBand(
        resampleSeries(channelUtilization, activity.length),
        plotLeft,
        plotRight,
        rfTop,
        rfBottom,
      )
    : [];
  const peakActivity = Math.max(...activity, 1);
  const usableWidth = plotRight - plotLeft;
  const barWidth = usableWidth / activity.length - 1.8;
  const batteryLastPoint = batteryPoints[batteryPoints.length - 1];
  const voltageLastPoint = voltagePoints[voltagePoints.length - 1];
  const airUtilTxLastPoint = airUtilTxPoints[airUtilTxPoints.length - 1];
  const channelUtilizationLastPoint =
    channelUtilizationPoints[channelUtilizationPoints.length - 1];

  return (
    <svg className={styles.combinedPlot} viewBox={"0 0 " + width + " " + height} aria-hidden="true">
      <rect
        className={styles.plotBandFill}
        x="0"
        y={powerLabelY - 10}
        width={width}
        height={powerSeparatorY - powerLabelY + 4}
      />
      <rect
        className={styles.plotBandFill}
        x="0"
        y={rfLabelY - 10}
        width={width}
        height={rfSeparatorY - rfLabelY + 4}
      />
      <rect
        className={styles.plotBandFill}
        x="0"
        y={activityLabelY - 10}
        width={width}
        height={xAxisY - activityLabelY + 4}
      />
      {hasPower ? (
        <text className={styles.plotBandLabel} x={plotLeft} y={powerLabelY}>
          Τροφοδοσία
        </text>
      ) : null}
      {hasRfUtilization ? (
        <text className={styles.plotBandLabel} x={plotLeft} y={rfLabelY}>
          RF
        </text>
      ) : null}
      {hasActivity ? (
        <text className={styles.plotBandLabel} x={plotLeft} y={activityLabelY}>
          Πακέτα
        </text>
      ) : null}
      <line className={styles.plotDivider} x1={plotLeft} y1={powerSeparatorY} x2={plotRight} y2={powerSeparatorY} />
      <line className={styles.plotDivider} x1={plotLeft} y1={rfSeparatorY} x2={plotRight} y2={rfSeparatorY} />
      <line className={styles.plotTimeline} x1={plotLeft} y1={xAxisY} x2={plotRight} y2={xAxisY} />
      {activity.map((value, index) => {
        if (value <= 0) {
          return null;
        }

        const x = plotLeft + index * (usableWidth / activity.length) + 0.9;
        const barHeight = Math.max(
          6,
          (value / peakActivity) * (activityBottom - activityBandTop),
        );

        return (
          <rect
            key={index + "-" + value}
            className={styles.activityBar}
            x={x}
            y={activityBottom - barHeight}
            width={barWidth}
            height={barHeight}
            rx="2.5"
          />
        );
      })}
      {hasBattery ? (
        <path
          className={styles.line}
          d={getLinePath(batteryPoints)}
          data-series="battery"
        />
      ) : null}
      {hasVoltage ? (
        <path
          className={styles.line}
          d={getLinePath(voltagePoints)}
          data-series="voltage"
        />
      ) : null}
      {hasAirUtilTx ? (
        <path
          className={styles.line}
          d={getLinePath(airUtilTxPoints)}
          data-series="air-util-tx"
        />
      ) : null}
      {hasChannelUtilization ? (
        <path
          className={styles.line}
          d={getLinePath(channelUtilizationPoints)}
          data-series="channel-utilization"
        />
      ) : null}
      {hasBattery && batteryLastPoint ? (
        <circle
          className={styles.point}
          cx={batteryLastPoint[0]}
          cy={batteryLastPoint[1]}
          r="3.5"
          data-series="battery"
        />
      ) : null}
      {hasVoltage && voltageLastPoint ? (
        <circle
          className={styles.point}
          cx={voltageLastPoint[0]}
          cy={voltageLastPoint[1]}
          r="3.5"
          data-series="voltage"
        />
      ) : null}
      {hasAirUtilTx && airUtilTxLastPoint ? (
        <circle
          className={styles.point}
          cx={airUtilTxLastPoint[0]}
          cy={airUtilTxLastPoint[1]}
          r="3.5"
          data-series="air-util-tx"
        />
      ) : null}
      {hasChannelUtilization && channelUtilizationLastPoint ? (
        <circle
          className={styles.point}
          cx={channelUtilizationLastPoint[0]}
          cy={channelUtilizationLastPoint[1]}
          r="3.5"
          data-series="channel-utilization"
        />
      ) : null}
      <text className={styles.plotXAxisLabel} x={plotLeft} y={xAxisLabelY}>
        24ω πριν
      </text>
      <text
        className={styles.plotXAxisLabel}
        x={plotRight}
        y={xAxisLabelY}
        textAnchor="end">
        Τώρα
      </text>
      {!hasPower && !hasRfUtilization && !hasActivity ? (
        <text className={styles.emptyPlotText} x={width / 2} y={height / 2}>
          Χωρίς δεδομένα 24ώρου
        </text>
      ) : null}
    </svg>
  );
}

function getLatestSeriesValue(series: number[]): number | null {
  return series.length > 0 ? series[series.length - 1] : null;
}

function formatTelemetryPercent(value: number | null, precision = 0): string {
  if (value === null) {
    return '—';
  }

  const multiplier = 10 ** precision;
  const roundedValue = Math.round(value * multiplier) / multiplier;
  return `${roundedValue}%`;
}

function formatTelemetryVoltage(value: number | null): string {
  return value === null ? '—' : `${value.toFixed(2)}V`;
}

function formatPowerValue(node: NodeCardData): string {
  if (node.battery === null && node.voltage === null) {
    return 'Χωρίς δεδομένα';
  }

  const batteryValue = node.battery !== null ? `${node.battery}%` : '—';
  const voltageValue = node.voltage !== null ? `${node.voltage.toFixed(2)}V` : '—';
  return `${batteryValue} · ${voltageValue}`;
}

function PlotLoadingState() {
  return (
    <div className={styles.loadingPlot} aria-hidden="true">
      <LoadingLine className={styles.loadingPlotLinePrimary} />
      <LoadingLine className={styles.loadingPlotLineSecondary} />
      <div className={styles.loadingPlotBars}>
        {Array.from({length: 12}, (_, index) => (
          <span
            key={index}
            className={styles.loadingPlotBar}
            style={{height: `${28 + ((index * 11) % 46)}px`}}
          />
        ))}
      </div>
    </div>
  );
}

function ChartTelemetryItem({
  series,
  label,
  value,
}: {
  series: string;
  label: string;
  value: string;
}) {
  return (
    <div className={styles.chartLegendItem}>
      <span className={styles.chartLegendIcon} data-series={series} />
      <span className={styles.chartLegendLabel}>{label}</span>
      <span className={styles.chartLegendValue}>{value}</span>
    </div>
  );
}

function ChartTelemetryLegend({node}: {node: NodeCardData}) {
  const latestAirUtilTx = getLatestSeriesValue(node.airUtilTxSeries);
  const latestChannelUtilization = getLatestSeriesValue(
    node.channelUtilizationSeries,
  );
  const telemetryItems = [
    node.batterySeries.length > 0
      ? {
          series: "battery",
          label: "Μπαταρία",
          value: formatTelemetryPercent(node.battery),
        }
      : null,
    node.voltageSeries.length > 0
      ? {
          series: "voltage",
          label: "Τάση",
          value: formatTelemetryVoltage(node.voltage),
        }
      : null,
    node.airUtilTxSeries.length > 0
      ? {
          series: "air-util-tx",
          label: "Air TX",
          value: formatTelemetryPercent(latestAirUtilTx),
        }
      : null,
    node.channelUtilizationSeries.length > 0
      ? {
          series: "channel-utilization",
          label: "Κανάλι",
          value: formatTelemetryPercent(latestChannelUtilization),
        }
      : null,
  ].filter(
    (item): item is {series: string; label: string; value: string} =>
      item !== null,
  );

  if (node.isLoading) {
    return (
      <div className={styles.chartLegend} aria-hidden="true">
        {Array.from({length: 4}, (_, index) => (
          <div key={index} className={styles.chartLegendItem}>
            <LoadingLine className={styles.loadingLegendLine} />
          </div>
        ))}
      </div>
    );
  }

  if (!telemetryItems.length) {
    return null;
  }

  return (
    <div className={styles.chartLegend} aria-label="Τρέχουσα τηλεμετρία">
      {telemetryItems.map((item) => (
        <ChartTelemetryItem
          key={item.series}
          series={item.series}
          label={item.label}
          value={item.value}
        />
      ))}
    </div>
  );
}

function NodeCard({
  node,
  allNodes,
  isRefreshing,
}: {
  node: NodeCardData;
  allNodes: NodeCardData[];
  isRefreshing: boolean;
}) {
  return (
    <article
      className={`${styles.nodeCard} ${
        node.isLoading ? styles.nodeCardLoading : ''
      } ${isRefreshing && !node.isLoading ? styles.nodeCardRefreshing : ''}`}>
      <MiniMap node={node} allNodes={allNodes} />

      <div className={styles.cardBody}>
        <header className={styles.cardHeader}>
          <div className={styles.cardHeading}>
            <Heading as="h3" className={styles.cardTitle}>
              <a
                className={styles.cardTitleLink}
                href={`${MESHVIEW_BASE_URL}/node/${node.nodeId}`}
                target="_blank"
                rel="noopener noreferrer">
                {node.name}
              </a>
              {node.temporary && (
                <span className={styles.temporaryBadge}>Προσωρινός</span>
              )}
            </Heading>
            <p className={styles.cardMeta}>
              <span className={styles.cardMetaHex}>{node.hexId}</span>
              <span className={styles.cardMetaRole}>{node.role}</span>
            </p>
          </div>
        </header>

        <section className={styles.vitalsGrid}>
          <VitalsCell
            label="Τελευταίο πακέτο"
            value={node.lastSeen}
            isLoading={node.isLoading}
            isStale={node.isStale}
          />
          <VitalsCell
            label="Πακέτα 24ω"
            value={String(node.packets24h)}
            isLoading={node.isLoading}
          />
          <VitalsCell
            label="Τροφοδοσία"
            value={formatPowerValue(node)}
            isLoading={node.isLoading}
          />
        </section>

        <section className={styles.plotPanel}>
          <div className={styles.plotHeader}>
            <p className={styles.plotTitle}>
              {node.batterySeries.length > 0 || node.voltageSeries.length > 0 ||
              node.airUtilTxSeries.length > 0 || node.channelUtilizationSeries.length > 0
                ? 'Τηλεμετρία 24ώρου'
                : 'Δραστηριότητα 24ώρου'}
            </p>
          </div>
          <div className={styles.plotFrame}>
            {node.isLoading ? (
              <PlotLoadingState />
            ) : (
              <Combined24hPlot
                activity={node.activity24h}
                battery={node.batterySeries}
                voltage={node.voltageSeries}
                airUtilTx={node.airUtilTxSeries}
                channelUtilization={node.channelUtilizationSeries}
              />
            )}
          </div>
          <ChartTelemetryLegend node={node} />
        </section>
      </div>
    </article>
  );
}

function getRefreshTimestamp(lastUpdated: number | null): string {
  if (lastUpdated === null) {
    return 'Αναμονή…';
  }

  return new Intl.DateTimeFormat(LOCALE, {
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(lastUpdated);
}

function getRefreshCountdown(
  nextRefreshAt: number | null,
  now: number,
  isLoading: boolean,
  isRefreshing: boolean,
): string {
  if (isRefreshing) {
    return 'τώρα…';
  }

  if (nextRefreshAt === null) {
    return isLoading ? 'μετά τη φόρτωση…' : 'Αναμονή…';
  }

  const remainingSeconds = Math.max(0, Math.ceil((nextRefreshAt - now) / 1000));
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;

  return `σε ${padNumber(minutes)}:${padNumber(seconds)}`;
}

/**
 * The one-second tick lives here alone. In StatusPage it would re-render every
 * card and every MiniMap once a second.
 */
function RefreshCountdown({
  nextRefreshAt,
  isLoading,
  isRefreshing,
}: {
  nextRefreshAt: number | null;
  isLoading: boolean;
  isRefreshing: boolean;
}) {
  const now = useCountdownClock();

  return (
    <span className={styles.refreshValue}>
      {getRefreshCountdown(nextRefreshAt, now, isLoading, isRefreshing)}
    </span>
  );
}

function StatusHeader({
  isLoading,
  isRefreshing,
  lastUpdated,
  nextRefreshAt,
}: {
  isLoading: boolean;
  isRefreshing: boolean;
  lastUpdated: number | null;
  nextRefreshAt: number | null;
}) {
  return (
    <header className={styles.header}>
      <div>
        <Heading as="h1" className={styles.pageTitle}>
          Κατάσταση Κόμβων Κορμού
        </Heading>
        <p className={styles.pageSubtitle}>
          {isLoading ? 'Φόρτωση ζωντανών δεδομένων από το ' : 'Ζωντανά δεδομένα από το '}
          <a
            className={styles.pageSubtitleLink}
            href={MESHVIEW_BASE_URL}
            target="_blank"
            rel="noopener noreferrer">
            Meshview
          </a>
          {isLoading ? '…' : null}
        </p>
      </div>
      <div className={styles.refreshCard}>
        <div className={styles.refreshRow}>
          <span className={styles.refreshLabel}>Τελευταία ανανέωση</span>
          <span className={styles.refreshValue}>{getRefreshTimestamp(lastUpdated)}</span>
        </div>
        <div className={styles.refreshRow}>
          <span className={styles.refreshLabel}>Αυτόματη ανανέωση</span>
          <RefreshCountdown
            nextRefreshAt={nextRefreshAt}
            isLoading={isLoading}
            isRefreshing={isRefreshing}
          />
        </div>
        <div className={styles.refreshRow}>
          <span className={styles.refreshLabel}>Κατάσταση</span>
          <span className={styles.refreshStatus}>
            {isLoading ? 'Φόρτωση…' : isRefreshing ? 'Ανανέωση…' : 'Live'}
          </span>
        </div>
      </div>
    </header>
  );
}

function PrefectureSection({
  prefecture,
  nodes,
  allNodes,
  isRefreshing,
}: {
  prefecture: string;
  nodes: NodeCardData[];
  allNodes: NodeCardData[];
  isRefreshing: boolean;
}) {
  return (
    <section className={styles.prefectureSection}>
      <Heading as="h2" className={styles.prefectureTitle}>
        {prefecture}
      </Heading>

      <div className={styles.cardGrid}>
        {nodes.map((node) => (
          <NodeCard
            key={node.nodeId}
            node={node}
            allNodes={allNodes}
            isRefreshing={isRefreshing}
          />
        ))}
      </div>
    </section>
  );
}

function useCountdownClock(): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const countdownInterval = window.setInterval(() => {
      setNow(Date.now());
    }, REFRESH_COUNTDOWN_TICK_MS);

    return () => {
      window.clearInterval(countdownInterval);
    };
  }, []);

  return now;
}

function useCoreNodeStatus() {
  const [nodes, setNodes] = useState<NodeCardData[]>(createInitialNodeCards);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [nextRefreshAt, setNextRefreshAt] = useState<number | null>(null);
  const latestNodesRef = useRef<NodeCardData[]>(createInitialNodeCards());
  const nodeRecordsRef = useRef<{
    records: Map<string, MeshviewNode>;
    fetchedAtMs: number;
  } | null>(null);

  useEffect(() => {
    let isMounted = true;
    let refreshTimeoutId: number | null = null;
    const abortController = new AbortController();

    const clearRefreshTimeout = () => {
      if (refreshTimeoutId !== null) {
        window.clearTimeout(refreshTimeoutId);
        refreshTimeoutId = null;
      }
    };

    const scheduleNextRefresh = () => {
      const scheduledBase = Date.now();
      setNextRefreshAt(scheduledBase + AUTO_REFRESH_INTERVAL_MS);
      refreshTimeoutId = window.setTimeout(() => {
        void loadNodes(false);
      }, AUTO_REFRESH_INTERVAL_MS);
    };

    const loadNodeRecords = async (nowMs: number) => {
      const cached = nodeRecordsRef.current;

      if (cached && nowMs - cached.fetchedAtMs < NODE_RECORDS_TTL_MS) {
        return cached.records;
      }

      const records = await fetchNodeRecords(abortController.signal);
      nodeRecordsRef.current = {records, fetchedAtMs: nowMs};
      return records;
    };

    const loadNodes = async (initialLoad = false) => {
      clearRefreshTimeout();
      setNextRefreshAt(null);

      if (initialLoad) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }

      const nowMs = Date.now();
      // One hour-aligned anchor for every node: it fixes both the fetch window
      // and the bars, so the oldest bucket is complete, the packet count does not
      // drift between refreshes, and no bar falls outside what was fetched.
      const anchorHourMs = floorToUtcHourMs(nowMs);

      const [recordsResult, ...seriesResults] = await Promise.allSettled([
        loadNodeRecords(nowMs),
        ...CORE_NODE_REFERENCES.map((reference) =>
          fetchNodeSeries(reference.nodeId, anchorHourMs, abortController.signal),
        ),
      ]);

      if (!isMounted || abortController.signal.aborted) {
        return;
      }

      const records =
        recordsResult.status === 'fulfilled' ? recordsResult.value : undefined;

      if (recordsResult.status === 'rejected') {
        logUnlessAborted(recordsResult.reason);
      }

      const liveNodes = CORE_NODE_REFERENCES.map((reference, index) => {
        const seriesResult = seriesResults[index];

        if (seriesResult.status === 'rejected') {
          logUnlessAborted(seriesResult.reason);
        }

        return mergeNodeCard(
          reference,
          latestNodesRef.current[index],
          records?.get(reference.nodeId),
          seriesResult.status === 'fulfilled' ? seriesResult.value : null,
          nowMs,
        );
      });

      latestNodesRef.current = liveNodes;
      setNodes(liveNodes);
      setLastUpdated(Date.now());
      setIsLoading(false);
      setIsRefreshing(false);
      scheduleNextRefresh();
    };

    void loadNodes(true);

    return () => {
      isMounted = false;
      clearRefreshTimeout();
      abortController.abort();
    };
  }, []);

  return {
    nodes,
    isLoading,
    isRefreshing,
    lastUpdated,
    nextRefreshAt,
  };
}

export default function StatusPage() {
  const {nodes, isLoading, isRefreshing, lastUpdated, nextRefreshAt} = useCoreNodeStatus();
  const prefectureSections = getPrefectureSections(nodes);

  return (
    <Layout
      title="Κατάσταση Κόμβων Κορμού"
      description="Ζωντανές κάρτες κατάστασης για τους εγκεκριμένους κόμβους κορμού με δραστηριότητα και τηλεμετρία 24ώρου.">
      <main className={styles.page}>
        <div className={`container ${styles.shell}`}>
          <StatusHeader
            isLoading={isLoading}
            isRefreshing={isRefreshing}
            lastUpdated={lastUpdated}
            nextRefreshAt={nextRefreshAt}
          />

          {prefectureSections.map(({prefecture, nodes: prefectureNodes}) => (
            <PrefectureSection
              key={prefecture}
              prefecture={prefecture}
              nodes={prefectureNodes}
              allNodes={nodes}
              isRefreshing={isRefreshing}
            />
          ))}
        </div>
      </main>
    </Layout>
  );
}
