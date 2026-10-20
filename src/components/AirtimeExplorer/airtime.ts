export const SPREADING_FACTORS = [7, 8, 9, 10, 11, 12] as const;
export const BANDWIDTHS_KHZ = [62.5, 125, 250] as const;

export interface LoraSetting {
  sf: number;
  bwKhz: number;
}

export const COMMUNITY_SETTING: LoraSetting = {sf: 8, bwKhz: 62.5};

// Coding rate 4/6, Meshtastic preamble, and a short text message on air.
const CODING_RATE_OFFSET = 2;
const PREAMBLE_SYMBOLS = 16;
const PAYLOAD_BYTES = 60;
// NarrowSlow link budget from meshtastic.org (22 dBm, 0 dBi).
const COMMUNITY_LINK_BUDGET_DB = 151.5;

export function airtimeMs({sf, bwKhz}: LoraSetting): number {
  const symbolMs = 2 ** sf / bwKhz;
  const lowDataRateOptimize = symbolMs > 16 ? 1 : 0;
  const payloadSymbols =
    8 +
    Math.max(
      Math.ceil((8 * PAYLOAD_BYTES - 4 * sf + 28 + 16) / (4 * (sf - 2 * lowDataRateOptimize))) *
        (CODING_RATE_OFFSET + 4),
      0,
    );
  return (PREAMBLE_SYMBOLS + 4.25 + payloadSymbols) * symbolMs;
}

export function dataRateBps({sf, bwKhz}: LoraSetting): number {
  return ((sf * bwKhz * 1000) / 2 ** sf) * (4 / (CODING_RATE_OFFSET + 4));
}

export function linkBudgetDb({sf, bwKhz}: LoraSetting): number {
  return COMMUNITY_LINK_BUDGET_DB + 2.5 * (sf - COMMUNITY_SETTING.sf) - 3 * Math.log2(bwKhz / COMMUNITY_SETTING.bwKhz);
}

export function isCommunitySetting({sf, bwKhz}: LoraSetting): boolean {
  return sf === COMMUNITY_SETTING.sf && bwKhz === COMMUNITY_SETTING.bwKhz;
}

export function changeCaption(previous: LoraSetting, next: LoraSetting): string {
  if (isCommunitySetting(next)) return 'SF 8 και 62,5 kHz: οι ρυθμίσεις του δικτύου μας.';
  return airtimeMs(next) > airtimeMs(previous)
    ? 'Μεγαλύτερο SF ή στενότερο BW: πιο μακριά, αλλά η συχνότητα μένει κατειλημμένη περισσότερο.'
    : 'Μικρότερο SF ή φαρδύτερο BW: πιο γρήγορα, αλλά με μικρότερη εμβέλεια.';
}

const numberFormat = new Intl.NumberFormat('el-GR', {maximumFractionDigits: 1, useGrouping: false});

export function formatNumber(value: number): string {
  return numberFormat.format(value);
}
