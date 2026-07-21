import { useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import type { Template, Stroke } from '../db/types';
import { KaTeXRender } from './KaTeXRender';
import { DrawingCanvas } from './DrawingCanvas';
import { SmartMathInput } from './SmartMathInput';

interface Props {
  template: Template;
  onChange: (t: Template) => void;
  onDelete: () => void;
}

export function TemplateEditor({ template, onChange, onDelete }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const update = (patch: Partial<Template>) =>
    onChange({ ...template, ...patch, updatedAt: Date.now() } as Template);

  return (
    <div className="surface-2 p-3.5 animate-fade-in">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button className="btn-ghost !p-1" onClick={() => setCollapsed((c) => !c)} aria-label="Toggle">
            {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
          <span className="chip" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
            {typeLabel(template.type)}
          </span>
          <input
            className="input !bg-transparent !border-transparent !px-1.5 font-semibold"
            style={{ color: 'var(--text-0)' }}
            value={template.title}
            onChange={(e) => update({ title: e.target.value } as Partial<Template>)}
          />
        </div>
        <button className="btn-ghost !p-1.5" onClick={onDelete} aria-label="Delete template">
          <Trash2 size={15} />
        </button>
      </div>
      {!collapsed && <Body template={template} update={update} />}
    </div>
  );
}

function typeLabel(t: Template['type']): string {
  return {
    plain: 'Text', table: 'Table', equation: 'Equation',
    bullet: 'Bullets', flashcard: 'Flashcard', drawing: 'Drawing',
  }[t];
}

function Body({ template, update }: { template: Template; update: (p: Partial<Template>) => void }) {
  switch (template.type) {
    case 'plain':
      return (
        <textarea
          className="input min-h-[100px] resize-y leading-relaxed"
          style={{ fontFamily: 'var(--font-serif)' }}
          value={template.text}
          placeholder="Write your notes…"
          onChange={(e) => update({ text: e.target.value })}
        />
      );
    case 'equation':
      return <EquationEditor template={template} update={update} />;
    case 'table':
      return <TableEditor template={template} update={update} />;
    case 'bullet':
      return <BulletEditor template={template} update={update} />;
    case 'flashcard':
      return <FlashcardEditor template={template} update={update} />;
    case 'drawing':
      return <DrawingEditor template={template} update={update} />;
  }
}

function EquationEditor({
  template, update,
}: {
  template: Extract<Template, { type: 'equation' }>;
  update: (p: Partial<Template>) => void;
}) {
  return (
    <div className="space-y-2.5">
      <div>
        <div className="label mb-1">Problem / context</div>
        <input
          className="input"
          value={template.problem}
          placeholder="e.g. Find the kinetic energy of mass m at velocity v"
          onChange={(e) => update({ problem: e.target.value })}
        />
      </div>
      {/* Rendered solution preview at the top */}
      {template.solution && (
        <div className="surface px-4 py-3 overflow-x-auto">
          <KaTeXRender latex={template.solution} display />
        </div>
      )}
      <div>
        <div className="label mb-1">Solution</div>
        <SmartMathInput
          value={template.solution}
          onChange={(v) => update({ solution: v })}
          placeholder="Type naturally — e.g. E = 1/2 m v^2"
          multiline
        />
      </div>
      <div>
        <div className="label mb-1">Final answer</div>
        <SmartMathInput
          value={template.answer}
          onChange={(v) => update({ answer: v })}
          placeholder="e.g. x = 3"
          multiline={false}
          compact
        />
      </div>
    </div>
  );
}

function TableEditor({
  template, update,
}: {
  template: Extract<Template, { type: 'table' }>;
  update: (p: Partial<Template>) => void;
}) {
  const setCol = (i: number, v: string) => {
    const columns = [...template.columns];
    columns[i] = v;
    update({ columns });
  };
  const setCell = (r: number, c: number, v: string) => {
    const rows = template.rows.map((row) => [...row]);
    rows[r][c] = v;
    update({ rows });
  };
  const addRow = () => update({ rows: [...template.rows, template.columns.map(() => '')] });
  const addCol = () => update({
    columns: [...template.columns, `Column ${template.columns.length + 1}`],
    rows: template.rows.map((r) => [...r, '']),
  });
  const delRow = (i: number) => update({ rows: template.rows.filter((_, idx) => idx !== i) });
  const delCol = (i: number) => update({
    columns: template.columns.filter((_, idx) => idx !== i),
    rows: template.rows.map((r) => r.filter((_, idx) => idx !== i)),
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {template.columns.map((c, i) => (
              <th key={i} className="p-1">
                <div className="flex items-center gap-1">
                  <input className="input !py-1 !px-2 font-semibold" value={c} onChange={(e) => setCol(i, e.target.value)} />
                  <button className="btn-ghost !p-1" onClick={() => delCol(i)} aria-label="Delete column"><Trash2 size={13} /></button>
                </div>
              </th>
            ))}
            <th className="p-1 w-8"><button className="btn-ghost !p-1" onClick={addCol} aria-label="Add column"><Plus size={14} /></button></th>
          </tr>
        </thead>
        <tbody>
          {template.rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci} className="p-1">
                  <input className="input !py-1.5 !px-2" value={cell} onChange={(e) => setCell(ri, ci, e.target.value)} />
                </td>
              ))}
              <td className="p-1 w-8"><button className="btn-ghost !p-1" onClick={() => delRow(ri)} aria-label="Delete row"><Trash2 size={13} /></button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="btn-subtle mt-2 text-xs" onClick={addRow}><Plus size={13} /> Add row</button>
    </div>
  );
}

function BulletEditor({
  template, update,
}: {
  template: Extract<Template, { type: 'bullet' }>;
  update: (p: Partial<Template>) => void;
}) {
  const setItem = (i: number, v: string) => {
    const items = [...template.items];
    items[i] = v;
    update({ items });
  };
  const addItem = () => update({ items: [...template.items, ''] });
  const delItem = (i: number) => update({ items: template.items.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-1.5">
      {template.items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-amber-500 font-bold">•</span>
          <input className="input !py-1.5" value={item} placeholder={`Bullet ${i + 1}`} onChange={(e) => setItem(i, e.target.value)} />
          <button className="btn-ghost !p-1" onClick={() => delItem(i)} aria-label="Delete bullet"><Trash2 size={14} /></button>
        </div>
      ))}
      <button className="btn-subtle text-xs" onClick={addItem}><Plus size={13} /> Add bullet</button>
    </div>
  );
}

function FlashcardEditor({
  template, update,
}: {
  template: Extract<Template, { type: 'flashcard' }>;
  update: (p: Partial<Template>) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <div className="label mb-1">Front (prompt — shown in Blurt mode)</div>
        <textarea className="input min-h-[80px] resize-y" value={template.front} placeholder="Question / prompt" onChange={(e) => update({ front: e.target.value })} />
      </div>
      <div>
        <div className="label mb-1">Back (answer — blanked in Blurt mode)</div>
        <textarea className="input min-h-[80px] resize-y" value={template.back} placeholder="Answer" onChange={(e) => update({ back: e.target.value })} />
      </div>
    </div>
  );
}

function DrawingEditor({
  template, update,
}: {
  template: Extract<Template, { type: 'drawing' }>;
  update: (p: Partial<Template>) => void;
}) {
  return (
    <div className="space-y-2.5">
      <DrawingCanvas
        strokes={template.strokes}
        onChange={(strokes: Stroke[]) => update({ strokes } as Partial<Template>)}
        width={template.width}
        height={template.height}
      />
      <p className="text-xs" style={{ color: 'var(--text-3)' }}>
        In Blurt mode, you'll redraw this from memory. Scoring compares the shapes.
      </p>
    </div>
  );
}
