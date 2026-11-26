import { useState } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import PropTypes from 'prop-types';
import {
  AdminLayout,
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  CopyField,
  DataTable,
  EmptyState,
  AccentBar,
  Icon,
  Input,
  LanguageToggle,
  Modal,
  PublicLayout,
  Select,
  Skeleton,
  SkeletonText,
  StatCard,
  StreamerLayout,
  Switch,
  Tabs,
  Textarea,
  ThemeToggle,
  ToastProvider,
  formatETB,
  useI18n,
  useTheme,
  useToast,
} from './index';

/*
 * Dev-only component gallery, mounted at /ui-kit (see App.jsx).
 * Sub-routes demo each layout full-screen:
 *   /ui-kit/public · /ui-kit/streamer/live · /ui-kit/admin
 */

const DONATIONS = [
  { id: 1, donor: 'Abebe K.', message: 'ሰላም! በጣም ጥሩ ስትሪም ነው 🔥', amount: 250, method: 'Chapa', status: 'played', at: new Date('2026-11-24T19:12:00') },
  { id: 2, donor: 'Selam', message: 'Shout-out from Addis!', amount: 1000, method: 'Telebirr', status: 'queued', at: new Date('2026-11-24T19:20:00') },
  { id: 3, donor: 'ሄኖክ', message: 'እንኳን ደስ አለህ', amount: 50, method: 'Arifpay', status: 'played', at: new Date('2026-11-24T18:41:00') },
  { id: 4, donor: 'Anonymous', message: 'Play the horn sound!', amount: 75, method: 'Chapa', status: 'blocked', at: new Date('2026-11-24T18:02:00') },
  { id: 5, donor: 'Meron T.', message: 'Keep going 💚💛❤️', amount: 500, method: 'Telebirr', status: 'played', at: new Date('2026-11-24T17:30:00') },
];

const STATUS_BADGE = {
  played: { variant: 'success', label: 'Played' },
  queued: { variant: 'warning', label: 'Queued' },
  blocked: { variant: 'danger', label: 'Blocked' },
};

const COLUMNS = [
  {
    key: 'donor',
    header: 'Donor',
    sortable: true,
    render: (r) => (
      <span className="flex items-center gap-2.5">
        <Avatar name={r.donor} size="xs" />
        <span className="font-medium">{r.donor}</span>
      </span>
    ),
  },
  { key: 'message', header: 'Message', hideOnMobile: true, className: 'max-w-[16rem] truncate text-muted' },
  { key: 'method', header: 'Method', sortable: true, hideOnMobile: true },
  {
    key: 'status',
    header: 'Status',
    render: (r) => (
      <Badge variant={STATUS_BADGE[r.status].variant} dot>
        {STATUS_BADGE[r.status].label}
      </Badge>
    ),
  },
  { key: 'amount', header: 'Amount', sortable: true, align: 'right', render: (r) => <span className="font-semibold">{formatETB(r.amount, { decimals: 0 })}</span> },
];

function Section({ id, title, description, children }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-20">
      <div className="mb-4">
        <h2 id={`${id}-title`} className="text-lg font-semibold text-fg">
          {title}
        </h2>
        {description ? <p className="mt-0.5 text-sm text-muted">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

Section.propTypes = {
  id: PropTypes.string.isRequired,
  title: PropTypes.node.isRequired,
  description: PropTypes.node,
  children: PropTypes.node,
};

function Swatch({ name, className, hex }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`h-10 w-10 shrink-0 rounded-lg border border-line ${className}`} />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-fg">{name}</p>
        {hex ? <p className="font-mono text-xs text-muted">{hex}</p> : null}
      </div>
    </div>
  );
}

Swatch.propTypes = { name: PropTypes.string.isRequired, className: PropTypes.string.isRequired, hex: PropTypes.string };

function Gallery() {
  const toast = useToast();
  const { t, lang } = useI18n();
  const { theme } = useTheme();
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tts, setTts] = useState(true);
  const [media, setMedia] = useState(false);
  const [message, setMessage] = useState('ሰላም! ይህ የሙከራ መልዕክት ነው።');
  const [tableState, setTableState] = useState('data');

  const fakeSave = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      toast.success('Settings saved', { description: 'Your overlay will update in a few seconds.' });
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-canvas font-sans text-fg">
      <AccentBar />
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <p className="font-semibold">UI kit</p>
          <Badge variant="neutral" size="sm">
            {theme} · {lang}
          </Badge>
          <div className="ml-auto flex items-center gap-2">
            <LanguageToggle />
            <ThemeToggle size="sm" />
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-12 px-4 py-8 sm:px-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Habesha TTS design system</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Dark-first tokens, flag accents used sparingly, Inter + Noto Sans Ethiopic. Toggle the theme and language in the
            header — every component on this page re-renders in place. Layout demos:{' '}
            <Link className="font-medium text-brand-600 underline-offset-2 hover:underline dark:text-brand-400" to="/ui-kit/public">
              Public
            </Link>
            {' · '}
            <Link className="font-medium text-brand-600 underline-offset-2 hover:underline dark:text-brand-400" to="/ui-kit/streamer/live">
              Streamer
            </Link>
            {' · '}
            <Link className="font-medium text-brand-600 underline-offset-2 hover:underline dark:text-brand-400" to="/ui-kit/admin">
              Admin
            </Link>
          </p>
        </div>

        <Section id="tokens" title="Tokens" description="Surfaces and text follow the theme via CSS variables; brand-600 is the flag green.">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <Swatch name="canvas" className="bg-canvas" />
            <Swatch name="surface" className="bg-surface" />
            <Swatch name="surface-2" className="bg-surface-2" />
            <Swatch name="surface-3" className="bg-surface-3" />
            <Swatch name="line" className="bg-line" />
            <Swatch name="fg / muted" className="bg-gradient-to-r from-fg to-muted" />
            <Swatch name="brand-500" className="bg-brand-500" hex="#17a24f" />
            <Swatch name="brand-600" className="bg-brand-600" hex="#7c3aed" />
            <Swatch name="brand-700" className="bg-brand-700" hex="#076d29" />
          </div>
          <Card className="mt-4" padding="sm">
            <p className="text-2xl font-bold">ሀበሻ TTS — የድምፅ መልዕክት</p>
            <p className="mt-1 text-sm text-muted" lang="am">
              ተመልካቾች ገንዘብ ልከው መልዕክታቸው በቀጥታ ስርጭት ላይ በአማርኛ ይነበባል። (Noto Sans Ethiopic)
            </p>
            <p className="mt-1 text-sm text-muted">The quick brown fox jumps over the lazy dog. (Inter) 0123456789</p>
          </Card>
        </Section>

        <Section id="buttons" title="Button" description="primary · secondary · ghost · danger × sm · md · lg, loading, disabled, icon-only.">
          <Card>
            <div className="flex flex-col gap-4">
              {['primary', 'secondary', 'ghost', 'danger'].map((variant) => (
                <div key={variant} className="flex flex-wrap items-center gap-3">
                  <span className="w-20 text-xs font-medium uppercase tracking-wide text-subtle">{variant}</span>
                  <Button variant={variant} size="sm">
                    Small
                  </Button>
                  <Button variant={variant}>Medium</Button>
                  <Button variant={variant} size="lg" leftIcon={<Icon name="gift" size={18} />}>
                    Large
                  </Button>
                  <Button variant={variant} loading>
                    Saving
                  </Button>
                  <Button variant={variant} disabled>
                    Disabled
                  </Button>
                  <Button variant={variant} iconOnly aria-label="Settings">
                    <Icon name="settings" size={18} />
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        </Section>

        <Section id="forms" title="Input · Textarea · Select · Switch" description="Labels, hints and errors are wired with aria-describedby / aria-invalid.">
          <Card>
            <div className="grid gap-5 md:grid-cols-2">
              <Input label="Display name" placeholder="e.g. Abebe" hint="Shown on the overlay." required />
              <Input label="Amount (ETB)" type="number" defaultValue="5" error="Minimum donation is 10 ETB." />
              <Input label="Search" placeholder="Search donors…" leftIcon={<Icon name="search" size={16} />} />
              <Select
                label="Voice"
                defaultValue=""
                placeholder="Choose a voice…"
                options={[
                  { value: 'am-female', label: 'Amharic — Female (Mekdes)' },
                  { value: 'am-male', label: 'Amharic — Male (Ameha)' },
                  { value: 'gemini', label: 'Gemini expressive' },
                ]}
              />
              <Textarea
                className="md:col-span-2"
                label="Message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={200}
                showCount
                hint="Read aloud on stream."
              />
              <Input label="Disabled" disabled defaultValue="Read-only value" />
              <Select label="With error" error="Pick a payment method." defaultValue="">
                <option value="" disabled>
                  Select…
                </option>
                <option value="chapa">Chapa</option>
                <option value="arifpay">Arifpay</option>
              </Select>
            </div>
            <div className="mt-6 flex flex-col gap-4 border-t border-line pt-5">
              <Switch checked={tts} onChange={setTts} label="Read messages aloud" description="Donations above your minimum are spoken with TTS." />
              <Switch checked={media} onChange={setMedia} label="Allow media share" description="Viewers can request YouTube clips; you approve each one." />
              <Switch checked={false} disabled label="Soundboard (coming soon)" />
              <div className="flex items-center gap-3">
                <Switch checked={tts} onChange={setTts} size="sm" aria-label="Compact switch" />
                <span className="text-sm text-muted">Small, label via aria-label</span>
              </div>
            </div>
          </Card>
        </Section>

        <Section id="cards" title="Card · StatCard" description="StatCard handles deltas, icons and loading.">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Today" value={formatETB(4250, { decimals: 0 })} delta={12.5} deltaLabel="vs yesterday" icon="gift" />
            <StatCard label="Donations" value="38" delta={-4.2} deltaLabel="vs yesterday" icon="chart" />
            <StatCard label="Pending payout" value={formatETB(18900, { decimals: 0 })} hint="Next payout Fri" icon="wallet" />
            <StatCard label="Loading" loading icon="layers" />
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Card accent>
              <CardHeader
                title="Card with flag accent"
                description="Use accent only for hero or highlight cards."
                actions={
                  <Button size="sm" variant="secondary">
                    Edit
                  </Button>
                }
              />
              <SkeletonText lines={3} />
            </Card>
            <Card interactive>
              <CardHeader title="Interactive card" description="Hover to lift." />
              <div className="flex items-center gap-3">
                <Avatar name="Selam Tesfaye" size="lg" status="live" />
                <div>
                  <p className="font-semibold">Selam Tesfaye</p>
                  <p className="text-sm text-muted">@selam_streams · 12.4k followers</p>
                </div>
              </div>
            </Card>
          </div>
        </Section>

        <Section id="tabs" title="Tabs" description="Arrow keys / Home / End move between tabs.">
          <Card>
            <Tabs
              label="Donation filters"
              items={[
                { value: 'all', label: 'All', count: 38, content: <p className="text-sm text-muted">All donations from today.</p> },
                { value: 'queued', label: 'Queued', count: 3, content: <p className="text-sm text-muted">Waiting to be read aloud.</p> },
                { value: 'blocked', label: 'Blocked', content: <p className="text-sm text-muted">Filtered by moderation.</p> },
                { value: 'archived', label: 'Archived', disabled: true },
              ]}
            />
            <div className="mt-6">
              <Tabs
                variant="pill"
                size="sm"
                label="Range"
                items={[
                  { value: '7d', label: '7 days' },
                  { value: '30d', label: '30 days' },
                  { value: '90d', label: '90 days' },
                ]}
              />
            </div>
          </Card>
        </Section>

        <Section id="badges" title="Badge · Avatar · Skeleton">
          <Card>
            <div className="flex flex-wrap items-center gap-2">
              <Badge>Neutral</Badge>
              <Badge variant="brand">Brand</Badge>
              <Badge variant="success" dot>
                Paid
              </Badge>
              <Badge variant="warning" dot>
                Pending
              </Badge>
              <Badge variant="danger" dot pulse>
                Live
              </Badge>
              <Badge variant="info">Info</Badge>
              <Badge variant="brand" size="sm">
                Small
              </Badge>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Avatar name="Abebe Kebede" size="xs" />
              <Avatar name="Selam" size="sm" status="online" />
              <Avatar name="ሄኖክ ተስፋዬ" size="md" />
              <Avatar name="Meron Tadesse" size="lg" status="live" />
              <Avatar name="Dawit" size="xl" src="/broken-image.png" />
            </div>
            <div className="mt-5 flex items-center gap-3">
              <Skeleton circle className="h-10 w-10" />
              <div className="flex-1">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="mt-2 h-3 w-64 max-w-full" />
              </div>
            </div>
          </Card>
        </Section>

        <Section id="table" title="DataTable" description="Click a sortable header to cycle asc → desc → none.">
          <div className="mb-3">
            <Tabs
              variant="pill"
              size="sm"
              label="Table state"
              value={tableState}
              onChange={setTableState}
              items={[
                { value: 'data', label: 'Data' },
                { value: 'loading', label: 'Loading' },
                { value: 'empty', label: 'Empty' },
              ]}
            />
          </div>
          <DataTable
            caption="Recent donations"
            columns={COLUMNS}
            rows={tableState === 'empty' ? [] : DONATIONS}
            loading={tableState === 'loading'}
            defaultSort={{ key: 'amount', direction: 'desc' }}
            empty={{
              icon: 'gift',
              title: 'No donations yet',
              description: 'Share your donation link on stream to get started.',
              action: (
                <Button size="sm" variant="secondary" leftIcon={<Icon name="copy" size={14} />}>
                  Copy link
                </Button>
              ),
            }}
          />
        </Section>

        <Section id="empty" title="EmptyState">
          <Card padding="none">
            <EmptyState
              icon="film"
              title="Media queue is empty"
              description="When viewers request clips, they’ll wait here for your approval."
              action={<Button leftIcon={<Icon name="settings" size={16} />}>Media settings</Button>}
            />
          </Card>
        </Section>

        <Section id="copy" title="CopyField" description="Secrets stay masked until Show; Copy works either way.">
          <Card>
            <div className="flex flex-col gap-5">
              <CopyField label="Donation link" value="https://habeshatts.com/d/selam" />
              <CopyField
                label="Overlay URL (secret)"
                value="https://habeshatts.com/overlay/9f3c2a71-5b8e-4d0a-a1c4-7e2f6b9d0c13"
                secret
                hint="Paste into an OBS Browser Source. Never show this on stream."
              />
            </div>
          </Card>
        </Section>

        <Section id="feedback" title="Modal · Toast">
          <Card>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => setModalOpen(true)}>Open modal</Button>
              <Button variant="secondary" onClick={() => toast.success('Donation received', { description: 'Abebe sent ETB 250' })}>
                Success toast
              </Button>
              <Button variant="secondary" onClick={() => toast.info('Overlay connected')}>
                Info toast
              </Button>
              <Button variant="secondary" onClick={() => toast.warning('Low balance', { description: 'Top up to keep TTS running.' })}>
                Warning toast
              </Button>
              <Button variant="danger" onClick={() => toast.error('Payment failed', { description: 'Chapa returned an error.' })}>
                Error toast
              </Button>
            </div>
          </Card>
          <Modal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            title="Block this donor?"
            description="Their future messages won’t be read aloud. You can undo this in Settings."
            dismissible={!saving}
            footer={
              <>
                <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>
                  {t('common.cancel')}
                </Button>
                <Button
                  variant="danger"
                  loading={saving}
                  onClick={() => {
                    fakeSave();
                    setTimeout(() => setModalOpen(false), 1200);
                  }}
                >
                  Block donor
                </Button>
              </>
            }
          >
            <Input label="Reason (optional)" placeholder="Spam, abuse…" />
          </Modal>
        </Section>

        <Section id="i18n" title="i18n" description="t(key) reads the active dictionary; the toggle persists to localStorage.">
          <Card>
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              {['nav.live', 'nav.donations', 'nav.soundboard', 'nav.media', 'nav.payouts', 'app.tagline'].map((key) => (
                <div key={key} className="flex gap-3">
                  <dt className="w-28 shrink-0 font-mono text-xs leading-6 text-subtle">{key}</dt>
                  <dd className="text-fg">{t(key)}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </Section>
      </main>
    </div>
  );
}

function DemoContent({ heading }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Today" value={formatETB(4250, { decimals: 0 })} delta={12.5} deltaLabel="vs yesterday" icon="gift" />
        <StatCard label="Donations" value="38" delta={-4.2} icon="chart" />
        <StatCard label="Queue" value="3" hint="~45s to clear" icon="mic" />
        <StatCard label="Balance" value={formatETB(18900, { decimals: 0 })} icon="wallet" />
      </div>
      <Card>
        <CardHeader title={heading} description="Placeholder content for the layout demo." />
        <DataTable columns={COLUMNS} rows={DONATIONS} defaultSort={{ key: 'amount', direction: 'desc' }} dense />
      </Card>
    </div>
  );
}

DemoContent.propTypes = { heading: PropTypes.string.isRequired };

function PublicDemo() {
  return (
    <PublicLayout homeHref="/ui-kit/public" loginHref="/ui-kit" signupHref="/ui-kit">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <Badge variant="brand" dot>
          Chapa · Arifpay · Telebirr
        </Badge>
        <h1 className="mt-4 max-w-2xl text-4xl font-extrabold tracking-tight sm:text-5xl">
          Your viewers’ messages, <span className="text-brand-600 dark:text-brand-400">read aloud live</span> in Amharic.
        </h1>
        <p className="mt-4 max-w-xl text-lg text-muted" lang="am">
          ተመልካቾችዎ ይደግፉዎታል፣ መልዕክታቸውም በቀጥታ ይነበባል።
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button size="lg">Start streaming</Button>
          <Button size="lg" variant="secondary" as={Link} to="/ui-kit">
            Back to UI kit
          </Button>
        </div>
      </div>
    </PublicLayout>
  );
}

function StreamerDemo() {
  return (
    <StreamerLayout
      basePath="/ui-kit/streamer"
      title="Dashboard"
      live
      badges={{ media: 3 }}
      user={{ name: 'Selam Tesfaye', subtitle: '@selam_streams' }}
      onLogout={() => {}}
    >
      <DemoContent heading="Recent donations" />
    </StreamerLayout>
  );
}

function AdminDemo() {
  return (
    <AdminLayout basePath="/ui-kit/admin" title="Overview" badges={{ moderation: 4 }} user={{ name: 'Ops Team', subtitle: 'Super admin' }}>
      <DemoContent heading="Platform activity" />
    </AdminLayout>
  );
}

export default function UiKitPage() {
  return (
    <ToastProvider>
      <Routes>
        <Route index element={<Gallery />} />
        <Route path="public/*" element={<PublicDemo />} />
        <Route path="streamer/*" element={<StreamerDemo />} />
        <Route path="admin/*" element={<AdminDemo />} />
      </Routes>
    </ToastProvider>
  );
}
