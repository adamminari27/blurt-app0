import type { Template, TemplateType } from '../db/types';
import { nanoid } from 'nanoid';

export function createTemplate(type: TemplateType, title?: string): Template {
  const now = Date.now();
  const id = nanoid();
  const base = { id, createdAt: now, updatedAt: now };
  const defaultTitle = title || defaultTitleFor(type);
  switch (type) {
    case 'plain':
      return { ...base, type: 'plain', title: defaultTitle, text: '' };
    case 'table':
      return { ...base, type: 'table', title: defaultTitle, columns: ['Column 1', 'Column 2'], rows: [['', '']] };
    case 'equation':
      return { ...base, type: 'equation', title: defaultTitle, problem: '', solution: '', answer: '' };
    case 'bullet':
      return { ...base, type: 'bullet', title: defaultTitle, items: [''] };
    case 'flashcard':
      return { ...base, type: 'flashcard', title: defaultTitle, front: '', back: '' };
    case 'drawing':
      return { ...base, type: 'drawing', title: defaultTitle, strokes: [], width: 600, height: 400 };
  }
}

export function defaultTitleFor(type: TemplateType): string {
  switch (type) {
    case 'plain': return 'Plain Text Note';
    case 'table': return 'Table';
    case 'equation': return 'Equation';
    case 'bullet': return 'Bullet List';
    case 'flashcard': return 'Flashcard';
    case 'drawing': return 'Freehand Drawing';
  }
}

export const TEMPLATE_TYPES: TemplateType[] = ['plain', 'table', 'equation', 'bullet', 'flashcard', 'drawing'];
