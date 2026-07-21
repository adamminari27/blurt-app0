import { useEffect, useRef, useState, useCallback } from 'react';
import type { Stroke, Point } from '../db/types';

interface Props {
  strokes: Stroke[];
  onChange?: (strokes: Stroke[]) => void;
  width: number;
  height: number;
  color?: string;
  strokeWidth?: number;
  readOnly?: boolean;
  disabled?: boolean;
  className?: string;
}

const COLORS = ['#f8fafc', '#f59e0b', '#38bdf8', '#34d399', '#f87171', '#c084fc'];

export function DrawingCanvas({
  strokes,
  onChange,
  width,
  height,
  color = '#f8fafc',
  strokeWidth = 2.5,
  readOnly = false,
  disabled = false,
  className,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const drawing = useRef(false);
  const currentStroke = useRef<Stroke | null>(null);
  const [activeColor, setActiveColor] = useState(color);
  const [activeWidth, setActiveWidth] = useState(strokeWidth);
  const [scale, setScale] = useState(1);

  const drawAll = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const all = currentStroke.current ? [...strokes, currentStroke.current] : strokes;
    for (const stroke of all) {
      if (stroke.points.length < 1) continue;
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    }
  }, [strokes]);

  useEffect(() => {
    drawAll();
  }, [drawAll]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => {
      const w = wrap.clientWidth;
      setScale(Math.min(1, w / width));
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [width]);

  const getPos = (e: PointerEvent | React.PointerEvent): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / scale,
      y: (e.clientY - rect.top) / scale,
    };
  };

  const onDown = (e: React.PointerEvent) => {
    if (readOnly || disabled) return;
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    drawing.current = true;
    currentStroke.current = {
      points: [getPos(e)],
      color: activeColor,
      width: activeWidth,
    };
  };

  const onMove = (e: React.PointerEvent) => {
    if (!drawing.current || !currentStroke.current) return;
    e.preventDefault();
    currentStroke.current.points.push(getPos(e));
    drawAll();
  };

  const onUp = () => {
    if (!drawing.current || !currentStroke.current) return;
    drawing.current = false;
    if (currentStroke.current.points.length > 0 && onChange) {
      onChange([...strokes, currentStroke.current]);
    }
    currentStroke.current = null;
  };

  const undo = () => {
    if (onChange) onChange(strokes.slice(0, -1));
  };
  const clear = () => {
    if (onChange) onChange([]);
  };

  return (
    <div className={className} ref={wrapRef}>
      <div
        className="relative overflow-hidden rounded-xl border"
        style={{
          borderColor: 'var(--border)',
          background: 'var(--bg-0)',
          width: width * scale,
          height: height * scale,
        }}
      >
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          style={{
            width: width * scale,
            height: height * scale,
            touchAction: 'none',
            cursor: readOnly || disabled ? 'default' : 'crosshair',
          }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        />
      </div>
      {!readOnly && !disabled && (
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setActiveColor(c)}
                className="w-6 h-6 rounded-full border-2 transition"
                style={{
                  background: c,
                  borderColor: activeColor === c ? 'var(--accent)' : 'transparent',
                }}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
          <div className="flex items-center gap-1">
            {[1.5, 2.5, 4].map((w) => (
              <button
                key={w}
                onClick={() => setActiveWidth(w)}
                className="w-7 h-7 rounded-md flex items-center justify-center transition"
                style={{
                  background: activeWidth === w ? 'var(--bg-3)' : 'var(--bg-2)',
                  border: `1px solid ${activeWidth === w ? 'var(--accent)' : 'var(--border)'}`,
                }}
              >
                <span
                  className="rounded-full"
                  style={{ width: w * 2, height: w * 2, background: 'var(--text-1)' }}
                />
              </button>
            ))}
          </div>
          <button className="btn-subtle !py-1.5 !px-2.5 text-xs" onClick={undo}>Undo</button>
          <button className="btn-subtle !py-1.5 !px-2.5 text-xs" onClick={clear}>Clear</button>
        </div>
      )}
    </div>
  );
}
