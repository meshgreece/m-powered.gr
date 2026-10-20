import type {CSSProperties} from 'react';
import clsx from 'clsx';
import {useReducedMotion} from '@site/src/lib/useReducedMotion';
import {useStepPlayer} from '@site/src/lib/useStepPlayer';

import {LINK_LABELS, NO_INTERNET_LABEL, PATH_NODES, PATH_STEPS} from './steps';
import styles from './styles.module.css';

const STEP_MS = 1400;

type NodeId = (typeof PATH_NODES)[number]['id'];
type LinkState = 'pending' | 'active' | 'done';

const BASES: Partial<Record<NodeId, 'hill' | 'roof'>> = {relay1: 'hill', relay2: 'roof'};

// Each node sits in a 72 x 64 icon box; the chain starts below the badge.
const ICON_BOX = 72;
const ICON_H = 64;
const CHAIN_TOP = 46;

const WIDE_NODE_W = 76;
const WIDE_LINK_W = {Bluetooth: 48, LoRa: 56};
const WIDE_W =
  PATH_NODES.length * WIDE_NODE_W + LINK_LABELS.reduce((sum, kind) => sum + WIDE_LINK_W[kind], 0);
const WIDE_H = CHAIN_TOP + ICON_H + 40;

const NARROW_W = 240;
const NARROW_CX = NARROW_W / 2;
const NARROW_LINK_H = {Bluetooth: 40, LoRa: 76};
const LABEL_LINE_H = 17;

function labelLines(label: string): string[] {
  const space = label.lastIndexOf(' ');
  return label.length > 8 && space > 0 ? [label.slice(0, space), label.slice(space + 1)] : [label];
}

function linkState(index: number, activeLink: number | null): LinkState {
  if (activeLink === null || activeLink < index) return 'pending';
  return activeLink === index ? 'active' : 'done';
}

function Envelope({x, y}: {x: number; y: number}) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x="1" y="1" width="20" height="14" rx="2" className={styles.envelope} />
      <path d="M2 2l9 7 9-7" className={styles.envelopeFlap} />
    </g>
  );
}

function Badge({right}: {right: number}) {
  return (
    <g transform={`translate(${right - 160} 1)`}>
      <rect x="0.5" y="0.5" width="159" height="28" rx="14" className={styles.badge} />
      <g transform="translate(6 4)">
        <path
          d="M7 17h14a5 5 0 0 0 0-10 7 7 0 0 0-13-1A5.5 5.5 0 0 0 7 17z"
          className={styles.cloud}
        />
        <line x1="3" y1="19" x2="25" y2="1" className={styles.cloudCross} />
      </g>
      <text x="42" y="19" className={styles.badgeText}>
        {NO_INTERNET_LABEL}
      </text>
    </g>
  );
}

function NodeIcon({
  id,
  cx,
  top,
  showEnvelope,
  delivered,
}: {
  id: NodeId;
  cx: number;
  top: number;
  showEnvelope: boolean;
  delivered: boolean;
}) {
  const base = BASES[id];
  return (
    <g transform={`translate(${cx - ICON_BOX / 2} ${top})`}>
      {id.endsWith('Phone') ? (
        <g transform="translate(21 4)">
          <rect x="1.5" y="1.5" width="27" height="45" rx="5" className={styles.device} />
          <line x1="11" y1="40" x2="19" y2="40" className={styles.deviceLine} />
        </g>
      ) : (
        <g transform="translate(16 4)">
          <line x1="30" y1="3" x2="30" y2="18" className={styles.deviceLine} />
          <rect x="4" y="18" width="32" height="28" rx="4" className={styles.device} />
          <rect x="10" y="24" width="14" height="8" rx="1.5" className={styles.screen} />
        </g>
      )}
      {base === 'hill' && <path transform="translate(0 52)" d="M0 12 Q36 -6 72 12 Z" className={styles.hill} />}
      {base === 'roof' && <path transform="translate(0 52)" d="M8 12 L36 1 L64 12" className={styles.roof} />}
      {/* On the phone screen, clear of the link labels. */}
      {showEnvelope && <Envelope x={25} y={18} />}
      {delivered && (
        <g className={styles.pop}>
          <circle cx="57" cy="11" r="11" className={styles.check} />
          <path transform="translate(51 5)" d="M2 6.5l2.5 2.5L10 3" className={styles.checkMark} />
        </g>
      )}
    </g>
  );
}

function NodeLabel({label, cx, y}: {label: string; cx: number; y: number}) {
  return (
    <text x={cx} y={y} textAnchor="middle" className={styles.nodeLabel}>
      {labelLines(label).map((line, i) => (
        <tspan key={line} x={cx} dy={i === 0 ? 0 : LABEL_LINE_H}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

function linkText(kind: string, state: LinkState) {
  return state === 'done' ? `✓ ${kind}` : kind;
}

function linkStroke(kind: string) {
  return kind === 'Bluetooth' ? {strokeWidth: 2, strokeDasharray: '5 4'} : {strokeWidth: 3};
}

type DiagramProps = {activeLink: number | null; delivered: boolean};

const DIAGRAM_LABEL = 'Διαδρομή ενός μηνύματος από το κινητό σου στο κινητό του παραλήπτη, μέσω κόμβων LoRa';

function WideDiagram({activeLink, delivered}: DiagramProps) {
  let x = 0;
  const shapes = PATH_NODES.map((node, i) => {
    const cx = x + WIDE_NODE_W / 2;
    x += WIDE_NODE_W;
    const nodeShapes = (
      <g key={node.id}>
        <NodeIcon
          id={node.id}
          cx={cx}
          top={CHAIN_TOP}
          showEnvelope={i === 0 && activeLink === null}
          delivered={i === PATH_NODES.length - 1 && delivered}
        />
        <NodeLabel label={node.label} cx={cx} y={CHAIN_TOP + ICON_H + 19} />
      </g>
    );
    if (i >= LINK_LABELS.length) return nodeShapes;

    const kind = LINK_LABELS[i];
    const w = WIDE_LINK_W[kind];
    const x1 = x;
    x += w;
    const state = linkState(i, activeLink);
    return [
      nodeShapes,
      <g key={`link-${i}`} className={styles[state]}>
        <text x={x1 + w / 2} y={CHAIN_TOP + 17} textAnchor="middle" className={styles.linkLabel}>
          {linkText(kind, state)}
        </text>
        <line x1={x1} y1={CHAIN_TOP + 34} x2={x1 + w} y2={CHAIN_TOP + 34} className={styles.link} {...linkStroke(kind)} />
        {state === 'active' && (
          <g transform={`translate(${x1} ${CHAIN_TOP + 26})`}>
            <g className={styles.travelX} style={{'--mp-travel': `${w - 22}px`} as CSSProperties}>
              <Envelope x={0} y={0} />
            </g>
          </g>
        )}
      </g>,
    ];
  });

  return (
    <svg
      className={clsx(styles.diagram, styles.wide)}
      viewBox={`0 0 ${WIDE_W} ${WIDE_H}`}
      role="img"
      aria-label={DIAGRAM_LABEL}>
      <Badge right={WIDE_W} />
      {shapes}
    </svg>
  );
}

function NarrowDiagram({activeLink, delivered}: DiagramProps) {
  let y = CHAIN_TOP;
  const shapes = PATH_NODES.map((node, i) => {
    const top = y;
    y += ICON_H + 4 + labelLines(node.label).length * LABEL_LINE_H + 4;
    const nodeShapes = (
      <g key={node.id}>
        <NodeIcon
          id={node.id}
          cx={NARROW_CX}
          top={top}
          showEnvelope={i === 0 && activeLink === null}
          delivered={i === PATH_NODES.length - 1 && delivered}
        />
        <NodeLabel label={node.label} cx={NARROW_CX} y={top + ICON_H + 18} />
      </g>
    );
    if (i >= LINK_LABELS.length) return nodeShapes;

    const kind = LINK_LABELS[i];
    const h = NARROW_LINK_H[kind];
    const y1 = y + 4;
    y += h + 8;
    const state = linkState(i, activeLink);
    return [
      nodeShapes,
      <g key={`link-${i}`} className={styles[state]}>
        <line x1={NARROW_CX} y1={y1} x2={NARROW_CX} y2={y1 + h} className={styles.link} {...linkStroke(kind)} />
        <text x={NARROW_CX + 18} y={y1 + h / 2} dominantBaseline="central" className={styles.linkLabel}>
          {linkText(kind, state)}
        </text>
        {state === 'active' && (
          <g transform={`translate(${NARROW_CX - 11} ${y1})`}>
            <g className={styles.travelY} style={{'--mp-travel': `${h - 16}px`} as CSSProperties}>
              <Envelope x={0} y={0} />
            </g>
          </g>
        )}
      </g>,
    ];
  });

  return (
    <svg
      className={clsx(styles.diagram, styles.narrow)}
      viewBox={`0 0 ${NARROW_W} ${y}`}
      role="img"
      aria-label={DIAGRAM_LABEL}>
      <Badge right={NARROW_W} />
      {shapes}
    </svg>
  );
}

export default function MessagePathDiagram() {
  const reducedMotion = useReducedMotion();
  const {step, done, play, next, reset} = useStepPlayer(PATH_STEPS.length, STEP_MS, reducedMotion);
  const {activeLink, caption} = PATH_STEPS[step];

  return (
    <figure className={styles.root}>
      <WideDiagram activeLink={activeLink} delivered={done} />
      <NarrowDiagram activeLink={activeLink} delivered={done} />
      <div className={styles.controls}>
        <button type="button" className="button button--primary button--sm" onClick={play}>Στείλε μήνυμα</button>
        <button type="button" className="button button--secondary button--sm" onClick={() => !done && next()} aria-disabled={done}>Επόμενο βήμα</button>
        <button type="button" className="button button--secondary button--sm" onClick={reset}>Από την αρχή</button>
      </div>
      <p className={styles.caption} aria-live="polite">{caption}</p>
      <figcaption className={styles.summary}>
        Το μήνυμα πηγαίνει από το κινητό στον κόμβο σου μέσω Bluetooth, μετά από κόμβο σε κόμβο με LoRa, και τέλος στο κινητό του παραλήπτη, χωρίς internet.
      </figcaption>
    </figure>
  );
}
