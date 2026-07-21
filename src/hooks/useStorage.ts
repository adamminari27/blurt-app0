import { useCallback, useEffect, useState } from 'react';
import { db } from '../db/database';
import type { Notebook, Page, SourceFile, Template, TemplateType } from '../db/types';
import { nanoid } from 'nanoid';

export function useNotebooks() {
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const all = await db.notebooks.orderBy('updatedAt').reverse().toArray();
    setNotebooks(all);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createNotebook = useCallback(async (name: string) => {
    const now = Date.now();
    const nb: Notebook = {
      id: nanoid(), name, createdAt: now, updatedAt: now,
    };
    await db.notebooks.add(nb);
    await refresh();
    return nb;
  }, [refresh]);

  const renameNotebook = useCallback(async (id: string, name: string) => {
    await db.notebooks.update(id, { name, updatedAt: Date.now() });
    await refresh();
  }, [refresh]);

  const deleteNotebook = useCallback(async (id: string) => {
    await db.transaction('rw', db.notebooks, db.pages, db.sources, db.accuracy, async () => {
      await db.pages.where('notebookId').equals(id).delete();
      await db.sources.where('notebookId').equals(id).delete();
      await db.accuracy.where('notebookId').equals(id).delete();
      await db.notebooks.delete(id);
    });
    await refresh();
  }, [refresh]);

  return { notebooks, loading, createNotebook, renameNotebook, deleteNotebook, refresh };
}

export function usePages(notebookId: string | null) {
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!notebookId) { setPages([]); setLoading(false); return; }
    const all = await db.pages.where('notebookId').equals(notebookId).sortBy('order');
    setPages(all);
    setLoading(false);
  }, [notebookId]);

  useEffect(() => { refresh(); }, [refresh]);

  const createPage = useCallback(async (title: string, templateType: TemplateType) => {
    if (!notebookId) return null;
    const count = await db.pages.where('notebookId').equals(notebookId).count();
    const now = Date.now();
    const page: Page = {
      id: nanoid(), notebookId, title, order: count, templateType,
      templates: [], createdAt: now, updatedAt: now,
      storageStrength: 1.0, lastReviewed: 0, dueDate: now, intervalMs: 1000 * 60 * 60 * 24,
    };
    await db.pages.add(page);
    await db.notebooks.update(notebookId, { updatedAt: now });
    await refresh();
    return page;
  }, [notebookId, refresh]);

  const updatePage = useCallback(async (id: string, patch: Partial<Page>) => {
    await db.pages.update(id, { ...patch, updatedAt: Date.now() });
    if (notebookId) await db.notebooks.update(notebookId, { updatedAt: Date.now() });
    await refresh();
  }, [notebookId, refresh]);

  const deletePage = useCallback(async (id: string) => {
    await db.pages.delete(id);
    await db.accuracy.where('pageId').equals(id).delete();
    await refresh();
  }, [refresh]);

  const addTemplate = useCallback(async (pageId: string, template: Template) => {
    const page = await db.pages.get(pageId);
    if (!page) return;
    const templates = [...page.templates, template];
    await db.pages.update(pageId, { templates, updatedAt: Date.now() });
    if (notebookId) await db.notebooks.update(notebookId, { updatedAt: Date.now() });
    await refresh();
  }, [notebookId, refresh]);

  const updateTemplate = useCallback(async (pageId: string, template: Template) => {
    const page = await db.pages.get(pageId);
    if (!page) return;
    const templates = page.templates.map((t) => (t.id === template.id ? template : t));
    await db.pages.update(pageId, { templates, updatedAt: Date.now() });
    if (notebookId) await db.notebooks.update(notebookId, { updatedAt: Date.now() });
    await refresh();
  }, [notebookId, refresh]);

  const deleteTemplate = useCallback(async (pageId: string, templateId: string) => {
    const page = await db.pages.get(pageId);
    if (!page) return;
    const templates = page.templates.filter((t) => t.id !== templateId);
    await db.pages.update(pageId, { templates, updatedAt: Date.now() });
    await refresh();
  }, [refresh]);

  return {
    pages, loading, createPage, updatePage, deletePage,
    addTemplate, updateTemplate, deleteTemplate, refresh,
  };
}

export function useSources(notebookId: string | null) {
  const [sources, setSources] = useState<SourceFile[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!notebookId) { setSources([]); setLoading(false); return; }
    const all = await db.sources.where('notebookId').equals(notebookId).toArray();
    setSources(all.sort((a, b) => b.createdAt - a.createdAt));
    setLoading(false);
  }, [notebookId]);

  useEffect(() => { refresh(); }, [refresh]);

  const addSource = useCallback(async (src: SourceFile) => {
    await db.sources.add(src);
    await refresh();
  }, [refresh]);

  const deleteSource = useCallback(async (id: string) => {
    await db.sources.delete(id);
    await refresh();
  }, [refresh]);

  return { sources, loading, addSource, deleteSource, refresh };
}
