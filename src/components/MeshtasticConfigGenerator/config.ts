import {Config} from '@meshtastic/protobufs';

import type {ConfigurationProfile, ProfileId} from './types';

export const DEFAULT_PROFILE: ProfileId = 'LongFast';

export const PROFILES: Record<ProfileId, ConfigurationProfile> = {
  LongFast: {
    id: 'LongFast',
    name: 'LongFast',
    description: 'Η προτεινόμενη προεπιλογή για να ξεκινήσεις.',
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
    description: 'Εφαρμόζει τις ρυθμίσεις NarrowSlow.',
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
