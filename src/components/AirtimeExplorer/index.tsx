import {useId, useState} from 'react';
import type {CSSProperties} from 'react';
import clsx from 'clsx';

import {
  BANDWIDTHS_KHZ,
  COMMUNITY_SETTING,
  SPREADING_FACTORS,
  airtimeMs,
  changeCaption,
  dataRateBps,
  formatNumber,
  isCommunitySetting,
  linkBudgetDb,
} from './airtime';
import type {LoraSetting} from './airtime';
import styles from './styles.module.css';

const AIRTIME_SCALE_MS = 7000;
const BUDGET_MIN_DB = 140;
const BUDGET_MAX_DB = 162;
const AIRTIME_TICKS_S = Array.from({length: AIRTIME_SCALE_MS / 1000 + 1}, (_, s) => s);

const fill = (fraction: number) => ({'--fill': fraction}) as CSSProperties;

export default function AirtimeExplorer() {
  const baseId = useId();
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
    <figure className={styles.root}>
      <div className={styles.settings}>
        <fieldset className={styles.group}>
          <legend className={styles.legend}>Spreading factor (SF)</legend>
          <div className={styles.segments}>
            {SPREADING_FACTORS.map((sf) => (
              <label key={sf} className={styles.segment}>
                <input
                  type="radio"
                  name={`${baseId}-sf`}
                  className={styles.radio}
                  checked={setting.sf === sf}
                  onChange={() => update({...setting, sf})}
                />
                <span className={clsx(styles.segmentText, styles.numeric)}>{sf}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className={styles.group}>
          <legend className={styles.legend}>Bandwidth (BW)</legend>
          <div className={styles.segments}>
            {BANDWIDTHS_KHZ.map((bwKhz) => (
              <label key={bwKhz} className={styles.segment}>
                <input
                  type="radio"
                  name={`${baseId}-bw`}
                  className={styles.radio}
                  checked={setting.bwKhz === bwKhz}
                  onChange={() => update({...setting, bwKhz})}
                />
                <span className={styles.segmentText}>{formatNumber(bwKhz)} kHz</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className={styles.fixedRow}>
          <p className={styles.fixed}>Coding rate 4/6</p>
          <button
            type="button"
            className={clsx('button button--secondary button--sm', styles.communityButton)}
            onClick={() => update(COMMUNITY_SETTING)}>
            Ρυθμίσεις του δικτύου μας
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
              Το δίκτυό μας
            </p>
          )}
        </div>

        <dl className={styles.outputs}>
          <div className={styles.output}>
            <dt className={styles.label}>Χρόνος στον αέρα</dt>
            <dd className={styles.value}>
              {formatNumber(Math.round(airtime))} <span className={styles.unit}>ms</span>
            </dd>
            <dd className={styles.meter} aria-hidden="true">
              <div className={styles.track}>
                <div className={clsx(styles.fill, styles.fillAirtime)} style={fill(airtime / AIRTIME_SCALE_MS)} />
              </div>
              <div className={styles.ticks}>
                {AIRTIME_TICKS_S.map((s) => (
                  <span key={s} style={{left: `${((s * 1000) / AIRTIME_SCALE_MS) * 100}%`}}>{`${s} s`}</span>
                ))}
              </div>
            </dd>
          </div>
          <div className={styles.output}>
            <dt className={styles.label}>Ρυθμός δεδομένων</dt>
            <dd className={styles.value}>
              {formatNumber(Math.round(dataRateBps(setting)))} <span className={styles.unit}>bit/s</span>
            </dd>
          </div>
          <div className={styles.output}>
            <dt className={styles.label}>Link budget</dt>
            <dd className={styles.value}>
              {formatNumber(budget)} <span className={styles.unit}>dB</span>
            </dd>
            <dd className={styles.meter} aria-hidden="true">
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
            </dd>
          </div>
        </dl>

        <p className={styles.caption} aria-live="polite">
          {caption}
        </p>
      </div>

      <figcaption className={styles.summary}>
        Για να επικοινωνήσουν, όλοι οι κόμβοι πρέπει να έχουν τις ίδιες ρυθμίσεις. Οι συνδυασμοί εδώ είναι για κατανόηση·
        μην τους αλλάξεις στη συσκευή σου.
      </figcaption>
    </figure>
  );
}
