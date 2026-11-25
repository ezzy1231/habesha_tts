import { forwardRef } from 'react';
import PropTypes from 'prop-types';
import { cn, focusRing } from './utils';
import { Spinner } from './Spinner';

const VARIANTS = {
  primary:
    'bg-brand-600 text-white shadow-card hover:bg-brand-700 active:bg-brand-800 disabled:hover:bg-brand-600',
  secondary:
    'bg-surface-2 text-fg border border-line hover:bg-surface-3 hover:border-line-strong',
  ghost: 'bg-transparent text-fg hover:bg-surface-2',
  danger: 'bg-[#DA121A] text-white shadow-card hover:bg-[#b80f16] active:bg-[#9a0d12]',
};

const SIZES = {
  sm: 'h-8 px-3 text-sm gap-1.5 rounded-md',
  md: 'h-10 px-4 text-sm gap-2 rounded-lg',
  lg: 'h-12 px-6 text-base gap-2 rounded-lg',
};

const ICON_ONLY = {
  sm: 'h-8 w-8 rounded-md',
  md: 'h-10 w-10 rounded-lg',
  lg: 'h-12 w-12 rounded-lg',
};

/**
 * <Button variant="primary" size="md" loading>Save</Button>
 * Use `iconOnly` with an `aria-label` for icon buttons.
 * Pass `as={Link}` (react-router) or `as="a"` to render a link styled as a button.
 */
export const Button = forwardRef(function Button(
  {
    as: Component = 'button',
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    iconOnly = false,
    fullWidth = false,
    leftIcon,
    rightIcon,
    className,
    children,
    type,
    ...rest
  },
  ref,
) {
  const isButton = Component === 'button';
  const isDisabled = disabled || loading;
  return (
    <Component
      ref={ref}
      type={isButton ? type || 'button' : type}
      disabled={isButton ? isDisabled : undefined}
      aria-disabled={!isButton && isDisabled ? true : undefined}
      aria-busy={loading || undefined}
      className={cn(
        'relative inline-flex select-none items-center justify-center whitespace-nowrap font-semibold transition-colors duration-150',
        'disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50',
        focusRing,
        '[&>svg]:shrink-0',
        VARIANTS[variant],
        iconOnly ? ICON_ONLY[size] : SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? (
        <Spinner size={size === 'lg' ? 18 : 16} className={cn(iconOnly ? '' : '-ml-0.5')} />
      ) : (
        leftIcon
      )}
      {iconOnly && loading ? null : children}
      {!loading && rightIcon}
    </Component>
  );
});

Button.propTypes = {
  as: PropTypes.elementType,
  variant: PropTypes.oneOf(['primary', 'secondary', 'ghost', 'danger']),
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  loading: PropTypes.bool,
  disabled: PropTypes.bool,
  iconOnly: PropTypes.bool,
  fullWidth: PropTypes.bool,
  leftIcon: PropTypes.node,
  rightIcon: PropTypes.node,
  className: PropTypes.string,
  children: PropTypes.node,
  type: PropTypes.oneOf(['button', 'submit', 'reset']),
};
