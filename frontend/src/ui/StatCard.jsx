import PropTypes from 'prop-types';
import { cn } from './utils';
import { Icon } from './icons';
import { Skeleton } from './Skeleton';

/**
 * KPI tile.
 *   <StatCard label="Today" value="ETB 4,250" delta={12.5} deltaLabel="vs yesterday" icon="gift" />
 * `delta` is a percentage; positive renders green/up, negative red/down.
 * Set `invertDelta` when lower is better (e.g. refunds).
 */
export function StatCard({ label, value, delta, deltaLabel, icon, hint, loading = false, invertDelta = false, className }) {
  const hasDelta = typeof delta === 'number' && Number.isFinite(delta);
  const good = hasDelta && (invertDelta ? delta < 0 : delta > 0);
  const bad = hasDelta && (invertDelta ? delta > 0 : delta < 0);

  return (
    <div className={cn('rounded-xl border border-line bg-surface p-4 shadow-card sm:p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted">{label}</p>
        {icon ? (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400">
            {typeof icon === 'string' ? <Icon name={icon} size={18} /> : icon}
          </span>
        ) : null}
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-28" />
      ) : (
        <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-fg sm:text-[1.75rem]">{value}</p>
      )}
      {hasDelta || hint ? (
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          {hasDelta && !loading ? (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold tabular-nums',
                good && 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
                bad && 'bg-red-500/10 text-red-700 dark:text-red-300',
                !good && !bad && 'bg-surface-2 text-muted',
              )}
            >
              {delta !== 0 ? <Icon name={delta > 0 ? 'arrowUp' : 'arrowDown'} size={12} strokeWidth={2.5} /> : null}
              {Math.abs(delta).toLocaleString(undefined, { maximumFractionDigits: 1 })}%
              <span className="sr-only">{delta > 0 ? 'increase' : delta < 0 ? 'decrease' : 'no change'}</span>
            </span>
          ) : null}
          {deltaLabel && hasDelta ? <span className="text-subtle">{deltaLabel}</span> : null}
          {hint ? <span className="text-subtle">{hint}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

StatCard.propTypes = {
  label: PropTypes.node.isRequired,
  value: PropTypes.node,
  delta: PropTypes.number,
  deltaLabel: PropTypes.node,
  icon: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  hint: PropTypes.node,
  loading: PropTypes.bool,
  invertDelta: PropTypes.bool,
  className: PropTypes.string,
};
