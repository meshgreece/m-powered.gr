import {describe, expect, it} from 'vitest';

import {
  HOUR_MS,
  buildActivitySeriesFromPackets,
  floorToUtcHourMs,
  getNewestPacketImportTimeUs,
  parseTelemetry,
  TELEMETRY_PORTNUM,
} from './meshview';
import type {MeshviewPacket} from './meshview';
import packetsFixture from './__fixtures__/packets-parnitha-24h.json';

const packets = packetsFixture.packets as MeshviewPacket[];

// The series /stats returned for the same node at the same moment
// (stats-parnitha-24h.json, anchored on 2026-09-19 11:00 UTC).
const STATS_DERIVED_SERIES = [
  2, 4, 0, 1, 0, 3, 0, 1, 0, 2, 0, 3, 1, 2, 0, 1, 0, 3, 2, 1, 0, 1, 0, 3,
];

describe('δραστηριότητα 24ώρου από πακέτα', () => {
  it('αναπαράγει τη σειρά που έδινε το /stats', () => {
    const series = buildActivitySeriesFromPackets(packets);

    // The first bucket is excluded: our `since` is hour-aligned and captures that
    // whole oldest hour, whereas the /stats window started midway through it.
    // That under-count is exactly what this change fixes.
    expect(series.slice(1)).toEqual(STATS_DERIVED_SERIES.slice(1));
    expect(series[0]).toBeGreaterThanOrEqual(STATS_DERIVED_SERIES[0]);
  });

  it('δεν χάνει πακέτα μέσα στο παράθυρο', () => {
    const series = buildActivitySeriesFromPackets(packets);
    expect(series.reduce((total, value) => total + value, 0)).toBe(packets.length);
  });

  it('κόβει ό,τι πέφτει έξω από το παράθυρο των 24 ωρών', () => {
    const anchorHourMs = floorToUtcHourMs(Date.now());
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

  it('αφήνει κενό στο τέλος όταν ο κόμβος έχει σιωπήσει', () => {
    const anchorHourMs = floorToUtcHourMs(Date.now());
    const threeHoursAgo: MeshviewPacket = {
      import_time_us: (anchorHourMs - 3 * HOUR_MS) * 1000,
    };

    const series = buildActivitySeriesFromPackets([threeHoursAgo], anchorHourMs);

    expect(series.slice(-3)).toEqual([0, 0, 0]);
    expect(series.at(-4)).toBe(1);
  });

  it('γυρίζει 24 μηδενικά χωρίς πακέτα', () => {
    expect(buildActivitySeriesFromPackets([])).toEqual(Array(24).fill(0));
    expect(getNewestPacketImportTimeUs([])).toBeNull();
  });

  // A non-empty list whose timestamps are all unusable must still be "no
  // packet" — never -Infinity, which would render as a date far in the past.
  it('γυρίζει null όταν καμία σφραγίδα χρόνου δεν διαβάζεται', () => {
    expect(
      getNewestPacketImportTimeUs([
        {import_time_us: undefined},
        {import_time_us: 'όχι αριθμός'},
      ]),
    ).toBeNull();
  });
});

describe('τηλεμετρία', () => {
  it('διαβάζει μόνο πακέτα τηλεμετρίας, με τη νεότερη τιμή τελευταία', () => {
    const telemetry = parseTelemetry(
      packets.filter((packet) => Number(packet.portnum) === TELEMETRY_PORTNUM),
    );

    expect(telemetry.battery).toBe(95);
    expect(telemetry.voltage).toBe(4.122);
    expect(telemetry.batterySeries.length).toBeGreaterThan(0);
  });

  // The series is built in ascending time order, so the newest reading is its
  // last element — there is nothing to scan backwards for.
  it('η τρέχουσα τιμή είναι η τελευταία της σειράς', () => {
    const telemetry = parseTelemetry(
      packets.filter((packet) => Number(packet.portnum) === TELEMETRY_PORTNUM),
    );

    expect(telemetry.battery).toBe(
      Math.round(telemetry.batterySeries[telemetry.batterySeries.length - 1]),
    );
    expect(telemetry.voltage).toBe(
      telemetry.voltageSeries[telemetry.voltageSeries.length - 1],
    );
  });
});
