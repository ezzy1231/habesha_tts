import { useId, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { cn, focusRing } from './utils';

/**
 * Accessible tabs (WAI-ARIA tabs pattern, automatic activation).
 *   <Tabs items={[{ value: 'all', label: 'All', content: <…/> }, …]} />
 * Controlled: pass `value` + `onChange`. Arrow keys / Home / End move focus.
 * Omit `content` on items to use Tabs as a bare segmented control.
 */
export function Tabs({ items, value, defaultValue, onChange, variant = 'underline', size = 'md', className, label, fitted = false }) {
  const baseId = useId();
  const [internal, setInternal] = useState(defaultValue ?? items[0]?.value);
  const active = value !== undefined ? value : internal;
  const tabRefs = useRef({});

  const select = (v) => {
    if (value === undefined) setInternal(v);
    onChange?.(v);
  };

  const enabled = items.filter((i) => !i.disabled);
  const onKeyDown = (e) => {
    const idx = enabled.findIndex((i) => i.value === active);
    let next = null;
    if (e.key === 'ArrowRight') next = enabled[(idx + 1) % enabled.length];
    else if (e.key === 'ArrowLeft') next = enabled[(idx - 1 + enabled.length) % enabled.length];
    else if (e.key === 'Home') next = enabled[0];
    else if (e.key === 'End') next = enabled[enabled.length - 1];
    if (next) {
      e.preventDefault();
      select(next.value);
      tabRefs.current[next.value]?.focus();
    }
  };

  const activeItem = items.find((i) => i.value === active);
  const hasPanels = items.some((i) => i.content !== undefined);

  return (
    <div className={className}>
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className={cn(
          'flex max-w-full overflow-x-auto overflow-y-hidden',
          variant === 'underline' && 'gap-1 shadow-[inset_0_-1px_0_rgb(var(--ui-line))]',
          variant === 'pill' && 'gap-1 rounded-lg border border-line bg-surface-2 p-1',
          fitted ? 'w-full' : 'w-fit',
        )}
      >
        {items.map((item) => {
          const selected = item.value === active;
          return (
            <button
              key={item.value}
              ref={(el) => {
                tabRefs.current[item.value] = el;
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${item.value}`}
              aria-selected={selected}
              aria-controls={hasPanels ? `${baseId}-panel-${item.value}` : undefined}
              tabIndex={selected ? 0 : -1}
              disabled={item.disabled}
              onClick={() => select(item.value)}
              className={cn(
                'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50',
                focusRing,
                size === 'sm' ? 'h-8 px-3 text-xs' : 'h-10 px-3.5 text-sm',
                fitted && 'flex-1',
                variant === 'underline' &&
                  cn(
                    'rounded-t-md border-b-2',
                    selected ? 'border-brand-500 text-fg' : 'border-transparent text-muted hover:text-fg',
                  ),
                variant === 'pill' &&
                  cn('rounded-md', selected ? 'bg-surface text-fg shadow-card' : 'text-muted hover:text-fg'),
              )}
            >
              {item.icon}
              {item.label}
              {item.count !== undefined ? (
                <span
                  className={cn(
                    'rounded-full px-1.5 text-[11px] tabular-nums',
                    selected ? 'bg-brand-500/15 text-brand-700 dark:text-brand-300' : 'bg-surface-3 text-muted',
                  )}
                >
                  {item.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {hasPanels && activeItem ? (
        <div
          role="tabpanel"
          id={`${baseId}-panel-${activeItem.value}`}
          aria-labelledby={`${baseId}-tab-${activeItem.value}`}
          tabIndex={0}
          className={cn('pt-4 focus-visible:outline-none')}
        >
          {activeItem.content}
        </div>
      ) : null}
    </div>
  );
}

Tabs.propTypes = {
  items: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.string.isRequired,
      label: PropTypes.node.isRequired,
      content: PropTypes.node,
      icon: PropTypes.node,
      count: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      disabled: PropTypes.bool,
    }),
  ).isRequired,
  value: PropTypes.string,
  defaultValue: PropTypes.string,
  onChange: PropTypes.func,
  variant: PropTypes.oneOf(['underline', 'pill']),
  size: PropTypes.oneOf(['sm', 'md']),
  className: PropTypes.string,
  label: PropTypes.string,
  fitted: PropTypes.bool,
};
