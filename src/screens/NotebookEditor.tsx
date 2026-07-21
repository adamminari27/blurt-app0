import { useState, useRef } from 'react';
import { usePages, useSources } from '../hooks/useStorage';
import { buildSource } from '../engine/sourceIngest';
import { createTemplate, defaultTitleFor } from '../engine/templateFactory';
import type { TemplateType } from '../db/types';
import { TemplateEditor } from '../components/TemplateEditor';
import { SourceViewer } from '../components/SourceViewer';
import { ResizablePanes, type PaneState } from '../components/ResizablePanes';
import { Modal, ConfirmDialog } from '../components/Modal';
import {
  ArrowLeft, Plus, FileText, Trash2,
  PanelLeftClose, PanelLeftOpen, Zap, Layers, Settings as SettingsIcon,
} from 'lucide-react';
import { ThemeSettings } from '../components/ThemeSettings';
import { distributeItems, type SessionMode } from '../engine/ntd';

interface Props {
  notebookId: string;
  notebookName: string;
  onBack: () => void;
  onStartBlurt: (itemCount: number, mode: SessionMode) => void;
}

export function NotebookEditor({ notebookId, notebookName, onBack, onStartBlurt }: Props) {
  const { pages, createPage, updatePage, deletePage, addTemplate, updateTemplate, deleteTemplate } = usePages(notebookId);
  const { sources, addSource, deleteSource } = useSources(notebookId);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [activeSourceId, setActiveSourceId] = useState<string | null>(null);
  const [leftPane, setLeftPane] = useState<PaneState>({ width: 224, visible: true });
  const [rightPane, setRightPane] = useState<PaneState>({ width: 320, visible: false });
  const [newPageOpen, setNewPageOpen] = useState(false);
  const [newPageTitle, setNewPageTitle] = useState('');
  const [newPageType, setNewPageType] = useState<TemplateType>('plain');
  const [blurtOpen, setBlurtOpen] = useState(false);
  const [blurtItemCount, setBlurtItemCount] = useState(15);
  const [blurtMode, setBlurtMode] = useState<SessionMode>('active');
  const [blurtPreview, setBlurtPreview] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [confirmDelPage, setConfirmDelPage] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const activePage = pages.find((p) => p.id === activePageId) || null;
  const activeSource = sources.find((s) => s.id === activeSourceId) || null;

  const handleCreatePage = async () => {
    const title = newPageTitle.trim() || `Page ${pages.length + 1}`;
    const page = await createPage(title, newPageType);
    setNewPageTitle('');
    setNewPageOpen(false);
    setActivePageId(page?.id || null);
  };

  const handleFiles = async (files: FileList) => {
    for (const file of Array.from(files)) {
      const src = await buildSource(file, notebookId);
      await addSource(src);
    }
    setDragOver(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  };

  const handleAddTemplate = async (type: TemplateType) => {
    if (!activePageId) return;
    await addTemplate(activePageId, createTemplate(type));
  };

  const distribution = distributeItems(pages, blurtItemCount);
  const previewTotal = Array.from(distribution.values()).reduce((s, v) => s + v, 0);

  const startBlurt = () => {
    onStartBlurt(blurtItemCount, blurtMode);
  };

  return (
    <div className="h-screen flex flex-col" style={{ background: 'var(--bg-0)' }}>
      <header className="flex items-center gap-2 px-3 py-2.5 border-b" style={{ borderColor: 'var(--border-soft)', background: 'var(--bg-1)' }}>
        <button className="btn-ghost !p-1.5" onClick={onBack} aria-label="Back"><ArrowLeft size={18} /></button>
        <h1 className="font-semibold truncate" style={{ color: 'var(--text-0)' }}>{notebookName}</h1>
        <span className="chip ml-1" style={{ background: 'var(--bg-2)', color: 'var(--text-3)' }}>{pages.length} pages</span>
        <div className="ml-auto flex items-center gap-1.5">
          <button className="btn-ghost !p-1.5" onClick={() => setThemeOpen(true)} title="Settings" aria-label="Settings">
            <SettingsIcon size={16} />
          </button>
          <button
            className="btn-ghost !p-1.5"
            onClick={() => setLeftPane((s) => ({ ...s, visible: !s.visible }))}
            aria-label="Toggle sidebar"
          >
            {leftPane.visible ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
          </button>
          <button
            className="btn-primary !py-1.5 !px-3 text-xs"
            onClick={() => setBlurtOpen(true)}
            disabled={pages.length === 0}
          >
            <Zap size={14} /> Blurt mode
          </button>
        </div>
      </header>

      <ResizablePanes
        leftState={leftPane}
        onLeftStateChange={setLeftPane}
        rightState={rightPane}
        onRightStateChange={setRightPane}
        left={
          <aside className="h-full overflow-y-auto border-r" style={{ borderColor: 'var(--border-soft)', background: 'var(--bg-1)' }}>
            <div className="p-2">
              <div className="flex items-center justify-between px-2 py-1.5">
                <span className="label">Pages</span>
                <button className="btn-ghost !p-1" onClick={() => setNewPageOpen(true)} aria-label="New page"><Plus size={15} /></button>
              </div>
              <div className="space-y-0.5">
                {pages.map((p) => (
                  <div
                    key={p.id}
                    className={`group flex items-center gap-1.5 rounded-lg px-2.5 py-2 cursor-pointer transition ${activePageId === p.id ? 'bg-amber-500/10' : 'hover:bg-slate-800'}`}
                    onClick={() => setActivePageId(p.id)}
                  >
                    <FileText size={14} style={{ color: activePageId === p.id ? 'var(--accent)' : 'var(--text-3)' }} />
                    <span className="text-sm truncate flex-1" style={{ color: activePageId === p.id ? 'var(--text-0)' : 'var(--text-2)' }}>{p.title}</span>
                    <span className="text-[10px] uppercase" style={{ color: 'var(--text-3)' }}>{p.templateType}</span>
                    <button className="btn-ghost !p-0.5 opacity-0 group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); setConfirmDelPage(p.id); }} aria-label="Delete page"><Trash2 size={12} /></button>
                  </div>
                ))}
                {pages.length === 0 && <p className="text-xs px-2.5 py-2" style={{ color: 'var(--text-3)' }}>No pages yet.</p>}
              </div>
            </div>
            <div className="divider mx-2" />
            <div className="p-2">
              <div className="flex items-center justify-between px-2 py-1.5">
                <span className="label">Sources</span>
                <button className="btn-ghost !p-1" onClick={() => fileInput.current?.click()} aria-label="Add source"><Plus size={15} /></button>
                <input ref={fileInput} type="file" multiple className="hidden" onChange={(e) => e.target.files && handleFiles(e.target.files)} />
              </div>
              <div className="space-y-0.5">
                {sources.map((s) => (
                  <div key={s.id} className="group flex items-center gap-1.5 rounded-lg px-2.5 py-2 cursor-pointer transition hover:bg-slate-800" onClick={() => setActiveSourceId(s.id)}>
                    <span className="text-xs font-mono uppercase px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-2)', color: 'var(--text-3)' }}>{s.kind}</span>
                    <span className="text-sm truncate flex-1" style={{ color: 'var(--text-2)' }}>{s.name}</span>
                    <button className="btn-ghost !p-0.5 opacity-0 group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); deleteSource(s.id); if (activeSourceId === s.id) setActiveSourceId(null); }} aria-label="Delete source"><Trash2 size={12} /></button>
                  </div>
                ))}
                {sources.length === 0 && <p className="text-xs px-2.5 py-2" style={{ color: 'var(--text-3)' }}>Drop files or click + to add.</p>}
              </div>
            </div>
          </aside>
        }
        middle={
          <main className="blurt-split-pane flex h-full overflow-hidden">
            <div
              className="blurt-source-pane flex-1 surface m-2 overflow-hidden flex flex-col min-w-0"
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              style={dragOver ? { borderColor: 'var(--accent)' } : undefined}
            >
              {activeSource ? (
                <SourceViewer source={activeSource} />
              ) : (
                <div className="flex-1 flex items-center justify-center p-6 text-center">
                  <div>
                    <Layers size={28} className="mx-auto mb-2" style={{ color: 'var(--text-3)' }} />
                    <p className="text-sm mb-1" style={{ color: 'var(--text-2)' }}>Select a source or drop a file here</p>
                    <p className="text-xs" style={{ color: 'var(--text-3)' }}>PDF, DOCX, TXT, MD, or images</p>
                  </div>
                </div>
              )}
            </div>
            <div className="blurt-notebook-pane flex-1 surface m-2 overflow-hidden flex flex-col min-w-0">
              <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: 'var(--border-soft)' }}>
                <div className="flex items-center gap-2 min-w-0">
                  {activePage ? (
                    <input className="input !bg-transparent !border-transparent !px-1 font-semibold" style={{ color: 'var(--text-0)' }} value={activePage.title} onChange={(e) => updatePage(activePage.id, { title: e.target.value })} />
                  ) : (
                    <span className="text-sm" style={{ color: 'var(--text-3)' }}>Notebook</span>
                  )}
                </div>
                {activePage && (
                  <button className="btn-subtle !py-1.5 !px-2.5 text-xs" onClick={() => handleAddTemplate(activePage.templateType)}>
                    <Plus size={14} /> Add {defaultTitleFor(activePage.templateType)}
                  </button>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {activePage ? (
                  activePage.templates.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-sm mb-3" style={{ color: 'var(--text-3)' }}>
                        This page type is <span className="font-semibold" style={{ color: 'var(--text-1)' }}>{defaultTitleFor(activePage.templateType)}</span>.
                        Add a block to start.
                      </p>
                      <button className="btn-primary" onClick={() => handleAddTemplate(activePage.templateType)}>
                        <Plus size={14} /> Add {defaultTitleFor(activePage.templateType)}
                      </button>
                    </div>
                  ) : (
                    activePage.templates.map((t) => (
                      <TemplateEditor
                        key={t.id}
                        template={t}
                        onChange={(nt) => updateTemplate(activePage.id, nt)}
                        onDelete={() => deleteTemplate(activePage.id, t.id)}
                      />
                    ))
                  )
                ) : (
                  <div className="text-center py-12" style={{ color: 'var(--text-3)' }}>
                    Select or create a page to start adding blocks.
                  </div>
                )}
              </div>
            </div>
          </main>
        }
        right={<div />}
      />

      <Modal
        open={newPageOpen}
        onClose={() => setNewPageOpen(false)}
        title="New page"
        width="max-w-md"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setNewPageOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={handleCreatePage}>Create</button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="label block mb-1.5">Page title</label>
            <input className="input" autoFocus placeholder={`Page ${pages.length + 1}`} value={newPageTitle} onChange={(e) => setNewPageTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreatePage()} />
          </div>
          <div>
            <label className="label block mb-1.5">Page type (one type per page)</label>
            <div className="grid grid-cols-3 gap-2">
              {(['plain', 'table', 'equation', 'bullet', 'flashcard', 'drawing'] as const).map((t) => (
                <button
                  key={t}
                  className="btn"
                  style={{
                    background: newPageType === t ? 'var(--accent)' : 'var(--bg-2)',
                    color: newPageType === t ? 'var(--btn-primary-text)' : 'var(--text-1)',
                    border: `1px solid ${newPageType === t ? 'var(--accent)' : 'var(--border)'}`,
                  }}
                  onClick={() => setNewPageType(t)}
                >
                  {defaultTitleFor(t)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={blurtOpen && !blurtPreview}
        onClose={() => setBlurtOpen(false)}
        title="Start Blurt session"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setBlurtOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={() => setBlurtPreview(true)} disabled={pages.length === 0}>Preview</button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label block mb-1.5">Session mode</label>
            <div className="grid grid-cols-3 gap-2">
              {([['active', 'Active Recall'], ['inorder', 'In Order'], ['random', 'Random']] as const).map(([val, label]) => (
                <button key={val} className="btn text-xs" style={{ background: blurtMode === val ? 'var(--accent)' : 'var(--bg-2)', color: blurtMode === val ? 'var(--btn-primary-text)' : 'var(--text-1)', border: `1px solid ${blurtMode === val ? 'var(--accent)' : 'var(--border)'}` }} onClick={() => setBlurtMode(val)}>
                  {label}
                </button>
              ))}
            </div>
            <p className="text-xs mt-1.5" style={{ color: 'var(--text-3)' }}>
              {blurtMode === 'active' && 'Sorts pages by lowest retrieval strength and urgency. Best for spaced repetition.'}
              {blurtMode === 'inorder' && 'Preserves original page creation order.'}
              {blurtMode === 'random' && 'Shuffles pages randomly for varied practice.'}
            </p>
          </div>
          <div>
            <label className="label block mb-1.5">
              {blurtMode === 'active' ? 'Minimum quiz items' : 'Items per session'}
            </label>
            <div className="flex items-center gap-3">
              <input type="range" min={1} max={100} value={blurtItemCount} onChange={(e) => setBlurtItemCount(Number(e.target.value))} className="flex-1" />
              <span className="text-sm font-semibold w-8 text-right" style={{ color: 'var(--text-0)' }}>{blurtItemCount}</span>
            </div>
            <p className="text-xs mt-1.5" style={{ color: 'var(--text-3)' }}>
              {blurtMode === 'active'
                ? `The adaptive scheduler picks at least ${blurtItemCount} pages by lowest retrieval strength. If you keep scoring low, it can add more items beyond this minimum. Intervals expand on high scores and reset on low scores.`
                : `The session will include ${blurtItemCount} items. Pages you score low on are reinserted 2-3 items ahead for forced re-retrieval.`}
            </p>
          </div>
          {pages.length > 0 && (
            <div>
              <label className="label block mb-1.5">Due pages ({Math.min(blurtItemCount, pages.length)} of {pages.length})</label>
              <div className="max-h-40 overflow-y-auto space-y-1 surface-2 p-2">
                {pages.map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-2 py-1.5 rounded">
                    <span className="text-sm truncate" style={{ color: 'var(--text-1)' }}>{p.title}</span>
                    <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>{p.templateType}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={blurtOpen && blurtPreview}
        onClose={() => { setBlurtPreview(false); setBlurtOpen(false); }}
        title="Session preview"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setBlurtPreview(false)}>Back</button>
            <button className="btn-primary" onClick={startBlurt} disabled={pages.length === 0}>Start session</button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="surface-2 p-3 text-center">
            <div className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>{previewTotal} items</div>
            <div className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>across {distribution.size} pages in {blurtMode === 'active' ? 'Active Recall' : blurtMode === 'inorder' ? 'In Order' : 'Random'} mode</div>
          </div>
          <div>
            <label className="label block mb-1.5">Page breakdown</label>
            <div className="space-y-1 surface-2 p-2 max-h-48 overflow-y-auto">
              {pages.map((p) => {
                const count = distribution.get(p.id) || 0;
                return (
                  <div key={p.id} className="flex items-center justify-between px-2 py-1.5 rounded text-sm">
                    <span className="truncate" style={{ color: 'var(--text-1)' }}>{p.title}</span>
                    <span className="font-mono text-xs" style={{ color: 'var(--accent)' }}>{count} item{count !== 1 ? 's' : ''}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-3)' }}>
            If pages yield fewer items than the {blurtItemCount}-item threshold, counts are distributed proportionally to scale up. Failed items (score &lt; 50%) reappear 2-3 cards later in the same session.
          </p>
        </div>
      </Modal>

      <ThemeSettings open={themeOpen} onClose={() => setThemeOpen(false)} />

      <ConfirmDialog
        open={!!confirmDelPage}
        title="Delete page?"
        message="The page and all its blocks will be removed. Accuracy history is also cleared."
        onConfirm={async () => {
          if (confirmDelPage) { await deletePage(confirmDelPage); if (activePageId === confirmDelPage) setActivePageId(null); }
          setConfirmDelPage(null);
        }}
        onCancel={() => setConfirmDelPage(null)}
      />
    </div>
  );
}
