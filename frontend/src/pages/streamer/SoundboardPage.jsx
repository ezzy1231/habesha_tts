import { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useParams } from 'react-router-dom';
import { Badge, Button, Card, CardHeader, EmptyState, Icon, Input, Skeleton, Switch, useToast } from '../../ui';
import { useStreamerApi } from '../../lib/streamerApi';
import { ErrorNote, PageHeader } from '../../components/dashboard/common';
import { useStreamerSettings } from './useStreamerSettings';

const MAX_BYTES = 1024 * 1024;

function usePreview() {
  const ref = useRef(null);
  const [playing, setPlaying] = useState(null);
  useEffect(() => () => ref.current?.pause(), []);
  const toggle = useCallback((id, url) => {
    ref.current?.pause();
    if (playing === id) { setPlaying(null); return; }
    const a = new Audio(url);
    ref.current = a;
    setPlaying(id);
    a.onended = () => setPlaying(null);
    setTimeout(() => { if (ref.current === a) { a.pause(); setPlaying(null); } }, 10_000);
    a.play().catch(() => setPlaying(null));
  }, [playing]);
  return { playing, toggle };
}

function SoundRow({ sound, onSave, onDelete, preview }) {
  const [price, setPrice] = useState(String(sound.price));
  const [cooldown, setCooldown] = useState(String(sound.cooldownSeconds));
  const [busy, setBusy] = useState(false);
  const dirty = Number(price) !== sound.price || (!sound.isGlobal && Number(cooldown) !== sound.cooldownSeconds);

  const run = async (patch) => {
    setBusy(true);
    try { await onSave(sound, patch); } finally { setBusy(false); }
  };

  return (
    <li className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Button size="sm" variant="secondary" iconOnly aria-label={`Preview ${sound.label}`} onClick={() => preview.toggle(sound.id, sound.fileUrl)}>
          <Icon name={preview.playing === sound.id ? 'close' : 'live'} size={16} />
        </Button>
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-medium text-fg">
            <span className="truncate">{sound.label}</span>
            {sound.isGlobal ? <Badge size="sm">Library</Badge> : <Badge size="sm" variant="brand">Yours</Badge>}
          </div>
          <div className="text-xs text-muted">Cooldown {sound.cooldownSeconds} s</div>
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <Input size="sm" className="w-24" aria-label="Price (birr)" type="number" min={5} value={price} onChange={(e) => setPrice(e.target.value)} rightSlot={<span className="text-xs text-muted">ብር</span>} />
        {!sound.isGlobal ? (
          <Input size="sm" className="w-24" aria-label="Cooldown (seconds)" type="number" min={0} value={cooldown} onChange={(e) => setCooldown(e.target.value)} rightSlot={<span className="text-xs text-muted">s</span>} />
        ) : null}
        <Button size="sm" variant="secondary" disabled={!dirty} loading={busy} onClick={() => run(sound.isGlobal ? { price: Number(price) } : { price: Number(price), cooldown: Number(cooldown) })}>
          Save
        </Button>
        <Switch checked={sound.enabled} onChange={(v) => run({ enabled: v })} aria-label={`${sound.label} on or off`} />
        {!sound.isGlobal ? (
          <Button size="sm" variant="ghost" iconOnly aria-label={`Delete ${sound.label}`} className="text-muted hover:text-[#e5484d]" onClick={() => onDelete(sound)}>
            <Icon name="close" size={16} />
          </Button>
        ) : null}
      </div>
    </li>
  );
}

SoundRow.propTypes = {
  sound: PropTypes.object.isRequired,
  onSave: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  preview: PropTypes.object.isRequired,
};

export default function SoundboardPage() {
  const { uuid } = useParams();
  const call = useStreamerApi(uuid);
  const toast = useToast();
  const { settings, save } = useStreamerSettings(uuid);
  const preview = usePreview();
  const [sounds, setSounds] = useState(null);
  const [error, setError] = useState(null);
  const [file, setFile] = useState(null);
  const [label, setLabel] = useState('');
  const [price, setPrice] = useState('20');
  const [cooldown, setCooldown] = useState('30');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const fileRef = useRef(null);

  const load = useCallback(() => call(`/v1/streamer/${uuid}/sounds`).then((r) => setSounds(r.sounds)).catch((e) => setError(e.message)), [call, uuid]);
  useEffect(() => { load(); }, [load]);

  const saveSound = async (sound, patch) => {
    try {
      const r = await call(`/v1/streamer/${uuid}/sounds/${sound.id}`, { method: 'PUT', json: patch });
      setSounds((list) => list.map((s) => (s.id === sound.id ? r.sound : s)));
    } catch (e) {
      toast.error('Could not save', { description: e.message });
    }
  };

  const deleteSound = async (sound) => {
    if (!window.confirm(`Delete "${sound.label}"? This can't be undone.`)) return;
    try {
      await call(`/v1/streamer/${uuid}/sounds/${sound.id}`, { method: 'DELETE' });
      setSounds((list) => list.filter((s) => s.id !== sound.id));
    } catch (e) {
      toast.error('Could not delete', { description: e.message });
    }
  };

  const pickFile = (f) => {
    setUploadError(null);
    if (!f) { setFile(null); return; }
    if (f.size > MAX_BYTES) { setUploadError('The file is over 1 MB'); setFile(null); return; }
    if (!/\.(mp3|ogg|wav)$/i.test(f.name)) { setUploadError('Use an MP3, OGG or WAV file'); setFile(null); return; }
    setFile(f);
    if (!label) setLabel(f.name.replace(/\.[^.]+$/, '').slice(0, 30));
  };

  const upload = async (e) => {
    e.preventDefault();
    if (!file || !label.trim()) return;
    setUploading(true);
    setUploadError(null);
    try {
      const q = new URLSearchParams({ label: label.trim(), price, cooldown });
      const r = await call(`/v1/streamer/${uuid}/sounds?${q}`, { method: 'POST', body: file, headers: { 'Content-Type': file.type || 'application/octet-stream' } });
      setSounds((list) => [...(list || []), r.sound]);
      setFile(null);
      setLabel('');
      if (fileRef.current) fileRef.current.value = '';
      toast.success('Sound added');
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <PageHeader title="Soundboard" description="Viewers pay to play these sounds through your OBS overlay. Each sound plays for at most 10 seconds." />

      {settings ? (
        <Card className="mb-6" padding="sm">
          <Switch
            checked={settings.soundboardEnabled}
            onChange={(v) => save({ soundboardEnabled: v }).catch((err) => toast.error('Could not save', { description: err.message }))}
            label="Soundboard on"
            description={settings.soundboardEnabled ? 'Sounds show on your donate page.' : 'Viewers cannot buy sounds right now.'}
          />
        </Card>
      ) : null}

      <ErrorNote>{error}</ErrorNote>
      <Card>
        <CardHeader title="Sounds" description="Library sounds are shared by all streamers; set your own price or turn them off." />
        {!sounds ? (
          <Skeleton className="h-40 w-full rounded-lg" />
        ) : sounds.length === 0 ? (
          <EmptyState compact icon="music" title="No sounds yet" description="Upload your first sound below." />
        ) : (
          <ul className="divide-y divide-line">
            {sounds.map((s) => <SoundRow key={s.id} sound={s} onSave={saveSound} onDelete={deleteSound} preview={preview} />)}
          </ul>
        )}
      </Card>

      <Card className="mt-6">
        <CardHeader title="Upload a sound" description="MP3, OGG or WAV, up to 1 MB and 10 seconds." />
        <form onSubmit={upload} className="flex flex-col gap-4">
          <input
            ref={fileRef}
            type="file"
            accept=".mp3,.ogg,.wav,audio/mpeg,audio/ogg,audio/wav"
            onChange={(e) => pickFile(e.target.files?.[0])}
            className="block w-full text-sm text-muted file:mr-3 file:rounded-md file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-sm file:font-medium file:text-fg hover:file:bg-surface-3"
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <Input label="Name" maxLength={30} value={label} onChange={(e) => setLabel(e.target.value)} />
            <Input label="Price (birr)" type="number" min={5} value={price} onChange={(e) => setPrice(e.target.value)} />
            <Input label="Cooldown (seconds)" type="number" min={0} max={3600} value={cooldown} onChange={(e) => setCooldown(e.target.value)} />
          </div>
          <ErrorNote>{uploadError}</ErrorNote>
          <div>
            <Button type="submit" loading={uploading} disabled={!file || !label.trim()} leftIcon={<Icon name="plus" size={16} />}>Upload</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
