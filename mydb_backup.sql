--
-- PostgreSQL database dump
--

\restrict NCY5XHCjmBXSVTtmJKxEkxgPdzEdJaIoUVnRApAu0O5tkD5GUvah1tSszd3wkc0

-- Dumped from database version 18.0
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
-- Name: complaints; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.complaints (
    id integer NOT NULL,
    telegram_id bigint NOT NULL,
    complaint text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    responded boolean DEFAULT false
);


ALTER TABLE public.complaints OWNER TO postgres;

--
-- Name: complaints_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.complaints_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.complaints_id_seq OWNER TO postgres;

--
-- Name: complaints_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.complaints_id_seq OWNED BY public.complaints.id;


--
-- Name: donations; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.donations OWNER TO postgres;

--
-- Name: donations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.donations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.donations_id_seq OWNER TO postgres;

--
-- Name: donations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.donations_id_seq OWNED BY public.donations.id;


--
-- Name: recharges; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.recharges OWNER TO postgres;

--
-- Name: recharges_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.recharges_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.recharges_id_seq OWNER TO postgres;

--
-- Name: recharges_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.recharges_id_seq OWNED BY public.recharges.id;


--
-- Name: settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.settings (
    key character varying(255) NOT NULL,
    value text NOT NULL
);


ALTER TABLE public.settings OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
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
    CONSTRAINT users_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'streamer'::text, 'donor'::text])))
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: withdrawals; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.withdrawals OWNER TO postgres;

--
-- Name: withdrawals_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.withdrawals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.withdrawals_id_seq OWNER TO postgres;

--
-- Name: withdrawals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.withdrawals_id_seq OWNED BY public.withdrawals.id;


--
-- Name: complaints id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.complaints ALTER COLUMN id SET DEFAULT nextval('public.complaints_id_seq'::regclass);


--
-- Name: donations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.donations ALTER COLUMN id SET DEFAULT nextval('public.donations_id_seq'::regclass);


--
-- Name: recharges id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recharges ALTER COLUMN id SET DEFAULT nextval('public.recharges_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: withdrawals id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.withdrawals ALTER COLUMN id SET DEFAULT nextval('public.withdrawals_id_seq'::regclass);


--
-- Data for Name: complaints; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.complaints (id, telegram_id, complaint, created_at, responded) FROM stdin;
1	1863182826	birren melesulign	2025-11-05 22:04:17.65808+03	f
3	1863182826	birren melesulign	2025-11-05 22:05:55.777068+03	t
2	1863182826	birren melesulign	2025-11-05 22:04:36.435637+03	t
4	1863182826	ggs	2025-11-06 12:17:25.072173+03	t
\.


--
-- Data for Name: donations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.donations (id, streamer_id, donor_id, donor_name, amount, message, status, played, audio_file, created_at) FROM stdin;
30	7740400643	1863182826	\N	20	ቀጣሪው ድርጅት የሎጅስቲክስ እንዲሁም የመስተንግዶ ሥልጠና እንደሚሰጥ ገልጿል	paid	t	donation_30_cloud.mp3	2025-11-05 21:49:11.200525+03
21	7740400643	1863182826	\N	20	ቀጣሪው ድርጅት የሎጅስቲክስ እንዲሁም የመስተንግዶ ሥልጠና እንደሚሰጥ ገልጿል	paid	t	donation_21_gemini.mp3	2025-11-05 21:41:30.453708+03
31	7740400643	1863182826	\N	20	esrom	pending_payment	f	\N	2025-11-06 11:51:01.911468+03
22	7740400643	1863182826	\N	20	ቀጣሪው ድርጅት የሎጅስቲክስ እንዲሁም የመስተንግዶ ሥልጠና እንደሚሰጥ ገልጿል	paid	t	donation_22_gemini.mp3	2025-11-05 21:45:31.410558+03
23	7740400643	1863182826	\N	20	ቀጣሪው ድርጅት የሎጅስቲክስ እንዲሁም የመስተንግዶ ሥልጠና እንደሚሰጥ ገልጿል	paid	t	donation_23_gemini.mp3	2025-11-05 21:46:23.350185+03
24	7740400643	1863182826	\N	20	ቀጣሪው ድርጅት የሎጅስቲክስ እንዲሁም የመስተንግዶ ሥልጠና እንደሚሰጥ ገልጿል	paid	t	donation_24_gemini.mp3	2025-11-05 21:47:01.327556+03
32	7740400643	1863182826	\N	20	ማምዳኒን ለመጣል ከናታንያሁ እስከ ትራምፕ፣ ከኤለን መስክ እስከ ሪፐብሊካን ፓርቲ ያልፈነቀሉት ድንጋይ የለም።	paid	t	donation_32_gemini.mp3	2025-11-06 11:54:38.897175+03
26	7212643479	1863182826	\N	20	ቀጣሪው ድርጅት የሎጅስቲክስ እንዲሁም የመስተንግዶ ሥልጠና እንደሚሰጥ ገልጿል	pending_payment	f	\N	2025-11-05 21:47:44.226786+03
25	7740400643	1863182826	\N	20	ቀጣሪው ድርጅት የሎጅስቲክስ እንዲሁም የመስተንግዶ ሥልጠና እንደሚሰጥ ገልጿል	paid	t	donation_25_cloud.mp3	2025-11-05 21:47:34.726287+03
27	7740400643	1863182826	\N	20	ቀጣሪው ድርጅት የሎጅስቲክስ እንዲሁም የመስተንግዶ ሥልጠና እንደሚሰጥ ገልጿል	paid	t	donation_27_cloud.mp3	2025-11-05 21:47:47.737797+03
28	7740400643	1863182826	\N	20	ቀጣሪው ድርጅት የሎጅስቲክስ እንዲሁም የመስተንግዶ ሥልጠና እንደሚሰጥ ገልጿል	paid	t	donation_28_cloud.mp3	2025-11-05 21:47:57.602755+03
33	7740400643	1863182826	\N	20	በመጨረሻ ግን የጭቁን ኒው ዮርካዊያን ሕዝብ ድምፅ አሸነፈ።	paid	t	donation_33_gemini.mp3	2025-11-06 11:55:24.849686+03
29	7740400643	1863182826	\N	20	ቀጣሪው ድርጅት የሎጅስቲክስ እንዲሁም የመስተንግዶ ሥልጠና እንደሚሰጥ ገልጿል	paid	t	donation_29_gemini.mp3	2025-11-05 21:48:07.387316+03
14	7740400643	1863182826	\N	20	አዳው ሥራዋን በጀመረችበት ቀን ስህተት መሥራቷን ተገነዘበች።	paid	t	donation_14_gemini.mp3	2025-11-05 20:36:32.987665+03
15	7740400643	1863182826	\N	20	መልዕክትዎን	paid	t	donation_15_cloud.mp3	2025-11-05 21:26:09.370341+03
37	7740400643	1863182826	\N	20	በኒው ዮርክ ጎዳናዎች እየዞረ የጀብሎ ነጋዴ ሳይቀር እያስቆመ አቅፎ ይስማል። ጆሮ ሰጥቶ ይሰማል። የቢጫ ታክሲ ሾፌሮችን ጊዜ ሰጥቶ ምሬታቸውን ያዳምጣል።	paid	t	donation_37_gemini.mp3	2025-11-06 11:58:44.83496+03
16	7740400643	1863182826	\N	20	hey	paid	t	donation_16_cloud.mp3	2025-11-05 21:32:50.458971+03
17	7740400643	1863182826	\N	20	hey	paid	t	donation_17_gemini.mp3	2025-11-05 21:33:08.715525+03
18	7740400643	1863182826	\N	20	hello	paid	t	donation_18_cloud.mp3	2025-11-05 21:36:29.824833+03
19	7740400643	1863182826	\N	20	hello	paid	t	donation_19_gemini.mp3	2025-11-05 21:36:52.204748+03
34	7740400643	1863182826	\N	20	በወጣትነቱ በራፕ ሙዚቃ እስክስ ቅንጥስ ብሏል። ለነገሩ አሁንም ወጣት ነው።	paid	t	donation_34_gemini.mp3	2025-11-06 11:56:55.71442+03
20	7740400643	1863182826	\N	20	አላቡጋ ስታርት ፕሮግራም' ለተባለ ተቋም አመልክታ ነበር የተቀጠረችው። ከ18 እስከ 22 ዓመት ያሉ ሴቶች ላይ ያተኮረ የሥራ መስክ እንደሆነ ተገልጾላታል	paid	t	donation_20_gemini.mp3	2025-11-05 21:39:05.878193+03
35	7740400643	1863182826	\N	20	ታላቋን የአሜሪካ ከተማ ከንቲባነት ያሸነፈበት የድል ደግስ ላይም እንደመደነስ እየቃጣው ነበር።	paid	t	donation_35_gemini.mp3	2025-11-06 11:58:22.730463+03
39	7740400643	1863182826	\N	30	እሱ ገና 35 አልደፈነም። የወቅቱ የኒው ዮርክ ከንቲባ አንድሩ ኩሞ የማምዳኒ ዕድሜ እጥፍ ናቸው። እሱን ለማሸነፍ ፓርቲ ሳይቀር ቀያይረዋል። መጀመርያ ዲሞክራት ነበሩ። ቀጥሎ በግል ተወዳደሩ አልቻሉትም።	paid	t	donation_39_gemini.mp3	2025-11-06 12:00:49.058977+03
38	7740400643	1863182826	\N	30	እሱ ገና 35 አልደፈነም። የወቅቱ የኒው ዮርክ ከንቲባ አንድሩ ኩሞ የማምዳኒ ዕድሜ እጥፍ ናቸው። እሱን ለማሸነፍ ፓርቲ ሳይቀር ቀያይረዋል። መጀመርያ ዲሞክራት ነበሩ። ቀጥሎ በግል ተወዳደሩ አልቻሉትም።	paid	t	donation_38_gemini.mp3	2025-11-06 11:59:47.876784+03
40	7740400643	1863182826	\N	40	እሱ ገና 35 አልደፈነም። የወቅቱ የኒው ዮርክ ከንቲባ አንድሩ ኩሞ የማምዳኒ ዕድሜ እጥፍ ናቸው። እሱን ለማሸነፍ ፓርቲ ሳይቀር ቀያይረዋል። መጀመርያ ዲሞክራት ነበሩ። ቀጥሎ በግል ተወዳደሩ አልቻሉትም።	paid	t	donation_40_gemini.mp3	2025-11-06 12:01:55.941905+03
42	7740400643	1863182826	\N	40	የተወለደው በአፍሪካዊቷ ኡጋንዳ ውስጥ ነው። የቤተሰቦቹ ዘር ከሕንድ ነው። ኤዲያሚን ዳዳ በሕንዶች ላይ ሲዘምት ወላጆቹ ወደ ከኡጋንዳ እንግሊዝ ሸሹ። ኤዲያሚን ሲሞት ወደ ኡጋንዳ ተመለሱ።	paid	t	donation_42_gemini.mp3	2025-11-06 12:04:03.736203+03
44	7740400643	1863182826	\N	20	እሱ በሰባት ዓመቱ አሜሪካ ገባ። የኒው ዮርኳ ክዊንስ ክፍለ ከተማ አቅልጣ በድጋሚ ወለደችው። አሁን ማምዳኒ ማን ነው ቢባል "ኒው ዮርካዊ" ብቻ ይሆናል መልሱ።	failed_moderation	f	\N	2025-11-06 12:18:55.048928+03
45	7740400643	1863182826	\N	20	እሱ በሰባት ዓመቱ አሜሪካ ገባ። የኒው ዮርኳ ክዊንስ ክፍለ ከተማ አቅልጣ በድጋሚ ወለደችው። አሁን ማምዳኒ ማን ነው ቢባል "ኒው ዮርካዊ" ብቻ ይሆናል መልሱ።	paid	t	donation_45_gemini.mp3	2025-11-06 12:19:51.701229+03
46	7740400643	1863182826	\N	40	ሲል የመጤዎች ከተማ ለሆነችው ለታላቋ ኒው ዮርክ ከንቲባነት ለመረጡት ኒው ዮርካውያን ምሥጋና ባቀረበበት ጊዜ ኢትዮጵያውያኑን ኒው ዮርከሮች በስም ጠርቶ አመሥግኗል።	paid	t	donation_46_gemini.mp3	2025-11-06 12:20:55.963925+03
47	7740400643	531509239	\N	20	የጀሞ ሰው አይመቸኝም	paid	t	donation_47_gemini.mp3	2025-11-06 12:21:34.98016+03
61	7740400643	531509239	\N	20	ይበላሀል ጂቡ ኒገ።	paid	t	donation_61_gemini.mp3	2025-11-06 12:53:17.53085+03
48	7740400643	531509239	\N	20	ቢኒ ጥሬ ስጋ ሲበላ ብታዩት። በየሱስ ስም	paid	t	donation_48_gemini.mp3	2025-11-06 12:23:34.905062+03
49	7740400643	1863182826	\N	20	ቢኒ አሁን ቦርጩን አእያሸ ነው።	paid	t	donation_49_gemini.mp3	2025-11-06 12:25:42.019188+03
50	7740400643	1863182826	\N	20	ቢኒ አሁን ቦርጩን እያሸ ነው።	paid	t	donation_50_gemini.mp3	2025-11-06 12:26:30.11202+03
51	7740400643	531509239	\N	20	የኤላ መላጣ ሲያዩት በቆረጣ	pending_payment	f	\N	2025-11-06 12:27:04.290334+03
62	7740400643	531509239	\N	20	ኒገ ኒገ ኒገ ኒገ ኒገ ኒገ ኒገ	paid	t	donation_62_gemini.mp3	2025-11-06 12:54:25.253413+03
52	7740400643	531509239	\N	20	የኤላን መላጣ ሲያዩት በቆረጣ	paid	t	donation_52_gemini.mp3	2025-11-06 12:27:23.429185+03
53	7740400643	1863182826	\N	20	ቢኒ አሁን ቁርጥ በልቶ ፣ ቦርጩን እያሸ ነው።	paid	t	donation_53_gemini.mp3	2025-11-06 12:27:46.843975+03
54	7740400643	531509239	\N	20	ኧረ ሚልፍ አማረኝ ሰዎች	paid	t	donation_54_gemini.mp3	2025-11-06 12:29:21.1599+03
63	7740400643	531509239	\N	20	መጀመሪይ ብብትሺን ታጠቢ። ግማታም	paid	t	donation_63_gemini.mp3	2025-11-06 12:56:36.720137+03
55	7740400643	1863182826	\N	20	ኧረ ሚ'ልፍ አማረኝ ሰዎች	paid	t	donation_55_gemini.mp3	2025-11-06 12:30:33.294452+03
56	7740400643	531509239	\N	20	የቺቺኒያ ልጆች ሲጀመር አይመቹኝም ብዳታሞች	paid	t	donation_56_gemini.mp3	2025-11-06 12:35:14.295172+03
57	7740400643	531509239	\N	20	ከፍትፍቱ ፊቱ። እግር ጥባ አንተ ጀላ ራስ	paid	t	donation_57_gemini.mp3	2025-11-06 12:40:26.060567+03
64	7740400643	531509239	\N	20	What da hell, man!!!!	paid	t	donation_64_gemini.mp3	2025-11-06 12:58:02.314478+03
58	7740400643	531509239	\N	20	ሴትን መድፈር ከመቼ ጀምሮ ነው የተከለከለው?	paid	t	donation_58_gemini.mp3	2025-11-06 12:47:01.540526+03
59	7740400643	531509239	\N	20	ሴትን መድፈር ከመቼ ጀምሮ ነው የተከለከለው?	paid	t	donation_59_gemini.mp3	2025-11-06 12:48:37.759535+03
60	7740400643	531509239	\N	20	“ኧረ የኤላ መላጣ ተመላልጦ ጠፋ”	paid	t	donation_60_gemini.mp3	2025-11-06 12:50:56.64325+03
65	7740400643	531509239	\N	20	Nigga, what are you talking about?? You, slut looking negro	failed_moderation	f	\N	2025-11-06 13:00:01.395884+03
67	7212643479	531509239	\N	20	What are you talking about?	paid	f	donation_67_gemini.mp3	2025-11-06 13:01:46.799287+03
66	7740400643	531509239	\N	20	Nigga, what are you talking about?? You, slut looking negro	failed_moderation	f	\N	2025-11-06 13:00:49.778397+03
68	7740400643	1863182826	\N	20	hey	paid	t	donation_68_gemini.mp3	2025-11-07 14:32:07.882071+03
69	7740400643	1863182826	\N	20	hello	paid	t	donation_69_gemini.mp3	2025-11-07 15:56:11.282553+03
\.


--
-- Data for Name: recharges; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.recharges (id, donor_id, name_on_payment, screenshot_file_id, status, created_at, amount) FROM stdin;
1	1863182826	Tasew	AgACAgQAAxkBAAIU6GkLESutDBjzKvW4tKzcmYb60VkuAAICC2sbR-hgUMoCccSzi4paAQADAgADeAADNgQ	approved	2025-11-05 11:56:12.807708+03	1000.00
3	531509239	Esrom	AgACAgQAAxkBAAIWemkMZ0A9_RWEKEB9CMtBF-0jnGywAAKmC2sburNgUI_wAmyz3E5FAQADAgADeAADNgQ	approved	2025-11-06 12:16:22.078084+03	1000.00
\.


--
-- Data for Name: settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.settings (key, value) FROM stdin;
maxChars	600
stepChars	100
basePrice	20
incrementPrice	20
filteredWords	["ተበዳ","ተበዱ","ጌይ","ፈክ","ቢዳታም","እሚስ","ቁለ","ሸርሙጣ","የሸርሙጣ","የሸርሙጣ ልጅ","ብዳታም","ሸሌ","ብዳታሞች","ሸሌዎች","የሸሌዎች","የሸሌ ልጆች","ፉችክ","fuck","የሸርሙጣ ልጆች","የጌይ","የጌይ ልጅ","ቡሽቲ","የቡሽቲ ልጅ","ጀላ","ጀላ ራስ","የጀላ","የጀላ ራስ ልጅ"]
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, telegram_id, username, display_name, role, balance, link_uuid, api_key, created_at, full_name, social_link, profile_picture_file_id, registration_status, streamer_order, phone_number) FROM stdin;
7	531509239	Esrommek	ኤስሮም	donor	720.00	\N	\N	2025-11-06 12:15:13.845139+03	\N	\N	\N	approved	0	\N
4	7212643479	Ez	\N	streamer	20.00	34bd9090-bf01-45bb-bc49-af9842dc7949	df9900b636c4a9d8818c68b0f83cdedca7e86e963466de9fcd28391966caee62	2025-11-05 19:49:50.930465+03	Santos	https://www.tiktok.com/@ezzhuu?_r=1&_t=ZM-919Oy6e9eLA	AgACAgQAAxkBAAIVS2kLgC0hsaCZ2uWSzrl5MJ2Pcva6AAJ4C2sbFUJgUNrb7sp4aWslAQADAgADeAADNgQ	approved	1	251939976687
1	1863182826	Lie_ed	ገበየሁ	donor	0.00	\N	\N	2025-11-05 11:55:32.145545+03	\N	\N	\N	approved	0	\N
5	7740400643	EZHU	\N	streamer	1040.00	db1705a8-e502-49f5-832e-b208bb4bbd43	23cff9b7e78e16afb7e778295678c61fc181a72e18776d8e1de816851eb9b167	2025-11-05 20:22:48.426048+03	Tasew	https://www.youtube.com/	AgACAgQAAxkBAAIVd2kLh-isH9L2PLQKsyEs0sQxw4x0AAKxC2sb9q1hUP2dkNBkH5G3AQADAgADeAADNgQ	approved	0	251939976687
\.


--
-- Data for Name: withdrawals; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.withdrawals (id, user_id, amount, telebirr_username, phone_number, status, created_at) FROM stdin;
1	7740400643	20	Tasew	251939976687	approved	2025-11-05 20:57:48.879296+03
2	7740400643	20	Tasew	0939976687	rejected	2025-11-05 21:10:03.789442+03
3	7740400643	20	ttt	0939976687	rejected	2025-11-05 21:13:30.406542+03
\.


--
-- Name: complaints_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.complaints_id_seq', 4, true);


--
-- Name: donations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.donations_id_seq', 69, true);


--
-- Name: recharges_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.recharges_id_seq', 3, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 7, true);


--
-- Name: withdrawals_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.withdrawals_id_seq', 3, true);


--
-- Name: complaints complaints_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.complaints
    ADD CONSTRAINT complaints_pkey PRIMARY KEY (id);


--
-- Name: donations donations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.donations
    ADD CONSTRAINT donations_pkey PRIMARY KEY (id);


--
-- Name: recharges recharges_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recharges
    ADD CONSTRAINT recharges_pkey PRIMARY KEY (id);


--
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (key);


--
-- Name: users users_api_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_api_key_key UNIQUE (api_key);


--
-- Name: users users_link_uuid_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_link_uuid_key UNIQUE (link_uuid);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_telegram_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_telegram_id_key UNIQUE (telegram_id);


--
-- Name: withdrawals withdrawals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.withdrawals
    ADD CONSTRAINT withdrawals_pkey PRIMARY KEY (id);


--
-- Name: donations donations_donor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.donations
    ADD CONSTRAINT donations_donor_id_fkey FOREIGN KEY (donor_id) REFERENCES public.users(telegram_id) ON DELETE CASCADE;


--
-- Name: donations donations_streamer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.donations
    ADD CONSTRAINT donations_streamer_id_fkey FOREIGN KEY (streamer_id) REFERENCES public.users(telegram_id) ON DELETE CASCADE;


--
-- Name: recharges recharges_donor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recharges
    ADD CONSTRAINT recharges_donor_id_fkey FOREIGN KEY (donor_id) REFERENCES public.users(telegram_id) ON DELETE CASCADE;


--
-- Name: withdrawals withdrawals_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.withdrawals
    ADD CONSTRAINT withdrawals_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(telegram_id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict NCY5XHCjmBXSVTtmJKxEkxgPdzEdJaIoUVnRApAu0O5tkD5GUvah1tSszd3wkc0

