import type { SourceFile } from '../db/types';
import { nanoid } from 'nanoid';

export function classifyFile(name: string, mime: string): SourceFile['kind'] {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (mime.includes('pdf') || ext === 'pdf') return 'pdf';
  if (ext === 'docx' || mime.includes('officedocument.wordprocessing')) return 'docx';
  if (ext === 'md' || mime === 'text/markdown') return 'md';
  if (ext === 'txt' || mime === 'text/plain') return 'txt';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext) || mime.startsWith('image/')) return 'image';
  return 'other';
}

export async function buildSource(
  file: File,
  notebookId: string,
): Promise<SourceFile> {
  const kind = classifyFile(file.name, file.type);
  const data = await file.arrayBuffer();
  let pageCount = 1;
  if (kind === 'pdf') {
    pageCount = await getPdfPageCount(data);
  }
  return {
    id: nanoid(),
    notebookId,
    name: file.name,
    kind,
    mime: file.type || 'application/octet-stream',
    size: file.size,
    data,
    pageCount,
    createdAt: Date.now(),
  };
}

async function getPdfPageCount(data: ArrayBuffer): Promise<number> {
  try {
    const pdfjs = await import('pdfjs-dist');
    const workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerSrc as string;
    const doc = await pdfjs.getDocument({ data: data.slice(0) }).promise;
    return doc.numPages;
  } catch {
    return 1;
  }
}
