import PropTypes from 'prop-types';
import { cn } from './utils';
import { Icon } from './icons';

/** <EmptyState icon="inbox" title="No donations yet" description="Share your link…" action={<Button/>} /> */
export function EmptyState({ icon = 'inbox', title, description, action, compact = false, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', compact ? 'gap-2 px-4 py-8' : 'gap-3 px-6 py-14', className)}>
      <span
        className={cn(
          'flex items-center justify-center rounded-full border border-line bg-surface-2 text-subtle',
          compact ? 'h-10 w-10' : 'h-14 w-14',
        )}
      >
        {typeof icon === 'string' ? <Icon name={icon} size={compact ? 20 : 26} /> : icon}
      </span>
      <div className="max-w-sm">
        <p className={cn('font-semibold text-fg', compact ? 'text-sm' : 'text-base')}>{title}</p>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

EmptyState.propTypes = {
  icon: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  title: PropTypes.node.isRequired,
  description: PropTypes.node,
  action: PropTypes.node,
  compact: PropTypes.bool,
  className: PropTypes.string,
};
