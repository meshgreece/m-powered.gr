// Greek display formatting for the /status page. Pure functions, no React.
//
// Outside src/pages for the reason given at the top of meshview.ts, and
// alias-free so vitest can import it without a config.

const LOCALE = 'el-GR';

const RELATIVE_TIME = new Intl.RelativeTimeFormat('el', {numeric: 'always'});

/**
 * How long ago a packet arrived, e.g. "πριν από 5 λεπτά".
 *
 * `numeric: 'always'` on purpose: the 'auto' form turns -1 day into "χθες" and
 * 0 minutes into "τρέχον λεπτό", which read oddly against a packet timestamp.
 */
export function formatRelativeTime(
  importTimeUs: number | null,
  nowMs: number,
): string {
  if (importTimeUs === null) {
    return '—';
  }

  const minutes = Math.floor(Math.max(0, nowMs - importTimeUs / 1000) / 60_000);

  if (minutes < 1) {
    return 'μόλις τώρα';
  }

  if (minutes < 60) {
    return RELATIVE_TIME.format(-minutes, 'minute');
  }

  const hours = Math.floor(minutes / 60);

  return hours < 24
    ? RELATIVE_TIME.format(-hours, 'hour')
    : RELATIVE_TIME.format(-Math.floor(hours / 24), 'day');
}

export function getRefreshTimestamp(lastUpdated: number | null): string {
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

export function getRefreshCountdown(
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
  const minutes = String(Math.floor(remainingSeconds / 60)).padStart(2, '0');
  const seconds = String(remainingSeconds % 60).padStart(2, '0');

  return `σε ${minutes}:${seconds}`;
}

export function getLatestSeriesValue(series: number[]): number | null {
  return series.length > 0 ? series[series.length - 1] : null;
}

export function formatTelemetryPercent(
  value: number | null,
  precision = 0,
): string {
  if (value === null) {
    return '—';
  }

  const multiplier = 10 ** precision;
  const roundedValue = Math.round(value * multiplier) / multiplier;
  return `${roundedValue}%`;
}

export function formatTelemetryVoltage(value: number | null): string {
  return value === null ? '—' : `${value.toFixed(2)}V`;
}

export function formatPowerValue(power: {
  battery: number | null;
  voltage: number | null;
}): string {
  if (power.battery === null && power.voltage === null) {
    return 'Χωρίς δεδομένα';
  }

  const batteryValue = power.battery !== null ? `${power.battery}%` : '—';
  const voltageValue =
    power.voltage !== null ? `${power.voltage.toFixed(2)}V` : '—';
  return `${batteryValue} · ${voltageValue}`;
}
