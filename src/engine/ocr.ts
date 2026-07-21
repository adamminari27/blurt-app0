import type { SourceFile } from '../db/types';

// Source text extraction (no Tesseract; images are rendered, not OCR'd).

export async function extractDocxText(data: ArrayBuffer): Promise<string> {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ arrayBuffer: data });
  return result.value;
}

export async function extractTxtText(data: ArrayBuffer): Promise<string> {
  return new TextDecoder('utf-8').decode(data);
}

export async function extractSourceText(src: SourceFile): Promise<string> {
  switch (src.kind) {
    case 'txt':
    case 'md':
      return extractTxtText(src.data);
    case 'docx':
      return extractDocxText(src.data);
    case 'pdf':
      return extractPdfText(src.data);
    default:
      return '';
  }
}

async function extractPdfText(data: ArrayBuffer): Promise<string> {
  try {
    const pdfjs = await import('pdfjs-dist');
    const workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerSrc as string;
    const doc = await pdfjs.getDocument({ data: data.slice(0) }).promise;
    let text = '';
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((it: any) => it.str).join(' ') + '\n\n';
    }
    return text;
  } catch {
    return '';
  }
}
