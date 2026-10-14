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

  it('describes loading, waiting and error states', () => {
    expect(getStatusLabel({kind: 'loading'})).toBe('Φορτώνει το live feed…');
    expect(getStatusLabel({kind: 'waiting'})).toBe('Περιμένουμε πακέτα');
    expect(getStatusLabel({kind: 'error'})).toBe('Το live feed δεν είναι διαθέσιμο');
  });

  it('abbreviates minutes the same way whether one or many', () => {
    expect(getStatusLabel({kind: 'stale', minutes: 1})).toBe(
      'Τελευταίο πακέτο πριν από 1 λ.',
    );
    expect(getStatusLabel({kind: 'stale', minutes: 12})).toBe(
      'Τελευταίο πακέτο πριν από 12 λ.',
    );
  });

  it.each([
    [{kind: 'loading'}, 'Φορτώνει το live feed…'],
    [{kind: 'error'}, 'Το live feed δεν είναι διαθέσιμο.'],
    [{kind: 'waiting'}, 'Περιμένουμε πακέτα.'],
    [{kind: 'live', seconds: 0}, 'Τελευταίο πακέτο μόλις τώρα.'],
    [{kind: 'live', seconds: 59}, 'Τελευταίο πακέτο πριν από 59 δ.'],
    [{kind: 'stale', minutes: 1}, 'Τελευταίο πακέτο πριν από 1 λ.'],
    [{kind: 'stale', minutes: 12}, 'Τελευταίο πακέτο πριν από 12 λ.'],
  ] as const)(
    'joins %j to its explanation with one sentence boundary',
    (status, sentence) => {
      expect(getStatusAccessibleName(getStatusLabel(status))).toBe(
        `Κατάσταση δικτύου: ${sentence} Η ένδειξη βασίζεται στην πρόσφατη κίνηση και στα σφάλματα του live feed πακέτων του Meshview· δεν ελέγχει κάθε κόμβο ή RF διαδρομή.`,
      );
    },
  );
});
