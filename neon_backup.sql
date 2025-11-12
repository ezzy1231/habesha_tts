--
-- PostgreSQL database dump
--

\restrict ru0ZPBXD6B6K9MI7aamhZhpXAcq7ZhavEtq1Wa0KwdFHbQtCZsuauj1EqnEmrBW

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
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: complaints; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.complaints (
    id integer NOT NULL,
    telegram_id bigint NOT NULL,
    complaint text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    responded boolean DEFAULT false
);


ALTER TABLE public.complaints OWNER TO neondb_owner;

--
-- Name: complaints_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.complaints_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.complaints_id_seq OWNER TO neondb_owner;

--
-- Name: complaints_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.complaints_id_seq OWNED BY public.complaints.id;


--
-- Name: donations; Type: TABLE; Schema: public; Owner: neondb_owner
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


ALTER TABLE public.donations OWNER TO neondb_owner;

--
-- Name: donations_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.donations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.donations_id_seq OWNER TO neondb_owner;

--
-- Name: donations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.donations_id_seq OWNED BY public.donations.id;


--
-- Name: login_sessions; Type: TABLE; Schema: public; Owner: neondb_owner
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


ALTER TABLE public.login_sessions OWNER TO neondb_owner;

--
-- Name: login_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.login_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.login_sessions_id_seq OWNER TO neondb_owner;

--
-- Name: login_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.login_sessions_id_seq OWNED BY public.login_sessions.id;


--
-- Name: otp_audit_logs; Type: TABLE; Schema: public; Owner: neondb_owner
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


ALTER TABLE public.otp_audit_logs OWNER TO neondb_owner;

--
-- Name: otp_audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.otp_audit_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.otp_audit_logs_id_seq OWNER TO neondb_owner;

--
-- Name: otp_audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.otp_audit_logs_id_seq OWNED BY public.otp_audit_logs.id;


--
-- Name: otp_tokens; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.otp_tokens (
    id integer NOT NULL,
    telegram_id bigint NOT NULL,
    otp character varying(6) NOT NULL,
    is_used boolean DEFAULT false,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.otp_tokens OWNER TO neondb_owner;

--
-- Name: otp_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.otp_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.otp_tokens_id_seq OWNER TO neondb_owner;

--
-- Name: otp_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.otp_tokens_id_seq OWNED BY public.otp_tokens.id;


--
-- Name: recharges; Type: TABLE; Schema: public; Owner: neondb_owner
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


ALTER TABLE public.recharges OWNER TO neondb_owner;

--
-- Name: recharges_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.recharges_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.recharges_id_seq OWNER TO neondb_owner;

--
-- Name: recharges_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.recharges_id_seq OWNED BY public.recharges.id;


--
-- Name: settings; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.settings (
    key character varying(255) NOT NULL,
    value text NOT NULL
);


ALTER TABLE public.settings OWNER TO neondb_owner;

--
-- Name: users; Type: TABLE; Schema: public; Owner: neondb_owner
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
    CONSTRAINT users_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'streamer'::text, 'donor'::text])))
);


ALTER TABLE public.users OWNER TO neondb_owner;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO neondb_owner;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: withdrawals; Type: TABLE; Schema: public; Owner: neondb_owner
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


ALTER TABLE public.withdrawals OWNER TO neondb_owner;

--
-- Name: withdrawals_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.withdrawals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.withdrawals_id_seq OWNER TO neondb_owner;

--
-- Name: withdrawals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.withdrawals_id_seq OWNED BY public.withdrawals.id;


--
-- Name: complaints id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.complaints ALTER COLUMN id SET DEFAULT nextval('public.complaints_id_seq'::regclass);


--
-- Name: donations id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.donations ALTER COLUMN id SET DEFAULT nextval('public.donations_id_seq'::regclass);


--
-- Name: login_sessions id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.login_sessions ALTER COLUMN id SET DEFAULT nextval('public.login_sessions_id_seq'::regclass);


--
-- Name: otp_audit_logs id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.otp_audit_logs ALTER COLUMN id SET DEFAULT nextval('public.otp_audit_logs_id_seq'::regclass);


--
-- Name: otp_tokens id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.otp_tokens ALTER COLUMN id SET DEFAULT nextval('public.otp_tokens_id_seq'::regclass);


--
-- Name: recharges id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.recharges ALTER COLUMN id SET DEFAULT nextval('public.recharges_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: withdrawals id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.withdrawals ALTER COLUMN id SET DEFAULT nextval('public.withdrawals_id_seq'::regclass);


--
-- Data for Name: complaints; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.complaints (id, telegram_id, complaint, created_at, responded) FROM stdin;
3	1863182826	birren melesulign	2025-11-05 19:05:55.777068+00	t
2	1863182826	birren melesulign	2025-11-05 19:04:36.435637+00	t
4	1863182826	ggs	2025-11-06 09:17:25.072173+00	t
1	1863182826	birren melesulign	2025-11-05 19:04:17.65808+00	t
5	1882908249	arif new	2025-11-08 17:03:12.66331+00	t
\.


--
-- Data for Name: donations; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.donations (id, streamer_id, donor_id, donor_name, amount, message, status, played, audio_file, created_at) FROM stdin;
32	7740400643	1863182826	\N	20	መልዕክትዎን	pending_payment	f	\N	2025-11-07 13:54:46.618579+00
33	7740400643	1863182826	\N	20	መልዕክትዎን	pending_payment	f	\N	2025-11-07 13:55:41.253915+00
34	7740400643	1863182826	\N	20	መልዕክትዎን	pending_payment	f	\N	2025-11-07 14:23:03.833436+00
35	7740400643	1863182826	\N	20	መልዕክትዎን	pending_payment	f	\N	2025-11-07 14:30:01.615213+00
36	7740400643	1863182826	\N	20	heloo	pending_payment	f	\N	2025-11-07 14:33:31.736106+00
37	7740400643	1863182826	\N	20	heloo	paid	t	donation_37_cloud.mp3	2025-11-07 14:38:42.551555+00
43	7740400643	1863182826	\N	20	የሁለት ዓመቱን ደም አፋሳሽ ጦርነት የቋጨው የፕሪቶሪያው የሰላም ስምምነት ግጭቱን ከማስቆም ባሻገር የተጣለበትን ተስፋ ያህል ተግባራዊ የሆነ አይመስልም።	paid	t	donation_43_gemini.mp3	2025-11-07 14:52:08.560775+00
38	7740400643	1863182826	\N	20	እባክዎ የልገሳ መልዕክትዎን አሁን ይጻፉ	paid	t	donation_38_gemini.mp3	2025-11-07 14:39:14.747003+00
49	7740400643	1863182826	\N	20	የሁለት ዓመቱን ደም አፋሳሽ ጦርነት የቋጨው የፕሪቶሪያው የሰላም ስምምነት ግጭቱን ከማስቆም ባሻገር የተጣለበትን ተስፋ ያህል ተግባራዊ የሆነ አይመስልም።	paid	t	donation_49_gemini.mp3	2025-11-07 16:01:34.486526+00
39	7740400643	1863182826	\N	20	የሁለት ዓመቱን ደም አፋሳሽ ጦርነት የቋጨው የፕሪቶሪያው የሰላም ስምምነት ግጭቱን ከማስቆም ባሻገር የተጣለበትን ተስፋ ያህል ተግባራዊ የሆነ አይመስልም።	paid	t	donation_39_gemini.mp3	2025-11-07 14:40:26.969746+00
50	7740400643	531509239	\N	20	የአካባቢ ህጎችን በማክበር ብክለትን በጋራ እንከላከል	paid	t	donation_50_gemini.mp3	2025-11-07 16:01:39.211623+00
40	7740400643	1863182826	\N	20	የሁለት ዓመቱን ደም አፋሳሽ ጦርነት የቋጨው የፕሪቶሪያው የሰላም ስምምነት ግጭቱን ከማስቆም ባሻገር የተጣለበትን ተስፋ ያህል ተግባራዊ የሆነ አይመስልም።	paid	t	donation_40_gemini.mp3	2025-11-07 14:43:47.574799+00
44	7740400643	1863182826	\N	20	የሁለት ዓመቱን ደም አፋሳሽ ጦርነት የቋጨው የፕሪቶሪያው የሰላም ስምምነት ግጭቱን ከማስቆም ባሻገር የተጣለበትን ተስፋ ያህል ተግባራዊ የሆነ አይመስልም።	paid	t	donation_44_gemini.mp3	2025-11-07 14:55:53.835439+00
41	7740400643	1863182826	\N	20	የሁለት ዓመቱን ደም አፋሳሽ ጦርነት የቋጨው የፕሪቶሪያው የሰላም ስምምነት ግጭቱን ከማስቆም ባሻገር የተጣለበትን ተስፋ ያህል ተግባራዊ የሆነ አይመስልም።	paid	t	donation_41_gemini.mp3	2025-11-07 14:44:38.957683+00
42	7740400643	1863182826	\N	20	የሁለት ዓመቱን ደም አፋሳሽ ጦርነት የቋጨው የፕሪቶሪያው የሰላም ስምምነት ግጭቱን ከማስቆም ባሻገር የተጣለበትን ተስፋ ያህል ተግባራዊ የሆነ አይመስልም።	paid	t	donation_42_gemini.mp3	2025-11-07 14:46:04.26803+00
61	7740400643	1863182826	\N	20	የሁለት ዓመቱን ደም አፋሳሽ ጦርነት የቋጨው የፕሪቶሪያው የሰላም ስምምነት ግጭቱን ከማስቆም ባሻገር የተጣለበትን ተስፋ ያህል ተግባራዊ የሆነ አይመስልም።	paid	t	donation_61_gemini.mp3	2025-11-07 18:33:09.226867+00
45	7740400643	1863182826	\N	20	የሁለት ዓመቱን ደም አፋሳሽ ጦርነት	paid	t	donation_45_gemini.mp3	2025-11-07 14:59:10.836586+00
51	8008028502	531509239	\N	20	የአካባቢ ህጎችን በማክበር ብክለትን በጋራ እንከላከል	paid	t	donation_51_gemini.mp3	2025-11-07 16:16:05.189649+00
46	7740400643	1863182826	\N	20	የሁለት ዓመቱን ደም አፋሳሽ ጦርነት	paid	t	donation_46_cloud.mp3	2025-11-07 15:24:01.099789+00
47	7740400643	531509239	\N	20	ገለታ ቡልቄ	paid	t	donation_47_gemini.mp3	2025-11-07 15:59:35.129737+00
52	8008028502	531509239	\N	20	What’s up, bro?	paid	t	donation_52_gemini.mp3	2025-11-07 16:28:41.214737+00
48	7740400643	531509239	\N	20	ገለታ ቡልቄ	paid	t	donation_48_gemini.mp3	2025-11-07 16:00:22.518058+00
53	8008028502	531509239	\N	20	Hello!	pending_payment	f	\N	2025-11-07 16:30:02.977422+00
58	8008028502	531509239	\N	20	ይበላሀል ጅቡ።	paid	t	donation_58_gemini.mp3	2025-11-07 18:14:58.782334+00
54	8008028502	531509239	\N	20	Hello there!!	paid	t	donation_54_gemini.mp3	2025-11-07 17:45:52.885806+00
55	8008028502	531509239	\N	20	የአካባቢ ህጎችን በማክበር ብክለትን በጋራ እንከላከል	paid	t	donation_55_gemini.mp3	2025-11-07 17:56:26.250544+00
56	8008028502	1863182826	\N	20	የሁለት ዓመቱን ደም አፋሳሽ ጦርነት የቋጨው የፕሪቶሪያው የሰላም ስምምነት ግጭቱን ከማስቆም ባሻገር የተጣለበትን ተስፋ ያህል ተግባራዊ የሆነ አይመስልም።	paid	t	donation_56_gemini.mp3	2025-11-07 18:02:36.55081+00
62	8008028502	531509239	\N	20	የሺ ተካ እንዴት ነሽ	paid	t	donation_62_gemini.mp3	2025-11-07 18:40:20.723344+00
63	8008028502	531509239	\N	20	ኧረ ሰዎች የት እንግባ	paid	t	donation_63_gemini.mp3	2025-11-07 18:43:09.091266+00
64	8008028502	531509239	\N	20	በለፈለፉ ባፍ ይጠፉ	paid	t	donation_64_gemini.mp3	2025-11-07 18:47:27.727174+00
65	8008028502	531509239	\N	20	እንኳን ለዓለም አቀፍ የአደጋ ስጋት ቅነሳ ቀን አደረሳችሁ!\n\n“ከአደጋ ይልቅ ለአደጋ አይበገሬነት ግንባታ ትኩረት እንስጥ”	paid	t	donation_65_gemini.mp3	2025-11-07 18:49:45.399417+00
66	8008028502	531509239	\N	20	የአካባቢ ህጎችን በማክበር ብክለትን በጋራ እንከላከል	paid	t	donation_66_gemini.mp3	2025-11-07 18:52:07.681044+00
67	7740400643	1863182826	\N	40	የአሜሪካ ፕሬዝዳንት ዶናልድ ትራምፕ አውሮፕላን ኤርፎርስ ዋን ወደ ሚቆምበት የአየር ኃይል ጦር ሠፈር የተላከ "አጠራጣሪ ጥቅል" ከተከፈተ በኋላ በርካታ ሰዎች መታመማቸው ተገለፀ።	paid	t	donation_67_gemini.mp3	2025-11-07 19:56:50.05753+00
68	7740400643	1863182826	\N	40	የአሜሪካ ፕሬዝዳንት ዶናልድ ትራምፕ አውሮፕላን ኤርፎርስ ዋን ወደ ሚቆምበት የአየር ኃይል ጦር ሠፈር የተላከ "አጠራጣሪ ጥቅል" ከተከፈተ በኋላ በርካታ ሰዎች መታመማቸው ተገለፀ።	paid	t	donation_68_gemini.mp3	2025-11-07 19:59:24.506586+00
72	7740400643	1863182826	\N	40	በዋሺንግተን ዲሲ አቅራቢያ በሜሪላንድ የሚገኘው የጥምር ኃይሉ አንድሩ ጦር ሠፈር (ጄቢኤ) ቃል አቀባይ ጥቅሉ የተከፈተበትን ሕንጻ ሠራተኞች ለቅቀው እንዲወጡ መደረጉን እና የታመሙት የሕክምና ክትትል ከተደረገላቸው በኋላ እንደተሻላቸው ተናግረዋል።	paid	t	donation_72_cloud.mp3	2025-11-08 10:54:36.443544+00
69	7740400643	1863182826	\N	40	በዋሺንግተን ዲሲ አቅራቢያ በሜሪላንድ የሚገኘው የጥምር ኃይሉ አንድሩ ጦር ሠፈር (ጄቢኤ) ቃል አቀባይ ጥቅሉ የተከፈተበትን ሕንጻ ሠራተኞች ለቅቀው እንዲወጡ መደረጉን እና የታመሙት የሕክምና ክትትል ከተደረገላቸው በኋላ እንደተሻላቸው ተናግረዋል።	paid	t	donation_69_gemini.mp3	2025-11-07 20:03:04.262877+00
70	7740400643	1863182826	\N	40	በዋሺንግተን ዲሲ አቅራቢያ በሜሪላንድ የሚገኘው የጥምር ኃይሉ አንድሩ ጦር ሠፈር (ጄቢኤ) ቃል አቀባይ ጥቅሉ የተከፈተበትን ሕንጻ ሠራተኞች ለቅቀው እንዲወጡ መደረጉን እና የታመሙት የሕክምና ክትትል ከተደረገላቸው በኋላ እንደተሻላቸው ተናግረዋል።	failed_moderation	f	\N	2025-11-08 09:26:18.500497+00
73	7740400643	1863182826	\N	40	በዋሺንግተን ዲሲ አቅራቢያ በሜሪላንድ የሚገኘው የጥምር ኃይሉ አንድሩ ጦር ሠፈር (ጄቢኤ) ቃል አቀባይ ጥቅሉ የተከፈተበትን ሕንጻ ሠራተኞች ለቅቀው እንዲወጡ መደረጉን እና የታመሙት የሕክምና ክትትል ከተደረገላቸው በኋላ እንደተሻላቸው ተናግረዋል።	paid	t	donation_73_gemini.mp3	2025-11-08 15:55:48.684644+00
71	7740400643	1863182826	\N	40	በዋሺንግተን ዲሲ አቅራቢያ በሜሪላንድ የሚገኘው የጥምር ኃይሉ አንድሩ ጦር ሠፈር (ጄቢኤ) ቃል አቀባይ ጥቅሉ የተከፈተበትን ሕንጻ ሠራተኞች ለቅቀው እንዲወጡ መደረጉን እና የታመሙት የሕክምና ክትትል ከተደረገላቸው በኋላ እንደተሻላቸው ተናግረዋል።	paid	t	donation_71_gemini.mp3	2025-11-08 09:27:12.067224+00
83	7740400643	1863182826	\N	40	በዋሺንግተን ዲሲ አቅራቢያ በሜሪላንድ የሚገኘው የጥምር ኃይሉ አንድሩ ጦር ሠፈር (ጄቢኤ) ቃል አቀባይ ጥቅሉ የተከፈተበትን ሕንጻ ሠራተኞች ለቅቀው እንዲወጡ መደረጉን እና የታመሙት የሕክምና ክትትል ከተደረገላቸው በኋላ እንደተሻላቸው ተናግረዋል።	paid	t	donation_83_gemini.mp3	2025-11-09 13:44:49.980905+00
89	7740400643	1863182826	\N	20	Maganu kaleche	paid	t	donation_89_cloud.mp3	2025-11-10 12:25:21.162684+00
84	7740400643	1863182826	\N	20	መልዕክትዎን	paid	t	donation_84_gemini.mp3	2025-11-10 09:49:43.32186+00
87	7740400643	1863182826	\N	20	ለአምስት ዓመታት በኃላፊነት የቆዩት ዋና ዳይሬክተሩ ዴቪ በበርካታ ውዝግቦች እና የአድሏዊ ክሶች ጫና በርትቶባቸው ነበር።	paid	t	donation_87_gemini.mp3	2025-11-10 11:46:50.772951+00
85	7740400643	1863182826	\N	20	ለአምስት ዓመታት በኃላፊነት የቆዩት ዋና ዳይሬክተሩ ዴቪ በበርካታ ውዝግቦች እና የአድሏዊ ክሶች ጫና በርትቶባቸው ነበር።	paid	t	donation_85_gemini.mp3	2025-11-10 10:03:51.02428+00
86	7740400643	1863182826	\N	20	ለአምስት ዓመታት በኃላፊነት የቆዩት ዋና ዳይሬክተሩ ዴቪ በበርካታ ውዝግቦች እና የአድሏዊ ክሶች ጫና በርትቶባቸው ነበር።	paid	t	donation_86_gemini.mp3	2025-11-10 10:46:10.142943+00
88	7740400643	1863182826	\N	20	ለአምስት ዓመታት በኃላፊነት የቆዩት ዋና ዳይሬክተሩ ዴቪ በበርካታ ውዝግቦች እና የአድሏዊ ክሶች ጫና በርትቶባቸው ነበር።	paid	t	donation_88_gemini.mp3	2025-11-10 11:49:28.912241+00
96	7740400643	1863182826	\N	20	ለአምስት ዓመታት በኃላፊነት የቆዩት ዋና ዳይሬክተሩ ዴቪ በበርካታ ውዝግቦች እና የአድሏዊ ክሶች ጫና በርትቶባቸው ነበር።	paid	t	donation_96_gemini.mp3	2025-11-10 13:15:33.967251+00
90	7740400643	1863182826	\N	20	Nuu buunnaa enttea	paid	t	donation_90_cloud.mp3	2025-11-10 12:28:36.678271+00
91	7740400643	1863182826	\N	20	ኑ ቡና እንጠጣ	paid	t	donation_91_gemini.mp3	2025-11-10 12:29:33.779168+00
95	7740400643	1863182826	\N	20	ለአምስት ዓመታት በኃላፊነት የቆዩት ዋና ዳይሬክተሩ ዴቪ በበርካታ ውዝግቦች እና የአድሏዊ ክሶች ጫና በርትቶባቸው ነበር።	paid	t	donation_95_gemini.mp3	2025-11-10 13:15:02.261954+00
92	7740400643	1863182826	\N	20	ኑ ቡና እንጠጣ	paid	t	donation_92_gemini.mp3	2025-11-10 12:30:09.274918+00
93	7740400643	1863182826	\N	20	ኑ ቡና እንጠጣ	paid	t	donation_93_gemini.mp3	2025-11-10 12:30:58.728319+00
94	7740400643	1863182826	\N	20	ኑ ቡና እንጠጣ	paid	t	donation_94_gemini.mp3	2025-11-10 12:31:34.506437+00
\.


--
-- Data for Name: login_sessions; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.login_sessions (id, telegram_id, token_hash, ip_address, user_agent, created_at, last_activity, expires_at) FROM stdin;
8	7212643479	c5c5aa991482f4f8f42f70f345c0b136d4808828d6ad44edc5f5cf4379f182c6	\N	\N	2025-11-10 13:30:48.593827+00	2025-11-10 13:30:48.593827+00	2025-11-17 13:30:48.593827+00
9	7212643479	81b2f91100ba5813bdb0041c11397890d454367920be425e2b32bf3c85e3e36f	\N	\N	2025-11-10 13:36:48.879544+00	2025-11-10 13:36:48.879544+00	2025-11-17 13:36:48.879544+00
10	7212643479	c62a1e32f037ac321513123f4a25b42c4f0bd58f3b1a285ce6382cdb52aad302	\N	\N	2025-11-10 13:53:45.974857+00	2025-11-10 13:53:45.974857+00	2025-11-17 13:53:45.974857+00
11	7212643479	a341e01f0f51623856bae39e5435568ee8e1817da3209988b61e60498e1c1e8f	\N	\N	2025-11-10 14:46:45.57678+00	2025-11-10 14:46:45.57678+00	2025-11-17 14:46:45.57678+00
3	7740400643	c02406063a8aeecf2ad994e7bfc4307cffe34487d263b24a6cffa2ab112a35aa	\N	\N	2025-11-10 10:00:41.643771+00	2025-11-10 11:04:38.701636+00	2025-11-17 10:00:41.643771+00
12	7740400643	2350f157d47fb955972260a8a10887283cd885578dbead7fe830d555db9cdf79	\N	\N	2025-11-11 19:08:47.700279+00	2025-11-11 19:08:48.126243+00	2025-11-18 19:08:47.700279+00
5	7740400643	030d4b867dd9d6b17768ffc81745afb79489f4de271ca5a5b1665f75e1a0af07	\N	\N	2025-11-10 11:58:36.314251+00	2025-11-10 11:58:36.314251+00	2025-11-17 11:58:36.314251+00
6	7740400643	181aa1ea2dba92db826ef38542cbbd7be87199a15ec673fb98fc0f9d6d5263cf	\N	\N	2025-11-10 11:59:41.316516+00	2025-11-10 11:59:41.316516+00	2025-11-17 11:59:41.316516+00
\.


--
-- Data for Name: otp_audit_logs; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.otp_audit_logs (id, telegram_id, action, status, error_message, ip_address, user_agent, created_at) FROM stdin;
1	7740400643	otp_requested	success	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-10 09:07:37.009909+00
2	7740400643	otp_verified	failed	column " days" does not exist	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-10 09:07:51.885167+00
3	7740400643	otp_verified	failed	expired_or_missing	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-10 09:08:08.888906+00
4	7740400643	otp_verified	failed	expired_or_missing	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-10 09:11:02.91414+00
5	7740400643	otp_requested	success	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-10 09:11:08.975609+00
6	7740400643	otp_verified	failed	column " days" does not exist	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-10 09:11:22.947169+00
7	7740400643	otp_requested	success	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-10 09:24:23.286459+00
8	7740400643	otp_verified	success	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-10 09:24:36.126525+00
9	7740400643	logout	success	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-10 09:24:58.29054+00
10	7740400643	otp_verified	failed	expired_or_missing	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-10 09:25:04.942873+00
11	7740400643	otp_requested	success	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-10 09:25:07.22684+00
12	7740400643	otp_verified	success	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-10 09:25:19.009505+00
13	7740400643	logout	success	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-10 09:58:44.99869+00
14	7740400643	otp_requested	success	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-10 09:59:03.270901+00
15	7740400643	otp_verified	success	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-10 10:00:41.905622+00
16	7740400643	otp_requested	success	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-10 11:39:51.021982+00
17	7740400643	otp_verified	success	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-10 11:40:22.041029+00
18	7740400643	otp_requested	success	\N	127.0.0.1	Mozilla/5.0 (iPhone; CPU iPhone OS 26_0_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0.7390.96 Mobile/15E148 Safari/604.1	2025-11-10 11:58:03.091306+00
19	7740400643	otp_verified	success	\N	127.0.0.1	Mozilla/5.0 (iPhone; CPU iPhone OS 26_0_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0.7390.96 Mobile/15E148 Safari/604.1	2025-11-10 11:58:36.408809+00
20	7740400643	otp_verified	failed	expired_or_missing	127.0.0.1	Mozilla/5.0 (iPhone; CPU iPhone OS 26_0_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0.7390.96 Mobile/15E148 Safari/604.1	2025-11-10 11:58:58.215539+00
21	7740400643	otp_requested	success	\N	127.0.0.1	Mozilla/5.0 (iPhone; CPU iPhone OS 26_0_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0.7390.96 Mobile/15E148 Safari/604.1	2025-11-10 11:59:02.01162+00
22	7740400643	otp_verified	failed	mismatch	127.0.0.1	Mozilla/5.0 (iPhone; CPU iPhone OS 26_0_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0.7390.96 Mobile/15E148 Safari/604.1	2025-11-10 11:59:22.874018+00
23	7740400643	otp_verified	success	\N	127.0.0.1	Mozilla/5.0 (iPhone; CPU iPhone OS 26_0_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0.7390.96 Mobile/15E148 Safari/604.1	2025-11-10 11:59:41.401277+00
24	7740400643	logout	success	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-10 13:13:48.465582+00
25	7740400643	otp_requested	success	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-10 13:13:53.465216+00
26	7740400643	otp_verified	success	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-10 13:14:05.951275+00
27	7212643479	otp_requested	success	\N	127.0.0.1	Mozilla/5.0 (iPhone; CPU iPhone OS 26_0_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0.7390.96 Mobile/15E148 Safari/604.1	2025-11-10 13:30:10.361674+00
28	7212643479	otp_verified	success	\N	127.0.0.1	Mozilla/5.0 (iPhone; CPU iPhone OS 26_0_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0.7390.96 Mobile/15E148 Safari/604.1	2025-11-10 13:30:48.659012+00
29	7212643479	otp_requested	success	\N	127.0.0.1	Mozilla/5.0 (iPhone; CPU iPhone OS 26_0_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0.7390.96 Mobile/15E148 Safari/604.1	2025-11-10 13:36:24.386533+00
30	7212643479	otp_verified	success	\N	127.0.0.1	Mozilla/5.0 (iPhone; CPU iPhone OS 26_0_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0.7390.96 Mobile/15E148 Safari/604.1	2025-11-10 13:36:48.946509+00
31	7212643479	otp_requested	success	\N	127.0.0.1	Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0.1 Mobile/15E148 Safari/604.1	2025-11-10 13:52:45.194488+00
32	7212643479	otp_requested	success	\N	127.0.0.1	Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0.1 Mobile/15E148 Safari/604.1	2025-11-10 13:53:23.355896+00
33	7212643479	otp_verified	success	\N	127.0.0.1	Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0.1 Mobile/15E148 Safari/604.1	2025-11-10 13:53:46.051271+00
34	7212643479	otp_requested	success	\N	127.0.0.1	Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1	2025-11-10 14:46:21.857105+00
35	7212643479	otp_verified	success	\N	127.0.0.1	Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1	2025-11-10 14:46:45.661769+00
36	7740400643	logout	success	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-11 19:08:08.766091+00
37	7740400643	otp_requested	success	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-11 19:08:16.062471+00
38	7740400643	otp_verified	success	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-11 19:08:47.776244+00
\.


--
-- Data for Name: otp_tokens; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.otp_tokens (id, telegram_id, otp, is_used, expires_at, created_at) FROM stdin;
1	7740400643	708817	t	2025-11-10 09:17:37.445+00	2025-11-10 09:07:36.753748+00
2	7740400643	595042	t	2025-11-10 09:21:09.404+00	2025-11-10 09:11:08.715159+00
3	7740400643	191636	t	2025-11-10 09:34:23.285+00	2025-11-10 09:24:22.601579+00
4	7740400643	980288	t	2025-11-10 09:35:07.646+00	2025-11-10 09:25:06.969914+00
5	7740400643	615387	t	2025-11-10 10:09:03.583+00	2025-11-10 09:59:02.917876+00
6	7740400643	276682	t	2025-11-10 11:49:50.887+00	2025-11-10 11:39:50.927233+00
7	7740400643	783977	t	2025-11-10 12:08:02.958+00	2025-11-10 11:58:02.999468+00
8	7740400643	534179	t	2025-11-10 12:09:01.885+00	2025-11-10 11:59:01.926814+00
9	7740400643	624572	t	2025-11-10 13:23:53.361+00	2025-11-10 13:13:53.393061+00
10	7212643479	528771	t	2025-11-10 13:40:10.218+00	2025-11-10 13:30:10.249169+00
11	7212643479	942000	t	2025-11-10 13:46:24.285+00	2025-11-10 13:36:24.318544+00
13	7212643479	382973	t	2025-11-10 14:03:23.26+00	2025-11-10 13:53:23.290813+00
14	7212643479	748161	t	2025-11-10 14:56:21.751+00	2025-11-10 14:46:21.782215+00
15	7740400643	329482	t	2025-11-11 19:18:15.961+00	2025-11-11 19:08:15.992872+00
\.


--
-- Data for Name: recharges; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.recharges (id, donor_id, name_on_payment, screenshot_file_id, status, created_at, amount) FROM stdin;
1	1863182826	Tasew	AgACAgQAAxkBAAIU6GkLESutDBjzKvW4tKzcmYb60VkuAAICC2sbR-hgUMoCccSzi4paAQADAgADeAADNgQ	approved	2025-11-05 08:56:12.807708+00	1000.00
4	1863182826	Tasew	AgACAgQAAxkBAAIXw2kN-kAyFPE_wsHJm4D0ygkl23R1AAKOC2sbuKdxUIwYvVni2g66AQADAgADeQADNgQ	approved	2025-11-07 13:55:13.447516+00	1000.00
5	531509239	Esrom	AgACAgQAAxkBAAIYN2kOFw7bGManAAGVwLq0VsyNaWu3HAACTgtrGziHeFBOBtIUGY0pkAEAAwIAA3gAAzYE	approved	2025-11-07 15:58:07.153035+00	100.00
6	531509239	Esrom	AgACAgQAAxkBAAIYe2kOL-e9-VOI3-aVYUhn-hQbCyxrAAKEC2sbOId4UM1Tb3SOwmbIAQADAgADeQADNgQ	approved	2025-11-07 17:44:08.600613+00	1000.00
\.


--
-- Data for Name: settings; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.settings (key, value) FROM stdin;
maxChars	600
stepChars	100
basePrice	20
incrementPrice	20
filteredWords	["testword"]
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.users (id, telegram_id, username, display_name, role, balance, link_uuid, api_key, created_at, full_name, social_link, profile_picture_file_id, registration_status, streamer_order, phone_number, last_login_at, login_attempts, locked_until) FROM stdin;
16	1882908249	endagegnehu	endagegnehu	donor	0.00	\N	\N	2025-11-09 15:25:51.901692+00	\N	\N	\N	approved	0	\N	\N	0	\N
10	8008028502	Hezron	\N	streamer	220.00	8471c590-675c-4ada-b423-0f0c38150138	7d722e7bb58c3a0a77dbe86d65c1f4cac67a15d68fedc170dae7b3f675949d4f	2025-11-07 16:12:25.849811+00	Esrom	https://youtube.com/@ezzhuu?si=JE02p6arIiBGESKL	AgACAgQAAxkBAAIYX2kOGmnUMYHcDHM4-ymh9HBSc5vwAAIwDmsbSQhwUMbnyUfrPLTZAQADAgADeAADNgQ	approved	1	251967298383	\N	0	\N
9	531509239	Esrommek	ኤስሮም	donor	840.00	\N	\N	2025-11-07 15:57:17.121565+00	\N	\N	\N	approved	0	\N	\N	0	\N
1	1863182826	Lie_ed	ገበየሁ	donor	120.00	\N	\N	2025-11-05 08:55:32.145545+00	\N	\N	\N	approved	0	\N	\N	0	\N
15	6768916648	c137E	\N	streamer	0.00	3dfea731-0980-42d3-8ff8-1f202e0c0473	6d7cb7ce8f036a27175a51480a85299161cc94e58167ddfa065f060df8018550	2025-11-09 00:14:57.362578+00	Mrgoodman	https://mrgoodman.com	AgACAgEAAxkBAAIZg2kPyDaZP2zbkNQz8qobPdMbRnOQAAJgC2sbxNCARGeXPovm82H9AQADAgADeQADNgQ	approved	0	251966677555	\N	0	\N
20	7212643479	Ez	\N	streamer	0.00	800a571e-5fbd-4392-b823-13b52c407fe8	089c6b929c34a146637f52188cd2b65b1a1605c9ed89feb80d8b425d50a833fc	2025-11-10 13:29:01.214619+00	Ezzy	https://www.tiktok.com/@ezzhuu?_r=1&_t=ZM-91HU14ebQNc	AgACAgQAAxkBAAIZ32kRxQQbtrLc-KX5_b7x2a78dTMlAAKIC2sbNpqRUE0smhm82s7QAQADAgADdwADNgQ	approved	0	251939976687	2025-11-10 14:46:45.501787+00	0	\N
8	7740400643	EZHU	\N	streamer	0.00	c936b202-b401-4718-9cf7-ce224676965b	523cab692a4e7b36bd3f64ab02c220cac41c6e921c66ce77b84e4532f89249d9	2025-11-07 13:53:39.023321+00	EZHUU	https://youtube.com/@ezzhuu?si=rPR7uGv3ity5QFwo	AgACAgQAAxkBAAIXtWkN-eIs6GrMZ9AcRx7EEjy1jjrFAAKwC2sbTY9xUCYbgVdUILghAQADAgADeQADNgQ	approved	0	251939976687	2025-11-11 19:08:47.629385+00	0	\N
\.


--
-- Data for Name: withdrawals; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.withdrawals (id, user_id, amount, telebirr_username, phone_number, status, created_at) FROM stdin;
4	7740400643	420	tasew	0939976687	approved	2025-11-08 06:56:43.06922+00
5	7740400643	80	Ezhu	0939976687	approved	2025-11-08 15:34:07.197362+00
6	7740400643	40	Taswew	0939976687	pending	2025-11-09 15:13:13.383903+00
7	7740400643	20	tts	0939976687	pending	2025-11-09 15:13:53.64617+00
8	7740400643	340	Gent	09345689	approved	2025-11-10 13:16:59.62594+00
\.


--
-- Name: complaints_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.complaints_id_seq', 5, true);


--
-- Name: donations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.donations_id_seq', 96, true);


--
-- Name: login_sessions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.login_sessions_id_seq', 12, true);


--
-- Name: otp_audit_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.otp_audit_logs_id_seq', 38, true);


--
-- Name: otp_tokens_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.otp_tokens_id_seq', 15, true);


--
-- Name: recharges_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.recharges_id_seq', 7, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.users_id_seq', 20, true);


--
-- Name: withdrawals_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.withdrawals_id_seq', 8, true);


--
-- Name: complaints complaints_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.complaints
    ADD CONSTRAINT complaints_pkey PRIMARY KEY (id);


--
-- Name: donations donations_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.donations
    ADD CONSTRAINT donations_pkey PRIMARY KEY (id);


--
-- Name: login_sessions login_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.login_sessions
    ADD CONSTRAINT login_sessions_pkey PRIMARY KEY (id);


--
-- Name: login_sessions login_sessions_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.login_sessions
    ADD CONSTRAINT login_sessions_token_hash_key UNIQUE (token_hash);


--
-- Name: otp_audit_logs otp_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.otp_audit_logs
    ADD CONSTRAINT otp_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: otp_tokens otp_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.otp_tokens
    ADD CONSTRAINT otp_tokens_pkey PRIMARY KEY (id);


--
-- Name: recharges recharges_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.recharges
    ADD CONSTRAINT recharges_pkey PRIMARY KEY (id);


--
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (key);


--
-- Name: users users_api_key_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_api_key_key UNIQUE (api_key);


--
-- Name: users users_link_uuid_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_link_uuid_key UNIQUE (link_uuid);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_telegram_id_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_telegram_id_key UNIQUE (telegram_id);


--
-- Name: withdrawals withdrawals_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.withdrawals
    ADD CONSTRAINT withdrawals_pkey PRIMARY KEY (id);


--
-- Name: idx_login_sessions_expires; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_login_sessions_expires ON public.login_sessions USING btree (expires_at);


--
-- Name: idx_login_sessions_telegram; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_login_sessions_telegram ON public.login_sessions USING btree (telegram_id);


--
-- Name: idx_otp_audit_action; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_otp_audit_action ON public.otp_audit_logs USING btree (action);


--
-- Name: idx_otp_audit_created; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_otp_audit_created ON public.otp_audit_logs USING btree (created_at);


--
-- Name: idx_otp_audit_telegram; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_otp_audit_telegram ON public.otp_audit_logs USING btree (telegram_id);


--
-- Name: idx_otp_tokens_expires; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_otp_tokens_expires ON public.otp_tokens USING btree (expires_at);


--
-- Name: idx_otp_tokens_telegram; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_otp_tokens_telegram ON public.otp_tokens USING btree (telegram_id);


--
-- Name: donations donations_donor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.donations
    ADD CONSTRAINT donations_donor_id_fkey FOREIGN KEY (donor_id) REFERENCES public.users(telegram_id) ON DELETE CASCADE;


--
-- Name: donations donations_streamer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.donations
    ADD CONSTRAINT donations_streamer_id_fkey FOREIGN KEY (streamer_id) REFERENCES public.users(telegram_id) ON DELETE CASCADE;


--
-- Name: recharges recharges_donor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.recharges
    ADD CONSTRAINT recharges_donor_id_fkey FOREIGN KEY (donor_id) REFERENCES public.users(telegram_id) ON DELETE CASCADE;


--
-- Name: withdrawals withdrawals_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.withdrawals
    ADD CONSTRAINT withdrawals_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(telegram_id) ON DELETE CASCADE;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: cloud_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE cloud_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO neon_superuser WITH GRANT OPTION;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: cloud_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE cloud_admin IN SCHEMA public GRANT ALL ON TABLES TO neon_superuser WITH GRANT OPTION;


--
-- PostgreSQL database dump complete
--

\unrestrict ru0ZPBXD6B6K9MI7aamhZhpXAcq7ZhavEtq1Wa0KwdFHbQtCZsuauj1EqnEmrBW

