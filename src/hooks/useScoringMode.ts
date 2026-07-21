export type ScoringMode = 'auto' | 'manual';

const KEY = 'blurt-scoring-mode';

export function getScoringMode(): ScoringMode {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'manual' || v === 'auto') return v;
  } catch { /* ignore */ }
  return 'auto';
}

export function setScoringMode(mode: ScoringMode): void {
  try {
    localStorage.setItem(KEY, mode);
  } catch { /* ignore */ }
}
