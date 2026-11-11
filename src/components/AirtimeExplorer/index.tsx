import {useState} from 'react';
import type {CSSProperties} from 'react';
import clsx from 'clsx';
import {MetricTile, SegmentedControl, StepCaption, WidgetFrame, formatNumber} from '@site/src/components/teaching';

import {
  BANDWIDTHS_KHZ,
  COMMUNITY_SETTING,
  SPREADING_FACTORS,
  airtimeMs,
  changeCaption,
  dataRateBps,
  isCommunitySetting,
  linkBudgetDb,
} from './airtime';
import type {LoraSetting} from './airtime';
import styles from './styles.module.css';

const AIRTIME_SCALE_MS = 7000;
const BUDGET_MIN_DB = 140;
const BUDGET_MAX_DB = 162;
const AIRTIME_TICKS_S = Array.from({length: AIRTIME_SCALE_MS / 1000 + 1}, (_, s) => s);

const SF_OPTIONS = SPREADING_FACTORS.map((sf) => ({value: sf, label: String(sf)}));
const BW_OPTIONS = BANDWIDTHS_KHZ.map((bwKhz) => ({value: bwKhz, label: `${formatNumber(bwKhz)} kHz`}));

const fill = (fraction: number) => ({'--fill': fraction}) as CSSProperties;

export default function AirtimeExplorer() {
  const [setting, setSetting] = useState<LoraSetting>(COMMUNITY_SETTING);
  const [caption, setCaption] = useState(changeCaption(COMMUNITY_SETTING, COMMUNITY_SETTING));

  const update = (next: LoraSetting) => {
    if (next.sf === setting.sf && next.bwKhz === setting.bwKhz) return;
    setCaption(changeCaption(setting, next));
    setSetting(next);
  };

  const airtime = airtimeMs(setting);
  const budget = linkBudgetDb(setting);

  return (
    <WidgetFrame
      note="Για να επικοινωνήσουν, όλοι οι κόμβοι πρέπει να έχουν τις ίδιες ρυθμίσεις. Οι συνδυασμοί εδώ είναι παραδείγματα. Μην τους εφαρμόσεις στη συσκευή σου.">
      <div className={styles.settings}>
        <SegmentedControl
          legend="Spreading factor (SF)"
          options={SF_OPTIONS}
          value={setting.sf}
          onChange={(sf) => update({...setting, sf})}
        />
        <SegmentedControl
          legend="Bandwidth (BW)"
          options={BW_OPTIONS}
          value={setting.bwKhz}
          onChange={(bwKhz) => update({...setting, bwKhz})}
        />
        <div className={styles.fixedRow}>
          <p className={styles.fixed}>Coding rate 4/6</p>
          <button type="button" className={styles.communityButton} onClick={() => update(COMMUNITY_SETTING)}>
            Ρυθμίσεις NarrowSlow
          </button>
        </div>
      </div>

      <div className={styles.results}>
        <div className={styles.markerSlot}>
          {isCommunitySetting(setting) && (
            <p className={styles.marker}>
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                <circle cx="8" cy="8" r="7" className={styles.markerDisc} />
                <path
                  d="M4.5 8.3l2.2 2.2L11.5 5.5"
                  className={styles.markerTick}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              NarrowSlow
            </p>
          )}
        </div>

        <div className={styles.outputs}>
          <MetricTile label="Airtime" value={formatNumber(Math.round(airtime))} unit="ms">
            <div className={styles.meter} aria-hidden="true">
              <div className={styles.track}>
                <div className={clsx(styles.fill, styles.fillAirtime)} style={fill(airtime / AIRTIME_SCALE_MS)} />
              </div>
              <div className={styles.ticks}>
                {AIRTIME_TICKS_S.map((s) => (
                  <span key={s} style={{left: `${((s * 1000) / AIRTIME_SCALE_MS) * 100}%`}}>{`${s} s`}</span>
                ))}
              </div>
            </div>
          </MetricTile>
          <MetricTile label="Ρυθμός δεδομένων" value={formatNumber(Math.round(dataRateBps(setting)))} unit="bit/s" />
          <MetricTile label="Link budget" value={formatNumber(budget)} unit="dB">
            <div className={styles.meter} aria-hidden="true">
              <div className={styles.track}>
                <div
                  className={clsx(styles.fill, styles.fillBudget)}
                  style={fill((budget - BUDGET_MIN_DB) / (BUDGET_MAX_DB - BUDGET_MIN_DB))}
                />
              </div>
              <div className={styles.scaleEnds}>
                <span>{BUDGET_MIN_DB} dB</span>
                <span>{BUDGET_MAX_DB} dB</span>
              </div>
            </div>
          </MetricTile>
        </div>

        <StepCaption>{caption}</StepCaption>
      </div>
    </WidgetFrame>
  );
}
