import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'dark') root.classList.add('dark');
  else root.classList.remove('dark');
}

export default function ThemeToggle({ className = '' }) {
  const [theme, setTheme] = useState('light');

useEffect(() => {
    // Check for theme in multiple possible keys for backward compatibility
    const saved = localStorage.getItem('theme') || localStorage.getItem('streamer_theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initial = saved || (prefersDark ? 'dark' : 'light');
    setTheme(initial);
    applyTheme(initial);
  }, []);

const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    // Save to both keys for consistency across the app
    localStorage.setItem('theme', next);
    localStorage.setItem('streamer_theme', next);
    applyTheme(next);
  };

  return (
    <button onClick={toggle} className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-white text-gray-800 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700 ${className}`} aria-label="Toggle theme">
      {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
    </button>
  );
}

ThemeToggle.propTypes = {
  className: PropTypes.string,
};
