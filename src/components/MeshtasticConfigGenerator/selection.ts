import {
  DEFAULT_SELECTION,
  isHopLimit,
  isPositionPrecision,
  isProfileId,
} from './config';
import type {GeneratorSelection} from './types';

const QUERY_PARAMETERS = {
  profileId: 'preset',
  hopLimit: 'hop',
  positionPrecision: 'precision',
} as const;

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
  };
}

export function createGeneratorSearchParams(
  selection: GeneratorSelection,
): URLSearchParams {
  return new URLSearchParams({
    [QUERY_PARAMETERS.profileId]: selection.profileId,
    [QUERY_PARAMETERS.hopLimit]: String(selection.hopLimit),
    [QUERY_PARAMETERS.positionPrecision]: String(selection.positionPrecision),
  });
}
