import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import type {RefObject} from 'react';
import useBaseUrl from '@docusaurus/useBaseUrl';
import {geoMercator, geoPath} from 'd3-geo';
import * as topojson from 'topojson-client';
import type {GeometryCollection, Topology} from 'topojson-specification';

import {meshviewPacketFeed} from '@site/src/lib/packetFeed';
import {fetchJson, getMeshviewApiUrl} from '@site/src/lib/meshview';
import type {
  MeshviewNode,
  MeshviewPacket,
  NodesResponse,
  PacketsResponse,
} from '@site/src/lib/meshview';
import {
  getCameraUpdate,
  getMapCamera,
  getMarkerRadii,
  getNewestPositionedPacket,
  getSafeInsets,
  IDENTITY_CAMERA,
  interpolateCamera,
  NARROW_MAP_QUERY,
  projectMeshviewNodes,
  retainFocusedNode,
} from './liveMap';
import type {
  CameraTransform,
  MapBounds,
  MapSize,
  ProjectedNode,
} from './liveMap';
import mapStyles from './styles.module.css';

const DAYS_ACTIVE = 1;
const NODE_REFRESH_INTERVAL_MS = 60_000;
const INITIAL_FOCUS_TIMEOUT_MS = 10_000;
const PAN_DURATION_MS = 950;
const ZOOM_DURATION_MS = 1_400;
const DEFAULT_MAP_SIZE = {width: 1080, height: 640};
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

type NutsProperties = {id: string};

type MapGeometry = {
  landPath: string;
  borderPath: string;
  bounds: MapBounds;
  project: (coordinates: readonly [number, number]) => [number, number] | null;
};

function buildGeometry(
  topology: Topology,
  width: number,
  height: number,
): MapGeometry {
  const collection = topology.objects
    .nuts3 as GeometryCollection<NutsProperties>;
  const featureCollection = topojson.feature(topology, collection);
  const padding = Math.max(16, Math.min(36, width * 0.04, height * 0.04));
  const projection = geoMercator().fitExtent(
    [
      [padding, padding],
      [width - padding, height - padding],
    ],
    featureCollection as never,
  );
  const path = geoPath(projection);
  const [[x0, y0], [x1, y1]] = path.bounds(featureCollection as never);

  return {
    landPath: path(featureCollection as never) ?? '',
    borderPath: path(topojson.mesh(topology, collection)) ?? '',
    bounds: {x0, y0, x1, y1},
    project: (coordinates) => projection([...coordinates]),
  };
}

function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(query);
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function channelClass(channel: ProjectedNode['channel']) {
  if (channel === 'NarrowSlow') return mapStyles.narrowSlow;
  if (channel === 'LongFast') return mapStyles.longFast;
  return mapStyles.unknown;
}

type Props = {
  /** Hero copy column; on desktop the focused marker stays clear of it. */
  copyRef?: RefObject<HTMLElement | null>;
};

export default function HomepageLiveMap({copyRef}: Props) {
  const topologyUrl = useBaseUrl('/data/greece-nuts3.topo.json');
  const mapFrameRef = useRef<HTMLDivElement>(null);
  const [mapSize, setMapSize] = useState<MapSize>(DEFAULT_MAP_SIZE);
  const [topology, setTopology] = useState<Topology | null>(null);
  const [rawNodes, setRawNodes] = useState<MeshviewNode[]>([]);
  const [initialFocusReady, setInitialFocusReady] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);
  const [focusedNodeId, setFocusedNodeId] = useState<number | null>(null);
  const [camera, setCamera] = useState<CameraTransform>(IDENTITY_CAMERA);
  const positionedNodeIdsRef = useRef<ReadonlySet<number>>(new Set());
  const latestFocusedTimeRef = useRef(-Infinity);
  const focusedNodeIdRef = useRef<number | null>(null);
  const cameraRef = useRef<CameraTransform | null>(null);
  const cameraSizeRef = useRef<MapSize | null>(null);
  const prefersReducedMotion = useMediaQuery(REDUCED_MOTION_QUERY);
  const isNarrow = useMediaQuery(NARROW_MAP_QUERY);

  useEffect(() => {
    const frame = mapFrameRef.current;
    if (frame === null || typeof ResizeObserver === 'undefined') return;

    function updateSize(width: number, height: number) {
      if (width < 64 || height < 64) return;
      const nextWidth = Math.round(width);
      const nextHeight = Math.round(height);
      setMapSize((current) =>
        current.width === nextWidth && current.height === nextHeight
          ? current
          : {width: nextWidth, height: nextHeight},
      );
    }

    // ResizeObserver delivers an initial observation, so there is nothing to
    // measure by hand here: the map cannot paint before the topology lands.
    const observer = new ResizeObserver(([entry]) => {
      if (entry !== undefined) {
        updateSize(entry.contentRect.width, entry.contentRect.height);
      }
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const abortController = new AbortController();

    async function loadTopology() {
      try {
        const response = await fetch(topologyUrl, {
          headers: {accept: 'application/json'},
          signal: abortController.signal,
        });
        if (!response.ok) {
          throw new Error(`Topology request failed with status ${response.status}`);
        }

        setTopology((await response.json()) as Topology);
      } catch (error) {
        if ((error as {name?: string}).name !== 'AbortError') {
          console.error(error);
        }
      }
    }

    void loadTopology();
    return () => abortController.abort();
  }, [topologyUrl]);

  useEffect(() => {
    const abortController = new AbortController();

    async function refreshNodes() {
      if (document.hidden) return;

      try {
        const data = await fetchJson<NodesResponse>(
          getMeshviewApiUrl('nodes', {days_active: DAYS_ACTIVE}),
          abortController.signal,
        );
        setRawNodes((current) =>
          retainFocusedNode(
            Array.isArray(data.nodes) ? data.nodes : [],
            current,
            focusedNodeIdRef.current,
          ),
        );
      } catch (error) {
        if ((error as {name?: string}).name !== 'AbortError') {
          console.error(error);
        }
      }
    }

    void refreshNodes();
    const refreshInterval = window.setInterval(() => {
      void refreshNodes();
    }, NODE_REFRESH_INTERVAL_MS);

    return () => {
      abortController.abort();
      window.clearInterval(refreshInterval);
    };
  }, []);

  const geometry = useMemo(
    () =>
      topology === null
        ? null
        : buildGeometry(topology, mapSize.width, mapSize.height),
    [mapSize.height, mapSize.width, topology],
  );
  const nodes = useMemo(
    () =>
      geometry === null
        ? []
        : projectMeshviewNodes(
            rawNodes,
            geometry.project,
            mapSize.width,
            mapSize.height,
          ),
    [geometry, mapSize.height, mapSize.width, rawNodes],
  );
  const nodesById = useMemo(
    () => new Map(nodes.map((node) => [node.nodeId, node])),
    [nodes],
  );

  useEffect(() => {
    positionedNodeIdsRef.current = new Set(nodes.map((node) => node.nodeId));
  }, [nodes]);

  const handlePackets = useCallback((packets: readonly MeshviewPacket[]) => {
    const newest = getNewestPositionedPacket(
      packets,
      positionedNodeIdsRef.current,
    );
    if (newest === null || newest.importTimeUs <= latestFocusedTimeRef.current)
      return;

    latestFocusedTimeRef.current = newest.importTimeUs;
    focusedNodeIdRef.current = newest.nodeId;
    setFocusedNodeId(newest.nodeId);
  }, []);

  useEffect(
    () => meshviewPacketFeed.subscribePackets(handlePackets),
    [handlePackets],
  );

  useEffect(() => {
    function onVisibilityChange() {
      if (!document.hidden) setFocusRequest((request) => request + 1);
    }
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  const hasMapData = nodes.length > 0;
  useEffect(() => {
    const controller = new AbortController();
    // Show the overview if either the node list or initial history stalls.
    const timeoutId = window.setTimeout(() => {
      controller.abort();
      setInitialFocusReady(true);
    }, INITIAL_FOCUS_TIMEOUT_MS);

    async function loadInitialFocus() {
      try {
        // shortcut: scan the latest 1,000 packets; use a server-side location filter if this window becomes insufficient.
        const data = await fetchJson<PacketsResponse>(
          getMeshviewApiUrl('packets', {limit: 1000}),
          controller.signal,
        );
        if (!controller.signal.aborted) {
          handlePackets(Array.isArray(data.packets) ? data.packets : []);
        }
      } catch (error) {
        if ((error as {name?: string}).name !== 'AbortError') {
          console.error(error);
        }
      } finally {
        window.clearTimeout(timeoutId);
        if (!controller.signal.aborted) setInitialFocusReady(true);
      }
    }

    // Start the loading deadline even while waiting for nodes and topology.
    if (hasMapData) void loadInitialFocus();
    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [focusRequest, handlePackets, hasMapData]);

  const focusedNode =
    focusedNodeId === null ? undefined : nodesById.get(focusedNodeId);
  const focusX = focusedNode?.x;
  const focusY = focusedNode?.y;

  // Paint the first map frame at its final focus, without an overview flash.
  useLayoutEffect(() => {
    if (geometry === null || (!initialFocusReady && focusedNodeId === null))
      return;

    const focus =
      focusX === undefined || focusY === undefined ? null : {x: focusX, y: focusY};

    let copyRight: number | null = null;
    const copy = copyRef?.current;
    const frame = mapFrameRef.current;
    if (!isNarrow && copy && frame) {
      const copyBox = copy.getBoundingClientRect();
      if (copyBox.width > 0) {
        copyRight = copyBox.right - frame.getBoundingClientRect().left;
      }
    }

    const target = getMapCamera(
      focus,
      mapSize,
      geometry.bounds,
      getSafeInsets(mapSize, copyRight, isNarrow),
      isNarrow,
    );
    const from = cameraRef.current;
    const update = getCameraUpdate(
      from,
      cameraSizeRef.current,
      target,
      mapSize,
      prefersReducedMotion,
    );
    if (update === 'skip') return;

    if (update === 'snap' || from === null) {
      cameraRef.current = target;
      cameraSizeRef.current = mapSize;
      setCamera(target);
      return;
    }

    const duration =
      Math.abs(target.scale - from.scale) < 0.01
        ? PAN_DURATION_MS
        : ZOOM_DURATION_MS;
    const startMs = performance.now();
    let frameId = requestAnimationFrame(function step(nowMs) {
      const t = Math.min(1, Math.max(0, (nowMs - startMs) / duration));
      const next = interpolateCamera(from, target, easeInOutCubic(t), mapSize);
      cameraRef.current = next;
      setCamera(next);
      if (t < 1) frameId = requestAnimationFrame(step);
    });

    return () => cancelAnimationFrame(frameId);
  }, [
    copyRef,
    focusX,
    focusY,
    focusedNodeId,
    geometry,
    initialFocusReady,
    isNarrow,
    mapSize,
    prefersReducedMotion,
  ]);

  const markerRadii = getMarkerRadii(camera.scale);
  const viewportTransform = `matrix(${camera.scale}, 0, 0, ${camera.scale}, ${camera.translateX}, ${camera.translateY})`;

  return (
    <div className={mapStyles.shell}>
      <div className={mapStyles.mapFrame} ref={mapFrameRef}>
        {geometry !== null && (initialFocusReady || focusedNode !== undefined) && (
          <svg
            aria-hidden="true"
            className={mapStyles.map}
            focusable="false"
            viewBox={`0 0 ${mapSize.width} ${mapSize.height}`}>
            <g transform={viewportTransform}>
              <path className={mapStyles.land} d={geometry.landPath} />
              <path className={mapStyles.borders} d={geometry.borderPath} />
              {nodes.map((node) => (
                <circle
                  className={`${mapStyles.node} ${channelClass(node.channel)} ${node.nodeId === focusedNodeId ? mapStyles.focusedNode : ''}`}
                  cx={node.x}
                  cy={node.y}
                  key={node.nodeId}
                  r={
                    node.nodeId === focusedNodeId
                      ? markerRadii.focusedNode
                      : markerRadii.node
                  }
                />
              ))}
              {focusedNode !== undefined && !prefersReducedMotion && (
                <circle
                  className={`${mapStyles.pulse} ${channelClass(focusedNode.channel)}`}
                  cx={focusedNode.x}
                  cy={focusedNode.y}
                  key={focusedNode.nodeId}
                  r={markerRadii.focusedNode}
                />
              )}
            </g>
          </svg>
        )}
      </div>
      <div className={mapStyles.scrim} />
    </div>
  );
}
