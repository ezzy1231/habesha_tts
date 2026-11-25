import { forwardRef, useId } from 'react';
import PropTypes from 'prop-types';
import { cn } from './utils';
import { Icon } from './icons';

const controlBase =
  'block w-full rounded-lg border bg-surface text-fg placeholder:text-subtle shadow-sm transition-colors duration-150 ' +
  'focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 ' +
  'disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-muted';

function stateClasses(error) {
  return error ? 'border-[#DA121A] focus:border-[#DA121A] focus:ring-[#DA121A]/30' : 'border-line hover:border-line-strong';
}

/**
 * Shared label / hint / error wrapper. Wires up aria-describedby and
 * aria-invalid for the control rendered by `children(controlProps)`.
 */
export function Field({ id, label, hint, error, required, className, children }) {
  const autoId = useId();
  const controlId = id || autoId;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label ? (
        <label htmlFor={controlId} className="text-sm font-medium text-fg">
          {label}
          {required ? (
            <span className="ml-0.5 text-[#DA121A]" aria-hidden="true">
              *
            </span>
          ) : null}
        </label>
      ) : null}
      {children({
        id: controlId,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
        required,
      })}
      {hint && !error ? (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
      {hint && error ? (
        <p id={hintId} className="sr-only">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="flex items-center gap-1 text-xs font-medium text-[#e5484d]" role="alert">
          <Icon name="alert" size={14} />
          {error}
        </p>
      ) : null}
    </div>
  );
}

Field.propTypes = {
  id: PropTypes.string,
  label: PropTypes.node,
  hint: PropTypes.node,
  error: PropTypes.node,
  required: PropTypes.bool,
  className: PropTypes.string,
  children: PropTypes.func.isRequired,
};

const fieldPropTypes = {
  id: PropTypes.string,
  label: PropTypes.node,
  hint: PropTypes.node,
  error: PropTypes.node,
  required: PropTypes.bool,
  className: PropTypes.string,
  inputClassName: PropTypes.string,
};

/** <Input label="Display name" error={errors.name} leftIcon={<Icon name="search" />} /> */
export const Input = forwardRef(function Input(
  { id, label, hint, error, required, className, inputClassName, leftIcon, rightSlot, size = 'md', ...rest },
  ref,
) {
  return (
    <Field id={id} label={label} hint={hint} error={error} required={required} className={className}>
      {(controlProps) => (
        <div className="relative">
          {leftIcon ? (
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-subtle">{leftIcon}</span>
          ) : null}
          <input
            ref={ref}
            data-ui=""
            className={cn(
              controlBase,
              stateClasses(error),
              size === 'sm' ? 'h-8 px-2.5 text-sm' : size === 'lg' ? 'h-12 px-4 text-base' : 'h-10 px-3 text-sm',
              leftIcon && 'pl-10',
              rightSlot && 'pr-10',
              inputClassName,
            )}
            {...controlProps}
            {...rest}
          />
          {rightSlot ? <span className="absolute inset-y-0 right-1.5 flex items-center">{rightSlot}</span> : null}
        </div>
      )}
    </Field>
  );
});

Input.propTypes = {
  ...fieldPropTypes,
  leftIcon: PropTypes.node,
  rightSlot: PropTypes.node,
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
};

/** <Textarea label="Message" rows={4} maxLength={200} showCount /> */
export const Textarea = forwardRef(function Textarea(
  { id, label, hint, error, required, className, inputClassName, rows = 4, showCount = false, maxLength, value, ...rest },
  ref,
) {
  const count = typeof value === 'string' ? value.length : null;
  return (
    <Field
      id={id}
      label={label}
      hint={
        showCount && maxLength && count !== null ? (
          <span className="flex justify-between gap-2">
            <span>{hint}</span>
            <span className="tabular-nums" aria-live="polite">
              {count}/{maxLength}
            </span>
          </span>
        ) : (
          hint
        )
      }
      error={error}
      required={required}
      className={className}
    >
      {(controlProps) => (
        <textarea
          ref={ref}
          data-ui=""
          rows={rows}
          maxLength={maxLength}
          value={value}
          className={cn(controlBase, stateClasses(error), 'min-h-[5rem] resize-y px-3 py-2.5 text-sm leading-relaxed', inputClassName)}
          {...controlProps}
          {...rest}
        />
      )}
    </Field>
  );
});

Textarea.propTypes = {
  ...fieldPropTypes,
  rows: PropTypes.number,
  showCount: PropTypes.bool,
  maxLength: PropTypes.number,
  value: PropTypes.string,
};

/**
 * <Select label="Voice" options={[{ value: 'am-ET-Wavenet-A', label: 'Female' }]} placeholder="Choose…" />
 * Children <option>s are also accepted instead of `options`.
 */
export const Select = forwardRef(function Select(
  { id, label, hint, error, required, className, inputClassName, options, placeholder, children, ...rest },
  ref,
) {
  return (
    <Field id={id} label={label} hint={hint} error={error} required={required} className={className}>
      {(controlProps) => (
        <div className="relative">
          <select
            ref={ref}
            data-ui=""
            className={cn(controlBase, stateClasses(error), 'h-10 appearance-none pl-3 pr-9 text-sm', inputClassName)}
            {...controlProps}
            {...rest}
          >
            {placeholder ? (
              <option value="" disabled>
                {placeholder}
              </option>
            ) : null}
            {options
              ? options.map((o) => (
                  <option key={o.value} value={o.value} disabled={o.disabled}>
                    {o.label}
                  </option>
                ))
              : children}
          </select>
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-subtle">
            <Icon name="chevronDown" size={16} />
          </span>
        </div>
      )}
    </Field>
  );
});

Select.propTypes = {
  ...fieldPropTypes,
  options: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      label: PropTypes.node.isRequired,
      disabled: PropTypes.bool,
    }),
  ),
  placeholder: PropTypes.string,
  children: PropTypes.node,
};
