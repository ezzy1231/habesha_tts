import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';



export default function ThemeToggle({ className = '', isDarkMode, toggleDarkMode }) {


const toggle = () => {
    toggleDarkMode(!isDarkMode);
    // Save to both keys for consistency across the app
    const nextTheme = !isDarkMode ? 'dark' : 'light';
    localStorage.setItem('theme', nextTheme);
    localStorage.setItem('streamer_theme', nextTheme);
  };

  return (
    <button onClick={toggle} className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-white text-gray-800 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700 ${className}`} aria-label="Toggle theme">
      {isDarkMode ? '☀️ Light' : '🌙 Dark'}
    </button>
  );
}

ThemeToggle.propTypes = {
  className: PropTypes.string,
};
