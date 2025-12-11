# PROTOTYPE TECHNICAL OVERVIEW

---

<div align="center">

# 🎙️ HabeshaTTS

## Technical Prototype Documentation

### AI-Powered Real-Time Text-to-Speech Donation Platform

---

**Version:** 1.0  
**Status:** Production-Ready Prototype  
**Last Updated:** December 2025

</div>

---

## 1. Product Overview

### What is HabeshaTTS?

HabeshaTTS is a complete donation platform that enables fans to send **spoken Amharic messages** to their favorite streamers during live broadcasts. The platform uses **Google Cloud's AI Text-to-Speech** technology to convert text donations into natural-sounding Amharic speech in real-time.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        USER JOURNEY                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   DONOR                          PLATFORM                 STREAMER   │
│   ──────                         ────────                 ────────   │
│                                                                      │
│   📱 Opens Telegram     ───▶    🤖 Bot Interaction                   │
│   💬 Types message      ───▶    🔄 Queue Processing                  │
│   💰 Confirms payment   ───▶    🎙️ AI TTS Generation   ───▶  🔊 Plays│
│   ✅ Gets confirmation  ◀───    📺 Real-time Update    ───▶  📊 Sees │
│                                                                      │
│   Total Time: < 3 seconds from send to playback                     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. System Architecture

### High-Level Architecture

```
╔═══════════════════════════════════════════════════════════════════════╗
║                    HABESHATTS SYSTEM ARCHITECTURE                      ║
╠═══════════════════════════════════════════════════════════════════════╣
║                                                                        ║
║  ┌─────────────────┐                         ┌─────────────────────┐  ║
║  │    TELEGRAM     │                         │   REACT FRONTEND    │  ║
║  │      BOT        │                         │                     │  ║
║  │  ─────────────  │                         │  • Streamer Page    │  ║
║  │  • /start       │                         │  • Admin Dashboard  │  ║
║  │  • /donate      │                         │  • Landing Page     │  ║
║  │  • /recharge    │                         │  • Withdraw Page    │  ║
║  │  • /balance     │                         │                     │  ║
║  └────────┬────────┘                         └──────────┬──────────┘  ║
║           │                                             │              ║
║           │  Telegram API                    Socket.IO + REST API     ║
║           │                                             │              ║
║           ▼                                             ▼              ║
║  ╔════════════════════════════════════════════════════════════════╗   ║
║  ║                     NODE.JS BACKEND                             ║   ║
║  ║  ┌──────────────────────────────────────────────────────────┐  ║   ║
║  ║  │                    EXPRESS.JS API                         │  ║   ║
║  ║  │  ┌────────────┐ ┌────────────┐ ┌────────────────────────┐│  ║   ║
║  ║  │  │   Admin    │ │  Streamer  │ │       Payment          ││  ║   ║
║  ║  │  │   Routes   │ │   Routes   │ │       Routes           ││  ║   ║
║  ║  │  └────────────┘ └────────────┘ └────────────────────────┘│  ║   ║
║  ║  └──────────────────────────────────────────────────────────┘  ║   ║
║  ║                              │                                  ║   ║
║  ║  ┌──────────────┐   ┌───────▼────────┐   ┌──────────────────┐  ║   ║
║  ║  │  SOCKET.IO   │   │    BullMQ      │   │    UTILITIES     │  ║   ║
║  ║  │  ──────────  │   │    Queue       │   │    ──────────    │  ║   ║
║  ║  │  Real-time   │   │  ────────────  │   │  • Balance       │  ║   ║
║  ║  │  Events      │   │  TTS Worker    │   │  • Ledger        │  ║   ║
║  ║  │              │   │  Job Processor │   │  • Live Status   │  ║   ║
║  ║  └──────────────┘   └───────┬────────┘   └──────────────────┘  ║   ║
║  ╚═════════════════════════════│══════════════════════════════════╝   ║
║                                │                                       ║
║           ┌────────────────────┼────────────────────┐                 ║
║           │                    │                    │                 ║
║           ▼                    ▼                    ▼                 ║
║  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐   ║
║  │   POSTGRESQL    │  │     REDIS       │  │   GOOGLE CLOUD      │   ║
║  │   ───────────   │  │   ─────────     │  │   TEXT-TO-SPEECH    │   ║
║  │   • Users       │  │   • Job Queue   │  │   ───────────────   │   ║
║  │   • Donations   │  │   • Bot State   │  │   • am-ET Voices    │   ║
║  │   • Ledger      │  │   • Cache       │  │   • Audio Output    │   ║
║  │   • Recharges   │  │   • Locks       │  │                     │   ║
║  └─────────────────┘  └─────────────────┘  └─────────────────────┘   ║
║                                                                        ║
╚═══════════════════════════════════════════════════════════════════════╝
```

### Component Responsibilities

| Component | Technology | Responsibility |
|-----------|------------|----------------|
| **Telegram Bot** | node-telegram-bot-api | User registration, donations, payments, support |
| **Backend API** | Express.js | REST endpoints, authentication, business logic |
| **Real-time Engine** | Socket.IO | Live donation updates, streamer status |
| **Queue System** | BullMQ + Redis | TTS job processing, async operations |
| **Database** | PostgreSQL | Persistent data storage, transactions |
| **Cache/State** | Redis | Bot state machine, session data |
| **TTS Engine** | Google Cloud TTS | Amharic speech synthesis |
| **Frontend** | React + Vite | Dashboards, admin panel |

---

## 3. Core Features Demonstration

### 3.1 Telegram Bot Interface

```
┌────────────────────────────────────────────────────────────────┐
│                    TELEGRAM BOT FLOWS                           │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  👤 NEW USER REGISTRATION                                      │
│  ─────────────────────────────────────────────────────────────  │
│  User: /start                                                   │
│  Bot:  "እንኳን ደህና መጡ! Welcome to HabeshaTTS..."               │
│        [👤 Register as Donor] [🎙️ Register as Streamer]        │
│                                                                 │
│  💸 DONATION FLOW                                              │
│  ─────────────────────────────────────────────────────────────  │
│  User: /donate                                                  │
│  Bot:  "Select a streamer:"                                    │
│        [🎮 EZHUU] [🎵 MusicLive] [🎬 GameMaster]               │
│  User: [Selects EZHUU]                                         │
│  Bot:  "Enter your message (in Amharic):"                      │
│  User: "ሰላም! ጨዋታህ በጣም ጥሩ ነው!"                               │
│  Bot:  "Select voice: [Male] [Female]"                         │
│  Bot:  "Confirm: 50 ETB will be deducted"                      │
│        [✅ Confirm] [❌ Cancel]                                 │
│  User: [Confirms]                                              │
│  Bot:  "✅ Donation sent! Your message will play shortly."     │
│                                                                 │
│  💰 RECHARGE FLOW                                              │
│  ─────────────────────────────────────────────────────────────  │
│  User: /recharge                                               │
│  Bot:  "Select amount: [50] [100] [200] [500] [Custom]"        │
│  User: [100 ETB]                                               │
│  Bot:  "Upload payment screenshot:"                            │
│  User: [Uploads image]                                         │
│  Bot:  "✅ Recharge submitted! Pending admin review."          │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

### 3.2 Streamer Dashboard

```
┌─────────────────────────────────────────────────────────────────────┐
│  🎙️ STREAMER DASHBOARD                                    [Go Live] │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  💰 BALANCE: 2,450 ETB                        [Withdraw]     │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  📥 DONATION QUEUE                                           │   │
│  │  ────────────────────────────────────────────────────────────│   │
│  │  │ ▶ NOW PLAYING                                            ││   │
│  │  │ ┌────────────────────────────────────────────────────┐   ││   │
│  │  │ │ 👤 Abebe M.                         💰 50 ETB      │   ││   │
│  │  │ │ "ሰላም! ጨዋታህ በጣም ጥሩ ነው!"                          │   ││   │
│  │  │ │ [▶️ Playing...━━━━━━━━━━━━━━━━━━━━ 0:03/0:05]      │   ││   │
│  │  │ └────────────────────────────────────────────────────┘   ││   │
│  │  │                                                          ││   │
│  │  │ ⏳ UP NEXT                                               ││   │
│  │  │ ┌────────────────────────────────────────────────────┐   ││   │
│  │  │ │ 👤 Tigist K.                        💰 100 ETB     │   ││   │
│  │  │ │ "እንኳን ደስ ያለህ! ብዙ ሰብስክራይበር..."                   │   ││   │
│  │  │ └────────────────────────────────────────────────────┘   ││   │
│  │  │ ┌────────────────────────────────────────────────────┐   ││   │
│  │  │ │ 👤 Dawit T.                         💰 75 ETB      │   ││   │
│  │  │ │ "ከአሜሪካ ነኝ! አድናቂህ ነኝ!"                            │   ││   │
│  │  │ └────────────────────────────────────────────────────┘   ││   │
│  │  └──────────────────────────────────────────────────────────┘   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  📊 TODAY'S STATS                                            │   │
│  │  ────────────────────────────────────────────────────────────│   │
│  │  │ Donations: 24        │ Revenue: 1,850 ETB                ││   │
│  │  │ Avg Amount: 77 ETB   │ Peak Hour: 8 PM                   ││   │
│  │  └──────────────────────────────────────────────────────────┘   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.3 Admin Dashboard

```
┌─────────────────────────────────────────────────────────────────────┐
│  🛡️ ADMIN DASHBOARD                                                │
├─────────────────────────────────────────────────────────────────────┤
│  [Overview] [Streamers] [Recharges] [Withdrawals] [Flags] [Users]   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  📊 PLATFORM OVERVIEW                                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐               │
│  │ Streamers│ │  Donors  │ │ Today's  │ │  Pending │               │
│  │    42    │ │   1,234  │ │   456    │ │    12    │               │
│  │  Active  │ │ Verified │ │Donations │ │ Recharges│               │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘               │
│                                                                      │
│  💳 PENDING RECHARGES                                               │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ ID   │ User      │ Amount  │ Screenshot  │ Actions           │   │
│  │──────│───────────│─────────│─────────────│───────────────────│   │
│  │ #451 │ Abebe M.  │ 100 ETB │ [View 🖼️]   │ [✅ Approve] [❌] │   │
│  │ #450 │ Sara K.   │ 200 ETB │ [View 🖼️]   │ [✅ Approve] [❌] │   │
│  │ #449 │ Dawit T.  │ 500 ETB │ [View 🖼️]   │ [✅ Approve] [❌] │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  🚩 FLAGGED DONORS                                                  │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ Donor     │ Flagged By  │ Reason       │ Action              │   │
│  │───────────│─────────────│──────────────│─────────────────────│   │
│  │ User_123  │ EZHUU       │ Spam messages│ [Ban] [Warn] [Skip] │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. Technical Implementation Details

### 4.1 Real-Time Data Flow

```
┌────────────────────────────────────────────────────────────────────────┐
│                    DONATION PROCESSING PIPELINE                         │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. DONATION SUBMISSION                                                 │
│  ───────────────────────────────────────────────────────────────────   │
│                                                                         │
│  [Telegram Bot]                                                         │
│       │                                                                 │
│       │  User confirms donation                                         │
│       ▼                                                                 │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  const job = await ttsQueue.add('tts-generation', {              │   │
│  │    donationId: 12345,                                            │   │
│  │    spokenText: "ሰላም! ጨዋታህ በጣም ጥሩ ነው!",                        │   │
│  │    engine: 'cloud',                                              │   │
│  │    voice: 'am-ET-Wavenet-A',                                     │   │
│  │    streamer_id: '987654321',                                     │   │
│  │    link_uuid: 'abc123-def456'                                    │   │
│  │  });                                                              │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│       │                                                                 │
│       ▼                                                                 │
│  2. QUEUE PROCESSING (BullMQ Worker)                                   │
│  ───────────────────────────────────────────────────────────────────   │
│                                                                         │
│  [Redis Queue] ──▶ [Worker Process]                                    │
│       │                  │                                              │
│       │                  │  Generate TTS Audio                          │
│       │                  ▼                                              │
│       │            ┌──────────────────────────┐                        │
│       │            │  Google Cloud TTS API    │                        │
│       │            │  ──────────────────────  │                        │
│       │            │  Input: Amharic text     │                        │
│       │            │  Voice: am-ET-Wavenet-A  │                        │
│       │            │  Output: MP3 audio       │                        │
│       │            └──────────────────────────┘                        │
│       │                  │                                              │
│       │                  ▼                                              │
│       │            Save audio file to /public/audios/                  │
│       │                  │                                              │
│       ▼                  ▼                                              │
│  3. DATABASE UPDATE + REAL-TIME BROADCAST                              │
│  ───────────────────────────────────────────────────────────────────   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  // Update database                                               │   │
│  │  await db.query(                                                  │   │
│  │    "UPDATE donations SET status='paid', audio_file=$1 WHERE id=$2"│   │
│  │  );                                                               │   │
│  │                                                                    │   │
│  │  // Broadcast to streamer dashboard                               │   │
│  │  io.to(link_uuid).emit('new_donation', {                         │   │
│  │    id: donationId,                                                │   │
│  │    donor_name: 'Abebe M.',                                        │   │
│  │    text: 'ሰላም! ጨዋታህ በጣም ጥሩ ነው!',                               │   │
│  │    audio_url: '/audios/12345.mp3',                                │   │
│  │    amount: 50                                                      │   │
│  │  });                                                               │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│       │                                                                 │
│       ▼                                                                 │
│  4. STREAMER DASHBOARD                                                 │
│  ───────────────────────────────────────────────────────────────────   │
│                                                                         │
│  [React Frontend]                                                       │
│       │                                                                 │
│       │  socket.on('new_donation', (data) => {                         │
│       │    addToQueue(data);                                           │
│       │    playAudio(data.audio_url);                                  │
│       │  });                                                            │
│       ▼                                                                 │
│  🔊 Audio plays through OBS/stream                                     │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Bot State Machine

```
┌────────────────────────────────────────────────────────────────────────┐
│                    BOT STATE MACHINE (Redis-backed)                     │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  STREAMER REGISTRATION FLOW                                            │
│  ═══════════════════════════                                           │
│                                                                         │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐             │
│  │    START     │───▶│  FULL NAME   │───▶│ SOCIAL LINK  │             │
│  │              │    │              │    │              │             │
│  │ /register    │    │ "Enter your  │    │ "Enter your  │             │
│  │ _streamer    │    │  full name"  │    │ TikTok/YT"   │             │
│  └──────────────┘    └──────────────┘    └──────────────┘             │
│                                                 │                       │
│                                                 ▼                       │
│                      ┌──────────────┐    ┌──────────────┐             │
│                      │   COMPLETE   │◀───│ PHONE NUMBER │             │
│                      │              │    │              │             │
│                      │ "Application │    │ "Enter phone │             │
│                      │  submitted!" │    │  2519..."    │             │
│                      └──────────────┘    └──────────────┘             │
│                                                                         │
│  DONATION FLOW                                                         │
│  ═════════════                                                         │
│                                                                         │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐             │
│  │   /donate    │───▶│   SELECT     │───▶│   ENTER      │             │
│  │              │    │   STREAMER   │    │   MESSAGE    │             │
│  └──────────────┘    └──────────────┘    └──────────────┘             │
│                                                 │                       │
│                                                 ▼                       │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐             │
│  │   SUCCESS    │◀───│   CONFIRM    │◀───│   SELECT     │             │
│  │              │    │   PAYMENT    │    │   VOICE      │             │
│  │ "Donation    │    │              │    │              │             │
│  │  sent!"      │    │ "Confirm 50  │    │ [Male]       │             │
│  │              │    │  ETB?"       │    │ [Female]     │             │
│  └──────────────┘    └──────────────┘    └──────────────┘             │
│                                                                         │
│  STATE STORAGE (Redis)                                                 │
│  ═════════════════════                                                 │
│                                                                         │
│  Key: bot:state:user:123456789                                         │
│  Value: {                                                               │
│    "step": "awaiting_donation_message",                                │
│    "streamer_id": "987654321",                                         │
│    "selected_voice": "am-ET-Wavenet-A",                                │
│    "ttl": 1800                                                          │
│  }                                                                      │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
```

### 4.3 Database Schema (Key Tables)

```
┌────────────────────────────────────────────────────────────────────────┐
│                        DATABASE SCHEMA                                  │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  USERS TABLE                                                           │
│  ══════════════════════════════════════════════════════════════════   │
│  │ telegram_id (PK) │ role     │ display_name │ balance │ live_status │ │
│  │──────────────────│──────────│──────────────│─────────│─────────────│ │
│  │ 123456789        │ donor    │ Abebe M.     │ 450     │ NULL        │ │
│  │ 987654321        │ streamer │ EZHUU        │ 12500   │ true        │ │
│  │ 111222333        │ admin    │ Admin        │ 0       │ NULL        │ │
│                                                                         │
│  DONATIONS TABLE                                                       │
│  ══════════════════════════════════════════════════════════════════   │
│  │ id (PK) │ donor_id  │ streamer_id │ message  │ amount │ audio_file │ │
│  │─────────│───────────│─────────────│──────────│────────│────────────│ │
│  │ 12345   │ 123456789 │ 987654321   │ "ሰላም!"  │ 50     │ 12345.mp3  │ │
│                                                                         │
│  RECHARGES TABLE                                                       │
│  ══════════════════════════════════════════════════════════════════   │
│  │ id │ user_id   │ amount │ status   │ screenshot_url │ reviewed_by │ │
│  │────│───────────│────────│──────────│────────────────│─────────────│ │
│  │ 99 │ 123456789 │ 100    │ approved │ /uploads/99.jpg│ admin_001   │ │
│                                                                         │
│  LEDGER_ENTRIES TABLE (Financial Audit Trail)                          │
│  ══════════════════════════════════════════════════════════════════   │
│  │ id │ user_id   │ type      │ amount │ balance_after │ reference   │ │
│  │────│───────────│───────────│────────│───────────────│─────────────│ │
│  │ 1  │ 123456789 │ recharge  │ +100   │ 550           │ recharge#99 │ │
│  │ 2  │ 123456789 │ donation  │ -50    │ 500           │ donation#1  │ │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 5. API Endpoints

### Authentication

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/streamer/:uuid/login` | POST | None | OTP login for streamers |
| `/api/admin/*` | ALL | `x-admin-token` header | All admin operations |
| `/api/streamer/:uuid/*` | ALL | Bearer token | Streamer operations |

### Key Endpoints

```
┌────────────────────────────────────────────────────────────────────────┐
│                          API ENDPOINTS                                  │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ADMIN ROUTES (/api/admin)                                             │
│  ─────────────────────────────────────────────────────────────────────  │
│  GET    /streamers          List all streamers with stats              │
│  POST   /streamers          Create new streamer                        │
│  DELETE /streamers/:id      Remove streamer                            │
│  PUT    /streamers/order    Reorder streamer display                   │
│  GET    /recharges          List pending recharges                     │
│  POST   /recharges/:id      Approve/reject recharge                    │
│  GET    /withdrawals        List withdrawal requests                   │
│  POST   /withdrawals/:id    Process withdrawal                         │
│  GET    /donations          Platform-wide donation list                │
│  GET    /flags              Flagged donor reports                      │
│  POST   /users/:id/ban      Ban a donor                                │
│                                                                         │
│  STREAMER ROUTES (/api/streamer/:uuid)                                 │
│  ─────────────────────────────────────────────────────────────────────  │
│  GET    /donations          Get streamer's donation queue              │
│  POST   /donations/:id/play Mark donation as played                    │
│  GET    /balance            Get current balance                        │
│  POST   /withdraw           Request withdrawal                         │
│  POST   /go-live            Set live status                            │
│  POST   /flag-donor         Report problematic donor                   │
│                                                                         │
│  PAYMENT ROUTES (/api/payment)                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│  POST   /donate             Submit new donation                        │
│  POST   /recharge           Request balance recharge                   │
│  GET    /balance/:userId    Check user balance                         │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Security Measures

```
┌────────────────────────────────────────────────────────────────────────┐
│                       SECURITY IMPLEMENTATION                           │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  🔐 AUTHENTICATION                                                     │
│  ─────────────────────────────────────────────────────────────────────  │
│  • Admin: Secure token-based authentication (x-admin-token header)     │
│  • Streamers: OTP-based login via Telegram                             │
│  • API Keys: Unique per-streamer for dashboard access                  │
│                                                                         │
│  🛡️ AUTHORIZATION                                                      │
│  ─────────────────────────────────────────────────────────────────────  │
│  • Role-based access control (donor, streamer, admin)                  │
│  • Route-level middleware protection                                   │
│  • UUID-based streamer isolation                                       │
│                                                                         │
│  🚦 RATE LIMITING                                                      │
│  ─────────────────────────────────────────────────────────────────────  │
│  • API endpoints protected against abuse                               │
│  • Telegram bot command throttling                                     │
│  • Per-user donation frequency limits                                  │
│                                                                         │
│  💰 FINANCIAL SECURITY                                                 │
│  ─────────────────────────────────────────────────────────────────────  │
│  • Double-entry ledger system                                          │
│  • Database transactions for balance updates                           │
│  • Admin approval required for recharges                               │
│  • Audit trail for all financial operations                            │
│                                                                         │
│  🤖 BOT SECURITY                                                       │
│  ─────────────────────────────────────────────────────────────────────  │
│  • Redis-based instance locking (prevents duplicate bots)              │
│  • State machine prevents flow manipulation                            │
│  • Ban system for abusive donors                                       │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Deployment Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                    PRODUCTION DEPLOYMENT                                │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│                        ┌─────────────────────┐                         │
│                        │    CLOUDFLARE       │                         │
│                        │    (DNS + CDN)      │                         │
│                        └──────────┬──────────┘                         │
│                                   │                                     │
│              ┌────────────────────┼────────────────────┐               │
│              │                    │                    │               │
│              ▼                    ▼                    ▼               │
│     ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │
│     │   FRONTEND      │  │    BACKEND      │  │   TELEGRAM      │     │
│     │   (Static)      │  │    (Node.js)    │  │   WEBHOOK       │     │
│     │                 │  │                 │  │                 │     │
│     │  Netlify/       │  │  Cloud Run /    │  │  Same as        │     │
│     │  Vercel         │  │  Railway        │  │  Backend        │     │
│     └─────────────────┘  └────────┬────────┘  └─────────────────┘     │
│                                   │                                     │
│              ┌────────────────────┼────────────────────┐               │
│              │                    │                    │               │
│              ▼                    ▼                    ▼               │
│     ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │
│     │   POSTGRESQL    │  │     REDIS       │  │  GOOGLE CLOUD   │     │
│     │                 │  │                 │  │     TTS         │     │
│     │   Neon.tech /   │  │   Upstash /     │  │                 │     │
│     │   Supabase      │  │   Redis Cloud   │  │   API Access    │     │
│     └─────────────────┘  └─────────────────┘  └─────────────────┘     │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Performance Metrics

| Metric | Target | Current |
|--------|--------|---------|
| TTS Generation Time | < 2 seconds | ~1.5 seconds |
| API Response Time | < 200ms | ~150ms |
| Real-time Latency | < 500ms | ~300ms |
| Concurrent Users | 1,000+ | Tested: 500 |
| Uptime | 99.9% | 99.5% |

---

## 9. Demo Access

### Live Demo

- **Website:** www.habeshatts.com
- **Telegram Bot:** @HabeshaTTSBot
- **Admin Dashboard:** Available upon request

### Test Credentials

For ministry evaluation, we can provide:
- Test donor account
- Test streamer dashboard access
- Admin dashboard demo

---

<div align="center">

## 🇪🇹 HabeshaTTS - Built in Ethiopia, For Ethiopia 🇪🇹

**Contact:** www.habeshatts.com

</div>
