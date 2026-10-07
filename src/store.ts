export type Sample = { id: number; url: string; emb: Float32Array };
export type Klass = { id: number; name: string; samples: Sample[] };
export type State = { classes: Klass[]; version: number };
export type Action =
  | { type: 'addClass' }
  | { type: 'rename'; id: number; name: string }
  | { type: 'deleteClass'; id: number }
  | { type: 'addSample'; id: number; sample: Sample }
  | { type: 'deleteSample'; id: number; sampleId: number }
  | { type: 'clear'; id: number }
  | { type: 'load'; classes: Klass[] };

export const COLORS = ['#ff8a4c', '#8b6cff', '#22d3ee', '#f43f73', '#a3e635', '#facc15', '#e879f9', '#38bdf8'];
export const colorOf = (i: number) => COLORS[i % COLORS.length];

let nextId = 1;
export const uid = () => nextId++;

export const newClass = (n: number): Klass => ({ id: uid(), name: `Class ${n}`, samples: [] });
export const initState = (): State => ({ classes: [newClass(1), newClass(2)], version: 0 });

const mapClass = (s: State, id: number, fn: (k: Klass) => Klass) => s.classes.map((k) => (k.id === id ? fn(k) : k));

// `version` bumps on every training-data change so the UI can tell when the model is out of date.
export function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'addClass':
      return { classes: [...s.classes, newClass(s.classes.length + 1)], version: s.version + 1 };
    case 'rename':
      return { ...s, classes: mapClass(s, a.id, (k) => ({ ...k, name: a.name })) };
    case 'deleteClass':
      return { classes: s.classes.filter((k) => k.id !== a.id), version: s.version + 1 };
    case 'addSample':
      if (!s.classes.some((k) => k.id === a.id)) return s;
      return { classes: mapClass(s, a.id, (k) => ({ ...k, samples: [...k.samples, a.sample] })), version: s.version + 1 };
    case 'deleteSample':
      return {
        classes: mapClass(s, a.id, (k) => ({ ...k, samples: k.samples.filter((x) => x.id !== a.sampleId) })),
        version: s.version + 1,
      };
    case 'clear':
      return { classes: mapClass(s, a.id, (k) => ({ ...k, samples: [] })), version: s.version + 1 };
    case 'load':
      return { classes: a.classes, version: s.version + 1 };
  }
}
