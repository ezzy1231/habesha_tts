
import db from '../backend/db-postgres.js';

const migrationScript = `
-- Drop existing tables to ensure a clean slate
DROP TABLE IF EXISTS public.complaints CASCADE;
DROP TABLE IF EXISTS public.donations CASCADE;
DROP TABLE IF EXISTS public.recharges CASCADE;
DROP TABLE IF EXISTS public.settings CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.withdrawals CASCADE;

-- Create complaints table
CREATE TABLE public.complaints (
    id SERIAL PRIMARY KEY,
    telegram_id bigint NOT NULL,
    complaint text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    responded boolean DEFAULT false
);

-- Create donations table
CREATE TABLE public.donations (
    id SERIAL PRIMARY KEY,
    streamer_id bigint NOT NULL,
    donor_id bigint,
    donor_name character varying(255),
    amount integer NOT NULL,
    message text,
    status character varying(50) DEFAULT 'pending_payment'::character varying,
    played boolean DEFAULT false,
    audio_file character varying(255),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

-- Create recharges table
CREATE TABLE public.recharges (
    id SERIAL PRIMARY KEY,
    donor_id bigint NOT NULL,
    name_on_payment text,
    screenshot_file_id text,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    amount numeric(10,2)
);

-- Create settings table
CREATE TABLE public.settings (
    key character varying(255) PRIMARY KEY,
    value text NOT NULL
);

-- Create users table
CREATE TABLE public.users (
    id SERIAL PRIMARY KEY,
    telegram_id bigint NOT NULL UNIQUE,
    username character varying(255),
    display_name character varying(255),
    role text NOT NULL,
    balance numeric(10,2) DEFAULT 0.00,
    link_uuid text UNIQUE,
    api_key text UNIQUE,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    full_name text,
    social_link text,
    profile_picture_file_id text,
    registration_status text DEFAULT 'approved'::text NOT NULL,
    streamer_order integer DEFAULT 0 NOT NULL,
    phone_number text,
    CONSTRAINT users_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'streamer'::text, 'donor'::text])))
);

-- Create withdrawals table
CREATE TABLE public.withdrawals (
    id SERIAL PRIMARY KEY,
    user_id bigint NOT NULL,
    amount integer NOT NULL,
    telebirr_username text,
    phone_number text,
    status character varying(50) DEFAULT 'pending'::character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

-- Foreign Key Constraints
ALTER TABLE public.donations ADD CONSTRAINT donations_donor_id_fkey FOREIGN KEY (donor_id) REFERENCES public.users(telegram_id) ON DELETE CASCADE;
ALTER TABLE public.donations ADD CONSTRAINT donations_streamer_id_fkey FOREIGN KEY (streamer_id) REFERENCES public.users(telegram_id) ON DELETE CASCADE;
ALTER TABLE public.recharges ADD CONSTRAINT recharges_donor_id_fkey FOREIGN KEY (donor_id) REFERENCES public.users(telegram_id) ON DELETE CASCADE;
ALTER TABLE public.withdrawals ADD CONSTRAINT withdrawals_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(telegram_id) ON DELETE CASCADE;

-- Insert Data
INSERT INTO public.users (id, telegram_id, username, display_name, role, balance, link_uuid, api_key, created_at, full_name, social_link, profile_picture_file_id, registration_status, streamer_order, phone_number) VALUES
(7, 531509239, 'Esrommek', 'ኤስሮም', 'donor', 720.00, NULL, NULL, '2025-11-06 12:15:13.845139+03', NULL, NULL, NULL, 'approved', 0, NULL),
(4, 7212643479, 'Ez', NULL, 'streamer', 20.00, '34bd9090-bf01-45bb-bc49-af9842dc7949', 'df9900b636c4a9d8818c68b0f83cdedca7e86e963466de9fcd28391966caee62', '2025-11-05 19:49:50.930465+03', 'Santos', 'https://www.tiktok.com/@ezzhuu?_r=1&_t=ZM-919Oy6e9eLA', 'AgACAgQAAxkBAAIVS2kLgC0hsaCZ2uWSzrl5MJ2Pcva6AAJ4C2sbFUJgUNrb7sp4aWslAQADAgADeAADNgQ', 'approved', 1, '251939976687'),
(1, 1863182826, 'Lie_ed', 'ገበየሁ', 'donor', 0.00, NULL, NULL, '2025-11-05 11:55:32.145545+03', NULL, NULL, NULL, 'approved', 0, NULL),
(5, 7740400643, 'EZHU', NULL, 'streamer', 1040.00, 'db1705a8-e502-49f5-832e-b208bb4bbd43', '23cff9b7e78e16afb7e778295678c61fc181a72e18776d8e1de816851eb9b167', '2025-11-05 20:22:48.426048+03', 'Tasew', 'https://www.youtube.com/', 'AgACAgQAAxkBAAIVd2kLh-isH9L2PLQKsyEs0sQxw4x0AAKxC2sb9q1hUP2dkNBkH5G3AQADAgADeAADNgQ', 'approved', 0, '251939976687');

INSERT INTO public.complaints (id, telegram_id, complaint, created_at, responded) VALUES
(1, 1863182826, 'birren melesulign', '2025-11-05 22:04:17.65808+03', false),
(3, 1863182826, 'birren melesulign', '2025-11-05 22:05:55.777068+03', true),
(2, 1863182826, 'birren melesulign', '2025-11-05 22:04:36.435637+03', true),
(4, 1863182826, 'ggs', '2025-11-06 12:17:25.072173+03', true);

INSERT INTO public.donations (id, streamer_id, donor_id, donor_name, amount, message, status, played, audio_file, created_at) VALUES
(30, 7740400643, 1863182826, NULL, 20, 'ቀጣሪው ድርጅት የሎጅስቲክስ እንዲሁም የመስተንግዶ ሥልጠና እንደሚሰጥ ገልጿል', 'paid', true, 'donation_30_cloud.mp3', '2025-11-05 21:49:11.200525+03'),
(21, 7740400643, 1863182826, NULL, 20, 'ቀጣሪው ድርጅት የሎጅስቲክስ እንዲሁም የመስተንግዶ ሥልጠና እንደሚሰጥ ገልጿል', 'paid', true, 'donation_21_gemini.mp3', '2025-11-05 21:41:30.453708+03'),
(31, 7740400643, 1863182826, NULL, 20, 'esrom', 'pending_payment', false, NULL, '2025-11-06 11:51:01.911468+03'),
(22, 7740400643, 1863182826, NULL, 20, 'ቀጣሪው ድርጅት የሎጅስቲክስ እንዲሁም የመስተንግዶ ሥልጠና እንደሚሰጥ ገልጿል', 'paid', true, 'donation_22_gemini.mp3', '2025-11-05 21:45:31.410558+03');

INSERT INTO public.recharges (id, donor_id, name_on_payment, screenshot_file_id, status, created_at, amount) VALUES
(1, 1863182826, 'Tasew', 'AgACAgQAAxkBAAIU6GkLESutDBjzKvW4tKzcmYb60VkuAAICC2sbR-hgUMoCccSzi4paAQADAgADeAADNgQ', 'approved', '2025-11-05 11:56:12.807708+03', 1000.00),
(3, 531509239, 'Esrom', 'AgACAgQAAxkBAAIWemkMZ0A9_RWEKEB9CMtBF-0jnGywAAKmC2sburNgUI_wAmyz3E5FAQADAgADeAADNgQ', 'approved', '2025-11-06 12:16:22.078084+03', 1000.00);

INSERT INTO public.settings (key, value) VALUES
('maxChars', '600'),
('stepChars', '100'),
('basePrice', '20'),
('incrementPrice', '20'),
('filteredWords', '["ተበዳ","ተበዱ","ጌይ","ፈክ","ቢዳታም","እሚስ","ቁለ","ሸርሙጣ","የሸርሙጣ","የሸርሙጣ ልጅ","ብዳታም","ሸሌ","ብዳታሞች","ሸሌዎች","የሸሌዎች","የሸሌ ልጆች","ፉችክ","fuck","የሸርሙጣ ልጆች","የጌይ","የጌይ ልጅ","ቡሽቲ","የቡሽቲ ልጅ","ጀላ","ጀላ ራስ","የጀላ","የጀላ ራስ ልጅ"]');

INSERT INTO public.withdrawals (id, user_id, amount, telebirr_username, phone_number, status, created_at) VALUES
(1, 7740400643, 20, 'Tasew', '251939976687', 'approved', '2025-11-05 20:57:48.879296+03'),
(2, 7740400643, 20, 'Tasew', '0939976687', 'rejected', '2025-11-05 21:10:03.789442+03'),
(3, 7740400643, 20, 'ttt', '0939976687', 'rejected', '2025-11-05 21:13:30.406542+03');

-- Reset sequences to avoid key conflicts
SELECT setval('public.complaints_id_seq', (SELECT MAX(id) FROM public.complaints));
SELECT setval('public.donations_id_seq', (SELECT MAX(id) FROM public.donations));
SELECT setval('public.recharges_id_seq', (SELECT MAX(id) FROM public.recharges));
SELECT setval('public.users_id_seq', (SELECT MAX(id) FROM public.users));
SELECT setval('public.withdrawals_id_seq', (SELECT MAX(id) FROM public.withdrawals));
`;

const runMigration = async () => {
  console.log('Starting database migration: Resetting and populating from backup...');
  const client = await db.getClient();
  try {
    await client.query(migrationScript);
    console.log('✅ Database migration completed successfully.');
  } catch (err) {
    console.error('❌ Error during migration:', err);
  } finally {
    client.release();
    await db.end();
  }
};

runMigration();
