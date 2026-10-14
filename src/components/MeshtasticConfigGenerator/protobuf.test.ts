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

const LEGACY_OPTIONS = {
  hopLimit: 3,
  positionPrecision: 0,
  additionalChannels: [],
} as const;

describe('Meshtastic configuration profiles', () => {
  it.each(Object.keys(PROFILES) as Array<keyof typeof PROFILES>)(
    'still decodes the frozen legacy %s payload',
    (profileId) => {
      const decoded = decodeConfigPayload(LEGACY_PAYLOADS[profileId]);
      expect(decoded.settings[0]).toMatchObject({
        name: profileId,
        uplinkEnabled: true,
        downlinkEnabled: true,
      });
      expect(Array.from(decoded.settings[0].psk)).toEqual([1]);
      expect(decoded.loraConfig?.hopLimit).toBe(3);
    },
  );

  it.each(Object.keys(PROFILES) as Array<keyof typeof PROFILES>)(
    'preserves legacy %s radio and channel semantics while disabling downlink',
    (profileId) => {
      const decoded = decodeConfigPayload(
        createConfigUrl(PROFILES[profileId], LEGACY_OPTIONS).split('#')[1],
      );
      const legacy = decodeConfigPayload(LEGACY_PAYLOADS[profileId]);
      expect(configToJson({...decoded, settings: []})).toEqual(
        configToJson({...legacy, settings: []}),
      );
      expect(decoded.settings[0].name).toBe(legacy.settings[0].name);
      expect(decoded.settings[0].psk).toEqual(legacy.settings[0].psk);
      expect(decoded.settings[0].uplinkEnabled).toBe(true);
      expect(decoded.settings[0].downlinkEnabled).toBe(false);
    },
  );

  it.each(Object.keys(PROFILES) as Array<keyof typeof PROFILES>)(
    'exports uplink-only primary and optional channels for %s',
    (profileId) => {
      const decoded = decodeConfigPayload(
        createConfigUrl(PROFILES[profileId], {
          hopLimit: 4,
          positionPrecision: 15,
          additionalChannels: ['Test', 'Bots'],
        }).split('#')[1],
      );
      expect(decoded.settings.map((setting) => setting.name)).toEqual([
        profileId,
        'Test',
        'Bots',
      ]);
      for (const setting of decoded.settings) {
        expect(setting.uplinkEnabled).toBe(true);
        expect(setting.downlinkEnabled).toBe(false);
      }
    },
  );

  it.each(['LongFast', 'NarrowSlow'] as const)(
    'uses the community defaults for %s when options are omitted',
    (profileId) => {
      const channelSet = createChannelSet(PROFILES[profileId]);

      expect(channelSet.loraConfig?.hopLimit).toBe(4);
      expect(channelSet.settings[0]?.moduleSettings?.positionPrecision).toBe(14);
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

  it.each(HOP_LIMITS)(
    'applies hop limit %s without mutating the profile',
    (hopLimit) => {
      const channelSet = createChannelSet(PROFILES.LongFast, {
        hopLimit,
        positionPrecision: 0,
        additionalChannels: [],
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
        additionalChannels: [],
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
      additionalChannels: [],
    }).split('#')[1];
    const decoded = decodeConfigPayload(payload);

    expect(decoded.loraConfig?.hopLimit).toBe(5);
    expect(decoded.settings[0]?.moduleSettings?.positionPrecision).toBe(17);
  });

  it.each(['Test', 'Bots'] as const)(
    'appends the selected %s channel after the primary channel',
    (additionalChannel) => {
      const channelSet = createChannelSet(PROFILES.LongFast, {
        hopLimit: 4,
        positionPrecision: 15,
        additionalChannels: [additionalChannel],
      });

      expect(channelSet.settings.map((setting) => setting.name)).toEqual([
        'LongFast',
        additionalChannel,
      ]);
      expect(Array.from(channelSet.settings[1]?.psk ?? [])).toEqual([2]);
      expect(channelSet.settings[1]).toMatchObject({
        uplinkEnabled: true,
        downlinkEnabled: false,
      });
    },
  );

  it('serializes both additional channels in deterministic order', () => {
    const payload = createConfigUrl(PROFILES.NarrowSlow, {
      hopLimit: 4,
      positionPrecision: 15,
      additionalChannels: ['Bots', 'Test'],
    }).split('#')[1];
    const decoded = decodeConfigPayload(payload);

    expect(decoded.settings.map((setting) => setting.name)).toEqual([
      'NarrowSlow',
      'Test',
      'Bots',
    ]);
    expect(decoded.settings[0]?.moduleSettings?.positionPrecision).toBe(15);
    expect(decoded.settings[1]?.moduleSettings).toBeUndefined();
    expect(decoded.settings[2]?.moduleSettings).toBeUndefined();
  });
});
