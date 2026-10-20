export const TIMELINE_S = 3;

export type Sender = 'X' | 'Y';

export interface Interval {
  start: number;
  end: number;
}

export interface Scenario {
  id: 'clear' | 'hidden';
  label: string;
  hidden: boolean;
  transmissions: (Interval & {from: Sender})[];
  waits: (Interval & {node: Sender})[];
  captions: {at: number; text: string}[];
}

export const SCENARIOS: readonly Scenario[] = [
  {
    id: 'clear',
    label: 'Ακούν ο ένας τον άλλον',
    hidden: false,
    transmissions: [
      {from: 'X', start: 0, end: 0.5},
      {from: 'Y', start: 0.7, end: 1.2},
    ],
    waits: [{node: 'Y', start: 0.2, end: 0.7}],
    captions: [
      {at: 0, text: 'Ο X εκπέμπει.'},
      {at: 0.2, text: 'Ο Y ακούει ότι η συχνότητα είναι κατειλημμένη και περιμένει.'},
      {at: 0.5, text: 'Ο M λαμβάνει το μήνυμα του X.'},
      {at: 0.7, text: 'Ο Y εκπέμπει μόλις ελευθερωθεί η συχνότητα.'},
      {at: 1.2, text: 'Και τα δύο μηνύματα έφτασαν.'},
    ],
  },
  {
    id: 'hidden',
    label: 'Κρυφός κόμβος',
    hidden: true,
    transmissions: [
      {from: 'X', start: 0, end: 0.5},
      {from: 'Y', start: 0.2, end: 0.7},
    ],
    waits: [],
    captions: [
      {at: 0, text: 'Ο X εκπέμπει.'},
      {at: 0.2, text: 'Ο Y δεν ακούει τον X πίσω από τον λόφο και εκπέμπει κι αυτός.'},
      {at: 0.3, text: 'Στον M οι δύο εκπομπές επικαλύπτονται.'},
      {
        at: 0.7,
        text: 'Ο M δεν λαμβάνει κανένα από τα δύο. Όσο περισσότεροι κόμβοι εκπέμπουν, τόσο συχνότερα συμβαίνει.',
      },
    ],
  },
];

export const IDLE_CAPTION = 'Πάτησε «Παίξε» για να δεις τι συμβαίνει στη συχνότητα.';

export const DUTY_CYCLE_LINES = [
  'Κάθε κόμβος μπορεί να εκπέμπει έως 6 λεπτά την ώρα (10%).',
  'Τα 6 λεπτά είναι το όριο για κάθε κόμβο. Η συχνότητα όμως είναι κοινή: κάθε εκπομπή του κόμβου σου την καταλαμβάνει για όλους.',
] as const;

export function overlaps(scenario: Scenario): Interval[] {
  const result: Interval[] = [];
  const list = scenario.transmissions;
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      const start = Math.max(list[i].start, list[j].start);
      const end = Math.min(list[i].end, list[j].end);
      if (start < end) result.push({start, end});
    }
  }
  return result;
}

export function receivedAtM(scenario: Scenario): Sender[] {
  const collided = overlaps(scenario);
  return scenario.transmissions
    .filter((tx) => !collided.some((o) => o.start < tx.end && tx.start < o.end))
    .map((tx) => tx.from);
}

export function captionAt(scenario: Scenario, timeS: number): string {
  return scenario.captions.filter((c) => c.at <= timeS).at(-1)?.text ?? '';
}
