import { useId } from 'react';
import PropTypes from 'prop-types';
import { cn, focusRing } from './utils';

/**
 * Toggle switch (role="switch").
 *   <Switch checked={on} onChange={setOn} label="Read messages aloud" description="…" />
 * Without a visible `label`, pass `aria-label`.
 */
export function Switch({ checked, onChange, label, description, disabled = false, size = 'md', className, id, ...rest }) {
  const autoId = useId();
  const switchId = id || autoId;
  const descId = description ? `${switchId}-desc` : undefined;
  const track = size === 'sm' ? 'h-5 w-9' : 'h-6 w-11';
  const thumb = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  const shift = size === 'sm' ? 'translate-x-4' : 'translate-x-5';

  const control = (
    <button
      id={switchId}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-describedby={descId}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={cn(
        'relative inline-flex shrink-0 cursor-pointer items-center rounded-full border border-transparent p-0.5 transition-colors duration-200',
        'disabled:cursor-not-allowed disabled:opacity-50',
        focusRing,
        track,
        checked ? 'bg-brand-600' : 'bg-surface-3 border-line-strong',
      )}
      {...rest}
    >
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none inline-block rounded-full bg-white shadow transition-transform duration-200',
          thumb,
          checked ? shift : 'translate-x-0',
        )}
      />
    </button>
  );

  if (!label) return <span className={className}>{control}</span>;

  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        <label htmlFor={switchId} className={cn('text-sm font-medium text-fg', disabled ? 'cursor-not-allowed' : 'cursor-pointer')}>
          {label}
        </label>
        {description ? (
          <p id={descId} className="mt-0.5 text-sm text-muted">
            {description}
          </p>
        ) : null}
      </div>
      {control}
    </div>
  );
}

Switch.propTypes = {
  checked: PropTypes.bool.isRequired,
  onChange: PropTypes.func,
  label: PropTypes.node,
  description: PropTypes.node,
  disabled: PropTypes.bool,
  size: PropTypes.oneOf(['sm', 'md']),
  className: PropTypes.string,
  id: PropTypes.string,
};
