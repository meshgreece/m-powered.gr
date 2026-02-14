import React, {useEffect, useMemo, useRef, useState} from 'react';
import Translate, {translate} from '@docusaurus/Translate';
import styles from './styles.module.css';

const MESHVIEW_PACKETS_ENDPOINT = 'https://meshview.m-powered.gr/api/packets';
const MESHVIEW_FIREHOSE_URL = 'https://meshview.m-powered.gr/firehose';
const PACKET_LIMIT = 1;
const POLL_INTERVAL_MS = 3_000;

type Packet = {
  import_time_us?: number | string;
};

type PacketsResponse = {
  latest_import_time?: number | string;
  packets?: Packet[];
};

function parseImportTimeUs(value: number | string | undefined): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function getLatestImportTimeUs(data: PacketsResponse): number | null {
  const fromLatestField = parseImportTimeUs(data.latest_import_time);
  if (fromLatestField !== null) {
    return fromLatestField;
  }

  return getNewestPacketImportTimeUs(data.packets);
}

function getNewestPacketImportTimeUs(packets: Packet[] | undefined): number | null {
  if (!Array.isArray(packets) || packets.length === 0) {
    return null;
  }

  let newestImportTimeUs: number | null = null;

  for (const packet of packets) {
    const importTimeUs = parseImportTimeUs(packet.import_time_us);

    if (
      importTimeUs !== null &&
      (newestImportTimeUs === null || importTimeUs > newestImportTimeUs)
    ) {
      newestImportTimeUs = importTimeUs;
    }
  }

  return newestImportTimeUs;
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
        const queryParams = new URLSearchParams({
          limit: String(PACKET_LIMIT),
        });

        if (sinceCursorUsRef.current !== null) {
          queryParams.set('since', String(sinceCursorUsRef.current));
        }

        const response = await fetch(`${MESHVIEW_PACKETS_ENDPOINT}?${queryParams.toString()}`, {
          cache: 'no-store',
          headers: {accept: 'application/json'},
        });

        if (!response.ok) {
          throw new Error(`Meshview request failed with status ${response.status}`);
        }

        const data = (await response.json()) as PacketsResponse;
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
