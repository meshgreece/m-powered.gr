import type {ReactNode} from 'react';

import styles from './teaching.module.css';

export function Takeaway({children}: {children: ReactNode}) {
  return (
    <p className={styles.takeaway}>
      <svg className={styles.takeawayIcon} width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
        <circle cx="9" cy="9" r="7.5" strokeWidth="1.5" />
        <path d="M9 8v4.5M9 5.2v.1" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <span>
        <strong>Τι να κρατήσεις:</strong> {children}
      </span>
    </p>
  );
}
