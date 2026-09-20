import {
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
import {getMeshviewApiUrl} from '@site/src/lib/meshview';
import type {MeshviewNode, MeshviewPacket} from '@site/src/lib/meshview';
import {createCameraGovernor} from './cameraGovernor';
import type {CameraGovernor} from './cameraGovernor';
import {
  getCameraUpdate,
  getMapCamera,
  getMarkerRadii,
  getNewestPositionedSender,
  getPulseEvents,
  getSafeInsets,
  IDENTITY_CAMERA,
  interpolateCamera,
  NARROW_MAP_QUERY,
  projectMeshviewNodes,
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
  const [focusedNodeId, setFocusedNodeId] = useState<number | null>(null);
  const [camera, setCamera] = useState<CameraTransform>(IDENTITY_CAMERA);
  const [pulseRevisions, setPulseRevisions] = useState<
    Readonly<Record<number, number>>
  >({});
  const positionedNodeIdsRef = useRef<ReadonlySet<number>>(new Set());
  const governorRef = useRef<CameraGovernor | null>(null);
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
        const response = await fetch(
          getMeshviewApiUrl('nodes', {days_active: DAYS_ACTIVE}),
          {
            cache: 'no-store',
            headers: {accept: 'application/json'},
            signal: abortController.signal,
          },
        );
        if (!response.ok) {
          throw new Error(`Nodes request failed with status ${response.status}`);
        }

        const data = (await response.json()) as {nodes?: MeshviewNode[]};
        setRawNodes(Array.isArray(data.nodes) ? data.nodes : []);
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

  // Reduced motion: no governor, so no automatic movement and no camera timers.
  useEffect(() => {
    if (prefersReducedMotion) {
      setFocusedNodeId(null);
      return;
    }

    const governor = createCameraGovernor(setFocusedNodeId);
    governorRef.current = governor;
    return () => {
      governor.dispose();
      governorRef.current = null;
    };
  }, [prefersReducedMotion]);

  // Reduced motion gets no pulses at all, rather than a ring that appears and
  // vanishes without the animation that explains it.
  useEffect(() => {
    function handlePackets(packets: readonly MeshviewPacket[]) {
      const newestSenderNodeId = getNewestPositionedSender(
        packets,
        positionedNodeIdsRef.current,
      );

      if (newestSenderNodeId !== null) {
        governorRef.current?.consider(newestSenderNodeId);
      }

      if (prefersReducedMotion) return;

      const pulseEvents = getPulseEvents(packets, positionedNodeIdsRef.current);
      if (pulseEvents.length === 0) return;

      setPulseRevisions((current) => {
        const next = {...current};
        for (const {nodeId, revision} of pulseEvents) next[nodeId] = revision;
        return next;
      });
    }

    return meshviewPacketFeed.subscribePackets(handlePackets);
  }, [prefersReducedMotion]);

  // The keyframe owns the pulse's lifetime; this only drops the finished entry.
  function removePulse(nodeId: number, revision: number) {
    setPulseRevisions((current) => {
      if (current[nodeId] !== revision) return current;
      const next = {...current};
      delete next[nodeId];
      return next;
    });
  }

  const focusedNode =
    focusedNodeId === null ? undefined : nodesById.get(focusedNodeId);
  const focusX = focusedNode?.x;
  const focusY = focusedNode?.y;

  // Layout effect: the first frame containing the SVG is painted with the
  // final overview. Node refreshes only reach this through the focused
  // node's coordinates, so they never move the overview.
  useLayoutEffect(() => {
    if (geometry === null) return;

    // A refresh that drops the focused node leaves nothing to point at, so the
    // camera rests rather than holding a zoom on an empty frame.
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
  }, [copyRef, focusX, focusY, geometry, isNarrow, mapSize, prefersReducedMotion]);

  const markerRadii = getMarkerRadii(camera.scale);
  const viewportTransform = `matrix(${camera.scale}, 0, 0, ${camera.scale}, ${camera.translateX}, ${camera.translateY})`;

  return (
    <div className={mapStyles.shell}>
      <div className={mapStyles.mapFrame} ref={mapFrameRef}>
        {geometry !== null && (
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
              {Object.entries(pulseRevisions).map(([nodeId, revision]) => {
                const node = nodesById.get(Number(nodeId));
                if (node === undefined) return null;
                return (
                  <circle
                    className={`${mapStyles.pulse} ${channelClass(node.channel)}`}
                    cx={node.x}
                    cy={node.y}
                    key={`${nodeId}-${revision}`}
                    onAnimationEnd={() => removePulse(Number(nodeId), revision)}
                    r={markerRadii.focusedNode}
                  />
                );
              })}
            </g>
          </svg>
        )}
      </div>
      <div className={mapStyles.scrim} />
    </div>
  );
}
