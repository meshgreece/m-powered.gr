import {describe, expect, it} from 'vitest';

import {
  formatPowerValue,
  formatRelativeTime,
  getLatestSeriesValue,
  getRefreshCountdown,
} from './format';

const NOW_MS = Date.UTC(2026, 8, 20, 12, 0, 0);

/** A packet that arrived `minutes` before NOW_MS, in microseconds. */
function minutesAgoUs(minutes: number): number {
  return (NOW_MS - minutes * 60_000) * 1000;
}

describe('relative time', () => {
  it('returns a dash when there is no packet', () => {
    expect(formatRelativeTime(null, NOW_MS)).toBe('—');
  });

  it('says just now under one minute', () => {
    expect(formatRelativeTime(minutesAgoUs(0.5), NOW_MS)).toBe('μόλις τώρα');
  });

  it('counts in minutes, hours and days', () => {
    expect(formatRelativeTime(minutesAgoUs(5), NOW_MS)).toBe('πριν από 5 λεπτά');
    expect(formatRelativeTime(minutesAgoUs(3 * 60), NOW_MS)).toBe(
      'πριν από 3 ώρες',
    );
    expect(formatRelativeTime(minutesAgoUs(4 * 24 * 60), NOW_MS)).toBe(
      'πριν από 4 ημέρες',
    );
  });

  it('switches unit exactly at the boundaries', () => {
    expect(formatRelativeTime(minutesAgoUs(59), NOW_MS)).toContain('λεπτά');
    expect(formatRelativeTime(minutesAgoUs(60), NOW_MS)).toContain('ώρα');
    expect(formatRelativeTime(minutesAgoUs(24 * 60), NOW_MS)).toContain('ημέρα');
  });

  // A clock skewed ahead of the server must not produce a negative interval.
  it('never reads into the future when the clock runs ahead', () => {
    expect(formatRelativeTime(minutesAgoUs(-30), NOW_MS)).toBe('μόλις τώρα');
  });
});

describe('refresh countdown', () => {
  it('shows two digit minutes and seconds', () => {
    expect(getRefreshCountdown(NOW_MS + 65_000, NOW_MS, false, false)).toBe(
      'σε 01:05',
    );
    expect(getRefreshCountdown(NOW_MS + 5_000, NOW_MS, false, false)).toBe(
      'σε 00:05',
    );
  });

  it('does not go negative once the time has passed', () => {
    expect(getRefreshCountdown(NOW_MS - 10_000, NOW_MS, false, false)).toBe(
      'σε 00:00',
    );
  });

  it('state takes precedence over the time', () => {
    expect(getRefreshCountdown(NOW_MS, NOW_MS, false, true)).toBe('τώρα…');
    expect(getRefreshCountdown(null, NOW_MS, true, false)).toBe(
      'μετά τη φόρτωση…',
    );
  });
});

describe('telemetry values', () => {
  it('takes the last value of the series', () => {
    expect(getLatestSeriesValue([1, 2, 3])).toBe(3);
    expect(getLatestSeriesValue([])).toBeNull();
  });

  it('shows battery and voltage together', () => {
    expect(formatPowerValue({battery: 95, voltage: 4.122})).toBe('95% · 4.12V');
    expect(formatPowerValue({battery: null, voltage: 4.122})).toBe('— · 4.12V');
    expect(formatPowerValue({battery: null, voltage: null})).toBe(
      'Χωρίς δεδομένα',
    );
  });
});
