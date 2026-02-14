import React from 'react';
import styles from './styles.module.css';

export default function StatusWidget() {
  return (
    <div className={styles.statusWidget}>
      <span className={styles.iconContainer}>
        <div className={styles.pulseContainer}>
          <div className={styles.pulseRing}></div>
          <div className={styles.pulseDot}></div>
        </div>
      </span>
      <span className={styles.statusText}>Mesh Greece</span>
    </div>
  );
}
