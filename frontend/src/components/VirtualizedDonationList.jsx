import { Virtuoso } from 'react-virtuoso';
import DonationCard from './DonationCard';
import SkeletonLoader from './SkeletonLoader';

export default function VirtualizedDonationList({ donations, loading, currentPlaying }) {
  if (loading && donations.length === 0) {
    return (
      <div className="col-span-full flex justify-center p-8">
        <SkeletonLoader type="donation" count={6} />
      </div>
    );
  }
  if (!loading && donations.length === 0) {
    return (
      <div className="p-6 rounded-xl text-center shadow bg-white dark:bg-gray-800 col-span-full">
        <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">No Donations Yet</h3>
        <p className="text-sm text-gray-600 dark:text-gray-300">Share your link to start receiving messages!</p>
      </div>
    );
  }
  return (
    <Virtuoso
      style={{ height: 'calc(100vh - 420px)' }}
      data={donations}
      itemContent={(index, donation) => (
        <DonationCard key={donation.id} donation={donation} isPlaying={currentPlaying === donation.id} />
      )}
      useWindowScroll={false}
    />
  );
}
