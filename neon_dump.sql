--
-- PostgreSQL database dump
--


-- Dumped from database version 17.5 (aa1f746)
-- Dumped by pg_dump version 18.0

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;


--
-- Name: complaints; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.complaints (
    id integer NOT NULL,
    telegram_id bigint NOT NULL,
    complaint text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    responded boolean DEFAULT false
);


--
-- Name: complaints_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.complaints_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: complaints_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.complaints_id_seq OWNED BY public.complaints.id;


--
-- Name: donations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.donations (
    id integer NOT NULL,
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


--
-- Name: donations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.donations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: donations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.donations_id_seq OWNED BY public.donations.id;
ALTER SEQUENCE public.donations_id_seq OWNED BY public.donations.id;


--
-- Name: ledger_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ledger_entries (
    id bigint NOT NULL,
    user_telegram_id bigint NOT NULL,
    ref_type text NOT NULL,
    ref_id bigint NOT NULL,
    entry_type text NOT NULL,
    amount numeric(10,2) NOT NULL,
    currency character(3) DEFAULT 'ETB'::bpchar NOT NULL,
    description text,
    idempotency_key text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ledger_entries_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT ledger_entries_entry_type_check CHECK ((entry_type = ANY (ARRAY['credit'::text, 'debit'::text]))),
    CONSTRAINT ledger_entries_ref_type_check CHECK ((ref_type = ANY (ARRAY['donation'::text, 'withdrawal'::text, 'adjustment'::text, 'recharge'::text])))
);


--
-- Name: ledger_entries_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ledger_entries_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ledger_entries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ledger_entries_id_seq OWNED BY public.ledger_entries.id;


--
-- Name: login_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.login_sessions (
    id integer NOT NULL,
    telegram_id bigint NOT NULL,
    token_hash character varying(255) NOT NULL,
    ip_address character varying(45),
    user_agent text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    last_activity timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    expires_at timestamp with time zone NOT NULL
);


--
-- Name: login_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.login_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: login_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.login_sessions_id_seq OWNED BY public.login_sessions.id;


--
-- Name: notification_sounds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_sounds (
    id text NOT NULL,
    label text NOT NULL,
    description text,
    file_path text NOT NULL,
    preview_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    slug text,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: notification_sounds_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notification_sounds_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notification_sounds_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notification_sounds_id_seq OWNED BY public.notification_sounds.id;


--
-- Name: otp_audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.otp_audit_logs (
    id integer NOT NULL,
    telegram_id bigint,
    action character varying(50),
    status character varying(20),
    error_message text,
    ip_address character varying(45),
    user_agent text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: otp_audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.otp_audit_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: otp_audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.otp_audit_logs_id_seq OWNED BY public.otp_audit_logs.id;



--
-- Name: otp_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.otp_tokens (
    id integer NOT NULL,
    telegram_id bigint NOT NULL,
    otp character varying(6) NOT NULL,
    is_used boolean DEFAULT false,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: otp_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.otp_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: otp_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.otp_tokens_id_seq OWNED BY public.otp_tokens.id;


--
-- Name: recharges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recharges (
    id integer NOT NULL,
    donor_id bigint NOT NULL,
    name_on_payment text,
    screenshot_file_id text,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    amount numeric(10,2)
);


--
-- Name: recharges_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.recharges_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: recharges_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.recharges_id_seq OWNED BY public.recharges.id;



--
-- Name: settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settings (
    key character varying(255) NOT NULL,
    value text NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    telegram_id bigint NOT NULL,
    username character varying(255),
    display_name character varying(255),
    role text NOT NULL,
    balance numeric(10,2) DEFAULT 0.00,
    link_uuid text,
    api_key text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    full_name text,
    social_link text,
    profile_picture_file_id text,
    registration_status text DEFAULT 'approved'::text NOT NULL,
    streamer_order integer DEFAULT 0 NOT NULL,
    phone_number text,
    last_login_at timestamp with time zone,
    login_attempts integer DEFAULT 0,
    locked_until timestamp with time zone,
    notification_sound text DEFAULT 'default_ping'::text,
    CONSTRAINT users_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'streamer'::text, 'donor'::text])))
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: withdrawals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.withdrawals (
    id integer NOT NULL,
    user_id bigint NOT NULL,
    amount integer NOT NULL,
    telebirr_username text,
    phone_number text,
    status character varying(50) DEFAULT 'pending'::character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: withdrawals_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.withdrawals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: withdrawals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.withdrawals_id_seq OWNED BY public.withdrawals.id;


--
-- Name: complaints id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.complaints ALTER COLUMN id SET DEFAULT nextval('public.complaints_id_seq'::regclass);


--
-- Name: donations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.donations ALTER COLUMN id SET DEFAULT nextval('public.donations_id_seq'::regclass);


--
-- Name: ledger_entries id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ledger_entries ALTER COLUMN id SET DEFAULT nextval('public.ledger_entries_id_seq'::regclass);


--
-- Name: login_sessions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.login_sessions ALTER COLUMN id SET DEFAULT nextval('public.login_sessions_id_seq'::regclass);


--
-- Name: notification_sounds id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_sounds ALTER COLUMN id SET DEFAULT nextval('public.notification_sounds_id_seq'::regclass);


--
-- Name: otp_audit_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.otp_audit_logs ALTER COLUMN id SET DEFAULT nextval('public.otp_audit_logs_id_seq'::regclass);


--
-- Name: otp_tokens id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.otp_tokens ALTER COLUMN id SET DEFAULT nextval('public.otp_tokens_id_seq'::regclass);


--
-- Name: recharges id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recharges ALTER COLUMN id SET DEFAULT nextval('public.recharges_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: withdrawals id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.withdrawals ALTER COLUMN id SET DEFAULT nextval('public.withdrawals_id_seq'::regclass);


--


--


--


--


--


--


--


--


--


--


--



--
-- Name: complaints_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.complaints_id_seq', 1, false);


--
-- Name: donations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.donations_id_seq', 1, false);


--
-- Name: ledger_entries_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.ledger_entries_id_seq', 1, false);


--
-- Name: login_sessions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.login_sessions_id_seq', 1, false);


--
-- Name: notification_sounds_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.notification_sounds_id_seq', 1, false);


--
-- Name: otp_audit_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.otp_audit_logs_id_seq', 1, false);


--
-- Name: otp_tokens_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.otp_tokens_id_seq', 1, false);


--
-- Name: recharges_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.recharges_id_seq', 1, false);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.users_id_seq', 1, false);


--
-- Name: withdrawals_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.withdrawals_id_seq', 1, false);


--
-- Name: complaints complaints_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.complaints
    ADD CONSTRAINT complaints_pkey PRIMARY KEY (id);


--
-- Security: enable Row Level Security on complaints
--

ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;


--
-- Name: donations donations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.donations
    ADD CONSTRAINT donations_pkey PRIMARY KEY (id);


--
-- Name: ledger_entries ledger_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ledger_entries
    ADD CONSTRAINT ledger_entries_pkey PRIMARY KEY (id);


--
-- Name: ledger_entries ledger_entries_uniq_ref; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ledger_entries
    ADD CONSTRAINT ledger_entries_uniq_ref UNIQUE (ref_type, ref_id, entry_type);


--
-- Name: login_sessions login_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.login_sessions
    ADD CONSTRAINT login_sessions_pkey PRIMARY KEY (id);


--
-- Name: login_sessions login_sessions_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.login_sessions
    ADD CONSTRAINT login_sessions_token_hash_key UNIQUE (token_hash);


--
-- Name: notification_sounds notification_sounds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_sounds
    ADD CONSTRAINT notification_sounds_pkey PRIMARY KEY (id);


--
-- Name: notification_sounds notification_sounds_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_sounds
    ADD CONSTRAINT notification_sounds_slug_key UNIQUE (slug);


--
-- Name: otp_audit_logs otp_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.otp_audit_logs
    ADD CONSTRAINT otp_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: otp_tokens otp_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.otp_tokens
    ADD CONSTRAINT otp_tokens_pkey PRIMARY KEY (id);


--
-- Name: recharges recharges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recharges
    ADD CONSTRAINT recharges_pkey PRIMARY KEY (id);


--
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (key);


--
-- Name: users users_api_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_api_key_key UNIQUE (api_key);


--
-- Name: users users_link_uuid_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_link_uuid_key UNIQUE (link_uuid);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_telegram_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_telegram_id_key UNIQUE (telegram_id);


--
-- Name: withdrawals withdrawals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.withdrawals
    ADD CONSTRAINT withdrawals_pkey PRIMARY KEY (id);


--
-- Name: idx_donations_streamer_paid_created_desc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_donations_streamer_paid_created_desc ON public.donations USING btree (streamer_id, created_at DESC) WHERE ((status)::text = 'paid'::text);


--
-- Name: idx_donations_streamer_paid_unplayed_created_desc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_donations_streamer_paid_unplayed_created_desc ON public.donations USING btree (streamer_id, created_at DESC) WHERE (((status)::text = 'paid'::text) AND (played = false));


--
-- Name: idx_donations_streamer_status_created_desc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_donations_streamer_status_created_desc ON public.donations USING btree (streamer_id, status, created_at DESC);


--
-- Name: idx_ledger_user_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ledger_user_created ON public.ledger_entries USING btree (user_telegram_id, created_at DESC);


--
-- Name: idx_ledger_user_credit_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ledger_user_credit_created ON public.ledger_entries USING btree (user_telegram_id, created_at DESC) WHERE (entry_type = 'credit'::text);


--
-- Name: idx_ledger_user_debit_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ledger_user_debit_created ON public.ledger_entries USING btree (user_telegram_id, created_at DESC) WHERE (entry_type = 'debit'::text);


--
-- Name: idx_ledger_user_entry_type_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ledger_user_entry_type_created ON public.ledger_entries USING btree (user_telegram_id, entry_type, created_at DESC);


--
-- Name: idx_login_sessions_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_login_sessions_expires ON public.login_sessions USING btree (expires_at);


--
-- Name: idx_login_sessions_telegram; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_login_sessions_telegram ON public.login_sessions USING btree (telegram_id);


--
-- Name: idx_otp_audit_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_otp_audit_action ON public.otp_audit_logs USING btree (action);


--
-- Name: idx_otp_audit_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_otp_audit_created ON public.otp_audit_logs USING btree (created_at);


--
-- Name: idx_otp_audit_telegram; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_otp_audit_telegram ON public.otp_audit_logs USING btree (telegram_id);


--
-- Name: idx_otp_tokens_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_otp_tokens_expires ON public.otp_tokens USING btree (expires_at);


--
-- Name: idx_otp_tokens_telegram; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_otp_tokens_telegram ON public.otp_tokens USING btree (telegram_id);


--
-- Name: idx_users_notification_sound; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_notification_sound ON public.users USING btree (notification_sound) WHERE (role = 'streamer'::text);


--
-- Name: idx_users_role_regstatus_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_role_regstatus_order ON public.users USING btree (role, registration_status, streamer_order);


--
-- Name: idx_withdrawals_user_approved_created_desc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_withdrawals_user_approved_created_desc ON public.withdrawals USING btree (user_id, created_at DESC) WHERE ((status)::text = 'approved'::text);


--
-- Name: idx_withdrawals_user_status_created_desc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_withdrawals_user_status_created_desc ON public.withdrawals USING btree (user_id, status, created_at DESC);


--
-- Name: uq_ledger_idempotency_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_ledger_idempotency_key ON public.ledger_entries USING btree (idempotency_key) WHERE (idempotency_key IS NOT NULL);


--
-- Name: donations donations_donor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.donations
    ADD CONSTRAINT donations_donor_id_fkey FOREIGN KEY (donor_id) REFERENCES public.users(telegram_id) ON DELETE CASCADE;


--
-- Name: donations donations_streamer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.donations
    ADD CONSTRAINT donations_streamer_id_fkey FOREIGN KEY (streamer_id) REFERENCES public.users(telegram_id) ON DELETE CASCADE;


--
-- Name: ledger_entries ledger_entries_user_telegram_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ledger_entries
    ADD CONSTRAINT ledger_entries_user_telegram_id_fkey FOREIGN KEY (user_telegram_id) REFERENCES public.users(telegram_id) ON DELETE CASCADE;


--
-- Name: recharges recharges_donor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recharges
    ADD CONSTRAINT recharges_donor_id_fkey FOREIGN KEY (donor_id) REFERENCES public.users(telegram_id) ON DELETE CASCADE;


--
-- Name: users users_notification_sound_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_notification_sound_fkey FOREIGN KEY (notification_sound) REFERENCES public.notification_sounds(id) ON UPDATE CASCADE;


--
-- Name: withdrawals withdrawals_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.withdrawals
    ADD CONSTRAINT withdrawals_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(telegram_id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--



