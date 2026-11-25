import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button, Card, CardHeader, CopyField, Input, Skeleton, Switch, Textarea, useToast } from '../../ui';
import { ErrorNote, PageHeader } from '../../components/dashboard/common';
import { useStreamerSettings } from './useStreamerSettings';

const splitWords = (text) => text.split(/[\n,]+/).map((w) => w.trim()).filter(Boolean);

export default function SettingsPage() {
  const { uuid } = useParams();
  const toast = useToast();
  const { settings, error: loadError, save } = useStreamerSettings(uuid);
  const [form, setForm] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (settings && !form) {
      setForm({
        slug: settings.slug,
        minTtsAmount: String(settings.minTtsAmount ?? 0),
        blockedWords: (settings.blockedWords || []).join('\n'),
        soundboardEnabled: settings.soundboardEnabled,
        mediaEnabled: settings.mediaEnabled,
        mediaMinAmount: String(settings.mediaMinAmount),
        mediaMaxSeconds: String(settings.mediaMaxSeconds),
      });
    }
  }, [settings, form]);

  if (loadError) return <ErrorNote>{loadError}</ErrorNote>;
  if (!form) return <Skeleton className="h-96 w-full max-w-2xl rounded-xl" />;

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));
  const slugOk = /^[a-z0-9_]{3,30}$/.test(form.slug);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const saved = await save({
        slug: form.slug,
        minTtsAmount: Math.max(0, Math.floor(Number(form.minTtsAmount) || 0)),
        blockedWords: splitWords(form.blockedWords),
        soundboardEnabled: form.soundboardEnabled,
        mediaEnabled: form.mediaEnabled,
        mediaMinAmount: Math.floor(Number(form.mediaMinAmount) || 0),
        mediaMaxSeconds: Math.floor(Number(form.mediaMaxSeconds) || 0),
      });
      setForm((f) => ({ ...f, slug: saved.slug, blockedWords: saved.blockedWords.join('\n') }));
      toast.success('Settings saved');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex max-w-2xl flex-col gap-6" noValidate>
      <PageHeader title="Settings" description="Your donate link, minimums and word filter." />

      <Card>
        <CardHeader title="Donate link" />
        <div className="flex flex-col gap-4">
          <CopyField label="Share this with your viewers" value={settings.publicUrl} />
          <Input
            label="Link name"
            value={form.slug}
            onChange={(e) => set('slug')(e.target.value.toLowerCase())}
            leftIcon={<span className="text-sm">@</span>}
            hint="3–30 letters, numbers or _. Changing it breaks the old link."
            error={slugOk ? undefined : 'Use 3–30 lowercase letters, numbers or _'}
          />
        </div>
      </Card>

      <Card>
        <CardHeader title="Voice messages" />
        <div className="flex flex-col gap-4">
          <Input
            label="Minimum donation (birr)"
            type="number"
            min={0}
            value={form.minTtsAmount}
            onChange={(e) => set('minTtsAmount')(e.target.value)}
            hint="Messages cheaper than this are raised to this amount. 0 uses the normal price."
          />
          <Textarea
            label="Blocked words"
            rows={5}
            value={form.blockedWords}
            onChange={(e) => set('blockedWords')(e.target.value)}
            hint="One per line or comma separated. They are shown as *** and not read aloud. Spelling tricks like repeated letters are caught too."
          />
        </div>
      </Card>

      <Card>
        <CardHeader title="Soundboard and media share" />
        <div className="flex flex-col gap-5">
          <Switch checked={form.soundboardEnabled} onChange={set('soundboardEnabled')} label="Soundboard" description="Viewers pay to play a sound on your stream." />
          <Switch checked={form.mediaEnabled} onChange={set('mediaEnabled')} label="Media share" description="Viewers pay to request a YouTube video. You approve each one." />
          {form.mediaEnabled ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Minimum for a video (birr)" type="number" min={10} value={form.mediaMinAmount} onChange={(e) => set('mediaMinAmount')(e.target.value)} />
              <Input label="Longest play time (seconds)" type="number" min={10} max={600} value={form.mediaMaxSeconds} onChange={(e) => set('mediaMaxSeconds')(e.target.value)} />
            </div>
          ) : null}
        </div>
      </Card>

      <ErrorNote>{error}</ErrorNote>
      <div>
        <Button type="submit" loading={busy} disabled={!slugOk}>Save settings</Button>
      </div>
    </form>
  );
}
