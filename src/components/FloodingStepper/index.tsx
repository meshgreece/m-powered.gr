import {useMemo, useState} from 'react';
import clsx from 'clsx';
import {useReducedMotion} from '@site/src/lib/useReducedMotion';
import {useStepPlayer} from '@site/src/lib/useStepPlayer';

import {DEFAULT_HOP_LIMIT, HOP_LIMITS, NODE_IDS, RANGE, simulateFlood} from './flooding';
import type {FloodStep, NodeId, NodeState} from './flooding';
import styles from './styles.module.css';

const STEP_MS = 1600;

const STATE_LABELS: Record<NodeState, string> = {
  idle: 'Δεν το έχει λάβει',
  origin: 'Αποστολέας',
  waiting: 'Περιμένει',
  transmitting: 'Εκπέμπει',
  received: 'Έλαβε',
  silenced: 'Σιώπησε',
};

const LEGEND: NodeState[] = ['idle', 'waiting', 'transmitting', 'received', 'silenced'];

const DIAGRAM_LABEL = 'Δίκτυο οκτώ κόμβων, A έως H, που επαναλαμβάνουν ένα μήνυμα';

// Positions on the wide board; every "far" listener sits farther than the "near" ones.
const WIDE_POS: Record<NodeId, [number, number]> = {
  A: [40, 140],
  B: [95, 85],
  C: [160, 140],
  D: [310, 140],
  E: [235, 80],
  F: [490, 140],
  G: [400, 205],
  H: [700, 140],
};
const WIDE_W = 740;
const WIDE_H = 260;

// The narrow board is the wide one turned on its side, so distances stay the same.
const NARROW_POS = Object.fromEntries(
  NODE_IDS.map((id) => [id, [WIDE_POS[id][1] - 15, WIDE_POS[id][0]]]),
) as Record<NodeId, [number, number]>;
const NARROW_W = 250;
const NARROW_H = 760;

const RANGE_RADIUS: Record<NodeId, number> = {A: 135, B: 100, C: 165, D: 195, E: 110, F: 225, G: 125, H: 225};

const NODE_R = 20;
const WAIT_W = {short: 13, long: 36};

function StateIcon({state}: {state: NodeState}) {
  switch (state) {
    case 'waiting':
      return (
        <>
          <circle r="4.5" className={styles.iconStroke} strokeWidth="1.6" />
          <path d="M0 -2.5V0l2 1.5" className={styles.iconStroke} strokeWidth="1.6" strokeLinecap="round" />
        </>
      );
    case 'transmitting':
      return (
        <>
          <circle cx="-2" r="1.6" className={styles.iconFill} />
          <path
            d="M0.5 -3.5a5 5 0 0 1 0 7M3 -5.5a8 8 0 0 1 0 11"
            className={styles.iconStroke}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </>
      );
    case 'received':
      return (
        <path
          d="M-4 0.5l2.6 2.6L4 -3"
          className={styles.iconStroke}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    case 'silenced':
      return (
        <>
          <path d="M-5 -2h2.2l3 -3v10l-3 -3H-5z" className={styles.iconFill} />
          <line x1="-5.5" y1="5" x2="5" y2="-5" className={styles.iconStroke} strokeWidth="1.8" strokeLinecap="round" />
        </>
      );
    default:
      return null;
  }
}

type BoardProps = {
  current: FloodStep;
  isOrigin: (id: NodeId) => boolean;
  pos: Record<NodeId, [number, number]>;
  width: number;
  height: number;
  className: string;
};

function Board({current, isOrigin, pos, width, height, className}: BoardProps) {
  const tx = current.transmitter;
  const hearers = tx ? [...RANGE[tx].far, ...RANGE[tx].near] : [];

  return (
    <svg
      className={clsx(styles.board, className)}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={DIAGRAM_LABEL}>
      {tx && (
        <g className={styles.transmitting}>
          <circle cx={pos[tx][0]} cy={pos[tx][1]} r={RANGE_RADIUS[tx]} className={styles.range} />
          {hearers.map((id) => {
            const [x1, y1] = pos[tx];
            const [x2, y2] = pos[id];
            const k = (NODE_R + 2) / Math.hypot(x2 - x1, y2 - y1);
            return (
              <line
                key={id}
                x1={x1 + (x2 - x1) * k}
                y1={y1 + (y2 - y1) * k}
                x2={x2 - (x2 - x1) * k}
                y2={y2 - (y2 - y1) * k}
                className={styles.hearLine}
              />
            );
          })}
        </g>
      )}
      {NODE_IDS.map((id) => {
        const {state, hop, wait} = current.nodes[id];
        const [x, y] = pos[id];
        return (
          <g key={id} transform={`translate(${x} ${y})`} className={styles[state]}>
            <title>{`${id}: ${STATE_LABELS[state]}`}</title>
            {current.duplicates.includes(id) && <circle r="27" className={styles.duplicate} />}
            <circle r={NODE_R} className={styles.nodeBase} />
            <circle r={NODE_R} className={styles.node} strokeDasharray={state === 'silenced' ? '4 3' : undefined} />
            {state !== 'idle' && state !== 'origin' && (
              <g transform="translate(16 -16)">
                <circle r="9.5" className={styles.badge} />
                <StateIcon state={state} />
              </g>
            )}
            <text className={styles.nodeId} dominantBaseline="central">{id}</text>
            {hop !== null && !isOrigin(id) && (
              <text y="34" className={styles.hopText} dominantBaseline="central">{`hop ${hop}`}</text>
            )}
            {state === 'waiting' && wait && (
              <rect x={-WAIT_W[wait] / 2} y="44" width={WAIT_W[wait]} height="4" rx="2" className={styles.waitBar} />
            )}
            {state === 'transmitting' && (
              <text y="-34" className={styles.txHop} dominantBaseline="central">{`hop ${current.transmittedHop}`}</text>
            )}
            {isOrigin(id) && current.acked && state !== 'transmitting' && (
              <text y="-34" className={styles.ack} dominantBaseline="central">✓ ACK</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export default function FloodingStepper() {
  const [hopLimit, setHopLimit] = useState(DEFAULT_HOP_LIMIT);
  const steps = useMemo(() => simulateFlood(hopLimit), [hopLimit]);
  const reducedMotion = useReducedMotion();
  const {step, done, play, next, reset} = useStepPlayer(steps.length, STEP_MS, reducedMotion);
  const current = steps[Math.min(step, steps.length - 1)];
  const isOrigin = (id: NodeId) => steps[0].nodes[id].state === 'origin';

  return (
    <figure className={styles.root}>
      <div className={styles.controls}>
        <label className={styles.hopLimit}>
          Hop limit
          <select
            value={hopLimit}
            onChange={(event) => {
              setHopLimit(Number(event.target.value));
              reset();
            }}>
            {HOP_LIMITS.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </label>
        <button type="button" className="button button--primary button--sm" onClick={() => step === 0 && next()} aria-disabled={step !== 0}>Στείλε</button>
        <button type="button" className="button button--secondary button--sm" onClick={() => !(done || step === 0) && next()} aria-disabled={done || step === 0}>Επόμενο βήμα</button>
        <button type="button" className="button button--secondary button--sm" onClick={play}>Αυτόματα</button>
        <button type="button" className="button button--secondary button--sm" onClick={reset}>Από την αρχή</button>
      </div>
      <p className={styles.caption} aria-live="polite">{current.caption}</p>
      <Board current={current} isOrigin={isOrigin} pos={WIDE_POS} width={WIDE_W} height={WIDE_H} className={styles.wide} />
      <Board current={current} isOrigin={isOrigin} pos={NARROW_POS} width={NARROW_W} height={NARROW_H} className={styles.narrow} />
      <ul className={styles.legend} aria-label="Υπόμνημα">
        {LEGEND.map((state) => (
          <li key={state}>
            <svg width="20" height="20" viewBox="-10 -10 20 20" className={styles[state]} aria-hidden="true">
              {state === 'idle' ? (
                <circle r="7.5" className={styles.legendIdle} />
              ) : (
                <>
                  <circle r="9.5" className={styles.badge} />
                  <StateIcon state={state} />
                </>
              )}
            </svg>
            {STATE_LABELS[state]}
          </li>
        ))}
      </ul>
      <figcaption className={styles.summary}>
        Κάθε κόμβος που ακούει το μήνυμα για πρώτη φορά περιμένει λίγο. Ο πιο μακρινός επαναλαμβάνει πρώτος και όσοι τον ακούσουν σωπαίνουν. Το hop limit ορίζει πόσες επαναλήψεις επιτρέπονται.
      </figcaption>
    </figure>
  );
}
