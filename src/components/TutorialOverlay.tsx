import { useState, useEffect, useRef, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Check } from 'lucide-react';

export interface TutorialStep {
  target?: string; // data-tutorial attribute value; omitted = centered intro/outro
  title: string;
  body: string;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

interface Props {
  steps: TutorialStep[];
  onClose: () => void;
  onComplete?: () => void;
}

export function TutorialOverlay({ steps, onClose, onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const rafRef = useRef<number>(0);

  const current = steps[step];
  const isLast = step === steps.length - 1;

  const updateRect = useCallback(() => {
    if (!current?.target) { setRect(null); return; }
    const el = document.querySelector(`[data-tutorial="${current.target}"]`) as HTMLElement | null;
    if (el) {
      const r = el.getBoundingClientRect();
      setRect(new DOMRect(r.left, r.top, r.width, r.height));
    } else {
      setRect(null);
    }
  }, [current]);

  useEffect(() => {
    updateRect();
    const handler = () => updateRect();
    window.addEventListener('resize', handler);
    window.addEventListener('scroll', handler, true);
    return () => {
      window.removeEventListener('resize', handler);
      window.removeEventListener('scroll', handler, true);
      cancelAnimationFrame(rafRef.current);
    };
  }, [updateRect]);

  // Re-measure on step change with a slight delay for layout settling
  useEffect(() => {
    rafRef.current = requestAnimationFrame(() => updateRect());
    return () => cancelAnimationFrame(rafRef.current);
  }, [step, updateRect]);

  const pad = 8;
  const spotlight = rect
    ? { left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }
    : null;

  // Tooltip position
  let tipStyle: React.CSSProperties = {};
  if (spotlight && current?.placement !== 'center' && current?.target) {
    const sp = spotlight;
    const tipMaxW = 320;
    if (current.placement === 'top') {
      tipStyle = { left: Math.min(Math.max(sp.left + sp.width / 2 - tipMaxW / 2, 16), window.innerWidth - tipMaxW - 16), top: Math.max(sp.top - 16, 16), transform: 'translateY(-100%)' };
    } else if (current.placement === 'bottom') {
      tipStyle = { left: Math.min(Math.max(sp.left + sp.width / 2 - tipMaxW / 2, 16), window.innerWidth - tipMaxW - 16), top: Math.min(sp.top + sp.height + 16, window.innerHeight - 200) };
    } else if (current.placement === 'left') {
      tipStyle = { left: Math.max(sp.left - tipMaxW - 24, 16), top: Math.max(sp.top, 16) };
    } else if (current.placement === 'right') {
      tipStyle = { left: Math.min(sp.left + sp.width + 24, window.innerWidth - tipMaxW - 16), top: Math.max(sp.top, 16) };
    }
  } else {
    tipStyle = { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' };
  }

  const next = () => {
    if (isLast) { onComplete?.(); onClose(); }
    else setStep((s) => s + 1);
  };
  const prev = () => setStep((s) => Math.max(0, s - 1));

  return (
    <div className="fixed inset-0 z-[100] pointer-events-auto" style={{ animation: 'fadeIn 0.2s ease' }}>
      {/* Backdrop with spotlight hole via 4 divs */}
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.55)' }} onClick={onClose} />
      {spotlight && (
        <>
          <div className="absolute" style={{ left: 0, top: 0, width: spotlight.left, height: spotlight.top, background: 'rgba(0,0,0,0.55)' }} />
          <div className="absolute" style={{ left: spotlight.left + spotlight.width, top: 0, right: 0, height: spotlight.top, background: 'rgba(0,0,0,0.55)' }} />
          <div className="absolute" style={{ left: 0, top: spotlight.top, width: spotlight.left, height: spotlight.top + spotlight.height, background: 'rgba(0,0,0,0.55)' }} />
          <div className="absolute" style={{ left: spotlight.left + spotlight.width, top: spotlight.top, right: 0, bottom: 0, background: 'rgba(0,0,0,0.55)' }} />
          <div className="absolute" style={{ left: 0, top: spotlight.top + spotlight.height, width: spotlight.left + spotlight.width, bottom: 0, background: 'rgba(0,0,0,0.55)' }} />
          <div className="absolute" style={{ left: 0, top: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.55)', clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${spotlight.left}px ${spotlight.top}px, ${spotlight.left}px ${spotlight.top + spotlight.height}px, ${spotlight.left + spotlight.width}px ${spotlight.top + spotlight.height}px, ${spotlight.left + spotlight.width}px ${spotlight.top}px, ${spotlight.left}px ${spotlight.top}px)` }} />
          {/* Highlighted border ring */}
          <div
            className="absolute rounded-lg pointer-events-none"
            style={{
              left: spotlight.left, top: spotlight.top, width: spotlight.width, height: spotlight.height,
              boxShadow: '0 0 0 3px var(--accent), 0 0 20px 4px rgba(245,158,11,0.35)',
              transition: 'all 0.25s ease',
            }}
          />
        </>
      )}

      {/* Tooltip card */}
      <div
        className="absolute rounded-xl border shadow-2xl p-4"
        style={{
          ...tipStyle,
          maxWidth: 320,
          width: 320,
          background: 'var(--bg-1)',
          borderColor: 'var(--accent)',
          animation: 'fadeInUp 0.25s ease',
        }}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-semibold text-base" style={{ color: 'var(--text-0)' }}>{current.title}</h3>
          <button className="btn-ghost !p-1 shrink-0" onClick={onClose} aria-label="Close tutorial"><X size={14} /></button>
        </div>
        <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--text-2)' }}>{current.body}</p>

        {/* Step circles */}
        <div className="flex items-center justify-center gap-2 mb-4">
          {steps.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all border-2"
              style={{
                width: i === step ? 32 : 28,
                height: i === step ? 32 : 28,
                background: i === step ? 'var(--accent)' : i < step ? 'var(--accent-soft)' : 'var(--bg-2)',
                color: i === step ? 'var(--btn-primary-text)' : i < step ? 'var(--accent)' : 'var(--text-3)',
                borderColor: i <= step ? 'var(--accent)' : 'var(--border)',
              }}
              aria-label={`Step ${i + 1}`}
            >
              {i < step ? <Check size={12} /> : i + 1}
            </button>
          ))}
        </div>

        {/* Nav buttons */}
        <div className="flex items-center justify-between">
          <button className="btn-ghost text-xs" onClick={onClose}>Skip</button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button className="btn-ghost text-xs" onClick={prev}><ChevronLeft size={14} /> Back</button>
            )}
            <button className="btn-primary text-xs" onClick={next}>
              {isLast ? <><Check size={14} /> Done</> : <>Next <ChevronRight size={14} /></>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
