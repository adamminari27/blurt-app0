import { useRef, useEffect, useState, useCallback } from 'react';
import type { CSSProperties } from 'react';
import { AlignJustify } from 'lucide-react';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'math-field': any;
    }
  }
}

let mathliveLoaded = false;
function loadMathLive(): Promise<void> {
  if (mathliveLoaded) return Promise.resolve();
  if (customElements.get('math-field')) {
    mathliveLoaded = true;
    return Promise.resolve();
  }
  return import('mathlive').then(() => {
    mathliveLoaded = true;
  });
}

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
  onChange: (latex: string) => void;
  placeholder?: string;
  disabled?: boolean;
  multiline?: boolean;
  className?: string;
  style?: CSSProperties;
  /** Compact mode: smaller field, no keyboard toggle */
  compact?: boolean;
}

export function SmartMathInput({
  value,
  onChange,
  placeholder,
  disabled,
  multiline = true,
  className,
  style,
  compact = false,
}: Props) {
  const fieldRef = useRef<HTMLElement | null>(null);
  const loadedRef = useRef(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    loadMathLive().then(() => {
      if (!mounted) return;
      loadedRef.current = true;
      const el = fieldRef.current;
      if (el) {
        try {
          (el as any).value = value || '';
          if (placeholder) (el as any).placeholder = placeholder;
          if (multiline) (el as any).smartMode = true;
        } catch { /* ignore */ }
      }
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const el = fieldRef.current;
    if (!el || !loadedRef.current) return;
    try {
      if ((el as any).value !== value) (el as any).value = value || '';
    } catch { /* ignore */ }
  }, [value]);

  const handleInput = useCallback((e: Event) => {
    const el = e.target as HTMLElement;
    try {
      const latex = (el as any).getValue?.('latex') ?? '';
      onChange(latex);
    } catch { /* ignore */ }
  }, [onChange]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!multiline) return;
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      const el = fieldRef.current as any;
      if (!el) return;
      try {
        el.executeCommand(['insert', '\\newline']);
      } catch {
        el.executeCommand('insert', '\\newline');
      }
    }
  }, [multiline]);

  useEffect(() => {
    const el = fieldRef.current;
    if (!el) return;
    el.addEventListener('input', handleInput as EventListener);
    el.addEventListener('keydown', handleKeyDown as EventListener);
    return () => {
      el.removeEventListener('input', handleInput as EventListener);
      el.removeEventListener('keydown', handleKeyDown as EventListener);
    };
  }, [handleInput, handleKeyDown]);

  const insertSymbol = (snippet: string) => {
    const el = fieldRef.current as any;
    if (!el || disabled) return;
    try {
      el.focus();
      el.executeCommand(['insert', snippet]);
    } catch {
      try { el.executeCommand('insert', snippet); } catch { /* ignore */ }
    }
  };

  const insertNewLine = () => {
    if (!multiline) return;
    const el = fieldRef.current as any;
    if (!el) return;
    try {
      el.focus();
      el.executeCommand(['insert', '\\newline']);
    } catch {
      try { el.executeCommand('insert', '\\newline'); } catch { /* ignore */ }
    }
  };

  if (compact) {
    return (
      <div className={className} style={style}>
        <math-field
          ref={fieldRef as any}
          disabled={disabled}
          style={{
            width: '100%',
            minHeight: '44px',
            display: 'flex',
            alignItems: 'center',
            padding: '6px 10px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            background: 'var(--bg-0)',
            color: 'var(--text-0)',
            fontSize: '16px',
            outline: 'none',
            transition: 'border-color 0.2s',
          }}
        />
      </div>
    );
  }

  return (
    <div className={className} style={style}>
      {/* Formula-bar style input row */}
      <div
        className="flex items-stretch rounded-lg overflow-hidden"
        style={{ border: '1px solid var(--border)', background: 'var(--bg-0)' }}
      >
        {/* Left action buttons */}
        <div className="flex flex-col border-r" style={{ borderColor: 'var(--border-soft)' }}>
          {multiline && (
            <button
              type="button"
              disabled={disabled}
              title="Insert new line (Shift+Enter)"
              onClick={insertNewLine}
              className="flex items-center justify-center px-3 hover:bg-[var(--bg-2)] transition-colors"
              style={{
                color: 'var(--text-2)',
                minHeight: '44px',
                borderBottom: '1px solid var(--border-soft)',
              }}
            >
              <AlignJustify size={15} />
            </button>
          )}
          <button
            type="button"
            disabled={disabled}
            title="Symbol keyboard"
            onClick={() => setKeyboardOpen((s) => !s)}
            className="flex items-center justify-center px-3 hover:bg-[var(--bg-2)] transition-colors flex-1"
            style={{
              color: keyboardOpen ? 'var(--accent)' : 'var(--text-2)',
              minHeight: '44px',
              fontWeight: 600,
              fontSize: '13px',
              letterSpacing: '0.03em',
            }}
          >
            ƒ
          </button>
        </div>

        {/* Math field */}
        <math-field
          ref={fieldRef as any}
          disabled={disabled}
          style={{
            flex: 1,
            minHeight: '56px',
            display: 'flex',
            alignItems: 'flex-start',
            padding: '10px 12px',
            background: 'transparent',
            color: 'var(--text-0)',
            fontSize: '16px',
            outline: 'none',
            border: 'none',
          }}
        />
      </div>

      {/* Symbol keyboard panel */}
      {keyboardOpen && (
        <div className="mt-1.5 space-y-1.5 surface-2 p-2 rounded-lg">
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
                    onClick={() => insertSymbol(s.insert)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
