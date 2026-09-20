import {
  getPacketImportTimeUs,
  getPacketSenderNodeId,
} from '../../lib/packetFeed';
import {normalizeMeshviewCoordinate} from '../../lib/meshview';
import type {MeshviewNode, MeshviewPacket} from '../../lib/meshview';

export type ProjectedNode = {
  nodeId: number;
  name: string;
  x: number;
  y: number;
  channel: 'LongFast' | 'NarrowSlow' | 'Unknown';
};

export type CameraTransform = {
  scale: number;
  translateX: number;
  translateY: number;
};

export type CameraTarget = {
  x: number;
  y: number;
};

export type MarkerRadii = {
  node: number;
  focusedNode: number;
};

type ProjectPoint = (
  coordinates: readonly [number, number],
) => readonly [number, number] | null;

export function projectMeshviewNodes(
  nodes: readonly MeshviewNode[],
  project: ProjectPoint,
  width: number,
  height: number,
): ProjectedNode[] {
  const projected: ProjectedNode[] = [];

  for (const node of nodes) {
    // Number(null) is 0, which would pass for a real id, so check before coercing.
    const nodeId = node.node_id == null ? Number.NaN : Number(node.node_id);
    const latitude = normalizeMeshviewCoordinate(node.last_lat, 90);
    const longitude = normalizeMeshviewCoordinate(node.last_long, 180);

    if (!Number.isSafeInteger(nodeId) || latitude === null || longitude === null)
      continue;

    const point = project([longitude, latitude]);
    if (
      point === null ||
      !Number.isFinite(point[0]) ||
      !Number.isFinite(point[1]) ||
      point[0] < 0 ||
      point[0] > width ||
      point[1] < 0 ||
      point[1] > height
    ) {
      continue;
    }

    projected.push({
      nodeId,
      name: node.long_name || node.short_name || `!${nodeId.toString(16)}`,
      x: point[0],
      y: point[1],
      channel:
        node.channel === 'LongFast' || node.channel === 'NarrowSlow'
          ? node.channel
          : 'Unknown',
    });
  }

  return projected;
}

export function getPulseEvents(
  packets: readonly MeshviewPacket[],
  positionedNodeIds: ReadonlySet<number>,
): {nodeId: number; revision: number}[] {
  const revisions = new Map<number, number>();

  for (const packet of packets) {
    const nodeId = getPacketSenderNodeId(packet);
    const packetTime = getPacketImportTimeUs(packet);
    if (
      nodeId !== null &&
      positionedNodeIds.has(nodeId) &&
      packetTime !== null
    ) {
      revisions.set(nodeId, Math.max(revisions.get(nodeId) ?? 0, packetTime));
    }
  }

  return [...revisions].map(([nodeId, revision]) => ({nodeId, revision}));
}

export function getNewestPositionedSender(
  packets: readonly MeshviewPacket[],
  positionedNodeIds: ReadonlySet<number>,
): number | null {
  let newestNodeId: number | null = null;
  let newestImportTimeUs = -Infinity;

  for (const packet of packets) {
    const nodeId = getPacketSenderNodeId(packet);
    const importTimeUs = getPacketImportTimeUs(packet);
    if (
      nodeId !== null &&
      importTimeUs !== null &&
      positionedNodeIds.has(nodeId) &&
      importTimeUs > newestImportTimeUs
    ) {
      newestNodeId = nodeId;
      newestImportTimeUs = importTimeUs;
    }
  }

  return newestNodeId;
}

export function getCameraTransform(
  node: Pick<ProjectedNode, 'x' | 'y'>,
  target: CameraTarget,
  scale: number,
): CameraTransform {
  return {
    scale,
    translateX: target.x - node.x * scale,
    translateY: target.y - node.y * scale,
  };
}

export type MapSize = {width: number; height: number};

/** Projected bounding box of the drawn land. */
export type MapBounds = {x0: number; y0: number; x1: number; y1: number};

export type SafeInsets = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

/** Matches the hero's stacked-layout breakpoint in index.module.css. */
export const NARROW_MAP_QUERY = '(max-width: 768px)';
/** Where the desktop overview puts the land centre, clear of the hero copy. */
export const OVERVIEW_CENTRE_X = 0.68;
/** Sea kept between the land and the frame edge at rest. */
const OVERVIEW_MARGIN = 16;
export const FOCUS_ZOOM = 3.1;
export const FOCUS_ZOOM_NARROW = 2.2;
const LAND_SLACK = 0.22;
/** Focused markers use the central half of the usable band. */
const BAND_MIN = 0.25;
const BAND_MAX = 0.75;
/** ...and the central third of the frame itself, on both axes. */
const FRAME_MIN = 0.32;
const FRAME_MAX = 0.68;

export const IDENTITY_CAMERA: CameraTransform = {
  scale: 1,
  translateX: 0,
  translateY: 0,
};

function normalizeWithin(value: number, min: number, max: number) {
  if (!(max > min)) return 0.5;
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

function smoothstep(t: number) {
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/** Marker-safe area in frame coordinates; the one usable band both the
 * adaptive target and the clamp are measured against. */
export function getSafeArea(size: MapSize, safe: SafeInsets) {
  return {
    left: safe.left,
    right: size.width - safe.right,
    top: safe.top,
    bottom: size.height - safe.bottom,
  };
}

/**
 * Screen point for a focused node, interpolated from where the node sits
 * inside the land bounds: western/northern nodes land further left/up so the
 * geography to their east/south stays in frame.
 *
 * The narrow band spans the whole frame, so its x is a share of the width.
 * The overlaid desktop hero does not: the copy covers the left of the frame,
 * so x spans the central half of the usable band instead, which keeps focused
 * markers off the copy without collapsing them onto one point.
 */
export function getAdaptiveCameraTarget(
  node: Pick<ProjectedNode, 'x' | 'y'>,
  size: MapSize,
  bounds: MapBounds,
  safe: SafeInsets,
  isNarrow: boolean,
): CameraTarget {
  const area = getSafeArea(size, safe);
  const eastward = smoothstep(normalizeWithin(node.x, bounds.x0, bounds.x1));
  return {
    x: isNarrow
      ? size.width * lerp(FRAME_MIN, FRAME_MAX, eastward)
      : lerp(area.left, area.right, lerp(BAND_MIN, BAND_MAX, eastward)),
    y:
      size.height *
      lerp(FRAME_MIN, FRAME_MAX, smoothstep(normalizeWithin(node.y, bounds.y0, bounds.y1))),
  };
}

function clampAxis(
  translate: number,
  scale: number,
  landStart: number,
  landEnd: number,
  extent: number,
  nodePosition: number,
  safeMin: number,
  safeMax: number,
) {
  const slack = extent * LAND_SLACK;
  // Soft rule: land covers the frame, with at most `slack` of empty sea.
  const coverLo = extent - slack - landEnd * scale;
  const coverHi = slack - landStart * scale;
  // Hard rule: the marker stays inside the safe area.
  const markerLo = safeMin - nodePosition * scale;
  const markerHi = safeMax - nodePosition * scale;
  let lo = Math.max(coverLo, markerLo);
  let hi = Math.min(coverHi, markerHi);
  // Edge nodes cannot satisfy both; marker safety wins.
  if (lo > hi) {
    lo = markerLo;
    hi = markerHi;
  }
  if (lo > hi) return translate;
  return Math.min(hi, Math.max(lo, translate));
}

export function clampCameraTransform(
  transform: CameraTransform,
  node: Pick<ProjectedNode, 'x' | 'y'>,
  size: MapSize,
  bounds: MapBounds,
  safe: SafeInsets,
): CameraTransform {
  const {scale} = transform;
  const area = getSafeArea(size, safe);
  return {
    scale,
    translateX: clampAxis(
      transform.translateX,
      scale,
      bounds.x0,
      bounds.x1,
      size.width,
      node.x,
      area.left,
      area.right,
    ),
    translateY: clampAxis(
      transform.translateY,
      scale,
      bounds.y0,
      bounds.y1,
      size.height,
      node.y,
      area.top,
      area.bottom,
    ),
  };
}

/**
 * Marker-safe area. On desktop the left inset clears the hero copy, whose
 * right edge (relative to the map frame) is passed in when known.
 */
export function getSafeInsets(
  size: MapSize,
  copyRight: number | null,
  isNarrow: boolean,
): SafeInsets {
  if (isNarrow) {
    return {left: 56, right: 56, top: 56, bottom: 56};
  }

  const left = Math.max(size.width * 0.5, copyRight === null ? 0 : copyRight + 32);
  return {left: Math.min(left, size.width - 160), right: 72, top: 72, bottom: 72};
}

export function getFocusCamera(
  node: Pick<ProjectedNode, 'x' | 'y'>,
  size: MapSize,
  bounds: MapBounds,
  safe: SafeInsets,
  isNarrow: boolean,
): CameraTransform {
  const target = getAdaptiveCameraTarget(node, size, bounds, safe, isNarrow);
  const scale = isNarrow ? FOCUS_ZOOM_NARROW : FOCUS_ZOOM;
  return clampCameraTransform(
    getCameraTransform(node, target, scale),
    node,
    size,
    bounds,
    safe,
  );
}

/**
 * Resting camera, derived only from the projected land bounds and frame size
 * so it never moves when the live node list loads or refreshes.
 *
 * The desktop zoom is whatever still leaves the whole country in frame. Greece
 * is much squarer than the overlaid hero, so the land runs out of vertical room
 * well before horizontal: a fixed zoom cropped Crete off the bottom of every
 * desktop frame, and Thrace off the top.
 */
export function getOverviewCamera(
  bounds: MapBounds,
  size: MapSize,
  isNarrow: boolean,
): CameraTransform {
  const centre = {x: (bounds.x0 + bounds.x1) / 2, y: (bounds.y0 + bounds.y1) / 2};

  // Every hero above the narrow breakpoint shares the shifted desktop framing;
  // the narrow layout gives the map its own band, so it frames centred at the
  // scale the projection already fitted to that band.
  if (isNarrow) {
    return getCameraTransform(centre, {x: size.width / 2, y: size.height / 2}, 1);
  }

  const target = {x: size.width * OVERVIEW_CENTRE_X, y: size.height / 2};
  const halfWidth = (bounds.x1 - bounds.x0) / 2;
  const halfHeight = (bounds.y1 - bounds.y0) / 2;
  // Land bounds arrive from a fetched topology, so a malformed file must not
  // reach the camera as a NaN scale.
  if (!(halfWidth > 0) || !(halfHeight > 0)) {
    return getCameraTransform(centre, target, 1);
  }

  // The land straddles the target, so only the shorter side of each axis counts.
  const roomX = Math.min(target.x, size.width - target.x) - OVERVIEW_MARGIN;
  const roomY = Math.min(target.y, size.height - target.y) - OVERVIEW_MARGIN;
  return getCameraTransform(
    centre,
    target,
    Math.min(roomX / halfWidth, roomY / halfHeight),
  );
}

export function getMapCamera(
  focus: Pick<ProjectedNode, 'x' | 'y'> | null,
  size: MapSize,
  bounds: MapBounds,
  safe: SafeInsets,
  isNarrow: boolean,
): CameraTransform {
  return focus === null
    ? getOverviewCamera(bounds, size, isNarrow)
    : getFocusCamera(focus, size, bounds, safe, isNarrow);
}

export type CameraUpdate = 'skip' | 'snap' | 'animate';

/** Equal once rounded to what the screen can actually show. */
function isSameCamera(a: CameraTransform, b: CameraTransform) {
  return (
    Math.abs(a.scale - b.scale) < 0.0005 &&
    Math.round(a.translateX) === Math.round(b.translateX) &&
    Math.round(a.translateY) === Math.round(b.translateY)
  );
}

function isSameSize(a: MapSize | null, b: MapSize) {
  return a !== null && a.width === b.width && a.height === b.height;
}

/**
 * How the camera reaches `target`. `from` and `fromSize` are the current
 * camera and the frame size it was calculated for. A frame-size change always
 * snaps so the camera takes ownership of the new size, even when the target
 * rounds to the same pixels; otherwise the next move would snap too.
 */
export function getCameraUpdate(
  from: CameraTransform | null,
  fromSize: MapSize | null,
  target: CameraTransform,
  size: MapSize,
  prefersReducedMotion: boolean,
): CameraUpdate {
  const sameSize = isSameSize(fromSize, size);
  if (from !== null && sameSize && isSameCamera(from, target)) {
    return 'skip';
  }

  // First placement, a resize (coordinates changed) and reduced motion snap.
  return from === null || !sameSize || prefersReducedMotion ? 'snap' : 'animate';
}

/**
 * Zoom-invariant interpolation: the frame centre's map point moves linearly
 * and scale moves in log space, so same-zoom moves read as a pan.
 */
export function interpolateCamera(
  from: CameraTransform,
  to: CameraTransform,
  t: number,
  size: MapSize,
): CameraTransform {
  const cx = size.width / 2;
  const cy = size.height / 2;
  const fx0 = (cx - from.translateX) / from.scale;
  const fy0 = (cy - from.translateY) / from.scale;
  const fx1 = (cx - to.translateX) / to.scale;
  const fy1 = (cy - to.translateY) / to.scale;
  const scale = Math.exp(lerp(Math.log(from.scale), Math.log(to.scale), t));
  return {
    scale,
    translateX: cx - lerp(fx0, fx1, t) * scale,
    translateY: cy - lerp(fy0, fy1, t) * scale,
  };
}

export function getMarkerRadii(cameraScale: number): MarkerRadii {
  const scale =
    Number.isFinite(cameraScale) && cameraScale > 0
      ? Math.max(1, cameraScale)
      : 1;

  return {
    node: Math.min(3.2, 3.8 / scale),
    focusedNode: Math.min(4, 5.2 / scale),
  };
}
