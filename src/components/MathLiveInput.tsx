import { useRef, useEffect } from 'react';
import type { CSSProperties } from 'react';

// Type declaration for the MathLive web component
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'math-field': any;
    }
  }
}

// Lazy-load MathLive only once at module level
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

interface Props {
  value: string;
  onChange: (latex: string) => void;
  placeholder?: string;
  disabled?: boolean;
  style?: CSSProperties;
}

export function MathLiveInput({ value, onChange, disabled, style }: Props) {
  const ref = useRef<HTMLElement | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    loadMathLive().then(() => {
      if (!mounted) return;
      loadedRef.current = true;
      // Force re-render of the math-field by toggling key
      const el = ref.current;
      if (el) {
        try { (el as any).value = value || ''; } catch { /* ignore */ }
      }
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || !loadedRef.current) return;
    try {
      if ((el as any).value !== value) (el as any).value = value || '';
    } catch { /* ignore */ }
  }, [value]);

  const handleInput = (e: Event) => {
    const el = e.target as HTMLElement;
    try {
      const latex = (el as any).getValue?.('latex') ?? '';
      onChange(latex);
    } catch { /* ignore */ }
  };

  return (
    <div style={style} className="mathlive-wrap">
      <math-field
        ref={ref as any}
        oninput={handleInput as any}
        disabled={disabled}
        style={{
          width: '100%',
          minHeight: '48px',
          display: 'flex',
          alignItems: 'center',
          padding: '6px 10px',
          borderRadius: '8px',
          border: '1px solid var(--border)',
          background: 'var(--bg-0)',
          color: 'var(--text-0)',
          fontSize: '16px',
          outline: 'none',
        }}
      />
    </div>
  );
}
