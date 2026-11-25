import PropTypes from 'prop-types';
import { cn } from './utils';
import { useI18n } from './i18n';

/** Brand mark: mic glyph on a flag-striped tile + wordmark. */
export function Logo({ compact = false, className }) {
  const { t } = useI18n();
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-brand-600 text-white shadow-card">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3" />
        </svg>
        <span className="absolute inset-x-0 bottom-0 flex h-[3px]" aria-hidden="true">
          <span className="flex-1 bg-flag-green" />
          <span className="flex-1 bg-flag-yellow" />
          <span className="flex-1 bg-flag-red" />
        </span>
      </span>
      {compact ? null : <span className="whitespace-nowrap text-[15px] font-bold tracking-tight text-fg">{t('app.name')}</span>}
    </span>
  );
}

Logo.propTypes = {
  compact: PropTypes.bool,
  className: PropTypes.string,
};
