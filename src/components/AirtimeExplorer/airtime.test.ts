import {describe, expect, it} from 'vitest';

import {
  airtimeMs,
  changeCaption,
  dataRateBps,
  formatNumber,
  linkBudgetDb,
} from './airtime';

// [bwKhz, sf, airtime ms, data rate bit/s, link budget dB] from planning/claude-design/04-airtime.md
const TABLE: [number, number, number, number, number][] = [
  [62.5, 7, 279, 2279, 149], [62.5, 8, 509, 1302, 151.5], [62.5, 9, 920, 732, 154],
  [62.5, 10, 2036, 407, 156.5], [62.5, 11, 3678, 224, 159], [62.5, 12, 6570, 122, 161.5],
  [125, 7, 140, 4557, 146], [125, 8, 254, 2604, 148.5], [125, 9, 460, 1465, 151],
  [125, 10, 870, 814, 153.5], [125, 11, 1839, 448, 156], [125, 12, 3285, 244, 158.5],
  [250, 7, 70, 9115, 143], [250, 8, 127, 5208, 145.5], [250, 9, 230, 2930, 148],
  [250, 10, 435, 1628, 150.5], [250, 11, 772, 895, 153], [250, 12, 1642, 488, 155.5],
];

describe('LoRa airtime model', () => {
  it.each(TABLE)('BW %s kHz, SF %s matches the brief', (bwKhz, sf, airtime, rate, budget) => {
    const setting = {sf, bwKhz};
    expect(Math.round(airtimeMs(setting))).toBe(airtime);
    expect(Math.round(dataRateBps(setting))).toBe(rate);
    expect(linkBudgetDb(setting)).toBe(budget);
  });

  it('matches the official NarrowSlow and LongFast link budgets', () => {
    expect(linkBudgetDb({sf: 8, bwKhz: 62.5})).toBe(151.5);
    expect(linkBudgetDb({sf: 11, bwKhz: 250})).toBe(153);
  });

  it('describes the direction of a change', () => {
    expect(changeCaption({sf: 9, bwKhz: 62.5}, {sf: 10, bwKhz: 62.5})).toBe(
      'Μεγαλύτερο SF ή στενότερο BW: πιο μακριά, αλλά η συχνότητα μένει κατειλημμένη περισσότερο.',
    );
    expect(changeCaption({sf: 10, bwKhz: 62.5}, {sf: 10, bwKhz: 250})).toBe(
      'Μικρότερο SF ή φαρδύτερο BW: πιο γρήγορα, αλλά με μικρότερη εμβέλεια.',
    );
    expect(changeCaption({sf: 9, bwKhz: 62.5}, {sf: 8, bwKhz: 62.5})).toBe(
      'SF 8 και 62,5 kHz: οι ρυθμίσεις του δικτύου μας.',
    );
  });

  it('formats numbers with a Greek decimal comma and no grouping', () => {
    expect(formatNumber(151.5)).toBe('151,5');
    expect(formatNumber(62.5)).toBe('62,5');
    expect(formatNumber(2279)).toBe('2279');
  });
});
