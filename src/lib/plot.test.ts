import {describe, expect, it} from 'vitest';

import {
  getBounds,
  getLinePath,
  getPointsInBand,
  projectToWorldPixels,
} from './plot';

// The telemetry plot's power band, from Combined24hPlot.
const LEFT = 10;
const RIGHT = 350;
const TOP = 24;
const BOTTOM = 62;

/**
 * The resampling step that used to run before every series was plotted. Kept
 * here, and nowhere else, so the claim that justified deleting it stays
 * checkable: it only re-vertexed a polyline that already spanned the band.
 */
function resampleSeries(values: number[], targetLength: number): number[] {
  if (!values.length) return [];
  if (values.length === targetLength) return values;
  if (values.length === 1) {
    return Array.from({length: targetLength}, () => values[0]);
  }

  const sourceLastIndex = values.length - 1;

  return Array.from({length: targetLength}, (_, index) => {
    const position = (index / Math.max(targetLength - 1, 1)) * sourceLastIndex;
    const leftIndex = Math.floor(position);
    const rightIndex = Math.ceil(position);

    if (leftIndex === rightIndex) return values[leftIndex];

    return (
      values[leftIndex] +
      (values[rightIndex] - values[leftIndex]) * (position - leftIndex)
    );
  });
}

/** Height of a polyline at an arbitrary x, for comparing two of them. */
function heightAt(points: Array<[number, number]>, x: number): number {
  for (let index = 0; index < points.length - 1; index += 1) {
    const [leftX, leftY] = points[index];
    const [rightX, rightY] = points[index + 1];

    if (x >= leftX && x <= rightX) {
      return leftY + (rightY - leftY) * ((x - leftX) / (rightX - leftX || 1));
    }
  }

  return points[points.length - 1][1];
}

describe('όρια σειράς', () => {
  it('γυρίζει το εύρος των τιμών', () => {
    expect(getBounds([2, 9, 5])).toEqual([2, 9]);
  });

  it('ανοίγει τεχνητά το εύρος όταν όλες οι τιμές είναι ίδιες', () => {
    expect(getBounds([5, 5, 5])).toEqual([4, 6]);
  });

  it('αγνοεί μη πεπερασμένες τιμές και πέφτει σε [0, 1]', () => {
    expect(getBounds([Number.NaN, Number.POSITIVE_INFINITY])).toEqual([0, 1]);
  });
});

describe('σημεία μέσα στη ζώνη', () => {
  it('απλώνεται σε όλο το πλάτος και αντιστρέφει τον y άξονα', () => {
    const points = getPointsInBand([0, 10], LEFT, RIGHT, TOP, BOTTOM);

    expect(points[0]).toEqual([LEFT, BOTTOM]);
    expect(points.at(-1)).toEqual([RIGHT, TOP]);
  });

  it('δεν διαιρεί με το μηδέν σε επίπεδη σειρά', () => {
    const points = getPointsInBand([5, 5], LEFT, RIGHT, TOP, BOTTOM);

    expect(points.every(([, y]) => Number.isFinite(y))).toBe(true);
    expect(points[0][1]).toBe((TOP + BOTTOM) / 2);
  });

  // Regression: a single point emits a bare moveto, which draws nothing at all.
  it('τραβά γραμμή σε όλο το πλάτος με ένα μόνο δείγμα', () => {
    const points = getPointsInBand([3.9], LEFT, RIGHT, TOP, BOTTOM);

    expect(points).toHaveLength(2);
    expect(points[0][0]).toBe(LEFT);
    expect(points.at(-1)![0]).toBe(RIGHT);
    expect(getLinePath(points)).toContain('L');
  });

  it('κρατά τιμές εκτός ορίων μέσα στη ζώνη τους', () => {
    const points = getPointsInBand([50, 130], LEFT, RIGHT, 90, 116, [0, 100]);

    expect(points.every(([, y]) => y >= 90 && y <= 116)).toBe(true);
    expect(points.at(-1)![1]).toBe(90);
  });

  it('γυρίζει άδειο για άδεια σειρά', () => {
    expect(getPointsInBand([], LEFT, RIGHT, TOP, BOTTOM)).toEqual([]);
  });
});

describe('η διαγραμμένη επαναδειγματοληψία', () => {
  it('δεν άλλαζε την καμπύλη που σχεδιαζόταν', () => {
    const series = Array.from({length: 41}, (_, index) =>
      Math.round(Math.sin(index / 3) * 50 + 50),
    );
    const raw = getPointsInBand(series, LEFT, RIGHT, TOP, BOTTOM);
    const resampled = getPointsInBand(
      resampleSeries(series, 24),
      LEFT,
      RIGHT,
      TOP,
      BOTTOM,
    );

    let maxDeviation = 0;
    for (let x = LEFT; x <= RIGHT; x += 0.5) {
      maxDeviation = Math.max(
        maxDeviation,
        Math.abs(heightAt(raw, x) - heightAt(resampled, x)),
      );
    }

    // Against a 38px band: the two polylines are the same curve.
    expect(maxDeviation).toBeLessThan(2);
  });
});

describe('προβολή σε pixel του κόσμου', () => {
  it('βάζει τον μεσημβρινό και τον ισημερινό στο κέντρο', () => {
    const {x, y} = projectToWorldPixels(0, 0, 0);

    expect(x).toBeCloseTo(128);
    expect(y).toBeCloseTo(128);
  });

  it('κόβει τα πλάτη στα όρια του Mercator', () => {
    expect(projectToWorldPixels(90, 0, 0).y).toBeCloseTo(
      projectToWorldPixels(85.05112878, 0, 0).y,
    );
  });
});
