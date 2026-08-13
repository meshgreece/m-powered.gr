import {describe, expect, it} from 'vitest';

import {PROFILES} from './config';
import {
  configToJson,
  createConfigJson,
  createConfigUrl,
  decodeConfigPayload,
} from './protobuf';

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

describe('Meshtastic configuration profiles', () => {
  it.each(Object.keys(PROFILES) as Array<keyof typeof PROFILES>)(
    'serializes %s with the pinned protobuf runtime',
    (profileId) => {
      expect(createConfigUrl(PROFILES[profileId])).toBe(
        CANONICAL_URLS[profileId],
      );
    },
  );

  it.each(Object.keys(PROFILES) as Array<keyof typeof PROFILES>)(
    'preserves the legacy %s configuration semantics',
    (profileId) => {
      const canonicalPayload = createConfigUrl(PROFILES[profileId]).split(
        '#',
      )[1];

      expect(configToJson(decodeConfigPayload(canonicalPayload))).toEqual(
        configToJson(decodeConfigPayload(LEGACY_PAYLOADS[profileId])),
      );
    },
  );

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
});
