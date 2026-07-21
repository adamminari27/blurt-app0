import { useEffect, useState, useRef } from 'react';
import type { SourceFile } from '../db/types';
import { extractSourceText } from '../engine/ocr';
import { Copy, FileText, Loader2 } from 'lucide-react';

interface Props {
  source: SourceFile;
}

export function SourceViewer({ source }: Props) {
  const [page, setPage] = useState(1);
  const [textContent, setTextContent] = useState<string>('');
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [imgUrl, setImgUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let revoked = false;
    setLoading(true);
    (async () => {
      if (source.kind === 'image') {
        const url = URL.createObjectURL(new Blob([source.data], { type: source.mime }));
        setImgUrl(url);
        setLoading(false);
        return () => { if (!revoked) URL.revokeObjectURL(url); };
      }
      if (source.kind === 'txt' || source.kind === 'md' || source.kind === 'docx') {
        const text = await extractSourceText(source);
        setTextContent(text);
        setLoading(false);
        return;
      }
      if (source.kind === 'pdf') {
        try {
          const pdfjs = await import('pdfjs-dist');
          const workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
          pdfjs.GlobalWorkerOptions.workerSrc = workerSrc as string;
          const doc = await pdfjs.getDocument({ data: source.data.slice(0) }).promise;
          setPdfDoc(doc);
          setLoading(false);
        } catch { setLoading(false); }
        return;
      }
      setLoading(false);
    })();
    return () => { revoked = true; };
  }, [source]);

  useEffect(() => {
    if (source.kind !== 'pdf' || !pdfDoc) return;
    (async () => {
      const p = await pdfDoc.getPage(page);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d')!;
      const viewport = p.getViewport({ scale: 1.5 });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await p.render({ canvasContext: ctx, viewport }).promise;
    })();
  }, [pdfDoc, page, source.kind]);

  const copyAll = async () => {
    try { await navigator.clipboard.writeText(textContent); } catch { /* ignore */ }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: 'var(--border-soft)' }}>
        <div className="flex items-center gap-2 min-w-0">
          <FileText size={16} style={{ color: 'var(--accent)' }} />
          <span className="text-sm font-medium truncate" style={{ color: 'var(--text-0)' }}>{source.name}</span>
        </div>
        {textContent && (
          <button className="btn-subtle !py-1.5 !px-2.5 text-xs" onClick={copyAll}>
            <Copy size={13} /> Copy
          </button>
        )}
      </div>
      <div className="flex-1 overflow-auto p-4" style={{ background: 'var(--bg-0)' }}>
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="animate-spin" style={{ color: 'var(--text-3)' }} />
          </div>
        ) : source.kind === 'image' ? (
          <img src={imgUrl} alt={source.name} className="max-w-full mx-auto rounded-lg" />
        ) : source.kind === 'pdf' ? (
          <div className="flex flex-col items-center gap-3">
            <canvas ref={canvasRef} className="max-w-full rounded-lg shadow-lg bg-white" />
            <div className="flex items-center gap-2">
              <button className="btn-subtle !py-1 !px-2.5 text-xs" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>Prev</button>
              <span className="text-xs" style={{ color: 'var(--text-2)' }}>Page {page} / {source.pageCount}</span>
              <button className="btn-subtle !py-1 !px-2.5 text-xs" onClick={() => setPage((p) => Math.min(source.pageCount, p + 1))} disabled={page >= source.pageCount}>Next</button>
            </div>
          </div>
        ) : source.kind === 'other' ? (
          <div className="text-center py-12">
            <p className="text-sm" style={{ color: 'var(--text-2)' }}>This file type can't be rendered inline. It's stored as an attachment.</p>
          </div>
        ) : (
          <pre className="whitespace-pre-wrap text-sm leading-relaxed font-serif" style={{ color: 'var(--text-1)' }}>
            {textContent || '(empty)'}
          </pre>
        )}
      </div>
    </div>
  );
}
