import {afterEach, describe, expect, it, vi} from 'vitest';

import {
  createPacketFeed,
  getPacketSenderNodeId,
  getFeedStatus,
} from './packetFeed';
import type {MeshviewPacket} from './meshview';

function response(data: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => data,
  };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('packet parsing', () => {
  it('parses valid sender node ids', () => {
    expect(getPacketSenderNodeId({from_node_id: '42'})).toBe(42);
    expect(getPacketSenderNodeId({from_node_id: -1})).toBeNull();
  });
});

describe('shared packet feed', () => {
  it('primes silently, then publishes new packets to every listener', async () => {
    vi.useFakeTimers();
    const primePacket = {
      import_time_us: 100,
      from_node_id: 5,
    };
    const newPackets: MeshviewPacket[] = [
      {import_time_us: 101, from_node_id: 10},
      {import_time_us: 102, from_node_id: 10},
      {import_time_us: 103, from_node_id: 20},
    ];
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        response({packets: [primePacket], latest_import_time: 100}),
      )
      .mockResolvedValueOnce(
        response({
          packets: [primePacket, ...newPackets],
          latest_import_time: 103,
        }),
      );
    vi.stubGlobal('fetch', fetcher);
    const feed = createPacketFeed();
    const firstListener = vi.fn();
    const secondListener = vi.fn();

    const unsubscribeFirst = feed.subscribePackets(firstListener);
    const unsubscribeSecond = feed.subscribePackets(secondListener);
    await flushPromises();

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(firstListener).not.toHaveBeenCalled();
    expect(feed.getSnapshot()).toMatchObject({
      latestImportTimeUs: 100,
    });

    await vi.advanceTimersByTimeAsync(3_000);

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[1][0]).toContain('limit=100&since=100');
    expect(firstListener).toHaveBeenCalledWith(newPackets);
    expect(secondListener).toHaveBeenCalledWith(newPackets);
    expect(feed.getSnapshot()).toMatchObject({
      latestImportTimeUs: 103,
      isLoading: false,
      hasError: false,
    });

    unsubscribeFirst();
    unsubscribeSecond();
    await vi.advanceTimersByTimeAsync(6_000);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  // A quiet poll reports the cursor it already gave us. Advancing on that alone
  // would be harmless, but only because the cursor cannot move backwards -- pin
  // it, because nothing else in this file does.
  it('holds the cursor when a quiet poll reports no newer packets', async () => {
    vi.useFakeTimers();
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        response({
          packets: [{import_time_us: 200, from_node_id: 5}],
          latest_import_time: 200,
        }),
      )
      .mockResolvedValueOnce(response({packets: [], latest_import_time: 150}))
      .mockResolvedValueOnce(response({packets: [], latest_import_time: 200}));
    vi.stubGlobal('fetch', fetcher);
    const feed = createPacketFeed();
    const listener = vi.fn();

    const unsubscribe = feed.subscribePackets(listener);
    await flushPromises();
    expect(fetcher.mock.calls[0][0]).toContain('limit=1');

    // A cursor behind ours must not drag the feed backwards.
    await vi.advanceTimersByTimeAsync(3_000);
    expect(fetcher.mock.calls[1][0]).toContain('since=200');

    // Nor may an empty response move it forward off its own report.
    await vi.advanceTimersByTimeAsync(3_000);
    expect(fetcher.mock.calls[2][0]).toContain('since=200');

    expect(listener).not.toHaveBeenCalled();
    expect(feed.getSnapshot()).toMatchObject({
      latestImportTimeUs: 200,
      isLoading: false,
      hasError: false,
    });

    unsubscribe();
  });

  it('does not replay the current batch to a later subscriber', async () => {
    vi.useFakeTimers();
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        response({packets: [{import_time_us: 100}]}),
      )
      .mockResolvedValueOnce(
        response({
          packets: [{import_time_us: 101, from_node_id: 10}],
        }),
      );
    vi.stubGlobal('fetch', fetcher);
    const feed = createPacketFeed();
    const firstListener = vi.fn();
    const laterListener = vi.fn();

    const unsubscribeFirst = feed.subscribePackets(firstListener);
    await flushPromises();
    await vi.advanceTimersByTimeAsync(3_000);
    const unsubscribeLater = feed.subscribePackets(laterListener);

    expect(firstListener).toHaveBeenCalledTimes(1);
    expect(laterListener).not.toHaveBeenCalled();

    unsubscribeFirst();
    unsubscribeLater();
  });

  it('re-primes without replaying backlog after visibility resumes', async () => {
    vi.useFakeTimers();
    let visibilityListener = () => {};
    const visibility = {
      hidden: false,
      addEventListener: vi.fn((_type: string, listener: () => void) => {
        visibilityListener = listener;
      }),
      removeEventListener: vi.fn(),
    };
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        response({
          packets: [
            {import_time_us: 100, from_node_id: 10},
          ],
        }),
      )
      .mockResolvedValueOnce(
        response({
          packets: [
            {import_time_us: 200, from_node_id: 20},
          ],
        }),
      );
    vi.stubGlobal('fetch', fetcher);
    vi.stubGlobal('document', visibility);
    const feed = createPacketFeed();
    const listener = vi.fn();
    const unsubscribe = feed.subscribePackets(listener);
    await flushPromises();

    visibility.hidden = true;
    visibilityListener();
    await vi.advanceTimersByTimeAsync(3_000);
    expect(fetcher).toHaveBeenCalledTimes(1);

    visibility.hidden = false;
    visibilityListener();
    await flushPromises();

    expect(fetcher.mock.calls[1][0]).toContain('limit=1');
    expect(fetcher.mock.calls[1][0]).not.toContain('since=');
    expect(listener).not.toHaveBeenCalled();
    expect(feed.getSnapshot().latestImportTimeUs).toBe(200);

    unsubscribe();
  });

  it('allows only one request while a fetch is in flight', async () => {
    vi.useFakeTimers();
    let resolveRequest: (value: ReturnType<typeof response>) => void = () => {};
    const fetcher = vi.fn(
      () =>
        new Promise<ReturnType<typeof response>>((resolve) => {
          resolveRequest = resolve;
        }),
    );
    vi.stubGlobal('fetch', fetcher);
    const feed = createPacketFeed();
    const unsubscribeState = feed.subscribeState(() => {});
    const unsubscribePackets = feed.subscribePackets(() => {});

    await vi.advanceTimersByTimeAsync(9_000);
    expect(fetcher).toHaveBeenCalledTimes(1);

    resolveRequest(response({packets: [], latest_import_time: 100}));
    await flushPromises();
    unsubscribeState();
    unsubscribePackets();
  });

  // The in-flight guard above is what makes a stalled request dangerous: without
  // a deadline it would hold the flag forever and silence every later poll.
  it('gives up on a request that never settles and polls again', async () => {
    vi.useFakeTimers();
    const fetcher = vi
      .fn()
      .mockImplementationOnce(() => new Promise(() => {}))
      .mockResolvedValue(
        response({
          packets: [{import_time_us: 100, from_node_id: 5}],
          latest_import_time: 100,
        }),
      );
    vi.stubGlobal('fetch', fetcher);
    const feed = createPacketFeed();
    const unsubscribe = feed.subscribeState(() => {});

    // Polls during the stall find the guard closed, so nothing reaches the wire.
    await vi.advanceTimersByTimeAsync(9_000);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(feed.getSnapshot()).toMatchObject({isLoading: true});

    // Past the deadline the request is abandoned and reported, not swallowed.
    await vi.advanceTimersByTimeAsync(2_000);
    expect(feed.getSnapshot()).toMatchObject({
      isLoading: false,
      hasError: true,
    });

    // And the feed keeps polling, so it recovers on its own.
    await vi.advanceTimersByTimeAsync(6_000);
    expect(fetcher.mock.calls.length).toBeGreaterThan(1);
    expect(feed.getSnapshot()).toMatchObject({
      latestImportTimeUs: 100,
      isLoading: false,
      hasError: false,
    });

    unsubscribe();
  });

  it('recovers from a failed prime without publishing history', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({}),
      })
      .mockResolvedValueOnce(
        response({
          packets: [{import_time_us: 100, from_node_id: 10}],
          latest_import_time: 100,
        }),
      )
      .mockResolvedValueOnce(
        response({
          packets: [{import_time_us: 101, from_node_id: 20}],
          latest_import_time: 101,
        }),
      );
    vi.stubGlobal('fetch', fetcher);
    const feed = createPacketFeed();
    const packetListener = vi.fn();
    const unsubscribe = feed.subscribePackets(packetListener);
    await flushPromises();

    expect(feed.getSnapshot().hasError).toBe(true);
    await vi.advanceTimersByTimeAsync(3_000);
    expect(packetListener).not.toHaveBeenCalled();
    expect(feed.getSnapshot().hasError).toBe(false);

    await vi.advanceTimersByTimeAsync(3_000);
    expect(packetListener).toHaveBeenCalledWith([
      {import_time_us: 101, from_node_id: 20},
    ]);

    unsubscribe();
  });

  it('retains the last activity time while a poll is failing', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        response({
          packets: [
            {import_time_us: 100, from_node_id: 10},
          ],
        }),
      )
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({}),
      });
    vi.stubGlobal('fetch', fetcher);
    const feed = createPacketFeed();
    const unsubscribe = feed.subscribeState(() => {});
    await flushPromises();

    await vi.advanceTimersByTimeAsync(3_000);

    expect(feed.getSnapshot()).toMatchObject({
      latestImportTimeUs: 100,
      hasError: true,
    });

    unsubscribe();
  });
});

describe('feed status', () => {
  const nowMs = 10_000_000;
  const ago = (seconds: number) => (nowMs - seconds * 1_000) * 1_000;
  const snapshot = (latestImportTimeUs: number | null) => ({
    latestImportTimeUs,
    isLoading: false,
    hasError: false,
  });

  it('reports loading and error before any timing', () => {
    expect(
      getFeedStatus({latestImportTimeUs: null, isLoading: true, hasError: false}, nowMs),
    ).toEqual({kind: 'loading'});
    expect(
      getFeedStatus({latestImportTimeUs: ago(1), isLoading: false, hasError: true}, nowMs),
    ).toEqual({kind: 'error'});
  });

  it('moves from live to stale to waiting as the last packet ages', () => {
    expect(getFeedStatus(snapshot(null), nowMs)).toEqual({kind: 'waiting'});
    expect(getFeedStatus(snapshot(ago(0)), nowMs)).toEqual({kind: 'live', seconds: 0});
    expect(getFeedStatus(snapshot(ago(59)), nowMs)).toEqual({kind: 'live', seconds: 59});
    expect(getFeedStatus(snapshot(ago(60)), nowMs)).toEqual({kind: 'stale', minutes: 1});
    expect(getFeedStatus(snapshot(ago(150)), nowMs)).toEqual({kind: 'stale', minutes: 3});
    expect(getFeedStatus(snapshot(ago(3_600)), nowMs)).toEqual({kind: 'waiting'});
  });

  it('counts whole elapsed seconds while live', () => {
    const latest = snapshot(ago(0));
    expect(getFeedStatus(latest, nowMs)).toEqual({kind: 'live', seconds: 0});
    expect(getFeedStatus(latest, nowMs + 999)).toEqual({kind: 'live', seconds: 0});
    expect(getFeedStatus(latest, nowMs + 1_000)).toEqual({kind: 'live', seconds: 1});
    expect(getFeedStatus(latest, nowMs + 59_999)).toEqual({kind: 'live', seconds: 59});
    expect(getFeedStatus(latest, nowMs + 60_000)).toEqual({kind: 'stale', minutes: 1});
  });

  it('treats future timestamps from clock skew as live now', () => {
    expect(getFeedStatus(snapshot(ago(-30)), nowMs)).toEqual({kind: 'live', seconds: 0});
  });
});
