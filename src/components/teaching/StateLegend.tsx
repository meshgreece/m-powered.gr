import {NODE_STATE_LABELS, NodeToken, type NodeTokenState} from './NodeToken';
import styles from './teaching.module.css';

export function StateLegend({states}: {states: readonly NodeTokenState[]}) {
  return (
    <ul className={styles.stateLegend} aria-label="Υπόμνημα">
      {states.map((state) => (
        <li key={state} className={styles.legendItem}>
          <svg viewBox="-38 -38 76 76" width="28" height="28" aria-hidden="true">
            <NodeToken x={0} y={0} id="" state={state} title="" />
          </svg>
          {NODE_STATE_LABELS[state]}
        </li>
      ))}
    </ul>
  );
}
