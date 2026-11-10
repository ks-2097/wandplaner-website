export type Edition = {
  id: string;
  name: string;
  /** Short story shown on the editions page */
  story: string;
  paper: string;
  ink: string;
  accent: string;
};

/**
 * The curated colourways. "aubergine" is the original; the other two are drafts that
 * reuse the same drawing with a different paper colour and accent ink.
 */
export const EDITIONS: Edition[] = [
  {
    id: 'aubergine',
    name: 'Aubergine',
    story: 'Die erste Edition: dunkle Aubergine auf hellem Lila, so wie der Planer an Konrads Wand hängt.',
    paper: '#d8cde6',
    ink: '#141414',
    accent: '#4b1650',
  },
  {
    id: 'salbei',
    name: 'Salbei',
    story: 'Ruhiges Graugrün mit Tannengrün. Für Küchen, Flure und Wände mit viel Holz.',
    paper: '#d6dfd2',
    ink: '#141414',
    accent: '#1e4032',
  },
  {
    id: 'sand',
    name: 'Sand',
    story: 'Warmes Sandbeige mit Rostrot. Passt zu hellen Räumen und Naturtönen.',
    paper: '#ece2d3',
    ink: '#141414',
    accent: '#7a2a18',
  },
];

export const editionById = (id: string): Edition => EDITIONS.find((e) => e.id === id) ?? EDITIONS[0];
