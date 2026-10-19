import {describe, expect, it} from 'vitest';

import {DEFAULT_SELECTION, hasPositionPrivacyWarning} from './config';
import {
  createGeneratorSearchParams,
  parseGeneratorSelection,
} from './selection';

describe('configuration generator URL selection', () => {
  it('uses the configured defaults when optional parameters are absent', () => {
    expect(
      parseGeneratorSelection(new URLSearchParams()),
    ).toEqual({
      profileId: 'NarrowSlow',
      hopLimit: 4,
      positionPrecision: 14,
      additionalChannels: [],
    });
  });

  it('keeps explicit legacy LongFast selections readable', () => {
    expect(
      parseGeneratorSelection(new URLSearchParams('preset=LongFast')).profileId,
    ).toBe('LongFast');
  });

  it('ignores firmware query parameters', () => {
    const selection = parseGeneratorSelection(
      new URLSearchParams('preset=NarrowSlow&fw=2.7'),
    );

    expect(selection).toEqual(
      parseGeneratorSelection(new URLSearchParams('preset=NarrowSlow')),
    );
    expect(createGeneratorSearchParams(selection).has('fw')).toBe(false);
  });

  it('parses all supported generator parameters', () => {
    expect(
      parseGeneratorSelection(
        new URLSearchParams(
          'preset=NarrowSlow&hop=5&precision=32&test=true&bots=true',
        ),
      ),
    ).toEqual({
      profileId: 'NarrowSlow',
      hopLimit: 5,
      positionPrecision: 32,
      additionalChannels: ['Test', 'Bots'],
    });
  });

  it('falls back safely for unsupported or malformed values', () => {
    expect(
      parseGeneratorSelection(
        new URLSearchParams(
          'preset=invalid&hop=6&precision=17.5&test=1&bots=false',
        ),
      ),
    ).toEqual(DEFAULT_SELECTION);
  });

  it.each(['constructor', '__proto__', 'toString', 'hasOwnProperty'])(
    'rejects inherited profile name %s without losing valid overrides',
    (profileId) => {
      expect(parseGeneratorSelection(new URLSearchParams(`preset=${profileId}&hop=5`)))
        .toEqual({...DEFAULT_SELECTION, hopLimit: 5});
    },
  );

  it('rejects precision values that the Android channel editor does not expose', () => {
    expect(
      parseGeneratorSelection(new URLSearchParams('precision=20')),
    ).toEqual(DEFAULT_SELECTION);
  });

  it('creates a stable, shareable query string', () => {
    expect(
      createGeneratorSearchParams({
        profileId: 'LongFast',
        hopLimit: 4,
        positionPrecision: 18,
        additionalChannels: ['Bots', 'Test'],
      }).toString(),
    ).toBe('preset=LongFast&hop=4&precision=18&test=true&bots=true');
  });

  it('creates the community default query string', () => {
    expect(createGeneratorSearchParams(DEFAULT_SELECTION).toString()).toBe(
      'preset=NarrowSlow&hop=4&precision=14',
    );
  });

  it('keeps an explicit legacy LongFast query string', () => {
    expect(
      createGeneratorSearchParams({
        ...DEFAULT_SELECTION,
        profileId: 'LongFast',
      }).toString(),
    ).toBe('preset=LongFast&hop=4&precision=14');
  });

  it.each(['LongFast', 'NarrowSlow'] as const)(
    'preserves saved precision 15 for %s',
    (profileId) => {
      const selection = parseGeneratorSelection(
        new URLSearchParams(`preset=${profileId}&precision=15`),
      );

      expect(selection.positionPrecision).toBe(15);
      expect(createGeneratorSearchParams(selection).get('precision')).toBe('15');
    },
  );

  it('warns for 182 meters or more precise selections', () => {
    expect(hasPositionPrivacyWarning(16)).toBe(false);
    expect(hasPositionPrivacyWarning(17)).toBe(true);
    expect(hasPositionPrivacyWarning(32)).toBe(true);
  });
});
