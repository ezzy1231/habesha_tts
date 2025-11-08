import fs from 'fs-extra';
import path from 'path';
import express from "express";
import db from "../db-postgres.js";
import { protectStreamer } from "../middleware/auth.js";
import { bot } from '../../bot/bot.js';

console.log(" streamer.js router loaded");

const router = express.Router();

// Get streamer donations by link_uuid - PROTECTED
router.get("/:uuid/donations", protectStreamer, async (req, res) => {
  // The middleware has already validated the streamer and attached their ID to req.streamerId
  const page = parseInt(req.query.page) || 1;
  const limit = 15;
  const offset = (page - 1) * limit;

  try {
    const donationsRes = await db.query(`
      SELECT d.id, u.display_name AS donor_name, d.message AS text, d.amount, d.status, d.audio_file AS audio_url, d.played, d.created_at
      FROM donations d
      LEFT JOIN users u ON u.telegram_id = d.donor_id
      WHERE d.streamer_id = $1 AND d.status = 'paid'
      ORDER BY d.created_at DESC
      LIMIT $2 OFFSET $3
    `, [req.streamerId, limit, offset]);

    const statsRes = await db.query(`
      SELECT COUNT(*) as count
      FROM donations
      WHERE streamer_id = $1 AND status = 'paid'
    `, [req.streamerId]);

    const totalCount = parseInt(statsRes.rows[0].count);

    const donations = (donationsRes.rows || []).map(d => ({
      ...d,
      donor_name: d.donor_name,
    }));

    res.json({
      donations,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        hasNextPage: page * limit < totalCount
      }
    });
  } catch (error) {
    console.error("Error fetching donations:", error);
    res.status(500).json({ error: "Failed to fetch donations" });
  }
});

// Get streamer info by UUID - REMAINS PUBLIC
router.get("/:uuid", async (req, res) => {
  const { uuid } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = 15; // Use a smaller limit for pagination
  const offset = (page - 1) * limit;

  try {
    const streamerRes = await db.query(`
      SELECT telegram_id, username, balance, link_uuid, profile_picture_file_id, full_name
      FROM users
      WHERE link_uuid = $1 AND role = 'streamer'
    `, [uuid]);
    const streamer = streamerRes.rows[0];

    if (!streamer) {
      return res.status(404).json({ error: "Streamer not found" });
    }

    let profile_picture_url = null;
    try {
      if (bot && streamer.profile_picture_file_id) {
        profile_picture_url = await bot.getFileLink(streamer.profile_picture_file_id);
      }
    } catch (e) {
      console.error(`Failed to get file link for ${streamer.profile_picture_file_id}:`, e.message);
    }

    console.log(`Fetching paginated donations for streamer ID: ${streamer.telegram_id} limit: ${limit} offset: ${offset}`);

    // Also fetch donations for this streamer with pagination
    const donationsRes = await db.query(`
      SELECT d.id, u.display_name AS donor_name, d.message AS text, d.amount, d.status, d.audio_file AS audio_url, d.played, d.created_at
      FROM donations d
      LEFT JOIN users u ON u.telegram_id = d.donor_id
      WHERE d.streamer_id = $1 AND d.status = 'paid'
      ORDER BY d.created_at DESC
      LIMIT $2 OFFSET $3
    `, [streamer.telegram_id, limit, offset]);

    // Get total count and total amount for pagination
    const statsRes = await db.query(`
      SELECT COUNT(*) as count, SUM(amount) as totalAmount
      FROM donations d
      WHERE d.streamer_id = $1 AND d.status = 'paid'
    `, [streamer.telegram_id]);
    const stats = statsRes.rows[0];
    const totalCount = parseInt(stats.count);
    const totalEarned = Number(stats.totalAmount || 0);

    const approvedWithdrawalsRes = await db.query(`
      SELECT SUM(amount) as totalWithdrawn
      FROM withdrawals
      WHERE user_id = $1 AND status = 'approved'
    `, [streamer.telegram_id]);
    const totalWithdrawn = Number(approvedWithdrawalsRes.rows[0].totalWithdrawn || 0);

    const balance = totalEarned - totalWithdrawn;

    const donations = (donationsRes.rows || []).map(d => ({
      ...d,
      donor_name: d.donor_name,
    }));

    console.log(`Found paginated donations: ${donations.length}`);

    res.json({
      streamer: {
        telegram_id: streamer.telegram_id,
        username: streamer.username,
        full_name: streamer.full_name,
        balance: balance, // Use the freshly calculated, always-correct value
        link_uuid: streamer.link_uuid,
        profile_picture_url,
      },
      donations,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        totalAmount: totalEarned, // totalAmount in pagination should reflect total earned, not current balance
        hasNextPage: page * limit < totalCount
      }
    });
  } catch (error) {
    console.error("Error fetching streamer info:", error);
    res.status(500).json({ error: "Failed to fetch streamer info" });
  }
});

router.post("/:uuid/withdraw", protectStreamer, express.json(), async (req, res) => {
  console.log("✅ Withdrawal route hit for streamer:", req.params.uuid);
  const { amount, telebirrUsername, phoneNumber } = req.body;

  if (!amount || isNaN(amount) || amount <= 0) {
    return res.status(400).json({ error: "Invalid amount" });
  }
  if (!telebirrUsername || !phoneNumber) {
    return res.status(400).json({ error: "Telebirr username and phone number are required" });
  }

  try {
    // We can use req.streamerId from the middleware, but we need the balance, so we still query.
    const streamerRes = await db.query(`
      SELECT balance
      FROM users
      WHERE telegram_id = $1
    `, [req.streamerId]);
    const streamer = streamerRes.rows[0];

    if (amount > streamer.balance) {
      return res.status(400).json({ error: "Insufficient balance" });
    }

    await db.query("INSERT INTO withdrawals (user_id, amount, telebirr_username, phone_number, status) VALUES ($1, $2, $3, $4, 'pending')",
      [req.streamerId, amount, telebirrUsername, phoneNumber]);

    res.json({ success: true, message: "Withdrawal request submitted" });
  } catch (error) {
    console.error("Error submitting withdrawal request:", error);
    res.status(500).json({ error: "Failed to submit withdrawal request" });
  }
});

// Mark donation as played - PROTECTED
router.post("/:uuid/donations/:donationId/played", protectStreamer, async (req, res) => {
  const { donationId: donationIdStr } = req.params;
  const donationId = parseInt(donationIdStr);

  // --- Input Validation ---
  if (!donationIdStr || isNaN(donationId)) {
    return res.status(400).json({ error: "Bad Request: Invalid or missing 'donationId'." });
  }

  console.log("🎵 Marking donation as played:", { uuid: req.params.uuid, donationId });

  try {
    // req.streamerId is guaranteed to be correct by the middleware
    const donationRes = await db.query("SELECT id, audio_file FROM donations WHERE id = $1 AND streamer_id = $2", [donationId, req.streamerId]);
    const donation = donationRes.rows[0];

    if (!donation) {
      console.log("❌ Donation not found:", donationId, "for streamer:", req.streamerId);
      return res.status(404).json({ error: "Donation not found" });
    }

    await db.query("UPDATE donations SET played = TRUE WHERE id = $1", [donationId]);
    console.log("✅ Donation marked as played:", donationId);

    // Clean up: delete the audio file after a delay to allow for playback
    // if (donation.audio_file && donation.audio_file !== 'demo_audio.mp3') {
    //   setTimeout(() => {
    //     const audioFileName = path.basename(donation.audio_file);
    //     const audioPath = path.join(process.cwd(), 'public', 'audios', audioFileName);
    //     fs.remove(audioPath).catch(err => console.error('Error deleting audio file:', err));
    //     console.log("🗑️ Deleted audio file after delay:", audioFileName);
    //   }, 60000); // 60-second delay
    // }

    res.json({ success: true });
  } catch (error) {
    console.error("Error marking donation as played:", error);
    res.status(500).json({ error: "Failed to mark donation as played" });
  }
});

export default router;