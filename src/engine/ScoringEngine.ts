// ScoringEngine.ts — Pure, deterministic, zero-AI local grading.
// Text: Jaccard token similarity. Drawing: 64x64 visual Jaccard. Equations: Levenshtein distance.

import type { Stroke } from '../db/types';

// ============ Text: Jaccard Similarity ============

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'at', 'is',
  'are', 'was', 'were', 'be', 'been', 'being', 'this', 'that', 'these',
  'those', 'it', 'as', 'for', 'with', 'by', 'from', 'into', 'over', 'under',
  'then', 'than', 'so', 'such', 'not', 'no', 'do', 'does', 'did', 'has',
  'have', 'had', 'will', 'would', 'could', 'should', 'may', 'might', 'can',
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/** Jaccard = |A ∩ B| / |A ∪ B|. Returns 0..100. */
export function jaccardSimilarity(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  if (setA.size === 0 && setB.size === 0) return 100;
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  setA.forEach((t) => { if (setB.has(t)) intersection++; });
  const union = setA.size + setB.size - intersection;
  return (intersection / union) * 100;
}

export function scoreText(source: string, user: string): number {
  return jaccardSimilarity(tokenize(source), tokenize(user));
}

// ============ Equations: Levenshtein Distance ============

export function normalizeLatex(latex: string): string {
  return latex
    .replace(/\\displaystyle/g, '').replace(/\\!/g, '').replace(/\\,/g, '')
    .replace(/\\;/g, '').replace(/\\:/g, '').replace(/\\left/g, '').replace(/\\right/g, '')
    .replace(/\{\\rm\s+([^}]*)\}/g, '$1').replace(/\{\\text\s+([^}]*)\}/g, '$1')
    .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '($1)/($2)')
    .replace(/\\sqrt\{([^}]*)\}/g, 'sqrt($1)')
    .replace(/\\cdot/g, '*').replace(/\\times/g, '*').replace(/\\div/g, '/')
    .replace(/\\pm/g, '+-').replace(/\\mp/g, '-+')
    .replace(/\\leq/g, '<=').replace(/\\geq/g, '>=').replace(/\\neq/g, '!=')
    .replace(/\\rightarrow/g, '->').replace(/\\leftarrow/g, '<-')
    .replace(/\\alpha/g, 'a').replace(/\\beta/g, 'b').replace(/\\gamma/g, 'g')
    .replace(/\\delta/g, 'd').replace(/\\theta/g, 'th').replace(/\\pi/g, 'pi')
    .replace(/\\infty/g, 'inf').replace(/\\sum/g, 'sum').replace(/\\int/g, 'int')
    .replace(/\\prod/g, 'prod').replace(/\\partial/g, 'd').replace(/\\nabla/g, 'nabla')
    .replace(/\\overline\{([^}]*)\}/g, '($1)').replace(/\\underline\{([^}]*)\}/g, '($1)')
    .replace(/\\hat\{([^}]*)\}/g, '($1)').replace(/\\bar\{([^}]*)\}/g, '($1)')
    .replace(/\\vec\{([^}]*)\}/g, '($1)').replace(/\\dot\{([^}]*)\}/g, '($1)')
    .replace(/\\mathbb\{([^}]*)\}/g, '$1').replace(/\\mathcal\{([^}]*)\}/g, '$1')
    .replace(/\\mathbf\{([^}]*)\}/g, '$1').replace(/\\mathrm\{([^}]*)\}/g, '$1')
    .replace(/\\text\{([^}]*)\}/g, '$1').replace(/\\textbf\{([^}]*)\}/g, '$1')
    .replace(/\\textit\{([^}]*)\}/g, '$1').replace(/\\emph\{([^}]*)\}/g, '$1')
    .replace(/\\textcolor\{[^}]*\}\{([^}]*)\}/g, '$1').replace(/\\color\{[^}]*\}/g, '')
    .replace(/\^\{([^}]*)\}/g, '^($1)').replace(/_\{([^}]*)\}/g, '_($1)')
    .replace(/\\\[/g, '(').replace(/\\\]/g, ')').replace(/\\\(/g, '(').replace(/\\\)/g, ')')
    .replace(/\\\{/g, '(').replace(/\\\}/g, ')')
    .replace(/\\\\/g, '').replace(/\s+/g, '').trim();
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

/** 1 - (LevenshteinDistance / MaxLength). Returns 0..100. */
export function scoreEquation(sourceLatex: string, userLatex: string): number {
  const normSrc = normalizeLatex(sourceLatex);
  const normUsr = normalizeLatex(userLatex);
  const maxLen = Math.max(normSrc.length, normUsr.length);
  if (maxLen === 0) return 100;
  if (normSrc.length === 0 || normUsr.length === 0) return 0;
  const dist = levenshtein(normSrc, normUsr);
  return ((maxLen - dist) / maxLen) * 100;
}

// ============ Drawing: 64x64 Visual Jaccard ============

const GRID = 64;
const N = GRID * GRID; // 4096

/** Rasterize strokes to a 64x64 binary grid. O(stroke_points). */
function rasterizeDrawing(strokes: Stroke[], width: number, height: number): Uint8Array {
  const grid = new Uint8Array(N);
  if (strokes.length === 0) return grid;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of strokes) for (const p of s.points) {
    if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y;
  }
  const w = Math.max(1, maxX - minX);
  const h = Math.max(1, maxY - minY);
  const scale = Math.min(GRID / w, GRID / h) * 0.85;
  const ox = (GRID - w * scale) / 2 - minX * scale;
  const oy = (GRID - h * scale) / 2 - minY * scale;
  const mark = (gx: number, gy: number) => {
    const x = Math.floor(gx), y = Math.floor(gy);
    if (x >= 0 && x < GRID && y >= 0 && y < GRID) grid[y * GRID + x] = 1;
  };
  for (const s of strokes) {
    if (s.points.length === 1) { mark(s.points[0].x * scale + ox, s.points[0].y * scale + oy); continue; }
    for (let i = 0; i < s.points.length - 1; i++) {
      const x0 = s.points[i].x * scale + ox, y0 = s.points[i].y * scale + oy;
      const x1 = s.points[i + 1].x * scale + ox, y1 = s.points[i + 1].y * scale + oy;
      const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
      for (let t = 0; t <= steps; t++) {
        const f = t / steps;
        mark(x0 + (x1 - x0) * f, y0 + (y1 - y0) * f);
      }
    }
  }
  return grid;
}

/** Pixel-level Jaccard similarity between two 64x64 binary matrices. O(n) where n=4096. */
export function scoreDrawing(
  sourceStrokes: Stroke[],
  userStrokes: Stroke[],
  width: number,
  height: number,
): number {
  const src = rasterizeDrawing(sourceStrokes, width, height);
  const usr = rasterizeDrawing(userStrokes, width, height);
  let intersection = 0, union = 0;
  for (let i = 0; i < N; i++) {
    const a = src[i], b = usr[i];
    if (a && b) intersection++;
    if (a || b) union++;
  }
  return union > 0 ? (intersection / union) * 100 : 0;
}

// ============ Unified score interface ============

export interface ScoreResult {
  accuracyPercentage: number; // 0..100
  weakPoints: string[];
  fragmentScores: Record<string, number>;
}

export { splitSentences } from './scoring';
