import {describe, expect, it, vi} from 'vitest';
import {getStatusAccessibleName, getStatusLabel} from './statusLabel';

vi.mock('@docusaurus/Translate', () => ({
  translate: (
    {message}: {message: string},
    values: Record<string, string | number> = {},
  ) => message.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key])),
}));

describe('status label', () => {
  it('shows elapsed seconds while live', () => {
    expect(getStatusLabel({kind: 'live', seconds: 0})).toBe(
      'Τελευταίο πακέτο μόλις τώρα',
    );
    expect(getStatusLabel({kind: 'live', seconds: 1})).toBe(
      'Τελευταίο πακέτο πριν από 1 δ.',
    );
    expect(getStatusLabel({kind: 'live', seconds: 59})).toBe(
      'Τελευταίο πακέτο πριν από 59 δ.',
    );
  });

  it('keeps the other states unchanged', () => {
    expect(getStatusLabel({kind: 'loading'})).toBe('Φορτώνει η ζωντανή ροή…');
    expect(getStatusLabel({kind: 'waiting'})).toBe('Περιμένουμε πακέτα');
    expect(getStatusLabel({kind: 'error'})).toBe('Η ζωντανή ροή δεν είναι διαθέσιμη');
  });

  it('abbreviates minutes the same way whether one or many', () => {
    expect(getStatusLabel({kind: 'stale', minutes: 1})).toBe(
      'Τελευταίο πακέτο πριν από 1 λ.',
    );
    expect(getStatusLabel({kind: 'stale', minutes: 12})).toBe(
      'Τελευταίο πακέτο πριν από 12 λ.',
    );
  });

  it('carries the elapsed time into the accessible name', () => {
    const names = [0, 1, 59].map((seconds) =>
      getStatusAccessibleName(getStatusLabel({kind: 'live', seconds})),
    );
    expect(names).toEqual([
      'Κατάσταση δικτύου: Τελευταίο πακέτο μόλις τώρα',
      'Κατάσταση δικτύου: Τελευταίο πακέτο πριν από 1 δ.',
      'Κατάσταση δικτύου: Τελευταίο πακέτο πριν από 59 δ.',
    ]);
  });
});
