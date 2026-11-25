import { useSyncExternalStore } from 'react';

/*
 * Theme store. Dark-first: with no saved preference the UI is dark.
 * Uses the same localStorage key ("theme") as the legacy ThemeToggle,
 * and toggles the `dark` class on <html> (Tailwind darkMode: 'class').
 */
const STORAGE_KEY = 'theme';
const listeners = new Set();

function readTheme() {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function getTheme() {
  return readTheme();
}

export function setTheme(theme) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((fn) => fn());
}

/** Apply the saved theme, defaulting to dark. Call once at startup. */
export function initTheme() {
  let saved = null;
  try {
    saved = localStorage.getItem(STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
  document.documentElement.classList.toggle('dark', saved ? saved === 'dark' : true);
  listeners.forEach((fn) => fn());
}

function subscribe(fn) {
  listeners.add(fn);
  // Pick up class changes made by legacy code (e.g. the old ThemeToggle).
  const observer = new MutationObserver(fn);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => {
    listeners.delete(fn);
    observer.disconnect();
  };
}

/** const { theme, setTheme, toggleTheme } = useTheme(); */
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => 'dark');
  return {
    theme,
    setTheme,
    toggleTheme: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
  };
}
