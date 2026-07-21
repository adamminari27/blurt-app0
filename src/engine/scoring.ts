import type {
  Template,
  UserInput,
  ScoreObject,
  AccuracyRecord,
  Stroke,
  DrawingTemplate,
} from '../db/types';

// ---------- String distance ----------

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

function similarityFromDistance(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 100;
  if (a.length === 0 || b.length === 0) return 0;
  const dist = levenshtein(a, b);
  return ((maxLen - dist) / maxLen) * 100;
}

// ---------- Tokenization & Jaccard ----------

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

// ---------- LaTeX normalization ----------

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

function splitLatexSubExpressions(normalized: string): string[] {
  if (!normalized) return [];
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    else if (depth === 0 && (ch === '+' || ch === '=' || ch === ',')) {
      parts.push(normalized.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(normalized.slice(start));
  return parts.map((p) => p.trim()).filter(Boolean);
}

// ---------- Fragment splitting ----------

export function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter((s) => s.length > 0);
}

// ---------- Per-template scoring (fragment-level) ----------

function scorePlain(source: string, user: string): ScoreObject {
  const srcFrags = splitSentences(source);
  const usrFrags = splitSentences(user);
  const fragmentScores: Record<string, number> = {};
  const weak: string[] = [];
  srcFrags.forEach((sf, i) => {
    const id = `s${i}`;
    const best = usrFrags.length ? Math.max(...usrFrags.map((uf) => jaccardSimilarity(tokenize(sf), tokenize(uf)))) : 0;
    fragmentScores[id] = Math.round(best);
    if (best < 60) weak.push(`Sentence ${i + 1}: ${sf.slice(0, 40)}`);
  });
  const accuracy = Math.round(Object.values(fragmentScores).reduce((s, v) => s + v, 0) / (srcFrags.length || 1));
  return { totalScore: Math.round((accuracy / 100) * 10), accuracyPercentage: accuracy, weakPoints: weak.slice(0, 5), fragmentScores };
}

function scoreTable(source: { columns: string[]; rows: string[][] }, user: string[][]): ScoreObject {
  const fragmentScores: Record<string, number> = {};
  const weak: string[] = [];
  const cellScores: number[] = [];
  const maxRows = Math.max(source.rows.length, user.length);
  for (let r = 0; r < maxRows; r++) {
    const srcRow = source.rows[r] || [];
    const usrRow = user[r] || [];
    const maxCols = Math.max(srcRow.length, usrRow.length);
    for (let c = 0; c < maxCols; c++) {
      const id = `r${r}-c${c}`;
      const srcCell = srcRow[c] || '';
      const usrCell = usrRow[c] || '';
      const sim = jaccardSimilarity(tokenize(srcCell), tokenize(usrCell));
      fragmentScores[id] = Math.round(sim);
      cellScores.push(sim);
      if (sim < 60 && srcCell) weak.push(`R${r + 1}C${c + 1}: ${srcCell.slice(0, 30)}`);
    }
  }
  const accuracy = Math.round(cellScores.reduce((s, v) => s + v, 0) / (cellScores.length || 1));
  return { totalScore: Math.round((accuracy / 100) * 10), accuracyPercentage: accuracy, weakPoints: weak.slice(0, 5), fragmentScores };
}

function scoreEquation(
  source: { solution: string; answer: string },
  user: { solution: string; answer: string },
): ScoreObject {
  const fragmentScores: Record<string, number> = {};
  const weak: string[] = [];

  // Empty user input = 0%, not 50%
  const userEmpty = !user.solution?.trim() && !user.answer?.trim();
  if (userEmpty) {
    return { totalScore: 0, accuracyPercentage: 0, weakPoints: ['No answer provided'], fragmentScores: { sol0: 0, ans: 0 } };
  }

  // Solution: LaTeX normalized Levenshtein + sub-expression diff
  const normSrcSol = normalizeLatex(source.solution);
  const normUsrSol = normalizeLatex(user.solution);
  const solAcc = user.solution?.trim()
    ? Math.round(similarityFromDistance(normSrcSol, normUsrSol))
    : 0;
  const srcParts = splitLatexSubExpressions(normSrcSol);
  const usrParts = splitLatexSubExpressions(normUsrSol);
  srcParts.forEach((part, i) => {
    const id = `sol${i}`;
    const best = usrParts.length ? Math.max(...usrParts.map((up) => similarityFromDistance(part, up))) : 0;
    fragmentScores[id] = Math.round(best);
    if (best < 80) weak.push(`Solution term ${i + 1}: ${part.slice(0, 40)}`);
  });
  if (srcParts.length === 0) fragmentScores['sol0'] = 0;

  // Answer: Jaccard token similarity (works for both plain text and LaTeX)
  const ansAcc = user.answer?.trim()
    ? Math.round(jaccardSimilarity(tokenize(source.answer), tokenize(user.answer)))
    : 0;
  fragmentScores['ans'] = ansAcc;
  if (ansAcc < 60 && source.answer) weak.push(`Answer: ${source.answer.slice(0, 40)}`);

  // Weight: solution 60%, answer 40% (or 100% answer if no solution expected)
  const hasSolution = source.solution?.trim().length > 0;
  const accuracy = hasSolution
    ? Math.round(solAcc * 0.6 + ansAcc * 0.4)
    : ansAcc;

  return { totalScore: Math.round((accuracy / 100) * 10), accuracyPercentage: accuracy, weakPoints: weak.slice(0, 5), fragmentScores };
}

function scoreBullet(source: string[], user: string[]): ScoreObject {
  const fragmentScores: Record<string, number> = {};
  const weak: string[] = [];
  const usedUser = new Set<number>();
  const srcTokens = source.map(tokenize);
  const usrTokens = user.map(tokenize);
  source.forEach((_, i) => {
    const id = `b${i}`;
    let best = 0;
    let bestJ = -1;
    for (let j = 0; j < usrTokens.length; j++) {
      if (usedUser.has(j)) continue;
      const sim = jaccardSimilarity(srcTokens[i], usrTokens[j]);
      if (sim > best) { best = sim; bestJ = j; }
    }
    if (bestJ >= 0) usedUser.add(bestJ);
    fragmentScores[id] = Math.round(best);
    if (best < 60) weak.push(`Bullet ${i + 1}: ${source[i].slice(0, 40)}`);
  });
  const accuracy = Math.round(Object.values(fragmentScores).reduce((s, v) => s + v, 0) / (source.length || 1));
  return { totalScore: Math.round((accuracy / 100) * 10), accuracyPercentage: accuracy, weakPoints: weak.slice(0, 5), fragmentScores };
}

function scoreFlashcard(source: { front: string; back: string }, userBack: string): ScoreObject {
  const backAcc = jaccardSimilarity(tokenize(source.back), tokenize(userBack));
  const fragmentScores: Record<string, number> = { back: Math.round(backAcc) };
  const weak: string[] = [];
  if (backAcc < 60) weak.push(`Back: ${source.back.slice(0, 40)}`);
  return { totalScore: Math.round((backAcc / 100) * 10), accuracyPercentage: Math.round(backAcc), weakPoints: weak, fragmentScores };
}

// ---------- Drawing scoring: rasterized stroke IoU ----------

function rasterizeDrawing(strokes: Stroke[], width: number, height: number, G = 48): Uint8Array {
  const grid = new Uint8Array(G * G);
  if (strokes.length === 0) return grid;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of strokes) for (const p of s.points) {
    if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y;
  }
  const w = Math.max(1, maxX - minX);
  const h = Math.max(1, maxY - minY);
  const scale = Math.min(G / w, G / h) * 0.85;
  const ox = (G - w * scale) / 2 - minX * scale;
  const oy = (G - h * scale) / 2 - minY * scale;
  const mark = (gx: number, gy: number) => {
    const x = Math.floor(gx), y = Math.floor(gy);
    if (x >= 0 && x < G && y >= 0 && y < G) grid[y * G + x] = 1;
  };
  for (const s of strokes) {
    if (s.points.length === 1) { mark(s.points[0].x * scale + ox, s.points[0].y * scale + oy); continue; }
    for (let i = 0; i < s.points.length - 1; i++) {
      let x0 = s.points[i].x * scale + ox, y0 = s.points[i].y * scale + oy;
      let x1 = s.points[i + 1].x * scale + ox, y1 = s.points[i + 1].y * scale + oy;
      const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
      for (let t = 0; t <= steps; t++) {
        const f = t / steps;
        mark(x0 + (x1 - x0) * f, y0 + (y1 - y0) * f);
      }
    }
  }
  return grid;
}

function scoreDrawing(template: DrawingTemplate, userStrokes: Stroke[]): ScoreObject {
  const src = rasterizeDrawing(template.strokes, template.width, template.height);
  const usr = rasterizeDrawing(userStrokes, template.width, template.height);
  let inter = 0, union = 0;
  for (let i = 0; i < src.length; i++) {
    if (src[i] && usr[i]) inter++;
    if (src[i] || usr[i]) union++;
  }
  const iou = union > 0 ? (inter / union) * 100 : 0;
  const srcCount = template.strokes.length;
  const usrCount = userStrokes.length;
  const countSim = srcCount === 0 ? (usrCount === 0 ? 100 : 0) : Math.max(0, 100 - (Math.abs(srcCount - usrCount) / Math.max(srcCount, 1)) * 100);
  const accuracy = Math.round(iou * 0.7 + countSim * 0.3);
  const weak: string[] = [];
  if (accuracy < 60) weak.push('Drawing shape differs significantly from the original');
  return { totalScore: Math.round((accuracy / 100) * 10), accuracyPercentage: accuracy, weakPoints: weak, fragmentScores: { drawing: accuracy } };
}

export function evaluate(template: Template, input: UserInput): ScoreObject {
  if (template.type !== input.type) {
    return { totalScore: 0, accuracyPercentage: 0, weakPoints: ['Type mismatch'], fragmentScores: {} };
  }
  switch (template.type) {
    case 'plain':
      return scorePlain(template.text, (input as Extract<UserInput, { type: 'plain' }>).text);
    case 'table':
      return scoreTable({ columns: template.columns, rows: template.rows }, (input as Extract<UserInput, { type: 'table' }>).rows);
    case 'equation':
      return scoreEquation(
        { solution: template.solution, answer: template.answer },
        (input as Extract<UserInput, { type: 'equation' }>),
      );
    case 'bullet':
      return scoreBullet(template.items, (input as Extract<UserInput, { type: 'bullet' }>).items);
    case 'flashcard':
      return scoreFlashcard({ front: template.front, back: template.back }, (input as Extract<UserInput, { type: 'flashcard' }>).back);
    case 'drawing':
      return scoreDrawing(template, (input as Extract<UserInput, { type: 'drawing' }>).strokes);
  }
}

// ---------- Active recall timing ----------

const MS_DAY = 1000 * 60 * 60 * 24;

export function reviewWeight(accuracy: number, lastReviewedAt: number, now: number = Date.now()): number {
  const errorComponent = (100 - accuracy) / 100;
  const daysSince = (now - lastReviewedAt) / MS_DAY;
  const timeComponent = Math.log10(daysSince + 1) / 2;
  return errorComponent * 0.7 + timeComponent * 0.3;
}

export function pageMastery(records: AccuracyRecord[]): number {
  if (records.length === 0) return 0;
  const sum = records.reduce((s, r) => s + r.accuracy, 0);
  return Math.round(sum / records.length);
}


