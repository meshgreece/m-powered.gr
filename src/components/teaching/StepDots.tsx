import styles from './teaching.module.css';

export function StepDots({step, count}: {step: number; count: number}) {
  return (
    <div className={styles.stepDots}>
      <span className={styles.dots} aria-hidden="true">
        {Array.from({length: count}, (_, i) => (
          <span key={i} className={i <= step ? styles.dotOn : styles.dot} />
        ))}
      </span>
      <span>
        Βήμα {step + 1} από {count}
      </span>
    </div>
  );
}
