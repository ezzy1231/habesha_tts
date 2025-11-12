-- Performance indexes for Habesha TTS
-- NOTE: CREATE INDEX CONCURRENTLY cannot run inside a transaction block.
-- Run each statement individually, or ensure your SQL client does not wrap
-- this file in a single BEGIN/COMMIT transaction.

-- =====================
-- Donations hot-paths
-- =====================

-- For general streamer donations listings filtered by status and sorted by created_at
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_donations_streamer_status_created_desc
ON public.donations (streamer_id, status, created_at DESC);

-- For streamer dashboards: quickly fetch most recent PAID donations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_donations_streamer_paid_created_desc
ON public.donations (streamer_id, created_at DESC)
WHERE status = 'paid';

-- For unplayed queue of PAID donations (audio playback pipeline)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_donations_streamer_paid_unplayed_created_desc
ON public.donations (streamer_id, created_at DESC)
WHERE status = 'paid' AND played = false;

-- Optional: if you frequently fetch by donor_id history
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_donations_donor_created_desc
-- ON public.donations (donor_id, created_at DESC);

-- =====================
-- Withdrawals hot-paths
-- =====================

-- For user withdrawals filtered by status and sorted by created_at
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_withdrawals_user_status_created_desc
ON public.withdrawals (user_id, status, created_at DESC);

-- For balance computation shortcuts (approved-only)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_withdrawals_user_approved_created_desc
ON public.withdrawals (user_id, created_at DESC)
WHERE status = 'approved';

-- =====================
-- Users admin listing
-- =====================

-- For admin streamer listings filtered by role/registration_status and sorted by streamer_order
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_role_regstatus_order
ON public.users (role, registration_status, streamer_order);
