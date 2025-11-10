# Streamer OTP Authentication Implementation Guide

## Table of Contents
1. [Overview](#overview)
2. [Phase 1: Database Setup](#phase-1-database-setup)
3. [Phase 2: Backend API Setup](#phase-2-backend-api-setup)
4. [Phase 3: Frontend Implementation](#phase-3-frontend-implementation)
5. [Phase 4: Telegram Bot Integration](#phase-4-telegram-bot-integration)
6. [Phase 5: Security Measures](#phase-5-security-measures)
7. [Phase 6: Error Handling & User Experience](#phase-6-error-handling--user-experience)

---

## Overview

This guide provides step-by-step instructions for implementing **One-Time Password (OTP) authentication** for streamers after they register via Telegram. Instead of using usernames and passwords, streamers will:

1. Enter their Telegram User ID on the login page
2. Receive a 6-digit OTP code via Telegram bot
3. Enter the OTP to access the dashboard
4. Maintain session with JWT tokens stored in httpOnly cookies

### Key Benefits
- ✅ No passwords to remember or compromise
- ✅ Secure and time-limited (10 minutes)
- ✅ Works seamlessly on mobile (Telegram is already installed)
- ✅ Industry standard authentication method
- ✅ Reduces password reset support tickets
- ✅ Higher security than traditional username/password

---

## Phase 1: Database Setup

### 1.1 Create OTP Tokens Table

**Purpose:** Store OTP codes and track their validity

**SQL Migration:**
```sql
CREATE TABLE IF NOT EXISTS otp_tokens (
  id SERIAL PRIMARY KEY,
  streamer_id INT NOT NULL REFERENCES streamers(id) ON DELETE CASCADE,
  telegram_user_id BIGINT NOT NULL,
  otp VARCHAR(6) NOT NULL,
  is_used BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_otp_telegram_user ON otp_tokens(telegram_user_id);
CREATE INDEX idx_otp_expires ON otp_tokens(expires_at);
```

**What to do:**
- Run this SQL in your PostgreSQL database
- The `telegram_user_id` column should match the streamer's Telegram ID
- The `is_used` column prevents reuse of OTP codes
- The `expires_at` column tracks when code becomes invalid
- Indexes speed up OTP lookups by telegram_user_id

### 1.2 Create Login Sessions Table

**Purpose:** Track active sessions for audit purposes

**SQL Migration:**
```sql
CREATE TABLE IF NOT EXISTS login_sessions (
  id SERIAL PRIMARY KEY,
  streamer_id INT NOT NULL REFERENCES streamers(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_session_streamer ON login_sessions(streamer_id);
CREATE INDEX idx_session_expires ON login_sessions(expires_at);
```

**What to do:**
- Store hashed version of JWT token for verification
- Track IP address and user agent for security monitoring
- `last_activity` updates whenever user makes an API request
- Use this table to revoke sessions if needed

### 1.3 Update Streamers Table

**Purpose:** Add fields to support OTP authentication

**SQL Migration:**
```sql
ALTER TABLE streamers ADD COLUMN IF NOT EXISTS telegram_user_id BIGINT UNIQUE;
ALTER TABLE streamers ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;
ALTER TABLE streamers ADD COLUMN IF NOT EXISTS login_attempts INT DEFAULT 0;
ALTER TABLE streamers ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP;

CREATE INDEX idx_streamer_telegram ON streamers(telegram_user_id);
```

**What to do:**
- `telegram_user_id` is the unique identifier for each streamer
- `last_login_at` tracks when streamer last successfully logged in
- `login_attempts` counts failed OTP verification attempts
- `locked_until` locks account after too many failed attempts
- Add index for fast lookups by telegram_user_id

### 1.4 Create Audit Logs Table

**Purpose:** Track OTP requests and verifications for security

**SQL Migration:**
```sql
CREATE TABLE IF NOT EXISTS otp_audit_logs (
  id SERIAL PRIMARY KEY,
  telegram_user_id BIGINT,
  streamer_id INT REFERENCES streamers(id) ON DELETE SET NULL,
  action VARCHAR(50), -- 'otp_requested', 'otp_verified', 'otp_failed', 'login_success', 'login_failed'
  ip_address VARCHAR(45),
  user_agent TEXT,
  status VARCHAR(20), -- 'success', 'failed'
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_telegram ON otp_audit_logs(telegram_user_id);
CREATE INDEX idx_audit_streamer ON otp_audit_logs(streamer_id);
CREATE INDEX idx_audit_action ON otp_audit_logs(action);
CREATE INDEX idx_audit_created ON otp_audit_logs(created_at);
```

**What to do:**
- Log every OTP request with timestamp and IP
- Log every OTP verification attempt (success and failure)
- Log every successful login
- Keep logs for 90 days for security review
- Use indexes to quickly search logs

---

## Phase 2: Backend API Setup

### 2.1 Create Authentication Middleware

**File:** `backend/middleware/streamerAuth.js`

**Purpose:** Validate JWT tokens and protect routes

**What to do:**
1. Create a function that:
   - Reads JWT token from cookies or Authorization header
   - Verifies token signature using JWT_SECRET
   - Checks if token has expired
   - Verifies user role is "streamer"
   - Attaches decoded user info to request object
   - Passes control to next middleware if valid
   - Returns 401 error if token missing, invalid, or expired

2. Create similar function for admin authentication that checks role is "admin"

3. Create optional authentication function that:
   - Attempts to read and validate token
   - Doesn't error if token missing (allows public access)
   - Attaches user info if token valid

**Key Points:**
- Check both `req.cookies.authToken` and `req.headers.authorization`
- Use `process.env.JWT_SECRET` to verify signature
- Return proper HTTP status codes (401 for auth failed, 403 for permission denied)
- Update `last_activity` timestamp in login_sessions table

### 2.2 Implement OTP Request Endpoint

**Endpoint:** `POST /api/v1/streamer/request-otp`

**Request Body:**
```json
{
  "telegram_user_id": 123456789
}
```

**What to do:**

1. **Validate Input**
   - Check telegram_user_id is numeric and positive
   - Return 400 error if invalid format

2. **Check Rate Limiting**
   - Look up how many OTP requests this telegram_user_id made in last 5 minutes
   - If >= 3 requests, return 429 error with message "Too many OTP requests. Please try again in 5 minutes."
   - Also check by IP address to prevent distributed attacks

3. **Find Streamer**
   - Query `streamers` table where `telegram_user_id` matches
   - If no streamer found, return 404 error "Streamer account not found"

4. **Generate OTP**
   - Create random 6-digit number
   - Calculate expiry time as current time + 10 minutes

5. **Store OTP in Database**
   - Delete any previous unused OTP for this telegram_user_id
   - Insert new record into `otp_tokens` table with:
     - `streamer_id`
     - `telegram_user_id`
     - `otp` (the 6-digit code)
     - `is_used` = FALSE
     - `expires_at` = expiry time

6. **Send OTP via Telegram Bot**
   - Call Telegram bot API to send message to telegram_user_id
   - Message format:
     ```
     🔐 Your Habesha TTS Login Code
     
     123456
     
     This code is valid for 10 minutes.
     Do not share this code with anyone!
     ```
   - If Telegram message fails, still return success but log failure

7. **Log Audit**
   - Insert record into `otp_audit_logs` with:
     - `telegram_user_id`
     - `streamer_id`
     - `action` = 'otp_requested'
     - `ip_address` = request IP
     - `user_agent` = request user agent
     - `status` = 'success' or 'failed'

8. **Return Response**
   - Return 200 status with message: "OTP sent to your Telegram. Valid for 10 minutes."

**Error Handling:**
- Invalid input → 400
- Rate limit exceeded → 429
- Streamer not found → 404
- Telegram bot error → Still return 200 (user will retry)
- Database error → 500

### 2.3 Implement OTP Verification Endpoint

**Endpoint:** `POST /api/v1/streamer/verify-otp`

**Request Body:**
```json
{
  "telegram_user_id": 123456789,
  "otp": "123456"
}
```

**What to do:**

1. **Validate Input**
   - Check telegram_user_id is numeric
   - Check otp is exactly 6 digits
   - Return 400 if invalid

2. **Check Rate Limiting**
   - Look up failed OTP attempts in last 1 minute for this telegram_user_id
   - If >= 5 attempts, return 429 error
   - Also implement account lock: if 5+ failures in last 5 minutes, lock account for 15 minutes

3. **Find OTP Record**
   - Query `otp_tokens` where:
     - `telegram_user_id` matches
     - `is_used` = FALSE
     - `expires_at` > NOW()
   - If not found, increment `login_attempts` in streamers table
   - Log failed attempt in audit_logs
   - Return 401 "Invalid or expired code"

4. **Verify OTP Code**
   - Compare submitted OTP with stored OTP
   - If doesn't match:
     - Increment `login_attempts` counter
     - Log failed attempt
     - Return 401 "Invalid code"
   - If matches, proceed to step 5

5. **Mark OTP as Used**
   - Update `otp_tokens` record to set `is_used` = TRUE
   - This prevents reuse of same code

6. **Create JWT Token**
   - Generate JWT with:
     - `streamer_id` (from database)
     - `telegram_user_id` (from request)
     - `role` = 'streamer'
     - `iat` (issued at) = current time
     - `exp` (expires at) = current time + 7 days
   - Sign token with `process.env.JWT_SECRET`

7. **Set HTTP Cookie**
   - Set cookie named `authToken` with:
     - Value = JWT token
     - `httpOnly` = true (prevents JavaScript access)
     - `secure` = true (HTTPS only in production)
     - `sameSite` = 'Strict' (prevents CSRF)
     - `maxAge` = 7 days in milliseconds

8. **Update Streamer Record**
   - Reset `login_attempts` to 0
   - Set `last_login_at` = NOW()
   - Clear `locked_until` if set

9. **Create Session Record**
   - Insert into `login_sessions` table:
     - `streamer_id`
     - `token_hash` = hash of JWT token
     - `ip_address`
     - `user_agent`
     - `expires_at` = token expiry time

10. **Send Telegram Notification**
    - Send message to streamer: "✅ You logged into Habesha TTS Dashboard"

11. **Log Success**
    - Insert into `otp_audit_logs`:
      - `action` = 'otp_verified'
      - `status` = 'success'

12. **Return Response**
    - Return 200 status with message "Login successful"
    - Frontend will automatically have cookie and redirect to dashboard

**Error Handling:**
- Invalid input → 400
- Account locked → 423 (Locked)
- Rate limit exceeded → 429
- Invalid/expired OTP → 401
- Database error → 500

### 2.4 Implement Logout Endpoint

**Endpoint:** `POST /api/v1/streamer/logout`

**Requirements:** User must be authenticated (have valid JWT token)

**What to do:**

1. **Check Authentication**
   - Verify user has valid token (use streamerAuth middleware)
   - Extract streamer_id from token

2. **Delete Session Record**
   - Delete from `login_sessions` where `streamer_id` matches
   - This invalidates all active sessions for this streamer

3. **Clear Cookie**
   - Set `authToken` cookie to empty with `maxAge` = 0
   - This removes cookie from client

4. **Log Audit**
   - Insert into `otp_audit_logs`:
     - `action` = 'logout'
     - `status` = 'success'

5. **Return Response**
   - Return 200 status with message "Logged out successfully"

**Error Handling:**
- Not authenticated → 401
- Database error → 500

### 2.5 Implement Token Refresh Endpoint

**Endpoint:** `POST /api/v1/streamer/refresh-token`

**Requirements:** User must have valid (non-expired) token

**What to do:**

1. **Check Authentication**
   - Verify user has valid token
   - Extract streamer_id from token

2. **Create New Token**
   - Generate new JWT with same claims as original
   - Set expiration to 7 days from now

3. **Set New Cookie**
   - Set `authToken` cookie with new token
   - Same settings as original (httpOnly, secure, sameSite)

4. **Update Session**
   - Update `last_activity` in login_sessions table to NOW()

5. **Return Response**
   - Return 200 status
   - No message needed (frontend doesn't need to do anything)

**Purpose:** This endpoint is called automatically by frontend before token expires to extend session without user re-entering OTP

**Error Handling:**
- Not authenticated → 401
- Token expired → 401
- Database error → 500

### 2.6 Add Rate Limiting Middleware

**File:** `backend/middleware/rateLimiter.js`

**What to do:**

1. **Create OTP Request Limiter**
   - Limit: 3 requests per 5 minutes
   - Rate limit by: `telegram_user_id` (primary), IP address (secondary)
   - Message: "Too many OTP requests. Please try again in 5 minutes."
   - Skip limiting: if NODE_ENV is 'development'

2. **Create OTP Verification Limiter**
   - Limit: 5 attempts per 1 minute
   - Rate limit by: `telegram_user_id` (primary), IP address (secondary)
   - Message: "Too many verification attempts. Please try again later."

3. **Create Dashboard Limiter**
   - Limit: 200 requests per 15 minutes
   - Rate limit by: `streamer_id` from authenticated user
   - Only apply to non-GET requests (POST, PUT, DELETE)
   - Skip if user is admin

**Key Points:**
- Use `express-rate-limit` package
- Store rate limit data in memory (for development) or Redis (for production)
- Return 429 status when limit exceeded
- Include `X-RateLimit-*` headers in response to show remaining requests

---

## Phase 3: Frontend Implementation

### 3.1 Create Login Page Components

**File:** `frontend/src/pages/StreamerLogin.jsx`

**What to do:**

1. **Create Parent Component**
   - Import React hooks: `useState`, `useEffect`, `useNavigate`
   - Manage state: `step` (request/verify), `telegramId`, `otp`, `loading`, `error`, `message`

2. **Build Screen 1: Request OTP**
   - Display heading: "📱 Streamer Dashboard Login"
   - Display input field:
     - Label: "Telegram User ID"
     - Placeholder: "e.g., 123456789"
     - Type: number or text (numeric only)
     - Size: large, mobile-friendly
   - Display "Your Telegram User ID" help text with `/myid` command
   - Display button: "Send OTP to Telegram"
     - Disabled while loading
     - Show spinner while API call in progress

3. **Build Screen 2: Verify OTP**
   - Display heading: "🔐 Enter Code"
   - Display message: "We sent a 6-digit code to your Telegram"
   - Display countdown timer: "Code expires in 10:00"
     - Count down from 10 minutes
     - Turn red at 2 minutes
     - Show error at 0 minutes
   - Display input field:
     - Label: "6-Digit Code"
     - Placeholder: "000000"
     - Type: text (numeric only)
     - Max length: 6
     - Auto-focus
   - Display buttons:
     - "Verify & Login" (primary)
     - "Didn't receive code?" (secondary, disabled first 30 seconds)
   - Show attempt counter: "Attempt 1 of 5"
   - Display error message if provided

4. **Add Styling**
   - Responsive design (mobile first)
   - Large touch targets (min 44px height)
   - High contrast text
   - Use existing app color scheme

### 3.2 Implement OTP Request Logic

**What to do:**

1. **Create Request Handler Function**
   - Validate telegram ID:
     - Not empty
     - Numeric only
     - At least 5 digits
   - If invalid, show error message and return
   - Set `loading` state to true
   - Show message: "Sending OTP..."

2. **Call API Endpoint**
   - Make POST request to `/api/v1/streamer/request-otp`
   - Include `telegram_user_id` in JSON body
   - Use `credentials: 'include'` to send cookies
   - Set timeout: 10 seconds

3. **Handle Success Response**
   - Set `step` = 'verify'
   - Clear any error messages
   - Show message: "✅ Check your Telegram for the 6-digit code"
   - Start 10-minute countdown timer
   - Clear input field
   - Auto-focus OTP input
   - Disable "Send OTP" button for 60 seconds with countdown

4. **Handle Error Responses**
   - 400 error: "Invalid Telegram ID"
   - 404 error: "Streamer account not found. Did you register via Telegram?"
   - 429 error: "Too many OTP requests. Please wait 5 minutes."
   - 500 error: "Server error. Please try again later."
   - Network error: "Connection failed. Check your internet."

5. **Set Loading State**
   - Set `loading` = false when request completes (success or error)

### 3.3 Implement OTP Verification Logic

**What to do:**

1. **Create Verification Handler Function**
   - Validate OTP:
     - Not empty
     - Exactly 6 digits
   - If invalid, show error and return
   - Set `loading` state to true

2. **Call API Endpoint**
   - Make POST request to `/api/v1/streamer/verify-otp`
   - Include `telegram_user_id` and `otp` in JSON body
   - Use `credentials: 'include'`
   - Set timeout: 10 seconds

3. **Handle Success Response**
   - Show message: "✅ Login successful! Redirecting..."
   - Clear error messages
   - Wait 1 second
   - Redirect to `/streamer/dashboard`

4. **Handle Error Responses**
   - 400 error: "Invalid code format"
   - 401 error: "Invalid code. Try again. (3 attempts remaining)"
     - Extract attempts from response
     - Update display: "Attempt X of 5"
   - 423 error: "Too many failed attempts. Account locked for 15 minutes."
     - Disable OTP input
     - Show countdown timer
   - 429 error: "Too many attempts. Wait 1 minute."
   - 500 error: "Server error. Please try again."
   - Network error: "Connection failed."

5. **Set Loading State**
   - Set `loading` = false when request completes

### 3.4 Add "Resend Code" Feature

**What to do:**

1. **Create Resend Handler Function**
   - Check if countdown timer >= 30 seconds
   - If < 30 seconds, show message "Wait X seconds to resend"
   - If >= 30 seconds, call same API as step 3.2 (OTP request)
   - Reset countdown timer to 10 minutes
   - Clear OTP input
   - Show message: "✅ New code sent to Telegram"

2. **Add UI Elements**
   - Display "Didn't receive code?" link below OTP input
   - Initially disabled (grayed out)
   - Become enabled after 30 seconds
   - Show countdown: "Resend in X seconds"

3. **Add "Back" Button**
   - Allow user to go back to telegram ID entry
   - Clear OTP and start fresh

### 3.5 Implement Session Management

**File:** `frontend/src/contexts/AuthContext.jsx` or similar

**What to do:**

1. **Create Auth Context**
   - Manage auth state globally
   - Track: `isAuthenticated`, `user`, `loading`, `loginError`

2. **Check Authentication on App Load**
   - When app starts, make GET request to `/api/v1/streamer/me`
   - If 200 response: user is logged in, extract user data
   - If 401 response: user not logged in, clear auth
   - Set `isAuthenticated` state accordingly

3. **Add Route Protection**
   - Create `ProtectedRoute` component
   - Redirect unauthenticated users to login page
   - Show loading spinner while checking authentication

4. **Implement Logout**
   - Create logout function that:
     - Makes POST request to `/api/v1/streamer/logout`
     - Clears auth state
     - Redirects to login page

5. **Add Session Expiration Warning**
   - Track token expiration time (from JWT decode)
   - Show warning 5 minutes before expiration
   - Message: "Your session expires in 5 minutes. Click to stay logged in."
   - Call token refresh endpoint when clicked

6. **Implement Auto-Refresh**
   - Every 6 hours, call `/api/v1/streamer/refresh-token`
   - This extends session without user action
   - Only refresh if user is active (check last activity)

7. **Add Logout Button in Dashboard**
   - Add button in header/navigation
   - Show user's name/email
   - Confirm before logout: "Are you sure?"

### 3.6 Handle Browser Cookie Storage

**What to do:**

1. **Configure Fetch Requests**
   - Include `credentials: 'include'` in all fetch calls:
     ```javascript
     fetch('/api/v1/streamer/request-otp', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       credentials: 'include', // This sends cookies
       body: JSON.stringify({ telegram_user_id: id })
     })
     ```
   - This automatically sends `authToken` cookie with requests

2. **Create API Wrapper**
   - Create utility function for all API calls
   - Always include `credentials: 'include'`
   - Handle 401 responses (redirect to login)
   - Handle CORS errors

3. **Remove localStorage Usage**
   - Search for any `localStorage.setItem` or `localStorage.getItem`
   - Replace with context/state management
   - Delete any token or auth data from localStorage

4. **Remove sessionStorage Usage**
   - Search for `sessionStorage.setItem` or `sessionStorage.getItem`
   - Replace with state management
   - Don't store sensitive data

5. **Verify Cookie Behavior**
   - Open browser DevTools → Application/Storage → Cookies
   - Verify `authToken` cookie exists after login
   - Verify `httpOnly` flag prevents JavaScript access
   - Verify `secure` flag in production (HTTPS only)
   - Verify `sameSite` flag is set

---

## Phase 4: Telegram Bot Integration

### 4.1 Update Telegram Bot Command Handler

**File:** `bot/bot.js`

**What to do:**

1. **Add Login Button to Start Command**
   - When user runs `/start`:
     - Check if user is already registered as streamer
     - If registered, show menu with options:
       - "🔐 Login to Dashboard"
       - "📊 View My Stats"
       - "💰 Withdraw Earnings"
     - If not registered, show registration instructions

2. **Create Login Button Handler**
   - When user clicks "🔐 Login to Dashboard":
     - Get user's Telegram ID
     - Send message: "You can log in here: [dashboard-url]/login"
     - Include their Telegram User ID: "Your Telegram ID: 123456789"
     - Alternative: Send clickable inline button with URL

3. **Inline Keyboard Example**
   ```javascript
   const opts = {
     reply_markup: {
       inline_keyboard: [
         [{ text: '🔐 Login to Dashboard', url: dashboardLoginUrl }],
         [{ text: '📊 View Stats', callback_data: 'view_stats' }]
       ]
     }
   };
   bot.sendMessage(chatId, 'Choose an option:', opts);
   ```

### 4.2 Send OTP Messages

**File:** `bot/bot.js` or `bot/utils/tts.js`

**What to do:**

1. **Create OTP Message Function**
   - Accept `chatId` and `otp` as parameters
   - Format message clearly:
     ```
     🔐 Your Habesha TTS Login Code
     
     123456
     
     ⏰ Valid for 10 minutes
     🔒 Never share this code!
     ```

2. **Send Message via Bot**
   - Use `bot.sendMessage(chatId, message, options)`
   - Use `parse_mode: 'Markdown'` for formatting
   - Track if message sent successfully

3. **Handle Send Failures**
   - If message fails, log error
   - Return error status to API endpoint
   - Frontend will show: "Check notifications settings in Telegram"

4. **Add Security Notes**
   - Include warning: "Never share this code"
   - Include note: "This code expires in 10 minutes"
   - Include note: "If you didn't request this, ignore this message"

### 4.3 Add Help Commands

**File:** `bot/bot.js`

**What to do:**

1. **Add `/help` Command**
   - Send message explaining OTP login:
     ```
     📚 Help

     🔐 **Login to Dashboard**
     1. Go to dashboard login page
     2. Enter your Telegram User ID
     3. We'll send you a 6-digit code
     4. Enter code to log in

     🆘 **Need Help?**
     - `/myid` - Show your Telegram User ID
     - `/start` - Go back to main menu
     ```

2. **Add `/myid` Command**
   - Send message: "Your Telegram User ID is: 123456789"
   - This helps streamers find their ID for login
   - Include note: "Use this ID to log in to the dashboard"

3. **Update `/start` Command**
   - Include link to help: "Need help? Type `/help`"

---

## Phase 5: Security Measures

### 5.1 Implement Rate Limiting

**File:** `backend/middleware/rateLimiter.js`

**What to do:**

1. **OTP Request Rate Limiter**
   - Create limiter: 3 requests per 5 minutes
   - Apply to: `/api/v1/streamer/request-otp`
   - Rate limit key: `telegram_user_id` (primary), IP address (secondary)
   - Return status 429 when limit exceeded
   - Message: "Too many OTP requests. Please try again in 5 minutes."

2. **OTP Verification Limiter**
   - Create limiter: 5 attempts per 1 minute
   - Apply to: `/api/v1/streamer/verify-otp`
   - Rate limit key: same as above
   - Lock account after 5 failed attempts in 5 minutes

3. **Dashboard Limiter**
   - Create limiter: 200 requests per 15 minutes
   - Apply to: all authenticated endpoints
   - Rate limit key: `streamer_id` from JWT
   - Only apply to non-GET requests (POST, PUT, DELETE)
   - Return status 429: "Too many requests from this account"

4. **Implementation Details**
   - Use `express-rate-limit` package
   - Store in memory for development
   - Store in Redis for production
   - Include rate limit info in response headers:
     - `X-RateLimit-Limit`: max requests
     - `X-RateLimit-Remaining`: requests left
     - `X-RateLimit-Reset`: reset time

### 5.2 Add CSRF Protection

**File:** `backend/index.js`

**What to do:**

1. **Install CSRF Protection**
   - Add `csurf` package to package.json
   - Install with `npm install csurf`

2. **Add CSRF Middleware**
   - Apply to all state-changing endpoints (POST, PUT, DELETE)
   - Skip for login endpoints (request-otp, verify-otp)
   - Skip for endpoints accessed via API with Authorization header

3. **Generate CSRF Tokens**
   - Create GET endpoint `/api/v1/csrf-token`
   - Returns: `{ csrfToken: "..." }`
   - Frontend calls this before submitting forms

4. **Validate CSRF Tokens**
   - Read token from request body or header
   - Validate against session
   - Return 403 if invalid

**Note:** For OTP login endpoints, CSRF not required since no existing session

### 5.3 Implement Audit Logging

**File:** `backend/utils/auditLog.js`

**What to do:**

1. **Create Audit Log Function**
   - Function signature: `logOtpAction(telegramUserId, streamerId, action, ipAddress, userAgent, status, errorMessage)`
   - Insert record into `otp_audit_logs` table
   - Include timestamp automatically

2. **Log OTP Requests**
   - When OTP generated
   - Include: telegram_user_id, action='otp_requested', status, IP, user agent

3. **Log OTP Verification**
   - Every verification attempt (success and failure)
   - Include: status ('success' or 'failed'), error message if failed

4. **Log Login Events**
   - Successful login: action='login_success'
   - Failed login: action='login_failed', include reason
   - Logout: action='logout'

5. **Retention Policy**
   - Keep logs for 90 days minimum
   - Create cleanup job:
     ```sql
     DELETE FROM otp_audit_logs WHERE created_at < NOW() - INTERVAL '90 days';
     ```
   - Run daily via cron job or scheduler

6. **Access Logs**
   - Only admins can view audit logs
   - Create endpoint: `GET /api/v1/admin/audit-logs`
   - Filter by: telegram_user_id, streamer_id, action, date range

### 5.4 Add Security Headers

**File:** `backend/index.js`

**What to do:**

1. **Install Helmet.js**
   - Add `helmet` to package.json
   - Install with `npm install helmet`

2. **Add Helmet Middleware**
   - At top of middleware stack in `backend/index.js`
   - Apply to all routes
   ```javascript
   app.use(helmet());
   ```

3. **Helmet provides headers:**
   - `X-Content-Type-Options: nosniff` - Prevent MIME type sniffing
   - `X-Frame-Options: DENY` - Prevent clickjacking
   - `Strict-Transport-Security: max-age=31536000` - HTTPS only
   - `Content-Security-Policy` - Prevent XSS attacks
   - `X-XSS-Protection: 1; mode=block` - Legacy XSS protection

4. **Configure CORS**
   - Allow requests only from dashboard domain
   - In production: set specific origin, not '*'
   ```javascript
   app.use(cors({
     origin: process.env.DASHBOARD_URL,
     credentials: true
   }));
   ```

5. **Set Cookie Security**
   - In production only:
     - `secure: true` (HTTPS only)
     - `sameSite: 'Strict'` (prevent CSRF)
     - `httpOnly: true` (prevent XSS access)

### 5.5 Implement Suspicious Activity Detection

**File:** `backend/utils/suspiciousActivity.js`

**What to do:**

1. **Detect Multi-IP Logins**
   - Track: streamer ID, IP address, login timestamp
   - Alert if: same streamer logs in from 5+ different IPs in 1 hour
   - Action: Send notification via Telegram, log in admin dashboard

2. **Detect Rapid OTP Verification**
   - Track: time between OTP request and verification
   - Alert if: verified in < 10 seconds (bot attack)
   - Action: Block requests from IP, notify admin

3. **Detect OTP Spam**
   - Track: OTP requests per telegram_user_id
   - Alert if: 10+ requests in 1 hour
   - Action: Lock account, require manual admin unlock

4. **Detect Brute Force**
   - Track: failed OTP verification attempts
   - Alert if: 10+ failures in 30 minutes
   - Action: Temporarily lock account, IP address, notify admin

5. **Implementation**
   - Create function: `checkSuspiciousActivity(telegramUserId, action, ipAddress)`
   - Query audit logs
   - Compare against thresholds
   - Return alert/warning if suspicious
   - Create admin endpoint to review suspicious activities

---

## Phase 6: Error Handling & User Experience

### 6.1 Handle Common Errors

**What to do:**

1. **OTP Expired Error**
   - Scenario: User waits > 10 minutes before entering code
   - Frontend message: "Code expired. Request a new one."
   - Backend status: 401
   - UI action: Switch back to telegram ID entry screen
   - Keep telegram ID pre-filled for convenience

2. **Invalid OTP Error**
   - Scenario: User enters wrong 6-digit code
   - Frontend message: "Wrong code. Try again. (3 attempts remaining)"
   - Backend response includes: remaining attempts
   - Backend status: 401
   - UI action: Keep user on verify screen, clear input

3. **Account Locked Error**
   - Scenario: User fails 5+ verification attempts
   - Frontend message: "Too many failed attempts. Account locked for 15 minutes."
   - Backend status: 423 (Locked)
   - UI action: Disable OTP input, show countdown timer to unlock
   - Allow user to request new OTP (which resets counter)

4. **Telegram ID Not Found Error**
   - Scenario: Entered telegram_user_id isn't registered
   - Frontend message: "Streamer account not found. Did you register via Telegram first?"
   - Backend status: 404
   - Include link: "Register now: [telegram-bot-url]"
   - UI action: Keep ID field, show error

5. **Rate Limit Error**
   - Scenario: User requests too many OTPs
   - Frontend message: "Too many OTP requests. Please wait 5 minutes before trying again."
   - Backend status: 429
   - UI action: Show countdown timer, disable "Send OTP" button
   - Show message when timer reaches 0

6. **Network Error**
   - Scenario: No internet connection or server unavailable
   - Frontend message: "Connection failed. Check your internet and try again."
   - Show retry button
   - Auto-retry once after 3 seconds

7. **Telegram Bot Error**
   - Scenario: OTP not received via Telegram
   - Frontend message: "OTP sent but Telegram notification may be delayed. Check your spam folder."
   - Show "Resend" button
   - Link to Telegram bot: "Open Telegram Bot"

8. **Session Expired Error**
   - Scenario: User tries action but JWT token expired
   - Frontend message: "Your session expired. Please log in again."
   - Backend status: 401
   - UI action: Clear auth state, redirect to login page

### 6.2 Add Helpful Features

**What to do:**

1. **Copy-Paste OTP**
   - Add copy icon next to "Enter Code" input
   - On click, copy example: "000000"
   - Auto-detect if code copied to clipboard
   - Auto-fill input if user pastes code

2. **Auto-Fill OTP**
   - If user copies OTP from Telegram (code only)
   - Automatically detect and fill input field
   - Requires permission to read clipboard (browser API)
   - Show notification: "Code auto-filled"

3. **Countdown Timer**
   - Display: "Expires in 09:45"
   - Update every second
   - Show in red when < 2 minutes
   - Show warning at 1 minute: "Code expires soon"

4. **Attempt Counter**
   - Display: "Attempt 2 of 5"
   - Color progression:
     - 1-2 attempts: green
     - 3-4 attempts: yellow
     - 5 attempts: red
   - Clear when new OTP requested

5. **Resend Countdown**
   - Display: "Resend in 27 seconds"
   - Update every second
   - Enable button when reaches 0

6. **Phone Format Help**
   - Show input mask for telegram ID
   - Example: "Telegram ID: [123456789]"
   - Include help text: "Find your ID by typing `/myid` in Telegram bot"

7. **Loading States**
   - Disable buttons while API call in progress
   - Show loading spinner
   - Show text: "Sending OTP..."
   - Prevent duplicate submissions

8. **Success Messages**
   - After OTP sent: "✅ Check your Telegram for the 6-digit code"
   - After verification: "✅ Login successful! Redirecting..."
   - Show brief notifications (dismiss after 3-5 seconds)

### 6.3 Mobile Optimization

**What to do:**

1. **Keyboard Optimization**
   - Telegram ID input: `type="tel"` (numeric keyboard)
   - OTP input: `type="text"` with `inputMode="numeric"`
   - Large buttons: minimum 44px height
   - Adequate spacing: 16px between elements

2. **Screen Size Handling**
   - Full-width on mobile (20px padding)
   - Max-width 400px on desktop
   - Centered on screen
   - Responsive font sizes

3. **Bottom Sheet on Mobile**
   - On mobile: show input/button at bottom of screen
   - On desktop: center on screen
   - Prevent keyboard from covering input

4. **Telegram Integration**
   - Add button: "Open Telegram" (if OTP not received)
   - Opens Telegram app directly on mobile
   - Link: `tg://user?id=botusername`

5. **Accessibility**
   - High contrast text (WCAG AA)
   - Focus indicators on all buttons
   - Alt text on images/icons
   - Semantic HTML (use `<button>`, `<input>`, etc.)

6. **Toast Notifications**
   - Show errors/success as toast (bottom right)
   - Auto-dismiss after 5 seconds
   - Allow manual dismiss
   - Stack multiple toasts

7. **Loading Indicator**
   - Show spinner while waiting for response
   - Disable button during load
   - Show status: "Sending OTP..."

---

## Environment Variables

Create `.env` file in project root with:

```bash
# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-min-32-characters-long
JWT_EXPIRES_IN=7d

# OTP Configuration
OTP_EXPIRY_MINUTES=10
OTP_LENGTH=6

# Telegram Bot
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_ADMIN_CHAT_ID=your-admin-chat-id

# URLs
DASHBOARD_URL=http://localhost:3000
API_URL=http://localhost:5000/api/v1

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=habesha_tts
DB_USER=postgres
DB_PASSWORD=your-password

# Node Environment
NODE_ENV=development
```

---

## Files to Create/Modify

### New Files to Create

```
backend/
  middleware/
    streamerAuth.js          # JWT authentication middleware
    rateLimiter.js          # Rate limiting for endpoints
  utils/
    token.js                # JWT token generation
    telegram.js             # Telegram bot helpers
    auditLog.js             # Audit logging utilities
    suspiciousActivity.js   # Suspicious activity detection
  routes/
    streamerAuth.js         # OTP endpoints

frontend/
  src/
    pages/
      StreamerLogin.jsx     # Login page with OTP flow
    contexts/
      AuthContext.jsx       # Global auth state management
    components/
      OtpInput.jsx          # OTP input field component
      CountdownTimer.jsx    # Expiration countdown
      SessionWarning.jsx    # Session expiry warning
```

### Files to Modify

- `backend/index.js` - Add middleware, routes, security headers
- `backend/db-postgres.js` - Add database table creation
- `frontend/src/App.jsx` - Add route protection
- `.env` - Add configuration variables

---

## Summary

This guide provides a complete implementation path for OTP authentication. Follow each phase in order:

1. **Database** - Create necessary tables and indexes
2. **Backend APIs** - Build OTP generation and verification endpoints
3. **Frontend** - Create login UI and session management
4. **Telegram Bot** - Update bot to support dashboard login
5. **Security** - Add rate limiting, audit logging, suspicious activity detection
6. **UX** - Add error handling and helpful features

Each phase has detailed "What to do" instructions to guide implementation.
