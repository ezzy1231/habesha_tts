import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';

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
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-800/60 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-base">🎥</span>
        <span className="font-semibold">OBS Overlay</span>
        <span
          className={`ml-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
            overlayConnected
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
              : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${overlayConnected ? 'bg-emerald-500' : 'bg-gray-400'}`} />
          {overlayConnected ? 'OBS connected: alerts play in OBS' : 'Not connected'}
        </span>
        <button type="button" className="ml-auto text-xs underline opacity-80" onClick={() => setOpen((v) => !v)}>
          {open ? 'Hide setup' : 'How to set up'}
        </button>
      </div>

      {overlayConnected && (
        <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">
          Dashboard audio is paused while OBS is connected, so alerts don&apos;t play twice.
        </p>
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      {overlayUrl && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <code className="flex-1 min-w-0 truncate rounded bg-gray-100 dark:bg-gray-900 px-2 py-1 text-xs">
            {revealed ? overlayUrl : masked}
          </code>
          <button type="button" className="btn btn-ghost btn-xs" onClick={() => setRevealed((v) => !v)}>
            {revealed ? 'Hide' : 'Show'}
          </button>
          <button type="button" className="btn btn-primary btn-xs" onClick={copy}>
            {copied ? 'Copied ✓' : 'Copy URL'}
          </button>
          <a className="btn btn-ghost btn-xs" href={`${overlayUrl}?demo=1`} target="_blank" rel="noreferrer">
            Preview
          </a>
        </div>
      )}

      {open && (
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-xs text-gray-600 dark:text-gray-300">
          <li>In OBS: <b>Sources → + → Browser</b>.</li>
          <li>Paste the URL. Width <b>800</b>, Height <b>600</b>.</li>
          <li>Tick <b>Control audio via OBS</b> so the voice goes to your stream mix.</li>
          <li>To position it, add <code>?demo=1</code> to the URL for a sample alert every 12 s, then remove it.</li>
          <li>Options: <code>?position=top</code>, <code>?volume=70</code>, <code>?scale=1.3</code>, <code>?chime=0</code>.</li>
          <li>Keep this URL private. Anyone with it can see your alerts.</li>
        </ol>
      )}
    </div>
  );
}

ObsOverlayPanel.propTypes = {
  apiClient: PropTypes.func,
  uuid: PropTypes.string,
  usingSession: PropTypes.bool,
  overlayConnected: PropTypes.bool,
};
