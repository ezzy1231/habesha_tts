import PropTypes from 'prop-types';
import { cn } from './utils';

/** Shimmering placeholder block. Size it with className: <Skeleton className="h-4 w-32" /> */
export function Skeleton({ className, circle = false }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'relative block overflow-hidden bg-surface-3',
        circle ? 'rounded-full' : 'rounded-md',
        'after:absolute after:inset-0 after:-translate-x-full after:animate-ui-shimmer after:bg-gradient-to-r after:from-transparent after:via-white/10 after:to-transparent',
        'motion-reduce:after:hidden',
        className,
      )}
    />
  );
}

Skeleton.propTypes = {
  className: PropTypes.string,
  circle: PropTypes.bool,
};

/** Paragraph placeholder: <SkeletonText lines={3} /> */
export function SkeletonText({ lines = 3, className }) {
  return (
    <div className={cn('flex flex-col gap-2', className)} aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn('h-3', i === lines - 1 && lines > 1 ? 'w-3/5' : 'w-full')} />
      ))}
    </div>
  );
}

SkeletonText.propTypes = {
  lines: PropTypes.number,
  className: PropTypes.string,
};
