import { useState, useEffect, useRef } from 'react';
import { useBjorkInterleaver } from '../hooks/useBjorkInterleaver';
import { db } from '../db/database';
import type { Page, UserInput, Template, Stroke } from '../db/types';
import { emptyInputFor } from '../db/types';
import { KaTeXRender } from '../components/KaTeXRender';
import { DrawingCanvas } from '../components/DrawingCanvas';
import { SmartMathInput } from '../components/SmartMathInput';
import type { SessionMode } from '../engine/ntd';
import { getScoringMode, type ScoringMode } from '../hooks/useScoringMode';
import { ArrowLeft, ChevronRight, Trophy, Target, Eye, Check } from 'lucide-react';
import { DonateFooter } from './Footer';
interface Props {
  notebookId: string;
  itemCount: number;
  mode: SessionMode;
  onExit: () => void;
}

interface TemplateState {
  input: UserInput;
  scored: boolean;
}

function scoreColor(pct: number): string {
  if (pct < 50) return 'rgb(239, 68, 68)';
  if (pct < 70) return 'rgb(249, 115, 22)';
  if (pct < 85) return 'rgb(234, 179, 8)';
  return 'rgb(34, 197, 94)';
}

function BlurtSession({ notebookId, itemCount, mode, onExit }: Props) {
  const {
    sessionQueue, queueIndex, buildQueue, scoreAndRecord,
    reinsertIfFailed, advance, finalizeSession,
  } = useBjorkInterleaver(notebookId);
  const [pages, setPages] = useState<Map<string, Page>>(new Map());
  const [inputs, setInputs] = useState<Record<string, TemplateState>>({});
  const [showScore, setShowScore] = useState(false);
  const [lastScore, setLastScore] = useState<number | null>(null);
  const [allScores, setAllScores] = useState<{ pageId: string; templateId: string; score: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [scoringMode] = useState<ScoringMode>(() => getScoringMode());
  const [revealMode, setRevealMode] = useState(false);
  const [manualScores, setManualScores] = useState<Record<string, number>>({});
  const scoreTimer = useRef<number | null>(null);
  const lastResetKey = useRef<string>('');

  useEffect(() => {
    (async () => {
      const allPages = await db.pages.where('notebookId').equals(notebookId).toArray();
      setPages(new Map(allPages.map((p) => [p.id, p])));
      await buildQueue(itemCount, mode);
      setLoading(false);
    })();
  }, [notebookId, itemCount, mode, buildQueue]);

  const currentItem = sessionQueue[queueIndex];
  const currentPage = currentItem ? pages.get(currentItem.pageId) : null;
  const allDone = queueIndex >= sessionQueue.length;

  const resetInputsForPage = (pageId: string) => {
    const page = pages.get(pageId);
    if (!page) return;
    setInputs((prev) => {
      const next = { ...prev };
      for (const t of page.templates) {
        const key = `${pageId}:${t.id}`;
        next[key] = { input: emptyInputFor(t.type), scored: false };
      }
      return next;
    });
  };

  // Reset inputs whenever the current queue item changes — handles retries too
  useEffect(() => {
    if (!currentItem || !currentPage) return;
    const resetKey = `${queueIndex}:${currentItem.pageId}:${currentItem.rep}`;
    if (lastResetKey.current === resetKey) return;
    lastResetKey.current = resetKey;
    resetInputsForPage(currentItem.pageId);
    setRevealMode(false);
    setManualScores({});
  }, [queueIndex, currentItem, currentPage]);

  const handleNext = async () => {
    if (!currentPage || !currentItem) return;
    const newScoredItems: { pageId: string; templateId: string; score: number }[] = [];
    let pageScoreSum = 0;
    let pageScoreCount = 0;

    for (const t of currentPage.templates) {
      const key = `${currentPage.id}:${t.id}`;
      const ts = inputs[key];
      if (!ts || ts.scored) continue;

      let score01: number;
      if (scoringMode === 'manual' && revealMode) {
        const manualPct = manualScores[key];
        if (manualPct === undefined) continue;
        score01 = manualPct / 100;
        await scoreAndRecord(currentPage, t, ts.input, score01);
      } else {
        const { score } = await scoreAndRecord(currentPage, t, ts.input);
        score01 = score;
      }
      setInputs((prev) => ({ ...prev, [key]: { ...prev[key], scored: true } }));
      newScoredItems.push({ pageId: currentPage.id, templateId: t.id, score: score01 });
      pageScoreSum += score01;
      pageScoreCount++;
    }

    // Clear drawing canvases for the next attempt
    setInputs((prev) => {
      const next = { ...prev };
      for (const t of currentPage.templates) {
        if (t.type === 'drawing') {
          const key = `${currentPage.id}:${t.id}`;
          if (next[key]) next[key] = { ...next[key], input: { type: 'drawing', strokes: [] } };
        }
      }
      return next;
    });

    if (newScoredItems.length > 0) {
      const avgScore = pageScoreCount > 0 ? pageScoreSum / pageScoreCount : 0;
      const avgPct = Math.round(avgScore * 100);
      setLastScore(avgPct);
      setAllScores((prev) => [...prev, ...newScoredItems]);

      reinsertIfFailed(currentPage.id, avgScore);

      setShowScore(true);
      scoreTimer.current = window.setTimeout(() => {
        setShowScore(false);
        advance();
      }, 1800);
    } else {
      advance();
    }
  };

  const skipScore = () => {
    if (scoreTimer.current) clearTimeout(scoreTimer.current);
    setShowScore(false);
    advance();
  };

  // Finalize session when done
  useEffect(() => {
    if (allDone && allScores.length > 0) {
      finalizeSession(allScores);
    }
  }, [allDone, allScores, finalizeSession]);

  if (loading) {
    return <div className="h-screen flex items-center justify-center" style={{ color: 'var(--text-3)' }}>Loading…</div>;
  }

  if (allDone) {
    const overall = allScores.length > 0
      ? Math.round((allScores.reduce((s, v) => s + v.score, 0) / allScores.length) * 100)
      : 0;
    return <SummaryScreen accuracy={overall} onExit={onExit} notebookId={notebookId} />;
  }

  const progress = (queueIndex / sessionQueue.length) * 100;
  const isManual = scoringMode === 'manual';
  const allGraded = isManual && revealMode && currentPage
    ? currentPage.templates.every((t) => manualScores[`${currentPage.id}:${t.id}`] !== undefined)
    : false;

  return (
    <div className="h-screen flex flex-col relative" style={{ background: 'var(--bg-0)' }}>
      <header className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: 'var(--border-soft)', background: 'var(--bg-1)' }}>
        <button className="btn-ghost !p-1.5" onClick={onExit} aria-label="Exit"><ArrowLeft size={18} /></button>
        <div className="flex-1">
          <div className="flex items-center justify-between text-xs mb-1" style={{ color: 'var(--text-3)' }}>
            <span>Item {queueIndex + 1}/{sessionQueue.length} {currentItem.rep > 0 ? `(retry #${currentItem.rep})` : ''} — {currentPage?.title || ''}</span>
            {isManual && (
              <span className="chip !text-[10px] !py-0.5" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>Manual</span>
            )}
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-2)' }}>
            <div className="h-full transition-all duration-300" style={{ width: `${progress}%`, background: 'var(--accent)' }} />
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6 pb-32">
          {currentPage && (
            <>
              <div className="mb-5">
                <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--text-0)' }}>{currentPage.title}</h2>
                <p className="text-sm" style={{ color: 'var(--text-3)' }}>
                  {isManual && !revealMode ? 'Recreate from memory, then reveal to grade.' : 'Recreate from memory.'}
                </p>
              </div>
              <div className="space-y-4">
                {currentPage.templates.map((template) => {
                  const key = `${currentPage.id}:${template.id}`;
                  const ts = inputs[key];
                  if (!ts) return null;
                  const manualPct = manualScores[key];
                  return (
                    <div key={template.id} className="surface p-4 animate-fade-in">
                      <div className="flex items-center justify-between mb-3">
                        <span className="chip" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>{template.title}</span>
                        {isManual && revealMode && manualPct !== undefined && (
                          <span className="text-xs font-semibold" style={{ color: scoreColor(manualPct) }}>{manualPct}%</span>
                        )}
                      </div>
                      <BlurtInputField
                        template={template}
                        input={ts.input}
                        disabled={revealMode}
                        onChange={(ni) => setInputs((prev) => ({ ...prev, [key]: { ...prev[key], input: ni } }))}
                      />
                      {isManual && revealMode && (
                        <div className="mt-4 pt-3 border-t" style={{ borderColor: 'var(--border-soft)' }}>
                          <div className="label mb-2">Source (reference)</div>
                          <SourceReveal template={template} />
                          <ManualGrader
                            value={manualPct}
                            onChange={(pct) => setManualScores((prev) => ({ ...prev, [key]: pct }))}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Floating action button */}
      <div className="fixed left-1/2 -translate-x-1/2 z-30" style={{ bottom: '72px' }}>
        {isManual && !revealMode ? (
          <button className="btn-primary !px-8 !py-3 shadow-2xl" onClick={() => setRevealMode(true)}>
            <Eye size={18} /> Reveal &amp; Grade
          </button>
        ) : (
          <button
            className="btn-primary !px-8 !py-3 shadow-2xl"
            onClick={handleNext}
            disabled={isManual && !allGraded}
            style={isManual && !allGraded ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
          >
            {isManual ? <><Check size={18} /> Confirm Grades</> : <>Next <ChevronRight size={18} /></>}
          </button>
        )}
      </div>

      {showScore && lastScore !== null && (
        <ScoreOverlay accuracy={lastScore} onSkip={skipScore} />
      )}
    </div>
  );
}

function ScoreOverlay({ accuracy, onSkip }: { accuracy: number; onSkip: () => void }) {
  const color = scoreColor(accuracy);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center cursor-pointer animate-fade-in"
      style={{ background: 'rgba(0,0,0,0.75)' }}
      onClick={onSkip}
    >
      <div className="text-center animate-pop">
        <div className="text-7xl font-bold mb-2" style={{ color }}>{accuracy}%</div>
        <div className="text-sm uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.6)' }}>
          {accuracy < 50 ? 'Needs work' : accuracy < 70 ? 'Getting there' : accuracy < 85 ? 'Good' : 'Excellent'}
        </div>
      </div>
    </div>
  );
}

// ---------- Manual grading ----------

function ManualGrader({ value, onChange }: { value: number | undefined; onChange: (pct: number) => void }) {
  const presets = [0, 50, 100];
  return (
    <div className="mt-3 space-y-2.5">
      <div className="flex gap-2">
        {presets.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            className="flex-1 py-2 rounded-lg font-semibold text-sm transition-all"
            style={{
              background: value === p ? scoreColor(p) : 'var(--bg-2)',
              color: value === p ? '#fff' : 'var(--text-1)',
              border: `1px solid ${value === p ? scoreColor(p) : 'var(--border)'}`,
            }}
          >
            {p}%
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={value ?? 50}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1"
          style={{ accentColor: 'var(--accent)' }}
        />
        <span className="text-sm font-semibold w-12 text-right" style={{ color: 'var(--text-1)' }}>
          {value ?? 50}%
        </span>
      </div>
    </div>
  );
}

function SourceReveal({ template }: { template: Template }) {
  switch (template.type) {
    case 'plain': return <PlainSource template={template} />;
    case 'equation': return <EquationSource template={template} />;
    case 'table': return <TableSource template={template} />;
    case 'bullet': return <BulletSource template={template} />;
    case 'flashcard': return <FlashcardSource template={template} />;
    case 'drawing': return <DrawingSource template={template} />;
  }
}

function PlainSource({ template }: { template: Extract<Template, { type: 'plain' }> }) {
  return <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-1)', fontFamily: 'var(--font-serif)' }}>{template.text}</p>;
}

function EquationSource({ template }: { template: Extract<Template, { type: 'equation' }> }) {
  return (
    <div className="space-y-2">
      {template.solution && (
        <div className="px-3 py-2 rounded-lg overflow-x-auto" style={{ background: 'var(--bg-1)', border: '1px solid var(--border-soft)' }}>
          <KaTeXRender latex={template.solution} display />
        </div>
      )}
      {template.answer && (
        <div className="text-sm" style={{ color: 'var(--text-1)' }}>
          <span className="label !inline mr-2">Answer:</span>
          <span className="font-medium">{template.answer}</span>
        </div>
      )}
    </div>
  );
}

function TableSource({ template }: { template: Extract<Template, { type: 'table' }> }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {template.columns.map((c, i) => (
              <th key={i} className="p-1.5 text-left font-semibold border-b" style={{ color: 'var(--text-2)', borderColor: 'var(--border)' }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {template.rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci} className="p-1.5 border-b" style={{ color: 'var(--text-1)', borderColor: 'var(--border-soft)' }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BulletSource({ template }: { template: Extract<Template, { type: 'bullet' }> }) {
  return (
    <ul className="space-y-1">
      {template.items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-sm" style={{ color: 'var(--text-1)' }}>
          <span className="font-bold mt-0.5" style={{ color: 'var(--accent)' }}>•</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function FlashcardSource({ template }: { template: Extract<Template, { type: 'flashcard' }> }) {
  return (
    <div className="space-y-2">
      <div className="surface-2 px-3 py-2">
        <div className="label mb-1">Front</div>
        <p className="text-sm font-medium" style={{ color: 'var(--text-0)' }}>{template.front}</p>
      </div>
      <div className="surface-2 px-3 py-2">
        <div className="label mb-1">Back</div>
        <p className="text-sm" style={{ color: 'var(--text-1)' }}>{template.back}</p>
      </div>
    </div>
  );
}

function DrawingSource({ template }: { template: Extract<Template, { type: 'drawing' }> }) {
  return (
    <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-soft)', background: 'var(--bg-1)' }}>
      <DrawingCanvas
        strokes={template.strokes}
        onChange={() => {}}
        width={template.width}
        height={template.height}
        readOnly
      />
    </div>
  );
}

// ---------- Per-template input fields ----------

function BlurtInputField({
  template, input, onChange, disabled,
}: {
  template: Template;
  input: UserInput;
  onChange: (i: UserInput) => void;
  disabled?: boolean;
}) {
  switch (template.type) {
    case 'plain': return <PlainField template={template} input={input as Extract<UserInput, { type: 'plain' }>} onChange={onChange} disabled={disabled} />;
    case 'equation': return <EquationField template={template} input={input as Extract<UserInput, { type: 'equation' }>} onChange={onChange} disabled={disabled} />;
    case 'table': return <TableField template={template} input={input as Extract<UserInput, { type: 'table' }>} onChange={onChange} disabled={disabled} />;
    case 'bullet': return <BulletField template={template} input={input as Extract<UserInput, { type: 'bullet' }>} onChange={onChange} disabled={disabled} />;
    case 'flashcard': return <FlashcardField template={template} input={input as Extract<UserInput, { type: 'flashcard' }>} onChange={onChange} disabled={disabled} />;
    case 'drawing': return <DrawingField template={template} input={input as Extract<UserInput, { type: 'drawing' }>} onChange={onChange} disabled={disabled} />;
  }
}

function PlainField({
  template, input, onChange, disabled,
}: {
  template: Extract<Template, { type: 'plain' }>;
  input: Extract<UserInput, { type: 'plain' }>;
  onChange: (i: UserInput) => void;
  disabled?: boolean;
}) {
  return (
    <textarea
      className="input min-h-[120px] resize-y leading-relaxed"
      style={{ fontFamily: 'var(--font-serif)' }}
      value={input.text}
      placeholder="Recreate the text from memory…"
      disabled={disabled}
      onChange={(e) => onChange({ type: 'plain', text: e.target.value })}
    />
  );
}

function EquationField({
  template, input, onChange, disabled,
}: {
  template: Extract<Template, { type: 'equation' }>;
  input: Extract<UserInput, { type: 'equation' }>;
  onChange: (i: UserInput) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-3">
      {template.problem && (
        <div className="surface-2 px-4 py-3" style={{ background: 'var(--bg-0)' }}>
          <div className="label mb-1">Problem</div>
          <p className="text-sm" style={{ color: 'var(--text-1)' }}>{template.problem}</p>
        </div>
      )}
      <SmartMathInput
        value={input.solution}
        onChange={(v) => onChange({ ...input, solution: v })}
        placeholder="Type your solution — symbols render as you type…"
        multiline
        disabled={disabled}
      />
      {input.solution && (
        <div className="mt-2 px-4 py-3 overflow-x-auto rounded-lg" style={{ background: 'var(--bg-0)', border: '1px solid var(--border-soft)' }}>
          <KaTeXRender latex={input.solution} display />
        </div>
      )}
      <div>
        <div className="label mb-1">Final answer</div>
        <SmartMathInput
          value={input.answer}
          onChange={(v) => onChange({ ...input, answer: v })}
          placeholder="e.g. x = 3"
          multiline={false}
          compact
          disabled={disabled}
        />
      </div>
    </div>
  );
}

function TableField({
  template, input, onChange, disabled,
}: {
  template: Extract<Template, { type: 'table' }>;
  input: Extract<UserInput, { type: 'table' }>;
  onChange: (i: UserInput) => void;
  disabled?: boolean;
}) {
  const rows = input.rows.length ? input.rows : template.rows.map((r) => r.map(() => ''));
  const setCell = (r: number, c: number, v: string) => {
    const next = rows.map((row) => [...row]);
    if (!next[r]) next[r] = template.rows[r]?.map(() => '') || [];
    next[r][c] = v;
    onChange({ type: 'table', rows: next });
  };
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {template.columns.map((c, i) => (
              <th key={i} className="p-1 text-left font-semibold" style={{ color: 'var(--text-2)' }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {template.rows.map((_, ri) => (
            <tr key={ri}>
              {template.columns.map((_, ci) => (
                <td key={ci} className="p-1">
                  <input className="input !py-1.5 !px-2" value={rows[ri]?.[ci] || ''} disabled={disabled} onChange={(e) => setCell(ri, ci, e.target.value)} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BulletField({
  template, input, onChange, disabled,
}: {
  template: Extract<Template, { type: 'bullet' }>;
  input: Extract<UserInput, { type: 'bullet' }>;
  onChange: (i: UserInput) => void;
  disabled?: boolean;
}) {
  const items = input.items.length ? input.items : template.items.map(() => '');
  const setItem = (i: number, v: string) => {
    const next = [...items];
    next[i] = v;
    onChange({ type: 'bullet', items: next });
  };
  return (
    <div className="space-y-1.5">
      {template.items.map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="font-bold" style={{ color: 'var(--accent)' }}>•</span>
          <input className="input !py-1.5" value={items[i] || ''} placeholder={`Bullet ${i + 1}`} disabled={disabled} onChange={(e) => setItem(i, e.target.value)} />
        </div>
      ))}
    </div>
  );
}

function FlashcardField({
  template, input, onChange, disabled,
}: {
  template: Extract<Template, { type: 'flashcard' }>;
  input: Extract<UserInput, { type: 'flashcard' }>;
  onChange: (i: UserInput) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="surface-2 px-4 py-3" style={{ background: 'var(--bg-0)' }}>
        <div className="label mb-1">Front (prompt)</div>
        <p className="text-sm font-medium" style={{ color: 'var(--text-0)' }}>{template.front}</p>
      </div>
      <div>
        <div className="label mb-1">Back (recreate from memory)</div>
        <textarea className="input min-h-[80px] resize-y" value={input.back} placeholder="Recreate the back…" disabled={disabled} onChange={(e) => onChange({ type: 'flashcard', back: e.target.value })} />
      </div>
    </div>
  );
}

function DrawingField({
  template, input, onChange, disabled,
}: {
  template: Extract<Template, { type: 'drawing' }>;
  input: Extract<UserInput, { type: 'drawing' }>;
  onChange: (i: UserInput) => void;
  disabled?: boolean;
}) {
  return (
    <DrawingCanvas
      strokes={input.strokes}
      onChange={(strokes: Stroke[]) => onChange({ type: 'drawing', strokes })}
      width={template.width}
      height={template.height}
      disabled={disabled}
    />
  );
}

function SummaryScreen({ accuracy, onExit, notebookId }: { accuracy: number; onExit: () => void; notebookId: string }) {
  useEffect(() => {
    void notebookId;
  }, [notebookId]);

  return (
    <div className="h-screen overflow-y-auto" style={{ background: 'var(--bg-0)' }}>
      <div className="max-w-md mx-auto px-4 py-12">
        <div className="surface p-10 text-center animate-pop">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: 'var(--accent-soft)' }}>
            <Trophy size={32} style={{ color: 'var(--accent)' }} />
          </div>
          <h2 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-0)' }}>Session complete!</h2>
          <p className="text-sm mb-6" style={{ color: 'var(--text-3)' }}>Your scores and review schedule are updated.</p>
          <div className="surface-2 p-4 mb-6">
            <div className="text-3xl font-bold" style={{ color: scoreColor(accuracy) }}>{accuracy}%</div>
            <div className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>Overall accuracy this session</div>
          </div>
          <button className="btn-primary w-full" onClick={onExit}><Target size={16} /> Back to notebook</button>
        </div>
      </div>
    </div>
  );
}
export function BlurtSession(props: any) {
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        {/* We render the original screen content here */}
        <OriginalMyScreen {...props} /> 
      </View>
      <DonateFooter />
    </View>
  );
}