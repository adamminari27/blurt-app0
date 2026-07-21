import { useRef, useState, useCallback, useEffect, type ReactNode } from 'react';

export interface PaneState {
  width: number; // px, for left/right side panes
  visible: boolean;
}

interface Props {
  left: ReactNode;
  leftState: PaneState;
  onLeftStateChange: (s: PaneState) => void;
  middle: ReactNode;
  right: ReactNode;
  rightState: PaneState;
  onRightStateChange: (s: PaneState) => void;
  minLeft?: number;
  maxLeft?: number;
  minRight?: number;
  maxRight?: number;
}

export function ResizablePanes({
  left, leftState, onLeftStateChange,
  middle,
  right, rightState, onRightStateChange,
  minLeft = 180, maxLeft = 480,
  minRight = 200, maxRight = 520,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<'left' | 'right' | null>(null);

  const onPointerMove = useCallback((e: PointerEvent) => {
    if (!dragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (dragging === 'left') {
      const w = Math.max(minLeft, Math.min(maxLeft, e.clientX - rect.left));
      onLeftStateChange({ width: w, visible: true });
    } else {
      const w = Math.max(minRight, Math.min(maxRight, rect.right - e.clientX));
      onRightStateChange({ width: w, visible: true });
    }
  }, [dragging, minLeft, maxLeft, minRight, maxRight, onLeftStateChange, onRightStateChange]);

  useEffect(() => {
    if (!dragging) return;
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', () => setDragging(null));
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
    };
  }, [dragging, onPointerMove]);

  return (
    <div ref={containerRef} className="flex-1 flex overflow-hidden">
      {leftState.visible && (
        <>
          <div style={{ width: leftState.width }} className="shrink-0 overflow-hidden">
            {left}
          </div>
          <div
            className="w-1 shrink-0 cursor-col-resize hover:bg-amber-500/40 transition-colors"
            style={{ background: 'var(--border)' }}
            onPointerDown={(e) => { e.preventDefault(); setDragging('left'); }}
          />
        </>
      )}
      <div className="flex-1 overflow-hidden min-w-0">{middle}</div>
      {rightState.visible && (
        <>
          <div
            className="w-1 shrink-0 cursor-col-resize hover:bg-amber-500/40 transition-colors"
            style={{ background: 'var(--border)' }}
            onPointerDown={(e) => { e.preventDefault(); setDragging('right'); }}
          />
          <div style={{ width: rightState.width }} className="shrink-0 overflow-hidden">
            {right}
          </div>
        </>
      )}
    </div>
  );
}
