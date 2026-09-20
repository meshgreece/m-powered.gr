// Shared Meshview API access and the pure derivations built on top of it.
//
// Lives outside src/pages because @docusaurus/plugin-content-pages routes every
// .ts file under src/pages, and outside the components tree so both the /status
// page and the navbar widget can import it. Alias-free on purpose: vitest runs
// with no config here and cannot resolve @site.

export const MESHVIEW_BASE_URL = 'https://meshview.m-powered.gr';
const MESHVIEW_API_BASE = `${MESHVIEW_BASE_URL}/api`;

const HOURS_24 = 24;
export const HOUR_MS = 60 * 60 * 1_000;
export const ONE_DAY_US = 24 * 60 * 60 * 1_000_000;

/** Meshtastic PortNum.TELEMETRY_APP. */
export const TELEMETRY_PORTNUM = 67;

export const EMPTY_ACTIVITY_SERIES = Array.from({length: HOURS_24}, () => 0);

export type MeshviewNode = {
  id?: string | null;
  node_id?: number | string | null;
  long_name?: string | null;
  short_name?: string | null;
  role?: string | null;
  channel?: string | null;
  last_lat?: number | null;
  last_long?: number | null;
  last_seen_us?: number | string | null;
};

export type NodesResponse = {
  nodes?: MeshviewNode[];
};

export type MeshviewPacket = {
  import_time_us?: number | string;
  portnum?: number | string | null;
  payload?: string | null;
};

export type PacketsResponse = {
  latest_import_time?: number | string;
  packets?: MeshviewPacket[];
};

export type TelemetryData = {
  battery: number | null;
  voltage: number | null;
  batterySeries: number[];
  voltageSeries: number[];
  airUtilTxSeries: number[];
  channelUtilizationSeries: number[];
};

export async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: {accept: 'application/json'},
    signal,
  });

  if (!response.ok) {
    throw new Error(`Meshview request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export function getMeshviewApiUrl(
  endpoint: 'nodes' | 'packets',
  params: Record<string, number | string> = {},
): string {
  const query = new URLSearchParams(
    Object.entries(params).map(([key, value]) => [key, String(value)]),
  ).toString();

  return `${MESHVIEW_API_BASE}/${endpoint}${query ? `?${query}` : ''}`;
}

export function parseImportTimeUs(
  value: number | string | null | undefined,
): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function getNewestPacketImportTimeUs(
  packets: MeshviewPacket[] | undefined,
): number | null {
  if (!Array.isArray(packets)) {
    return null;
  }

  const newestImportTimeUs = Math.max(
    ...packets
      .map((packet) => parseImportTimeUs(packet.import_time_us))
      .filter((importTimeUs) => importTimeUs !== null),
  );

  // Math.max() over nothing is -Infinity, which must never reach a timestamp:
  // no packets and no readable timestamps both mean "nothing to show".
  return Number.isFinite(newestImportTimeUs) ? newestImportTimeUs : null;
}

export function floorToUtcHourMs(ms: number): number {
  return Math.floor(ms / HOUR_MS) * HOUR_MS;
}

/**
 * Packets per UTC hour, oldest bucket first, for the 24 hours ending at
 * `anchorHourMs`. Defaults to anchoring on the newest hour that actually
 * contains a packet, which is what the /stats-derived series used to do.
 */
export function buildActivitySeriesFromPackets(
  packets: MeshviewPacket[] | undefined,
  anchorHourMs?: number,
): number[] {
  const countsByHour = new Map<number, number>();

  for (const packet of packets ?? []) {
    const importTimeUs = parseImportTimeUs(packet.import_time_us);

    if (importTimeUs === null) {
      continue;
    }

    const hourMs = floorToUtcHourMs(importTimeUs / 1000);
    countsByHour.set(hourMs, (countsByHour.get(hourMs) ?? 0) + 1);
  }

  const anchor = anchorHourMs ?? Math.max(...countsByHour.keys());

  if (!Number.isFinite(anchor)) {
    return [...EMPTY_ACTIVITY_SERIES];
  }

  return Array.from(
    {length: HOURS_24},
    (_, index) => countsByHour.get(anchor - (HOURS_24 - 1 - index) * HOUR_MS) ?? 0,
  );
}

function parseMetric(
  payload: string | null | undefined,
  metric: string,
): number | null {
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

export function parseTelemetry(packets: MeshviewPacket[] | undefined): TelemetryData {
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

  // Both series are built in ascending time order, so the newest reading is
  // already the last element of each.
  const latestBattery = batterySeries.at(-1) ?? null;
  const latestVoltage = voltageSeries.at(-1) ?? null;

  return {
    battery: latestBattery !== null ? Math.round(latestBattery) : null,
    voltage: latestVoltage,
    batterySeries,
    voltageSeries,
    airUtilTxSeries,
    channelUtilizationSeries,
  };
}
