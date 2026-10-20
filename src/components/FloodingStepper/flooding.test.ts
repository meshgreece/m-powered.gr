import {describe, expect, it} from 'vitest';

import {simulateFlood} from './flooding';

const transmitters = (hopLimit: number) =>
  simulateFlood(hopLimit).map((step) => step.transmitter);

describe('managed flooding simulation', () => {
  it('follows the default sequence with hop limit 3', () => {
    expect(transmitters(3)).toEqual([null, 'A', 'C', 'D', 'F', null]);
  });

  it('silences waiting nodes that hear a rebroadcast', () => {
    const final = simulateFlood(3).at(-1)!;
    expect(final.nodes.B.state).toBe('silenced');
    expect(final.nodes.E.state).toBe('silenced');
    expect(final.nodes.G.state).toBe('silenced');
  });

  it('records the hop limit each node received', () => {
    const final = simulateFlood(3).at(-1)!;
    expect(final.nodes.C.hop).toBe(3);
    expect(final.nodes.D.hop).toBe(2);
    expect(final.nodes.F.hop).toBe(1);
    expect(final.nodes.H).toEqual({state: 'received', hop: 0});
  });

  it('gives far listeners a shorter wait than near ones', () => {
    const {nodes} = simulateFlood(3)[1];
    expect(nodes.C.wait).toBe('short');
    expect(nodes.B.wait).toBe('long');
  });

  it('acknowledges the sender once it hears the first rebroadcast', () => {
    const steps = simulateFlood(3);
    expect(steps[1].acked).toBe(false);
    expect(steps[2].acked).toBe(true);
  });

  it('marks nodes that already have the message as duplicates', () => {
    const steps = simulateFlood(3);
    expect(steps[2].duplicates).toEqual([]);
    expect(steps[3].duplicates).toEqual(['C']);
  });

  it('stops early with smaller hop limits', () => {
    expect(transmitters(1)).toEqual([null, 'A', 'C', null]);
    expect(transmitters(2)).toEqual([null, 'A', 'C', 'D', null]);
  });

  it('lets H repeat to nobody new with hop limit above 3', () => {
    const steps = simulateFlood(5);
    expect(steps.map((s) => s.transmitter)).toEqual([null, 'A', 'C', 'D', 'F', 'H', null]);
    expect(steps[5].transmittedHop).toBe(1);
    expect(steps[5].duplicates).toEqual(['F']);
  });

  it('uses the brief captions', () => {
    const captions = simulateFlood(3).map((s) => s.caption);
    expect(captions).toEqual([
      'Ο A θα στείλει μήνυμα στο κανάλι με hop limit 3.',
      'Ο A εκπέμπει. Οι B και C το ακούν και περιμένουν λίγο πριν το επαναλάβουν.',
      'Ο C είναι πιο μακριά, οπότε επαναλαμβάνει πρώτος. Ο B τον ακούει και δεν εκπέμπει. Ο A ξέρει ότι το μήνυμα προχώρησε.',
      'Ο D επαναλαμβάνει. Ο E τον ακούει και σωπαίνει. Ο C το έχει ήδη και το αγνοεί.',
      'Ο F επαναλαμβάνει με hop limit 0. Ο H το λαμβάνει αλλά δεν το επαναλαμβάνει.',
      'Όλοι οι κόμβοι έλαβαν το μήνυμα με 4 εκπομπές αντί για 8.',
    ]);
  });

  it('explains unreached nodes and wasted repeats', () => {
    expect(simulateFlood(1).at(-1)!.caption).toBe('Με hop limit 1, οι F, G και H δεν το έλαβαν.');
    expect(simulateFlood(2).at(-1)!.caption).toBe('Με hop limit 2, ο H δεν το έλαβε.');
    const four = simulateFlood(4).map((s) => s.caption);
    expect(four[4]).toBe('Ο F επαναλαμβάνει. Ο G τον ακούει και σωπαίνει. Ο H το λαμβάνει και περιμένει.');
    expect(four[5]).toBe('Ο H επαναλαμβάνει, αλλά μόνο ο F τον ακούει και το έχει ήδη.');
    expect(four[6]).toBe(
      'Ο H επανέλαβε το μήνυμα χωρίς να το ακούσει κανείς νέος. Μεγαλύτερο hop limit από όσο χρειάζεται σπαταλά airtime.',
    );
  });
});
