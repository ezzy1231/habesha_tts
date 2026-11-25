import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useParams } from 'react-router-dom';
import { Button, Card, CardHeader, CopyField, Icon, Input, Select, Skeleton, Switch, useToast } from '../../ui';
import { useStreamerApi } from '../../lib/streamerApi';
import { ErrorNote, PageHeader } from '../../components/dashboard/common';
import { useStreamerSettings } from './useStreamerSettings';

const THEMES = [
  { value: 'habesha', label: 'Habesha (flag colours)' },
  { value: 'minimal', label: 'Minimal' },
  { value: 'neon', label: 'Neon' },
];
const POSITIONS = [
  { value: 'top', label: 'Top' },
  { value: 'center', label: 'Center' },
  { value: 'bottom', label: 'Bottom' },
];
const EFFECTS = [
  { value: 'none', label: 'No effect' },
  { value: 'confetti', label: 'Confetti' },
  { value: 'fireworks', label: 'Fireworks' },
  { value: 'shake', label: 'Shake' },
];

const isHttps = (u) => !u || /^https:\/\/\S+$/i.test(u);

function Range({ label, value, min, max, step, onChange, format }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="flex justify-between font-medium text-fg">
        {label}
        <span className="tabular-nums text-muted">{format(value)}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="accent-[#078930]" />
    </label>
  );
}

Range.propTypes = {
  label: PropTypes.node.isRequired,
  value: PropTypes.number.isRequired,
  min: PropTypes.number.isRequired,
  max: PropTypes.number.isRequired,
  step: PropTypes.number.isRequired,
  onChange: PropTypes.func.isRequired,
  format: PropTypes.func.isRequired,
};

export default function OverlaySettingsPage() {
  const { uuid } = useParams();
  const call = useStreamerApi(uuid);
  const toast = useToast();
  const { settings, error: loadError, save } = useStreamerSettings(uuid);
  const [o, setO] = useState(null);
  const [overlayUrl, setOverlayUrl] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (settings && !o) setO({ ...settings.overlay, imageUrl: settings.overlay.imageUrl || '', tiers: settings.overlay.tiers || [] });
  }, [settings, o]);

  useEffect(() => {
    call(`/streamer/${uuid}/overlay`)
      .then((r) => setOverlayUrl(`${window.location.origin}${r.path}`))
      .catch(() => setOverlayUrl(null));
  }, [call, uuid]);

  if (loadError) return <ErrorNote>{loadError}</ErrorNote>;
  if (!o) return <Skeleton className="h-96 w-full max-w-2xl rounded-xl" />;

  const set = (key) => (value) => setO((x) => ({ ...x, [key]: value }));
  const setTier = (i, key, value) => setO((x) => ({ ...x, tiers: x.tiers.map((t, j) => (j === i ? { ...t, [key]: value } : t)) }));
  const tiersOk = o.tiers.every((t) => Number(t.minAmount) >= 1 && isHttps(t.imageUrl));
  const valid = isHttps(o.imageUrl) && tiersOk;

  const submit = async (e) => {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      await save({
        overlay: {
          theme: o.theme,
          position: o.position,
          durationMs: o.durationMs,
          chime: o.chime,
          volume: o.volume,
          scale: o.scale,
          imageUrl: o.imageUrl.trim() || null,
          tiers: o.tiers.map((t) => ({
            minAmount: Math.floor(Number(t.minAmount)),
            imageUrl: t.imageUrl?.trim() || null,
            color: t.color || null,
            effect: t.effect || 'none',
          })),
        },
      });
      toast.success('Overlay saved', { description: 'Your OBS overlay updates right away.' });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex max-w-2xl flex-col gap-6" noValidate>
      <PageHeader title="Overlay" description="How alerts look in OBS. Changes apply to the open overlay without reloading it." />

      <Card>
        <CardHeader title="OBS browser source" description="Add this URL as a Browser source (1920×1080). Keep it secret: anyone with it can see your alerts." />
        {overlayUrl ? <CopyField label="Overlay URL" value={overlayUrl} secret /> : <p className="text-sm text-muted">Enter your API key on the Live page to get your overlay URL.</p>}
      </Card>

      <Card>
        <CardHeader title="Look" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Theme" options={THEMES} value={o.theme} onChange={(e) => set('theme')(e.target.value)} />
          <Select label="Position" options={POSITIONS} value={o.position} onChange={(e) => set('position')(e.target.value)} />
          <Range label="Stays on screen" min={3000} max={30000} step={500} value={o.durationMs} onChange={set('durationMs')} format={(v) => `${(v / 1000).toFixed(1)} s`} />
          <Range label="Size" min={0.5} max={2} step={0.05} value={o.scale} onChange={set('scale')} format={(v) => `${Math.round(v * 100)}%`} />
          <Range label="Volume" min={0} max={1} step={0.05} value={o.volume} onChange={set('volume')} format={(v) => `${Math.round(v * 100)}%`} />
          <div className="flex items-end">
            <Switch checked={o.chime} onChange={set('chime')} label="Chime before each alert" />
          </div>
        </div>
        <Input
          className="mt-4"
          label="Alert image or GIF (https link)"
          placeholder="https://…/alert.gif"
          value={o.imageUrl}
          onChange={(e) => set('imageUrl')(e.target.value)}
          error={isHttps(o.imageUrl) ? undefined : 'Use an https:// link'}
        />
      </Card>

      <Card>
        <CardHeader
          title="Big donation tiers"
          description="Bigger alerts for bigger amounts. The highest tier the amount reaches is used."
          actions={o.tiers.length < 5 ? (
            <Button type="button" size="sm" variant="secondary" leftIcon={<Icon name="plus" size={14} />} onClick={() => set('tiers')([...o.tiers, { minAmount: (o.tiers.at(-1)?.minAmount || 50) * 2, effect: 'confetti', color: '#FCDD09', imageUrl: '' }])}>
              Add tier
            </Button>
          ) : null}
        />
        {o.tiers.length === 0 ? <p className="text-sm text-muted">No tiers. Every alert looks the same.</p> : null}
        <ul className="flex flex-col gap-4">
          {o.tiers.map((t, i) => (
            <li key={i} className="grid gap-3 rounded-lg border border-line p-3 sm:grid-cols-[7rem_1fr_4rem_auto] sm:items-end">
              <Input size="sm" label="From (birr)" type="number" min={1} value={String(t.minAmount)} onChange={(e) => setTier(i, 'minAmount', e.target.value)} />
              <Select label="Effect" options={EFFECTS} value={t.effect || 'none'} onChange={(e) => setTier(i, 'effect', e.target.value)} />
              <label className="flex flex-col gap-1.5 text-sm font-medium text-fg">
                Colour
                <input type="color" value={t.color || '#FCDD09'} onChange={(e) => setTier(i, 'color', e.target.value)} className="h-9 w-full cursor-pointer rounded-md border border-line bg-surface" />
              </label>
              <Button type="button" size="sm" variant="ghost" iconOnly aria-label="Remove tier" onClick={() => set('tiers')(o.tiers.filter((_, j) => j !== i))}>
                <Icon name="close" size={16} />
              </Button>
              <Input
                size="sm"
                className="sm:col-span-4"
                label="Image or GIF for this tier (optional)"
                value={t.imageUrl || ''}
                onChange={(e) => setTier(i, 'imageUrl', e.target.value)}
                error={isHttps(t.imageUrl) ? undefined : 'Use an https:// link'}
              />
            </li>
          ))}
        </ul>
      </Card>

      <ErrorNote>{error}</ErrorNote>
      <div>
        <Button type="submit" loading={busy} disabled={!valid}>Save overlay</Button>
      </div>
    </form>
  );
}
