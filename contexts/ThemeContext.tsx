'use client';

import React, { createContext, useContext, useEffect, useSyncExternalStore } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/**
 * Persisted theme preference, exposed as an external store so React can
 * subscribe without setState-in-effect cascades. The same localStorage key
 * is read by the pre-paint inline script in app/layout.tsx — keep in sync.
 */
export const THEME_STORAGE_KEY = 'bufo-theme';

const themeListeners = new Set<() => void>();

function readStoredTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
  } catch {
    // localStorage unavailable (privacy mode, etc.) — fall back to system
  }
  return 'system';
}

function getServerTheme(): Theme {
  return 'system';
}

function subscribeStoredTheme(onChange: () => void): () => void {
  themeListeners.add(onChange);
  // Sync across tabs as well
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY) onChange();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    themeListeners.delete(onChange);
    window.removeEventListener('storage', onStorage);
  };
}

function writeStoredTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Persisting failed; still notify so the in-memory theme updates
  }
  themeListeners.forEach((listener) => listener());
}

function subscribeSystemTheme(onChange: () => void): () => void {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', onChange);
  return () => mediaQuery.removeEventListener('change', onChange);
}

function getSystemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function getServerSystemPrefersDark(): boolean {
  return false;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribeStoredTheme, readStoredTheme, getServerTheme);
  const systemPrefersDark = useSyncExternalStore(
    subscribeSystemTheme,
    getSystemPrefersDark,
    getServerSystemPrefersDark
  );

  const resolvedTheme: 'light' | 'dark' =
    theme === 'system' ? (systemPrefersDark ? 'dark' : 'light') : theme;

  // Keep the document class in sync (the inline script in app/layout.tsx
  // handles the very first paint before hydration).
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(resolvedTheme);
  }, [resolvedTheme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme: writeStoredTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
