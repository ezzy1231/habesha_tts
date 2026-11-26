import PropTypes from 'prop-types';
import { useStreamerBalance } from '../contexts/StreamerBalanceContext';
import { useAdminBalance } from '../contexts/AdminBalanceContext';
import { cn, focusRing, Icon } from '../ui';

const NO_CONTEXT = { isHidden: false, toggleVisibility: () => {} };

function StreamerBalance(props) {
  return <BalanceView {...props} {...useStreamerBalance()} />;
}

function AdminBalance(props) {
  return <BalanceView {...props} {...useAdminBalance()} />;
}

/**
 * ETB amount that respects the "hide balances" preference.
 * `showToggle` connects it to the streamer/admin visibility context; `hideButton` keeps
 * that behaviour but leaves the eye button out (for amounts in lists and cards).
 */
function Balance(props) {
  const { showToggle = true, context = 'streamer' } = props;
  if (!showToggle) return <BalanceView {...props} {...NO_CONTEXT} />;
  return context === 'admin' ? <AdminBalance {...props} /> : <StreamerBalance {...props} />;
}

function BalanceView({ value, className = '', showLabel = true, label = 'Balance', showToggle = true, hideButton = false, context = 'streamer', isHidden, toggleVisibility }) {
  const displayValue = isHidden ? '••••••' : `Br ${Number(value || 0).toFixed(2)}`;

  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      {showLabel ? <span className="text-xs text-muted">{label}</span> : null}
      <span className="font-semibold tabular-nums">{displayValue}</span>
      {showToggle && !hideButton ? (
        <button
          type="button"
          onClick={toggleVisibility}
          className={cn('inline-flex h-7 w-7 items-center justify-center rounded-md text-subtle transition-colors hover:bg-surface-2 hover:text-fg', focusRing)}
          title={isHidden ? `Show ${context} balances` : `Hide ${context} balances`}
          aria-label={isHidden ? `Show ${context} balances` : `Hide ${context} balances`}
        >
          <Icon name={isHidden ? 'eye' : 'eyeOff'} size={15} />
        </button>
      ) : null}
    </span>
  );
}

BalanceView.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  className: PropTypes.string,
  showLabel: PropTypes.bool,
  label: PropTypes.string,
  showToggle: PropTypes.bool,
  hideButton: PropTypes.bool,
  context: PropTypes.oneOf(['streamer', 'admin']),
  isHidden: PropTypes.bool,
  toggleVisibility: PropTypes.func,
};

Balance.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  className: PropTypes.string,
  showLabel: PropTypes.bool,
  label: PropTypes.string,
  showToggle: PropTypes.bool,
  hideButton: PropTypes.bool,
  context: PropTypes.oneOf(['streamer', 'admin']),
};

export default Balance;
