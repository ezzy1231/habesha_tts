import PropTypes from 'prop-types';
import { cn } from './utils';

const VARIANTS = {
  neutral: 'bg-surface-2 text-muted border-line',
  brand: 'bg-brand-500/10 text-brand-700 border-brand-500/25 dark:text-brand-300',
  success: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/25 dark:text-emerald-300',
  warning: 'bg-amber-400/15 text-amber-800 border-amber-400/30 dark:text-amber-300',
  danger: 'bg-red-500/10 text-red-700 border-red-500/25 dark:text-red-300',
  info: 'bg-sky-500/10 text-sky-700 border-sky-500/25 dark:text-sky-300',
};

const DOT = {
  neutral: 'bg-subtle',
  brand: 'bg-brand-500',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
  info: 'bg-sky-500',
};

/** <Badge variant="success" dot>Paid</Badge> · <Badge variant="danger" dot pulse>Live</Badge> */
export function Badge({ variant = 'neutral', size = 'md', dot = false, pulse = false, className, children }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-0.5 text-xs',
        VARIANTS[variant],
        className,
      )}
    >
      {dot ? (
        <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
          {pulse ? <span className={cn('absolute inline-flex h-full w-full animate-ping rounded-full opacity-75', DOT[variant])} /> : null}
          <span className={cn('relative inline-flex h-1.5 w-1.5 rounded-full', DOT[variant])} />
        </span>
      ) : null}
      {children}
    </span>
  );
}

Badge.propTypes = {
  variant: PropTypes.oneOf(['neutral', 'brand', 'success', 'warning', 'danger', 'info']),
  size: PropTypes.oneOf(['sm', 'md']),
  dot: PropTypes.bool,
  pulse: PropTypes.bool,
  className: PropTypes.string,
  children: PropTypes.node,
};
