import {describe, expect, it} from 'vitest';

import {
  clampCameraTransform,
  FOCUS_ZOOM,
  FOCUS_ZOOM_NARROW,
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
  getNewestPositionedSender,
  getPulseEvents,
  OVERVIEW_CENTRE_X,
  projectMeshviewNodes,
} from './liveMap';

/**
 * The whole country has to rest in frame: a fixed overview zoom used to crop
 * Crete off the bottom and Thrace off the top of every desktop hero.
 */
function expectLandInFrame(
  camera: {scale: number; translateX: number; translateY: number},
  bounds: {x0: number; y0: number; x1: number; y1: number},
  size: {width: number; height: number},
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
        name: 'Athens',
        x: 23.6224512,
        y: 37.9682816,
        channel: 'LongFast',
      },
      {
        nodeId: 3,
        name: '!3',
        x: 23.6224512,
        y: 37.9682816,
        channel: 'Unknown',
      },
    ]);
  });
});

describe('packet-driven pulses', () => {
  it('uses the newest packet to retrigger each positioned sender', () => {
    expect(
      getPulseEvents(
        [
          {from_node_id: 10, import_time_us: 100},
          {from_node_id: 10, import_time_us: 104},
          {from_node_id: 20, import_time_us: 102},
          {from_node_id: 30, import_time_us: 108},
        ],
        new Set([10, 20]),
      ),
    ).toEqual([
      {nodeId: 10, revision: 104},
      {nodeId: 20, revision: 102},
    ]);
  });

  it('selects the newest positioned sender and ignores unusable packets', () => {
    expect(
      getNewestPositionedSender(
        [
          {from_node_id: 10, import_time_us: 100},
          {from_node_id: 30, import_time_us: 110},
          {from_node_id: 20, import_time_us: '108'},
          {from_node_id: 10, import_time_us: 106},
          {from_node_id: 'invalid', import_time_us: 120},
        ],
        new Set([10, 20]),
      ),
    ).toBe(20);
  });

  it('keeps packet ordering stable when timestamps tie', () => {
    expect(
      getNewestPositionedSender(
        [
          {from_node_id: 10, import_time_us: 100},
          {from_node_id: 20, import_time_us: 100},
        ],
        new Set([10, 20]),
      ),
    ).toBe(10);
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
    const radii = getMarkerRadii(FOCUS_ZOOM);

    expect(radii.node * FOCUS_ZOOM).toBeCloseTo(3.8);
    expect(radii.focusedNode * FOCUS_ZOOM).toBeCloseTo(5.2);
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
  const screen = (camera: {scale: number; translateX: number; translateY: number}, node: {x: number; y: number}) => ({
    x: node.x * camera.scale + camera.translateX,
    y: node.y * camera.scale + camera.translateY,
  });
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
    bounds: {x0: number; y0: number; x1: number; y1: number},
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
      expect(camera.scale).toBe(FOCUS_ZOOM);
      expect(point.x).toBeGreaterThanOrEqual(area.left - 1e-6);
      expect(point.x).toBeLessThanOrEqual(area.right + 1e-6);
      expect(point.y).toBeGreaterThanOrEqual(area.top - 1e-6);
      expect(point.y).toBeLessThanOrEqual(area.bottom + 1e-6);
    }
  });

  it('spans one vertical band on both layouts and leaves mobile targets alone', () => {
    // Vertical spans the same fixed share of the frame height on both layouts.
    const north = getAdaptiveCameraTarget({x: 720, y: desktopBounds.y0}, desktop, desktopBounds, desktopSafe, false);
    const south = getAdaptiveCameraTarget({x: 720, y: desktopBounds.y1}, desktop, desktopBounds, desktopSafe, false);
    expect(north.y).toBeCloseTo(desktop.height * 0.32);
    expect(south.y).toBeCloseTo(desktop.height * 0.68);
    for (const entry of CITIES) {
      const node = nodeAt(entry, desktopBounds);
      const eased = (t: number) => t * t * (3 - 2 * t);
      const t = (node.y - desktopBounds.y0) / (desktopBounds.y1 - desktopBounds.y0);
      const target = getAdaptiveCameraTarget(node, desktop, desktopBounds, desktopSafe, false);
      expect(target.y).toBeCloseTo(desktop.height * (0.32 + 0.36 * eased(t)));
    }

    const centre = getAdaptiveCameraTarget({x: 195, y: 144}, mobile, mobileBounds, mobileSafe, true);
    expect(centre.x).toBeCloseTo(195);
    expect(centre.y).toBeCloseTo(144);
    const corner = getAdaptiveCameraTarget({x: 0, y: 0}, mobile, mobileBounds, mobileSafe, true);
    expect(corner).toEqual({x: 390 * 0.32, y: 288 * 0.32});

    // Narrow targets are shares of the frame, so insets never move them.
    const otherInsets = {left: 240, right: 8, top: 4, bottom: 4};
    expect(getAdaptiveCameraTarget({x: 195, y: 144}, mobile, mobileBounds, otherInsets, true)).toEqual(centre);
  });

  it('keeps mobile focus positions and zoom unchanged', () => {
    for (const entry of CITIES) {
      const node = nodeAt(entry, mobileBounds);
      const camera = getFocusCamera(node, mobile, mobileBounds, mobileSafe, true);
      const point = screen(camera, node);
      expect(camera.scale).toBe(FOCUS_ZOOM_NARROW);
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
    const raw = getCameraTransform(node, {x: 1440, y: 512}, FOCUS_ZOOM);
    const clamped = clampCameraTransform(raw, node, desktop, bounds, {left: 0, right: 0, top: 0, bottom: 0});
    // Right/bottom edge of land may pull in no further than 22% slack.
    expect(1440 * FOCUS_ZOOM + clamped.translateX).toBeGreaterThanOrEqual(1440 * 0.78 - 1e-6);
    expect(512 * FOCUS_ZOOM + clamped.translateY).toBeGreaterThanOrEqual(512 * 0.78 - 1e-6);
  });

  it('lets marker safety win when the coverage clamp fights it', () => {
    // A copy inset past the land's own width leaves the two rules no overlap.
    const node = nodeAt(city('Corfu'), desktopBounds);
    const tightSafe = getSafeInsets(desktop, 1_400, false);
    const point = screen(getFocusCamera(node, desktop, desktopBounds, tightSafe, false), node);
    expect(point.x).toBeGreaterThanOrEqual(tightSafe.left - 1e-6);
    expect(point.x).toBeLessThanOrEqual(desktop.width - tightSafe.right + 1e-6);
  });

  it('reaches one camera per node however the focus was entered', () => {
    const focusOn = (name: string) =>
      getFocusCamera(nodeAt(city(name), desktopBounds), desktop, desktopBounds, desktopSafe, false);
    const overview = getOverviewCamera(desktopBounds, desktop, false);
    const atRhodes = focusOn('Rhodes');
    const atThessaloniki = focusOn('Thessaloniki');
    const atCorfu = focusOn('Corfu');
    const atAthens = focusOn('Athens');

    for (const [from, to] of [
      [overview, atAthens],
      [overview, atCorfu],
      [overview, atRhodes],
      [atCorfu, atRhodes],
      [atRhodes, atThessaloniki],
    ] as const) {
      const end = interpolateCamera(from, to, 1, desktop);
      expect(end.scale).toBeCloseTo(to.scale);
      expect(end.translateX).toBeCloseTo(to.translateX);
      expect(end.translateY).toBeCloseTo(to.translateY);
    }

    // Returning to overview lands back on the fixed resting camera.
    const returned = interpolateCamera(atRhodes, overview, 1, desktop);
    expect(returned.translateX).toBeCloseTo(overview.translateX);
    expect(returned.translateY).toBeCloseTo(overview.translateY);
  });
});

describe('land-based overview', () => {
  const desktop = {width: 1440, height: 560};
  const mobile = {width: 390, height: 288};
  const desktopBounds = {x0: 500, y0: 36, x1: 940, y1: 524};
  const mobileBounds = {x0: 16, y0: 20, x1: 374, y1: 268};
  const noInsets = {left: 0, right: 0, top: 0, bottom: 0};
  const landCentre = (bounds: {x0: number; y0: number; x1: number; y1: number}) => ({
    x: (bounds.x0 + bounds.x1) / 2,
    y: (bounds.y0 + bounds.y1) / 2,
  });
  const screen = (camera: {scale: number; translateX: number; translateY: number}, point: {x: number; y: number}) => ({
    x: point.x * camera.scale + camera.translateX,
    y: point.y * camera.scale + camera.translateY,
  });
  const nodeSets = [
    new Map<number, {x: number; y: number}>(),
    new Map([[1, {x: 520, y: 300}]]),
    new Map([
      [1, {x: 520, y: 300}],
      [2, {x: 900, y: 60}],
      [3, {x: 760, y: 510}],
    ]),
  ];
  // Mirrors the component: the focus is whatever the current node list holds.
  const cameraFor = (
    focusedNodeId: number | null,
    nodesById: ReadonlyMap<number, {x: number; y: number}>,
    size: {width: number; height: number},
    bounds: {x0: number; y0: number; x1: number; y1: number},
  ) =>
    getMapCamera(
      focusedNodeId === null ? null : nodesById.get(focusedNodeId) ?? null,
      size,
      bounds,
      noInsets,
      false,
    );

  it('ignores the node list: zero, one and many nodes share one overview', () => {
    const cameras = nodeSets.map((nodes) => cameraFor(null, nodes, desktop, desktopBounds));
    expect(cameras[1]).toEqual(cameras[0]);
    expect(cameras[2]).toEqual(cameras[0]);
    expect(cameras[0]).toEqual(getOverviewCamera(desktopBounds, desktop, false));
    expect(cameras[0]).not.toEqual(IDENTITY_CAMERA);
  });

  it('places the land centre at 68% / 50% on desktop', () => {
    const overview = getOverviewCamera(desktopBounds, desktop, false);
    expectLandInFrame(overview, desktopBounds, desktop);
    const point = screen(overview, landCentre(desktopBounds));
    expect(point.x).toBeCloseTo(1440 * OVERVIEW_CENTRE_X);
    expect(point.y).toBeCloseTo(560 * 0.5);
  });

  it('places the land centre at the frame centre on narrow maps', () => {
    const overview = getOverviewCamera(mobileBounds, mobile, true);
    expect(overview.scale).toBe(1);
    expect(screen(overview, landCentre(mobileBounds))).toEqual({x: 195, y: 144});
  });

  it('keeps the resting overview when nodes refresh', () => {
    const before = cameraFor(null, nodeSets[1], desktop, desktopBounds);
    const after = cameraFor(null, nodeSets[2], desktop, desktopBounds);
    expect(after).toEqual(before);
  });

  it('does not interrupt an active focus when nodes refresh', () => {
    const focused = cameraFor(1, nodeSets[1], desktop, desktopBounds);
    expect(focused.scale).toBe(FOCUS_ZOOM);

    const refreshed = cameraFor(1, new Map([...nodeSets[2]]), desktop, desktopBounds);
    expect(refreshed).toEqual(focused);
  });

  it('rests when a refresh drops the focused node', () => {
    const dropped = cameraFor(1, nodeSets[0], desktop, desktopBounds);
    expect(dropped).toEqual(getOverviewCamera(desktopBounds, desktop, false));
  });

  it('returns from focus to the fixed land-based overview', () => {
    const returned = cameraFor(null, nodeSets[2], desktop, desktopBounds);
    expect(returned).toEqual(getOverviewCamera(desktopBounds, desktop, false));
  });

  it('changes overview framing only at the narrow map band breakpoint', () => {
    expect(NARROW_MAP_QUERY).toBe('(max-width: 768px)');
    // Frames from the hero above 768px, including the old 996px tablet split.
    const heroFrames = [
      {size: {width: 997, height: 452}, bounds: {x0: 257.19, y0: 18.08, x1: 739.81, y1: 433.92}},
      {size: {width: 996, height: 452}, bounds: {x0: 256.69, y0: 18.08, x1: 739.31, y1: 433.92}},
      {size: {width: 769, height: 450}, bounds: {x0: 144.26, y0: 18, x1: 624.74, y1: 432}},
    ];
    for (const {size, bounds} of heroFrames) {
      const overview = getOverviewCamera(bounds, size, false);
      const point = screen(overview, landCentre(bounds));
      expectLandInFrame(overview, bounds, size);
      expect(point.x).toBeCloseTo(size.width * OVERVIEW_CENTRE_X);
      expect(point.y).toBeCloseTo(size.height * 0.5);
    }

    // 768px: the map becomes its own band and frames centred.
    const band = {width: 768, height: 288};
    const bandBounds = {x0: 235, y0: 16, x1: 533, y1: 272};
    const narrow = getOverviewCamera(bandBounds, band, true);
    expect(narrow.scale).toBe(1);
    expect(screen(narrow, landCentre(bandBounds))).toEqual({x: 384, y: 144});
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
  const athens = (bounds: {x0: number; y0: number; x1: number; y1: number}) => ({
    x: bounds.x0 + (bounds.x1 - bounds.x0) * 0.424,
    y: bounds.y0 + (bounds.y1 - bounds.y0) * 0.554,
  });
  const screen = (camera: {scale: number; translateX: number; translateY: number}, point: {x: number; y: number}) => ({
    x: point.x * camera.scale + camera.translateX,
    y: point.y * camera.scale + camera.translateY,
  });

  it('switches at 768px, so 769px is the last overlaid hero', () => {
    expect(NARROW_MAP_QUERY).toBe('(max-width: 768px)');
    const maxWidth = Number(/max-width:\s*(\d+)px/.exec(NARROW_MAP_QUERY)![1]);
    expect(768 <= maxWidth).toBe(true);
    expect(769 <= maxWidth).toBe(false);
  });

  it('uses the overlaid desktop model at 769px', () => {
    const {size, bounds} = overlaid;
    // Hero copy still covers the left of the frame at this width.
    const safe = getSafeInsets(size, 560, false);
    const area = getSafeArea(size, safe);
    const node = athens(bounds);

    const overview = getOverviewCamera(bounds, size, false);
    expectLandInFrame(overview, bounds, size);
    expect(screen(overview, {x: (bounds.x0 + bounds.x1) / 2, y: (bounds.y0 + bounds.y1) / 2}).x).toBeCloseTo(size.width * OVERVIEW_CENTRE_X);

    const target = getAdaptiveCameraTarget(node, size, bounds, safe, false);
    expect(target.x).toBeGreaterThanOrEqual(area.left - 1e-6);
    expect(target.x).toBeLessThanOrEqual(area.right + 1e-6);

    const camera = getFocusCamera(node, size, bounds, safe, false);
    expect(camera.scale).toBe(FOCUS_ZOOM);
    const point = screen(camera, node);
    expect(point.x).toBeGreaterThanOrEqual(area.left - 1e-6);
    expect(point.x).toBeLessThanOrEqual(area.right + 1e-6);
  });

  it('uses the separate centred map band at 768px', () => {
    const {size, bounds} = band;
    const safe = getSafeInsets(size, 560, true);
    expect(safe).toEqual({left: 56, right: 56, top: 56, bottom: 56});

    // Centred at scale 1, and the copy inset no longer applies.
    const overview = getOverviewCamera(bounds, size, true);
    expect(overview.scale).toBe(1);
    expect(screen(overview, {x: (bounds.x0 + bounds.x1) / 2, y: (bounds.y0 + bounds.y1) / 2})).toEqual({
      x: size.width / 2,
      y: size.height / 2,
    });

    const node = athens(bounds);
    const camera = getFocusCamera(node, size, bounds, safe, true);
    expect(camera.scale).toBe(FOCUS_ZOOM_NARROW);
    const point = screen(camera, node);
    expect(point.x).toBeGreaterThanOrEqual(56 - 1e-6);
    expect(point.x).toBeLessThanOrEqual(size.width - 56 + 1e-6);
    // Narrow targets stay shares of the frame, so they can sit left of centre.
    expect(getAdaptiveCameraTarget(node, size, bounds, safe, true).x).toBeCloseTo(
      size.width * (0.32 + 0.36 * (0.424 * 0.424 * (3 - 2 * 0.424))),
    );
  });
});

describe('camera interpolation', () => {
  const size = {width: 1000, height: 500};

  it('hits both endpoints', () => {
    const from = {scale: 1, translateX: 0, translateY: 0};
    const to = {scale: 3.1, translateX: -900, translateY: -300};
    expect(interpolateCamera(from, to, 0, size)).toEqual(from);
    const end = interpolateCamera(from, to, 1, size);
    expect(end.scale).toBeCloseTo(3.1);
    expect(end.translateX).toBeCloseTo(-900);
    expect(end.translateY).toBeCloseTo(-300);
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

  // Mirrors the component: snaps take ownership of the frame size, a finished
  // animation leaves the camera at its target.
  function createCamera(camera: typeof overviewTablet, size: typeof tablet) {
    const state = {camera, size, updates: [] as string[]};
    return {
      state,
      moveTo(target: typeof overviewTablet, nextSize: typeof tablet, reducedMotion = false) {
        const update = getCameraUpdate(state.camera, state.size, target, nextSize, reducedMotion);
        state.updates.push(update);
        if (update === 'snap') state.size = nextSize;
        if (update !== 'skip') state.camera = target;
        return update;
      },
    };
  }

  it('does not skip an equal rounded transform for a different frame size', () => {
    expect(getCameraUpdate(overviewTablet, tablet, overviewResized, resized, false)).toBe('snap');
    expect(getCameraUpdate(overviewTablet, tablet, overviewResized, resized, true)).toBe('snap');
  });

  it('skips an equal transform for the same frame size', () => {
    const remeasured = {width: 900, height: 450};
    expect(getCameraUpdate(overviewTablet, tablet, {...overviewTablet, translateX: 4.2}, remeasured, false)).toBe('skip');
    expect(getCameraUpdate(overviewTablet, tablet, overviewTablet, tablet, true)).toBe('skip');
  });

  it('animates the first focus after a resize instead of snapping', () => {
    const camera = createCamera(overviewTablet, tablet);
    expect(camera.moveTo(overviewResized, resized)).toBe('snap');
    expect(camera.state.size).toBe(resized);

    const focus = {scale: FOCUS_ZOOM, translateX: -900, translateY: -300};
    expect(camera.moveTo(focus, {width: 740, height: 450})).toBe('animate');
    expect(camera.moveTo(overviewResized, resized)).toBe('animate');
  });

  it('treats remeasured unchanged dimensions as the same frame', () => {
    const focus = {scale: FOCUS_ZOOM, translateX: -900, translateY: -300};
    const midTween = interpolateCamera(overviewTablet, focus, 0.4, tablet);
    const remeasured = {width: 900, height: 450};
    // Mid-tween: keeps animating toward the same target, never snaps.
    expect(getCameraUpdate(midTween, tablet, focus, remeasured, false)).toBe('animate');
    // At rest: nothing to do.
    expect(getCameraUpdate(focus, tablet, focus, remeasured, false)).toBe('skip');
    // Reduced motion still snaps changes and never animates.
    expect(getCameraUpdate(overviewTablet, tablet, focus, remeasured, true)).toBe('snap');
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
    const x = nextNode.x * reclamped.scale + reclamped.translateX;
    expect(x).toBeGreaterThanOrEqual(nextSafe.left - 1e-6);
    expect(x).toBeLessThanOrEqual(nextSize.width - nextSafe.right + 1e-6);
  });
});
