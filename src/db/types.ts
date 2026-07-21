// Core data model for Blurt — local-first, no backend.

export type TemplateType =
  | 'plain'
  | 'table'
  | 'equation'
  | 'bullet'
  | 'flashcard'
  | 'drawing';

export interface BaseTemplate {
  id: string;
  type: TemplateType;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export interface PlainTemplate extends BaseTemplate {
  type: 'plain';
  text: string;
}

export interface TableTemplate extends BaseTemplate {
  type: 'table';
  columns: string[];
  rows: string[][];
}

export interface EquationTemplate extends BaseTemplate {
  type: 'equation';
  problem: string; // prompt/context shown in Blurt mode (never obscured)
  solution: string; // multi-line LaTeX worked solution (blanked in Blurt mode)
  answer: string; // plain-text final answer (blanked in Blurt mode)
}

export interface BulletTemplate extends BaseTemplate {
  type: 'bullet';
  items: string[];
}

export interface FlashcardTemplate extends BaseTemplate {
  type: 'flashcard';
  front: string; // prompt, never obscured in Blurt mode
  back: string; // answer, blanked in Blurt mode
}

export interface Point {
  x: number;
  y: number;
}

export interface Stroke {
  points: Point[];
  color: string;
  width: number;
}

export interface DrawingTemplate extends BaseTemplate {
  type: 'drawing';
  strokes: Stroke[]; // the source drawing (reference)
  width: number;
  height: number;
}

export type Template =
  | PlainTemplate
  | TableTemplate
  | EquationTemplate
  | BulletTemplate
  | FlashcardTemplate
  | DrawingTemplate;

export interface Page {
  id: string;
  notebookId: string;
  title: string;
  order: number;
  templateType: TemplateType; // one type per page, enforced
  templates: Template[]; // all share templateType
  createdAt: number;
  updatedAt: number;
  // NTD adaptive scheduler fields (Bjork's New Theory of Disuse)
  storageStrength: number; // S: initialized 1.0, accumulates on recall
  lastReviewed: number;     // timestamp ms of last review
  dueDate: number;          // timestamp ms for next optimal review
  intervalMs: number;       // current spacing interval in ms
}

export interface SourceFile {
  id: string;
  notebookId: string;
  name: string;
  kind: 'pdf' | 'docx' | 'txt' | 'md' | 'image' | 'other';
  mime: string;
  size: number;
  data: ArrayBuffer; // raw file bytes
  pageCount: number;
  createdAt: number;
}

export interface AccuracyRecord {
  id: string;
  notebookId: string;
  pageId: string;
  templateId: string;
  fragmentId: string; // specific fragment (template id, or cell/bullet/sentence id)
  accuracy: number; // 0-100
  weakPoints: string[];
  timestamp: number;
}

export interface Notebook {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  // Legacy per-notebook streak fields — no longer used (global streak lives in appState).
  streak?: number;
  lastBlurtDay?: number;
  nextSessionAt?: number;
}

export interface AppState {
  key: string;
  globalStreak?: number;
  lastStreakDay?: number; // midnight timestamp of last day a session was completed
}

export interface ScoreObject {
  totalScore: number;
  accuracyPercentage: number;
  weakPoints: string[];
  fragmentScores: Record<string, number>;
}

// User input shapes per template type for scoring.
export type UserInput =
  | { type: 'plain'; text: string }
  | { type: 'table'; rows: string[][] }
  | { type: 'equation'; solution: string; answer: string }
  | { type: 'bullet'; items: string[] }
  | { type: 'flashcard'; back: string }
  | { type: 'drawing'; strokes: Stroke[] };

export function emptyInputFor(type: TemplateType): UserInput {
  switch (type) {
    case 'plain': return { type: 'plain', text: '' };
    case 'table': return { type: 'table', rows: [] };
    case 'equation': return { type: 'equation', solution: '', answer: '' };
    case 'bullet': return { type: 'bullet', items: [] };
    case 'flashcard': return { type: 'flashcard', back: '' };
    case 'drawing': return { type: 'drawing', strokes: [] };
  }
}
