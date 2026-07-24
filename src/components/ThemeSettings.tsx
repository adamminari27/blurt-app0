import { useState, useEffect, useCallback } from 'react';
import { Palette, RotateCcw, Check, Sun, Moon, HelpCircle, Settings as SettingsIcon, Gauge, GraduationCap } from 'lucide-react';
import { Modal } from './Modal';
import { useTheme, type PalettePreset, type ThemeName } from '../hooks/useTheme';
import { getScoringMode, setScoringMode, type ScoringMode } from '../hooks/useScoringMode';

export interface Palette {
  bg0: string;
  bg1: string;
  bg2: string;
  bg3: string;
  border: string;
  borderSoft: string;
  text0: string;
  text1: string;
  text2: string;
  text3: string;
  accent: string;
  accent2: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  btnPrimaryText: string;
}

const STORAGE_KEY = 'blurt-custom-palette';
const PRESET_KEY = 'blurt-preset';

// ---------- Presets ----------

const PRESETS: Record<PalettePreset, Palette> = {
  default: {
    bg0: '#0b1120', bg1: '#0f172a', bg2: '#1e293b', bg3: '#334155',
    border: '#334155', borderSoft: '#1e293b',
    text0: '#f8fafc', text1: '#e2e8f0', text2: '#94a3b8', text3: '#64748b',
    accent: '#f59e0b', accent2: '#38bdf8',
    success: '#34d399', warning: '#fbbf24', error: '#f87171', info: '#818cf8',
    btnPrimaryText: '#1a1205',
  },
  light: {
    bg0: '#f8fafc', bg1: '#ffffff', bg2: '#f1f5f9', bg3: '#e2e8f0',
    border: '#cbd5e1', borderSoft: '#e2e8f0',
    text0: '#0f172a', text1: '#1e293b', text2: '#475569', text3: '#94a3b8',
    accent: '#d97706', accent2: '#0ea5e9',
    success: '#059669', warning: '#d97706', error: '#dc2626', info: '#4f46e5',
    btnPrimaryText: '#ffffff',
  },
  meadow: {
    bg0: '#f0f4e8', bg1: '#fafbf3', bg2: '#e3ecd5', bg3: '#cfdab8',
    border: '#b8c9a0', borderSoft: '#d4dfc2',
    text0: '#2d3e1f', text1: '#3d4f2c', text2: '#5a7042', text3: '#7a8f60',
    accent: '#9d7bd2', accent2: '#6ba3d0',
    success: '#6ba368', warning: '#d4a72c', error: '#d97a7a', info: '#a78bd9',
    btnPrimaryText: '#ffffff',
  },
  seaside: {
    bg0: '#fef9e7', bg1: '#fffdf5', bg2: '#eef4f9', bg3: '#d9e6f0',
    border: '#b8cfe0', borderSoft: '#d4e3ee',
    text0: '#1a3a52', text1: '#2c5274', text2: '#4a7090', text3: '#7a9ab0',
    accent: '#2b7fb9', accent2: '#f0c040',
    success: '#3aa890', warning: '#e0a030', error: '#d96060', info: '#5080b0',
    btnPrimaryText: '#ffffff',
  },
};

const PRESET_META: { id: PalettePreset; name: string; desc: string }[] = [
  { id: 'default', name: 'Default', desc: 'Dark amber' },
  { id: 'light', name: 'Light', desc: 'Bright & clean' },
  { id: 'meadow', name: 'Meadow', desc: 'Green & pastel florals' },
  { id: 'seaside', name: 'Seaside', desc: 'Pale yellow & blue' },
];

// ---------- CSS var mapping ----------

const CSS_VARS: { key: keyof Palette; var: string }[] = [
  { key: 'bg0', var: '--bg-0' },
  { key: 'bg1', var: '--bg-1' },
  { key: 'bg2', var: '--bg-2' },
  { key: 'bg3', var: '--bg-3' },
  { key: 'border', var: '--border' },
  { key: 'borderSoft', var: '--border-soft' },
  { key: 'text0', var: '--text-0' },
  { key: 'text1', var: '--text-1' },
  { key: 'text2', var: '--text-2' },
  { key: 'text3', var: '--text-3' },
  { key: 'accent', var: '--accent' },
  { key: 'accent2', var: '--accent-2' },
  { key: 'success', var: '--success' },
  { key: 'warning', var: '--warning' },
  { key: 'error', var: '--error' },
  { key: 'info', var: '--info' },
  { key: 'btnPrimaryText', var: '--btn-primary-text' },
];

// ---------- Storage & application ----------

export function loadPalette(): Palette | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

export function loadPresetChoice(): PalettePreset {
  try {
    const v = localStorage.getItem(PRESET_KEY) as PalettePreset | null;
    if (v) return v;
  } catch { /* ignore */ }
  return 'default';
}

function hexToRgba(hex: string, alpha: number): string {
  const m = hex.replace('#', '');
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function applyPalette(p: Palette) {
  const root = document.documentElement;
  for (const { key, var: v } of CSS_VARS) {
    root.style.setProperty(v, p[key]);
  }
  root.style.setProperty('--accent-soft', hexToRgba(p.accent, 0.12));
  root.style.setProperty('--scrollbar-thumb', p.bg3);
  root.style.setProperty('--scrollbar-hover', p.border);
}

export function clearPalette() {
  const root = document.documentElement;
  for (const { var: v } of CSS_VARS) {
    root.style.removeProperty(v);
  }
  root.style.removeProperty('--accent-soft');
  root.style.removeProperty('--scrollbar-thumb');
  root.style.removeProperty('--scrollbar-hover');
}

// ---------- Customizable slots (shown in UI) ----------

const SLOTS: { key: keyof Palette; label: string }[] = [
  { key: 'bg0', label: 'Background' },
  { key: 'bg1', label: 'Card' },
  { key: 'bg2', label: 'Surface' },
  { key: 'text0', label: 'Text' },
  { key: 'accent', label: 'Accent' },
  { key: 'accent2', label: 'Accent 2' },
  { key: 'success', label: 'Success' },
  { key: 'warning', label: 'Warning' },
  { key: 'error', label: 'Error' },
];

// ---------- Component ----------

type Tab = 'theme' | 'palette' | 'scoring' | 'help' | 'tutorial';

interface Props {
  open: boolean;
  onClose: () => void;
  onStartTutorial?: () => void;
}

export function ThemeSettings({ open, onClose, onStartTutorial }: Props) {
  const { theme, toggle, set, preset, setPreset } = useTheme();
  const [tab, setTab] = useState<Tab>('theme');
  const [palette, setPalette] = useState<Palette>(() => {
    const saved = loadPalette();
    if (saved) return saved;
    return PRESETS[loadPresetChoice()];
  });
  const [saved, setSaved] = useState(false);
  const [scoringMode, setScoringModeState] = useState<ScoringMode>(() => getScoringMode());

  // Live preview
  useEffect(() => {
    if (open && tab === 'palette') applyPalette(palette);
  }, [palette, open, tab]);

  const applyPreset = useCallback((p: PalettePreset) => {
    setPreset(p);
    const next = PRESETS[p];
    setPalette(next);
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.setItem(PRESET_KEY, p);
    } catch { /* ignore */ }
    clearPalette();
    applyPalette(next);
  }, [setPreset]);

  const update = (key: keyof Palette, value: string) => {
    setPalette((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(palette)); } catch { /* ignore */ }
    applyPalette(palette);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const handleReset = () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    clearPalette();
    applyPreset(preset);
    setPalette(PRESETS[preset]);
  };

  const handleThemeToggle = (t: ThemeName) => {
    set(t);
  };

  return (
    <Modal open={open} onClose={onClose} title="Settings" width="max-w-2xl">
      {/* Tab bar */}
      <div className="flex gap-1 mb-5 border-b" style={{ borderColor: 'var(--border-soft)' }}>
        {([
          ['theme', 'Theme', <Sun size={14} key="t" />],
          ['palette', 'Palette', <Palette size={14} key="p" />],
          ['scoring', 'Scoring', <Gauge size={14} key="s" />],
          ['help', 'How it works', <HelpCircle size={14} key="h" />],
          ['tutorial', 'Tutorial', <GraduationCap size={14} key="tu" />],
        ] as const).map(([id, label, icon]) => (
          <button
            key={id}
            onClick={() => setTab(id as Tab)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition border-b-2 -mb-px"
            style={{
              color: tab === id ? 'var(--accent)' : 'var(--text-2)',
              borderColor: tab === id ? 'var(--accent)' : 'transparent',
            }}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {/* Theme tab */}
      {tab === 'theme' && (
        <div className="space-y-5">
          <div>
            <label className="label block mb-2">Base theme</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleThemeToggle('dark')}
                className="surface-2 p-4 flex items-center gap-3 transition hover:border-amber-500/40"
                style={{ borderColor: theme === 'dark' ? 'var(--accent)' : 'var(--border)' }}
              >
                <Moon size={20} style={{ color: theme === 'dark' ? 'var(--accent)' : 'var(--text-2)' }} />
                <div className="text-left">
                  <div className="font-semibold text-sm" style={{ color: 'var(--text-0)' }}>Dark</div>
                  <div className="text-xs" style={{ color: 'var(--text-3)' }}>Default experience</div>
                </div>
              </button>
              <button
                onClick={() => handleThemeToggle('light')}
                className="surface-2 p-4 flex items-center gap-3 transition hover:border-amber-500/40"
                style={{ borderColor: theme === 'light' ? 'var(--accent)' : 'var(--border)' }}
              >
                <Sun size={20} style={{ color: theme === 'light' ? 'var(--accent)' : 'var(--text-2)' }} />
                <div className="text-left">
                  <div className="font-semibold text-sm" style={{ color: 'var(--text-0)' }}>Light</div>
                  <div className="text-xs" style={{ color: 'var(--text-3)' }}>Bright & clean</div>
                </div>
              </button>
            </div>
          </div>

          <div>
            <label className="label block mb-2">Color presets</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {PRESET_META.map((p) => (
                <button
                  key={p.id}
                  onClick={() => applyPreset(p.id)}
                  className="surface-2 p-3 text-left transition hover:border-amber-500/40"
                  style={{ borderColor: preset === p.id ? 'var(--accent)' : 'var(--border)' }}
                >
                  <div className="flex gap-1.5 mb-2">
                    {PRESETS[p.id].accent && (
                      <span className="w-4 h-4 rounded-full" style={{ background: PRESETS[p.id].accent }} />
                    )}
                    {PRESETS[p.id].accent2 && (
                      <span className="w-4 h-4 rounded-full" style={{ background: PRESETS[p.id].accent2 }} />
                    )}
                    {PRESETS[p.id].success && (
                      <span className="w-4 h-4 rounded-full" style={{ background: PRESETS[p.id].success }} />
                    )}
                  </div>
                  <div className="font-semibold text-sm" style={{ color: 'var(--text-0)' }}>{p.name}</div>
                  <div className="text-xs" style={{ color: 'var(--text-3)' }}>{p.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Palette tab */}
      {tab === 'palette' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-2)' }}>
            <Palette size={16} style={{ color: 'var(--accent)' }} />
            Customize individual colors. Changes preview live.
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {SLOTS.map((slot) => (
              <div key={slot.key} className="flex items-center justify-between gap-3 surface-2 px-3 py-2.5">
                <label className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>
                  {slot.label}
                </label>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs" style={{ color: 'var(--text-3)' }}>
                    {palette[slot.key]}
                  </span>
                  <input
                    type="color"
                    value={palette[slot.key]}
                    onChange={(e) => update(slot.key, e.target.value)}
                    className="w-9 h-9 rounded-lg cursor-pointer border-0 p-0"
                    style={{ background: 'transparent' }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-ghost" onClick={handleReset}>
              <RotateCcw size={14} /> Reset to preset
            </button>
            <button className="btn-primary" onClick={handleSave}>
              {saved ? <><Check size={14} /> Saved</> : 'Save palette'}
            </button>
          </div>
        </div>
      )}

      {/* Scoring tab */}
      {tab === 'scoring' && (
        <div className="space-y-4 text-sm" style={{ color: 'var(--text-1)' }}>
          <Section title="Scoring mode">
            Choose how your answers get graded during Blurt sessions. Both modes feed into the active-recall scheduler.
            <div className="mt-3 grid gap-2">
              <ScoringModeCard
                active={scoringMode === 'auto'}
                title="Auto Scoring"
                desc="Deterministic local grading — equations, text, tables, bullets, drawings — scored instantly by algorithm. This is the default."
                onClick={() => { setScoringMode('auto'); setScoringModeState('auto'); }}
              />
              <ScoringModeCard
                active={scoringMode === 'manual'}
                title="Manual Self-Grading"
                desc="After answering, the real page is revealed beside your answers. You grade yourself with preset buttons (0%, 50%, 100%, or a custom slider). Honest grades drive the scheduler."
                onClick={() => { setScoringMode('manual'); setScoringModeState('manual'); }}
              />
            </div>
          </Section>
          <Section title="How manual grading works">
            <ul className="mt-1.5 ml-4 list-disc space-y-1">
              <li>Answer each template as usual, then press <b>Reveal &amp; Grade</b>.</li>
              <li>The source content appears side-by-side with your answers.</li>
              <li>Tap <b>0%</b>, <b>50%</b>, <b>100%</b>, or drag the slider for a custom score.</li>
              <li>Confirm to record the score and advance — the NTD scheduler updates just like auto mode.</li>
            </ul>
          </Section>
        </div>
      )}

      {/* Help tab */}
      {tab === 'help' && <HowItWorksContent />}

      {/* Tutorial tab */}
      {tab === 'tutorial' && (
        <div className="space-y-4 text-sm" style={{ color: 'var(--text-1)' }}>
          <Section title="Interactive tutorial">
            Launch a step-by-step, interactive walkthrough that highlights each button and feature on the editor screen. You'll learn how to upload sources, build pages, use Blurt mode, and navigate the app — all with on-screen pointers and numbered steps.
          </Section>
          <div className="flex justify-center pt-2">
            <button className="btn-primary" onClick={() => onStartTutorial?.()}>
              <GraduationCap size={16} /> Start tutorial
            </button>
          </div>
          <p className="text-center text-xs" style={{ color: 'var(--text-3)' }}>
            The tutorial will close this settings window and guide you through the editor.
          </p>
        </div>
      )}
    </Modal>
  );
}

function HowItWorksContent() {
  return (
    <div className="space-y-4 text-sm" style={{ color: 'var(--text-1)' }}>
      <Section title="The core loop & zero-AI scoring">
        Blurt splits your screen into a source panel and a notebook panel. You manually re-create source content into notebook pages — no copy-paste. In <b>Blurt mode</b>, templates are blanked and you retype/redraw from memory. Press <b>Next</b> to score; a full-screen overlay shows your percentage, then the app advances.
        <div className="mt-2 font-semibold" style={{ color: 'var(--text-1)' }}>Deterministic scoring methods:</div>
        <ul className="mt-1.5 ml-4 list-disc space-y-1">
          <li><b>Equations:</b> Multi-line LaTeX normalized and scored via Levenshtein distance; plain-text final answer scored via Jaccard token similarity. Both averaged.</li>
          <li><b>Tables:</b> Each cell scored independently via Jaccard token similarity, then averaged across all cells.</li>
          <li><b>Bullet Lists:</b> Greedy best-match Jaccard assignment between your bullets and source bullets.</li>
          <li><b>Flashcards:</b> Front prompt always visible; only the back is blanked and scored via Jaccard similarity.</li>
          <li><b>Plain Text:</b> Whole-block Jaccard token similarity between your recreation and the source.</li>
          <li><b>Drawings:</b> Rasterized grid comparison via IoU (intersection-over-union) plus stroke-count similarity. No LaTeX conversion.</li>
        </ul>
      </Section>
      <Section title="The science of memory (Bjork's NTD & Ebbinghaus)">
        Each page tracks <b>Storage Strength (S)</b> — which accumulates on successful recall — and <b>Retrieval Strength (R)</b>, which decays exponentially over time: R = e^(-t/S). Short review steps catch rapid initial forgetting, while high scores expand intervals to weeks. The scheduler uses these values to pick which pages to surface next — no countdown timers involved.
        <div className="mt-2 font-semibold" style={{ color: 'var(--text-1)' }}>How intervals adapt:</div>
        <ul className="mt-1.5 ml-4 list-disc space-y-1">
          <li><b>Failed (&lt; 50%):</b> Reset R, short intra-day steps (20 min, 1 hr, 9 hr) so the page reappears soon.</li>
          <li><b>Hard / moderate (50–79%):</b> Interval set to 1 day, modest S gain.</li>
          <li><b>Optimal / high (≥ 80%):</b> S expands, interval climbs exponentially: 1 day → 3 days → 7 days → 14+ days.</li>
        </ul>
      </Section>
      <Section title="Global streak">
        A single <b>global streak</b> counts consecutive days with at least one completed Blurt session, across all notebooks. Complete a session any day to keep it alive; miss a day and it resets to zero.
      </Section>
      <Section title="Dynamic interleaving & session modes">
        During a session, failed items (score &lt; 50%) reappear <b>2–3 cards later</b> in the same session — forcing interleaved re-retrieval after working memory has cleared. High scores (≥ 80%) update S and R, expand the interval, and advance to the next queue item.
        <div className="mt-2 font-semibold" style={{ color: 'var(--text-1)' }}>Session modes:</div>
        <ul className="mt-1.5 ml-4 list-disc space-y-1">
          <li><b>Active Recall (Smart):</b> Sorts pages by lowest R and urgency within the Ebbinghaus decay window. The adaptive scheduler can add more items beyond your minimum if you keep scoring low. Default.</li>
          <li><b>In Order:</b> Preserves original page creation/document sequence.</li>
          <li><b>Random:</b> Shuffles pages randomly.</li>
        </ul>
      </Section>
      <Section title="Items per session & preview">
        In <b>In Order</b> and <b>Random</b> modes, the slider sets the exact number of items for the session. In <b>Active Recall</b> mode, the slider sets a <b>minimum</b> number of quiz items — the scheduler may add more if you keep getting low scores, so weak pages get extra practice. Before confirming a session, a <b>preview screen</b> shows the total item count and per-page breakdown so you can adjust before starting.
      </Section>
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

function ScoringModeCard({ active, title, desc, onClick }: { active: boolean; title: string; desc: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left p-3 rounded-lg border transition-all"
      style={{
        borderColor: active ? 'var(--accent)' : 'var(--border)',
        background: active ? 'var(--accent-soft)' : 'var(--bg-0)',
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0" style={{ borderColor: active ? 'var(--accent)' : 'var(--border)' }}>
          {active && <div className="w-2 h-2 rounded-full" style={{ background: 'var(--accent)' }} />}
        </div>
        <span className="font-semibold" style={{ color: 'var(--text-0)' }}>{title}</span>
      </div>
      <p className="text-xs ml-6" style={{ color: 'var(--text-3)' }}>{desc}</p>
    </button>
  );
}
