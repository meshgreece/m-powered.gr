import {useState} from 'react';
import clsx from 'clsx';

import {MetricTile, SegmentedControl, StepCaption, Takeaway, WidgetFrame} from '@site/src/components/teaching';
import {
  ANTENNA_HEIGHTS_M,
  DEFAULT_TERRAIN,
  PATH_STATUS_LABELS,
  TERRAIN_DISTANCES_KM,
  TERRAIN_HILLS_M,
  analyzeTerrain,
  groundHeightM,
  obstacleCost,
  profileHeightMaxM,
  terrainCaption,
} from './terrain';
import type {TerrainInput} from './terrain';
import styles from './styles.module.css';

const W = 680;
const PAD = 36;
const TOP = 24;
const BASE = 236;
const HEIGHT = 260;

const distanceOptions = TERRAIN_DISTANCES_KM.map((v) => ({value: v, label: `${v} km`}));
const hillOptions = TERRAIN_HILLS_M.map((v) => ({value: v, label: v === 0 ? 'Κανένα' : `Λόφος ${v} m`}));
const heightOptions = ANTENNA_HEIGHTS_M.map((v) => ({value: v, label: `${v} m`}));

export default function TerrainProfile() {
  const [input, setInput] = useState<TerrainInput>(DEFAULT_TERRAIN);
  const set = (patch: Partial<TerrainInput>) => setInput((prev) => ({...prev, ...patch}));

  const result = analyzeTerrain(input);
  const {status, profile} = result;
  const d = input.distanceKm;
  const hMax = profileHeightMaxM(input);
  const x = (km: number) => PAD + ((W - 2 * PAD) * km) / d;
  const y = (m: number) => BASE - ((BASE - TOP) * m) / hMax;
  const pts = (list: [number, number][]) => list.map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`).join(' ');

  const upper = profile.map((p): [number, number] => [x(p.xKm), y(p.losM + p.radiusM)]);
  const lower = profile.map((p): [number, number] => [x(p.xKm), y(p.losM - p.radiusM)]).reverse();
  const ground = profile.map((p): [number, number] => [x(p.xKm), y(p.groundM)]);
  const groundA = y(groundHeightM(0, input));
  const groundB = y(groundHeightM(d, input));
  const tint = `var(--tw-${status === 'clear' ? 'green' : status === 'partial' ? 'amber' : 'red'})`;
  const cost = obstacleCost(result);

  return (
    <WidgetFrame
      title="Ύψος, απόσταση και εμπόδια"
      note="Απλοποιημένο μοντέλο σε ανοιχτό έδαφος. Δέντρα, κτίρια και το πραγματικό ανάγλυφο προσθέτουν κι άλλες απώλειες."
    >
      <div className={styles.chipRow}>
        <span className={clsx(styles.chip, styles[status])}>{PATH_STATUS_LABELS[status]}</span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${HEIGHT}`}
        width="100%"
        className={styles.svg}
        role="img"
        aria-label={`Προφίλ εδάφους ${d} km. Κόμβος A στα ${input.heightAM} m, κόμβος B στα ${input.heightBM} m. ${PATH_STATUS_LABELS[status]}.`}
      >
        <polygon
          points={pts([...upper, ...lower])}
          fill={`color-mix(in srgb, ${tint} 15%, transparent)`}
          stroke={tint}
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />
        <line x1={x(0)} y1={y(profile[0].losM)} x2={x(d)} y2={y(profile[profile.length - 1].losM)} stroke="var(--tw-ink)" strokeWidth="1.5" />
        <polygon
          points={pts([[0, groundA], ...ground, [W, groundB], [W, HEIGHT], [0, HEIGHT]])}
          fill="var(--tw-ground)"
          stroke="var(--tw-ground-line)"
          strokeWidth="1.5"
        />
        <line x1={x(0)} y1={groundA} x2={x(0)} y2={y(input.heightAM)} stroke="var(--tw-muted)" strokeWidth="3" />
        <line x1={x(d)} y1={groundB} x2={x(d)} y2={y(input.heightBM)} stroke="var(--tw-muted)" strokeWidth="3" />
        {[
          ['A', input.heightAM, 0],
          ['B', input.heightBM, d],
        ].map(([label, h, km]) => (
          <g key={label}>
            <circle cx={x(km as number)} cy={y(h as number)} r="11" fill="var(--tw-ink)" />
            <text x={x(km as number)} y={y(h as number)} textAnchor="middle" dominantBaseline="central" fontSize="12" fontWeight="600" fill="var(--tw-on-ink)">
              {label}
            </text>
          </g>
        ))}
      </svg>
      <p className={styles.scaleNote}>{d} km · το ύψος είναι μεγεθυμένο για να φαίνεται</p>
      <div className={styles.controls}>
        <SegmentedControl legend="Απόσταση" options={distanceOptions} value={d} onChange={(distanceKm) => set({distanceKm})} />
        <SegmentedControl legend="Εμπόδιο στο μέσο" options={hillOptions} value={input.hillM} onChange={(hillM) => set({hillM})} />
        <SegmentedControl legend="Ύψος κεραίας A" options={heightOptions} value={input.heightAM} onChange={(heightAM) => set({heightAM})} />
        <SegmentedControl legend="Ύψος κεραίας B" options={heightOptions} value={input.heightBM} onChange={(heightBM) => set({heightBM})} />
      </div>
      <div className={styles.tiles}>
        <MetricTile label="Ακτίνα ζώνης Fresnel στο μέσο" value={Math.round(result.midRadiusM)} unit="m" />
        <MetricTile label="Κόστος από το έδαφος" value={cost.value}>
          {cost.hint}
        </MetricTile>
      </div>
      <StepCaption>{terrainCaption(input, result)}</StepCaption>
      <Takeaway>
        η ζώνη Fresnel μεγαλώνει με την απόσταση. Σε μακρινές ζεύξεις χρειάζεται περισσότερο ύψος για να μείνει κατά το μεγαλύτερο μέρος ελεύθερη, ακόμη κι όταν δεν υπάρχει λόφος.
      </Takeaway>
    </WidgetFrame>
  );
}
