import { useEffect, useState, useCallback } from 'react';
import { loadPalette, applyPalette } from '../components/ThemeSettings';

export type ThemeName = 'dark' | 'light';

export type PalettePreset = 'default' | 'light' | 'meadow' | 'seaside';

const STORAGE_KEY = 'blurt-theme';
const PRESET_KEY = 'blurt-preset';

function getInitial(): ThemeName {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch { /* ignore */ }
  return 'dark';
}

function getInitialPreset(): PalettePreset {
  try {
    const stored = localStorage.getItem(PRESET_KEY) as PalettePreset | null;
    if (stored) return stored;
  } catch { /* ignore */ }
  return 'default';
}

export function useTheme() {
  const [theme, setTheme] = useState<ThemeName>(getInitial);
  const [preset, setPresetState] = useState<PalettePreset>(getInitialPreset);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* ignore */ }
    const custom = loadPalette();
    if (custom) applyPalette(custom);
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  }, []);

  const set = useCallback((t: ThemeName) => setTheme(t), []);

  const setPreset = useCallback((p: PalettePreset) => {
    setPresetState(p);
    try { localStorage.setItem(PRESET_KEY, p); } catch { /* ignore */ }
  }, []);

  return { theme, toggle, set, preset, setPreset };
}
