import type {ReactNode} from 'react';
import clsx from 'clsx';

import styles from './teaching.module.css';

export function WidgetFrame({
  title,
  note,
  className,
  children,
}: {
  title?: string;
  note?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <figure className={clsx(styles.frame, className)}>
      {title && (
        <div className={styles.header}>
          <span className={styles.eyebrow}>Δοκίμασέ το</span>
          <h3 className={styles.title}>{title}</h3>
        </div>
      )}
      {children}
      {note && <figcaption className={styles.note}>{note}</figcaption>}
    </figure>
  );
}
