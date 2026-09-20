import React, {useEffect, useState, useSyncExternalStore} from 'react';
import clsx from 'clsx';
import {getFeedStatus, meshviewPacketFeed} from '@site/src/lib/packetFeed';
import type {FeedStatus} from '@site/src/lib/packetFeed';
import {MESHVIEW_BASE_URL} from '@site/src/lib/meshview';
import {getStatusAccessibleName, getStatusLabel} from './statusLabel';
import styles from './styles.module.css';

const MESHVIEW_FIREHOSE_URL = `${MESHVIEW_BASE_URL}/firehose`;

const iconProps = {
  className: styles.icon,
  viewBox: '0 0 12 12',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

// Shape carries the state too, so it survives without colour or text.
const statusIcons: Record<FeedStatus['kind'], React.ReactNode> = {
  loading: (
    <svg {...iconProps} className={clsx(styles.icon, styles.spinner)}>
      <path d="M6 1.5a4.5 4.5 0 1 1-4.5 4.5" strokeWidth={2} />
    </svg>
  ),
  live: (
    <svg {...iconProps}>
      <circle cx="6" cy="6" r="4" fill="currentColor" stroke="none" />
    </svg>
  ),
  stale: (
    <svg {...iconProps}>
      <circle cx="6" cy="6" r="4.9" />
      <path d="M6 3.4V6l1.7 1.2" />
    </svg>
  ),
  waiting: (
    <svg {...iconProps}>
      <circle cx="6" cy="6" r="3.75" strokeWidth={2} />
    </svg>
  ),
  error: (
    <svg {...iconProps}>
      <path d="M6 1.2 11 10.3H1Z" />
      <path d="M6 4.6v2.4" />
      <circle cx="6" cy="8.6" r=".45" fill="currentColor" />
    </svg>
  ),
};

export default function StatusWidget() {
  const snapshot = useSyncExternalStore(
    meshviewPacketFeed.subscribeState,
    meshviewPacketFeed.getSnapshot,
    meshviewPacketFeed.getServerSnapshot,
  );
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    // Only the elapsed-time labels move on their own; loading, error and
    // "waiting" have nothing to count, so the navbar stays still.
    const tickerInterval = window.setInterval(() => {
      if (meshviewPacketFeed.getSnapshot().latestImportTimeUs !== null) {
        setNowMs(Date.now());
      }
    }, 1_000);

    return () => {
      window.clearInterval(tickerInterval);
    };
  }, []);

  const status = getFeedStatus(snapshot, nowMs);
  const label = getStatusLabel(status);
  const accessibleName = getStatusAccessibleName(label);

  return (
    <a
      className={clsx(styles.statusWidget, styles[status.kind])}
      href={MESHVIEW_FIREHOSE_URL}
      target="_blank"
      rel="noopener noreferrer"
      title={accessibleName}
      aria-label={accessibleName}>
      <span className={styles.indicator} aria-hidden="true">
        {status.kind === 'live' && <span className={styles.ping} />}
        {statusIcons[status.kind]}
      </span>
      <span className={styles.message} aria-hidden="true">
        {label}
      </span>
    </a>
  );
}
