import PropTypes from 'prop-types';
import { cn } from './utils';
import { useI18n } from './i18n';

/** Brand mark: a sound-wave glyph on a violet tile + wordmark. */
export function Logo({ compact = false, className }) {
  const { t } = useI18n();
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_4px_12px_-4px_rgb(124_58_237/0.6)]">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
          <path d="M4 10v4M8 6v12M12 3v18M16 7v10M20 10v4" />
        </svg>
      </span>
      {compact ? null : <span className="whitespace-nowrap text-[15px] font-semibold tracking-tight text-fg">{t('app.name')}</span>}
    </span>
  );
}

Logo.propTypes = {
  compact: PropTypes.bool,
  className: PropTypes.string,
};
