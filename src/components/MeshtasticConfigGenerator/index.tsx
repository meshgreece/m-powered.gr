import {useEffect, useMemo, useState} from 'react';
import Link from '@docusaurus/Link';
import ExecutionEnvironment from '@docusaurus/ExecutionEnvironment';
import QRCode from 'react-qr-code';

import {
  ADDITIONAL_CHANNEL_DESCRIPTIONS,
  DEFAULT_SELECTION,
  hasPositionPrivacyWarning,
  isHopLimit,
  isPositionPrecision,
  PROFILES,
} from './config';
import {
  getPositionPrecisionLabel,
  getPositionPrecisionOptionLabel,
} from './precision';
import {createConfigJson, createConfigUrl} from './protobuf';
import {
  createGeneratorSearchParams,
  parseGeneratorSelection,
} from './selection';
import styles from './styles.module.css';
import {
  ADDITIONAL_CHANNEL_IDS,
  HOP_LIMITS,
  POSITION_PRECISION_VALUES,
} from './types';
import type {AdditionalChannelId, GeneratorSelection, ProfileId} from './types';

const COVERAGE_MAP_URL = 'https://map.m-powered.gr/';

function SelectChevron() {
  return (
    <svg
      aria-hidden="true"
      className={styles.selectChevron}
      focusable="false"
      viewBox="0 0 16 16"
    >
      <path d="m3.5 6 4.5 4.5L12.5 6" />
    </svg>
  );
}

export default function MeshtasticConfigGenerator() {
  const [selection, setSelection] =
    useState<GeneratorSelection>(DEFAULT_SELECTION);
  const [isInitialized, setIsInitialized] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'success' | 'error'>(
    'idle',
  );

  useEffect(() => {
    if (!ExecutionEnvironment.canUseDOM) return;

    setSelection(
      parseGeneratorSelection(new URLSearchParams(window.location.search)),
    );
    setIsInitialized(true);
  }, []);

  useEffect(() => {
    if (!ExecutionEnvironment.canUseDOM || !isInitialized) return;

    const params = createGeneratorSearchParams(selection);
    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}?${params.toString()}${window.location.hash}`,
    );
  }, [isInitialized, selection]);

  const profile = PROFILES[selection.profileId];
  const options = useMemo(
    () => ({
      hopLimit: selection.hopLimit,
      positionPrecision: selection.positionPrecision,
      additionalChannels: selection.additionalChannels,
    }),
    [
      selection.additionalChannels,
      selection.hopLimit,
      selection.positionPrecision,
    ],
  );
  const configUrl = useMemo(
    () => createConfigUrl(profile, options),
    [options, profile],
  );
  const configJson = useMemo(
    () => createConfigJson(profile, options),
    [options, profile],
  );
  const shareableUrl = useMemo(() => {
    if (!ExecutionEnvironment.canUseDOM) return '';
    const params = createGeneratorSearchParams(selection);
    return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
  }, [selection]);
  const showPrivacyWarning = hasPositionPrivacyWarning(
    selection.positionPrecision,
  );
  const precisionLabel = getPositionPrecisionLabel(selection.positionPrecision);
  const positionSummary =
    selection.positionPrecision === 0
      ? 'χωρίς κοινοποίηση θέσης'
      : selection.positionPrecision === 32
        ? 'θέση με πλήρη ακρίβεια'
        : `θέση ${precisionLabel}`;
  const selectionSummary = [
    `hop limit ${selection.hopLimit}`,
    positionSummary,
    ...(selection.additionalChannels.length > 0
      ? [selection.additionalChannels.join(' + ')]
      : []),
  ].join(' · ');

  function updateSelection(update: Partial<GeneratorSelection>) {
    setSelection((current) => ({...current, ...update}));
    setCopyStatus('idle');
  }

  function toggleAdditionalChannel(
    channelId: AdditionalChannelId,
    checked: boolean,
  ) {
    setSelection((current) => ({
      ...current,
      additionalChannels: ADDITIONAL_CHANNEL_IDS.filter((candidate) =>
        candidate === channelId
          ? checked
          : current.additionalChannels.includes(candidate),
      ),
    }));
    setCopyStatus('idle');
  }

  async function copyConfigUrl() {
    try {
      await navigator.clipboard.writeText(configUrl);
      setCopyStatus('success');
    } catch {
      setCopyStatus('error');
    }
  }

  return (
    <section
      aria-label="Γεννήτρια ρυθμίσεων Meshtastic"
      className={styles.generator}
    >
      <div className={styles.layout}>
        <div className={styles.form}>
          <div className={styles.row}>
            <div className={styles.rowHeader}>
              <label className={styles.label} htmlFor="configuration-profile">
                Προφίλ ρυθμίσεων
              </label>
              <Link className={styles.rowLink} to={COVERAGE_MAP_URL}>
                Χάρτης κάλυψης →
              </Link>
            </div>
            <div className={styles.selectWrapper}>
              <select
                id="configuration-profile"
                className={styles.select}
                value={selection.profileId}
                onChange={(event) =>
                  updateSelection({
                    profileId: event.target.value as ProfileId,
                  })
                }
              >
                {Object.values(PROFILES).map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
              <SelectChevron />
            </div>
            <p className={styles.hint}>{profile.description}</p>
            {selection.profileId === 'NarrowSlow' && (
              <p className={styles.hint}>
                <Link to="/docs/eu-n-868-narrow-slow">
                  Διάβασε τον οδηγό μετάβασης σε NarrowSlow.
                </Link>
              </p>
            )}
          </div>

          <div className={`${styles.row} ${styles.rowCompact}`}>
            <label className={styles.label} htmlFor="configuration-hop-limit">
              Hop limit
            </label>
            <div className={`${styles.selectWrapper} ${styles.selectNarrow}`}>
              <select
                aria-describedby="configuration-hop-hint"
                id="configuration-hop-limit"
                className={styles.select}
                value={selection.hopLimit}
                onChange={(event) => {
                  const hopLimit = Number(event.target.value);
                  if (isHopLimit(hopLimit)) updateSelection({hopLimit});
                }}
              >
                {HOP_LIMITS.map((hopLimit) => (
                  <option key={hopLimit} value={hopLimit}>
                    {hopLimit}
                  </option>
                ))}
              </select>
              <SelectChevron />
            </div>
            <p className={styles.hint} id="configuration-hop-hint">
              {selection.hopLimit === 3
                ? 'Η προεπιλογή του Meshtastic.'
                : selection.hopLimit === 4
                  ? 'Μεγαλύτερη κάλυψη, με περισσότερες αναμεταδόσεις.'
                  : 'Μόνο όπου χρειάζεται· αυξάνει τον φόρτο του mesh.'}
            </p>
          </div>

          <div className={styles.row}>
            <label
              className={styles.label}
              htmlFor="configuration-position-precision"
            >
              Ακρίβεια θέσης
            </label>
            <div className={styles.selectWrapper}>
              <select
                aria-describedby={`configuration-position-recommendations${
                  showPrivacyWarning ? ' configuration-privacy-warning' : ''
                }`}
                id="configuration-position-precision"
                className={styles.select}
                value={selection.positionPrecision}
                onChange={(event) => {
                  const positionPrecision = Number(event.target.value);
                  if (isPositionPrecision(positionPrecision)) {
                    updateSelection({positionPrecision});
                  }
                }}
              >
                {POSITION_PRECISION_VALUES.map((positionPrecision) => (
                  <option key={positionPrecision} value={positionPrecision}>
                    {getPositionPrecisionOptionLabel(positionPrecision)}
                  </option>
                ))}
              </select>
              <SelectChevron />
            </div>
            <p
              className={styles.hint}
              id="configuration-position-recommendations"
            >
              Πρόταση: <strong>15</strong> (≈729 m) για προσωπικό ή φορητό
              κόμβο, <strong>16</strong> (≈364 m) για σταθερό.
            </p>
            {showPrivacyWarning && (
              <div
                aria-live="polite"
                className={styles.privacyWarning}
                id="configuration-privacy-warning"
                role="status"
              >
                <strong>
                  {selection.positionPrecision === 32
                    ? 'Πλήρης κοινοποίηση θέσης'
                    : 'Προσοχή στην ιδιωτικότητα'}
                </strong>
                <span>
                  {selection.positionPrecision === 32
                    ? ' Οι πραγματικές συντεταγμένες σου θα μεταδίδονται σε κανάλι με δημόσια γνωστό κλειδί.'
                    : ` Η ακρίβεια ${precisionLabel} περιορίζει τη θέση σου σε μια μικρή περιοχή. Το κανάλι χρησιμοποιεί δημόσια γνωστό κλειδί.`}
                </span>
              </div>
            )}
          </div>

          <div className={`${styles.row} ${styles.rowOptional}`}>
            <p className={styles.eyebrow}>Προαιρετικά</p>
            <fieldset className={styles.channels}>
              <legend className={styles.label}>Πρόσθετα κανάλια</legend>
              <div className={styles.channelOptions}>
                {ADDITIONAL_CHANNEL_IDS.map((channelId) => (
                  <label className={styles.channelOption} key={channelId}>
                    <input
                      checked={selection.additionalChannels.includes(channelId)}
                      className={styles.checkbox}
                      onChange={(event) =>
                        toggleAdditionalChannel(channelId, event.target.checked)
                      }
                      type="checkbox"
                    />
                    <span className={styles.channelText}>
                      <span className={styles.channelName}>{channelId}</span>
                      <span className={styles.channelDescription}>
                        {' — '}
                        {ADDITIONAL_CHANNEL_DESCRIPTIONS[channelId]}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        </div>

        <aside className={styles.result}>
          <div className={styles.resultHeader}>
            <span className={styles.eyebrow}>Σύνδεσμος ρυθμίσεων</span>
            <span className={styles.resultProfile}>{profile.name}</span>
          </div>

          <div className={styles.qrPanel} key={configUrl}>
            <QRCode
              aria-label={`QR code για το προφίλ ${profile.name}, hop limit ${selection.hopLimit}, ακρίβεια θέσης ${precisionLabel}${
                selection.additionalChannels.length > 0
                  ? `, πρόσθετα κανάλια ${selection.additionalChannels.join(', ')}`
                  : ''
              }`}
              bgColor="transparent"
              fgColor="currentColor"
              level="M"
              value={configUrl}
            />
          </div>
          <p className={styles.qrHint}>Σκάναρε με την εφαρμογή Meshtastic</p>

          <p className={styles.summary}>{selectionSummary}</p>

          <a
            className={styles.url}
            href={configUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            {configUrl}
          </a>

          <div className={styles.actions}>
            <a
              className={styles.primaryAction}
              href={configUrl}
              rel="noopener noreferrer"
              target="_blank"
            >
              Άνοιγμα στο Meshtastic
            </a>
            <button
              className={styles.secondaryAction}
              onClick={copyConfigUrl}
              type="button"
            >
              Αντιγραφή συνδέσμου
            </button>
          </div>

          <p aria-live="polite" className={styles.feedback}>
            {copyStatus === 'success' && 'Ο σύνδεσμος αντιγράφηκε.'}
            {copyStatus === 'error' &&
              'Δεν ήταν δυνατή η αντιγραφή. Επίλεξε και αντέγραψε τον σύνδεσμο χειροκίνητα.'}
          </p>
        </aside>
      </div>

      <details className={styles.preview}>
        <summary>Προεπισκόπηση JSON</summary>
        <pre className={styles.json}>
          <code>{configJson}</code>
        </pre>
      </details>

      <p className={styles.note}>
        Ο σύνδεσμος αυτής της σελίδας μπορεί να κοινοποιηθεί για να ανοίξει η
        ίδια επιλογή: <code>{shareableUrl}</code>
      </p>
    </section>
  );
}
