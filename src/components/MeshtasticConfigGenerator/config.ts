import {Config} from '@meshtastic/protobufs';

import type {
  AdditionalChannelId,
  ConfigurationProfile,
  GeneratorSelection,
  HopLimit,
  PositionPrecision,
  ProfileId,
} from './types';
import {HOP_LIMITS, POSITION_PRECISION_VALUES} from './types';

export const DEFAULT_PROFILE: ProfileId = 'LongFast';
export const DEFAULT_HOP_LIMIT: HopLimit = 4;
export const DEFAULT_POSITION_PRECISION: PositionPrecision = 15;
export const POSITION_PRIVACY_WARNING_THRESHOLD = 17;

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
    uplinkEnabled: true,
    downlinkEnabled: true,
  },
  Bots: {
    psk: new Uint8Array([2]),
    name: 'Bots',
    uplinkEnabled: true,
    downlinkEnabled: true,
  },
};

export const ADDITIONAL_CHANNEL_DESCRIPTIONS: Record<
  AdditionalChannelId,
  string
> = {
  Test: 'δοκιμές εμβέλειας και γενικό spam, μακριά από το κύριο κανάλι',
  Bots: 'αυτοματισμοί και bots της κοινότητας',
};

export const PROFILES: Record<ProfileId, ConfigurationProfile> = {
  LongFast: {
    id: 'LongFast',
    name: 'LongFast',
    description: 'Η προεπιλογή για όλο το ελληνικό mesh.',
    channelSet: {
      settings: [
        {
          psk: new Uint8Array([1]),
          name: 'LongFast',
          uplinkEnabled: true,
          downlinkEnabled: true,
        },
      ],
      loraConfig: {
        usePreset: true,
        modemPreset: Config.Config_LoRaConfig_ModemPreset.LONG_FAST,
        region: Config.Config_LoRaConfig_RegionCode.EU_868,
        hopLimit: 3,
        txEnabled: true,
        sx126xRxBoostedGain: true,
        configOkToMqtt: true,
      },
    },
  },
  NarrowSlow: {
    id: 'NarrowSlow',
    name: 'NarrowSlow',
    description: 'Το τρέχον (custom) preset για Αττική, Βοιωτία και Εύβοια.',
    channelSet: {
      settings: [
        {
          psk: new Uint8Array([1]),
          name: 'NarrowSlow',
          uplinkEnabled: true,
          downlinkEnabled: true,
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
        configOkToMqtt: true,
      },
    },
  },
};

export function isProfileId(value: string | null): value is ProfileId {
  return value !== null && value in PROFILES;
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
