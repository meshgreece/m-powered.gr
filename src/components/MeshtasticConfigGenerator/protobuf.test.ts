import {describe, expect, it} from 'vitest';

import {PROFILES} from './config';
import {
  configToJson,
  createChannelSet,
  createConfigJson,
  createConfigUrl,
  decodeConfigPayload,
} from './protobuf';
import {HOP_LIMITS, POSITION_PRECISION_VALUES} from './types';

const LEGACY_PAYLOADS = {
  LongFast: 'ChESAQEaCExvbmdGYXN0KAEwARIPCAEQADgDQANIAWgByAYB',
  NarrowSlow: 'ChMSAQEaCk5hcnJvd1Nsb3coATABEhYYPiAIKAY4A0ADSAFoAXVKXFlEyAYB',
} as const;

const CANONICAL_URLS = {
  LongFast:
    'https://meshtastic.org/e/#ChESAQEaCExvbmdGYXN0KAEwARINCAE4A0ADSAFoAcgGAQ',
  NarrowSlow:
    'https://meshtastic.org/e/#ChMSAQEaCk5hcnJvd1Nsb3coATABEhYYPiAIKAY4A0ADSAFoAXVKXFlEyAYB',
} as const;

const LEGACY_OPTIONS = {
  hopLimit: 3,
  positionPrecision: 0,
} as const;

describe('Meshtastic configuration profiles', () => {
  it.each(Object.keys(PROFILES) as Array<keyof typeof PROFILES>)(
    'can still serialize the canonical legacy %s URL',
    (profileId) => {
      expect(createConfigUrl(PROFILES[profileId], LEGACY_OPTIONS)).toBe(
        CANONICAL_URLS[profileId],
      );
    },
  );

  it.each(Object.keys(PROFILES) as Array<keyof typeof PROFILES>)(
    'preserves the legacy %s configuration semantics',
    (profileId) => {
      const canonicalPayload = createConfigUrl(
        PROFILES[profileId],
        LEGACY_OPTIONS,
      ).split('#')[1];

      expect(configToJson(decodeConfigPayload(canonicalPayload))).toEqual(
        configToJson(decodeConfigPayload(LEGACY_PAYLOADS[profileId])),
      );
    },
  );

  it('uses the community defaults when options are omitted', () => {
    const channelSet = createChannelSet(PROFILES.LongFast);

    expect(channelSet.loraConfig?.hopLimit).toBe(4);
    expect(channelSet.settings[0]?.moduleSettings?.positionPrecision).toBe(15);
  });

  it('renders canonical JSON with readable non-default enum names', () => {
    const json = createConfigJson(PROFILES.LongFast);
    const parsedJson = JSON.parse(json);

    expect(parsedJson).toMatchObject({
      loraConfig: {
        region: 'EU_868',
      },
    });
    expect(parsedJson.loraConfig).not.toHaveProperty('modemPreset');
    expect(json).not.toContain('Uint8Array');
  });

  it.each(HOP_LIMITS)(
    'applies hop limit %s without mutating the profile',
    (hopLimit) => {
      const channelSet = createChannelSet(PROFILES.LongFast, {
        hopLimit,
        positionPrecision: 0,
      });

      expect(channelSet.loraConfig?.hopLimit).toBe(hopLimit);
      expect(PROFILES.LongFast.channelSet.loraConfig?.hopLimit).toBe(3);
    },
  );

  it('supports every position precision option available in Android', () => {
    for (const positionPrecision of POSITION_PRECISION_VALUES) {
      const channelSet = createChannelSet(PROFILES.LongFast, {
        hopLimit: 4,
        positionPrecision,
      });

      expect(
        channelSet.settings[0]?.moduleSettings?.positionPrecision ?? 0,
      ).toBe(positionPrecision);
    }
  });

  it('serializes selected overrides into the generated URL', () => {
    const payload = createConfigUrl(PROFILES.NarrowSlow, {
      hopLimit: 5,
      positionPrecision: 17,
    }).split('#')[1];
    const decoded = decodeConfigPayload(payload);

    expect(decoded.loraConfig?.hopLimit).toBe(5);
    expect(decoded.settings[0]?.moduleSettings?.positionPrecision).toBe(17);
  });
});
