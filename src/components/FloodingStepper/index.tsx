import {useMemo, useState} from 'react';
import clsx from 'clsx';
import {
  LinkLine,
  MetricTile,
  NodeToken,
  PlayControls,
  SegmentedControl,
  StateLegend,
  StepCaption,
  StepDots,
  Takeaway,
  WidgetFrame,
  formatOneDecimal,
  type NodeTokenState,
} from '@site/src/components/teaching';
import {airtimeMs, COMMUNITY_SETTING} from '@site/src/components/AirtimeExplorer/airtime';
import {useReducedMotion} from '@site/src/lib/useReducedMotion';
import {useStepPlayer} from '@site/src/lib/useStepPlayer';

import {
  DEFAULT_HOP_LIMIT,
  FLOOD_LINKS,
  HOP_LIMITS,
  NODE_IDS,
  floodOutcome,
  floodTakeaway,
  reachedCount,
  simulateFlood,
  transmissionsUpTo,
} from './flooding';
import type {FloodStep, NodeId} from './flooding';
import styles from './styles.module.css';

const STEP_MS = 1600;

const LEGEND: NodeTokenState[] = ['idle', 'waiting', 'transmitting', 'received', 'silenced'];

const NOTE =
  'Κάθε κόμβος που ακούει το μήνυμα για πρώτη φορά περιμένει λίγο. Ο πιο μακρινός επαναλαμβάνει πρώτος και όσοι τον ακούσουν σωπαίνουν. Το hop limit ορίζει πόσες επαναλήψεις επιτρέπονται.';

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

type BoardProps = {
  current: FloodStep;
  isOrigin: (id: NodeId) => boolean;
  pos: Record<NodeId, [number, number]>;
  width: number;
  height: number;
  className: string;
  // Side of A that is free of links on this board.
  originLabel: 'above' | 'below';
};

function Board({current, isOrigin, pos, width, height, className, originLabel}: BoardProps) {
  const tx = current.transmitter;

  return (
    <svg
      className={clsx(styles.board, className)}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={DIAGRAM_LABEL}>
      {FLOOD_LINKS.map(({a, b, weak}) => (
        <LinkLine
          key={`${a}${b}`}
          from={pos[a]}
          to={pos[b]}
          kind={tx === a || tx === b ? 'active' : weak ? 'weak' : 'strong'}
        />
      ))}
      {NODE_IDS.map((id) => {
        const {state, hop, wait} = current.nodes[id];
        const origin = isOrigin(id);
        const progressed = origin && current.acked && state !== 'transmitting' ? '✓ προχώρησε' : undefined;
        return (
          <NodeToken
            key={id}
            x={pos[id][0]}
            y={pos[id][1]}
            id={id}
            state={state}
            ring={current.duplicates.includes(id)}
            below={
              origin
                ? originLabel === 'below'
                  ? progressed
                  : undefined
                : hop !== null && state !== 'transmitting'
                  ? `hop limit ${hop}`
                  : undefined
            }
            belowTone={origin ? 'green' : 'muted'}
            above={
              state === 'transmitting'
                ? `hop limit ${current.transmittedHop}`
                : originLabel === 'above'
                  ? progressed
                  : undefined
            }
            aboveTone={origin && state !== 'transmitting' ? 'green' : 'blue'}
            waitBar={state === 'waiting' && wait ? wait : undefined}
          />
        );
      })}
    </svg>
  );
}

const hopOptions = HOP_LIMITS.map((value) => ({value, label: String(value)}));

export default function FloodingStepper() {
  const [hopLimit, setHopLimit] = useState(DEFAULT_HOP_LIMIT);
  const steps = useMemo(() => simulateFlood(hopLimit), [hopLimit]);
  const reducedMotion = useReducedMotion();
  const {step, done, playing, play, pause, next, reset} = useStepPlayer(steps.length, STEP_MS, reducedMotion);
  const current = steps[Math.min(step, steps.length - 1)];
  const isOrigin = (id: NodeId) => steps[0].nodes[id].state === 'origin';
  const transmissions = transmissionsUpTo(steps, step);
  const seconds = (transmissions * airtimeMs(COMMUNITY_SETTING)) / 1000;
  const wasted = done && floodOutcome(steps) === 'wasted';

  return (
    <WidgetFrame title="Πώς απλώνεται ένα μήνυμα" note={NOTE}>
      <SegmentedControl
        legend="Hop limit"
        options={hopOptions}
        value={hopLimit}
        onChange={(value) => {
          setHopLimit(value);
          reset();
        }}
      />
      <Board current={current} isOrigin={isOrigin} pos={WIDE_POS} width={WIDE_W} height={WIDE_H} className={styles.wide} originLabel="below" />
      <Board current={current} isOrigin={isOrigin} pos={NARROW_POS} width={NARROW_W} height={NARROW_H} className={styles.narrow} originLabel="above" />
      <StateLegend states={LEGEND} />
      <PlayControls playing={playing} done={done} onPlay={play} onPause={pause} onNext={next} onReset={reset}>
        <StepDots step={step} count={steps.length} />
      </PlayControls>
      <StepCaption number={step + 1}>{current.caption}</StepCaption>
      <div className={styles.metrics}>
        <MetricTile label="Το έλαβαν" value={`${reachedCount(current)} / ${NODE_IDS.length}`} />
        <MetricTile label="Εκπομπές" value={transmissions} />
        <MetricTile
          label="Airtime"
          value={formatOneDecimal(seconds)}
          unit="s"
          bar={{fraction: transmissions / NODE_IDS.length, tone: wasted ? 'orange' : 'blue'}}
        />
      </div>
      {done && <Takeaway>{floodTakeaway(floodOutcome(steps), hopLimit)}</Takeaway>}
    </WidgetFrame>
  );
}
