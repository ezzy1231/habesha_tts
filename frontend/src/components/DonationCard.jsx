import PropTypes from 'prop-types';
import Balance from './Balance';

export default function DonationCard({ donation, isPlaying = false }) {
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
            <div className="gradient-donation flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg">
              <span className="text-sm sm:text-lg">💸</span>
              <Balance 
                value={donation.amount} 
                showLabel={false} 
                className="font-bold text-xs sm:text-sm text-blue-700 dark:text-blue-300"
              />
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
  }).isRequired,
  isPlaying: PropTypes.bool,
};
