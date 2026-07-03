import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '../api/client';

/**
 * Tiny data-fetching hook: every API call in the app gets loading / error /
 * data states and a `reload` function for free — no unhandled rejections.
 *
 *   const { data, loading, error, reload } = useFetch(() => api.get('/tags'));
 */
export function useFetch(fetcher, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true; // ignore results that land after unmount
    setState((s) => ({ ...s, loading: true, error: null }));
    fetcher()
      .then((res) => alive && setState({ data: res.data, loading: false, error: null }))
      .catch((err) => alive && setState({ data: null, loading: false, error: errorMessage(err) }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  return { ...state, reload };
}
