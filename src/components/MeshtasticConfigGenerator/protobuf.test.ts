import {describe, expect, it} from 'vitest';
import {fromBinary, toJson} from '@bufbuild/protobuf';
import {base64Decode} from '@bufbuild/protobuf/wire';
import {AppOnly, Config} from '@meshtastic/protobufs';

import {
  DEFAULT_ADVANCED_SETTINGS,
  DEFAULT_EXPORT_SETTINGS,
  isAdvancedCustomized,
  PROFILES,
} from './config';
import {
  createChannelSet,
  createConfigJson,
  createConfigUrl,
} from './protobuf';
import {FIRMWARE_VERSIONS, HOP_LIMITS, POSITION_PRECISION_VALUES} from './types';
import type {AdvancedSettings, ExportSettings} from './types';

function decodeConfigPayload(payload: string) {
  return fromBinary(AppOnly.ChannelSetSchema, base64Decode(payload));
}

function configToJson(config: AppOnly.ChannelSet) {
  return toJson(AppOnly.ChannelSetSchema, config);
}

const LEGACY_PAYLOADS = {
  LongFast: 'ChESAQEaCExvbmdGYXN0KAEwARIPCAEQADgDQANIAWgByAYB',
  NarrowSlow: 'ChMSAQEaCk5hcnJvd1Nsb3coATABEhYYPiAIKAY4A0ADSAFoAXVKXFlEyAYB',
} as const;

const LEGACY_OPTIONS = {
  hopLimit: 3,
  positionPrecision: 0,
  additionalChannels: [],
} as const;

const FIRMWARE_27 = {...DEFAULT_EXPORT_SETTINGS, firmware: '2.7'} as const;
const FIRMWARE_28 = {...DEFAULT_EXPORT_SETTINGS, firmware: '2.8'} as const;

const DOWNLINK_OFF = {uplinkEnabled: true, downlinkEnabled: false};
const DOWNLINK_OFF_27 = {
  firmware: '2.7',
  advanced: {
    ...DEFAULT_ADVANCED_SETTINGS,
    primary: DOWNLINK_OFF,
    additional: {
      Test: {...DOWNLINK_OFF, isMuted: false},
      Bots: {...DOWNLINK_OFF, isMuted: false},
    },
  },
} as const;

// Captured before firmware 2.8 support, when downlink was off; with downlink off, 2.7 output must never change.
const FROZEN_27_URLS = {
  LongFast: {
    default: 'https://meshtastic.org/e/#ChMSAQEaCExvbmdGYXN0KAE6AggOEg0IATgDQARIAWgByAYB',
    full: 'https://meshtastic.org/e/#ChMSAQEaCExvbmdGYXN0KAE6AggPCgsSAQIaBFRlc3QoAQoLEgECGgRCb3RzKAESDQgBOANABUgBaAHIBgE',
  },
  NarrowSlow: {
    default: 'https://meshtastic.org/e/#ChUSAQEaCk5hcnJvd1Nsb3coAToCCA4SFhg-IAgoBjgDQARIAWgBdUpcWUTIBgE',
    full: 'https://meshtastic.org/e/#ChUSAQEaCk5hcnJvd1Nsb3coAToCCA8KCxIBAhoEVGVzdCgBCgsSAQIaBEJvdHMoARIWGD4gCCgGOANABUgBaAF1SlxZRMgGAQ',
  },
} as const;

const FULL_OPTIONS = {
  hopLimit: 5,
  positionPrecision: 15,
  additionalChannels: ['Test', 'Bots'],
} as const;

describe('firmware versions', () => {
  it.each(['LongFast', 'NarrowSlow'] as const)(
    'keeps the 2.7 %s payload byte-identical',
    (profileId) => {
      expect(
        createConfigUrl(PROFILES[profileId], undefined, DOWNLINK_OFF_27),
      ).toBe(FROZEN_27_URLS[profileId].default);
      expect(
        createConfigUrl(PROFILES[profileId], FULL_OPTIONS, DOWNLINK_OFF_27),
      ).toBe(FROZEN_27_URLS[profileId].full);
    },
  );

  it('exports native EU_N_868 / NARROW_SLOW for 2.8 NarrowSlow', () => {
    const decoded = decodeConfigPayload(
      createConfigUrl(PROFILES.NarrowSlow, undefined, FIRMWARE_28).split('#')[1],
    );

    expect(decoded.loraConfig).toMatchObject({
      region: Config.Config_LoRaConfig_RegionCode.EU_N_868,
      usePreset: true,
      modemPreset: Config.Config_LoRaConfig_ModemPreset.NARROW_SLOW,
      hopLimit: 4,
      txEnabled: true,
      sx126xRxBoostedGain: true,
      configOkToMqtt: true,
    });
    expect(decoded.settings[0]?.name).toBe('NarrowSlow');
    expect(Array.from(decoded.settings[0]?.psk ?? [])).toEqual([1]);
  });

  it('never exports custom radio fields for 2.8 NarrowSlow', () => {
    for (const hopLimit of HOP_LIMITS) {
      for (const positionPrecision of POSITION_PRECISION_VALUES) {
        const lora = decodeConfigPayload(
          createConfigUrl(
            PROFILES.NarrowSlow,
            {hopLimit, positionPrecision, additionalChannels: []},
            FIRMWARE_28,
          ).split('#')[1],
        ).loraConfig;

        expect(lora).toMatchObject({
          bandwidth: 0,
          spreadFactor: 0,
          codingRate: 0,
          overrideFrequency: 0,
          channelNum: 0,
        });
      }
    }
  });

  it('exports the same LongFast payload for both firmware versions', () => {
    for (const options of [undefined, FULL_OPTIONS]) {
      expect(createConfigUrl(PROFILES.LongFast, options, FIRMWARE_28)).toBe(
        createConfigUrl(PROFILES.LongFast, options, FIRMWARE_27),
      );
    }
  });

  it('defaults to firmware 2.8', () => {
    expect(createConfigUrl(PROFILES.NarrowSlow)).toBe(
      createConfigUrl(PROFILES.NarrowSlow, undefined, FIRMWARE_28),
    );
  });
});

function withAdvanced(
  update: Partial<AdvancedSettings>,
  firmware: ExportSettings['firmware'] = '2.8',
): ExportSettings {
  return {firmware, advanced: {...DEFAULT_ADVANCED_SETTINGS, ...update}};
}

function decodeWith(
  profileId: keyof typeof PROFILES,
  options: Parameters<typeof createConfigUrl>[1],
  exportSettings: ExportSettings,
) {
  return decodeConfigPayload(
    createConfigUrl(PROFILES[profileId], options, exportSettings).split('#')[1],
  );
}

const MUTED_TEST = {
  ...DEFAULT_ADVANCED_SETTINGS.additional,
  Test: {uplinkEnabled: true, downlinkEnabled: true, isMuted: true},
};

describe('advanced settings', () => {
  it.each(FIRMWARE_VERSIONS)(
    'applies OK to MQTT and Ignore MQTT for %s firmware',
    (firmware) => {
      const lora = decodeWith(
        'NarrowSlow',
        undefined,
        withAdvanced({configOkToMqtt: false, ignoreMqtt: true}, firmware),
      ).loraConfig;

      expect(lora?.configOkToMqtt).toBe(false);
      expect(lora?.ignoreMqtt).toBe(true);
    },
  );

  it('clears configOkToMqtt when disabled', () => {
    expect(
      decodeWith('NarrowSlow', undefined, withAdvanced({configOkToMqtt: false}))
        .loraConfig?.configOkToMqtt,
    ).toBe(false);
  });

  it('applies primary flags when position sharing is off', () => {
    expect(
      decodeWith(
        'NarrowSlow',
        {hopLimit: 4, positionPrecision: 0, additionalChannels: []},
        withAdvanced({primary: {uplinkEnabled: false, downlinkEnabled: true}}),
      ).settings[0],
    ).toMatchObject({uplinkEnabled: false, downlinkEnabled: true});
  });

  it('applies uplink and downlink per channel', () => {
    const decoded = decodeWith(
      'NarrowSlow',
      FULL_OPTIONS,
      withAdvanced({
        primary: {uplinkEnabled: false, downlinkEnabled: true},
        additional: {
          ...DEFAULT_ADVANCED_SETTINGS.additional,
          Test: {uplinkEnabled: false, downlinkEnabled: true, isMuted: false},
        },
      }),
    );

    expect(decoded.settings[0]).toMatchObject({
      uplinkEnabled: false,
      downlinkEnabled: true,
    });
    expect(decoded.settings[1]).toMatchObject({
      name: 'Test',
      uplinkEnabled: false,
      downlinkEnabled: true,
    });
    expect(decoded.settings[2]).toMatchObject({
      name: 'Bots',
      uplinkEnabled: true,
      downlinkEnabled: true,
    });
  });

  it('mutes only the selected additional channels', () => {
    const decoded = decodeWith(
      'NarrowSlow',
      FULL_OPTIONS,
      withAdvanced({additional: MUTED_TEST}),
    );

    expect(decoded.settings[1]?.moduleSettings?.isMuted).toBe(true);
    expect(decoded.settings[2]?.moduleSettings).toBeUndefined();
  });

  it('ignores advanced flags for channels that are not exported', () => {
    expect(
      createConfigUrl(
        PROFILES.NarrowSlow,
        undefined,
        withAdvanced({additional: MUTED_TEST}),
      ),
    ).toBe(createConfigUrl(PROFILES.NarrowSlow));
  });

  it.each(['LongFast', 'NarrowSlow'] as const)(
    'keeps default output for %s when advanced settings are default',
    (profileId) => {
      for (const options of [undefined, FULL_OPTIONS]) {
        expect(
          createConfigUrl(PROFILES[profileId], options, withAdvanced({}, '2.8')),
        ).toBe(createConfigUrl(PROFILES[profileId], options));
      }
    },
  );

  it('does not mutate profiles when applying export settings', () => {
    const before = structuredClone(PROFILES.NarrowSlow);
    createConfigUrl(
      PROFILES.NarrowSlow,
      FULL_OPTIONS,
      withAdvanced(
        {
          configOkToMqtt: false,
          ignoreMqtt: true,
          primary: {uplinkEnabled: false, downlinkEnabled: true},
          additional: MUTED_TEST,
        },
        '2.7',
      ),
    );

    expect(PROFILES.NarrowSlow).toEqual(before);
    expect(DEFAULT_ADVANCED_SETTINGS.additional.Test.isMuted).toBe(false);
  });
});

describe('isAdvancedCustomized', () => {
  it('is false for the defaults', () => {
    expect(isAdvancedCustomized(DEFAULT_ADVANCED_SETTINGS, ['Test', 'Bots'])).toBe(
      false,
    );
  });

  it('detects a changed MQTT flag', () => {
    expect(
      isAdvancedCustomized({...DEFAULT_ADVANCED_SETTINGS, ignoreMqtt: true}, []),
    ).toBe(true);
  });

  it('detects a changed primary channel flag', () => {
    expect(
      isAdvancedCustomized(
        {
          ...DEFAULT_ADVANCED_SETTINGS,
          primary: {uplinkEnabled: true, downlinkEnabled: false},
        },
        [],
      ),
    ).toBe(true);
  });

  it('detects a changed flag on an exported channel', () => {
    expect(
      isAdvancedCustomized(
        {...DEFAULT_ADVANCED_SETTINGS, additional: MUTED_TEST},
        ['Test'],
      ),
    ).toBe(true);
  });

  it('isAdvancedCustomized ignores unexported channels', () => {
    expect(
      isAdvancedCustomized(
        {...DEFAULT_ADVANCED_SETTINGS, additional: MUTED_TEST},
        [],
      ),
    ).toBe(false);
  });
});

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
    'preserves legacy %s radio and channel semantics',
    (profileId) => {
      const decoded = decodeConfigPayload(
        createConfigUrl(PROFILES[profileId], LEGACY_OPTIONS, FIRMWARE_27).split(
          '#',
        )[1],
      );
      const legacy = decodeConfigPayload(LEGACY_PAYLOADS[profileId]);
      expect(configToJson({...decoded, settings: []})).toEqual(
        configToJson({...legacy, settings: []}),
      );
      expect(decoded.settings[0].name).toBe(legacy.settings[0].name);
      expect(decoded.settings[0].psk).toEqual(legacy.settings[0].psk);
      expect(decoded.settings[0].uplinkEnabled).toBe(true);
      expect(decoded.settings[0].downlinkEnabled).toBe(true);
    },
  );

  it.each(Object.keys(PROFILES) as Array<keyof typeof PROFILES>)(
    'exports uplink and downlink on every channel for %s',
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
        expect(setting.downlinkEnabled).toBe(true);
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
        downlinkEnabled: true,
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
