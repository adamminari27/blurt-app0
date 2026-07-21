import { useCallback, useState, useRef } from 'react';
import { db } from '../db/database';
import type { Page, Template, UserInput } from '../db/types';
import { evaluate } from '../engine/scoring';
import {
  updateNtd, retrievalStrength, initialNtdState, buildSessionQueue,
  type NtdState, type SessionMode,
} from '../engine/ntd';
import { nanoid } from 'nanoid';
import type { AccuracyRecord } from '../db/types';

const MS_DAY = 1000 * 60 * 60 * 24;

export interface QueueItem {
  pageId: string;
  rep: number;
}

export interface ScoredItem {
  pageId: string;
  templateId: string;
  score: number; // 0..1
}

/**
 * useBjorkInterleaver — manages adaptive session queues and NTD state updates.
 * Sessions are item-count based. The engine updates S, R, and dueDate
 * immediately whenever score data changes — before, during, and after sessions.
 */
export function useBjorkInterleaver(notebookId: string) {
  const [sessionQueue, setSessionQueue] = useState<QueueItem[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const queueRef = useRef<QueueItem[]>([]);

  /** Build the initial session queue based on mode, up to itemCount. */
  const buildQueue = useCallback(async (
    itemCount: number,
    mode: SessionMode = 'active',
  ): Promise<QueueItem[]> => {
    const pages = await db.pages.where('notebookId').equals(notebookId).toArray();
    const orderedIds = buildSessionQueue(pages, itemCount, mode);
    const q: QueueItem[] = orderedIds.map((id) => ({ pageId: id, rep: 0 }));
    queueRef.current = q;
    setSessionQueue(q);
    setQueueIndex(0);
    return q;
  }, [notebookId]);

  /** Score a single template, record accuracy, and update the page's NTD state.
   *  If `manualScore01` is provided (manual grading mode), it overrides the auto-evaluated score. */
  const scoreAndRecord = useCallback(async (
    page: Page,
    template: Template,
    input: UserInput,
    manualScore01?: number,
  ): Promise<{ score: number; weakPoints: string[] }> => {
    const result = evaluate(template, input);
    const score01 = manualScore01 !== undefined ? manualScore01 : result.accuracyPercentage / 100;

    const fragmentIds = Object.keys(result.fragmentScores);
    const records: AccuracyRecord[] = (fragmentIds.length ? fragmentIds : ['whole']).map((fid) => ({
      id: nanoid(),
      notebookId,
      pageId: page.id,
      templateId: template.id,
      fragmentId: fid,
      accuracy: manualScore01 !== undefined ? Math.round(score01 * 100) : (result.fragmentScores[fid] ?? result.accuracyPercentage),
      weakPoints: manualScore01 !== undefined ? ['Manual self-assessment'] : result.weakPoints,
      timestamp: Date.now(),
    }));
    await db.accuracy.bulkAdd(records);

    const prev: NtdState = {
      storageStrength: page.storageStrength ?? 1.0,
      lastReviewed: page.lastReviewed ?? 0,
      dueDate: page.dueDate ?? Date.now(),
      intervalMs: page.intervalMs ?? MS_DAY,
    };
    const next = updateNtd(prev, score01);
    await db.pages.update(page.id, {
      storageStrength: next.storageStrength,
      lastReviewed: next.lastReviewed,
      dueDate: next.dueDate,
      intervalMs: next.intervalMs,
      updatedAt: Date.now(),
    });

    return { score: score01, weakPoints: result.weakPoints };
  }, [notebookId]);

  /**
   * In-session dynamic interleaving:
   * High score (>= 0.8): interval expands (handled in updateNtd).
   * Low score (< 0.5): reset R, set intra-day interval, reinsert 2-3 ahead.
   */
  const reinsertIfFailed = useCallback((pageId: string, score: number) => {
    if (score >= 0.5) return;
    const q = [...queueRef.current];
    const insertPos = Math.min(q.length, queueIndex + 2 + Math.floor(Math.random() * 2));
    const rep = (q.find((item) => item.pageId === pageId)?.rep ?? 0) + 1;
    q.splice(insertPos, 0, { pageId, rep });
    queueRef.current = q;
    setSessionQueue(q);
  }, [queueIndex]);

  const advance = useCallback(() => {
    setQueueIndex((i) => i + 1);
  }, []);

  /** Update all pages' NTD state after a session. */
  const finalizeSession = useCallback(async (scoredItems: ScoredItem[]) => {
    const byPage = new Map<string, number[]>();
    for (const item of scoredItems) {
      const arr = byPage.get(item.pageId) || [];
      arr.push(item.score);
      byPage.set(item.pageId, arr);
    }
    const now = Date.now();
    for (const [pageId, scores] of byPage) {
      const page = await db.pages.get(pageId);
      if (!page) continue;
      const avgScore = scores.reduce((s, v) => s + v, 0) / scores.length;
      const prev: NtdState = {
        storageStrength: page.storageStrength ?? 1.0,
        lastReviewed: page.lastReviewed ?? 0,
        dueDate: page.dueDate ?? now,
        intervalMs: page.intervalMs ?? MS_DAY,
      };
      const next = updateNtd(prev, avgScore, now);
      await db.pages.update(pageId, {
        storageStrength: next.storageStrength,
        lastReviewed: next.lastReviewed,
        dueDate: next.dueDate,
        intervalMs: next.intervalMs,
        updatedAt: now,
      });
    }
    const nb = await db.notebooks.get(notebookId);
    if (nb) {
      await db.notebooks.update(notebookId, { updatedAt: now });
    }
  }, [notebookId]);

  /** Get current retrieval strength for a page (for display). */
  const getRetrievalStrength = useCallback(async (pageId: string): Promise<number> => {
    const page = await db.pages.get(pageId);
    if (!page) return 0;
    return retrievalStrength(page.storageStrength ?? 1.0, page.lastReviewed ?? 0);
  }, []);

  return {
    sessionQueue,
    queueIndex,
    buildQueue,
    scoreAndRecord,
    reinsertIfFailed,
    advance,
    finalizeSession,
    getRetrievalStrength,
  };
}
