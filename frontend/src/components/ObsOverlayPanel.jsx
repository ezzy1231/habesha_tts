import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Badge, Button, Card, Icon } from '../ui';

// Shows the streamer's secret OBS Browser Source URL and whether OBS is connected.
export default function ObsOverlayPanel({ apiClient, uuid, usingSession, overlayConnected }) {
  const [overlayUrl, setOverlayUrl] = useState(null);
  const [error, setError] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!apiClient || !uuid) return;
    let cancelled = false;
    const path = usingSession ? `/v1/streamer/${uuid}/overlay` : `/streamer/${uuid}/overlay`;
    apiClient.get(path)
      .then(({ data }) => {
        if (!cancelled && data?.path) setOverlayUrl(`${window.location.origin}${data.path}`);
      })
      .catch(() => { if (!cancelled) setError('Could not load your overlay link. Refresh to try again.'); });
    return () => { cancelled = true; };
  }, [apiClient, uuid, usingSession]);

  const copy = async () => {
    if (!overlayUrl) return;
    try {
      await navigator.clipboard.writeText(overlayUrl);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = overlayUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const masked = overlayUrl ? overlayUrl.replace(/\/overlay\/.*/, '/overlay/••••••••••••') : '';

  return (
    <Card padding="sm" className="text-sm">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-300">
          <Icon name="film" size={16} />
        </span>
        <span className="font-semibold text-fg">OBS overlay</span>
        <Badge variant={overlayConnected ? 'success' : 'neutral'} dot size="sm">
          {overlayConnected ? 'Connected: alerts play in OBS' : 'Not connected'}
        </Badge>
        <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setOpen((v) => !v)} rightIcon={<Icon name="chevronDown" size={14} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />}>
          {open ? 'Hide setup' : 'How to set up'}
        </Button>
      </div>

      {overlayConnected && (
        <p className="mt-2 text-xs text-muted">Dashboard audio is paused while OBS is connected, so alerts don&apos;t play twice.</p>
      )}

      {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}

      {overlayUrl && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 font-mono text-xs text-muted">
            {revealed ? overlayUrl : masked}
          </code>
          <Button variant="ghost" size="sm" onClick={() => setRevealed((v) => !v)} leftIcon={<Icon name={revealed ? 'eyeOff' : 'eye'} size={14} />}>
            {revealed ? 'Hide' : 'Show'}
          </Button>
          <Button size="sm" onClick={copy} leftIcon={<Icon name={copied ? 'check' : 'copy'} size={14} />}>
            {copied ? 'Copied' : 'Copy URL'}
          </Button>
          <Button as="a" variant="secondary" size="sm" href={`${overlayUrl}?demo=1`} target="_blank" rel="noreferrer" leftIcon={<Icon name="external" size={14} />}>
            Preview
          </Button>
        </div>
      )}

      {open && (
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-xs text-muted">
          <li>In OBS: <b className="text-fg">Sources → + → Browser</b>.</li>
          <li>Paste the URL. Width <b className="text-fg">800</b>, Height <b className="text-fg">600</b>.</li>
          <li>Tick <b className="text-fg">Control audio via OBS</b> so the voice goes to your stream mix.</li>
          <li>To position it, add <code>?demo=1</code> to the URL for a sample alert every 12 s, then remove it.</li>
          <li>Options: <code>?position=top</code>, <code>?volume=70</code>, <code>?scale=1.3</code>, <code>?chime=0</code>.</li>
          <li>Keep this URL private. Anyone with it can see your alerts.</li>
        </ol>
      )}
    </Card>
  );
}

ObsOverlayPanel.propTypes = {
  apiClient: PropTypes.func,
  uuid: PropTypes.string,
  usingSession: PropTypes.bool,
  overlayConnected: PropTypes.bool,
};
