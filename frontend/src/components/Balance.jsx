import { useStreamerBalance } from '../contexts/StreamerBalanceContext';
import { useAdminBalance } from '../contexts/AdminBalanceContext';
import PropTypes from 'prop-types';

function Balance({ value, className = '', showLabel = true, label = "Balance", showToggle = true, context = 'streamer' }) {
  const { isHidden, toggleVisibility } = showToggle ? (context === 'admin' ? useAdminBalance() : useStreamerBalance()) : { isHidden: false, toggleVisibility: () => {} };
  
  const displayValue = isHidden ? '••••••' : `Br ${Number(value || 0).toFixed(2)}`;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {showLabel && (
        <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
      )}
      <div className="flex items-center gap-2">
        <span className="font-semibold text-gray-900 dark:text-white">
          {displayValue}
        </span>
        {showToggle && (
          <button
            onClick={toggleVisibility}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
            title={isHidden ? `Show ${context} balances` : `Hide ${context} balances`}
            aria-label={isHidden ? `Show ${context} balances` : `Hide ${context} balances`}
          >
            <span className="text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300 transition-colors">
              {isHidden ? '👁️' : '👁️‍🗨️'}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

Balance.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  className: PropTypes.string,
  showLabel: PropTypes.bool,
  label: PropTypes.string,
  showToggle: PropTypes.bool,
  context: PropTypes.oneOf(['streamer', 'admin']),
};

export default Balance;