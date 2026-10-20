export const PATH_NODES = [
  {id: 'senderPhone', label: 'Το κινητό σου'},
  {id: 'senderNode', label: 'Ο κόμβος σου'},
  {id: 'relay1', label: 'Κόμβος'},
  {id: 'relay2', label: 'Κόμβος'},
  {id: 'recipientNode', label: 'Κόμβος παραλήπτη'},
  {id: 'recipientPhone', label: 'Κινητό παραλήπτη'},
] as const;

export const LINK_LABELS = ['Bluetooth', 'LoRa', 'LoRa', 'LoRa', 'Bluetooth'] as const;

export const NO_INTERNET_LABEL = 'Χωρίς internet';

// activeLink is the index into LINK_LABELS, or null before sending.
export const PATH_STEPS: readonly {activeLink: number | null; caption: string}[] = [
  {activeLink: null, caption: 'Γράψε ένα μήνυμα στην εφαρμογή.'},
  {activeLink: 0, caption: 'Το κινητό στέλνει το μήνυμα στον κόμβο σου μέσω Bluetooth.'},
  {activeLink: 1, caption: 'Ο κόμβος σου το εκπέμπει με LoRa. Όποιος κόμβος το ακούσει μπορεί να το αναμεταδώσει.'},
  {activeLink: 2, caption: 'Κάθε αναμετάδοση είναι ένα hop.'},
  {activeLink: 3, caption: 'Ο κόμβος του παραλήπτη λαμβάνει το μήνυμα.'},
  {activeLink: 4, caption: 'Το κινητό του παραλήπτη το εμφανίζει. Δεν χρειάστηκε internet ή δίκτυο κινητής.'},
];
