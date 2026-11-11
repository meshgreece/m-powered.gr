import type {ReactNode} from 'react';

import styles from './teaching.module.css';

const icon = {width: 14, height: 14, viewBox: '0 0 14 14', fill: 'currentColor', 'aria-hidden': true} as const;

export function PlayControls({
  playing,
  done,
  onPlay,
  onPause,
  onReset,
  onNext,
  children,
}: {
  playing: boolean;
  done: boolean;
  onPlay: () => void;
  onPause: () => void;
  onReset: () => void;
  onNext?: () => void;
  children?: ReactNode;
}) {
  const label = playing ? 'Παύση' : done ? 'Ξανά' : 'Παίξε';
  return (
    <div className={styles.controls}>
      <button type="button" className={styles.playButton} onClick={playing ? onPause : onPlay}>
        {playing ? (
          <svg {...icon}>
            <rect x="2" y="1" width="3.5" height="12" rx="1" />
            <rect x="8.5" y="1" width="3.5" height="12" rx="1" />
          </svg>
        ) : (
          <svg {...icon}>
            <path d="M3 1.5v11l9-5.5z" />
          </svg>
        )}
        {label}
      </button>
      {onNext && (
        <button
          type="button"
          className={styles.iconButton}
          aria-label="Επόμενο βήμα"
          aria-disabled={done}
          onClick={done ? undefined : onNext}
        >
          <svg {...icon}>
            <path d="M1.5 1.5v11l8-5.5z" />
            <rect x="10.5" y="1.5" width="2.5" height="11" rx="1" />
          </svg>
        </button>
      )}
      <button type="button" className={styles.iconButton} aria-label="Από την αρχή" onClick={onReset}>
        <svg {...icon} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2.5 7a4.5 4.5 0 1 0 1.4-3.2" />
          <path d="M2 1.5v3h3" />
        </svg>
      </button>
      {children && <div className={styles.controlsBody}>{children}</div>}
    </div>
  );
}
