import express from "express";
import { z } from "zod";
import db from "../db-postgres.js";
import { generateTTS } from "../../bot/utils/tts.js";
import { insertLedgerEntry } from "../utils/balance.js";
import { emitAdminEvent } from "../utils/adminNotifications.js";
import { validateSchema } from "../middleware/validateSchema.js";

const router = express.Router();

const confirmDonationSchema = z.object({
  donationId: z.coerce.number().int().positive("donationId must be a positive integer"),
});

const mockPaymentSchema = z.object({
  donor_id: z.coerce.number().int().positive("donor_id must be a positive integer"),
  streamer_id: z.coerce.number().int().positive("streamer_id must be a positive integer"),
  amount: z.coerce.number().positive("amount must be greater than zero"),
  text: z.string().trim().min(1, "text is required").max(800, "text is too long"),
});

// Demo payment page (HTML)
router.get("/mock-pay", (req, res) => {
  const { donationId } = req.query;
  res.send(`
    <html>
      <body style="font-family: sans-serif; text-align: center; margin-top: 5rem;">
        <h1>💸 Demo Payment Page</h1>
        <p>Donation ID: ${donationId}</p>
        <form action="/api/payment/confirm" method="POST">
          <input type="hidden" name="donationId" value="${donationId}" />
          <button type="submit" style="padding: 10px 20px; font-size: 16px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">Pay $5 (demo)</button>
        </form>
      </body>
    </html>
  `);
});

router.post(
  "/confirm",
  express.urlencoded({ extended: true }),
  validateSchema(confirmDonationSchema),
  async (req, res) => {
    const { donationId } = req.body;

    const io = req.app.get("io");
    console.log(`[Payment Confirm] Received request for donationId: ${donationId}`);

    try {
      // Get donation details
      const donationRes = await db.query(`
        SELECT d.id, d.donor_id, d.streamer_id, d.message AS text, d.amount, d.status, d.audio_file, d.played, d.created_at,
               u_donor.username AS donor_username, u_streamer.link_uuid
        FROM donations d
        LEFT JOIN users u_donor ON u_donor.telegram_id = d.donor_id
        LEFT JOIN users u_streamer ON u_streamer.telegram_id = d.streamer_id
        WHERE d.id = $1
      `, [donationId]);
      const donation = donationRes.rows[0];
      console.log("[Payment Confirm] Donation fetched:", donation);

     if (!donation) {
       console.error(`[Payment Confirm] Donation not found for ID: ${donationId}`);
       return res.status(404).send("<h2>❌ Donation not found</h2>");
     }

     if (!donation.link_uuid) {
       console.error("❌ Donation has invalid streamer_id - no link_uuid found");
       return res.status(400).send("<h2>❌ Invalid donation - streamer not found</h2>");
     }

     const streamer = { link_uuid: donation.link_uuid }; // Extract for socket emission
     const donorName = donation.donor_name || donation.donor_username || "ልጋስ ደንበኛ";
     console.log(`[Payment Confirm] Donor Name: ${donorName}, Streamer Link UUID: ${streamer.link_uuid}`);

     // Generate TTS audio including donor display name and amount
     const amt = Number(donation.amount || 5);
     const amountWords = (global.amharicNumberToWords || ((n)=>String(n)))(amt);
     const spokenText = `<speak>${donorName} የ ብር መጠን ${amountWords} ሰጥቶህ እንዲህ አለህ <break time=\"1s\"/> ${donation.text}</speak>`;
     console.log(`[Payment Confirm] Spoken Text: ${spokenText}`);

     const audioFile = await generateTTS(donationId, spokenText);
     console.log(`[Payment Confirm] Audio file generated: ${audioFile}`);
    
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      await client.query(
        "UPDATE donations SET status='paid', amount=$1, audio_file=$2 WHERE id=$3",
        [amt, audioFile, donationId]
      );

      await insertLedgerEntry({
        client,
        userTelegramId: donation.streamer_id,
        refType: 'donation',
        refId: donation.id,
        entryType: 'credit',
        amount: amt,
        description: `Donation ${donation.id} paid`,
        createdAt: donation.created_at,
        idempotencyKey: `donation:${donation.id}:credit`,
      });

      await client.query('COMMIT');
      console.log(`[Payment Confirm] Donation ${donationId} status updated to 'paid'.`);
    } catch (dbError) {
      await client.query('ROLLBACK');
      console.error("[Payment Confirm] Transaction failed:", dbError);
      return res.status(500).send("<h2>❌ Database update failed</h2>");
    } finally {
      client.release();
    }

    // Prepare donation data for real-time emission
    const donationData = {
      id: donation.id,
      donor_name: donorName,
      text: donation.text,
      amount: amt,
      audio_url: audioFile,
      status: "paid",
      created_at: new Date().toISOString()
    };
    console.log("[Payment Confirm] Donation data for emission:", donationData);

     // Emit real-time event to streamer\'s room
     if (io && streamer) {
       io.to(streamer.link_uuid).emit("new_donation", donationData);
       io.to('admin').emit('new_donation', donationData);
       console.log("📢 Emitted new_donation to:", streamer.link_uuid);
     } else {
       console.warn("[Payment Confirm] Socket.IO or streamer not available for emission.");
     }

      emitAdminEvent('donation_paid', {
        donationId: donation.id,
        streamerId: donation.streamer_id,
        amount: amt,
        donorName,
      });

    // Notify donor via Telegram (best effort)
    try {
      const { bot } = await import('../../bot/bot.js');
      console.log(`[Payment Confirm] Attempting Telegram confirmation: bot=${!!bot}, donor_id=${donation.donor_id}`);
      if (bot && donation.donor_id) {
        await bot.sendMessage(String(donation.donor_id), `✅ Payment successful! Your donation of Br ${amt.toFixed(2)} has been sent.`);
        console.log(`[Payment Confirm] Telegram confirmation sent to donor ${donation.donor_id}`);
      } else {
        console.warn('[Payment Confirm] Skipping Telegram confirmation (bot or donor_id missing).');
      }
    } catch (notifyErr) {
      console.error('[Payment Confirm] Failed to send Telegram confirmation:', notifyErr?.response?.body || notifyErr?.message || notifyErr);
    }

    res.send(`
      <html>
        <body style="font-family: sans-serif; text-align: center; margin-top: 5rem;">
          <h2>✅ Payment successful (demo)</h2>
          <p>Audio generation completed!</p>
          <p>The streamer will hear your message automatically.</p>
          <a href="javascript:window.close()">Close this window</a>
        </body>
      </html>
    `);
    } catch (error) {
      console.error("Payment confirmation error:", error);
      res.status(500).send("<h2>❌ Payment processing failed</h2>");
    }
  }
);

// API endpoint for mock payments (for testing)
router.post(
  "/mock",
  express.json(),
  validateSchema(mockPaymentSchema),
  async (req, res) => {
    const { donor_id, streamer_id, amount, text } = req.body;

    const io = req.app.get("io");
    console.log("Mock payment request body:", req.body);

    try {
      const insertRes = await db.query(
        "INSERT INTO donations (donor_id, streamer_id, amount, message, status) VALUES ($1, $2, $3, $4, 'paid') RETURNING id",
        [donor_id, streamer_id, amount, text]
      );
      const donationId = insertRes.rows[0].id;

      // Generate TTS
      const spokenText = `<speak>${text}</speak>`;
      let audioFile;
      try {
        audioFile = await generateTTS(donationId, spokenText);
      } catch (ttsError) {
        console.error("❌ TTS failed, using demo audio:", ttsError.message);
        audioFile = "demo_audio.mp3";
      }
      await db.query("UPDATE donations SET audio_file = $1 WHERE id = $2", [audioFile, donationId]);

      // Get streamer UUID to emit event to their room
      const streamerRes = await db.query("SELECT link_uuid FROM users WHERE telegram_id = $1 AND role = 'streamer'", [streamer_id]);
      const streamer = streamerRes.rows[0];

      if (!streamer) {
        console.error("❌ Streamer not found for ID:", streamer_id);
        return res.status(400).json({ error: "Invalid streamer ID" });
      }

      // Prepare donation data for emission
      const donationData = {
        id: donationId,
        text,
        amount,
        audio_url: audioFile,
        status: "paid",
      };

      // Emit real-time event
      console.log("🔍 Debug mock: io =", io, "streamer =", streamer);
      if (io && streamer) {
        try {
          io.to(streamer.link_uuid).emit("new_donation", donationData);
          console.log("📢 Emitted new_donation to:", streamer.link_uuid);
        } catch (emitError) {
          console.error("❌ Socket.IO emit failed:", emitError);
        }
      } else {
        console.log("❌ Could not emit Socket.IO event: io =", !!io, "streamer =", !!streamer);
      }

      emitAdminEvent('donation_paid', {
        donationId,
        streamerId: streamer_id,
        amount,
        donorName: null,
      });

      res.json({ success: true, donationId, audioFile });
    } catch (error) {
      console.error("Mock payment error:", error);
      console.error("Error stack:", error.stack);
      res.status(500).json({ error: "Payment processing failed" });
    }
  }
);

export default router;