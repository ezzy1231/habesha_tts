import { useCallback, useEffect, useState } from 'react';
import { useStreamerApi } from '../../lib/streamerApi';

/** Load and save /v1/streamer/:uuid/settings. `save(patch)` sends only the given fields. */
export function useStreamerSettings(uuid) {
  const call = useStreamerApi(uuid);
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const ctrl = new AbortController();
    call(`/v1/streamer/${uuid}/settings`, { signal: ctrl.signal })
      .then((r) => setSettings(r.settings))
      .catch((e) => { if (e.name !== 'AbortError') setError(e.message); });
    return () => ctrl.abort();
  }, [call, uuid]);

  const save = useCallback(async (patch) => {
    const r = await call(`/v1/streamer/${uuid}/settings`, { method: 'PUT', json: patch });
    setSettings(r.settings);
    return r.settings;
  }, [call, uuid]);

  return { settings, error, save };
}
