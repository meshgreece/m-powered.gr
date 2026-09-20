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

describe('πόση ώρα πριν', () => {
  it('γυρίζει παύλα χωρίς πακέτο', () => {
    expect(formatRelativeTime(null, NOW_MS)).toBe('—');
  });

  it('λέει «μόλις τώρα» κάτω από ένα λεπτό', () => {
    expect(formatRelativeTime(minutesAgoUs(0.5), NOW_MS)).toBe('μόλις τώρα');
  });

  it('μετρά σε λεπτά, ώρες και ημέρες', () => {
    expect(formatRelativeTime(minutesAgoUs(5), NOW_MS)).toBe('πριν από 5 λεπτά');
    expect(formatRelativeTime(minutesAgoUs(3 * 60), NOW_MS)).toBe(
      'πριν από 3 ώρες',
    );
    expect(formatRelativeTime(minutesAgoUs(4 * 24 * 60), NOW_MS)).toBe(
      'πριν από 4 ημέρες',
    );
  });

  it('αλλάζει μονάδα ακριβώς στα όρια', () => {
    expect(formatRelativeTime(minutesAgoUs(59), NOW_MS)).toContain('λεπτά');
    expect(formatRelativeTime(minutesAgoUs(60), NOW_MS)).toContain('ώρα');
    expect(formatRelativeTime(minutesAgoUs(24 * 60), NOW_MS)).toContain('ημέρα');
  });

  // A clock skewed ahead of the server must not produce a negative interval.
  it('δεν πάει στο μέλλον όταν το ρολόι είναι μπροστά', () => {
    expect(formatRelativeTime(minutesAgoUs(-30), NOW_MS)).toBe('μόλις τώρα');
  });
});

describe('αντίστροφη μέτρηση ανανέωσης', () => {
  it('δείχνει λεπτά και δευτερόλεπτα με δύο ψηφία', () => {
    expect(getRefreshCountdown(NOW_MS + 65_000, NOW_MS, false, false)).toBe(
      'σε 01:05',
    );
    expect(getRefreshCountdown(NOW_MS + 5_000, NOW_MS, false, false)).toBe(
      'σε 00:05',
    );
  });

  it('δεν γυρίζει αρνητικό όταν περάσει η ώρα', () => {
    expect(getRefreshCountdown(NOW_MS - 10_000, NOW_MS, false, false)).toBe(
      'σε 00:00',
    );
  });

  it('προηγείται η κατάσταση από την ώρα', () => {
    expect(getRefreshCountdown(NOW_MS, NOW_MS, false, true)).toBe('τώρα…');
    expect(getRefreshCountdown(null, NOW_MS, true, false)).toBe(
      'μετά τη φόρτωση…',
    );
  });
});

describe('τιμές τηλεμετρίας', () => {
  it('παίρνει την τελευταία τιμή της σειράς', () => {
    expect(getLatestSeriesValue([1, 2, 3])).toBe(3);
    expect(getLatestSeriesValue([])).toBeNull();
  });

  it('δείχνει μπαταρία και τάση μαζί', () => {
    expect(formatPowerValue({battery: 95, voltage: 4.122})).toBe('95% · 4.12V');
    expect(formatPowerValue({battery: null, voltage: 4.122})).toBe('— · 4.12V');
    expect(formatPowerValue({battery: null, voltage: null})).toBe(
      'Χωρίς δεδομένα',
    );
  });
});
