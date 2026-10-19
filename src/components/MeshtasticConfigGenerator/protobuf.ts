import {
  create,
  toBinary,
  toJsonString,
} from '@bufbuild/protobuf';
import {base64Encode} from '@bufbuild/protobuf/wire';
import {AppOnly} from '@meshtastic/protobufs';

import {
  ADDITIONAL_CHANNELS,
  DEFAULT_EXPORT_SETTINGS,
  DEFAULT_SELECTION,
} from './config';
import {ADDITIONAL_CHANNEL_IDS} from './types';
import type {
  ConfigurationProfile,
  ExportSettings,
  GeneratorOptions,
} from './types';

const CONFIG_URL_PREFIX = 'https://meshtastic.org/e/#';

export function createChannelSet(
  profile: ConfigurationProfile,
  options: GeneratorOptions = DEFAULT_SELECTION,
  exportSettings: ExportSettings = DEFAULT_EXPORT_SETTINGS,
) {
  const {advanced} = exportSettings;
  const profileSettings = profile.channelSet.settings?.map((setting, index) => {
    if (index !== 0) return setting;

    if (
      options.positionPrecision === 0 &&
      setting.moduleSettings === undefined
    ) {
      return {...setting, ...advanced.primary};
    }

    return {
      ...setting,
      ...advanced.primary,
      moduleSettings: {
        ...setting.moduleSettings,
        positionPrecision: options.positionPrecision,
      },
    };
  });
  const additionalSettings = ADDITIONAL_CHANNEL_IDS.filter((channelId) =>
    options.additionalChannels.includes(channelId),
  ).map((channelId) => {
    const {isMuted, ...flags} = advanced.additional[channelId];
    return {
      ...ADDITIONAL_CHANNELS[channelId],
      ...flags,
      ...(isMuted && {moduleSettings: {isMuted}}),
    };
  });

  return create(AppOnly.ChannelSetSchema, {
    ...profile.channelSet,
    settings: [...(profileSettings ?? []), ...additionalSettings],
    loraConfig: {
      ...(profile.firmwareLoraConfig?.[exportSettings.firmware] ??
        profile.channelSet.loraConfig),
      hopLimit: options.hopLimit,
      configOkToMqtt: advanced.configOkToMqtt,
      ignoreMqtt: advanced.ignoreMqtt,
    },
  });
}

export function createConfigUrl(
  profile: ConfigurationProfile,
  options?: GeneratorOptions,
  exportSettings?: ExportSettings,
): string {
  const bytes = toBinary(
    AppOnly.ChannelSetSchema,
    createChannelSet(profile, options, exportSettings),
  );
  return `${CONFIG_URL_PREFIX}${base64Encode(bytes, 'url')}`;
}

export function createConfigJson(
  profile: ConfigurationProfile,
  options?: GeneratorOptions,
  exportSettings?: ExportSettings,
): string {
  return toJsonString(
    AppOnly.ChannelSetSchema,
    createChannelSet(profile, options, exportSettings),
    {
      prettySpaces: 2,
    },
  );
}
