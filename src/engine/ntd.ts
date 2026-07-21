import type { Page } from '../db/types';

// Bjork's New Theory of Disuse (NTD) + Ebbinghaus decay scheduler.
// R(t) = e^(-(t / S)) where t = elapsed time since last review (in days).

const MS_DAY = 1000 * 60 * 60 * 24;
const MS_HOUR = 1000 * 60 * 60;
const MS_MIN = 1000 * 60;

// Intra-day learning steps (failed phase, score < 50%)
export const INTRA_DAY_STEPS = [20 * MS_MIN, 1 * MS_HOUR, 9 * MS_HOUR];

// Inter-day growth ladder (recalled phase)
export const INTER_DAY_LADDER = [1 * MS_DAY, 3 * MS_DAY, 7 * MS_DAY, 14 * MS_DAY, 30 * MS_DAY];

const BASE_INTERVAL = MS_DAY;
const ALPHA = 0.3; // storage strength gain rate

export interface NtdState {
  storageStrength: number;
  lastReviewed: number;
  dueDate: number;
  intervalMs: number;
}

export type SessionMode = 'active' | 'inorder' | 'random';

export function initialNtdState(now: number = Date.now()): NtdState {
  return {
    storageStrength: 1.0,
    lastReviewed: 0,
    dueDate: now,
    intervalMs: BASE_INTERVAL,
  };
}

/** Retrieval strength R(t) = e^(-(t_days) / S). Returns 0..1. */
export function retrievalStrength(
  storageStrength: number,
  lastReviewed: number,
  now: number = Date.now(),
): number {
  if (lastReviewed === 0) return 0;
  const tDays = (now - lastReviewed) / MS_DAY;
  if (tDays <= 0) return 1;
  return Math.exp(-tDays / Math.max(0.1, storageStrength));
}

/**
 * Multi-tier NTD update after a recall attempt.
 * score: 0..1 (fraction correct).
 *
 * Intra-Day Decay (Learning / Failed Phase - Score < 50%):
 *   Reset R, set immediate intra-day step intervals: 20m, 1h, 9h.
 *   Advance through steps based on how many recent failures.
 *
 * Inter-Day Growth (Recalled Phase):
 *   Hard/Moderate (50%-79%): interval = 1 day, modest S gain.
 *   Optimal/High (>= 80%): expand S, multiply interval exponentially (1d -> 3d -> 7d -> 14d+).
 */
export function updateNtd(
  prev: NtdState,
  score: number,
  now: number = Date.now(),
): NtdState {
  const R = retrievalStrength(prev.storageStrength, prev.lastReviewed, now);

  let newStorage = prev.storageStrength;
  let newInterval = prev.intervalMs;

  if (score < 0.5) {
    // Failed phase: intra-day decay steps
    // Determine which step to use based on current interval
    const stepIdx = INTRA_DAY_STEPS.findIndex((s) => s >= prev.intervalMs);
    const idx = stepIdx === -1 ? 0 : Math.min(stepIdx + 1, INTRA_DAY_STEPS.length - 1);
    newInterval = INTRA_DAY_STEPS[Math.max(0, idx - 1) === idx - 1 ? 0 : Math.max(0, idx - 1)];
    // Reset to first intra-day step (20m) on fresh failure
    newInterval = INTRA_DAY_STEPS[0];
    newStorage = Math.max(0.5, prev.storageStrength - ALPHA * 0.5);
  } else if (score >= 0.8) {
    // Optimal/high: expand S and climb the inter-day ladder
    newStorage = prev.storageStrength + ALPHA * (1 - R) * score;
    newStorage = Math.min(newStorage, 10);
    // Find next ladder step above current interval
    const ladderIdx = INTER_DAY_LADDER.findIndex((s) => s > prev.intervalMs);
    newInterval = ladderIdx === -1
      ? INTER_DAY_LADDER[INTER_DAY_LADDER.length - 1] * (1 + newStorage * 0.1)
      : INTER_DAY_LADDER[ladderIdx];
  } else {
    // Hard/moderate (50%-79%): 1 day, modest S gain
    newStorage = Math.min(10, prev.storageStrength + ALPHA * 0.15 * score);
    newInterval = MS_DAY;
  }

  return {
    storageStrength: newStorage,
    lastReviewed: now,
    dueDate: now + newInterval,
    intervalMs: newInterval,
  };
}

/**
 * Build a session queue based on mode.
 * Active Recall: sort by lowest R and urgency within Ebbinghaus decay window.
 * In Order: preserve creation order.
 * Random: shuffle.
 */
export function buildSessionQueue(
  pages: Page[],
  itemCount: number,
  mode: SessionMode = 'active',
  now: number = Date.now(),
): string[] {
  let sorted: Page[];
  if (mode === 'inorder') {
    sorted = [...pages].sort((a, b) => a.order - b.order);
  } else if (mode === 'random') {
    sorted = [...pages].sort(() => Math.random() - 0.5);
  } else {
    // Active Recall: lowest R first, then most overdue
    sorted = [...pages].sort((a, b) => {
      const aR = a.lastReviewed === 0 ? 0 : retrievalStrength(a.storageStrength, a.lastReviewed, now);
      const bR = b.lastReviewed === 0 ? 0 : retrievalStrength(b.storageStrength, b.lastReviewed, now);
      if (Math.abs(aR - bR) > 0.05) return aR - bR;
      const aDue = a.lastReviewed === 0 ? -Infinity : a.dueDate;
      const bDue = b.lastReviewed === 0 ? -Infinity : b.dueDate;
      return aDue - bDue;
    });
  }
  return sorted.slice(0, itemCount).map((p) => p.id);
}

/**
 * Proportional item distribution: if selected pages yield fewer items than
 * the minimum threshold, distribute item counts proportionally to scale up.
 * Returns a map of pageId -> item count.
 */
export function distributeItems(
  pages: Page[],
  minItems: number = 15,
): Map<string, number> {
  const result = new Map<string, number>();
  if (pages.length === 0) return result;

  const totalPages = pages.length;
  const baseEach = Math.max(1, Math.ceil(minItems / totalPages));
  let assigned = 0;

  // Proportional distribution based on template count (more templates = more items)
  const templateCounts = pages.map((p) => Math.max(1, p.templates.length));
  const totalTemplates = templateCounts.reduce((s, v) => s + v, 0);

  for (let i = 0; i < pages.length; i++) {
    const proportion = totalTemplates > 0 ? templateCounts[i] / totalTemplates : 1 / totalPages;
    const count = Math.max(1, Math.round(proportion * minItems));
    result.set(pages[i].id, count);
    assigned += count;
  }

  // If under threshold, top up the largest pages
  while (assigned < minItems) {
    let maxIdx = 0;
    let maxTemplates = 0;
    for (let i = 0; i < pages.length; i++) {
      if (templateCounts[i] > maxTemplates) { maxTemplates = templateCounts[i]; maxIdx = i; }
    }
    result.set(pages[maxIdx].id, (result.get(pages[maxIdx].id) || 0) + 1);
    assigned++;
  }

  return result;
}

export { MS_DAY, BASE_INTERVAL, ALPHA };
