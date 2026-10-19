import {Config} from '@meshtastic/protobufs';

import type {
  AdditionalChannelId,
  AdvancedSettings,
  ConfigurationProfile,
  ExportSettings,
  FirmwareVersion,
  GeneratorSelection,
  HopLimit,
  PositionPrecision,
  ProfileId,
} from './types';
import {
  ADDITIONAL_CHANNEL_IDS,
  FIRMWARE_VERSIONS,
  HOP_LIMITS,
  POSITION_PRECISION_VALUES,
} from './types';

export const DEFAULT_PROFILE: ProfileId = 'NarrowSlow';
export const DEFAULT_HOP_LIMIT: HopLimit = 4;
export const DEFAULT_POSITION_PRECISION: PositionPrecision = 14;
export const POSITION_PRIVACY_WARNING_THRESHOLD = 17;
export const DEFAULT_FIRMWARE: FirmwareVersion = '2.8';

const DEFAULT_ADDITIONAL_FLAGS = {
  uplinkEnabled: true,
  downlinkEnabled: true,
  isMuted: false,
};

export const DEFAULT_ADVANCED_SETTINGS: AdvancedSettings = {
  configOkToMqtt: true,
  ignoreMqtt: false,
  primary: {uplinkEnabled: true, downlinkEnabled: true},
  additional: {Test: DEFAULT_ADDITIONAL_FLAGS, Bots: DEFAULT_ADDITIONAL_FLAGS},
};

export const DEFAULT_EXPORT_SETTINGS: ExportSettings = {
  firmware: DEFAULT_FIRMWARE,
  advanced: DEFAULT_ADVANCED_SETTINGS,
};

export function isAdvancedCustomized(
  advanced: AdvancedSettings,
  additionalChannels: readonly AdditionalChannelId[],
): boolean {
  const differs = (a: object, b: object) =>
    JSON.stringify(a) !== JSON.stringify(b);
  const {additional, ...rest} = advanced;
  const {additional: defaultAdditional, ...defaultRest} =
    DEFAULT_ADVANCED_SETTINGS;
  return (
    differs(rest, defaultRest) ||
    ADDITIONAL_CHANNEL_IDS.some(
      (channelId) =>
        additionalChannels.includes(channelId) &&
        differs(additional[channelId], defaultAdditional[channelId]),
    )
  );
}

export const DEFAULT_SELECTION: GeneratorSelection = {
  profileId: DEFAULT_PROFILE,
  hopLimit: DEFAULT_HOP_LIMIT,
  positionPrecision: DEFAULT_POSITION_PRECISION,
  additionalChannels: [],
};

export const ADDITIONAL_CHANNELS: Record<
  AdditionalChannelId,
  NonNullable<ConfigurationProfile['channelSet']['settings']>[number]
> = {
  Test: {
    psk: new Uint8Array([2]),
    name: 'Test',
  },
  Bots: {
    psk: new Uint8Array([2]),
    name: 'Bots',
  },
};

export const ADDITIONAL_CHANNEL_DESCRIPTIONS: Record<
  AdditionalChannelId,
  string
> = {
  Test: 'σύντομες, συνεννοημένες δοκιμές χωρίς να γεμίζει το κύριο κανάλι',
  Bots: 'αυτοματισμοί και bots της κοινότητας',
};

export const PROFILES: Record<ProfileId, ConfigurationProfile> = {
  LongFast: {
    id: 'LongFast',
    name: 'LongFast',
    description: 'Παλιό προφίλ LongFast, για συμβατότητα με αποθηκευμένες επιλογές.',
    mqttRootTopic: 'msh/EU_868/GR',
    channelSet: {
      settings: [
        {
          psk: new Uint8Array([1]),
          name: 'LongFast',
        },
      ],
      loraConfig: {
        usePreset: true,
        modemPreset: Config.Config_LoRaConfig_ModemPreset.LONG_FAST,
        region: Config.Config_LoRaConfig_RegionCode.EU_868,
        hopLimit: 3,
        txEnabled: true,
        sx126xRxBoostedGain: true,
      },
    },
  },
  NarrowSlow: {
    id: 'NarrowSlow',
    name: 'NarrowSlow',
    description: 'Το προφίλ EU_N_868 / NARROW_SLOW της κοινότητας, για νέους και υπάρχοντες κόμβους.',
    mqttRootTopic: 'msh/EU_N_868/GR',
    channelSet: {
      settings: [
        {
          psk: new Uint8Array([1]),
          name: 'NarrowSlow',
        },
      ],
      loraConfig: {
        bandwidth: 62,
        spreadFactor: 8,
        codingRate: 6,
        region: Config.Config_LoRaConfig_RegionCode.EU_868,
        hopLimit: 3,
        txEnabled: true,
        sx126xRxBoostedGain: true,
        overrideFrequency: 869.4420166015625,
      },
    },
    // 2.7 has no EU_N_868, so channelSet.loraConfig above is the 2.7 equivalent.
    firmwareLoraConfig: {
      '2.8': {
        usePreset: true,
        modemPreset: Config.Config_LoRaConfig_ModemPreset.NARROW_SLOW,
        region: Config.Config_LoRaConfig_RegionCode.EU_N_868,
        hopLimit: 3,
        txEnabled: true,
        sx126xRxBoostedGain: true,
      },
    },
  },
};

export function isFirmwareVersion(value: string): value is FirmwareVersion {
  return FIRMWARE_VERSIONS.some((firmware) => firmware === value);
}

export function isProfileId(value: string | null): value is ProfileId {
  return value !== null && Object.hasOwn(PROFILES, value);
}

export function isHopLimit(value: number): value is HopLimit {
  return HOP_LIMITS.some((hopLimit) => hopLimit === value);
}

export function isPositionPrecision(value: number): value is PositionPrecision {
  return POSITION_PRECISION_VALUES.some(
    (positionPrecision) => positionPrecision === value,
  );
}

export function hasPositionPrivacyWarning(
  positionPrecision: PositionPrecision,
) {
  return positionPrecision >= POSITION_PRIVACY_WARNING_THRESHOLD;
}
