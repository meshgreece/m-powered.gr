import {
  create,
  fromBinary,
  toBinary,
  toJson,
  toJsonString,
} from '@bufbuild/protobuf';
import {base64Decode, base64Encode} from '@bufbuild/protobuf/wire';
import {AppOnly} from '@meshtastic/protobufs';

import {
  ADDITIONAL_CHANNELS,
  DEFAULT_HOP_LIMIT,
  DEFAULT_POSITION_PRECISION,
} from './config';
import {ADDITIONAL_CHANNEL_IDS} from './types';
import type {ConfigurationProfile, GeneratorOptions} from './types';

const CONFIG_URL_PREFIX = 'https://meshtastic.org/e/#';

const DEFAULT_OPTIONS: GeneratorOptions = {
  hopLimit: DEFAULT_HOP_LIMIT,
  positionPrecision: DEFAULT_POSITION_PRECISION,
  additionalChannels: [],
};

export function createChannelSet(
  profile: ConfigurationProfile,
  options: GeneratorOptions = DEFAULT_OPTIONS,
) {
  const profileSettings = profile.channelSet.settings?.map((setting, index) => {
    if (index !== 0) return setting;

    if (
      options.positionPrecision === 0 &&
      setting.moduleSettings === undefined
    ) {
      return setting;
    }

    return {
      ...setting,
      moduleSettings: {
        ...setting.moduleSettings,
        positionPrecision: options.positionPrecision,
      },
    };
  });
  const additionalSettings = ADDITIONAL_CHANNEL_IDS.filter((channelId) =>
    options.additionalChannels.includes(channelId),
  ).map((channelId) => ({...ADDITIONAL_CHANNELS[channelId]}));

  return create(AppOnly.ChannelSetSchema, {
    ...profile.channelSet,
    settings: [...(profileSettings ?? []), ...additionalSettings],
    loraConfig: {
      ...profile.channelSet.loraConfig,
      hopLimit: options.hopLimit,
    },
  });
}

export function createConfigUrl(
  profile: ConfigurationProfile,
  options?: GeneratorOptions,
): string {
  const bytes = toBinary(
    AppOnly.ChannelSetSchema,
    createChannelSet(profile, options),
  );
  return `${CONFIG_URL_PREFIX}${base64Encode(bytes, 'url')}`;
}

export function createConfigJson(
  profile: ConfigurationProfile,
  options?: GeneratorOptions,
): string {
  return toJsonString(
    AppOnly.ChannelSetSchema,
    createChannelSet(profile, options),
    {
      prettySpaces: 2,
    },
  );
}

export function decodeConfigPayload(payload: string) {
  return fromBinary(AppOnly.ChannelSetSchema, base64Decode(payload));
}

export function configToJson(config: AppOnly.ChannelSet) {
  return toJson(AppOnly.ChannelSetSchema, config);
}
