import { useState, useEffect, useRef } from "react";
import PropTypes from 'prop-types';
import Balance from './Balance';

const FLAG_ACTION_OPTIONS = [
  { value: 'temp_ban', icon: '⏳', label: 'Time Ban' },
  { value: 'permanent_ban', icon: '🚫', label: 'Ban Donor' },
  { value: 'unban_request', icon: '✅', label: 'Unban Request' },
];

export default function DonationCard({ donation, isPlaying = false, onFlagAction, isFlagging = false }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const hasPendingFlag = donation.flag?.status === 'pending';
  const disableFlagMenu = !onFlagAction || hasPendingFlag || isFlagging;

  useEffect(() => {
    if (!menuOpen) return undefined;

    const handleClickOutside = (event) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };

    const handleEsc = (event) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (disableFlagMenu && menuOpen) {
      setMenuOpen(false);
    }
  }, [disableFlagMenu, menuOpen]);

  const handleFlagAction = (action) => {
    if (!onFlagAction || disableFlagMenu) return;
    onFlagAction(action);
    setMenuOpen(false);
  };

  const formatTime = (dateString) => {
    try {
      const d = new Date(dateString);
      return d.toLocaleString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        month: "short",
        day: "2-digit",
      });
    } catch (e) {
      return "";
    }
  };

  const flagTimestamp = donation.flag?.created_at ? formatTime(donation.flag.created_at) : null;

  const initials = (name) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  };

  return (
    <div
      className={`card hover:shadow-lg group transition-all duration-300 ${
        isPlaying 
          ? "ring-2 ring-success-500 ring-opacity-50 border-success-200 dark:border-success-800" 
          : "hover-scale-102"
      }`}
    >
      <div className="p-3 sm:p-4 lg:p-6">
        {/* Header with donor info and status */}
        <div className="flex items-start justify-between mb-3 sm:mb-4 gap-2">
          <div className="flex items-center gap-2 sm:gap-3 lg:gap-4 min-w-0 flex-1">
            <div className={`relative w-8 h-8 sm:w-10 sm:h-12 lg:w-12 lg:h-12 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold shadow-lg transition-all duration-300 flex-shrink-0 ${
              isPlaying 
                ? "gradient-avatar-green text-white scale-110" 
                : "gradient-avatar-blue text-white hover-scale-105"
            }`}>
              {initials(donation.donor_name || "Donor")}
              {isPlaying && (
                <div className="absolute -top-1 -right-1 w-3 h-3 sm:w-4 sm:h-4 bg-success-400 rounded-full animate-ping"></div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-1">
                <span className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base lg:text-lg truncate">
                  {donation.donor_name || "Anonymous"}
                </span>
                {isPlaying && (
                  <div className="badge badge-success flex-shrink-0">
                    <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-success-500 rounded-full animate-pulse"></span>
                    <span className="hidden sm:inline">Playing</span>
                    <span className="sm:hidden">▶</span>
                  </div>
                )}
              </div>
              <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                {formatTime(donation.created_at)}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1.5 sm:gap-2 flex-shrink-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="gradient-donation flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg">
                <span className="text-sm sm:text-lg">💸</span>
                <Balance 
                  value={donation.amount} 
                  showLabel={false} 
                  className="font-bold text-xs sm:text-sm text-blue-700 dark:text-blue-300"
                />
              </div>
              {onFlagAction && (
                <div className="relative" ref={menuRef}>
                  <button
                    type="button"
                    className={`p-1.5 rounded-full text-base sm:text-lg transition-all duration-150 border border-transparent ${
                      disableFlagMenu
                        ? "text-gray-400 cursor-not-allowed"
                        : "text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900"
                    }`}
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                    disabled={disableFlagMenu}
                    onClick={() => {
                      if (disableFlagMenu) return;
                      setMenuOpen((prev) => !prev);
                    }}
                    title={hasPendingFlag ? "Awaiting admin review" : "Notify admins about this donor"}
                  >
                    ⋮
                  </button>
                  {menuOpen && (
                    <div className="absolute right-0 mt-2 w-48 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl z-20 overflow-hidden">
                      {FLAG_ACTION_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                          onClick={() => handleFlagAction(option.value)}
                        >
                          <span className="text-base">{option.icon}</span>
                          <span className="font-medium">{option.label}</span>
                        </button>
                      ))}
                      <div className="px-3 py-1 text-[11px] text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-800">
                        Sends an instant alert to admins.
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="flex flex-wrap gap-1 justify-end">
              <span className={`badge ${
                donation.status === "paid" ? "badge-success" : "badge-warning"
              }`}>
                {donation.status || "pending"}
              </span>
              <span className={`badge ${
                donation.played ? "badge-gray" : "badge-purple"
              }`}>
                {donation.played ? "✓" : "○"}
                <span className="hidden sm:inline ml-1">{donation.played ? "Played" : "Unplayed"}</span>
              </span>
            </div>
            {isFlagging && (
              <div className="text-[11px] text-amber-600">Sending review...</div>
            )}
          </div>
        </div>

        {/* Donation message */}
        <div className="relative">
          <div className="gradient-message rounded-xl p-3 sm:p-4 border border-gray-200 dark:border-gray-700">
            <div className="absolute top-1.5 sm:top-2 left-1.5 sm:left-2 text-gray-400 dark:text-gray-500 text-sm sm:text-lg">&ldquo;</div>
            <p className="italic text-gray-800 dark:text-gray-200 leading-relaxed pl-3 sm:pl-4 pr-3 sm:pr-4 text-sm sm:text-base">
              {donation.text}
            </p>
            <div className="absolute bottom-1.5 sm:bottom-2 right-1.5 sm:right-2 text-gray-400 dark:text-gray-500 text-sm sm:text-lg">&rdquo;</div>
          </div>
        </div>

        {donation.flag && (
          <div className="mt-3 sm:mt-4 rounded-xl border border-amber-200 dark:border-amber-500/40 bg-amber-50/60 dark:bg-amber-900/20 p-3 sm:p-4 text-xs sm:text-sm text-amber-900 dark:text-amber-50 flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="font-semibold truncate">{donation.flag.actionLabel || 'Flagged'}</span>
              <span className={`badge ${donation.flag.status === 'pending' ? 'badge-warning' : 'badge-success'}`}>
                {donation.flag.status === 'pending' ? 'Pending review' : donation.flag.status}
              </span>
            </div>
            {donation.flag.reason && (
              <p className="text-[13px] leading-snug opacity-90">
                {donation.flag.reason}
              </p>
            )}
            {flagTimestamp && (
              <span className="text-[11px] uppercase tracking-wide opacity-75">Sent {flagTimestamp}</span>
            )}
          </div>
        )}

        {/* Action indicators */}
        {isPlaying && (
          <div className="mt-3 sm:mt-4 flex items-center justify-center">
            <div className="badge badge-success">
              <div className="flex space-x-0.5 sm:space-x-1">
                <div className="w-0.5 h-3 sm:w-1 sm:h-4 bg-success-500 rounded-full animate-pulse"></div>
                <div className="w-0.5 h-3 sm:w-1 sm:h-4 bg-success-500 rounded-full animate-pulse" style={{animationDelay: '75ms'}}></div>
                <div className="w-0.5 h-3 sm:w-1 sm:h-4 bg-success-500 rounded-full animate-pulse" style={{animationDelay: '150ms'}}></div>
              </div>
              <span className="text-xs sm:text-sm">Audio Playing</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

DonationCard.propTypes = {
  donation: PropTypes.shape({
    donor_name: PropTypes.string,
    created_at: PropTypes.string,
    amount: PropTypes.number,
    status: PropTypes.string,
    text: PropTypes.string,
    played: PropTypes.bool,
    flag: PropTypes.shape({
      action: PropTypes.string,
      actionLabel: PropTypes.string,
      status: PropTypes.string,
      reason: PropTypes.string,
      created_at: PropTypes.string,
    }),
  }).isRequired,
  isPlaying: PropTypes.bool,
  onFlagAction: PropTypes.func,
  isFlagging: PropTypes.bool,
};

DonationCard.defaultProps = {
  isPlaying: false,
  onFlagAction: null,
  isFlagging: false,
};
