import { useState, useEffect, useRef } from 'react';
import { useNotebooks } from '../hooks/useStorage';
import { db } from '../db/database';
import type { Notebook, Page } from '../db/types';
import { Modal, ConfirmDialog } from '../components/Modal';
import { ThemeSettings } from '../components/ThemeSettings';
import { getGlobalStreak } from '../hooks/useBlurt';
import { exportNotebook, importNotebook, type ImportResult } from '../utils/notebookIO';
import {
  BookOpen, Plus, Trash2, Pencil, BookMarked, ArrowRight, Flame, Settings as SettingsIcon, Clock,
  Download, Upload, ChevronDown, FileUp, FilePlus,
} from 'lucide-react';

function formatRelativeTime(ts: number): string {
  if (!ts) return 'never';
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

interface Props {
  onOpen: (id: string) => void;
}

export function NotebookList({ onOpen }: Props) {
  const { notebooks, loading, createNotebook, renameNotebook, deleteNotebook } = useNotebooks();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState<Notebook | null>(null);
  const [renameVal, setRenameVal] = useState('');
  const [deleting, setDeleting] = useState<Notebook | null>(null);
  const [themeOpen, setThemeOpen] = useState(false);
  const [stats, setStats] = useState<Record<string, { pages: number; mastery: number; lastUsed: number }>>({});
  const [streak, setStreak] = useState(0);
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const newMenuRef = useRef<HTMLDivElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getGlobalStreak().then((s) => setStreak(s.streak));
  }, []);

  useEffect(() => {
    if (!newMenuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (newMenuRef.current && !newMenuRef.current.contains(e.target as Node)) setNewMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [newMenuOpen]);

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const result = await importNotebook(file);
      await refresh();
      setImportResult(result);
    } catch (err: any) {
      setImportError(err?.message || 'Failed to import notebook.');
    }
  };

  const handleExport = async (id: string) => {
    setExportingId(id);
    try {
      await exportNotebook(id);
    } catch (err: any) {
      setImportError(err?.message || 'Failed to export notebook.');
    }
    setExportingId(null);
  };

  useEffect(() => {
    (async () => {
      const map: Record<string, { pages: number; mastery: number; lastUsed: number }> = {};
      for (const nb of notebooks) {
        const pages = await db.pages.where('notebookId').equals(nb.id).toArray();
        const recs = await db.accuracy.where('notebookId').equals(nb.id).toArray();
        const mastery = recs.length ? Math.round(recs.reduce((s, r) => s + r.accuracy, 0) / recs.length) : 0;
        const lastReviewed = pages.length ? Math.max(...pages.map((p) => p.lastReviewed || 0)) : 0;
        map[nb.id] = {
          pages: pages.length,
          mastery,
          lastUsed: lastReviewed || nb.updatedAt,
        };
      }
      setStats(map);
    })();
  }, [notebooks]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await createNotebook(newName.trim());
    setNewName('');
    setCreating(false);
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-0)' }}>
      <div className="max-w-5xl mx-auto px-5 py-10">
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3 spin-on-hover cursor-pointer" onClick={() => setThemeOpen(true)} title="Settings" role="button" tabIndex={0}>
            <div className="relative w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent)', color: 'var(--btn-primary-text)' }}>
              <BookMarked size={24} className="logo-icon absolute" />
              <SettingsIcon size={24} className="gear-icon absolute" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-0)' }}>Blurt</h1>
              <p className="text-sm" style={{ color: 'var(--text-3)' }}>The swiss army knife of memorization</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {streak > 0 && (
              <span className="chip flex items-center gap-1" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }} title="Consecutive days with at least one completed session">
                <Flame size={14} /> {streak} day{streak !== 1 ? 's' : ''}
              </span>
            )}
            <div className="relative" ref={newMenuRef}>
              <button className="btn-primary" onClick={() => setNewMenuOpen((v) => !v)}>
                <Plus size={16} /> New notebook <ChevronDown size={14} className="opacity-70" />
              </button>
              {newMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 surface shadow-xl z-20 animate-pop overflow-hidden" style={{ borderColor: 'var(--border-soft)' }}>
                  <button
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left hover:bg-[var(--accent-soft)] transition"
                    style={{ color: 'var(--text-1)' }}
                    onClick={() => { setNewMenuOpen(false); setCreating(true); }}
                  >
                    <FilePlus size={16} style={{ color: 'var(--accent)' }} /> Start from scratch
                  </button>
                  <button
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left hover:bg-[var(--accent-soft)] transition"
                    style={{ color: 'var(--text-1)' }}
                    onClick={() => { setNewMenuOpen(false); importInputRef.current?.click(); }}
                  >
                    <FileUp size={16} style={{ color: 'var(--accent)' }} /> Import notebook
                  </button>
                </div>
              )}
            </div>
            <input ref={importInputRef} type="file" accept=".json,.blurt.json,application/json" onChange={handleImportFile} className="hidden" />
          </div>
        </header>

        {loading ? (
          <div className="text-center py-20" style={{ color: 'var(--text-3)' }}>Loading…</div>
        ) : notebooks.length === 0 ? (
          <EmptyState onCreate={() => setCreating(true)} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {notebooks.map((nb) => {
              const s = stats[nb.id] || { pages: 0, mastery: 0, lastUsed: 0 };
              return (
                <div key={nb.id} className="surface p-4 cursor-pointer hover:border-amber-500/40 transition group animate-fade-in" onClick={() => onOpen(nb.id)}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <BookOpen size={20} style={{ color: 'var(--accent)' }} />
                      <h3 className="font-semibold truncate" style={{ color: 'var(--text-0)' }}>{nb.name}</h3>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                      <button className="btn-ghost !p-1.5" onClick={(e) => { e.stopPropagation(); handleExport(nb.id); }} aria-label="Export" disabled={exportingId === nb.id} title="Export notebook"><Download size={14} /></button>
                      <button className="btn-ghost !p-1.5" onClick={(e) => { e.stopPropagation(); setRenaming(nb); setRenameVal(nb.name); }} aria-label="Rename"><Pencil size={14} /></button>
                      <button className="btn-ghost !p-1.5" onClick={(e) => { e.stopPropagation(); setDeleting(nb); }} aria-label="Delete"><Trash2 size={14} /></button>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs flex-wrap" style={{ color: 'var(--text-3)' }}>
                    <span>{s.pages} pages</span>
                    {s.mastery > 0 && (
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full" style={{ background: s.mastery >= 80 ? 'var(--success)' : s.mastery >= 50 ? 'var(--warning)' : 'var(--error)' }} />
                        {s.mastery}% mastery
                      </span>
                    )}
                    {s.pages > 0 && (
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {formatRelativeTime(s.lastUsed)}
                      </span>
                    )}
                    <span className="ml-auto flex items-center gap-1 group-hover:text-amber-400 transition">Open <ArrowRight size={13} /></span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal open={creating} onClose={() => setCreating(false)} title="New notebook" footer={<><button className="btn-ghost" onClick={() => setCreating(false)}>Cancel</button><button className="btn-primary" onClick={handleCreate}>Create</button></>}>
        <label className="label block mb-1.5">Name</label>
        <input className="input" autoFocus placeholder="e.g. Organic Chemistry, CS Fundamentals" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreate()} />
      </Modal>

      <Modal open={!!renaming} onClose={() => setRenaming(null)} title="Rename notebook" footer={<><button className="btn-ghost" onClick={() => setRenaming(null)}>Cancel</button><button className="btn-primary" onClick={async () => { if (renaming && renameVal.trim()) { await renameNotebook(renaming.id, renameVal.trim()); setRenaming(null); } }}>Save</button></>}>
        <input className="input" autoFocus value={renameVal} onChange={(e) => setRenameVal(e.target.value)} />
      </Modal>

      <ConfirmDialog open={!!deleting} title="Delete notebook?" message={`"${deleting?.name}" and all its pages, sources, and history will be permanently removed.`} onConfirm={async () => { if (deleting) await deleteNotebook(deleting.id); setDeleting(null); }} onCancel={() => setDeleting(null)} />

      <Modal open={!!importResult} onClose={() => setImportResult(null)} title="Notebook imported" footer={<button className="btn-primary" onClick={() => setImportResult(null)}>Done</button>}>
        <p className="text-sm" style={{ color: 'var(--text-2)' }}>
          "{importResult?.name}" was imported with {importResult?.pages} page{(importResult?.pages || 0) !== 1 ? 's' : ''} and {importResult?.sources} source file{(importResult?.sources || 0) !== 1 ? 's' : ''}.
        </p>
      </Modal>

      <Modal open={!!importError} onClose={() => setImportError(null)} title="Import failed" footer={<button className="btn-primary" onClick={() => setImportError(null)}>Dismiss</button>}>
        <p className="text-sm" style={{ color: 'var(--error)' }}>{importError}</p>
      </Modal>

      <ThemeSettings open={themeOpen} onClose={() => setThemeOpen(false)} />
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="surface p-12 text-center">
      <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: 'var(--accent-soft)' }}>
        <BookOpen size={32} style={{ color: 'var(--accent)' }} />
      </div>
      <h2 className="text-lg font-semibold mb-1" style={{ color: 'var(--text-0)' }}>No notebooks yet</h2>
      <p className="text-sm mb-5" style={{ color: 'var(--text-3)' }}>Create your first notebook to start studying with active recall.</p>
      <button className="btn-primary" onClick={onCreate}><Plus size={16} /> Create notebook</button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-semibold mb-1" style={{ color: 'var(--text-0)' }}>{title}</h3>
      <div style={{ color: 'var(--text-2)' }}>{children}</div>
    </div>
  );
}
