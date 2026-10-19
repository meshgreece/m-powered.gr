import {create} from '@bufbuild/protobuf';
import {AppOnly as AppOnlySchemas} from '@meshtastic/protobufs';

type ChannelSetInit = Parameters<
  typeof create<typeof AppOnlySchemas.ChannelSetSchema>
>[1];

export type ProfileId = 'LongFast' | 'NarrowSlow';

export const ADDITIONAL_CHANNEL_IDS = ['Test', 'Bots'] as const;

export type AdditionalChannelId = (typeof ADDITIONAL_CHANNEL_IDS)[number];

export const HOP_LIMITS = [3, 4, 5] as const;

export type HopLimit = (typeof HOP_LIMITS)[number];

export const POSITION_PRECISION_VALUES = [
  0, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 32,
] as const;

export type PositionPrecision = (typeof POSITION_PRECISION_VALUES)[number];

export type GeneratorOptions = {
  hopLimit: HopLimit;
  positionPrecision: PositionPrecision;
  additionalChannels: readonly AdditionalChannelId[];
};

export type GeneratorSelection = GeneratorOptions & {
  profileId: ProfileId;
};

export const FIRMWARE_VERSIONS = ['2.8', '2.7'] as const;

export type FirmwareVersion = (typeof FIRMWARE_VERSIONS)[number];

export type ChannelFlags = {
  uplinkEnabled: boolean;
  downlinkEnabled: boolean;
};

export type AdditionalChannelFlags = ChannelFlags & {isMuted: boolean};

export type AdvancedSettings = {
  configOkToMqtt: boolean;
  ignoreMqtt: boolean;
  primary: ChannelFlags;
  additional: Record<AdditionalChannelId, AdditionalChannelFlags>;
};

export type ExportSettings = {
  firmware: FirmwareVersion;
  advanced: AdvancedSettings;
};

type LoRaConfigInit = NonNullable<NonNullable<ChannelSetInit>['loraConfig']>;

export type ConfigurationProfile = {
  id: ProfileId;
  name: string;
  description: string;
  mqttRootTopic: string;
  channelSet: NonNullable<ChannelSetInit>;
  // Replaces channelSet.loraConfig for that firmware.
  firmwareLoraConfig?: Partial<Record<FirmwareVersion, LoRaConfigInit>>;
};
