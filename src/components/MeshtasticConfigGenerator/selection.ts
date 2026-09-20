import {
  DEFAULT_SELECTION,
  isHopLimit,
  isPositionPrecision,
  isProfileId,
} from './config';
import {ADDITIONAL_CHANNEL_IDS} from './types';
import type {AdditionalChannelId, GeneratorSelection} from './types';

const QUERY_PARAMETERS = {
  profileId: 'preset',
  hopLimit: 'hop',
  positionPrecision: 'precision',
} as const;

function getChannelQueryParameter(channelId: AdditionalChannelId): string {
  return channelId.toLowerCase();
}

function parseInteger(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value)) return null;
  return Number(value);
}

export function parseGeneratorSelection(
  params: URLSearchParams,
): GeneratorSelection {
  const profileId = params.get(QUERY_PARAMETERS.profileId);
  const hopLimit = parseInteger(params.get(QUERY_PARAMETERS.hopLimit));
  const positionPrecision = parseInteger(
    params.get(QUERY_PARAMETERS.positionPrecision),
  );

  return {
    profileId: isProfileId(profileId) ? profileId : DEFAULT_SELECTION.profileId,
    hopLimit:
      hopLimit !== null && isHopLimit(hopLimit)
        ? hopLimit
        : DEFAULT_SELECTION.hopLimit,
    positionPrecision:
      positionPrecision !== null && isPositionPrecision(positionPrecision)
        ? positionPrecision
        : DEFAULT_SELECTION.positionPrecision,
    additionalChannels: ADDITIONAL_CHANNEL_IDS.filter(
      (channelId) =>
        params.get(getChannelQueryParameter(channelId)) === 'true',
    ),
  };
}

export function createGeneratorSearchParams(
  selection: GeneratorSelection,
): URLSearchParams {
  const params = new URLSearchParams({
    [QUERY_PARAMETERS.profileId]: selection.profileId,
    [QUERY_PARAMETERS.hopLimit]: String(selection.hopLimit),
    [QUERY_PARAMETERS.positionPrecision]: String(selection.positionPrecision),
  });

  for (const channelId of ADDITIONAL_CHANNEL_IDS) {
    if (selection.additionalChannels.includes(channelId)) {
      params.set(getChannelQueryParameter(channelId), 'true');
    }
  }

  return params;
}
