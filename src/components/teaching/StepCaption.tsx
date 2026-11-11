import type {ReactNode} from 'react';

import styles from './teaching.module.css';

export function StepCaption({number, children}: {number?: number; children: ReactNode}) {
  return (
    <div className={styles.caption} aria-live="polite">
      {number !== undefined && <span className={styles.stepBadge}>{number}</span>}
      <span>{children}</span>
    </div>
  );
}
