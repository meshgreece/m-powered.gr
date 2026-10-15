import {describe, expect, it} from 'vitest';

import {
  clampCameraTransform,
  getAdaptiveCameraTarget,
  getCameraTransform,
  getCameraUpdate,
  getFocusCamera,
  getMapCamera,
  getOverviewCamera,
  getSafeArea,
  getSafeInsets,
  IDENTITY_CAMERA,
  NARROW_MAP_QUERY,
  interpolateCamera,
  getMarkerRadii,
  getNewestPositionedPacket,
  projectMeshviewNodes,
  retainFocusedNode,
} from './liveMap';
import type {CameraTransform, MapBounds, MapSize} from './liveMap';

function screen(camera: CameraTransform, point: {x: number; y: number}) {
  return {
    x: point.x * camera.scale + camera.translateX,
    y: point.y * camera.scale + camera.translateY,
  };
}

function landCentre(bounds: MapBounds) {
  return {x: (bounds.x0 + bounds.x1) / 2, y: (bounds.y0 + bounds.y1) / 2};
}

/**
 * The whole country has to rest in frame: a fixed overview zoom used to crop
 * Crete off the bottom and Thrace off the top of every desktop hero.
 */
function expectLandInFrame(
  camera: CameraTransform,
  bounds: MapBounds,
  size: MapSize,
) {
  expect(bounds.x0 * camera.scale + camera.translateX).toBeGreaterThanOrEqual(0);
  expect(bounds.y0 * camera.scale + camera.translateY).toBeGreaterThanOrEqual(0);
  expect(bounds.x1 * camera.scale + camera.translateX).toBeLessThanOrEqual(size.width);
  expect(bounds.y1 * camera.scale + camera.translateY).toBeLessThanOrEqual(size.height);
}

describe('Meshview node coordinates', () => {
  it('keeps only valid nodes that project inside the viewbox', () => {
    const nodes = projectMeshviewNodes(
      [
        {
          node_id: 1,
          long_name: 'Athens',
          last_lat: 379682816,
          last_long: 236224512,
          channel: 'LongFast',
        },
        {
          node_id: 2,
          last_lat: null,
          last_long: 236224512,
          channel: 'NarrowSlow',
        },
        {
          node_id: 3,
          last_lat: 379682816,
          last_long: 236224512,
          channel: 'SomethingElse',
        },
        // No id at all: must not coerce to node 0.
        {
          node_id: null,
          last_lat: 379682816,
          last_long: 236224512,
        },
      ],
      ([longitude, latitude]) =>
        longitude > 23.63 ? [900, 900] : [longitude, latitude],
      640,
      560,
    );

    expect(nodes).toEqual([
      {
        nodeId: 1,
        x: 23.6224512,
        y: 37.9682816,
        channel: 'LongFast',
      },
      {
        nodeId: 3,
        x: 23.6224512,
        y: 37.9682816,
        channel: 'Unknown',
      },
    ]);
  });
});

describe('focused node retention', () => {
  const focused = {node_id: 10, last_lat: 379682816, last_long: 236224512};
  const other = {node_id: 20, last_lat: 406400000, last_long: 229400000};

  it('retains the last valid location when a refresh omits the focused node', () => {
    expect(retainFocusedNode([other], [focused, other], 10)).toEqual([other, focused]);
  });

  it('retains the last valid location when a refresh loses its coordinates', () => {
    expect(retainFocusedNode([{...focused, last_lat: null}, other], [focused, other], 10))
      .toEqual([other, focused]);
  });

  it('accepts a valid location update for the focused node', () => {
    const updated = {...focused, last_lat: 379700000};
    expect(retainFocusedNode([updated, other], [focused, other], 10))
      .toEqual([updated, other]);
  });

  it('keeps ordinary refreshes unchanged when there is no focus', () => {
    expect(retainFocusedNode([other], [focused, other], null)).toEqual([other]);
  });
});

describe('latest positioned packet', () => {
  it('selects the newest located sender and retains its timestamp', () => {
    expect(
      getNewestPositionedPacket(
        [
          {from_node_id: 10, import_time_us: 100},
          {from_node_id: 30, import_time_us: 110},
          {from_node_id: 20, import_time_us: '108'},
          {from_node_id: 10, import_time_us: 106},
          {from_node_id: 'invalid', import_time_us: 120},
          {from_node_id: 20, import_time_us: 'invalid'},
        ],
        new Set([10, 20]),
      ),
    ).toEqual({nodeId: 20, importTimeUs: 108});
  });

  it('keeps packet ordering stable when timestamps tie', () => {
    expect(
      getNewestPositionedPacket(
        [
          {from_node_id: 10, import_time_us: 100},
          {from_node_id: 20, import_time_us: 100},
        ],
        new Set([10, 20]),
      ),
    ).toEqual({nodeId: 10, importTimeUs: 100});
  });

  it('returns no focus for an empty history or unlocated senders', () => {
    expect(getNewestPositionedPacket([], new Set([10]))).toBeNull();
    expect(getNewestPositionedPacket([
      {from_node_id: 20, import_time_us: 110},
    ], new Set([10]))).toBeNull();
  });
});

describe('packet camera', () => {
  it('places a projected node at the requested target and scale', () => {
    expect(getCameraTransform({x: 100, y: 200}, {x: 680, y: 300}, 2.35)).toEqual({
      scale: 2.35,
      translateX: 445,
      translateY: -170,
    });
  });
});

describe('screen-space marker sizing', () => {
  it('preserves the overview marker sizes at 1x', () => {
    expect(getMarkerRadii(1)).toEqual({node: 3.2, focusedNode: 4});
  });

  it('keeps markers compact at the packet focus zoom', () => {
    const radii = getMarkerRadii(3.1);

    expect(radii.node * 3.1).toBeCloseTo(3.8);
    expect(radii.focusedNode * 3.1).toBeCloseTo(5.2);
    expect(radii.focusedNode).toBeGreaterThan(radii.node);
  });

  it('falls back to overview sizes for invalid scales', () => {
    expect(getMarkerRadii(0)).toEqual(getMarkerRadii(1));
    expect(getMarkerRadii(Number.NaN)).toEqual(getMarkerRadii(1));
  });
});

describe('adaptive focus framing', () => {
  // Frame sizes and projected land bounds measured from the built hero.
  const desktop = {width: 1440, height: 512};
  const mobile = {width: 390, height: 288};
  const desktopBounds = {x0: 447, y0: 20, x1: 993, y1: 492};
  const mobileBounds = {x0: 46, y0: 16, x1: 344, y1: 272};
  // 1440px hero: the copy column ends 660px into the map frame.
  const desktopSafe = getSafeInsets(desktop, 660, false);
  const mobileSafe = getSafeInsets(mobile, null, true);
  const area = getSafeArea(desktop, desktopSafe);
  // Where each city sits inside the projected land bounds, west to east.
  const CITIES = [
    {name: 'Corfu', easting: 0.053, southing: 0.317},
    {name: 'Thessaloniki', easting: 0.348, southing: 0.166},
    {name: 'Athens', easting: 0.424, southing: 0.554},
    {name: 'Crete', easting: 0.562, southing: 0.927},
    {name: 'Alexandroupoli', easting: 0.633, southing: 0.135},
    {name: 'Mytilene', easting: 0.699, southing: 0.392},
    {name: 'Rhodes', easting: 0.861, southing: 0.775},
  ];
  const nodeAt = (
    {easting, southing}: {easting: number; southing: number},
    bounds: MapBounds,
  ) => ({
    x: bounds.x0 + (bounds.x1 - bounds.x0) * easting,
    y: bounds.y0 + (bounds.y1 - bounds.y0) * southing,
  });
  const city = (name: string) => CITIES.find((entry) => entry.name === name)!;
  const bandShare = (x: number) => (x - area.left) / (area.right - area.left);
  const targetFor = (name: string) =>
    getAdaptiveCameraTarget(nodeAt(city(name), desktopBounds), desktop, desktopBounds, desktopSafe, false);

  it('measures the desktop target inside the usable band, not the full hero', () => {
    for (const entry of CITIES) {
      const target = getAdaptiveCameraTarget(nodeAt(entry, desktopBounds), desktop, desktopBounds, desktopSafe, false);
      expect(target.x).toBeGreaterThanOrEqual(area.left - 1e-6);
      expect(target.x).toBeLessThanOrEqual(area.right + 1e-6);
    }

    // The band, not the frame: a wider copy inset moves every target right.
    const widerSafe = getSafeInsets(desktop, 900, false);
    const athens = nodeAt(city('Athens'), desktopBounds);
    expect(getAdaptiveCameraTarget(athens, desktop, desktopBounds, widerSafe, false).x).toBeGreaterThan(targetFor('Athens').x);
  });

  it('spans the central 25-75% of the band and preserves west-to-east order', () => {
    const shares = CITIES.map((entry) => bandShare(getAdaptiveCameraTarget(nodeAt(entry, desktopBounds), desktop, desktopBounds, desktopSafe, false).x));

    for (const share of shares) {
      expect(share).toBeGreaterThanOrEqual(0.25 - 1e-9);
      expect(share).toBeLessThanOrEqual(0.75 + 1e-9);
    }
    // Western nodes stay left of eastern ones, and no two collapse onto one point.
    for (let index = 1; index < shares.length; index += 1) {
      expect(shares[index]).toBeGreaterThan(shares[index - 1]);
    }
    // The extremes reach out towards the ends of the central half.
    expect(shares[0]).toBeCloseTo(0.25, 2);
    expect(shares[shares.length - 1]).toBeCloseTo(0.72, 2);
    // Rhodes keeps more than a fifth of the band clear of the right inset.
    expect(1 - shares[shares.length - 1]).toBeGreaterThan(0.2);
    // Common Attica traffic no longer reads as a centre zoom of the whole hero.
    expect(bandShare(targetFor('Athens').x)).toBeGreaterThan(0.4);
    expect(targetFor('Athens').x / desktop.width).toBeGreaterThan(0.68);
  });

  it('frames Corfu, Athens and Rhodes in the central half of the band', () => {
    const framed = ['Corfu', 'Athens', 'Rhodes'].map((name) => {
      const node = nodeAt(city(name), desktopBounds);
      const camera = getFocusCamera(node, desktop, desktopBounds, desktopSafe, false);
      return {name, target: bandShare(targetFor(name).x), final: bandShare(screen(camera, node).x)};
    });

    for (const {target, final} of framed) {
      expect(target).toBeGreaterThanOrEqual(0.25 - 1e-9);
      expect(target).toBeLessThanOrEqual(0.75 + 1e-9);
      // None of the three needs clamping away from its band position.
      expect(final).toBeCloseTo(target, 6);
    }
    expect(framed[0].final).toBeLessThan(framed[1].final);
    expect(framed[1].final).toBeLessThan(framed[2].final);
  });

  it('keeps every desktop city clear of the copy and of the right inset', () => {
    for (const entry of CITIES) {
      const node = nodeAt(entry, desktopBounds);
      const camera = getFocusCamera(node, desktop, desktopBounds, desktopSafe, false);
      const point = screen(camera, node);
      expect(camera.scale).toBe(3.1);
      expect(point.x).toBeGreaterThanOrEqual(area.left - 1e-6);
      expect(point.x).toBeLessThanOrEqual(area.right + 1e-6);
      expect(point.y).toBeGreaterThanOrEqual(area.top - 1e-6);
      expect(point.y).toBeLessThanOrEqual(area.bottom + 1e-6);
    }
  });

  it('spans one vertical band on both layouts and leaves mobile targets alone', () => {
    for (const [y, expectedY] of [[20, 163.84], [138, 192.64], [256, 256], [374, 319.36], [492, 348.16]]) {
      const target = getAdaptiveCameraTarget({x: 720, y}, desktop, desktopBounds, desktopSafe, false);
      expect(target.y).toBeCloseTo(expectedY);
    }

    const centre = getAdaptiveCameraTarget({x: 195, y: 144}, mobile, mobileBounds, mobileSafe, true);
    expect(centre.x).toBeCloseTo(195);
    expect(centre.y).toBeCloseTo(144);
    const corner = getAdaptiveCameraTarget({x: 0, y: 0}, mobile, mobileBounds, mobileSafe, true);
    expect(corner).toEqual({x: 124.8, y: 92.16});
    const southEast = getAdaptiveCameraTarget({x: 390, y: 288}, mobile, mobileBounds, mobileSafe, true);
    expect(southEast.x).toBeCloseTo(265.2);
    expect(southEast.y).toBeCloseTo(195.84);

    // Narrow targets are shares of the frame, so insets never move them.
    const otherInsets = {left: 240, right: 8, top: 4, bottom: 4};
    expect(getAdaptiveCameraTarget({x: 195, y: 144}, mobile, mobileBounds, otherInsets, true)).toEqual(centre);
  });

  it('keeps mobile focus positions and zoom unchanged', () => {
    for (const entry of CITIES) {
      const node = nodeAt(entry, mobileBounds);
      const camera = getFocusCamera(node, mobile, mobileBounds, mobileSafe, true);
      const point = screen(camera, node);
      expect(camera.scale).toBe(2.2);
      expect(point.x).toBeGreaterThanOrEqual(56 - 1e-6);
      expect(point.x).toBeLessThanOrEqual(mobile.width - 56 + 1e-6);
      expect(point.y).toBeGreaterThanOrEqual(56 - 1e-6);
      expect(point.y).toBeLessThanOrEqual(mobile.height - 56 + 1e-6);
    }

    const southWest = {x: mobileBounds.x0, y: mobileBounds.y1};
    const camera = getFocusCamera(southWest, mobile, mobileBounds, mobileSafe, true);
    expect(screen(camera, southWest).x).toBeGreaterThanOrEqual(56 - 1e-6);
    expect(screen(camera, southWest).y).toBeLessThanOrEqual(288 - 56 + 1e-6);
  });

  it('clears the hero copy on desktop and uses fixed insets on narrow maps', () => {
    expect(getSafeInsets(desktop, null, false).left).toBe(720);
    expect(getSafeInsets(desktop, 760, false).left).toBe(792);
    expect(getSafeInsets(desktop, 1_400, false).left).toBe(1_280);
    expect(getSafeInsets(mobile, 300, true)).toEqual({left: 56, right: 56, top: 56, bottom: 56});
    // Targeting and clamping read this one band.
    expect(area).toEqual({left: 720, right: 1_368, top: 72, bottom: 440});
  });

  it('softly clamps central nodes so land keeps covering the frame', () => {
    const node = {x: 720, y: 256};
    const bounds = {x0: 0, y0: 0, x1: 1440, y1: 512};
    const raw = getCameraTransform(node, {x: 1440, y: 512}, 3.1);
    const clamped = clampCameraTransform(raw, node, desktop, bounds, {left: 0, right: 0, top: 0, bottom: 0});
    // Right/bottom edge of land may pull in no further than 22% slack.
    expect(1440 * 3.1 + clamped.translateX).toBeGreaterThanOrEqual(1440 * 0.78 - 1e-6);
    expect(512 * 3.1 + clamped.translateY).toBeGreaterThanOrEqual(512 * 0.78 - 1e-6);
  });

  it('lets marker safety win when the coverage clamp fights it', () => {
    // A copy inset past the land's own width leaves the two rules no overlap.
    const node = nodeAt(city('Corfu'), desktopBounds);
    const tightSafe = getSafeInsets(desktop, 1_400, false);
    const point = screen(getFocusCamera(node, desktop, desktopBounds, tightSafe, false), node);
    expect(point.x).toBeGreaterThanOrEqual(tightSafe.left - 1e-6);
    expect(point.x).toBeLessThanOrEqual(desktop.width - tightSafe.right + 1e-6);
  });
});

describe('land-based overview', () => {
  const desktop = {width: 1440, height: 560};
  const desktopBounds = {x0: 500, y0: 36, x1: 940, y1: 524};
  const noInsets = {left: 0, right: 0, top: 0, bottom: 0};

  it('dispatches a missing focus to the overview', () => {
    const camera = getMapCamera(null, desktop, desktopBounds, noInsets, false);
    expect(camera).toEqual(getOverviewCamera(desktopBounds, desktop, false));
    expect(camera).not.toEqual(IDENTITY_CAMERA);
  });

  it('dispatches a positioned focus to the focus camera', () => {
    const node = {x: 520, y: 300};
    expect(getMapCamera(node, desktop, desktopBounds, noInsets, false))
      .toEqual(getFocusCamera(node, desktop, desktopBounds, noInsets, false));
  });

  // Measured hero frames, including both sides of the old 996px tablet split.
  it.each([
    {size: desktop, bounds: desktopBounds, narrow: false, centreShare: 0.68},
    {size: {width: 997, height: 452}, bounds: {x0: 257.19, y0: 18.08, x1: 739.81, y1: 433.92}, narrow: false, centreShare: 0.68},
    {size: {width: 996, height: 452}, bounds: {x0: 256.69, y0: 18.08, x1: 739.31, y1: 433.92}, narrow: false, centreShare: 0.68},
    {size: {width: 769, height: 450}, bounds: {x0: 144.26, y0: 18, x1: 624.74, y1: 432}, narrow: false, centreShare: 0.68},
    {size: {width: 768, height: 288}, bounds: {x0: 235, y0: 16, x1: 533, y1: 272}, narrow: true, centreShare: 0.5},
    {size: {width: 390, height: 288}, bounds: {x0: 16, y0: 20, x1: 374, y1: 268}, narrow: true, centreShare: 0.5},
  ])('frames all land at $size.width px', ({size, bounds, narrow, centreShare}) => {
    const overview = getOverviewCamera(bounds, size, narrow);
    expectLandInFrame(overview, bounds, size);
    const point = screen(overview, landCentre(bounds));
    expect(point.x).toBeCloseTo(size.width * centreShare);
    expect(point.y).toBeCloseTo(size.height * 0.5);
    if (narrow) expect(overview.scale).toBe(1);
  });

  it('recomputes the overview for a resized frame and its land bounds', () => {
    const resized = {width: 1024, height: 520};
    const resizedBounds = {x0: 380, y0: 34, x1: 700, y1: 486};
    const overview = getOverviewCamera(resizedBounds, resized, false);
    expect(overview).not.toEqual(getOverviewCamera(desktopBounds, desktop, false));
    const point = screen(overview, landCentre(resizedBounds));
    expect(point.x).toBeCloseTo(1024 * 0.68);
    expect(point.y).toBeCloseTo(520 * 0.5);
  });
});

describe('hero map band breakpoint', () => {
  // Frames measured either side of the 768px switch, with their land bounds.
  const overlaid = {size: {width: 769, height: 450}, bounds: {x0: 144, y0: 18, x1: 625, y1: 432}};
  const band = {size: {width: 768, height: 288}, bounds: {x0: 235, y0: 16, x1: 533, y1: 272}};
  const athens = (bounds: MapBounds) => ({
    x: bounds.x0 + (bounds.x1 - bounds.x0) * 0.424,
    y: bounds.y0 + (bounds.y1 - bounds.y0) * 0.554,
  });
  it('switches to the separate map band at 768px', () => {
    expect(NARROW_MAP_QUERY).toBe('(max-width: 768px)');
  });

  it('uses the overlaid desktop model at 769px', () => {
    const {size, bounds} = overlaid;
    // Hero copy still covers the left of the frame at this width.
    const safe = getSafeInsets(size, 560, false);
    const area = getSafeArea(size, safe);
    const node = athens(bounds);

    const target = getAdaptiveCameraTarget(node, size, bounds, safe, false);
    expect(target.x).toBeGreaterThanOrEqual(area.left - 1e-6);
    expect(target.x).toBeLessThanOrEqual(area.right + 1e-6);

    const camera = getFocusCamera(node, size, bounds, safe, false);
    expect(camera.scale).toBe(3.1);
    const point = screen(camera, node);
    expect(point.x).toBeGreaterThanOrEqual(area.left - 1e-6);
    expect(point.x).toBeLessThanOrEqual(area.right + 1e-6);
  });

  it('uses the separate centred map band at 768px', () => {
    const {size, bounds} = band;
    const safe = getSafeInsets(size, 560, true);
    expect(safe).toEqual({left: 56, right: 56, top: 56, bottom: 56});

    const node = athens(bounds);
    const camera = getFocusCamera(node, size, bounds, safe, true);
    expect(camera.scale).toBe(2.2);
    const point = screen(camera, node);
    expect(point.x).toBeGreaterThanOrEqual(56 - 1e-6);
    expect(point.x).toBeLessThanOrEqual(size.width - 56 + 1e-6);
    // Narrow targets stay shares of the frame, so they can sit left of centre.
    expect(getAdaptiveCameraTarget(node, size, bounds, safe, true).x).toBeLessThan(size.width / 2);
  });
});

describe('camera interpolation', () => {
  const size = {width: 1000, height: 500};

  const overview = {scale: 1, translateX: 0, translateY: 0};
  const focused = {scale: 3.1, translateX: -900, translateY: -300};

  it.each([
    {direction: 'in', from: overview, to: focused},
    {direction: 'out', from: focused, to: overview},
  ])('hits both endpoints when zooming $direction', ({from, to}) => {
    for (const [t, expected] of [[0, from], [1, to]] as const) {
      const camera = interpolateCamera(from, to, t, size);
      expect(camera.scale).toBeCloseTo(expected.scale);
      expect(camera.translateX).toBeCloseTo(expected.translateX);
      expect(camera.translateY).toBeCloseTo(expected.translateY);
    }
  });

  it('pans without zooming between two same-scale focus cameras', () => {
    const from = {scale: 3.1, translateX: -100, translateY: 0};
    const to = {scale: 3.1, translateX: -700, translateY: -200};
    const mid = interpolateCamera(from, to, 0.5, size);
    expect(mid.scale).toBeCloseTo(3.1);
    expect(mid.translateX).toBeCloseTo(-400);
    expect(mid.translateY).toBeCloseTo(-100);
  });
});

describe('camera updates', () => {
  const tablet = {width: 900, height: 450};
  const resized = {width: 740, height: 450};
  // Overview cameras that differ by under a pixel, as after a return tween.
  const overviewTablet = {scale: 1.35, translateX: 4.4999999, translateY: -78.75};
  const overviewResized = {scale: 1.35, translateX: 3.7, translateY: -78.75};

  const focus = {scale: 3.1, translateX: -900, translateY: -300};
  const roundedEqual = {...overviewTablet, translateX: 4.2};
  const remeasured = {width: 900, height: 450};
  const midTween = interpolateCamera(overviewTablet, focus, 0.4, tablet);

  it.each([
    // Scenario, from, fromSize, target, size, reduced motion, decision.
    ['first placement', null, null, overviewTablet, tablet, false, 'snap'],
    ['resize before rounded equality', overviewTablet, tablet, overviewResized, resized, false, 'snap'],
    ['resize with reduced motion', overviewTablet, tablet, overviewResized, resized, true, 'snap'],
    ['rounded-equal transform', overviewTablet, tablet, roundedEqual, remeasured, false, 'skip'],
    ['equal transform with reduced motion', overviewTablet, tablet, overviewTablet, tablet, true, 'skip'],
    ['focus after resize', overviewResized, resized, focus, {width: 740, height: 450}, false, 'animate'],
    ['return from focus', focus, resized, overviewResized, resized, false, 'animate'],
    ['remeasure during animation', midTween, tablet, focus, remeasured, false, 'animate'],
    ['remeasure at rest', focus, tablet, focus, remeasured, false, 'skip'],
    ['focus with reduced motion', overviewTablet, tablet, focus, remeasured, true, 'snap'],
  ] as const)('%s', (_scenario, from, fromSize, target, size, reducedMotion, expected) => {
    expect(getCameraUpdate(from, fromSize, target, size, reducedMotion)).toBe(expected);
  });

  it('re-clamps an active focus after a resize', () => {
    const node = {x: 500, y: 300};
    const bounds = {x0: 500, y0: 36, x1: 940, y1: 524};
    const size = {width: 1440, height: 560};
    const safe = getSafeInsets(size, 760, false);
    const focused = getFocusCamera(node, size, bounds, safe, false);

    // Projection is refitted for the smaller frame.
    const k = 1280 / 1440;
    const nextSize = {width: 1280, height: 560};
    const nextNode = {x: node.x * k, y: node.y};
    const nextBounds = {x0: bounds.x0 * k, y0: bounds.y0, x1: bounds.x1 * k, y1: bounds.y1};
    const nextSafe = getSafeInsets(nextSize, 760, false);
    const reclamped = getMapCamera(nextNode, nextSize, nextBounds, nextSafe, false);

    expect(reclamped).toEqual(getFocusCamera(nextNode, nextSize, nextBounds, nextSafe, false));
    expect(getCameraUpdate(focused, size, reclamped, nextSize, false)).toBe('snap');
    const point = screen(reclamped, nextNode);
    expect(point.x).toBeGreaterThanOrEqual(nextSafe.left - 1e-6);
    expect(point.x).toBeLessThanOrEqual(nextSize.width - nextSafe.right + 1e-6);
  });
});
