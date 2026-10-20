import {describe, expect, it} from 'vitest';

import {IDLE_CAPTION, SCENARIOS, captionAt, overlaps, receivedAtM} from './collisions';

const [clear, hidden] = SCENARIOS;

describe('collision scenarios', () => {
  it('has the two tabs from the brief', () => {
    expect(SCENARIOS.map((s) => s.label)).toEqual(['Ακούν ο ένας τον άλλον', 'Κρυφός κόμβος']);
  });

  it('delivers both messages when nodes hear each other', () => {
    expect(overlaps(clear)).toEqual([]);
    expect(receivedAtM(clear)).toEqual(['X', 'Y']);
  });

  it('loses both messages at M with a hidden node', () => {
    expect(overlaps(hidden)).toEqual([{start: 0.2, end: 0.5}]);
    expect(receivedAtM(hidden)).toEqual([]);
  });

  it('shows the latest caption at a given time', () => {
    expect(captionAt(hidden, 0)).toBe('Ο X εκπέμπει.');
    expect(captionAt(hidden, 0.25)).toBe('Ο Y δεν ακούει τον X πίσω από τον λόφο και εκπέμπει κι αυτός.');
    expect(captionAt(clear, 3)).toBe('Και τα δύο μηνύματα έφτασαν.');
  });

  it('has an idle caption before playback', () => {
    expect(IDLE_CAPTION).toBe('Πάτησε «Παίξε» για να δεις τι συμβαίνει στη συχνότητα.');
  });
});
