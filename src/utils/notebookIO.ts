import { db } from '../db/database';
import type { Notebook, Page, SourceFile, Template } from '../db/types';
import { nanoid } from 'nanoid';

const FORMAT = 'blurt-notebook';
const VERSION = 1;

interface ExportEnvelope {
  format: string;
  version: number;
  exportedAt: number;
  notebook: Notebook;
  pages: Page[];
  sources: SerializedSource[];
}

interface SerializedSource extends Omit<SourceFile, 'data'> {
  data: string; // base64
}

function bufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export async function exportNotebook(notebookId: string): Promise<void> {
  const notebook = await db.notebooks.get(notebookId);
  if (!notebook) throw new Error('Notebook not found');

  const pages = await db.pages.where('notebookId').equals(notebookId).toArray();
  const sources = await db.sources.where('notebookId').equals(notebookId).toArray();

  const serializedSources: SerializedSource[] = sources.map((s) => {
    const { data, ...rest } = s;
    return { ...rest, data: bufferToBase64(data) };
  });

  const envelope: ExportEnvelope = {
    format: FORMAT,
    version: VERSION,
    exportedAt: Date.now(),
    notebook,
    pages,
    sources: serializedSources,
  };

  const blob = new Blob([JSON.stringify(envelope)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = notebook.name.replace(/[^a-z0-9-_]+/gi, '_');
  a.download = `${safeName || 'notebook'}.blurt.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface ImportResult {
  notebookId: string;
  name: string;
  pages: number;
  sources: number;
}

export async function importNotebook(file: File): Promise<ImportResult> {
  const text = await file.text();
  let envelope: ExportEnvelope;
  try {
    envelope = JSON.parse(text);
  } catch {
    throw new Error('This file is not a valid Blurt notebook.');
  }

  if (envelope.format !== FORMAT) {
    throw new Error('Unrecognized file format. Please use a .blurt.json file exported from Blurt.');
  }

  const now = Date.now();
  const newNotebookId = nanoid();
  const idMap = new Map<string, string>();

  const notebook: Notebook = {
    ...envelope.notebook,
    id: newNotebookId,
    createdAt: now,
    updatedAt: now,
  };

  const pages: Page[] = envelope.pages.map((p) => {
    const newPageId = nanoid();
    idMap.set(p.id, newPageId);
    const newTemplates: Template[] = p.templates.map((t) => ({
      ...t,
      id: nanoid(),
      createdAt: t.createdAt,
      updatedAt: now,
    }));
    return {
      ...p,
      id: newPageId,
      notebookId: newNotebookId,
      templates: newTemplates,
      createdAt: now,
      updatedAt: now,
      storageStrength: 1.0,
      lastReviewed: 0,
      dueDate: now,
      intervalMs: 1000 * 60 * 60 * 24,
    };
  });

  const sources: SourceFile[] = envelope.sources.map((s) => ({
    ...s,
    id: nanoid(),
    notebookId: newNotebookId,
    createdAt: now,
    data: base64ToBuffer(s.data),
  }));

  await db.transaction('rw', db.notebooks, db.pages, db.sources, async () => {
    await db.notebooks.add(notebook);
    if (pages.length) await db.pages.bulkAdd(pages);
    if (sources.length) await db.sources.bulkAdd(sources);
  });

  return {
    notebookId: newNotebookId,
    name: notebook.name,
    pages: pages.length,
    sources: sources.length,
  };
}
