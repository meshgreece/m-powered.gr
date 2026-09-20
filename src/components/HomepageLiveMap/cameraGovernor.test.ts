import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {CAMERA_TIMING, createCameraGovernor} from './cameraGovernor';

function setup() {
  const changes: (number | null)[] = [];
  const governor = createCameraGovernor((nodeId) => changes.push(nodeId));
  return {governor, changes};
}

describe('camera governor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('ships the approved defaults', () => {
    expect(CAMERA_TIMING).toEqual({
      followMs: 5_500,
      idleMs: 9_000,
      maxFocusMs: 20_000,
      cooldownMs: 5_000,
    });
  });

  it('focuses the first packet and returns to overview after the idle period', () => {
    const {governor, changes} = setup();
    governor.consider(1);
    expect(changes).toEqual([1]);

    vi.advanceTimersByTime(8_999);
    expect(governor.getFocusedNodeId()).toBe(1);
    vi.advanceTimersByTime(1);
    expect(changes).toEqual([1, null]);
  });

  it('does not move for same-node packets but refreshes the idle timer', () => {
    const {governor, changes} = setup();
    governor.consider(1);
    vi.advanceTimersByTime(8_000);
    governor.consider(1);
    vi.advanceTimersByTime(8_000);
    expect(changes).toEqual([1]);
    vi.advanceTimersByTime(1_000);
    expect(changes).toEqual([1, null]);
  });

  it('throttles moves without queueing and refreshes the idle timer', () => {
    const {governor, changes} = setup();
    governor.consider(1);
    vi.advanceTimersByTime(1_000);
    governor.consider(2);
    governor.consider(3);
    // t = 9500: past the original idle deadline and the follow window, yet
    // throttled packets refreshed idle and nothing queued a move.
    vi.advanceTimersByTime(8_500);
    expect(changes).toEqual([1]);
    vi.advanceTimersByTime(500);
    expect(changes).toEqual([1, null]);
  });

  it('moves node to node once the follow window has elapsed', () => {
    const {governor, changes} = setup();
    governor.consider(1);
    vi.advanceTimersByTime(5_500);
    governor.consider(2);
    expect(changes).toEqual([1, 2]);
  });

  it('caps a session at max focus, never refreshed, then cools down', () => {
    const {governor, changes} = setup();
    governor.consider(1);
    for (const nodeId of [2, 3, 4]) {
      vi.advanceTimersByTime(6_000);
      governor.consider(nodeId);
    }
    // t = 18000: every packet moved the camera and refreshed idle.
    expect(changes).toEqual([1, 2, 3, 4]);

    vi.advanceTimersByTime(2_000); // t = 20000
    expect(governor.getFocusedNodeId()).toBeNull();
    const changesAtOverview = changes.length;

    governor.consider(3);
    vi.advanceTimersByTime(4_999);
    governor.consider(4);
    expect(changes.length).toBe(changesAtOverview);

    vi.advanceTimersByTime(1);
    governor.consider(5);
    expect(governor.getFocusedNodeId()).toBe(5);
  });

  it('starts a fresh max-focus timer for each new session', () => {
    const {governor} = setup();
    governor.consider(1);
    vi.advanceTimersByTime(9_000); // idle return
    expect(governor.getFocusedNodeId()).toBeNull();

    vi.advanceTimersByTime(1_000); // t = 10000
    governor.consider(2);
    // First session's ceiling (t = 20000) must not end the second session.
    vi.advanceTimersByTime(8_000);
    governor.consider(2);
    vi.advanceTimersByTime(2_500);
    expect(governor.getFocusedNodeId()).toBe(2);
  });

  it('dispose clears timers so stale callbacks do nothing', () => {
    const {governor, changes} = setup();
    governor.consider(1);
    governor.dispose();
    vi.advanceTimersByTime(60_000);
    expect(changes).toEqual([1]);
    expect(vi.getTimerCount()).toBe(0);
  });
});
