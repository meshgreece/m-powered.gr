import {
  create,
  fromBinary,
  toBinary,
  toJson,
  toJsonString,
} from '@bufbuild/protobuf';
import {base64Decode, base64Encode} from '@bufbuild/protobuf/wire';
import {AppOnly} from '@meshtastic/protobufs';

import type {ConfigurationProfile} from './types';

const CONFIG_URL_PREFIX = 'https://meshtastic.org/e/#';

export function createChannelSet(profile: ConfigurationProfile) {
  return create(AppOnly.ChannelSetSchema, profile.channelSet);
}

export function createConfigUrl(profile: ConfigurationProfile): string {
  const bytes = toBinary(AppOnly.ChannelSetSchema, createChannelSet(profile));
  return `${CONFIG_URL_PREFIX}${base64Encode(bytes, 'url')}`;
}

export function createConfigJson(profile: ConfigurationProfile): string {
  return toJsonString(AppOnly.ChannelSetSchema, createChannelSet(profile), {
    prettySpaces: 2,
  });
}

export function decodeConfigPayload(payload: string) {
  return fromBinary(AppOnly.ChannelSetSchema, base64Decode(payload));
}

export function configToJson(config: AppOnly.ChannelSet) {
  return toJson(AppOnly.ChannelSetSchema, config);
}
