import Dexie, { type Table } from 'dexie';
import type {
  Notebook,
  Page,
  SourceFile,
  AccuracyRecord,
  AppState,
} from './types';

export class BlurtDB extends Dexie {
  notebooks!: Table<Notebook, string>;
  pages!: Table<Page, string>;
  sources!: Table<SourceFile, string>;
  accuracy!: Table<AccuracyRecord, string>;
  appState!: Table<AppState, string>;

  constructor() {
    super('blurt-db');
    this.version(1).stores({
      notebooks: 'id, name, createdAt, updatedAt',
      pages: 'id, notebookId, order, updatedAt',
      sources: 'id, notebookId, createdAt',
      accuracy: 'id, notebookId, pageId, templateId, timestamp',
    });
    // v2: add fragmentId index on accuracy; notebooks gain streak/lastBlurtDay/nextSessionAt (non-indexed)
    this.version(2).stores({
      notebooks: 'id, name, createdAt, updatedAt',
      pages: 'id, notebookId, order, updatedAt',
      sources: 'id, notebookId, createdAt',
      accuracy: 'id, notebookId, pageId, templateId, fragmentId, timestamp',
    });
    // v3: add NTD scheduler fields to pages (non-indexed, no store change needed)
    this.version(3).stores({
      notebooks: 'id, name, createdAt, updatedAt',
      pages: 'id, notebookId, order, updatedAt',
      sources: 'id, notebookId, createdAt',
      accuracy: 'id, notebookId, pageId, templateId, fragmentId, timestamp',
    }).upgrade((tx) => {
      return tx.table('pages').toCollection().modify((page: any) => {
        if (page.storageStrength === undefined) page.storageStrength = 1.0;
        if (page.lastReviewed === undefined) page.lastReviewed = 0;
        if (page.dueDate === undefined) page.dueDate = page.createdAt || Date.now();
        if (page.intervalMs === undefined) page.intervalMs = 86400000;
      });
    });
    // v4: add appState table for global streak; per-notebook streak/lastBlurtDay/nextSessionAt are legacy (unused)
    this.version(4).stores({
      notebooks: 'id, name, createdAt, updatedAt',
      pages: 'id, notebookId, order, updatedAt',
      sources: 'id, notebookId, createdAt',
      accuracy: 'id, notebookId, pageId, templateId, fragmentId, timestamp',
      appState: 'key',
    });
  }
}

export const db = new BlurtDB();
