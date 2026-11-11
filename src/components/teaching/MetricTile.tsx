import type {CSSProperties, ReactNode} from 'react';
import clsx from 'clsx';

import styles from './teaching.module.css';

export function MetricTile({
  label,
  value,
  unit,
  bar,
  children,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  bar?: {fraction: number; tone?: 'blue' | 'orange'};
  children?: ReactNode;
}) {
  const fraction = bar ? Math.min(1, Math.max(0, bar.fraction)) : 0;
  return (
    <div className={styles.tile}>
      <span className={styles.tileLabel}>{label}</span>
      <span className={styles.tileValue}>
        {value}
        {unit && <span className={styles.tileUnit}> {unit}</span>}
      </span>
      {bar && (
        <div className={styles.bar} aria-hidden="true">
          <div
            className={clsx(styles.barFill, bar.tone === 'orange' ? styles.toneOrange : styles.toneBlue)}
            style={{'--fraction': fraction} as CSSProperties}
          />
        </div>
      )}
      {children && <div className={styles.tileHint}>{children}</div>}
    </div>
  );
}
