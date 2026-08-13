import {create} from '@bufbuild/protobuf';
import type {AppOnly} from '@meshtastic/protobufs';
import {AppOnly as AppOnlySchemas} from '@meshtastic/protobufs';

type ChannelSetInit = Parameters<
  typeof create<typeof AppOnlySchemas.ChannelSetSchema>
>[1];

export type ProfileId = 'LongFast' | 'NarrowSlow';

export type ConfigurationProfile = {
  id: ProfileId;
  name: string;
  description: string;
  channelSet: NonNullable<ChannelSetInit>;
};
