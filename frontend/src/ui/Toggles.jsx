import PropTypes from 'prop-types';
import { cn, focusRing } from './utils';
import { Button } from './Button';
import { Icon } from './icons';
import { LANGUAGES, useI18n } from './i18n';
import { useTheme } from './theme';

/** Sun/moon icon button that flips the `dark` class and persists it. */
export function ThemeToggle({ className, size = 'md' }) {
  const { theme, toggleTheme } = useTheme();
  const { t } = useI18n();
  const isDark = theme === 'dark';
  return (
    <Button
      variant="ghost"
      size={size}
      iconOnly
      onClick={toggleTheme}
      aria-label={isDark ? t('theme.light') : t('theme.dark')}
      title={isDark ? t('theme.light') : t('theme.dark')}
      className={cn('text-muted hover:text-fg', className)}
    >
      <Icon name={isDark ? 'sun' : 'moon'} size={18} />
    </Button>
  );
}

ThemeToggle.propTypes = {
  className: PropTypes.string,
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
};

/** Segmented አማ / EN switch; persists to localStorage("lang"). */
export function LanguageToggle({ className }) {
  const { lang, setLang, t } = useI18n();
  return (
    <div role="group" aria-label={t('lang.label')} className={cn('inline-flex rounded-lg border border-line bg-surface-2 p-0.5', className)}>
      {LANGUAGES.map((l) => {
        const active = l.code === lang;
        return (
          <button
            key={l.code}
            type="button"
            lang={l.code}
            aria-pressed={active}
            title={l.label}
            onClick={() => setLang(l.code)}
            className={cn(
              'h-7 min-w-[2.5rem] rounded-md px-2 text-xs font-semibold transition-colors',
              focusRing,
              active ? 'bg-surface text-fg shadow-card' : 'text-muted hover:text-fg',
            )}
          >
            {l.short}
          </button>
        );
      })}
    </div>
  );
}

LanguageToggle.propTypes = {
  className: PropTypes.string,
};
