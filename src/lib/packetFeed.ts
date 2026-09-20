// Live packet feed shared by the navbar status widget and the homepage map.
//
// Alias-free imports on purpose, same as ./meshview: vitest runs with no config
// here and cannot resolve @site.

import {
  getLatestImportTimeUs,
  getMeshviewApiUrl,
  parseImportTimeUs,
} from './meshview';
import type {MeshviewPacket, PacketsResponse} from './meshview';

const POLL_INTERVAL_MS = 3_000;
const PACKET_BATCH_LIMIT = 100;
const REQUEST_TIMEOUT_MS = 10_000;

export type PacketFeedSnapshot = {
  latestImportTimeUs: number | null;
  isLoading: boolean;
  hasError: boolean;
};

type StateListener = () => void;
type PacketListener = (packets: readonly MeshviewPacket[]) => void;

const SERVER_SNAPSHOT: PacketFeedSnapshot = {
  latestImportTimeUs: null,
  isLoading: true,
  hasError: false,
};

export function getPacketImportTimeUs(packet: MeshviewPacket): number | null {
  return parseImportTimeUs(packet.import_time_us);
}

export function getPacketSenderNodeId(packet: MeshviewPacket): number | null {
  const senderId = Number(packet.from_node_id);
  return Number.isSafeInteger(senderId) && senderId >= 0 ? senderId : null;
}

export function createPacketFeed() {
  const visibilityTarget = typeof document === 'undefined' ? null : document;

  let snapshot = SERVER_SNAPSHOT;
  let cursorUs: number | null = null;
  let isPrimed = false;
  let isFetchInFlight = false;
  let requestGeneration = 0;
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let abortController: AbortController | null = null;
  const stateListeners = new Set<StateListener>();
  const packetListeners = new Set<PacketListener>();

  function setSnapshot(next: PacketFeedSnapshot) {
    if (
      next.latestImportTimeUs === snapshot.latestImportTimeUs &&
      next.isLoading === snapshot.isLoading &&
      next.hasError === snapshot.hasError
    ) {
      return;
    }

    snapshot = next;
    for (const listener of stateListeners) listener();
  }

  async function requestPackets(isPrime: boolean) {
    if (isFetchInFlight || visibilityTarget?.hidden) return;

    isFetchInFlight = true;
    const requestId = ++requestGeneration;
    const requestController = new AbortController();
    abortController = requestController;

    // fetch never times out on its own, so a request that stalls rather than
    // fails would hold isFetchInFlight forever and every later poll would return
    // at the guard above -- the feed dies with the widget still reading
    // "loading". Give up on our own terms rather than waiting for the request to
    // honour the abort: cancelActiveRequest releases the guard and bumps the
    // generation, which is what the abort alone cannot do for a response that
    // resolved just before the deadline fired.
    const timeoutId = setTimeout(() => {
      setSnapshot({...snapshot, isLoading: false, hasError: true});
      cancelActiveRequest();
    }, REQUEST_TIMEOUT_MS);

    try {
      const requestCursor = cursorUs;
      const params: Record<string, number | string> = {
        limit: isPrime ? 1 : PACKET_BATCH_LIMIT,
      };
      if (!isPrime && requestCursor !== null) {
        params.since = requestCursor;
      }

      const response = await fetch(getMeshviewApiUrl('packets', params), {
        cache: 'no-store',
        headers: {accept: 'application/json'},
        signal: requestController.signal,
      });

      if (!response.ok) {
        throw new Error(
          `Meshview request failed with status ${response.status}`,
        );
      }

      const data = (await response.json()) as PacketsResponse;
      if (requestId !== requestGeneration) return;

      const packets = Array.isArray(data.packets) ? data.packets : [];
      const latestImportTimeUs = getLatestImportTimeUs(data);

      // The cursor trusts latest_import_time, so a gap wider than
      // PACKET_BATCH_LIMIT silently loses its oldest packets -- the API returns
      // newest-first, and the raised cursor means the next poll will not ask for
      // them again. Needs >100 packets between two polls to bite, so it is out
      // of reach on this mesh; page backwards from the oldest returned packet if
      // bursts ever get there.
      //
      // Math.max is what keeps this safe in the ordinary case: a response that
      // reports a cursor at or behind ours cannot drag the feed backwards.
      if (latestImportTimeUs !== null) {
        cursorUs =
          cursorUs === null
            ? latestImportTimeUs
            : Math.max(cursorUs, latestImportTimeUs);
      } else if (isPrime && cursorUs === null) {
        // Avoid replaying arbitrary history if the feed is temporarily empty.
        cursorUs = Date.now() * 1_000;
      }

      setSnapshot({
        latestImportTimeUs:
          latestImportTimeUs === null
            ? snapshot.latestImportTimeUs
            : Math.max(
                snapshot.latestImportTimeUs ?? latestImportTimeUs,
                latestImportTimeUs,
              ),
        isLoading: false,
        hasError: false,
      });

      if (isPrime) {
        isPrimed = true;
        return;
      }

      // The cursor is the dedupe: it is never null once primed, and a packet at
      // or behind it was published by an earlier poll.
      const freshPackets = packets.filter((packet) => {
        const packetTime = getPacketImportTimeUs(packet);
        return (
          packetTime !== null &&
          (requestCursor === null || packetTime > requestCursor)
        );
      });

      if (freshPackets.length > 0) {
        for (const listener of packetListeners) listener(freshPackets);
      }
    } catch (error) {
      if (
        requestId !== requestGeneration ||
        (error as {name?: string}).name === 'AbortError'
      ) {
        return;
      }

      setSnapshot({...snapshot, isLoading: false, hasError: true});
      console.error(error);
    } finally {
      clearTimeout(timeoutId);

      if (requestId === requestGeneration) {
        isFetchInFlight = false;
        if (abortController === requestController) abortController = null;
      }
    }
  }

  function tick() {
    void requestPackets(!isPrimed);
  }

  function onVisibilityChange() {
    if (visibilityTarget?.hidden) {
      cancelActiveRequest();
      return;
    }

    cursorUs = null;
    isPrimed = false;
    tick();
  }

  function start() {
    if (intervalId !== null) return;

    setSnapshot({...snapshot, isLoading: snapshot.latestImportTimeUs === null});
    visibilityTarget?.addEventListener('visibilitychange', onVisibilityChange);
    tick();
    intervalId = setInterval(tick, POLL_INTERVAL_MS);
  }

  function stop() {
    if (intervalId !== null) clearInterval(intervalId);
    intervalId = null;
    cancelActiveRequest();
    cursorUs = null;
    isPrimed = false;
    visibilityTarget?.removeEventListener(
      'visibilitychange',
      onVisibilityChange,
    );
  }

  function cancelActiveRequest() {
    requestGeneration += 1;
    abortController?.abort();
    abortController = null;
    isFetchInFlight = false;
  }

  function ensureRunning() {
    if (stateListeners.size + packetListeners.size > 0) start();
  }

  function stopIfUnused() {
    if (stateListeners.size + packetListeners.size === 0) stop();
  }

  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => SERVER_SNAPSHOT,
    subscribeState(listener: StateListener) {
      stateListeners.add(listener);
      ensureRunning();
      return () => {
        stateListeners.delete(listener);
        stopIfUnused();
      };
    },
    subscribePackets(listener: PacketListener) {
      packetListeners.add(listener);
      ensureRunning();
      return () => {
        packetListeners.delete(listener);
        stopIfUnused();
      };
    },
  };
}

export const meshviewPacketFeed = createPacketFeed();

export const LIVE_STATUS_MAX_AGE_S = 60;
export const STALE_STATUS_MAX_AGE_S = 3_600;

export type FeedStatus =
  | {kind: 'loading' | 'error' | 'waiting'}
  | {kind: 'live'; seconds: number}
  | {kind: 'stale'; minutes: number};

/** Truthful status ladder: loading → error → live → stale → waiting. */
export function getFeedStatus(
  snapshot: Pick<
    PacketFeedSnapshot,
    'latestImportTimeUs' | 'isLoading' | 'hasError'
  >,
  nowMs: number,
): FeedStatus {
  if (snapshot.hasError) return {kind: 'error'};
  if (snapshot.isLoading) return {kind: 'loading'};
  if (snapshot.latestImportTimeUs === null) return {kind: 'waiting'};

  const ageS = Math.max(0, (nowMs * 1_000 - snapshot.latestImportTimeUs) / 1_000_000);
  if (ageS < LIVE_STATUS_MAX_AGE_S) {
    return {kind: 'live', seconds: Math.floor(ageS)};
  }
  if (ageS < STALE_STATUS_MAX_AGE_S) {
    return {kind: 'stale', minutes: Math.max(1, Math.round(ageS / 60))};
  }
  return {kind: 'waiting'};
}
