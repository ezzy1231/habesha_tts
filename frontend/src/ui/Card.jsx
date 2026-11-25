import PropTypes from 'prop-types';
import { cn } from './utils';

const PADDING = { none: '', sm: 'p-4', md: 'p-5 sm:p-6', lg: 'p-6 sm:p-8' };

/**
 * Surface container.
 * <Card padding="md" interactive accent>…</Card>
 * `accent` draws a thin flag stripe on top (use for hero / highlight cards only).
 */
export function Card({ as: Component = 'div', padding = 'md', interactive = false, accent = false, className, children, ...rest }) {
  return (
    <Component
      className={cn(
        'relative overflow-hidden rounded-xl border border-line bg-surface text-fg shadow-card',
        interactive && 'transition-[border-color,box-shadow] duration-150 hover:border-line-strong hover:shadow-raised',
        PADDING[padding],
        className,
      )}
      {...rest}
    >
      {accent ? <FlagBar className="absolute inset-x-0 top-0" /> : null}
      {children}
    </Component>
  );
}

Card.propTypes = {
  as: PropTypes.elementType,
  padding: PropTypes.oneOf(['none', 'sm', 'md', 'lg']),
  interactive: PropTypes.bool,
  accent: PropTypes.bool,
  className: PropTypes.string,
  children: PropTypes.node,
};

/** Title row for a Card: <CardHeader title="Recent donations" description="…" actions={<Button/>} /> */
export function CardHeader({ title, description, actions, className, as: Heading = 'h3' }) {
  return (
    <div className={cn('mb-4 flex flex-wrap items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        <Heading className="text-base font-semibold leading-tight text-fg">{title}</Heading>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

CardHeader.propTypes = {
  title: PropTypes.node.isRequired,
  description: PropTypes.node,
  actions: PropTypes.node,
  className: PropTypes.string,
  as: PropTypes.elementType,
};

/** Three-colour Ethiopian flag stripe. */
export function FlagBar({ className, height = 3 }) {
  return (
    // Full width unless the caller sets its own width class (w-6, w-1/2, …).
    <div className={cn('flex', !/(^|\s)w-/.test(className || '') && 'w-full', className)} style={{ height }} aria-hidden="true">
      <span className="flex-1 bg-flag-green" />
      <span className="flex-1 bg-flag-yellow" />
      <span className="flex-1 bg-flag-red" />
    </div>
  );
}

FlagBar.propTypes = {
  className: PropTypes.string,
  height: PropTypes.number,
};
