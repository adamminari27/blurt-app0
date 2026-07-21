import { useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface Props {
  latex: string;
  display?: boolean;
  className?: string;
}

export function KaTeXRender({ latex, display = false, className }: Props) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = '';

    const lines = (latex || '').split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    if (lines.length === 0) {
      if (display) {
        const empty = document.createElement('span');
        empty.className = 'katex-empty';
        empty.style.opacity = '0.4';
        empty.textContent = ' ';
        ref.current.appendChild(empty);
      }
      return;
    }

    for (const line of lines) {
      const wrapper = document.createElement('div');
      wrapper.className = display ? 'katex-line katex-display' : 'katex-line';
      try {
        katex.render(line, wrapper, {
          throwOnError: false,
          displayMode: display,
          output: 'html',
        });
      } catch {
        wrapper.textContent = line;
      }
      ref.current.appendChild(wrapper);
    }
  }, [latex, display]);

  return <span ref={ref} className={className} />;
}
