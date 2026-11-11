import {useId} from 'react';

import styles from './teaching.module.css';

export function SegmentedControl<T extends string | number>({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string;
  options: readonly {value: T; label: string}[];
  value: T;
  onChange: (value: T) => void;
}) {
  const name = useId();
  return (
    <fieldset className={styles.group}>
      <legend className={styles.segmentLegend}>{legend}</legend>
      <div className={styles.segments}>
        {options.map((option) => (
          <label key={option.value} className={styles.segment}>
            <input
              type="radio"
              name={name}
              className={styles.radio}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span className={styles.segmentText}>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
