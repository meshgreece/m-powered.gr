import {useEffect, useRef, useState} from 'react';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import styles from './status.module.css';

const MESHVIEW_API_BASE = 'https://meshview.m-powered.gr/api';
const MESHVIEW_BASE_URL = 'https://meshview.m-powered.gr';
const HOURS_24 = 24;
const ONE_DAY_US = 24 * 60 * 60 * 1_000_000;
const AUTO_REFRESH_INTERVAL_MS = 60_000;
const REFRESH_COUNTDOWN_TICK_MS = 1_000;
const EMPTY_ACTIVITY_SERIES = Array.from({length: HOURS_24}, () => 0);
const MAP_TILE_SIZE = 256;
const MAP_ZOOM = 10;
const MAP_VIEWPORT_WIDTH = 320;
const MAP_VIEWPORT_HEIGHT = 136;
const MAP_RING_RADIUS = 12;
const LOCALE = 'el-GR';

type CoreNodeReference = {
  nodeId: string;
  prefecture: string;
};

type NodeCardData = CoreNodeReference & {
  name: string;
  shortName: string;
  role: string;
  hexId: string;
  latitude: number | null;
  longitude: number | null;
  lastSeen: string;
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

type MeshviewNode = {
  id?: string | null;
  long_name?: string | null;
  short_name?: string | null;
  role?: string | null;
  last_lat?: number | null;
  last_long?: number | null;
  last_seen_us?: number | string | null;
};

type NodeResponse = {
  nodes?: MeshviewNode[];
};

type StatsRow = {
  period?: string;
  count?: number;
};

type StatsResponse = {
  data?: StatsRow[];
};

type Packet = {
  import_time_us?: number | string;
  payload?: string | null;
};

type PacketsResponse = {
  packets?: Packet[];
};

type TelemetryData = {
  battery: number | null;
  voltage: number | null;
  batterySeries: number[];
  voltageSeries: number[];
  airUtilTxSeries: number[];
  channelUtilizationSeries: number[];
};

type PositionedNode = NodeCardData & {
  latitude: number;
  longitude: number;
};

const EMPTY_TELEMETRY: TelemetryData = {
  battery: null,
  voltage: null,
  batterySeries: [],
  voltageSeries: [],
  airUtilTxSeries: [],
  channelUtilizationSeries: [],
};

const CORE_NODE_REFERENCES: CoreNodeReference[] = [
  {
    nodeId: '3461419339',
    prefecture: 'Νομός Αττικής',
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
    nodeId: '749412878',
    prefecture: 'Νομός Ευβοίας',
  },
  {
    nodeId: '1966387221',
    prefecture: 'Νομός Αττικής',
  },
  {
    nodeId: '3463997083',
    prefecture: 'Νομός Αττικής',
  },
  {
    nodeId: '2389100065',
    prefecture: 'Νομός Ευβοίας',
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
  width: number,
  padding: number,
  top: number,
  bottom: number,
): Array<[number, number]> {
  const [minimum, maximum] = getBounds(values);
  const range = maximum - minimum || 1;

  return values.map((value, index) => {
    const x =
      padding +
      (index / Math.max(values.length - 1, 1)) * (width - padding * 2);
    const normalized = (value - minimum) / range;
    const y = bottom - normalized * (bottom - top);
    return [Number(x.toFixed(2)), Number(y.toFixed(2))];
  });
}

function getPercentPointsInBand(
  values: number[],
  width: number,
  padding: number,
  top: number,
  bottom: number,
): Array<[number, number]> {
  return values.map((value, index) => {
    const x =
      padding +
      (index / Math.max(values.length - 1, 1)) * (width - padding * 2);
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

function parseImportTimeUs(value: number | string | null | undefined): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function parseStatsPeriod(period: string): number | null {
  const parsed = Date.parse(`${period.replace(' ', 'T')}:00Z`);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatStatsPeriod(date: Date): string {
  return [
    date.getUTCFullYear(),
    padNumber(date.getUTCMonth() + 1),
    padNumber(date.getUTCDate()),
  ].join('-') + ` ${padNumber(date.getUTCHours())}:00`;
}

function buildActivitySeries(rows: StatsRow[] | undefined): number[] {
  if (!rows?.length) {
    return [...EMPTY_ACTIVITY_SERIES];
  }

  const countsByPeriod = new Map<string, number>();
  let latestPeriodMs: number | null = null;

  for (const row of rows) {
    if (!row.period) {
      continue;
    }

    const count = typeof row.count === 'number' && Number.isFinite(row.count) ? row.count : 0;
    countsByPeriod.set(row.period, count);

    const periodMs = parseStatsPeriod(row.period);
    if (periodMs !== null && (latestPeriodMs === null || periodMs > latestPeriodMs)) {
      latestPeriodMs = periodMs;
    }
  }

  if (latestPeriodMs === null) {
    return [...EMPTY_ACTIVITY_SERIES];
  }

  return Array.from({length: HOURS_24}, (_, index) => {
    const date = new Date(latestPeriodMs - (HOURS_24 - 1 - index) * 60 * 60 * 1000);
    return countsByPeriod.get(formatStatsPeriod(date)) ?? 0;
  });
}

function formatRelativeTime(importTimeUs: number | null): string {
  if (importTimeUs === null) {
    return '—';
  }

  const diffMs = Math.max(0, Date.now() - importTimeUs / 1000);
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

function parseMetric(payload: string | null | undefined, metric: string): number | null {
  if (!payload) {
    return null;
  }

  const match = payload.match(new RegExp(`${metric}:\\s*([\\d.]+)`));
  if (!match) {
    return null;
  }

  const parsed = Number.parseFloat(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseTelemetry(packets: Packet[] | undefined): TelemetryData {
  const orderedPackets = (packets ?? [])
    .map((packet) => ({
      importTimeUs: parseImportTimeUs(packet.import_time_us),
      payload: packet.payload ?? '',
    }))
    .filter(
      (packet): packet is {importTimeUs: number; payload: string} =>
        packet.importTimeUs !== null,
    )
    .sort((left, right) => left.importTimeUs - right.importTimeUs);

  const batterySeries: number[] = [];
  const voltageSeries: number[] = [];
  const airUtilTxSeries: number[] = [];
  const channelUtilizationSeries: number[] = [];

  for (const packet of orderedPackets) {
    const battery = parseMetric(packet.payload, 'battery_level');
    const voltage = parseMetric(packet.payload, 'voltage');
    const airUtilTx = parseMetric(packet.payload, 'air_util_tx');
    const channelUtilization = parseMetric(packet.payload, 'channel_utilization');

    if (battery !== null) {
      batterySeries.push(battery);
    }

    if (voltage !== null) {
      voltageSeries.push(voltage);
    }

    if (airUtilTx !== null) {
      airUtilTxSeries.push(airUtilTx);
    }

    if (channelUtilization !== null) {
      channelUtilizationSeries.push(channelUtilization);
    }
  }

  let latestBattery: number | null = null;
  let latestVoltage: number | null = null;

  for (let index = orderedPackets.length - 1; index >= 0; index -= 1) {
    const packet = orderedPackets[index];

    if (latestBattery === null) {
      latestBattery = parseMetric(packet.payload, 'battery_level');
    }

    if (latestVoltage === null) {
      latestVoltage = parseMetric(packet.payload, 'voltage');
    }

    if (latestBattery !== null && latestVoltage !== null) {
      break;
    }
  }

  return {
    battery: latestBattery !== null ? Math.round(latestBattery) : null,
    voltage: latestVoltage,
    batterySeries,
    voltageSeries,
    airUtilTxSeries,
    channelUtilizationSeries,
  };
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: {accept: 'application/json'},
  });

  if (!response.ok) {
    throw new Error(`Meshview request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

function getMeshviewApiUrl(
  endpoint: 'nodes' | 'packets' | 'stats',
  params: Record<string, number | string>,
): string {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    searchParams.set(key, String(value));
  }

  return `${MESHVIEW_API_BASE}/${endpoint}?${searchParams.toString()}`;
}

function createInitialNodeCardData(reference: CoreNodeReference): NodeCardData {
  return {
    ...reference,
    name: `Κόμβος ${reference.nodeId}`,
    shortName: reference.nodeId.slice(-4),
    role: '—',
    hexId: '—',
    latitude: null,
    longitude: null,
    lastSeen: 'Φόρτωση…',
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

async function fetchNodeCardDataSafely(
  reference: CoreNodeReference,
  latestNodes: NodeCardData[],
): Promise<NodeCardData> {
  try {
    return await fetchNodeCardData(reference);
  } catch (error) {
    console.error(error);
    return (
      latestNodes.find((node) => node.nodeId === reference.nodeId) ?? {
        ...createInitialNodeCardData(reference),
        lastSeen: '—',
        isLoading: false,
      }
    );
  }
}

function getPrefectureSections(nodes: NodeCardData[]) {
  return PREFECTURE_ORDER.map((prefecture) => ({
    prefecture,
    nodes: nodes.filter((node) => node.prefecture === prefecture),
  })).filter(({nodes: prefectureNodes}) => prefectureNodes.length > 0);
}

async function fetchNodeCardData(reference: CoreNodeReference): Promise<NodeCardData> {
  const telemetrySinceUs = Date.now() * 1000 - ONE_DAY_US;

  const [nodeResult, activityResult, telemetryResult] =
    await Promise.allSettled([
      fetchJson<NodeResponse>(
        getMeshviewApiUrl('nodes', {node_id: reference.nodeId}),
      ),
      fetchJson<StatsResponse>(
        getMeshviewApiUrl('stats', {
          from_node: reference.nodeId,
          period_type: 'hour',
          length: HOURS_24,
        }),
      ),
      fetchJson<PacketsResponse>(
        getMeshviewApiUrl('packets', {
          portnum: 67,
          from_node_id: reference.nodeId,
          since: telemetrySinceUs,
        }),
      ),
    ]);

  const node =
    nodeResult.status === 'fulfilled' ? (nodeResult.value.nodes ?? [])[0] : undefined;
  const activity24h =
    activityResult.status === 'fulfilled'
      ? buildActivitySeries(activityResult.value.data)
      : [...EMPTY_ACTIVITY_SERIES];
  const telemetry =
    telemetryResult.status === 'fulfilled'
      ? parseTelemetry(telemetryResult.value.packets)
      : EMPTY_TELEMETRY;

  const packets24h = activity24h.reduce((total, value) => total + value, 0);

  return {
    ...reference,
    name: node?.long_name ?? `Κόμβος ${reference.nodeId}`,
    shortName: node?.short_name ?? reference.nodeId.slice(-4),
    role: node?.role ?? '—',
    hexId: node?.id ?? '—',
    latitude: typeof node?.last_lat === 'number' ? node.last_lat / 1e7 : null,
    longitude: typeof node?.last_long === 'number' ? node.last_long / 1e7 : null,
    lastSeen: formatRelativeTime(parseImportTimeUs(node?.last_seen_us)),
    packets24h,
    battery: telemetry.battery,
    voltage: telemetry.voltage,
    activity24h,
    batterySeries: telemetry.batterySeries,
    voltageSeries: telemetry.voltageSeries,
    airUtilTxSeries: telemetry.airUtilTxSeries,
    channelUtilizationSeries: telemetry.channelUtilizationSeries,
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
}: {
  label: string;
  value: string;
  isLoading?: boolean;
}) {
  return (
    <div className={styles.vitalCell}>
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
  const width = 248;
  const height = 118;
  const padding = 10;
  const powerTop = 10;
  const rfTop = 50;
  const rfBottom = 78;
  const activityBottom = 108;
  const hasBattery = battery.length > 0;
  const hasVoltage = voltage.length > 0;
  const hasAirUtilTx = airUtilTx.length > 0;
  const hasChannelUtilization = channelUtilization.length > 0;
  const hasPower = hasBattery || hasVoltage;
  const hasRfUtilization = hasAirUtilTx || hasChannelUtilization;
  const hasActivity = activity.some((value) => value > 0);
  const powerBottom = hasRfUtilization ? 42 : 62;
  const activityBandTop = hasRfUtilization ? 88 : hasPower ? 74 : 18;
  const powerDividerY = hasRfUtilization ? 46 : 69;
  const batteryPoints = hasBattery
    ? getPointsInBand(
        resampleSeries(battery, activity.length),
        width,
        padding,
        powerTop,
        powerBottom,
      )
    : [];
  const voltagePoints = hasVoltage
    ? getPointsInBand(
        resampleSeries(voltage, activity.length),
        width,
        padding,
        powerTop,
        powerBottom,
      )
    : [];
  const airUtilTxPoints = hasAirUtilTx
    ? getPercentPointsInBand(
        resampleSeries(airUtilTx, activity.length),
        width,
        padding,
        rfTop,
        rfBottom,
      )
    : [];
  const channelUtilizationPoints = hasChannelUtilization
    ? getPercentPointsInBand(
        resampleSeries(channelUtilization, activity.length),
        width,
        padding,
        rfTop,
        rfBottom,
      )
    : [];
  const peakActivity = Math.max(...activity, 1);
  const usableWidth = width - padding * 2;
  const barWidth = usableWidth / activity.length - 1.5;
  const batteryLastPoint = batteryPoints[batteryPoints.length - 1];
  const voltageLastPoint = voltagePoints[voltagePoints.length - 1];
  const airUtilTxLastPoint = airUtilTxPoints[airUtilTxPoints.length - 1];
  const channelUtilizationLastPoint =
    channelUtilizationPoints[channelUtilizationPoints.length - 1];

  return (
    <svg className={styles.combinedPlot} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      {hasPower ? (
        <line
          className={styles.plotDivider}
          x1={padding}
          y1={powerDividerY}
          x2={width - padding}
          y2={powerDividerY}
        />
      ) : null}
      {hasRfUtilization ? (
        <line
          className={styles.plotDivider}
          x1={padding}
          y1={83}
          x2={width - padding}
          y2={83}
        />
      ) : null}
      {activity.map((value, index) => {
        if (value <= 0) {
          return null;
        }

        const x = padding + index * (usableWidth / activity.length) + 0.75;
        const barHeight =
          Math.max(
            6,
            (value / peakActivity) * (activityBottom - activityBandTop),
          );

        return (
          <rect
            key={`${index}-${value}`}
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
      {!hasPower && !hasRfUtilization && !hasActivity ? (
        <text className={styles.emptyPlotText} x={width / 2} y={height / 2}>
          Χωρίς δεδομένα 24ώρου
        </text>
      ) : null}
    </svg>
  );
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

function PlotLegend({node}: {node: NodeCardData}) {
  return (
    <div className={styles.plotLegend}>
      <span className={styles.legendItem}>
        <span className={styles.legendSwatch} data-series="activity" />
        Δραστηριότητα
      </span>
      {node.batterySeries.length > 0 ? (
        <span className={styles.legendItem}>
          <span className={styles.legendSwatch} data-series="battery" />
          Μπαταρία
        </span>
      ) : null}
      {node.voltageSeries.length > 0 ? (
        <span className={styles.legendItem}>
          <span className={styles.legendSwatch} data-series="voltage" />
          Τάση
        </span>
      ) : null}
      {node.airUtilTxSeries.length > 0 ? (
        <span className={styles.legendItem}>
          <span className={styles.legendSwatch} data-series="air-util-tx" />
          Air TX
        </span>
      ) : null}
      {node.channelUtilizationSeries.length > 0 ? (
        <span className={styles.legendItem}>
          <span className={styles.legendSwatch} data-series="channel-utilization" />
          Channel Busy
        </span>
      ) : null}
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
            </Heading>
            <p className={styles.cardMeta}>{node.role}</p>
          </div>
          <div className={styles.cardIdentifier}>
            <p className={styles.cardIdentifierLabel}>Hex ID</p>
            <p className={styles.cardIdentifierValue}>{node.hexId}</p>
          </div>
        </header>

        <section className={styles.vitalsGrid}>
          <VitalsCell
            label="Τελευταίο πακέτο"
            value={node.lastSeen}
            isLoading={node.isLoading}
          />
          <VitalsCell
            label="Πακέτα 24ώρου"
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
                ? 'Δραστηριότητα 24ώρου + τηλεμετρία'
                : 'Δραστηριότητα 24ώρου'}
            </p>
          </div>
          {node.isLoading ? (
            <LoadingLine className={styles.loadingLegendRow} />
          ) : (
            <PlotLegend node={node} />
          )}
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

function StatusHeader({
  isLoading,
  isRefreshing,
  lastUpdated,
  nextRefreshAt,
  now,
}: {
  isLoading: boolean;
  isRefreshing: boolean;
  lastUpdated: number | null;
  nextRefreshAt: number | null;
  now: number;
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
          <span className={styles.refreshValue}>
            {getRefreshCountdown(nextRefreshAt, now, isLoading, isRefreshing)}
          </span>
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

  useEffect(() => {
    let isMounted = true;
    let refreshTimeoutId: number | null = null;

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

    const loadNodes = async (initialLoad = false) => {
      clearRefreshTimeout();
      setNextRefreshAt(null);

      if (initialLoad) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }

      const liveNodes = await Promise.all(
        CORE_NODE_REFERENCES.map((reference) =>
          fetchNodeCardDataSafely(reference, latestNodesRef.current),
        ),
      );

      if (!isMounted) {
        return;
      }

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
  const now = useCountdownClock();
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
            now={now}
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
