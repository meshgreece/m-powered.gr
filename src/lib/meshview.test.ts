import {describe, expect, it} from 'vitest';

import {
  HOUR_MS,
  buildActivitySeriesFromPackets,
  getLatestImportTimeUs,
  getNewestPacketImportTimeUs,
  normalizeMeshviewCoordinate,
  parseImportTimeUs,
  parseTelemetry,
  TELEMETRY_PORTNUM,
} from './meshview';
import type {MeshviewPacket} from './meshview';
import packetsFixture from './__fixtures__/packets-parnitha-24h.json';

const packets = packetsFixture.packets as MeshviewPacket[];

// Captured packet counts per UTC hour, ending at 2026-09-19 11:00.
const EXPECTED_ACTIVITY_SERIES = [
  3, 4, 0, 1, 0, 3, 0, 1, 0, 2, 0, 3, 1, 2, 0, 1, 0, 3, 2, 1, 0, 1, 0, 3,
];

describe('node coordinates', () => {
  it('normalizes integer coordinates and rejects invalid ranges', () => {
    expect(normalizeMeshviewCoordinate(379682816, 90)).toBeCloseTo(37.9682816);
    expect(normalizeMeshviewCoordinate('236224512', 180)).toBeCloseTo(
      23.6224512,
    );
    expect(normalizeMeshviewCoordinate(null, 90)).toBeNull();
    expect(normalizeMeshviewCoordinate(undefined, 90)).toBeNull();
    expect(normalizeMeshviewCoordinate(910000000, 90)).toBeNull();
  });
});

describe('import timestamps', () => {
  it('accepts finite numeric and string timestamps', () => {
    expect(parseImportTimeUs(123)).toBe(123);
    expect(parseImportTimeUs('456')).toBe(456);
    expect(parseImportTimeUs('not-a-number')).toBeNull();
    expect(parseImportTimeUs(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it('finds the greatest timestamp in the response', () => {
    expect(
      getLatestImportTimeUs({
        latest_import_time: '20',
        packets: [{import_time_us: 12}, {import_time_us: 24}],
      }),
    ).toBe(24);
  });

  it('falls back to packet history when the cursor is missing', () => {
    expect(
      getLatestImportTimeUs({
        packets: [{import_time_us: 12}, {import_time_us: 24}],
      }),
    ).toBe(24);
  });

  it('keeps the cursor when it is ahead of the packets', () => {
    expect(
      getLatestImportTimeUs({
        latest_import_time: 90,
        packets: [{import_time_us: 12}],
      }),
    ).toBe(90);
    expect(
      getLatestImportTimeUs({latest_import_time: 90, packets: []}),
    ).toBe(90);
  });

  it('reports nothing when neither side has a timestamp', () => {
    expect(getLatestImportTimeUs({packets: []})).toBeNull();
  });
});

describe('24h activity from packets', () => {
  it('counts the captured packets in their exact hourly buckets', () => {
    expect(buildActivitySeriesFromPackets(packets)).toEqual(EXPECTED_ACTIVITY_SERIES);
  });

  it('drops anything outside the 24 hour window', () => {
    const anchorHourMs = Date.UTC(2026, 8, 19, 11);
    const inside: MeshviewPacket = {
      import_time_us: (anchorHourMs - 23 * HOUR_MS) * 1000,
    };
    const outside: MeshviewPacket = {
      import_time_us: (anchorHourMs - 24 * HOUR_MS) * 1000,
    };

    const series = buildActivitySeriesFromPackets([inside, outside], anchorHourMs);

    expect(series[0]).toBe(1);
    expect(series.reduce((total, value) => total + value, 0)).toBe(1);
  });

  it('leaves a trailing gap when the node has gone quiet', () => {
    const anchorHourMs = Date.UTC(2026, 8, 19, 11);
    const threeHoursAgo: MeshviewPacket = {
      import_time_us: (anchorHourMs - 3 * HOUR_MS) * 1000,
    };

    const series = buildActivitySeriesFromPackets([threeHoursAgo], anchorHourMs);

    expect(series.slice(-3)).toEqual([0, 0, 0]);
    expect(series.at(-4)).toBe(1);
  });

  it('returns 24 zeros when there are no packets', () => {
    expect(buildActivitySeriesFromPackets([])).toEqual(Array(24).fill(0));
    expect(getNewestPacketImportTimeUs([])).toBeNull();
  });

  // A non-empty list whose timestamps are all unusable must still be "no
  // packet" — never -Infinity, which would render as a date far in the past.
  it('returns null when no timestamp can be read', () => {
    expect(
      getNewestPacketImportTimeUs([
        {import_time_us: undefined},
        {import_time_us: 'not a number'},
      ]),
    ).toBeNull();
  });
});

describe('telemetry', () => {
  it('parses telemetry with the newest readings last', () => {
    const telemetry = parseTelemetry(
      packets.filter((packet) => Number(packet.portnum) === TELEMETRY_PORTNUM),
    );

    expect(telemetry.battery).toBe(95);
    expect(telemetry.voltage).toBe(4.122);
    expect(telemetry.batterySeries.length).toBeGreaterThan(0);
    expect(telemetry.battery).toBe(Math.round(telemetry.batterySeries.at(-1)!));
    expect(telemetry.voltage).toBe(telemetry.voltageSeries.at(-1));
    expect(telemetry.airUtilTxSeries.at(-1)).toBe(1.1115834);
    expect(telemetry.channelUtilizationSeries.at(-1)).toBe(2.5733333);
  });
});
