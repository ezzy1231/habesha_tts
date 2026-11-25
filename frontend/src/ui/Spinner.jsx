import PropTypes from 'prop-types';
import { cn } from './utils';

/** Inline loading spinner; inherits text colour. */
export function Spinner({ size = 16, className, label }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={cn('animate-spin', className)}
      role={label ? 'status' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

Spinner.propTypes = {
  size: PropTypes.number,
  className: PropTypes.string,
  label: PropTypes.string,
};
