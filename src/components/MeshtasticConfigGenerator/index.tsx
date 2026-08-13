import {useEffect, useMemo, useState} from 'react';
import ExecutionEnvironment from '@docusaurus/ExecutionEnvironment';
import QRCode from 'react-qr-code';

import {DEFAULT_PROFILE, isProfileId, PROFILES} from './config';
import {createConfigJson, createConfigUrl} from './protobuf';
import styles from './styles.module.css';
import type {ProfileId} from './types';

export default function MeshtasticConfigGenerator() {
  const [selectedProfile, setSelectedProfile] =
    useState<ProfileId>(DEFAULT_PROFILE);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'success' | 'error'>(
    'idle',
  );

  useEffect(() => {
    if (!ExecutionEnvironment.canUseDOM) return;

    const preset = new URLSearchParams(window.location.search).get('preset');
    setSelectedProfile(isProfileId(preset) ? preset : DEFAULT_PROFILE);
  }, []);

  useEffect(() => {
    if (!ExecutionEnvironment.canUseDOM) return;

    const params = new URLSearchParams(window.location.search);
    params.set('preset', selectedProfile);
    window.history.replaceState(
      {},
      '',
      `${window.location.pathname}?${params.toString()}`,
    );
  }, [selectedProfile]);

  const profile = PROFILES[selectedProfile];
  const configUrl = useMemo(() => createConfigUrl(profile), [profile]);
  const configJson = useMemo(() => createConfigJson(profile), [profile]);
  const shareableUrl = useMemo(() => {
    if (!ExecutionEnvironment.canUseDOM) return '';
    return `${window.location.origin}${window.location.pathname}?preset=${selectedProfile}`;
  }, [selectedProfile]);

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
      className={styles.generator}
      aria-labelledby="configuration-profile"
    >
      <div className={styles.controls}>
        <label className={styles.label} htmlFor="configuration-profile">
          Προφίλ ρυθμίσεων
        </label>
        <select
          id="configuration-profile"
          className={styles.select}
          value={selectedProfile}
          onChange={(event) => {
            setSelectedProfile(event.target.value as ProfileId);
            setCopyStatus('idle');
          }}
        >
          {Object.values(PROFILES).map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
        <p className={styles.description}>{profile.description}</p>
      </div>

      <details className={styles.preview}>
        <summary>Προεπισκόπηση ρυθμίσεων JSON</summary>
        <pre className={styles.json}>
          <code>{configJson}</code>
        </pre>
      </details>

      <div className={styles.output}>
        <div className={styles.qrPanel}>
          <QRCode
            aria-label={`QR code για το προφίλ ${profile.name}`}
            bgColor="transparent"
            fgColor="currentColor"
            level="M"
            value={configUrl}
          />
          <p className={styles.qrHint}>Σκάναρε με την εφαρμογή Meshtastic.</p>
        </div>

        <div className={styles.details}>
          <h2>Σύνδεσμος ρυθμίσεων</h2>
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
              className="button button--primary"
              href={configUrl}
              rel="noopener noreferrer"
              target="_blank"
            >
              Άνοιγμα στο Meshtastic
            </a>
            <button
              className="button button--secondary"
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

          <p className={styles.note}>
            Ο σύνδεσμος αυτής της σελίδας μπορεί να κοινοποιηθεί για να ανοίξει
            η ίδια επιλογή: <code>{shareableUrl}</code>
          </p>
        </div>
      </div>
    </section>
  );
}
