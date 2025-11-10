import express from "express";
import db from "../db-postgres.js";
import { bot, reloadSettings } from "../../bot/bot.js";
import { generateStreamerLink } from "../utils/generateLink.js";
import crypto from "crypto";
import { url } from "inspector";

const router = express.Router();

// Simple admin auth middleware using token
function adminAuth(req, res, next) {
  const token = req.headers['x-admin-token'];

  // ADMIN_TOKEN is always required - no backdoors
  if (!process.env.ADMIN_TOKEN) {
    if (!adminAuth._warned) {
      console.error('[AdminAuth] SECURITY: ADMIN_TOKEN not set. All admin routes are blocked.');
      adminAuth._warned = true;
    }
    return res.status(503).json({ error: 'Admin disabled: ADMIN_TOKEN not configured' });
  }

  // Require exact match - constant-time comparison to prevent timing attacks
  if (!token || token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  next();
}

router.use(adminAuth);

async function getUserById(id) {
  const res = await db.query("SELECT * FROM users WHERE id = $1", [id]);
  return res.rows[0] || null;
}

// Helper: compute aggregates


router.get("/overview", async (req, res) => {
  try {
    const paidDonationsRes = await db.query("SELECT amount, streamer_id, donor_id FROM donations WHERE status = 'paid'");
    const paidDonations = paidDonationsRes.rows;

    const usersRes = await db.query("SELECT id, telegram_id, username, display_name, profile_picture_file_id FROM users");
    const users = usersRes.rows;
    const userMap = new Map(users.map(u => [u.telegram_id, u]));

    const resolveProfilePictureUrl = async (user) => {
      let profile_picture_url = null;
      try {
        if (bot && user.profile_picture_file_id) {
          profile_picture_url = await bot.getFileLink(user.profile_picture_file_id);
        }
      } catch (e) {
        console.error(`Failed to get file link for ${user.profile_picture_file_id}:`, e.message);
      }
      return { ...user, profile_picture_url };
    };

    const totalAmount = paidDonations.reduce((s, d) => s + (Number(d.amount) || 0), 0);
    const totalCount = paidDonations.length;
    const uniqueStreamers = new Set(paidDonations.map(d => d.streamer_id)).size;
    const uniqueDonors = new Set(paidDonations.map(d => d.donor_id)).size;

    // top 5 streamers by amount
    const byStreamer = {};
    for (const d of paidDonations) {
      byStreamer[d.streamer_id] = (byStreamer[d.streamer_id] || 0) + (Number(d.amount) || 0);
    }
    const topStreamers = await Promise.all(Object.entries(byStreamer)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(async ([sid, amt]) => {
        const user = userMap.get(sid);
        const userWithPic = user ? await resolveProfilePictureUrl(user) : null;
        return { streamer_id: sid, username: userWithPic?.username || `Streamer #${sid}`, amount: amt, profile_picture_url: userWithPic?.profile_picture_url };
      }));

    // top 5 donors by amount
    const byDonor = {};
    for (const d of paidDonations) {
      if (d.donor_id) {
        byDonor[d.donor_id] = (byDonor[d.donor_id] || 0) + (Number(d.amount) || 0);
      }
    }
    const topDonors = await Promise.all(Object.entries(byDonor)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(async ([did, amt]) => {
        const user = userMap.get(did);
        const userWithPic = user ? await resolveProfilePictureUrl(user) : null;
        return { donor_id: did, username: userWithPic?.username || `Donor #${did}`, amount: amt, profile_picture_url: userWithPic?.profile_picture_url };
      }));

    res.json({
      totals: {
        total_amount: totalAmount,
        total_count: totalCount,
        unique_streamers: uniqueStreamers,
        unique_donors: uniqueDonors
      },
      topStreamers,
      topDonors
    });
  } catch (error) {
    console.error("Error fetching admin overview:", error);
    res.status(500).json({ error: "Failed to load overview data" });
  }
});

router.get("/streamers", async (req, res) => {
  try {
    const usersRes = await db.query("SELECT telegram_id, username, display_name, link_uuid, profile_picture_file_id FROM users WHERE role = 'streamer' ORDER BY streamer_order ASC");
    const streamersData = usersRes.rows;

    const donationsRes = await db.query("SELECT streamer_id, amount FROM donations WHERE status = 'paid'");
    const paidDonations = donationsRes.rows;

    const streamersWithPics = await Promise.all(streamersData.map(async (s) => {
      let profile_picture_url = null;
      try {
        if (bot && s.profile_picture_file_id) {
          profile_picture_url = await bot.getFileLink(s.profile_picture_file_id);
        }
      } catch (e) {
        console.error(`Failed to get file link for ${s.profile_picture_file_id}:`, e.message);
      }
      return { ...s, profile_picture_url };
    }));

    const result = streamersWithPics.map(s => {
      const total_earned = paidDonations
        .filter(d => String(d.streamer_id) === String(s.telegram_id))
        .reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
      const donations_count = paidDonations.filter(d => String(d.streamer_id) === String(s.telegram_id)).length;
      return {
        telegram_id: s.telegram_id,
        username: s.username || null,
        link_uuid: s.link_uuid,
        total_earned,
        donations_count
      };
    });
    res.json({ streamers: result });
  } catch (error) {
    console.error("Error fetching streamers:", error);
    res.status(500).json({ error: "Failed to load streamers data" });
  }
});

router.post('/streamers/order', adminAuth, async (req, res) => {
  const { ordered_ids } = req.body;

  if (!Array.isArray(ordered_ids) || ordered_ids.length === 0) {
    return res.status(400).json({ error: 'Invalid or empty request body' });
  }

  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');
    
    for (let i = 0; i < ordered_ids.length; i++) {
      await client.query(
        'UPDATE users SET streamer_order = $1 WHERE telegram_id = $2',
        [i, ordered_ids[i]]
      );
    }
    
    await client.query('COMMIT');
    res.status(200).json({ message: 'Streamer order updated successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Failed to update streamer order:', error);
    res.status(500).json({ error: 'Failed to update streamer order' });
  } finally {
    client.release();
  }
});

router.get("/donors", async (req, res) => {
  try {
    const usersRes = await db.query("SELECT telegram_id, username, display_name, balance FROM users WHERE role = 'donor'");
    const donorsData = usersRes.rows;

    const donationsRes = await db.query("SELECT donor_id, amount FROM donations WHERE status = 'paid'");
    const paidDonations = donationsRes.rows;

    const result = donorsData.map(d => {
      const total_donated = paidDonations
        .filter(donation => String(donation.donor_id) === String(d.telegram_id))
        .reduce((sum, donation) => sum + (Number(donation.amount) || 0), 0);
      const donations_count = paidDonations.filter(donation => String(donation.donor_id) === String(d.telegram_id)).length;

      return {
        telegram_id: d.telegram_id,
        username: d.username || null,
        display_name: d.display_name || null,
        balance: Number(d.balance || 0),
        total_donated,
        donations_count
      };
    });
    res.json({ donors: result });
  } catch (error) {
    console.error("Error fetching donors:", error);
    res.status(500).json({ error: "Failed to load donors data" });
  }
});

// Update donor display name
router.post("/donors/:id/display-name", express.json(), async (req, res) => {
  const { id } = req.params;
  const { display_name } = req.body || {};
  if (!display_name || typeof display_name !== 'string') {
    return res.status(400).json({ error: 'display_name is required' });
  }

  try {
    const userRes = await db.query("SELECT * FROM users WHERE telegram_id = $1 AND role = 'donor'", [id]);
    const user = userRes.rows[0];

    if (!user) return res.status(404).json({ error: 'Donor not found' });

    console.log(`[Admin] Updating display_name for telegram_id: ${id} to: ${display_name.trim()}`);
    await db.query("UPDATE users SET display_name = $1 WHERE telegram_id = $2", [display_name.trim(), id]);

    return res.json({ success: true, donor: { telegram_id: id, username: user.username, display_name: display_name.trim() } });
  } catch (error) {
    console.error("Error updating donor display name:", error.message, error.stack);
    res.status(500).json({ error: "Failed to update donor display name" });
  }
});

router.post("/donors/:id/balance", express.json(), async (req, res) => {
  const { id } = req.params;
  const { balance } = req.body;

  if (balance === undefined || isNaN(balance)) {
    return res.status(400).json({ error: "Invalid balance" });
  }

  try {
    const userRes = await db.query("SELECT * FROM users WHERE telegram_id = $1 AND role = 'donor'", [id]);
    const user = userRes.rows[0];

    if (!user) {
      return res.status(404).json({ error: "Donor not found" });
    }

    await db.query("UPDATE users SET balance = $1 WHERE telegram_id = $2", [Number(balance), id]);

    return res.json({ success: true, donor: { telegram_id: id, balance: Number(balance) } });
  } catch (error) {
    console.error("Error updating donor balance:", error);
    res.status(500).json({ error: "Failed to update donor balance" });
  }
});

router.get("/streamer-requests", async (req, res) => {
  try {
    const result = await db.query(`
      SELECT telegram_id, username, full_name, social_link, profile_picture_file_id, registration_status, created_at, phone_number
      FROM users
      WHERE role = 'streamer'
      ORDER BY created_at DESC
    `);

    // Try to resolve profile picture URLs from Telegram
    const requests = await Promise.all(result.rows.map(async (request) => {
      let profile_picture_url = null;
      try {
        if (bot && request.profile_picture_file_id) {
          profile_picture_url = await bot.getFileLink(request.profile_picture_file_id);
        }
      } catch (e) {
        console.error(`Failed to get file link for ${request.profile_picture_file_id}:`, e.message);
      }
      return { ...request, profile_picture_url, phone_number: request.phone_number };
    }));

    res.json({ requests });
  } catch (error) {
    console.error("Error fetching streamer requests:", error);
    res.status(500).json({ error: "Failed to fetch streamer requests" });
  }
});

router.post("/streamer-requests/:id/approve", async (req, res) => {
  const { id } = req.params; // telegram_id
  try {
    const userRes = await db.query("SELECT * FROM users WHERE telegram_id = $1 AND role = 'streamer' AND registration_status = 'pending'", [id]);
    const user = userRes.rows[0];

    if (!user) {
      return res.status(404).json({ error: "Pending streamer not found." });
    }

    const link_uuid = generateStreamerLink();
    const apiKey = crypto.randomBytes(32).toString('hex');

    await db.query(
      "UPDATE users SET registration_status = 'approved', link_uuid = $1, api_key = $2 WHERE telegram_id = $3",
      [link_uuid, apiKey, id]
    );

    // Notify user via Telegram bot
    try {
      if (bot) {
        const frontendBase = (process.env.FRONTEND_URL || process.env.PUBLIC_FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/+$/, '');
        const dashboardUrl = `${frontendBase}/streamer/${link_uuid}`;
        const loginUrl = `${dashboardUrl}/login`;

        const message = [
          '✅ የእርስዎ የ Streamer ምዝገባ ጸድቋል!\n',

          '🔗 የ Dashboard ሊንክዎ:\n'  + dashboardUrl,
          
          '\n Login ስያረጉ 6 code ያለው ኦቲፒ ኮድ ይደርሶታል ።\n',
          '',
          'ለማንኛውም ጥያቄ ወይም እገዛ እባክዎ አስተዳዳሪውን ያነጋግሩ።'

        ].join('\n');

        await bot.sendMessage(id, message);
      }
    } catch (e) {
      console.error("Failed to send approval message to streamer:", e.message);
      // Don't fail the whole request if the bot message fails
    }

    res.json({ success: true, message: "Streamer approved." });
  } catch (error) {
    console.error("Error approving streamer:", error);
    res.status(500).json({ error: "Failed to approve streamer." });
  }
});

router.post("/streamer-requests/:id/reject", async (req, res) => {
  const { id } = req.params; // telegram_id
  try {
    const userRes = await db.query("SELECT * FROM users WHERE telegram_id = $1 AND role = 'streamer' AND registration_status = 'pending'", [id]);
    const user = userRes.rows[0];

    if (!user) {
      return res.status(404).json({ error: "Pending streamer not found." });
    }

    await db.query("UPDATE users SET registration_status = 'rejected' WHERE telegram_id = $1", [id]);

    // Notify user via Telegram bot
    try {
      if (bot) {
        await bot.sendMessage(id, "❌ የእርስዎ የ Streamer ምዝገባ ውድቅ ተደርጓል።\n\nለበለጠ መረጃ አስተዳዳሪውን ያነጋግሩ።");
      }
    } catch (e) {
      console.error("Failed to send rejection message to streamer:", e.message);
    }

    res.json({ success: true, message: "Streamer rejected." });
  } catch (error) {
    console.error("Error rejecting streamer:", error);
    res.status(500).json({ error: "Failed to reject streamer." });
  }
});

router.get("/recharges", async (req, res) => {
  try {
    const rechargesRes = await db.query("SELECT id, donor_id, name_on_payment, amount, status, created_at, screenshot_file_id FROM recharges ORDER BY created_at DESC");
    const recharges = rechargesRes.rows;

    const usersRes = await db.query("SELECT telegram_id, username, display_name FROM users");
    const userMap = new Map(usersRes.rows.map(u => [u.telegram_id, u]));

    const baseList = recharges.map(r => {
      const user = userMap.get(r.donor_id);
      return {
        id: r.id,
        donor_id: r.donor_id,
        donor_username: user?.username,
        name_on_payment: r.name_on_payment,
        amount: r.amount || 0,
        status: r.status,
        created_at: r.created_at,
        screenshot_file_id: r.screenshot_file_id
      };
    });

    // Try to resolve screenshot URLs from Telegram
    const list = await Promise.all(baseList.map(async (it) => {
      let screenshot_url = null;
      try {
        if (bot && it.screenshot_file_id) {
          screenshot_url = await bot.getFileLink(it.screenshot_file_id);
        }
      } catch {}
      return { ...it, screenshot_url };
    }));

    res.json({ recharges: list });
  } catch (error) {
    console.error("Error fetching recharges:", error);
    res.status(500).json({ error: "Failed to load recharges data" });
  }
});

router.post("/recharges/:id/approve", async (req, res) => {
  const { id } = req.params;
  const amount = Number(req.body?.amount || req.query?.amount);

  // --- Input Validation ---
  if (isNaN(amount) || amount <= 0) {
    return res.status(400).json({ error: "Bad Request: Invalid or missing 'amount'." });
  }

  try {
    const rechargeRes = await db.query("SELECT * FROM recharges WHERE id = $1", [id]);
    const recharge = rechargeRes.rows[0];

    if (!recharge) return res.status(404).json({ error: "Recharge not found" });
    if (recharge.status !== 'pending') return res.status(400).json({ error: "Recharge not pending" });

    const donorUserRes = await db.query("SELECT * FROM users WHERE telegram_id = $1 AND role = 'donor'", [recharge.donor_id]);
    const donorUser = donorUserRes.rows[0];

    if (!donorUser) return res.status(404).json({ error: "Donor not found" });

    const newBalance = Number(donorUser.balance || 0) + amount;

    await db.query("UPDATE users SET balance = $1 WHERE telegram_id = $2", [newBalance, recharge.donor_id]);
    await db.query("UPDATE recharges SET status = 'approved', amount = $1 WHERE id = $2", [amount, id]);

    try {
      if (bot) bot.sendMessage(donorUser.telegram_id, `✅ Your recharge of Br ${amount.toFixed(2)} was approved. New balance: Br ${newBalance.toFixed(2)}`, {
        reply_markup: { inline_keyboard: [[{ text: '💰 Send Donation', callback_data: 'quick_donate' }]] }
      });
    } catch (botError) {
      console.error("Error sending bot message for approved recharge:", botError);
    }

    return res.json({ success: true, balance: newBalance });
  } catch (error) {
    console.error("Error approving recharge:", error);
    res.status(500).json({ error: "Failed to approve recharge" });
  }
});

router.post("/recharges/:id/reject", async (req, res) => {
  const { id } = req.params;

  try {
    const rechargeRes = await db.query("SELECT * FROM recharges WHERE id = $1", [id]);
    const recharge = rechargeRes.rows[0];

    if (!recharge) return res.status(404).json({ error: "Recharge not found" });
    if (recharge.status !== 'pending') return res.status(400).json({ error: "Recharge not pending" });

    await db.query("UPDATE recharges SET status = 'rejected' WHERE id = $1", [id]);

    const donorUserRes = await db.query("SELECT telegram_id FROM users WHERE telegram_id = $1 AND role = 'donor'", [recharge.donor_id]);
    const donorUser = donorUserRes.rows[0];

    try {
      if (bot && donorUser) bot.sendMessage(donorUser.telegram_id, `❌ Your recharge was rejected.`);
    } catch (botError) {
      console.error("Error sending bot message for rejected recharge:", botError);
    }

    return res.json({ success: true });
  } catch (error) {
    console.error("Error rejecting recharge:", error);
    res.status(500).json({ error: "Failed to reject recharge" });
  }
});

router.get("/donations", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '100'), 500);

    const donationsRes = await db.query("SELECT id, streamer_id, donor_id, donor_name, amount, message, status, audio_file, created_at FROM donations WHERE status = 'paid' ORDER BY created_at DESC LIMIT $1", [limit]);
    const donations = donationsRes.rows;

    const usersRes = await db.query("SELECT telegram_id, username, display_name, role FROM users");
    const userMap = new Map(usersRes.rows.map(u => [u.telegram_id, u]));

    const list = donations.map(d => {
      const donorUser = userMap.get(d.donor_id);
      const streamerUser = userMap.get(d.streamer_id);
      return {
        id: d.id,
        streamer: { telegram_id: d.streamer_id, username: streamerUser?.username },
        donor: { telegram_id: d.donor_id, username: donorUser?.username, display_name: d.donor_name },
        text: d.message,
        amount: d.amount,
        status: d.status,
        audio_url: d.audio_file,
        created_at: d.created_at
      };
    });
    res.json({ donations: list });
  } catch (error) {
    console.error("Error fetching donations:", error);
    res.status(500).json({ error: "Failed to load donations data" });
  }
});

router.get("/raw-donations", async (req, res) => {
  try {
    const donationsRes = await db.query("SELECT id, streamer_id, donor_id, donor_name, amount, message, status, audio_file, created_at FROM donations ORDER BY created_at DESC LIMIT 20");
    res.json({ rawDonations: donationsRes.rows });
  } catch (error) {
    console.error("Error fetching raw donations:", error);
    res.status(500).json({ error: "Failed to load raw donations data" });
  }
});

router.get("/withdrawals", async (req, res) => {
  try {
    const withdrawalsRes = await db.query("SELECT id, user_id, amount, status, created_at, telebirr_username, phone_number FROM withdrawals ORDER BY created_at DESC");
    const withdrawals = withdrawalsRes.rows;

    const usersRes = await db.query("SELECT telegram_id, username, display_name FROM users WHERE role = 'streamer'");
    const userMap = new Map(usersRes.rows.map(u => [u.telegram_id, u]));

    const list = withdrawals.map(w => {
      const streamerUser = userMap.get(w.user_id);
      return {
        id: w.id,
        streamer_id: w.user_id,
        streamer_username: streamerUser?.username,
        amount: w.amount,
        status: w.status,
        created_at: w.created_at,
        telebirr_username: w.telebirr_username,
        phone_number: w.phone_number
      };
    });

    res.json({ withdrawals: list });
  } catch (error) {
    console.error("Error fetching withdrawals:", error);
    res.status(500).json({ error: "Failed to load withdrawals data" });
  }
});

router.post("/withdrawals/:id/approve", async (req, res) => {
  const { id } = req.params;

  try {
    const withdrawalRes = await db.query("SELECT * FROM withdrawals WHERE id = $1", [id]);
    const withdrawal = withdrawalRes.rows[0];

    if (!withdrawal) return res.status(404).json({ error: "Withdrawal not found" });
    if (withdrawal.status !== 'pending') return res.status(400).json({ error: "Withdrawal not pending" });

    const streamerUserRes = await db.query("SELECT * FROM users WHERE telegram_id = $1 AND role = 'streamer'", [withdrawal.user_id]);
    const streamerUser = streamerUserRes.rows[0];

    if (!streamerUser) return res.status(404).json({ error: "Streamer not found" });

    // Calculate balance
    const donationsRes = await db.query("SELECT amount FROM donations WHERE streamer_id = $1 AND status = 'paid'", [streamerUser.telegram_id]);
    const donations = donationsRes.rows;
    const totalEarned = donations.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

    const approvedWithdrawalsRes = await db.query("SELECT amount FROM withdrawals WHERE user_id = $1 AND status = 'approved'", [streamerUser.telegram_id]);
    const approvedWithdrawals = approvedWithdrawalsRes.rows;
    const totalWithdrawn = approvedWithdrawals.reduce((sum, w) => sum + (Number(w.amount) || 0), 0);

    const balance = totalEarned - totalWithdrawn;

    if (balance < withdrawal.amount) {
      await db.query("UPDATE withdrawals SET status = 'rejected' WHERE id = $1", [id]);
      try {
        if (bot) bot.sendMessage(streamerUser.telegram_id, `❌ Your withdrawal request of Br ${withdrawal.amount.toFixed(2)} was rejected due to insufficient balance.`);
      } catch (botError) {
        console.error("Error sending bot message for rejected withdrawal (insufficient balance):", botError);
      }
      return res.status(400).json({ error: "Insufficient balance" });
    }

    // Deduct amount from streamer's balance
    const newBalance = balance - withdrawal.amount;
    await db.query("UPDATE users SET balance = $1 WHERE telegram_id = $2", [newBalance, streamerUser.telegram_id]);
    await db.query("UPDATE withdrawals SET status = 'approved' WHERE id = $1", [id]);

    console.log("Admin approval: withdrawal.streamer_id =", withdrawal.user_id, "found streamer =", !!streamerUser);

    if (global.socketIO && streamerUser) {
      global.socketIO.to(streamerUser.link_uuid).emit("withdrawal_approved", {
        message: `Your withdrawal of Br ${withdrawal.amount.toFixed(2)} was approved. New balance: Br ${newBalance.toFixed(2)}.`, // Assuming telegram_id is used as link_uuid for socket rooms
        streamer_id: streamerUser.telegram_id,
        newBalance,
      });
      console.log("📢 Emitted withdrawal_approved to:", streamerUser.link_uuid);
    } else {
      console.log("❌ Could not emit withdrawal_approved event: global.socketIO =", !!global.socketIO, "streamer =", !!streamerUser);
    }

    try {
      if (bot) {
        const payoutAmount = (withdrawal.amount * 0.6).toFixed(2);
        const message = `✅ Your withdrawal of Br ${withdrawal.amount.toFixed(2)} was approved.\n\nYou will receive Br ${payoutAmount} (60% payout).\n\nNew balance: Br ${newBalance.toFixed(2)}.`;
        bot.sendMessage(streamerUser.telegram_id, message);
      }
    } catch (botError) {
      console.error("Error sending bot message for approved withdrawal:", botError);
    }

    return res.json({ success: true, newBalance });
  } catch (error) {
    console.error("Error approving withdrawal:", error);
    res.status(500).json({ error: "Failed to approve withdrawal" });
  }
});
router.post("/withdrawals/:id/reject", async (req, res) => {
  const { id } = req.params;

  try {
    const withdrawalRes = await db.query("SELECT * FROM withdrawals WHERE id = $1", [id]);
    const withdrawal = withdrawalRes.rows[0];

    if (!withdrawal) return res.status(404).json({ error: "Withdrawal not found" });
    if (withdrawal.status !== 'pending') return res.status(400).json({ error: "Withdrawal not pending" });

    await db.query("UPDATE withdrawals SET status = 'rejected' WHERE id = $1", [id]);

    const streamerUserRes = await db.query("SELECT telegram_id FROM users WHERE telegram_id = $1 AND role = 'streamer'", [withdrawal.user_id]);
    const streamerUser = streamerUserRes.rows[0];

    try {
      if (bot && streamerUser) bot.sendMessage(streamerUser.telegram_id, `❌ Your withdrawal request of Br ${withdrawal.amount.toFixed(2)} was rejected.`);
    } catch (botError) {
      console.error("Error sending bot message for rejected withdrawal:", botError);
    }

    return res.json({ success: true });
  } catch (error) {
    console.error("Error rejecting withdrawal:", error);
    res.status(500).json({ error: "Failed to reject withdrawal" });
  }
});

// Settings endpoints
router.get('/settings', async (req, res) => {
  try {
    const settingsRes = await db.query("SELECT key, value FROM settings");
    const settings = {};
    settingsRes.rows.forEach(row => {
      try {
        if (row.key === 'filteredWords') {
          try {
            const arr = JSON.parse(row.value);
            settings[row.key] = Array.isArray(arr) ? arr : [];
          } catch { settings[row.key] = []; }
        } else {
          settings[row.key] = row.value;
        }
      } catch (e) {
        settings[row.key] = row.value; // Fallback to raw value if JSON parsing fails
      }
    });
    // Ensure filteredWords is always an array for the frontend
    if (!Array.isArray(settings.filteredWords)) {
      settings.filteredWords = [];
    }
    res.json({ settings });
  } catch (error) {
    console.error("Error fetching settings:", error);
    res.status(500).json({ error: "Failed to load settings" });
  }
});

router.post('/settings', express.json(), async (req, res) => {
  const allowed = ['maxChars', 'stepChars', 'basePrice', 'incrementPrice', 'filteredWords'];
  
  // --- Input Validation ---
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      if (key === 'filteredWords') {
        if (!Array.isArray(req.body[key])) {
          return res.status(400).json({ error: `Bad Request: '${key}' must be an array.` });
        }
        // No numeric validation for filteredWords
      } else {
        const value = Number(req.body[key]);
        if (isNaN(value) || value < 0) {
          return res.status(400).json({ error: `Bad Request: Invalid value for '${key}'. Must be a non-negative number.` });
        }
      }
    }
  }

  try {
    for (const k of allowed) {
      if (req.body[k] !== undefined) {
        let valueToSave = req.body[k];
        if (k === 'filteredWords') {
          // Ensure it's an array of strings and stringify it
          if (!Array.isArray(valueToSave)) {
            return res.status(400).json({ error: `Bad Request: 'filteredWords' must be an array.` });
          }
          valueToSave = JSON.stringify(Array.from(new Set(valueToSave.map(s => String(s))
            .map(s => s.normalize('NFC').trim().toLowerCase())
            .filter(s => s.length > 0))));
        } else {
          valueToSave = String(valueToSave);
        }
        await db.query("INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2", [k, valueToSave]);
      }
    }

    // Fetch all settings to return the complete, updated set
    const settingsRes = await db.query("SELECT key, value FROM settings");
    const currentSettings = settingsRes.rows.reduce((acc, row) => {
      try {
        if (row.key === 'filteredWords') {
          try {
            const arr = JSON.parse(row.value);
            acc[row.key] = Array.isArray(arr) ? arr : [];
          } catch { acc[row.key] = []; }
        } else {
          acc[row.key] = row.value;
        }
      } catch (e) {
        acc[row.key] = row.value; // Fallback to raw value if JSON parsing fails
      }
      return acc;
    }, {});

    // Notify the bot to reload settings
    try {
      await reloadSettings();
      console.log("📢 Bot settings reloaded.");
    } catch (e) {
      console.warn("⚠️ Could not reload bot settings immediately:", e?.message || e);
    }
    res.json({ success: true, settings: currentSettings });
  } catch (error) {
    console.error("Error updating settings:", error);
    res.status(500).json({ error: "Failed to update settings" });
  }
});

router.get("/streamer-donations/:telegram_id", async (req, res) => {
  try {
    const { telegram_id } = req.params;
    const donationsRes = await db.query("SELECT id, streamer_id, donor_id, donor_name, amount, message, status, created_at FROM donations WHERE streamer_id = $1 ORDER BY created_at DESC", [telegram_id]);
    res.json({ donations: donationsRes.rows });
  } catch (error) {
    console.error("Error fetching streamer donations:", error);
    res.status(500).json({ error: "Failed to load streamer donations" });
  }
});

router.get("/complaints", async (req, res) => {
  try {
    const complaintsRes = await db.query("SELECT id, telegram_id, complaint, created_at, responded FROM complaints ORDER BY created_at DESC");
    res.json(complaintsRes.rows);
  } catch (error) {
    console.error("Error fetching complaints:", error);
    res.status(500).json({ error: "Failed to load complaints" });
  }
});

router.get("/complaints/pending-count", async (req, res) => {
  try {
    const countRes = await db.query("SELECT COUNT(*) FROM complaints WHERE responded = FALSE");
    res.json({ count: parseInt(countRes.rows[0].count, 10) });
  } catch (error) {
    console.error("Error fetching pending complaints count:", error);
    res.status(500).json({ error: "Failed to load pending complaints count" });
  }
});

router.post("/complaints/:id/respond", express.json(), async (req, res) => {
  const { id } = req.params;
  const { message } = req.body;

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'A non-empty message is required.' });
  }

  try {
    const complaintRes = await db.query("SELECT telegram_id FROM complaints WHERE id = $1", [id]);
    const complaint = complaintRes.rows[0];

    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found.' });
    }

    if (bot) {
      await bot.sendMessage(complaint.telegram_id, `Admin Response:\n\n${message}`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '💰 Send Another Donation', callback_data: 'quick_donate' }]
          ]
        }
      });
      await db.query("UPDATE complaints SET responded = TRUE WHERE id = $1", [id]);
      res.json({ success: true, message: 'Response sent successfully.' });
    } else {
      throw new Error('Bot is not initialized.');
    }
  } catch (error) {
    console.error("Error sending complaint response:", error);
    res.status(500).json({ error: "Failed to send response." });
  }
});

export default router;
