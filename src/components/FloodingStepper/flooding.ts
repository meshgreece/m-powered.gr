export const NODE_IDS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;
export type NodeId = (typeof NODE_IDS)[number];

export const HOP_LIMITS = [1, 2, 3, 4, 5, 6, 7] as const;
export const DEFAULT_HOP_LIMIT = 3;

const ORIGIN: NodeId = 'A';

// "far" listeners hear the transmitter with low SNR, so they wait less before repeating.
export const RANGE: Record<NodeId, {far: readonly NodeId[]; near: readonly NodeId[]}> = {
  A: {far: ['C'], near: ['B']},
  B: {far: [], near: ['A', 'C']},
  C: {far: ['D'], near: ['A', 'B', 'E']},
  D: {far: ['F'], near: ['C', 'E', 'G']},
  E: {far: [], near: ['C', 'D']},
  F: {far: ['H'], near: ['D', 'G']},
  G: {far: [], near: ['D', 'F']},
  H: {far: [], near: ['F']},
};

const FAR_WAIT = 1;
const NEAR_WAIT = 2;

export type NodeState = 'idle' | 'origin' | 'waiting' | 'transmitting' | 'received' | 'silenced';

export interface NodeView {
  state: NodeState;
  hop: number | null;
  wait?: 'short' | 'long';
}

export interface FloodStep {
  transmitter: NodeId | null;
  transmittedHop: number | null;
  nodes: Record<NodeId, NodeView>;
  acked: boolean;
  duplicates: NodeId[];
  caption: string;
}

const TRANSMIT_CAPTIONS: Partial<Record<NodeId, string>> = {
  A: 'Ο A εκπέμπει. Οι B και C το ακούν και περιμένουν λίγο πριν το επαναλάβουν.',
  C: 'Ο C είναι πιο μακριά, οπότε επαναλαμβάνει πρώτος. Ο B τον ακούει και δεν εκπέμπει. Ο A ξέρει ότι το μήνυμα προχώρησε.',
  D: 'Ο D επαναλαμβάνει. Ο E τον ακούει και σωπαίνει. Ο C το έχει ήδη και το αγνοεί.',
  H: 'Ο H επαναλαμβάνει, αλλά μόνο ο F τον ακούει και το έχει ήδη.',
};

function transmitCaption(id: NodeId, hop: number): string {
  if (id === 'F') {
    return hop === 0
      ? 'Ο F επαναλαμβάνει με hop limit 0. Ο H το λαμβάνει αλλά δεν το επαναλαμβάνει.'
      : 'Ο F επαναλαμβάνει. Ο G τον ακούει και σωπαίνει. Ο H το λαμβάνει και περιμένει.';
  }
  return TRANSMIT_CAPTIONS[id] ?? '';
}

function joinGreek(ids: NodeId[]): string {
  return ids.length === 1 ? ids[0] : `${ids.slice(0, -1).join(', ')} και ${ids.at(-1)}`;
}

function finalCaption(hopLimit: number, unreached: NodeId[], wasted: boolean, transmissions: number): string {
  if (unreached.length === 1) return `Με hop limit ${hopLimit}, ο ${unreached[0]} δεν το έλαβε.`;
  if (unreached.length > 1) return `Με hop limit ${hopLimit}, οι ${joinGreek(unreached)} δεν το έλαβαν.`;
  if (wasted) {
    return 'Ο H επανέλαβε το μήνυμα χωρίς να το ακούσει κανείς νέος. Μεγαλύτερο hop limit από όσο χρειάζεται σπαταλά airtime.';
  }
  return `Όλοι οι κόμβοι έλαβαν το μήνυμα με ${transmissions} εκπομπές αντί για ${NODE_IDS.length}.`;
}

export function simulateFlood(hopLimit: number): FloodStep[] {
  const nodes = Object.fromEntries(
    NODE_IDS.map((id) => [id, {state: 'idle', hop: null}]),
  ) as Record<NodeId, NodeView>;
  nodes[ORIGIN] = {state: 'origin', hop: hopLimit};

  const readyAt = new Map<NodeId, number>();
  const steps: FloodStep[] = [];
  let acked = false;
  let wasted = false;
  let transmissions = 0;

  const push = (transmitter: NodeId | null, transmittedHop: number | null, duplicates: NodeId[], caption: string) =>
    steps.push({transmitter, transmittedHop, nodes: {...nodes}, acked, duplicates, caption});

  push(null, null, [], `Ο A θα στείλει μήνυμα στο κανάλι με hop limit ${hopLimit}.`);

  let transmitter: NodeId | null = ORIGIN;
  let hop = hopLimit;

  while (transmitter) {
    const {far, near} = RANGE[transmitter];
    const duplicates: NodeId[] = [];
    let newcomers = 0;

    for (const id of [...far, ...near]) {
      const node = nodes[id];
      if (id === ORIGIN) {
        acked = true;
      } else if (node.state === 'idle') {
        newcomers += 1;
        if (hop > 0) {
          const isFar = far.includes(id);
          nodes[id] = {state: 'waiting', hop, wait: isFar ? 'short' : 'long'};
          readyAt.set(id, steps.length + (isFar ? FAR_WAIT : NEAR_WAIT));
        } else {
          nodes[id] = {state: 'received', hop};
        }
      } else if (node.state === 'waiting') {
        nodes[id] = {...node, state: 'silenced'};
        readyAt.delete(id);
      } else {
        duplicates.push(id);
      }
    }

    transmissions += 1;
    if (newcomers === 0) wasted = true;
    const restingState: NodeState = transmitter === ORIGIN ? 'origin' : 'received';
    nodes[transmitter] = {...nodes[transmitter], state: 'transmitting'};
    push(transmitter, hop, duplicates, transmitCaption(transmitter, hop));
    nodes[transmitter] = {...nodes[transmitter], state: restingState};

    const next = [...readyAt.entries()].sort(
      ([a, ta], [b, tb]) => ta - tb || NODE_IDS.indexOf(a) - NODE_IDS.indexOf(b),
    )[0];
    if (next) {
      transmitter = next[0];
      hop = (nodes[transmitter].hop ?? 0) - 1;
      readyAt.delete(transmitter);
    } else {
      transmitter = null;
    }
  }

  const unreached = NODE_IDS.filter((id) => nodes[id].state === 'idle');
  push(null, null, [], finalCaption(hopLimit, unreached, wasted, transmissions));
  return steps;
}
