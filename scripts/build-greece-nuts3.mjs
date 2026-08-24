// Extracts the Greek subset of the Eurostat NUTS 2024 level 3 topology so the
// site ships a few tens of KB instead of a Europe-wide file from a CDN.
//
// Usage: npm run nuts:update
import {mkdir, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const SOURCE_URL =
  'https://cdn.jsdelivr.net/gh/eurostat/Nuts2json@master/pub/v2/2024/4326/03M/3.json';
const NUTS_ID_PREFIX = 'EL';
const EXPECTED_UNIT_COUNT = 52;

const outputPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../static/data/greece-nuts3.topo.json',
);

// Arc references are indexes into topology.arcs, where ~index means "this arc,
// reversed". Both encodings have to survive the remap to the filtered array.
function remapArcs(arcs, arcIndexMap) {
  if (typeof arcs[0] === 'number') {
    return arcs.map((arcIndex) => {
      const isReversed = arcIndex < 0;
      const mapped = arcIndexMap.get(isReversed ? ~arcIndex : arcIndex);

      if (mapped === undefined) {
        throw new Error(`Unmapped arc index ${arcIndex}`);
      }

      return isReversed ? ~mapped : mapped;
    });
  }

  return arcs.map((nested) => remapArcs(nested, arcIndexMap));
}

function collectArcIndexes(arcs, into) {
  if (typeof arcs[0] === 'number') {
    for (const arcIndex of arcs) {
      into.add(arcIndex < 0 ? ~arcIndex : arcIndex);
    }
    return;
  }

  for (const nested of arcs) {
    collectArcIndexes(nested, into);
  }
}

// Quantized arcs are delta encoded from their own absolute first point, so each
// arc can be lifted out of the source topology on its own.
function computeBoundingBox(arcs, transform) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const arc of arcs) {
    let x = 0;
    let y = 0;

    for (const [deltaX, deltaY] of arc) {
      x += deltaX;
      y += deltaY;

      const longitude = x * transform.scale[0] + transform.translate[0];
      const latitude = y * transform.scale[1] + transform.translate[1];

      minX = Math.min(minX, longitude);
      minY = Math.min(minY, latitude);
      maxX = Math.max(maxX, longitude);
      maxY = Math.max(maxY, latitude);
    }
  }

  return [minX, minY, maxX, maxY];
}

const response = await fetch(SOURCE_URL);

if (!response.ok) {
  throw new Error(`NUTS download failed with status ${response.status}`);
}

const topology = await response.json();
const geometries = topology.objects.nutsrg.geometries.filter((geometry) =>
  String(geometry.properties?.id ?? '').startsWith(NUTS_ID_PREFIX),
);

if (geometries.length !== EXPECTED_UNIT_COUNT) {
  throw new Error(
    `Expected ${EXPECTED_UNIT_COUNT} ${NUTS_ID_PREFIX} units, found ${geometries.length}`,
  );
}

const usedArcIndexes = new Set();
for (const geometry of geometries) {
  collectArcIndexes(geometry.arcs, usedArcIndexes);
}

const sortedArcIndexes = [...usedArcIndexes].sort((a, b) => a - b);
const arcIndexMap = new Map(
  sortedArcIndexes.map((arcIndex, position) => [arcIndex, position]),
);
const arcs = sortedArcIndexes.map((arcIndex) => topology.arcs[arcIndex]);

const greeceTopology = {
  type: 'Topology',
  bbox: computeBoundingBox(arcs, topology.transform),
  transform: topology.transform,
  objects: {
    nuts3: {
      type: 'GeometryCollection',
      geometries: geometries
        .map((geometry) => ({
          type: geometry.type,
          arcs: remapArcs(geometry.arcs, arcIndexMap),
          // Only the fields the map actually reads; `na` stays as the fallback
          // label for ids missing a Greek override.
          properties: {id: geometry.properties.id, na: geometry.properties.na},
        }))
        .sort((a, b) => a.properties.id.localeCompare(b.properties.id)),
    },
  },
  arcs,
};

await mkdir(dirname(outputPath), {recursive: true});
await writeFile(outputPath, `${JSON.stringify(greeceTopology)}\n`);

console.log(
  `Wrote ${geometries.length} units and ${arcs.length} arcs to ${outputPath}`,
);
