import clsx from 'clsx';

import {insetSegment, type Point} from './geometry';
import {NODE_TOKEN_RADIUS} from './NodeToken';
import styles from './teaching.module.css';

export function LinkLine({
  from,
  to,
  kind,
  inset = NODE_TOKEN_RADIUS + 2,
}: {
  from: Point;
  to: Point;
  kind: 'strong' | 'weak' | 'active';
  inset?: number;
}) {
  const [a, b] = insetSegment(from, to, inset);
  return <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} className={clsx(styles.link, styles[`link_${kind}`])} />;
}
