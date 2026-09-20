import React, {useEffect, useMemo, useRef, useState} from 'react';
import Translate, {translate} from '@docusaurus/Translate';
import styles from './styles.module.css';
import {
  MESHVIEW_BASE_URL,
  fetchJson,
  getMeshviewApiUrl,
  getNewestPacketImportTimeUs,
  parseImportTimeUs,
} from '../../lib/meshview';
import type {PacketsResponse} from '../../lib/meshview';

const MESHVIEW_FIREHOSE_URL = `${MESHVIEW_BASE_URL}/firehose`;
const PACKET_LIMIT = 1;
const POLL_INTERVAL_MS = 3_000;

function getLatestImportTimeUs(data: PacketsResponse): number | null {
  const fromLatestField = parseImportTimeUs(data.latest_import_time);
  if (fromLatestField !== null) {
    return fromLatestField;
  }

  return getNewestPacketImportTimeUs(data.packets);
}

export default function StatusWidget() {
  const [lastImportTimeUs, setLastImportTimeUs] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const sinceCursorUsRef = useRef<number | null>(null);
  const isFetchInFlightRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    const fetchLatestPacket = async () => {
      if (isFetchInFlightRef.current) {
        return;
      }

      isFetchInFlightRef.current = true;

      try {
        const params: Record<string, number | string> = {limit: PACKET_LIMIT};

        if (sinceCursorUsRef.current !== null) {
          params.since = sinceCursorUsRef.current;
        }

        const data = await fetchJson<PacketsResponse>(
          getMeshviewApiUrl('packets', params),
        );
        const newestPacketImportTimeUs = getNewestPacketImportTimeUs(data.packets);

        // Match Meshview frontend behavior: advance "since" only when a request
        // actually returned packets.
        if (newestPacketImportTimeUs !== null) {
          const latestImportTimeUs =
            getLatestImportTimeUs(data) ?? newestPacketImportTimeUs;

          sinceCursorUsRef.current = latestImportTimeUs;

          if (isMounted) {
            setLastImportTimeUs((previousValue) => {
              if (previousValue === null) {
                return latestImportTimeUs;
              }

              return Math.max(previousValue, latestImportTimeUs);
            });
            setHasError(false);
          }
        } else if (isMounted) {
          setHasError(false);
        }
      } catch (error) {
        if (isMounted) {
          setHasError(true);
        }
        console.error(error);
      } finally {
        isFetchInFlightRef.current = false;

        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void fetchLatestPacket();

    const pollInterval = window.setInterval(() => {
      void fetchLatestPacket();
    }, POLL_INTERVAL_MS);

    const tickerInterval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1_000);

    return () => {
      isMounted = false;
      window.clearInterval(pollInterval);
      window.clearInterval(tickerInterval);
    };
  }, []);

  const secondsSinceLastPacket = useMemo(() => {
    if (lastImportTimeUs === null) {
      return null;
    }

    return Math.max(0, Math.floor((nowMs * 1_000 - lastImportTimeUs) / 1_000_000));
  }, [lastImportTimeUs, nowMs]);

  const secondsValue =
    !hasError && !isLoading && secondsSinceLastPacket !== null
      ? String(secondsSinceLastPacket)
      : null;

  const title = hasError
    ? translate({
        id: 'statusWidget.title.unavailable',
        message: 'Meshview status unavailable',
        description: 'Tooltip shown when packet status fetch fails.',
      })
    : secondsValue === null
      ? translate({
          id: 'statusWidget.title.loading',
          message: 'Loading Meshview packet status',
          description: 'Tooltip shown while waiting for packet data.',
        })
      : translate(
          {
            id: 'statusWidget.title.lastPacket',
            message: 'Last Meshtastic packet received {seconds}s ago',
            description: 'Tooltip showing elapsed time since latest packet.',
          },
          {seconds: secondsValue},
        );

  const message = hasError ? (
    <Translate
      id="statusWidget.text.unavailable"
      description="Widget text when packet status fetch fails.">
      Unavailable
    </Translate>
  ) : secondsValue === null ? (
    <Translate
      id="statusWidget.text.loading"
      description="Widget text while waiting for first packet data.">
      Loading...
    </Translate>
  ) : (
    <Translate
      id="statusWidget.text.lastPacket"
      description="Widget text showing elapsed time since latest packet."
      values={{
        seconds: <span className={styles.statusSeconds}>{secondsValue}</span>,
      }}>
      {'Last pkt {seconds}s ago'}
    </Translate>
  );

  return (
    <a
      className={styles.statusWidget}
      href={MESHVIEW_FIREHOSE_URL}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      aria-label={title}>
      <span className={styles.iconContainer}>
        <div className={styles.pulseContainer}>
          <div className={styles.pulseRing}></div>
          <div className={styles.pulseDot}></div>
        </div>
      </span>
      <span className={styles.message}>{message}</span>
    </a>
  );
}
