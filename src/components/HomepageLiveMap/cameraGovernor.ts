export const CAMERA_TIMING = {
  followMs: 5_500,
  idleMs: 9_000,
  maxFocusMs: 20_000,
  cooldownMs: 5_000,
};

export type CameraTiming = typeof CAMERA_TIMING;

/**
 * Decides when live packets may move the camera. Pulses and status are never
 * gated by this; it only rate-limits and time-boxes focus.
 *
 * - idle timer: returns to overview after a quiet period; refreshed by every
 *   eligible packet during a session.
 * - max-focus timer: armed once per session, never refreshed; forces overview
 *   and starts the cooldown.
 * - cooldown: while active, packets start no session and arm no timers.
 */
export function createCameraGovernor(
  onFocusChange: (nodeId: number | null) => void,
  timing: CameraTiming = CAMERA_TIMING,
) {
  let focusedNodeId: number | null = null;
  let sessionActive = false;
  let cooldownActive = false;
  let lastMoveAt = 0;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  let maxFocusTimer: ReturnType<typeof setTimeout> | undefined;
  let cooldownTimer: ReturnType<typeof setTimeout> | undefined;

  function setFocus(nodeId: number | null) {
    if (focusedNodeId === nodeId) return;
    focusedNodeId = nodeId;
    onFocusChange(nodeId);
  }

  function endSession() {
    sessionActive = false;
    clearTimeout(idleTimer);
    clearTimeout(maxFocusTimer);
    idleTimer = undefined;
    maxFocusTimer = undefined;
    setFocus(null);
  }

  function armIdleReturn() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (sessionActive) endSession();
    }, timing.idleMs);
  }

  function beginSession() {
    sessionActive = true;
    clearTimeout(maxFocusTimer);
    maxFocusTimer = setTimeout(() => {
      if (!sessionActive) return;
      endSession();
      cooldownActive = true;
      cooldownTimer = setTimeout(() => {
        cooldownActive = false;
        cooldownTimer = undefined;
      }, timing.cooldownMs);
    }, timing.maxFocusMs);
  }

  return {
    /** Call for each eligible (positioned) packet sender. */
    consider(nodeId: number) {
      if (cooldownActive) return;

      if (sessionActive) {
        armIdleReturn();
        // Same node: no camera move. Throttled: nothing is queued.
        if (
          nodeId === focusedNodeId ||
          Date.now() - lastMoveAt < timing.followMs
        ) {
          return;
        }
      } else {
        beginSession();
        armIdleReturn();
      }

      lastMoveAt = Date.now();
      setFocus(nodeId);
    },

    getFocusedNodeId: () => focusedNodeId,

    /** Clears every timer; stale callbacks cannot affect a new governor. */
    dispose() {
      sessionActive = false;
      cooldownActive = false;
      clearTimeout(idleTimer);
      clearTimeout(maxFocusTimer);
      clearTimeout(cooldownTimer);
      idleTimer = maxFocusTimer = cooldownTimer = undefined;
    },
  };
}

export type CameraGovernor = ReturnType<typeof createCameraGovernor>;
