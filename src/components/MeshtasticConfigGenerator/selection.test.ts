import {describe, expect, it} from 'vitest';

import {DEFAULT_SELECTION, hasPositionPrivacyWarning} from './config';
import {
  createGeneratorSearchParams,
  parseGeneratorSelection,
} from './selection';

describe('configuration generator URL selection', () => {
  it('uses the configured defaults when optional parameters are absent', () => {
    expect(
      parseGeneratorSelection(new URLSearchParams('preset=NarrowSlow')),
    ).toEqual({
      profileId: 'NarrowSlow',
      hopLimit: 4,
      positionPrecision: 15,
    });
  });

  it('parses all supported generator parameters', () => {
    expect(
      parseGeneratorSelection(
        new URLSearchParams('preset=NarrowSlow&hop=5&precision=32'),
      ),
    ).toEqual({
      profileId: 'NarrowSlow',
      hopLimit: 5,
      positionPrecision: 32,
    });
  });

  it('falls back safely for unsupported or malformed values', () => {
    expect(
      parseGeneratorSelection(
        new URLSearchParams('preset=invalid&hop=6&precision=17.5'),
      ),
    ).toEqual(DEFAULT_SELECTION);
  });

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
      }).toString(),
    ).toBe('preset=LongFast&hop=4&precision=18');
  });

  it('warns for 182 meters or more precise selections', () => {
    expect(hasPositionPrivacyWarning(16)).toBe(false);
    expect(hasPositionPrivacyWarning(17)).toBe(true);
    expect(hasPositionPrivacyWarning(32)).toBe(true);
  });
});
