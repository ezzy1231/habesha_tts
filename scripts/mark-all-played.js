import db from '../src/db-simple.js';

console.log('Starting to mark all donations as played...');

// Access the raw database object
const rawDb = db.__raw;

if (rawDb && Array.isArray(rawDb.donations)) {
  let updatedCount = 0;
  rawDb.donations.forEach(donation => {
    if (!donation.played) {
      donation.played = true;
      updatedCount++;
    }
  });

  if (updatedCount > 0) {
    console.log(`Updated ${updatedCount} donations to 'played'.`);
    // Mark the database as dirty and save it
    db.markDirty();
    db.saveNow();
    console.log('Database saved successfully.');
  } else {
    console.log('All donations were already marked as played.');
  }
} else {
  console.error('Could not find donations in the database.');
}

console.log('Script finished.');
