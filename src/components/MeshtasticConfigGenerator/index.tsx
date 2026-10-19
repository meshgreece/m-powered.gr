import {useEffect, useMemo, useState} from 'react';
import Link from '@docusaurus/Link';
import ExecutionEnvironment from '@docusaurus/ExecutionEnvironment';
import QRCode from 'react-qr-code';

import {
  ADDITIONAL_CHANNEL_DESCRIPTIONS,
  DEFAULT_ADVANCED_SETTINGS,
  DEFAULT_EXPORT_SETTINGS,
  DEFAULT_SELECTION,
  hasPositionPrivacyWarning,
  isAdvancedCustomized,
  isFirmwareVersion,
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
  FIRMWARE_VERSIONS,
  HOP_LIMITS,
  POSITION_PRECISION_VALUES,
} from './types';
import type {
  AdditionalChannelFlags,
  AdditionalChannelId,
  AdvancedSettings,
  ChannelFlags,
  ExportSettings,
  GeneratorSelection,
  ProfileId,
} from './types';

const COVERAGE_MAP_URL = '/docs/coverage-map';
const MQTT_RECOMMENDATIONS_URL = '/docs/mqtt#προτεινόμενες-τιμές';

function Checkbox({
  checked,
  description,
  name,
  onChange,
}: {
  checked: boolean;
  description?: string;
  name: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={styles.channelOption}>
      <input
        checked={checked}
        className={styles.checkbox}
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      <span className={styles.channelText}>
        <span className={styles.channelName}>{name}</span>
        {description && (
          <span className={styles.channelDescription}>
            {': '}
            {description}
          </span>
        )}
      </span>
    </label>
  );
}

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
  const [exportSettings, setExportSettings] = useState<ExportSettings>(
    DEFAULT_EXPORT_SETTINGS,
  );
  const [copyStatus, setCopyStatus] = useState<'idle' | 'success' | 'error'>(
    'idle',
  );

  useEffect(() => {
    setSelection(
      parseGeneratorSelection(new URLSearchParams(window.location.search)),
    );
    setIsInitialized(true);
  }, []);

  useEffect(() => {
    if (!isInitialized) return;

    const params = createGeneratorSearchParams(selection);
    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}?${params.toString()}${window.location.hash}`,
    );
  }, [isInitialized, selection]);

  const profile = PROFILES[selection.profileId];
  const {firmware, advanced} = exportSettings;
  const configUrl = useMemo(
    () => createConfigUrl(profile, selection, exportSettings),
    [profile, selection, exportSettings],
  );
  const configJson = useMemo(
    () => createConfigJson(profile, selection, exportSettings),
    [profile, selection, exportSettings],
  );
  const shareableUrl = useMemo(() => {
    if (!ExecutionEnvironment.canUseDOM || !isInitialized) return '';
    const params = createGeneratorSearchParams(selection);
    return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
  }, [isInitialized, selection]);
  const showPrivacyWarning = hasPositionPrivacyWarning(
    selection.positionPrecision,
  );
  const precisionLabel = getPositionPrecisionLabel(selection.positionPrecision);
  const positionSummary =
    selection.positionPrecision === 0
      ? 'χωρίς κοινοποίηση θέσης'
      : `ρύθμιση θέσης: ${selection.positionPrecision} (${precisionLabel})`;
  const isCustomized = isAdvancedCustomized(
    advanced,
    selection.additionalChannels,
  );
  const selectionSummary = [
    ...(selection.profileId === 'LongFast' ? [] : [`firmware ${firmware}`]),
    `hop limit ${selection.hopLimit}`,
    positionSummary,
    ...(selection.additionalChannels.length > 0
      ? [selection.additionalChannels.join(' + ')]
      : []),
    ...(isCustomized ? ['προσαρμοσμένες ρυθμίσεις για προχωρημένους'] : []),
  ].join(' · ');

  function updateSelection(update: Partial<GeneratorSelection>) {
    setSelection((current) => ({...current, ...update}));
    setCopyStatus('idle');
  }

  function updateExportSettings(update: Partial<ExportSettings>) {
    setExportSettings((current) => ({...current, ...update}));
    setCopyStatus('idle');
  }

  function updateAdvanced(
    update: (current: AdvancedSettings) => Partial<AdvancedSettings>,
  ) {
    setExportSettings((current) => ({
      ...current,
      advanced: {...current.advanced, ...update(current.advanced)},
    }));
    setCopyStatus('idle');
  }

  function updatePrimaryFlag(flag: keyof ChannelFlags, checked: boolean) {
    updateAdvanced((current) => ({
      primary: {...current.primary, [flag]: checked},
    }));
  }

  function updateAdditionalFlag(
    channelId: AdditionalChannelId,
    flag: keyof AdditionalChannelFlags,
    checked: boolean,
  ) {
    updateAdvanced((current) => ({
      additional: {
        ...current.additional,
        [channelId]: {...current.additional[channelId], [flag]: checked},
      },
    }));
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
      aria-label="Γεννήτρια προφίλ ρυθμίσεων του m-powered.gr"
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
                Κατανομή preset →
              </Link>
            </div>
            <div className={styles.selectWrapper}>
              <select
                aria-describedby={`configuration-profile-description${
                  selection.profileId === 'NarrowSlow'
                    ? ' configuration-narrow-slow-warning'
                    : ''
                }`}
                id="configuration-profile"
                className={styles.select}
                value={selection.profileId}
                onChange={(event) => {
                  updateSelection({
                    profileId: event.target.value as ProfileId,
                  });
                  updateExportSettings({advanced: DEFAULT_ADVANCED_SETTINGS});
                }}
              >
                {Object.values(PROFILES).map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
              <SelectChevron />
            </div>
            <p className={styles.hint} id="configuration-profile-description">
              {profile.description}
            </p>
            {selection.profileId === 'NarrowSlow' && (
              <div
                aria-live="polite"
                className={styles.migrationWarning}
                id="configuration-narrow-slow-warning"
                role="status"
              >
                <strong>Έλεγξε και τον ρόλο του κόμβου</strong>
                <span>
                  {' '}
                  Διάβασε τις{' '}
                  <Link to="/docs/network-settings">
                    ρυθμίσεις δικτύου
                  </Link>
                  . Επίλεξε συνήθως <code>CLIENT</code> ή <code>CLIENT_MUTE</code>.
                  Για <code>ROUTER</code> ή <code>ROUTER_LATE</code>, συνεννοήσου
                  πρώτα με την κοινότητα.
                </span>
              </div>
            )}
          </div>

          <div className={`${styles.row} ${styles.rowCompact}`}>
            <label className={styles.label} htmlFor="configuration-firmware">
              Έκδοση firmware
            </label>
            <div className={`${styles.selectWrapper} ${styles.selectNarrow}`}>
              <select
                aria-describedby="configuration-firmware-hint configuration-firmware-badge"
                id="configuration-firmware"
                className={styles.select}
                value={firmware}
                onChange={(event) => {
                  if (isFirmwareVersion(event.target.value)) {
                    updateExportSettings({firmware: event.target.value});
                  }
                }}
              >
                {FIRMWARE_VERSIONS.map((version) => (
                  <option key={version} value={version}>
                    {version}
                  </option>
                ))}
              </select>
              <SelectChevron />
            </div>
            <p className={styles.hint} id="configuration-firmware-hint">
              {selection.profileId === 'LongFast' ? (
                'Το LongFast είναι ίδιο και στις δύο εκδόσεις.'
              ) : firmware === '2.8' ? (
                <>
                  Για 2.8.1 ή νεότερο: region <code>EU_N_868</code> με preset{' '}
                  <code>NARROW_SLOW</code>.
                </>
              ) : (
                <>
                  Για 2.7: ισοδύναμες custom ρυθμίσεις στο <code>EU_868</code>, γιατί
                  το 2.7 δεν γνωρίζει το <code>EU_N_868</code>.
                </>
              )}
            </p>
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
                  ? 'Η αρχική επιλογή της γεννήτριας· περισσότερα hops επιτρέπουν περισσότερες αναμεταδόσεις.'
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
              Πρόταση: <strong>14</strong> (≈1,5 km) για προσωπικό ή φορητό
              κόμβο και <strong>15</strong> (≈729 m) για σταθερό. Σύμφωνα με την{' '}
              <a href="https://meshtastic.org/docs/configuration/radio/channels/#position-precision">
                τεκμηρίωση του firmware 2.8
              </a>
              , τα κανάλια με δημόσια γνωστό κλειδί, όπως αυτά των προφίλ μας,
              περιορίζονται σε 15 bits. Μεγαλύτερες τιμές παραμένουν διαθέσιμες
              για συμβατότητα με παλαιότερο firmware.
            </p>
            {showPrivacyWarning && (
              <div
                aria-live="polite"
                className={styles.privacyWarning}
                id="configuration-privacy-warning"
                role="status"
              >
                <strong>Προσοχή στην ιδιωτικότητα</strong>
                <span>
                  {' '}
                  Σε firmware χωρίς το όριο των 15 bits, αυτή η επιλογή μπορεί
                  να αποκαλύπτει το σπίτι ή τη διαδρομή σου. Το κανάλι
                  χρησιμοποιεί δημόσια γνωστό κλειδί.
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
                        {': '}
                        {ADDITIONAL_CHANNEL_DESCRIPTIONS[channelId]}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>

          <div className={styles.row}>
            <details className={styles.advanced}>
              <summary>Ρυθμίσεις για προχωρημένους</summary>
              <p className={styles.hint}>
                Οι προεπιλογές είναι οι προτεινόμενες τιμές για το κοινοτικό δίκτυο
                και δεν αποθηκεύονται στον σύνδεσμο αυτής της σελίδας. Δες{' '}
                <Link to={MQTT_RECOMMENDATIONS_URL}>
                  γιατί προτείνουμε αυτές τις τιμές
                </Link>
                .
              </p>
              <fieldset className={styles.channels}>
                <legend className={styles.label}>MQTT</legend>
                <div className={styles.channelOptions}>
                  <Checkbox
                    checked={advanced.configOkToMqtt}
                    name="OK to MQTT"
                    onChange={(checked) =>
                      updateAdvanced(() => ({configOkToMqtt: checked}))
                    }
                  />
                  <Checkbox
                    checked={advanced.ignoreMqtt}
                    name="Ignore MQTT"
                    onChange={(checked) =>
                      updateAdvanced(() => ({ignoreMqtt: checked}))
                    }
                  />
                </div>
              </fieldset>
              <fieldset className={styles.channels}>
                <legend className={styles.label}>
                  Κανάλι {profile.channelSet.settings?.[0]?.name}
                </legend>
                <div className={styles.channelOptions}>
                  <Checkbox
                    checked={advanced.primary.uplinkEnabled}
                    name="Uplink"
                    onChange={(checked) =>
                      updatePrimaryFlag('uplinkEnabled', checked)
                    }
                  />
                  <Checkbox
                    checked={advanced.primary.downlinkEnabled}
                    name="Downlink"
                    onChange={(checked) =>
                      updatePrimaryFlag('downlinkEnabled', checked)
                    }
                  />
                </div>
              </fieldset>
              {selection.additionalChannels.map((channelId) => (
                <fieldset className={styles.channels} key={channelId}>
                  <legend className={styles.label}>Κανάλι {channelId}</legend>
                  <div className={styles.channelOptions}>
                    <Checkbox
                      checked={advanced.additional[channelId].uplinkEnabled}
                      name="Uplink"
                      onChange={(checked) =>
                        updateAdditionalFlag(channelId, 'uplinkEnabled', checked)
                      }
                    />
                    <Checkbox
                      checked={advanced.additional[channelId].downlinkEnabled}
                      name="Downlink"
                      onChange={(checked) =>
                        updateAdditionalFlag(
                          channelId,
                          'downlinkEnabled',
                          checked,
                        )
                      }
                    />
                    <Checkbox
                      checked={advanced.additional[channelId].isMuted}
                      description="χωρίς ειδοποιήσεις· το κανάλι συνεχίζει να λειτουργεί"
                      name="Σίγαση"
                      onChange={(checked) =>
                        updateAdditionalFlag(channelId, 'isMuted', checked)
                      }
                    />
                  </div>
                </fieldset>
              ))}
            </details>
          </div>
        </div>

        <aside className={styles.result}>
          <div className={styles.resultHeader}>
            <span className={styles.eyebrow}>Σύνδεσμος ρυθμίσεων</span>
            <span className={styles.resultProfile}>{profile.name}</span>
          </div>

          <p
            className={styles.firmwareBadge}
            id="configuration-firmware-badge"
            role="note"
          >
            <strong>
              {selection.profileId === 'LongFast'
                ? 'Για firmware 2.7 και 2.8.1 ή νεότερο'
                : firmware === '2.8'
                  ? 'Για firmware 2.8.1 ή νεότερο'
                  : 'Για firmware 2.7'}
            </strong>{' '}
            {selection.profileId === 'LongFast'
              ? 'Όχι για το 2.8.0, που ανακλήθηκε.'
              : firmware === '2.8'
                ? 'Όχι για το 2.8.0, που ανακλήθηκε. Για κόμβο με 2.7, επίλεξε 2.7.'
                : 'Όχι για κόμβο με 2.8.1· εκεί επίλεξε 2.8. Μετά την αναβάθμιση σε 2.8.1, εφάρμοσε ξανά το προφίλ για 2.8.'}
          </p>

          <div className={styles.qrPanel} key={configUrl}>
            <QRCode
              aria-label={`QR code για το προφίλ ${profile.name}, firmware ${firmware}, hop limit ${selection.hopLimit}, επιλεγμένη ακρίβεια θέσης ${selection.positionPrecision} (${precisionLabel})${
                selection.additionalChannels.length > 0
                  ? `, πρόσθετα κανάλια ${selection.additionalChannels.join(', ')}`
                  : ''
              }${isCustomized ? ', προσαρμοσμένες ρυθμίσεις για προχωρημένους' : ''}`}
              bgColor="transparent"
              fgColor="currentColor"
              level="M"
              value={configUrl}
            />
          </div>
          <p className={styles.qrHint}>Σκάναρε με το Meshtastic app</p>

          <p className={styles.summary}>{selectionSummary}</p>

          <p className={styles.mqttTopic}>
            MQTT root topic: <code>{profile.mqttRootTopic}</code>. Ορίζεται
            χωριστά στο MQTT module, μόνο για gateway.
          </p>

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
              Άνοιγμα στο Meshtastic app
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
