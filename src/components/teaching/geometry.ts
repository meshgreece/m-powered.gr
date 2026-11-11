export type Point = readonly [number, number];

/** The segment from `from` to `to`, shortened by `inset` at both ends. */
export function insetSegment(from: Point, to: Point, inset: number): [Point, Point] {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const len = Math.hypot(dx, dy);
  if (len === 0) return [from, to];
  const ux = (dx / len) * inset;
  const uy = (dy / len) * inset;
  return [
    [from[0] + ux, from[1] + uy],
    [to[0] - ux, to[1] - uy],
  ];
}
