import {useCallback, useEffect, useRef, useState} from 'react';
import clsx from 'clsx';
import {
  LinkLine,
  MetricTile,
  NodeToken,
  PlayControls,
  SegmentedControl,
  StepCaption,
  WidgetFrame,
  formatOneDecimal,
  type NodeTokenState,
} from '@site/src/components/teaching';
import {useReducedMotion} from '@site/src/lib/useReducedMotion';

import {DUTY_CYCLE_NOTE, IDLE_CAPTION, SCENARIOS, TIMELINE_S, captionAt, overlaps, receivedAtM} from './collisions';
import type {Interval, Scenario, Sender} from './collisions';
import styles from './styles.module.css';

// Playback speed: one timeline second takes three real seconds.
const REAL_S_PER_TIMELINE_S = 3;

type NodeId = Sender | 'M';
type NodeState = 'none' | 'tx' | 'wait' | 'rx' | 'clash';
type BarKind = 'tx' | 'rx' | 'wait' | 'inc' | 'clash';
type Row = 'full' | 'top' | 'bot';

const TOKEN_STATE: Record<NodeState, NodeTokenState> = {
  none: 'idle',
  tx: 'transmitting',
  wait: 'waiting',
  rx: 'received',
  clash: 'clash',
};

const scenarioOptions = SCENARIOS.map((s) => ({value: s.id, label: s.label}));

const NODES: NodeId[] = ['X', 'M', 'Y'];
const MAP_W = 360;
const MAP_H = 150;
const MAP_POS: Record<NodeId, [number, number]> = {X: [40, 100], M: [180, 52], Y: [320, 100]};

const MAP_LABELS: Record<Scenario['id'], string> = {
  clear: 'Οι X, M και Y. Οι X και Y ακούν ο ένας τον άλλον.',
  hidden: 'Οι X, M και Y. Ένας λόφος ανάμεσα στους X και Y.',
};

const SUMMARY =
  'Όταν οι κόμβοι ακούν ο ένας τον άλλον, περιμένουν τη σειρά τους. Όταν δεν ακούν, μπορεί να εκπέμψουν μαζί, και ο κόμβος ανάμεσά τους χάνει και τα δύο μηνύματα.';

const BAR_CLASS: Record<BarKind, string> = {
  tx: styles.barTx,
  rx: styles.barRx,
  wait: styles.barWait,
  inc: styles.barInc,
  clash: styles.barClash,
};

const within = (interval: Interval, t: number) => t >= interval.start && t < interval.end;
const pct = (s: number) => `${(s / TIMELINE_S) * 100}%`;
const formatTime = (t: number) => `${formatOneDecimal(Math.floor(t * 10 + 1e-9) / 10)} s`;

interface Bar extends Interval {
  kind: BarKind;
  row: Row;
}

interface Mark {
  at: number;
  kind: 'ok' | 'x';
}

function timelineAt(scenario: Scenario, t: number, started: boolean) {
  const collided = overlaps(scenario);
  const received = receivedAtM(scenario);
  const isLost = (tx: {from: Sender}) => !received.includes(tx.from);
  const lost = scenario.transmissions.filter(isLost);
  const delivered = scenario.transmissions.filter((tx) => !isLost(tx));
  const lostEnd = Math.max(0, ...lost.map((tx) => tx.end));

  const senderState = (node: Sender): NodeState => {
    if (!started) return 'none';
    if (scenario.transmissions.some((tx) => tx.from === node && within(tx, t))) return 'tx';
    if (scenario.waits.some((w) => w.node === node && within(w, t))) return 'wait';
    return 'none';
  };
  let mState: NodeState = 'none';
  if (started && collided.some((o) => t >= o.start)) mState = 'clash';
  else if (started && delivered.some((tx) => t >= tx.end)) mState = 'rx';

  const states: Record<NodeId, NodeState> = {X: senderState('X'), M: mState, Y: senderState('Y')};

  const mSub = started
    ? scenario.transmissions
        .flatMap((tx) => {
          if (!isLost(tx) && t >= tx.end) return [`${tx.from} ✓`];
          if (isLost(tx) && t >= lostEnd) return [`${tx.from} ✕`];
          return [];
        })
        .join('\u00a0\u00a0')
    : '';

  const bars: Record<NodeId, Bar[]> = {
    X: [],
    M: [
      ...delivered.map((tx): Bar => ({start: tx.start, end: tx.end, kind: 'rx', row: 'full'})),
      ...lost.map((tx, i): Bar => ({start: tx.start, end: tx.end, kind: 'inc', row: i % 2 === 0 ? 'top' : 'bot'})),
      ...collided.map((o): Bar => ({...o, kind: 'clash', row: 'full'})),
    ],
    Y: [],
  };
  for (const w of scenario.waits) bars[w.node].push({start: w.start, end: w.end, kind: 'wait', row: 'full'});
  for (const tx of scenario.transmissions) bars[tx.from].push({start: tx.start, end: tx.end, kind: 'tx', row: 'full'});

  const marks: Mark[] = delivered.map((tx) => ({at: tx.end, kind: 'ok'}));
  if (lost.length > 0) marks.push({at: lostEnd, kind: 'x'});

  return {states, mSub, bars, marks};
}

function CheckIcon({className}: {className: string}) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M2 6.5l2.5 2.5L10 3" className={className} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CrossIcon({className}: {className: string}) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" className={className} strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export default function ChannelCollisions() {
  const reducedMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [t, setT] = useState(0);
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const frame = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    setPlaying(false);
  }, []);
  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );

  const scenario = SCENARIOS[index];
  const {states, mSub, bars, marks} = timelineAt(scenario, t, started);

  const selectScenario = (id: Scenario['id']) => {
    stop();
    setIndex(SCENARIOS.findIndex((s) => s.id === id));
    setT(0);
    setStarted(false);
  };

  const play = () => {
    stop();
    setStarted(true);
    if (reducedMotion) {
      if (t >= TIMELINE_S) {
        setT(0);
        setStarted(false);
      } else {
        setT(TIMELINE_S);
      }
      return;
    }
    const from = t >= TIMELINE_S ? 0 : t;
    setT(from);
    setPlaying(true);
    let t0: number | null = null;
    const tick = (now: number) => {
      t0 ??= now;
      const next = Math.min(TIMELINE_S, from + (now - t0) / 1000 / REAL_S_PER_TIMELINE_S);
      setT(next);
      if (next < TIMELINE_S) {
        frame.current = requestAnimationFrame(tick);
      } else {
        frame.current = null;
        setPlaying(false);
      }
    };
    frame.current = requestAnimationFrame(tick);
  };

  const reset = () => {
    stop();
    setT(0);
    setStarted(false);
  };

  const scrub = (value: number) => {
    stop();
    setT(value);
    setStarted(true);
  };

  const [xPos, mPos, yPos] = [MAP_POS.X, MAP_POS.M, MAP_POS.Y];
  const linkKind = (id: Sender) => (states[id] === 'tx' ? 'active' : 'strong');

  return (
    <WidgetFrame note={SUMMARY}>
      <SegmentedControl legend="Σενάριο" options={scenarioOptions} value={scenario.id} onChange={selectScenario} />

      <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} role="img" aria-label={MAP_LABELS[scenario.id]} className={styles.mapSvg}>
        <line x1="8" y1="132" x2="352" y2="132" className={styles.ground} />
        {scenario.hidden && <path d="M95 132 Q180 12 265 132 Z" className={styles.hill} />}
        {!scenario.hidden && <LinkLine from={xPos} to={yPos} kind="strong" />}
        <LinkLine from={xPos} to={mPos} kind={linkKind('X')} />
        <LinkLine from={yPos} to={mPos} kind={linkKind('Y')} />
        {NODES.map((id) => (
          <NodeToken
            key={id}
            x={MAP_POS[id][0]}
            y={MAP_POS[id][1]}
            id={id}
            state={TOKEN_STATE[states[id]]}
            title={id === 'M' ? undefined : `${id}: αποστολέας`}
            above={id === 'M' && mSub ? mSub : undefined}
            aboveTone="muted"
          />
        ))}
      </svg>

      <div className={styles.lanes} aria-hidden="true">
        {NODES.map((id) => (
          <div key={id} className={styles.laneRow}>
            <span className={styles.laneName}>{id}</span>
            <div className={styles.lane}>
              {started &&
                bars[id]
                  .filter((b) => t > b.start)
                  .map((b) => (
                    <div
                      key={`${b.kind}-${b.start}`}
                      className={clsx(styles.bar, BAR_CLASS[b.kind], styles[b.row])}
                      style={{left: pct(b.start), width: pct(Math.min(b.end, t) - b.start)}}
                    />
                  ))}
              {started &&
                id === 'M' &&
                marks
                  .filter((m) => t >= m.at)
                  .map((m) => (
                    <span
                      key={`${m.kind}-${m.at}`}
                      className={clsx(styles.mark, m.kind === 'ok' ? styles.markOk : styles.markX)}
                      style={{left: pct(m.at)}}>
                      {m.kind === 'ok' ? <CheckIcon className={styles.markIcon} /> : <CrossIcon className={styles.markIcon} />}
                    </span>
                  ))}
              <div className={styles.playhead} style={{left: pct(t)}} />
            </div>
          </div>
        ))}
        <div className={styles.laneRow}>
          <span />
          <div className={styles.ticks}>
            {Array.from({length: TIMELINE_S + 1}, (_, s) => (
              <span key={s} style={{left: pct(s)}}>{`${s} s`}</span>
            ))}
          </div>
        </div>
      </div>

      <ul aria-label="Υπόμνημα" className={styles.legend}>
        <li>
          <span className={clsx(styles.swatch, styles.barTx)} />
          Εκπομπή
        </li>
        <li>
          <span className={clsx(styles.swatch, styles.barWait)} />
          Αναμονή
        </li>
        <li>
          <span className={clsx(styles.swatch, styles.barClash)} />
          <CrossIcon className={styles.legendClash} />
          Σύγκρουση
        </li>
        <li>
          <span className={clsx(styles.swatch, styles.barRx)} />
          <CheckIcon className={styles.legendRx} />
          Λήψη
        </li>
      </ul>

      <PlayControls playing={playing} done={t >= TIMELINE_S} onPlay={play} onPause={stop} onReset={reset}>
        <div className={styles.scrubber}>
          <span aria-hidden="true">Χρόνος</span>
          <input
            type="range"
            min={0}
            max={TIMELINE_S}
            step={0.1}
            value={t}
            aria-label="Χρόνος"
            aria-valuetext={formatTime(t)}
            onChange={(event) => scrub(Number(event.target.value))}
          />
          <span className={styles.scrubValue} aria-hidden="true">{formatTime(t)}</span>
        </div>
      </PlayControls>

      <StepCaption>{started ? captionAt(scenario, t) : IDLE_CAPTION}</StepCaption>

      <MetricTile label="Όριο ανά κόμβο" value="6 λεπτά την ώρα (10%)">
        <div role="img" aria-label="Μία ώρα, 10% γεμάτη" className={styles.dutyBar}>
          <div className={styles.dutyFill} />
        </div>
        {DUTY_CYCLE_NOTE}
      </MetricTile>
    </WidgetFrame>
  );
}
