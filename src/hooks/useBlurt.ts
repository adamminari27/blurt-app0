import { useCallback, useState } from 'react';
import type { Template, UserInput, ScoreObject, AccuracyRecord } from '../db/types';
import { db } from '../db/database';
import { nanoid } from 'nanoid';
import { evaluate, reviewWeight, pageMastery } from '../engine/scoring';

const MS_DAY = 1000 * 60 * 60 * 24;
const STREAK_KEY = 'global-streak';

export interface BlurtResult {
  score: ScoreObject;
  recorded: boolean;
}

function midnightOf(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// ---------- Global streak (across all notebooks, stored in Dexie appState) ----------

export async function getGlobalStreak(): Promise<{ streak: number; lastDay: number }> {
  const row = await db.appState.get(STREAK_KEY);
  if (row) return { streak: row.globalStreak ?? 0, lastDay: row.lastStreakDay ?? 0 };
  return { streak: 0, lastDay: 0 };
}

export async function setGlobalStreak(s: { streak: number; lastDay: number }) {
  await db.appState.put({ key: STREAK_KEY, globalStreak: s.streak, lastStreakDay: s.lastDay });
}

export async function bumpGlobalStreak(): Promise<number> {
  const { streak, lastDay } = await getGlobalStreak();
  const today = midnightOf(Date.now());
  const yesterday = today - MS_DAY;
  let newStreak = 1;
  if (lastDay === today) {
    newStreak = streak;
  } else if (lastDay === yesterday) {
    newStreak = streak + 1;
  }
  await setGlobalStreak({ streak: newStreak, lastDay: today });
  return newStreak;
}

export function useBlurt(notebookId: string) {
  const [lastResult, setLastResult] = useState<BlurtResult | null>(null);

  const scoreTemplate = useCallback(
    async (pageId: string, template: Template, input: UserInput): Promise<BlurtResult> => {
      const score = evaluate(template, input);
      const fragmentIds = Object.keys(score.fragmentScores);
      const records: AccuracyRecord[] = (fragmentIds.length ? fragmentIds : ['whole']).map((fid) => ({
        id: nanoid(),
        notebookId,
        pageId,
        templateId: template.id,
        fragmentId: fid,
        accuracy: score.fragmentScores[fid] ?? score.accuracyPercentage,
        weakPoints: score.weakPoints,
        timestamp: Date.now(),
      }));
      await db.accuracy.bulkAdd(records);
      const result: BlurtResult = { score, recorded: true };
      setLastResult(result);
      return result;
    },
    [notebookId],
  );

  const getReviewQueue = useCallback(async () => {
    const records = await db.accuracy.where('notebookId').equals(notebookId).toArray();
    const pages = await db.pages.where('notebookId').equals(notebookId).toArray();
    const byPage = new Map<string, AccuracyRecord[]>();
    for (const r of records) {
      const arr = byPage.get(r.pageId) || [];
      arr.push(r);
      byPage.set(r.pageId, arr);
    }
    const now = Date.now();
    const weighted = pages.map((page) => {
      const recs = byPage.get(page.id) || [];
      const mastery = pageMastery(recs);
      const latest = recs.length ? Math.max(...recs.map((r) => r.timestamp)) : page.createdAt;
      const weight = recs.length ? reviewWeight(mastery, latest, now) : 1;
      return { page, weight, mastery, attempts: recs.length };
    });
    weighted.sort((a, b) => b.weight - a.weight);
    return weighted;
  }, [notebookId]);

  // Get current mastery per page (for rep scheduling — weakest first).
  const getPageMasteries = useCallback(async (): Promise<Record<string, number>> => {
    const records = await db.accuracy.where('notebookId').equals(notebookId).toArray();
    const pages = await db.pages.where('notebookId').equals(notebookId).toArray();
    const byPage = new Map<string, AccuracyRecord[]>();
    for (const r of records) {
      const arr = byPage.get(r.pageId) || [];
      arr.push(r);
      byPage.set(r.pageId, arr);
    }
    const map: Record<string, number> = {};
    for (const p of pages) {
      const recs = byPage.get(p.id) || [];
      map[p.id] = recs.length ? pageMastery(recs) : 0;
    }
    return map;
  }, [notebookId]);

  const recordSessionComplete = useCallback(async (_avgAccuracy: number) => {
    const newStreak = await bumpGlobalStreak();
    const nb = await db.notebooks.get(notebookId);
    if (nb) {
      await db.notebooks.update(notebookId, {
        updatedAt: Date.now(),
      });
    }
    return newStreak;
  }, [notebookId]);

  return { scoreTemplate, getReviewQueue, getPageMasteries, recordSessionComplete, lastResult };
}
