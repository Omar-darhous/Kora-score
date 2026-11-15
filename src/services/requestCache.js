// Session-only JSON cache. Never persist live results in localStorage.
export function createRequestCache({ fetcher = (...args) => fetch(...args), now = () => Date.now(), maxEntries = 100 } = {}) {
  const cache = new Map();
  const pending = new Map();
  return async function getJson(url, { ttl = 15000, forceRefresh = false, timeout = 15000 } = {}) {
    const key = String(url);
    // Join an existing network request, including React StrictMode duplicate effects.
    if (pending.has(key)) return structuredClone(await pending.get(key));
    const saved = cache.get(key);
    if (!forceRefresh && saved && saved.expires > now()) return structuredClone(saved.data);
    cache.delete(key);
    const request = (async () => {
      const response = await fetcher(key, { signal: AbortSignal.timeout(timeout) });
      if (!response.ok) throw new Error('Request failed: ' + response.status);
      const data = await response.json();
      if (data?.status === 'error') throw new Error('Data provider returned an error');
      if (ttl > 0) {
        for (const [entryKey, entry] of cache) if (entry.expires <= now()) cache.delete(entryKey);
        cache.set(key, { data, expires: now() + ttl });
        while (cache.size > maxEntries) cache.delete(cache.keys().next().value);
      }
      return data;
    })();
    pending.set(key, request);
    try { return structuredClone(await request); }
    finally { if (pending.get(key) === request) pending.delete(key); }
  };
}
export const cachedJson = createRequestCache();
