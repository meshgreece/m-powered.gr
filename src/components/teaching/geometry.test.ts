import {describe, expect, it} from 'vitest';
import {insetSegment} from './geometry';

describe('insetSegment', () => {
  it('shortens a horizontal segment at both ends', () => {
    expect(insetSegment([0, 0], [10, 0], 2)).toEqual([[2, 0], [8, 0]]);
  });
  it('shortens a vertical segment at both ends', () => {
    expect(insetSegment([0, 0], [0, 10], 3)).toEqual([[0, 3], [0, 7]]);
  });
  it('shortens a diagonal segment', () => {
    const [a, b] = insetSegment([0, 0], [3, 4], 1);
    expect(a[0]).toBeCloseTo(0.6);
    expect(a[1]).toBeCloseTo(0.8);
    expect(b[0]).toBeCloseTo(2.4);
    expect(b[1]).toBeCloseTo(3.2);
  });
});
