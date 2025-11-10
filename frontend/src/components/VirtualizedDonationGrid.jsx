import { VirtuosoGrid } from 'react-virtuoso';
import DonationCard from './DonationCard';
import React from 'react';

// Custom item wrapper to preserve existing spacing via utility classes
const ItemContainer = React.forwardRef(function ItemContainer(props, ref) {
  return <div ref={ref} className="w-full" {...props} />;
});

// Main list container replicating the previous grid spacing (gap handled by parent CSS)
const ListContainer = React.forwardRef(function ListContainer(props, ref) {
  return <div ref={ref} className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3" {...props} />;
});

export default function VirtualizedDonationGrid({ donations, currentPlaying }) {
  return (
    <VirtuosoGrid
      data={donations}
      useWindowScroll
      overscan={200}
      components={{
        Item: ItemContainer,
        List: ListContainer,
      }}
      itemContent={(index, donation) => (
        <DonationCard donation={donation} isPlaying={currentPlaying === donation.id} />
      )}
    />
  );
}
