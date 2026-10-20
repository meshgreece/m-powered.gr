import {useCallback, useEffect, useId, useRef, useState} from 'react';
import type {KeyboardEvent} from 'react';
import clsx from 'clsx';
import {useReducedMotion} from '@site/src/lib/useReducedMotion';

import {DUTY_CYCLE_LINES, IDLE_CAPTION, SCENARIOS, TIMELINE_S, captionAt, overlaps, receivedAtM} from './collisions';
import type {Interval, Scenario, Sender} from './collisions';
import styles from './styles.module.css';

// Playback speed: one timeline second takes three real seconds.
const REAL_S_PER_TIMELINE_S = 3;

type NodeId = Sender | 'M';
type NodeState = 'none' | 'tx' | 'wait' | 'rx' | 'clash';
type BarKind = 'tx' | 'rx' | 'wait' | 'inc' | 'clash';
type Row = 'full' | 'top' | 'bot';

const NODES: NodeId[] = ['X', 'M', 'Y'];
const MAP_W = 360;
const MAP_H = 140;
const MAP_POS: Record<NodeId, [number, number]> = {X: [50, 96], M: [180, 48], Y: [310, 96]};

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
const formatTime = (t: number) => `${(Math.floor(t * 10 + 1e-9) / 10).toFixed(1).replace('.', ',')} s`;

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

function Badge({state}: {state: NodeState}) {
  return (
    <g transform="translate(14 -14)">
      <circle r="9" className={styles.badge} />
      {state === 'tx' && (
        <>
          <circle cx="-2" r="1.6" className={styles.iconFill} />
          <path d="M0.5 -3.5a5 5 0 0 1 0 7M3 -5.5a8 8 0 0 1 0 11" className={styles.iconStroke} strokeWidth="1.5" strokeLinecap="round" />
        </>
      )}
      {state === 'wait' && (
        <>
          <circle r="4.5" className={styles.iconStroke} strokeWidth="1.6" />
          <path d="M0 -2.5V0l2 1.5" className={styles.iconStroke} strokeWidth="1.6" strokeLinecap="round" />
        </>
      )}
      {state === 'rx' && (
        <path d="M-4 0.5l2.6 2.6L4 -3" className={styles.iconStroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {state === 'clash' && (
        <path d="M-3.5 -3.5l7 7M3.5 -3.5l-7 7" className={styles.iconStroke} strokeWidth="2" strokeLinecap="round" />
      )}
    </g>
  );
}

export default function ChannelCollisions() {
  const baseId = useId();
  const reducedMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [t, setT] = useState(0);
  const [started, setStarted] = useState(false);
  const frame = useRef<number | null>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const stop = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  }, []);
  useEffect(() => stop, [stop]);

  const scenario = SCENARIOS[index];
  const {states, mSub, bars, marks} = timelineAt(scenario, t, started);
  const tabId = (i: number) => `${baseId}-tab-${SCENARIOS[i].id}`;
  const panelId = `${baseId}-panel`;

  const selectTab = (i: number) => {
    stop();
    setIndex(i);
    setT(0);
    setStarted(false);
  };

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const last = SCENARIOS.length - 1;
    const target = {ArrowRight: index === last ? 0 : index + 1, ArrowLeft: index === 0 ? last : index - 1, Home: 0, End: last}[
      event.key
    ];
    if (target === undefined) return;
    event.preventDefault();
    selectTab(target);
    tabRefs.current[target]?.focus();
  };

  const play = () => {
    stop();
    setStarted(true);
    if (reducedMotion) {
      setT(TIMELINE_S);
      return;
    }
    const from = t >= TIMELINE_S ? 0 : t;
    setT(from);
    let t0: number | null = null;
    const tick = (now: number) => {
      t0 ??= now;
      const next = Math.min(TIMELINE_S, from + (now - t0) / 1000 / REAL_S_PER_TIMELINE_S);
      setT(next);
      frame.current = next < TIMELINE_S ? requestAnimationFrame(tick) : null;
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

  const xActive = states.X === 'tx';
  const yActive = states.Y === 'tx';

  return (
    <figure className={styles.root}>
      <div role="tablist" aria-label="Σενάριο" className={styles.tabs}>
        {SCENARIOS.map((s, i) => (
          <button
            key={s.id}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={tabId(i)}
            aria-selected={i === index}
            aria-controls={panelId}
            tabIndex={i === index ? 0 : -1}
            className={clsx(styles.tab, i === index && styles.tabSelected)}
            onClick={() => selectTab(i)}
            onKeyDown={onTabKeyDown}>
            {s.label}
          </button>
        ))}
      </div>

      <div id={panelId} role="tabpanel" aria-labelledby={tabId(index)} className={styles.panel}>
        <div className={styles.map}>
          <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} role="img" aria-label={MAP_LABELS[scenario.id]} className={styles.mapSvg}>
            <line x1="8" y1="114" x2="352" y2="114" className={styles.ground} />
            {scenario.hidden ? (
              <path d="M95 114 Q180 8 265 114 Z" className={styles.hill} />
            ) : (
              <>
                <line x1="180" y1="64" x2="180" y2="114" className={styles.mast} />
                <line x1="68" y1="94" x2="292" y2="94" className={clsx(styles.hearLine, xActive && styles.linkActive)} />
              </>
            )}
            <line x1="64" y1="84" x2="166" y2="56" className={clsx(styles.link, xActive && styles.linkActive)} />
            <line x1="296" y1="84" x2="194" y2="56" className={clsx(styles.link, yActive && styles.linkActive)} />
            {NODES.map((id) => (
              <g key={id} transform={`translate(${MAP_POS[id][0]} ${MAP_POS[id][1]})`} className={styles[states[id]]}>
                <circle r="17" className={styles.nodeBase} />
                <circle r="17" className={styles.node} />
                {states[id] !== 'none' && <Badge state={states[id]} />}
              </g>
            ))}
          </svg>
          {NODES.map((id) => {
            const left = `${(MAP_POS[id][0] / MAP_W) * 100}%`;
            return (
              <span key={id} aria-hidden="true">
                <span className={styles.mapId} style={{left, top: `${(MAP_POS[id][1] / MAP_H) * 100}%`}}>
                  {id}
                </span>
                {id === 'M' && mSub && (
                  <span className={styles.mapSub} style={{left, top: `${((MAP_POS[id][1] - 39) / MAP_H) * 100}%`}}>
                    {mSub}
                  </span>
                )}
              </span>
            );
          })}
        </div>

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

        <p className={styles.caption} aria-live="polite">
          {started ? captionAt(scenario, t) : IDLE_CAPTION}
        </p>

        <div className={styles.controls}>
          <button type="button" className="button button--primary button--sm" onClick={play}>
            Παίξε
          </button>
          <button type="button" className="button button--secondary button--sm" onClick={reset}>
            Από την αρχή
          </button>
        </div>
      </div>

      <div className={styles.dutyCycle}>
        <p className={styles.dutyLead}>{DUTY_CYCLE_LINES[0]}</p>
        <div role="img" aria-label="Μία ώρα, 10% γεμάτη" className={styles.dutyBar}>
          <div className={styles.dutyFill} />
        </div>
        <p>{DUTY_CYCLE_LINES[1]}</p>
      </div>

      <figcaption className={styles.summary}>{SUMMARY}</figcaption>
    </figure>
  );
}
