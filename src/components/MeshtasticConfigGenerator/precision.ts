import type {PositionPrecision} from './types';

const DOCUMENTED_PRECISION_LABELS: Record<
  Exclude<PositionPrecision, 0 | 32>,
  string
> = {
  10: '23,3 km',
  11: '11,7 km',
  12: '5,8 km',
  13: '2,9 km',
  14: '1,5 km',
  15: '729 m',
  16: '364 m',
  17: '182 m',
  18: '91 m',
  19: '45 m',
};

export function getPositionPrecisionLabel(
  positionPrecision: PositionPrecision,
) {
  if (positionPrecision === 0) return 'Χωρίς κοινοποίηση';
  if (positionPrecision === 32) return 'Πλήρης ακρίβεια';

  return `περίπου ${DOCUMENTED_PRECISION_LABELS[positionPrecision]}`;
}

export function getPositionPrecisionOptionLabel(
  positionPrecision: PositionPrecision,
) {
  return `${positionPrecision} — ${getPositionPrecisionLabel(
    positionPrecision,
  )}`;
}
