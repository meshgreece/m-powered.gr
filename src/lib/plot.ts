// Pure geometry for the /status page: Web Mercator tile projection for the
// mini maps, and band-normalised point series for the telemetry plot.
//
// Lives here rather than in src/pages for the reason given at the top of
// meshview.ts: @docusaurus/plugin-content-pages routes every .ts file under
// src/pages. Alias-free on purpose so vitest, which runs with no config, can
// import it.

export const MAP_TILE_SIZE = 256;
export const MAP_ZOOM = 10;
export const MAP_VIEWPORT_WIDTH = 320;
export const MAP_VIEWPORT_HEIGHT = 136;

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function mod(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

export function projectToWorldPixels(
  latitude: number,
  longitude: number,
  zoom: number,
): {x: number; y: number} {
  const limitedLatitude = clamp(latitude, -85.05112878, 85.05112878);
  const scale = MAP_TILE_SIZE * 2 ** zoom;
  const x = ((longitude + 180) / 360) * scale;
  const sinLatitude = Math.sin((limitedLatitude * Math.PI) / 180);
  const y =
    (0.5 - Math.log((1 + sinLatitude) / (1 - sinLatitude)) / (4 * Math.PI)) *
    scale;

  return {
    x,
    y,
  };
}

export function getLocalMapLayout(
  latitude: number,
  longitude: number,
): {
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

export function getMapPoint(
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

export function getBounds(values: number[]): [number, number] {
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

/**
 * Spreads `values` evenly across [left, right] and scales them into the band
 * between `top` and `bottom`.
 *
 * `fixedBounds` pins the vertical scale instead of deriving it from the data,
 * which is what the percentage series need. Values are always clamped into the
 * bounds: telemetry is regex-scraped from an unvalidated payload, and an
 * out-of-range reading would otherwise draw outside its own band and overlap a
 * neighbouring series.
 */
export function getPointsInBand(
  values: number[],
  left: number,
  right: number,
  top: number,
  bottom: number,
  fixedBounds?: readonly [number, number],
): Array<[number, number]> {
  const [minimum, maximum] = fixedBounds ?? getBounds(values);
  const range = maximum - minimum || 1;
  // A lone point emits a bare moveto, which renders no stroke at all, so a
  // single sample is stretched into a flat line spanning the whole band.
  const spread = values.length === 1 ? [values[0], values[0]] : values;

  return spread.map((value, index) => {
    const x = left + (index / Math.max(spread.length - 1, 1)) * (right - left);
    const normalized = (clamp(value, minimum, maximum) - minimum) / range;
    const y = bottom - normalized * (bottom - top);
    return [Number(x.toFixed(2)), Number(y.toFixed(2))];
  });
}

export function getLinePath(points: Array<[number, number]>): string {
  return points
    .map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${x} ${y}`)
    .join(' ');
}
