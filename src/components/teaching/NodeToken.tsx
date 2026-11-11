import clsx from 'clsx';

import styles from './teaching.module.css';

export type NodeTokenState =
  | 'idle'
  | 'origin'
  | 'waiting'
  | 'transmitting'
  | 'received'
  | 'silenced'
  | 'clash';

export const NODE_TOKEN_RADIUS = 22;

export const NODE_STATE_LABELS: Record<NodeTokenState, string> = {
  idle: 'Δεν το έχει λάβει',
  origin: 'Αποστολέας',
  waiting: 'Περιμένει',
  transmitting: 'Εκπέμπει',
  received: 'Έλαβε',
  silenced: 'Σιώπησε',
  clash: 'Σύγκρουση',
};

const BADGE_CLASS: Partial<Record<NodeTokenState, string>> = {
  waiting: styles.badgeWaiting,
  received: styles.badgeReceived,
  silenced: styles.badgeStopped,
  clash: styles.badgeStopped,
};

function BadgeIcon({state}: {state: NodeTokenState}) {
  if (state === 'waiting') {
    return (
      <>
        <circle r="4.5" className={styles.badgeStroke} />
        <path d="M0 -2.5V0l2 1.5" className={styles.badgeStroke} />
      </>
    );
  }
  if (state === 'received') {
    return <path d="M-4 0.5l2.6 2.6L4 -3" className={styles.badgeStroke} />;
  }
  return <path d="M-3.5 -3.5l7 7M3.5 -3.5l-7 7" className={styles.badgeStroke} />;
}

export function NodeToken({
  x,
  y,
  id,
  state,
  title,
  above,
  aboveTone = 'blue',
  below,
  belowTone = 'muted',
  ring,
  waitBar,
}: {
  x: number;
  y: number;
  id: string;
  state: NodeTokenState;
  title?: string;
  above?: string;
  aboveTone?: 'blue' | 'green' | 'muted';
  below?: string;
  belowTone?: 'muted' | 'green';
  ring?: boolean;
  waitBar?: 'short' | 'long';
}) {
  const badge = BADGE_CLASS[state];
  const r = NODE_TOKEN_RADIUS;
  const barWidth = waitBar === 'long' ? 36 : 13;
  return (
    <g transform={`translate(${x} ${y})`}>
      <title>{title ?? `${id}: ${NODE_STATE_LABELS[state]}`}</title>
      {state === 'transmitting' && (
        <>
          <circle r={r + 14} className={styles.tokenHaloOuter} />
          <circle r={r + 7} className={styles.tokenHaloInner} />
        </>
      )}
      {ring && <circle r={r + 6} className={styles.tokenRing} />}
      <circle r={r} className={clsx(styles.token, styles[`token_${state}`])} />
      <text className={clsx(styles.tokenLetter, state === 'origin' && styles.tokenLetterOn, state === 'transmitting' && styles.tokenLetterAccent)} dominantBaseline="central">
        {id}
      </text>
      {badge && (
        <g transform="translate(16 16)">
          <circle r="10" className={clsx(styles.tokenBadge, badge)} />
          <BadgeIcon state={state} />
        </g>
      )}
      {above && (
        <text y={-r - 12} className={clsx(styles.tokenAbove, aboveTone === 'green' && styles.tokenAboveGreen, aboveTone === 'muted' && styles.tokenAboveMuted)} dominantBaseline="central">
          {above}
        </text>
      )}
      {below && (
        <text y={r + 12} className={clsx(styles.tokenBelow, belowTone === 'green' && styles.tokenBelowGreen)} dominantBaseline="central">
          {below}
        </text>
      )}
      {waitBar && <rect x={-barWidth / 2} y={r + 22} width={barWidth} height="4" rx="2" className={styles.tokenWaitBar} />}
    </g>
  );
}
