import {create} from '@bufbuild/protobuf';
import type {AppOnly} from '@meshtastic/protobufs';
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

export type ConfigurationProfile = {
  id: ProfileId;
  name: string;
  description: string;
  channelSet: NonNullable<ChannelSetInit>;
};
