import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import {
  Badge, Button, Card, CardHeader, EmptyState, Icon, Input, Skeleton, StatCard, Textarea, cn, focusRing, formatETB, useI18n,
} from '../ui';
import { ViewerLayout } from '../components/viewer/ViewerLayout';
import { accountApi, fileToBase64, setAccountToken, useAccount } from '../lib/accountApi';
import '../lib/viewerStrings';
import '../lib/accountStrings';

const STATUS_POLL_MS = 2500;
const TOPUP_PRESETS = [100, 200, 500, 1000];
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

function FormError({ children }) {
  if (!children) return null;
  return (
    <p className="flex items-center gap-1.5 text-sm font-medium text-[#e5484d]" role="alert">
      <Icon name="alert" size={16} />
      {children}
    </p>
  );
}
FormError.propTypes = { children: PropTypes.node };

function FormOk({ children }) {
  if (!children) return null;
  return (
    <p className="flex items-center gap-1.5 text-sm font-medium text-[#078930] dark:text-[#3ecf8e]" role="status">
      <Icon name="checkCircle" size={16} />
      {children}
    </p>
  );
}
FormOk.propTypes = { children: PropTypes.node };

/** Run an async form action with loading / error state. */
function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const run = async (fn) => {
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      setError(e.message);
      return undefined;
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, setError, run };
}

// ---------------------------------------------------------------------------
// Sign in through the bot
// ---------------------------------------------------------------------------

function SignIn() {
  const { t } = useI18n();
  const [login, setLogin] = useState(null); // { nonce, botUrl }
  const [status, setStatus] = useState('waiting');
  const [code, setCode] = useState('');
  const { busy, error, setError, run } = useAction();
  const codeRef = useRef(null);

  useEffect(() => {
    if (!login || status === 'expired') return undefined;
    const id = setInterval(() => {
      accountApi.loginStatus(login.nonce).then((r) => {
        setStatus(r.status);
        if (r.status === 'code_sent') codeRef.current?.focus();
      }).catch(() => {});
    }, STATUS_POLL_MS);
    return () => clearInterval(id);
  }, [login, status]);

  const start = () => run(async () => {
    const r = await accountApi.startLogin();
    setLogin(r);
    setStatus('waiting');
    setCode('');
  });

  const verify = (e) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) return;
    run(async () => {
      const r = await accountApi.verifyLogin(login.nonce, code);
      setAccountToken(r.token);
    });
  };

  const restart = () => { setLogin(null); setError(null); };

  return (
    <Card padding="lg" className="mx-auto max-w-md">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-[#229ED9]/15 text-[#229ED9]">
        <Icon name="shield" size={24} />
      </div>
      <h1 className="text-xl font-bold text-fg">{t('acct.login.title')}</h1>
      <p className="mt-1 text-sm text-muted">{t('acct.login.hint')}</p>

      {!login ? (
        <div className="mt-6 flex flex-col gap-3">
          <Button size="lg" fullWidth loading={busy} onClick={start}>{t('acct.login.start')}</Button>
          <FormError>{error}</FormError>
        </div>
      ) : status === 'expired' ? (
        <div className="mt-6 flex flex-col gap-3">
          <p className="text-sm text-muted" role="status">{t('acct.login.expired')}</p>
          <Button variant="secondary" onClick={restart}>{t('acct.login.restart')}</Button>
        </div>
      ) : (
        <form className="mt-6 flex flex-col gap-4" onSubmit={verify}>
          <div>
            <p className="mb-2 text-sm font-medium text-fg">{t('acct.login.step1')}</p>
            <Button as="a" href={login.botUrl} target="_blank" rel="noreferrer" variant="secondary" fullWidth>
              {t('acct.login.open')}
            </Button>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-fg">{t('acct.login.step2')}</p>
            <Input
              ref={codeRef}
              aria-label={t('acct.login.code')}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              value={code}
              inputClassName="text-center text-lg tracking-[0.4em] tabular-nums"
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            />
            <p className="mt-2 text-xs text-muted" role="status" aria-live="polite">
              {status === 'code_sent' ? t('acct.login.sent') : t('acct.login.waiting')}
            </p>
          </div>
          <FormError>{error}</FormError>
          <Button type="submit" size="lg" fullWidth loading={busy} disabled={code.length !== 6}>{t('acct.login.verify')}</Button>
          <button type="button" onClick={restart} className={cn('self-center rounded text-sm text-muted hover:text-fg', focusRing)}>
            {t('acct.login.restart')}
          </button>
        </form>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

function ChooseRole({ onChoose }) {
  const { t } = useI18n();
  const option = (value, icon, title, hint) => (
    <button
      type="button"
      aria-label={title}
      onClick={() => onChoose(value)}
      className={cn('flex w-full items-start gap-4 rounded-xl border border-line bg-surface p-5 text-left transition hover:border-[#078930] hover:bg-surface-2', focusRing)}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-fg"><Icon name={icon} size={20} /></span>
      <span>
        <span className="block font-semibold text-fg">{title}</span>
        <span className="mt-1 block text-sm text-muted">{hint}</span>
      </span>
      <Icon name="chevronRight" size={18} className="ml-auto mt-2 shrink-0 text-subtle" />
    </button>
  );
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-3">
      <h1 className="text-xl font-bold text-fg">{t('acct.choose.title')}</h1>
      <p className="mb-2 text-sm text-muted">{t('acct.choose.hint')}</p>
      {option('donor', 'gift', t('acct.choose.donor'), t('acct.choose.donorHint'))}
      {option('streamer', 'live', t('acct.choose.streamer'), t('acct.choose.streamerHint'))}
    </div>
  );
}
ChooseRole.propTypes = { onChoose: PropTypes.func.isRequired };

function BackLink({ onBack }) {
  const { t } = useI18n();
  return (
    <button type="button" onClick={onBack} className={cn('mb-4 inline-flex items-center gap-1 rounded text-sm text-muted hover:text-fg', focusRing)}>
      <Icon name="chevronLeft" size={16} />
      {t('acct.back')}
    </button>
  );
}
BackLink.propTypes = { onBack: PropTypes.func.isRequired };

function DonorForm({ onBack, onDone }) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const { busy, error, run } = useAction();
  const submit = (e) => {
    e.preventDefault();
    run(async () => { await accountApi.registerDonor(name.trim()); onDone(); });
  };
  return (
    <Card padding="lg" className="mx-auto max-w-md">
      <BackLink onBack={onBack} />
      <h1 className="mb-5 text-xl font-bold text-fg">{t('acct.donor.title')}</h1>
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <Input label={t('acct.donor.name')} hint={t('acct.donor.nameHint')} required maxLength={48} value={name} onChange={(e) => setName(e.target.value)} />
        <FormError>{error}</FormError>
        <Button type="submit" size="lg" fullWidth loading={busy} disabled={name.trim().length < 2}>{t('acct.donor.submit')}</Button>
      </form>
    </Card>
  );
}
DonorForm.propTypes = { onBack: PropTypes.func.isRequired, onDone: PropTypes.func.isRequired };

function StreamerForm({ onBack, onDone }) {
  const { t } = useI18n();
  const [fullName, setFullName] = useState('');
  const [socialLink, setSocialLink] = useState('');
  const [phone, setPhone] = useState('');
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const [photoError, setPhotoError] = useState(null);
  const { busy, error, run } = useAction();

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const pickPhoto = (e) => {
    const file = e.target.files?.[0] || null;
    setPhotoError(null);
    setPhoto(null);
    setPreview(null);
    if (!file) return;
    if (!PHOTO_TYPES.includes(file.type)) { setPhotoError(t('acct.streamer.photoHint')); return; }
    if (file.size > PHOTO_MAX_BYTES) { setPhotoError(t('acct.streamer.photoHint')); return; }
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
  };

  const linkOk = /^https?:\/\/\S+\.\S+/i.test(socialLink.trim());
  const phoneOk = /^2519\d{8}$/.test(phone.trim());
  const ready = fullName.trim().length >= 2 && linkOk && phoneOk && photo;

  const submit = (e) => {
    e.preventDefault();
    if (!ready) return;
    run(async () => {
      const data = await fileToBase64(photo);
      await accountApi.registerStreamer({
        fullName: fullName.trim(), socialLink: socialLink.trim(), phoneNumber: phone.trim(), photo: { data, type: photo.type },
      });
      onDone();
    });
  };

  return (
    <Card padding="lg" className="mx-auto max-w-md">
      <BackLink onBack={onBack} />
      <h1 className="mb-5 text-xl font-bold text-fg">{t('acct.streamer.title')}</h1>
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <Input label={t('acct.streamer.fullName')} required maxLength={80} value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <Input
          label={t('acct.streamer.social')} required type="url" placeholder={t('acct.streamer.socialPh')} value={socialLink}
          error={socialLink.trim() && !linkOk ? t('acct.streamer.socialPh') : undefined}
          onChange={(e) => setSocialLink(e.target.value)}
        />
        <Input
          label={t('acct.streamer.phone')} required inputMode="numeric" placeholder="2519XXXXXXXX" maxLength={12} value={phone}
          hint={t('acct.streamer.phoneHint')} error={phone && !phoneOk && phone.length >= 12 ? t('acct.streamer.phoneHint') : undefined}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 12))}
        />
        <div>
          <label htmlFor="streamer-photo" className="mb-1.5 block text-sm font-medium text-fg">{t('acct.streamer.photo')}</label>
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-2 text-subtle">
              {preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : <Icon name="users" size={24} />}
            </div>
            <input
              id="streamer-photo" type="file" accept={PHOTO_TYPES.join(',')} onChange={pickPhoto}
              className={cn('block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-sm file:font-medium file:text-fg', focusRing)}
            />
          </div>
          <p className={cn('mt-1.5 text-xs', photoError ? 'text-[#e5484d]' : 'text-muted')}>{t('acct.streamer.photoHint')}</p>
        </div>
        <FormError>{error}</FormError>
        <Button type="submit" size="lg" fullWidth loading={busy} disabled={!ready}>{t('acct.streamer.submit')}</Button>
      </form>
    </Card>
  );
}
StreamerForm.propTypes = { onBack: PropTypes.func.isRequired, onDone: PropTypes.func.isRequired };

// ---------------------------------------------------------------------------
// Signed-in views
// ---------------------------------------------------------------------------

function TopUp({ topup }) {
  const { t } = useI18n();
  const providers = topup?.providers || [];
  const [amount, setAmount] = useState(String(TOPUP_PRESETS[0]));
  const [provider, setProvider] = useState(providers[0]?.name || '');
  const { busy, error, run } = useAction();
  const value = Math.floor(Number(amount) || 0);
  const valid = value >= (topup?.min ?? 10) && value <= (topup?.max ?? 20000);

  if (!providers.length) return <p className="text-sm text-muted">{t('acct.topup.none')}</p>;

  const submit = (e) => {
    e.preventDefault();
    if (!valid || !provider) return;
    run(async () => {
      const { redirectUrl } = await accountApi.topup(value, provider);
      window.location.assign(redirectUrl);
    });
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={submit}>
      <div className="flex flex-wrap gap-2">
        {TOPUP_PRESETS.map((p) => (
          <Button key={p} type="button" size="sm" variant={value === p ? 'primary' : 'secondary'} onClick={() => setAmount(String(p))}>
            {p} ብር
          </Button>
        ))}
      </div>
      <Input
        label={t('acct.topup.amount')} inputMode="numeric" value={amount}
        hint={`${topup.min}–${topup.max}`}
        onChange={(e) => setAmount(e.target.value.replace(/\D/g, '').slice(0, 6))}
      />
      {providers.length > 1 ? (
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-fg">{t('acct.topup.method')}</legend>
          <div className="flex flex-wrap gap-2">
            {providers.map((p) => (
              <Button key={p.name} type="button" size="sm" variant={provider === p.name ? 'primary' : 'secondary'} onClick={() => setProvider(p.name)}>
                {p.label}
              </Button>
            ))}
          </div>
        </fieldset>
      ) : null}
      <FormError>{error}</FormError>
      <Button type="submit" fullWidth loading={busy} disabled={!valid}>{t('acct.topup.pay', { amount: formatETB(value, { decimals: 0 }) })}</Button>
    </form>
  );
}
TopUp.propTypes = { topup: PropTypes.object };

function ChangeName({ current, onSaved }) {
  const { t } = useI18n();
  const [name, setName] = useState(current || '');
  const [saved, setSaved] = useState(false);
  const { busy, error, run } = useAction();
  const submit = (e) => {
    e.preventDefault();
    setSaved(false);
    run(async () => { await accountApi.changeName(name.trim()); setSaved(true); onSaved(); });
  };
  return (
    <form className="flex flex-col gap-3" onSubmit={submit}>
      <Input aria-label={t('acct.name.title')} maxLength={48} value={name} onChange={(e) => { setName(e.target.value); setSaved(false); }} />
      <FormError>{error}</FormError>
      <FormOk>{saved ? t('acct.name.saved') : null}</FormOk>
      <Button type="submit" variant="secondary" loading={busy} disabled={name.trim().length < 2 || name.trim() === current}>{t('acct.name.save')}</Button>
    </form>
  );
}
ChangeName.propTypes = { current: PropTypes.string, onSaved: PropTypes.func.isRequired };

function Complaint() {
  const { t } = useI18n();
  const [text, setText] = useState('');
  const [sent, setSent] = useState(false);
  const { busy, error, run } = useAction();
  const submit = (e) => {
    e.preventDefault();
    run(async () => { await accountApi.complaint(text.trim()); setSent(true); setText(''); });
  };
  return (
    <form className="flex flex-col gap-3" onSubmit={submit}>
      <Textarea aria-label={t('acct.complaint.title')} rows={4} maxLength={2000} placeholder={t('acct.complaint.ph')} value={text} onChange={(e) => { setText(e.target.value); setSent(false); }} />
      <FormError>{error}</FormError>
      <FormOk>{sent ? t('acct.complaint.sent') : null}</FormOk>
      <Button type="submit" variant="secondary" loading={busy} disabled={text.trim().length < 3}>{t('acct.complaint.send')}</Button>
    </form>
  );
}

function DonorHome({ account, topup, refresh }) {
  const { t } = useI18n();
  if (account.banned) {
    return (
      <Card padding="lg" className="mx-auto max-w-md">
        <EmptyState
          icon="alert"
          title={t('acct.banned')}
          description={[account.banReason, account.banExpiresAt ? t('acct.bannedUntil', { date: new Date(account.banExpiresAt).toLocaleString() }) : null].filter(Boolean).join(' ')}
        />
        <div className="mt-6 border-t border-line pt-6">
          <h2 className="mb-3 font-semibold text-fg">{t('acct.complaint.title')}</h2>
          <Complaint />
        </div>
      </Card>
    );
  }
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="flex flex-col gap-6">
        <StatCard label={t('acct.wallet')} value={formatETB(account.balance)} icon="wallet" />
        <Button as={Link} to="/streamers" size="lg" fullWidth leftIcon={<Icon name="gift" size={18} />}>{t('acct.donate')}</Button>
        <Card>
          <CardHeader title={t('acct.topup.title')} />
          <div className="mt-4"><TopUp topup={topup} /></div>
        </Card>
      </div>
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader title={t('acct.name.title')} />
          <div className="mt-4"><ChangeName current={account.displayName} onSaved={refresh} /></div>
        </Card>
        <Card>
          <CardHeader title={t('acct.complaint.title')} />
          <div className="mt-4"><Complaint /></div>
        </Card>
      </div>
    </div>
  );
}
DonorHome.propTypes = { account: PropTypes.object.isRequired, topup: PropTypes.object, refresh: PropTypes.func.isRequired };

function StreamerHome({ account }) {
  const { t } = useI18n();
  const status = account.registrationStatus;
  return (
    <Card padding="lg" className="mx-auto max-w-md">
      {status === 'approved' ? (
        <EmptyState
          icon="checkCircle"
          title={t('acct.streamer.approved')}
          action={account.dashboardPath ? <Button as={Link} to={account.dashboardPath}>{t('acct.streamer.dashboard')}</Button> : null}
        />
      ) : status === 'rejected' ? (
        <EmptyState icon="xCircle" title={t('acct.streamer.rejected')} />
      ) : (
        <EmptyState icon="info" title={t('acct.streamer.pending')} description={t('acct.streamer.pendingHint')} />
      )}
    </Card>
  );
}
StreamerHome.propTypes = { account: PropTypes.object.isRequired };

export default function AccountPage() {
  const { t } = useI18n();
  const { account, topup, error, refresh, signOut } = useAccount();
  const [registering, setRegistering] = useState(null); // 'donor' | 'streamer'

  useEffect(() => { if (account?.registered) setRegistering(null); }, [account]);

  let body;
  if (account === undefined) {
    body = error ? (
      <EmptyState icon="alert" title={t('acct.error')} description={error.message} action={<Button variant="secondary" onClick={() => refresh()}>{t('dir.retry')}</Button>} />
    ) : (
      <div className="mx-auto max-w-md"><Skeleton className="h-64 w-full rounded-xl" /></div>
    );
  } else if (account === null) {
    body = <SignIn />;
  } else if (!account.registered) {
    body = registering === 'donor' ? <DonorForm onBack={() => setRegistering(null)} onDone={refresh} />
      : registering === 'streamer' ? <StreamerForm onBack={() => setRegistering(null)} onDone={refresh} />
        : <ChooseRole onChoose={setRegistering} />;
  } else if (account.role === 'donor') {
    body = <DonorHome account={account} topup={topup} refresh={refresh} />;
  } else if (account.role === 'streamer') {
    body = <StreamerHome account={account} />;
  } else {
    body = <Card padding="lg" className="mx-auto max-w-md"><EmptyState icon="shield" title={t('acct.admin')} /></Card>;
  }

  return (
    <ViewerLayout>
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        {account ? (
          <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-bold text-fg">
                {account.displayName || t('acct.title')}
                {account.registered ? <Badge variant="neutral" size="sm">{account.role}</Badge> : null}
              </h1>
              <p className="mt-1 text-sm text-muted">{t('acct.subtitle')}</p>
            </div>
            <Button variant="ghost" size="sm" leftIcon={<Icon name="logout" size={16} />} onClick={signOut}>{t('acct.signOut')}</Button>
          </div>
        ) : null}
        {body}
      </div>
    </ViewerLayout>
  );
}
