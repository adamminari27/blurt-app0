import { useRef } from 'react';
import { MathLiveInput } from './MathLiveInput';

interface SymbolButton {
  label: string;
  insert: string;
  title?: string;
}

const GROUPS: { name: string; symbols: SymbolButton[] }[] = [
  {
    name: 'Basics',
    symbols: [
      { label: '+', insert: '+' }, { label: '−', insert: '-' }, { label: '×', insert: '\\times ' },
      { label: '÷', insert: '\\div ' }, { label: '±', insert: '\\pm ' }, { label: '=', insert: '=' },
      { label: '≠', insert: '\\neq ' }, { label: '≤', insert: '\\leq ' }, { label: '≥', insert: '\\geq ' },
      { label: '≈', insert: '\\approx ' },
    ],
  },
  {
    name: 'Fractions & Roots',
    symbols: [
      { label: 'a/b', insert: '\\frac{}{}', title: 'Fraction' },
      { label: '√', insert: '\\sqrt{}', title: 'Square root' },
      { label: '√[]', insert: '\\sqrt[]{}', title: 'Nth root' },
      { label: 'x²', insert: '^{}', title: 'Exponent' },
      { label: 'x₂', insert: '_{}', title: 'Subscript' },
      { label: 'xₙ', insert: '_{}^{}', title: 'Sub+superscript' },
      { label: '( )', insert: '\\left(\\right)' }, { label: '[ ]', insert: '\\left[\\right]' },
      { label: '{ }', insert: '\\{\\}' },
    ],
  },
  {
    name: 'Greek',
    symbols: [
      { label: 'α', insert: '\\alpha ' }, { label: 'β', insert: '\\beta ' }, { label: 'γ', insert: '\\gamma ' },
      { label: 'δ', insert: '\\delta ' }, { label: 'ε', insert: '\\epsilon ' }, { label: 'θ', insert: '\\theta ' },
      { label: 'λ', insert: '\\lambda ' }, { label: 'μ', insert: '\\mu ' }, { label: 'π', insert: '\\pi ' },
      { label: 'σ', insert: '\\sigma ' }, { label: 'φ', insert: '\\phi ' }, { label: 'ω', insert: '\\omega ' },
      { label: 'Δ', insert: '\\Delta ' }, { label: 'Σ', insert: '\\Sigma ' }, { label: 'Π', insert: '\\Pi ' },
      { label: 'Ω', insert: '\\Omega ' },
    ],
  },
  {
    name: 'Operators',
    symbols: [
      { label: '∑', insert: '\\sum_{}^{}' }, { label: '∏', insert: '\\prod_{}^{}' },
      { label: '∫', insert: '\\int_{}^{}' }, { label: '∮', insert: '\\oint_{}^{}' },
      { label: 'lim', insert: '\\lim_{}' }, { label: '∂', insert: '\\partial ' },
      { label: '∇', insert: '\\nabla ' }, { label: '∞', insert: '\\infty ' },
      { label: '→', insert: '\\rightarrow ' }, { label: '←', insert: '\\leftarrow ' },
      { label: '⇒', insert: '\\Rightarrow ' }, { label: '⇔', insert: '\\Leftrightarrow ' },
    ],
  },
  {
    name: 'Sets & Logic',
    symbols: [
      { label: '∈', insert: '\\in ' }, { label: '∉', insert: '\\notin ' }, { label: '⊂', insert: '\\subset ' },
      { label: '⊃', insert: '\\supset ' }, { label: '∪', insert: '\\cup ' }, { label: '∩', insert: '\\cap ' },
      { label: '∅', insert: '\\emptyset ' }, { label: '∀', insert: '\\forall ' },
      { label: '∃', insert: '\\exists ' }, { label: '¬', insert: '\\neg ' },
    ],
  },
];

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  multiline?: boolean;
}

export function EquationKeyboard({ value, onChange, placeholder, disabled, className, multiline = false }: Props) {
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);

  const insertAtCursor = (snippet: string) => {
    const el = inputRef.current;
    if (!el || disabled) return;
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const next = value.slice(0, start) + snippet + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + snippet.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const insertNewLine = () => {
    if (!multiline) return;
    insertAtCursor('\n');
  };

  return (
    <div className={className}>
      {multiline ? (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          className="input font-mono min-h-[80px] resize-y whitespace-pre"
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.shiftKey) {
              e.preventDefault();
              insertNewLine();
            }
          }}
        />
      ) : (
        <MathLiveInput
          value={value}
          onChange={onChange}
          disabled={disabled}
        />
      )}
      <div className="mt-2 space-y-1.5">
        {multiline && (
          <div className="flex items-start gap-2 pb-1.5 mb-1.5 border-b" style={{ borderColor: 'var(--border-soft)' }}>
            <span className="label !text-[10px] pt-1 w-16 shrink-0">Lines</span>
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                disabled={disabled}
                className="btn-subtle !py-1 !px-2.5 !text-xs"
                title="Insert a new line (Shift+Enter)"
                onClick={insertNewLine}
              >
                ⏎ New line
              </button>
            </div>
          </div>
        )}
        {GROUPS.map((g) => (
          <div key={g.name} className="flex items-start gap-2">
            <span className="label !text-[10px] pt-1 w-16 shrink-0">{g.name}</span>
            <div className="flex flex-wrap gap-1">
              {g.symbols.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  disabled={disabled}
                  className="btn-subtle !py-1 !px-2 !text-xs min-w-[32px] font-mono"
                  title={s.title || s.label}
                  onClick={() => insertAtCursor(s.insert)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
