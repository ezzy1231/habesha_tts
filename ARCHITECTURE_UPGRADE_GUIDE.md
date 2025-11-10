# Architecture Upgrade Guide: SQLite and Background Worker

This document outlines the strategy for upgrading the Habesha TTS application from its simple JSON-based database and synchronous TTS generation to a more robust architecture using SQLite and a background worker. This upgrade will improve performance, reliability, and user experience without changing the core functionality.

---

## **Implementation Checklist**

Use this checklist to track your progress through the migration.

### **Part 1: SQLite Database Migration**
-   [ ] **Backend: Install Driver**
    -   [ ] Run `npm install better-sqlite3` in the terminal.
-   [ ] **Backend: Create New DB Module**
    -   [ ] Create the file `src/db-sqlite.js`.
    -   [ ] Add the provided code for the SQLite connection and compatibility layer.
    -   [ ] Add the complete database schema to the `db.exec()` call.
-   [ ] **Backend: Create Migration Script**
    -   [ ] Create the file `scripts/migrate-to-sqlite.js`.
    -   [ ] Add the provided code to read the JSON file and insert data into SQLite.
    -   [ ] Run the script once using `node scripts/migrate-to-sqlite.js`.
-   [ ] **Backend: Switch Imports**
    -   [ ] In `src/bot.js`, change `import db from "./db-simple.js"` to `import db from "./db-sqlite.js"`.
    -   [ ] In `src/routes/admin.js`, change the import.
    -   [ ] In `src/routes/payment.js`, change the import.
    -   [ ] In `src/routes/streamer.js`, change the import.
-   [ ] **Validation**
    -   [ ] Start the application (`npm run dev`).
    -   [ ] Verify there are no database-related errors on startup.
    -   [ ] Test the `/start` command with the Telegram bot to ensure a user can register.
    -   [ ] Check the `tts_donation.db` file to confirm new data is being written.

### **Part 2: Background Worker Implementation**
-   [ ] **Backend: Create Job Queue Table**
    -   [ ] Add the `CREATE TABLE IF NOT EXISTS tts_jobs (...)` schema to `src/db-sqlite.js`.
-   [ ] **Backend: Modify Payment Endpoint**
    -   [ ] In `src/routes/payment.js`, replace the direct `generateTTS` call with logic to insert a job into the `tts_jobs` table.
    -   [ ] Ensure the API emits the initial `new_donation` event with a `processing_audio` status.
-   [ ] **Backend: Create Worker Script**
    -   [ ] Create the file `src/worker.js`.
    -   [ ] Add the provided code for polling the `tts_jobs` table and calling `generateTTS`.
-   [ ] **Backend: Create Internal API**
    -   [ ] In `src/index.js`, add the `/api/internal/notify-audio-ready` endpoint for the worker to call.
-   [ ] **Backend: Update Run Scripts**
    -   [ ] In `package.json`, add the `"dev:worker": "nodemon src/worker.js"` script.
-   [ ] **Frontend: Handle Asynchronous Events**
    -   [ ] In `frontend/src/pages/StreamerPage.jsx`, add a `socket.on()` listener for the `donation_audio_ready` event.
    -   [ ] Modify the existing `new_donation` listener to handle the initial "processing" state.
    -   [ ] Ensure that audio is only added to the playback queue after the `donation_audio_ready` event is received.
-   [ ] **Frontend: Update UI for Processing State**
    -   [ ] In `frontend/src/components/DonationCard.jsx`, add conditional rendering to display a "Generating audio..." message when a donation is in the `processing_audio` state.
-   [ ] **Validation**
    -   [ ] Run both the server and worker in separate terminals (`npm run dev` and `npm run dev:worker`).
    -   [ ] Make a test donation.
    -   [ ] Verify the donation card appears immediately on the dashboard in its "processing" state.
    -   [ ] Check the worker's console output to confirm it picked up and completed the job.
    -   [ ] Verify the donation card on the dashboard updates to its final state and the audio plays correctly.

---

## **Part 1: Migrating to a SQLite Database**

The goal is to replace the JSON file database (`db-simple.js`) with SQLite to gain performance and data integrity. The key to a seamless transition is to create a new database module that perfectly mimics the interface of the existing one, requiring minimal changes to the application logic.

### **Backend Changes**

#### **Step 1: Install SQLite Driver**
First, add the `better-sqlite3` package to the project.
```bash
npm install better-sqlite3
```

#### **Step 2: Create a New SQLite Database Module (`src/db-sqlite.js`)**
This new module will connect to a SQLite file and expose the same `prepare()` method used by `db-simple.js`. This "compatibility layer" is crucial for avoiding a large-scale refactor.

```javascript
// In a new file: src/db-sqlite.js

import Database from "better-sqlite3";

// Initialize the SQLite database file
const db = new Database("tts_donation.db");
db.pragma("journal_mode = WAL"); // For better concurrency

// Create the database schema if it doesn't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS users (...);
  CREATE TABLE IF NOT EXISTS streamers (...);
  CREATE TABLE IF NOT EXISTS donors (...);
  CREATE TABLE IF NOT EXISTS donations (...);
  -- Add other tables like recharges, withdrawals, etc.
`);

// The compatibility layer that mimics the db-simple.js interface
const dbInterface = {
  prepare: (query) => {
    try {
      // better-sqlite3's prepare() returns a statement object that
      // already has .get(), .all(), and .run() methods.
      return db.prepare(query);
    } catch (error) {
      console.error(`Failed to prepare query: ${query}`, error);
      // Return a dummy object to prevent crashes if a query is invalid
      return {
        get: () => undefined,
        all: () => [],
        run: () => ({ changes: 0, lastInsertRowid: 0 }),
      };
    }
  },
  // Expose the raw db instance for transactions or complex operations if needed
  __raw: db,
};

export default dbInterface;
```

#### **Step 3: Create a Data Migration Script**
A one-time script is needed to transfer data from `tts_donation_db.json` to the new `tts_donation.db` SQLite file.

```javascript
// In a new file: scripts/migrate-to-sqlite.js

import fs from 'fs-extra';
import Database from 'better-sqlite3';

const oldDbData = fs.readJsonSync('./tts_donation_db.json');
const newDb = new Database('tts_donation.db');

// ... (Add the same table creation schema from db-sqlite.js) ...

console.log('Starting migration from JSON to SQLite...');

// Example for migrating users
const insertUser = newDb.prepare('INSERT OR IGNORE INTO users (id, telegram_id, username, role) VALUES (@id, @telegram_id, @username, @role)');

for (const user of oldDbData.users) {
  insertUser.run(user);
}

// ... Repeat this process for streamers, donors, donations, etc. ...

console.log('Migration complete!');
```
Run this script once from your terminal: `node scripts/migrate-to-sqlite.js`.

#### **Step 4: Switch the Database Import**
In every file that currently imports `db-simple.js` (like `src/bot.js`, `src/routes/admin.js`, etc.), change the import statement:

-   **From:** `import db from "./db-simple.js";`
-   **To:** `import db from "./db-sqlite.js";`

No other backend code changes are required for the database migration.

### **Frontend Changes**

For the database migration alone, **no frontend changes are necessary**. The backend API endpoints (`/api/streamer/:uuid`, etc.) will continue to return data in the exact same format. This demonstrates the power of creating a backend compatibility layer.

---

## **Part 2: Introducing a Background Worker for TTS**

The goal is to offload slow TTS audio generation to a separate process. This makes the payment confirmation API respond instantly, which is critical for a good user experience and integration with real payment gateways.

### **The New Asynchronous Flow**

1.  **Payment Confirmation:** The API confirms the payment, creates a donation record with a `processing_audio` status, and immediately adds a job to a new `tts_jobs` queue. It then emits a `new_donation` event via WebSocket.
2.  **Frontend Update (Initial):** The streamer's dashboard receives the `new_donation` event and displays the donation card in a "processing" state (e.g., with a spinner).
3.  **Worker Process:** A separate background worker polls the `tts_jobs` table, picks up the new job, and generates the TTS audio.
4.  **Donation Update:** Once the audio is ready, the worker updates the donation record with the `audio_url` and its status.
5.  **Frontend Update (Final):** The worker notifies the main server, which emits a second WebSocket event, `donation_audio_ready`. The frontend receives this event, updates the donation card to its final state, and adds the audio to the playback queue.

### **Backend Changes**

#### **Step 1: Create a `tts_jobs` Table**
Add the following table to your schema in `src/db-sqlite.js`:
```sql
CREATE TABLE IF NOT EXISTS tts_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  donation_id INTEGER UNIQUE,
  status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### **Step 2: Modify the Payment Endpoint**
In `src/routes/payment.js`, change the logic to queue a job instead of generating TTS directly.

```javascript
// Inside src/routes/payment.js (e.g., the /confirm endpoint)

// 1. Update the donation with a 'processing_audio' status
db.prepare("UPDATE donations SET status='paid', amount=? WHERE id=?").run(amount, donationId);

// 2. Add a job to the new queue
db.prepare("INSERT INTO tts_jobs (donation_id) VALUES (?)").run(donationId);

// 3. Emit the initial 'new_donation' event (without audio_url)
const donationData = { ..., status: 'processing_audio', audio_url: null };
io.to(streamer.link_uuid).emit("new_donation", donationData);

// 4. Respond to the user immediately
res.send("<h2>✅ Payment successful!</h2>");
```

#### **Step 3: Create the Worker Script (`src/worker.js`)**
This script runs as a separate process to handle TTS generation.

```javascript
// In a new file: src/worker.js
import db from './db-sqlite.js';
import { generateTTS } from './utils/tts.js';
import axios from 'axios'; // To communicate with the main server

const API_URL = process.env.BASE_URL || 'http://localhost:5000';

async function processJob() {
  const job = db.prepare("SELECT * FROM tts_jobs WHERE status = 'pending' LIMIT 1").get();
  if (!job) return;

  db.prepare("UPDATE tts_jobs SET status = 'processing' WHERE id = ?").run(job.id);
  const donation = db.prepare("SELECT * FROM donations WHERE id = ?").get(job.donation_id);

  try {
    const audioFile = await generateTTS(donation.id, donation.text);
    db.prepare("UPDATE donations SET audio_url = ? WHERE id = ?").run(audioFile, donation.id);
    db.prepare("UPDATE tts_jobs SET status = 'completed' WHERE id = ?").run(job.id);

    // Tell the main server to notify the frontend
    await axios.post(`${API_URL}/api/internal/notify-audio-ready`, { donationId: donation.id });
  } catch (err) {
    db.prepare("UPDATE tts_jobs SET status = 'failed' WHERE id = ?").run(job.id);
  }
}

console.log('🚀 TTS Worker started.');
setInterval(processJob, 5000); // Check for jobs every 5 seconds
```

#### **Step 4: Create an Internal API for the Worker**
Add a new endpoint in `src/index.js` that only the worker will call.

```javascript
// In src/index.js
app.post("/api/internal/notify-audio-ready", (req, res) => {
  const { donationId } = req.body;
  const io = req.app.get("io");

  const donation = db.prepare("SELECT d.*, s.link_uuid FROM donations d JOIN streamers s ON d.streamer_id = s.id WHERE d.id = ?").get(donationId);

  if (io && donation) {
    io.to(donation.link_uuid).emit("donation_audio_ready", {
      donationId: donation.id,
      audio_url: donation.audio_url,
    });
  }
  res.sendStatus(200);
});
```

#### **Step 5: Run the Worker**
Update `package.json` to run both processes concurrently during development.
```json
"scripts": {
  "dev": "nodemon src/index.js",
  "dev:worker": "nodemon src/worker.js"
}
```
You will need to run `npm run dev` and `npm run dev:worker` in two separate terminals.

### **Frontend Changes**

The frontend must be updated to handle the new two-stage, asynchronous flow.

#### **Step 1: Update `StreamerPage.jsx` to Handle Two Events**
The page will now listen for both `new_donation` and `donation_audio_ready`.

```javascript
// In frontend/src/pages/StreamerPage.jsx

useEffect(() => {
  // ... (socket connection setup) ...

  // Event 1: A new donation has been paid for, but audio is not ready
  socket.on("new_donation", (newDonation) => {
    console.log("💸 New donation received (processing audio):", newDonation);
    // Add the donation to the list to display it immediately
    setDonations(prev => [newDonation, ...prev]);
    // DO NOT add to the audio queue yet
  });

  // Event 2: The worker has finished generating the audio
  socket.on("donation_audio_ready", ({ donationId, audio_url }) => {
    console.log(`🔊 Audio ready for donation ${donationId}`);
    let readyDonation = null;

    // Find the donation and update it with the audio_url
    setDonations(prev => prev.map(d => {
      if (d.id === donationId) {
        readyDonation = { ...d, audio_url, status: 'paid' }; // Update status if needed
        return readyDonation;
      }
      return d;
    }));

    // Now that the audio is ready, add it to the playback queue
    if (readyDonation) {
      setQueue(prev => [...prev, readyDonation]);
    }
  });

  return () => {
    socket.off("new_donation");
    socket.off("donation_audio_ready");
  };
}, [uuid]);
```

#### **Step 2: Update `DonationCard.jsx` to Show a Processing State**
The card component needs to visually indicate when audio is being generated.

```javascript
// In frontend/src/components/DonationCard.jsx

export default function DonationCard({ donation, isPlaying }) {
  const isProcessing = donation.status === 'processing_audio' || (donation.status === 'paid' && !donation.audio_url);

  return (
    <div className={`donation-card ...`}>
      {/* ... other card content ... */}
      <div className="mt-3">
        {isProcessing ? (
          <div className="rounded-lg bg-gray-100 dark:bg-gray-700 p-3 text-center">
            <span className="animate-spin inline-block mr-2">🔊</span>
            <span>Generating audio...</span>
          </div>
        ) : (
          <div className="rounded-lg bg-gray-50 ...">
            {/* ... existing message display ... */}
          </div>
        )}
      </div>
    </div>
  );
}

###

This provides clear visual feedback to the streamer, ensuring they know a donation has arrived even while the audio is being prepared.
