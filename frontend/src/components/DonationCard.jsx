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
      className={`card hover:shadow-xl transition-all duration-300 group ${
        isPlaying 
          ? "ring-2 ring-green-500 ring-opacity-50 border-green-200 dark:border-green-800" 
          : "hover:scale-[1.02]"
      }`}
    >
      <div className="p-3 sm:p-4 lg:p-6">
        {/* Header with donor info and status */}
        <div className="flex items-start justify-between mb-3 sm:mb-4 gap-2">
          <div className="flex items-center gap-2 sm:gap-3 lg:gap-4 min-w-0 flex-1">
            <div className={`relative w-8 h-8 sm:w-10 sm:h-12 lg:w-12 lg:h-12 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold shadow-lg transition-all duration-300 flex-shrink-0 ${
              isPlaying 
                ? "bg-gradient-to-r from-green-500 to-green-600 text-white scale-110" 
                : "bg-gradient-to-r from-blue-500 to-blue-600 text-white group-hover:scale-105"
            }`}>
              {initials(donation.donor_name || "Donor")}
              {isPlaying && (
                <div className="absolute -top-1 -right-1 w-3 h-3 sm:w-4 sm:h-4 bg-green-400 rounded-full animate-ping"></div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-1">
                <span className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base lg:text-lg truncate">
                  {donation.donor_name || "Anonymous"}
                </span>
                {isPlaying && (
                  <div className="flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-xs font-medium flex-shrink-0">
                    <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-500 rounded-full animate-pulse"></span>
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
<div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 text-blue-700 dark:text-blue-300 rounded-lg">
              <span className="text-sm sm:text-lg">💸</span>
              <Balance 
                value={donation.amount} 
                showLabel={false} 
                className="font-bold text-xs sm:text-sm text-blue-700 dark:text-blue-300"
              />
            </div>
            
            <div className="flex flex-wrap gap-1 justify-end">
              <span className={`inline-flex items-center px-1.5 sm:px-2 py-1 rounded-full text-xs font-medium ${
                donation.status === "paid"
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                  : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
              }`}>
                {donation.status || "pending"}
              </span>
              <span className={`inline-flex items-center px-1.5 sm:px-2 py-1 rounded-full text-xs font-medium ${
                donation.played
                  ? "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300"
                  : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
              }`}>
                {donation.played ? "✓" : "○"}
                <span className="hidden sm:inline ml-1">{donation.played ? "Played" : "Unplayed"}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Donation message */}
        <div className="relative">
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800/50 dark:to-gray-900/50 rounded-xl p-3 sm:p-4 border border-gray-200 dark:border-gray-700">
            <div className="absolute top-1.5 sm:top-2 left-1.5 sm:left-2 text-gray-400 dark:text-gray-500 text-sm sm:text-lg">"</div>
            <p className="italic text-gray-800 dark:text-gray-200 leading-relaxed pl-3 sm:pl-4 pr-3 sm:pr-4 text-sm sm:text-base">
              {donation.text}
            </p>
            <div className="absolute bottom-1.5 sm:bottom-2 right-1.5 sm:right-2 text-gray-400 dark:text-gray-500 text-sm sm:text-lg">"</div>
          </div>
        </div>

        {/* Action indicators */}
        {isPlaying && (
          <div className="mt-3 sm:mt-4 flex items-center justify-center">
            <div className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg">
              <div className="flex space-x-0.5 sm:space-x-1">
                <div className="w-0.5 h-3 sm:w-1 sm:h-4 bg-green-500 rounded-full animate-pulse"></div>
                <div className="w-0.5 h-3 sm:w-1 sm:h-4 bg-green-500 rounded-full animate-pulse delay-75"></div>
                <div className="w-0.5 h-3 sm:w-1 sm:h-4 bg-green-500 rounded-full animate-pulse delay-150"></div>
              </div>
              <span className="text-xs sm:text-sm font-medium">Audio Playing</span>
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
