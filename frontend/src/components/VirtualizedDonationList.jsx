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
      <div className="p-6 rounded-xl text-center shadow bg-surface col-span-full">
        <h3 className="text-xl font-bold mb-2 text-fg">No Donations Yet</h3>
        <p className="text-sm text-muted">Share your link to start receiving messages!</p>
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
