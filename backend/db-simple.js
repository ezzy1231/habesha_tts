import fs from "fs-extra";
import path from "path";

const DB_FILE = "tts_donation_db.json";

// Initialize database structure
const defaultDB = {
  users: [],
  streamers: [],
  donors: [],
  donations: [],
  recharges: [],
  withdrawals: [],
  settings: {
    maxChars: 600,
    stepChars: 15,
    basePrice: 20,
    incrementPrice: 15
  }
};

// Load database
function loadDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      // Ensure new fields exist
      if (!data.recharges) data.recharges = [];
      if (!data.withdrawals) data.withdrawals = [];
      if (!data.settings) data.settings = { maxChars: 600, stepChars: 15, basePrice: 20, incrementPrice: 15 };
       // Ensure donors have fields
       data.donors = (data.donors || []).map(d => ({ ...d, balance: Number(d.balance || 0), display_name: d.display_name || '' }));
       // Ensure streamers have balance
       data.streamers = (data.streamers || []).map(s => ({ ...s, balance: Number(s.balance || 0) }));
       // Ensure donations have played field
       data.donations = (data.donations || []).map(d => ({ ...d, played: d.played || false }));
      return data;
    }
  } catch (error) {
    console.warn("Database load error, using default:", error.message);
  }
  return { ...defaultDB };
}

// Save database
function saveDB(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Database save error:", error);
  }
}

let db = loadDB();

// Function to reload the database from file
function reloadDbFromFile() {
  db = loadDB();
  // Update __raw to point to the new db
  dbInterface.__raw = db;
  console.log("🔄 Database reloaded from file.");
}

// Auto-save every 5 seconds if changes were made
let hasChanges = false;
setInterval(() => {
  if (hasChanges) {
    saveDB(db);
    hasChanges = false;
  }
}, 5000);

// Database operations
// Expose raw store for admin analytics (read-only usage)
const dbInterface = {
  markDirty: () => { hasChanges = true; },
  saveNow: () => { saveDB(db); hasChanges = false; },
  reloadDbFromFile, // Export the new reload function
  __raw: db,
  // Users
  prepare: (query) => ({
    get: (...params) => {
      const param = params[0]; // Keep single param logic for existing queries
      if (query.includes("SELECT * FROM users WHERE telegram_id=?")) {
        return db.users.find(u => u.telegram_id === param);
      }
      if (query.includes("SELECT id FROM streamers WHERE link_uuid=?")) {
        return db.streamers.find(s => s.link_uuid === param);
      }
      if (query.includes("SELECT s.id, u.username FROM streamers s")) {
        return db.streamers.map(s => {
          const user = db.users.find(u => u.id === s.user_id);
          return { id: s.id, username: user?.username };
        });
      }
       if (query.includes("SELECT link_uuid FROM streamers WHERE id = ?")) {
         return db.streamers.find(s => s.id === Number(param));
       }
       if (query.includes("donations") && query.includes("WHERE id = ? AND streamer_id = ?")) {
         const donationId = parseInt(params[0]);
         const streamerId = parseInt(params[1]);
         const donation = db.donations.find(d => d.id === donationId && d.streamer_id === streamerId);
         if (donation) {
           return { id: donation.id, audio_url: donation.audio_url };
         }
         return null;
       }
      if (query.includes("FROM donations d") && query.includes("WHERE d.id = ?")) {
        const donationId = parseInt(param);
        console.log("🔍 Looking for donation ID:", donationId);
        console.log("📊 Available donations:", db.donations.map(d => ({id: d.id, text: d.text})));
        
         const donation = db.donations.find(d => d.id === donationId);
         if (donation) {
           console.log("✅ Found donation:", donation);
           const donor = db.donors.find(dn => dn.id === donation.donor_id);
           const user = db.users.find(u => u.id === donor?.user_id);
           const streamer = db.streamers.find(s => s.id === donation.streamer_id);
           return {
             ...donation,
             donor_name: (donor?.display_name && donor.display_name.trim()) || user?.username || 'Anonymous',
             link_uuid: streamer?.link_uuid
           };
         }
        console.log("❌ Donation not found for ID:", donationId);
        return null;
      }
       if (query.includes("SELECT id FROM donations WHERE id = ? AND streamer_id = ?")) {
         const donationId = parseInt(params[0]);
         const streamerId = parseInt(params[1]);
         const donation = db.donations.find(d => d.id === donationId && d.streamer_id === streamerId);
         if (donation) {
           return { id: donation.id };
         }
         return null;
       }
       if (query.includes("SELECT s.id, s.link_uuid, u.username, u.telegram_id, s.balance")) {
         const streamer = db.streamers.find(s => s.link_uuid === param);
         if (streamer) {
           const user = db.users.find(u => u.id === streamer.user_id);
           // Calculate balance from donations
           const donations = db.donations.filter(d => d.streamer_id === streamer.id && d.status === 'paid');
           const totalEarned = donations.reduce((sum, d) => sum + (d.amount || 0), 0);
           const withdrawals = db.withdrawals?.filter(w => w.streamer_id === streamer.id && w.status === 'approved') || [];
           const totalWithdrawn = withdrawals.reduce((sum, w) => sum + (w.amount || 0), 0);
           const balance = totalEarned - totalWithdrawn;
           return { ...streamer, username: user?.username, telegram_id: user?.telegram_id, balance };
         }
         return null;
       }
      if (query.includes("SELECT COUNT(*) as count, SUM(amount) as totalAmount")) {
        // Handle stats query for pagination
        const streamerId = parseInt(param);
        const donations = db.donations.filter(d => d.streamer_id === streamerId && d.status === 'paid');
        const count = donations.length;
        const totalAmount = donations.reduce((sum, d) => sum + (d.amount || 0), 0);
        return { count, totalAmount };
      }
      return null;
    },
    all: (...params) => {
      if (query.includes("SELECT s.id, u.username FROM streamers s")) {
        return db.streamers.map(s => {
          const user = db.users.find(u => u.id === s.user_id);
          return { id: s.id, username: user?.username };
        });
      }
      if (query.includes("FROM donations d") && query.includes("WHERE d.streamer_id = ?") && !query.includes("LIMIT")) {
        const streamerId = params[0];
        console.log("🔍 Fetching donations for streamer ID:", streamerId);
        const donations = db.donations
          .filter(d => d.streamer_id === parseInt(streamerId))
          .map(d => {
            const donor = db.donors.find(dn => dn.id === d.donor_id);
            const user = db.users.find(u => u.id === donor?.user_id);
            return {
              ...d,
              donor_name: (donor?.display_name && donor.display_name.trim()) || user?.username
            };
          })
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        console.log("📊 Found donations:", donations.length);
        return donations;
      }
      if (query.includes("FROM donations d") && query.includes("WHERE d.streamer_id = ?") && query.includes("LIMIT")) {
        // Handle paginated donations query
        const streamerId = parseInt(params[0]);
        const limit = parseInt(params[1]);
        const offset = parseInt(params[2]);
        console.log("🔍 Fetching paginated donations for streamer ID:", streamerId, "limit:", limit, "offset:", offset);
        const donations = db.donations
          .filter(d => d.streamer_id === streamerId && d.status === 'paid')
          .map(d => {
            const donor = db.donors.find(dn => dn.id === d.donor_id);
            const user = db.users.find(u => u.id === donor?.user_id);
            return {
              ...d,
              donor_display_name: donor?.display_name || '',
              donor_username: user?.username || '',
              donor_name: (donor?.display_name && donor.display_name.trim()) || user?.username || '',
              played: d.played || false
            };
          })
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .slice(offset, offset + limit);
        console.log("📊 Found paginated donations:", donations.length);
        return donations;
      }
      return [];
    },
    run: (...params) => {
      hasChanges = true;
      
      if (query.includes("INSERT INTO users")) {
        const newId = Math.max(0, ...db.users.map(u => u.id)) + 1;
        const user = {
          id: newId,
          telegram_id: params[0],
          username: params[1],
          role: params[2] || query.includes("'streamer'") ? 'streamer' : 'donor'
        };
        db.users.push(user);
        return { lastInsertRowid: newId };
      }
      
      if (query.includes("INSERT INTO streamers")) {
        const newId = Math.max(0, ...db.streamers.map(s => s.id)) + 1;
        const streamer = {
          id: newId,
          user_id: params[0],
          link_uuid: params[1],
          balance: 0
        };
        db.streamers.push(streamer);
        return { lastInsertRowid: newId };
      }
      
      if (query.includes("INSERT INTO donors")) {
        const newId = Math.max(0, ...db.donors.map(d => d.id)) + 1;
        const donor = {
          id: newId,
          user_id: params[0],
          balance: 0,
          display_name: ''
        };
        db.donors.push(donor);
        return { lastInsertRowid: newId };
      }
      
      if (query.includes("INSERT INTO donations")) {
        const newId = Math.max(0, ...db.donations.map(d => d.id)) + 1;
        const streamerId = parseInt(params[0]);
        const donorId = parseInt(params[1]);
        
        // Validate donor and streamer exist
        const donorExists = db.donors.some(d => d.id === donorId);
        const streamerExists = db.streamers.some(s => s.id === streamerId);
        
        if (!donorExists) {
          console.error("❌ Donor ID not found:", donorId);
          // Create missing donor record
          const newDonorId = Math.max(0, ...db.donors.map(d => d.id)) + 1;
          db.donors.push({
            id: newDonorId,
            user_id: donorId, // fallback
            balance: 0,
            display_name: ''
          });
          console.log("🔧 Auto-created missing donor ID:", newDonorId);
        }
        if (!streamerExists) {
          console.error("❌ Streamer ID not found:", streamerId);
          throw new Error(`Streamer ID ${streamerId} does not exist`);
        }
        
         const donation = {
           id: newId,
           donor_id: donorId,
           streamer_id: streamerId,
           amount: parseFloat(params[3]),
           text: params[2],
           status: params[4] || 'pending',
           audio_url: null,
           played: false,
           created_at: new Date().toISOString()
         };
        db.donations.push(donation);
        console.log("💾 Created donation:", donation);
        return { lastInsertRowid: newId };
      }

      if (query.includes("INSERT INTO withdrawals")) {
        const newId = Math.max(0, ...db.withdrawals.map(w => w.id)) + 1;
        const withdrawal = {
          id: newId,
          streamer_id: parseInt(params[0]),
          amount: parseFloat(params[1]),
          telebirr_username: params[2],
          phone_number: params[3],
          status: 'pending',
          created_at: new Date().toISOString()
        };
        db.withdrawals.push(withdrawal);
        console.log("💾 Created withdrawal request:", withdrawal);
        return { lastInsertRowid: newId };
      }
      
      if (query.includes("UPDATE donations SET status='paid'")) {
        const donationId = parseInt(params[2]);
        // Correct mapping: amount is params[0], audio_url is params[1]
        console.log("🔄 Updating donation ID:", donationId, "with amount:", params[0], "audio:", params[1]);
        const donation = db.donations.find(d => d.id === donationId);
        if (donation) {
          donation.status = 'paid';
          donation.amount = parseFloat(params[0]);
          donation.audio_url = params[1];
          console.log("✅ Updated donation:", donation);
        } else {
          console.log("❌ Could not find donation to update:", donationId);
        }
        return {};
      }
      
      if (query.includes("UPDATE donors SET balance=")) {
        const newBalance = Number(params[0]);
        const donorId = Number(params[1]);
        const donor = db.donors.find(d => d.id === donorId);
        if (donor) donor.balance = newBalance;
        return {};
      }
      if (query.includes("UPDATE donations SET audio_url")) {
        const donation = db.donations.find(d => d.id === params[1]);
        if (donation) {
          donation.audio_url = params[0];
        }
        return {};
      }

      if (query.includes("UPDATE donations SET played = 1")) {
        const donationId = parseInt(params[0]);
        const donation = db.donations.find(d => d.id === donationId);
        if (donation) {
          donation.played = true;
          console.log("✅ Marked donation as played:", donationId);
          // Save immediately
          saveDB(db);
        }
        return {};
      }

      // Deletions for reset functionality
      if (query.includes("DELETE FROM donors WHERE user_id")) {
        const userId = params[0];
        db.donors = db.donors.filter(d => d.user_id !== userId);
        hasChanges = true;
        return {};
      }
      if (query.includes("DELETE FROM streamers WHERE user_id")) {
        const userId = params[0];
        db.streamers = db.streamers.filter(s => s.user_id !== userId);
        hasChanges = true;
        return {};
      }
      if (query.includes("DELETE FROM users WHERE telegram_id")) {
        const tgId = params[0];
        db.users = db.users.filter(u => u.telegram_id !== tgId);
        hasChanges = true;
        return {};
      }
      
      return {};
    }
  })
};

export default dbInterface;