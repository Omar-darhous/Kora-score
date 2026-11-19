// Session-only response cache. Never persist live results in localStorage.
const createAbortError = (message = 'Request aborted') => {
  const abortError = new Error(message);
  abortError.name = 'AbortError';
  return abortError;
};

export function createRequestCache({
  fetcher = (...args) => fetch(...args),
  now = () => Date.now(),
  maxEntries = 100,
  parseResponse = (response) => response.json()
} = {}) {
  const cache = new Map();
  const pending = new Map();
  const latestCompletedVersion = new Map();
  let sequence = 0;

  const awaitEntryWithSignal = (key, entry, signal) => {
    if (!signal) {
      return entry.promise.then(
        (data) => {
          entry.waiters = Math.max(0, entry.waiters - 1);
          return structuredClone(data);
        },
        (err) => {
          entry.waiters = Math.max(0, entry.waiters - 1);
          throw err;
        }
      );
    }

    if (signal.aborted) {
      entry.waiters = Math.max(0, entry.waiters - 1);
      if (entry.waiters === 0) {
        if (pending.get(key) === entry) pending.delete(key);
        entry.controller.abort();
      }
      return Promise.reject(createAbortError());
    }

    return new Promise((resolve, reject) => {
      let settled = false;
      const finishWaiter = () => {
        if (settled) return false;
        settled = true;
        signal.removeEventListener('abort', onAbort);
        entry.waiters = Math.max(0, entry.waiters - 1);
        return true;
      };
      const onAbort = () => {
        if (!finishWaiter()) return;
        if (entry.waiters === 0) {
          if (pending.get(key) === entry) pending.delete(key);
          entry.controller.abort();
        }
        reject(createAbortError());
      };

      signal.addEventListener('abort', onAbort, { once: true });
      entry.promise.then(
        (data) => {
          if (!finishWaiter()) return;
          resolve(structuredClone(data));
        },
        (err) => {
          if (!finishWaiter()) return;
          reject(err);
        }
      );
    });
  };

  return async function getCached(url, { ttl = 15000, forceRefresh = false, timeout = 15000, signal } = {}) {
    if (signal?.aborted) throw createAbortError();
    const key = String(url);

    // Join an existing non-aborted network request for normal (non-forced) calls.
    const existing = pending.get(key);
    if (!forceRefresh && existing && !existing.controller.signal.aborted) {
      existing.waiters += 1;
      return awaitEntryWithSignal(key, existing, signal);
    }

    const saved = cache.get(key);
    if (!forceRefresh && saved && saved.expires > now()) return structuredClone(saved.data);
    if (saved && saved.expires <= now()) cache.delete(key);

    const version = ++sequence;
    const controller = new AbortController();
    const entry = { controller, waiters: 1, promise: null };

    entry.promise = (async () => {
      const timer = setTimeout(() => controller.abort(), timeout);
      try {
        const response = await fetcher(key, { signal: controller.signal });
        if (!response.ok) throw new Error('Request failed: ' + response.status);
        const data = await parseResponse(response);
        if (controller.signal.aborted) throw createAbortError();
        if (data && typeof data === 'object' && data.status === 'error') {
          throw new Error('Data provider returned an error');
        }
        const completedVersion = latestCompletedVersion.get(key) || 0;
        if (version < completedVersion) {
          const newerSaved = cache.get(key);
          return newerSaved ? newerSaved.data : data;
        }
        latestCompletedVersion.set(key, version);
        if (ttl > 0) {
          for (const [entryKey, cachedEntry] of cache) if (cachedEntry.expires <= now()) cache.delete(entryKey);
          cache.set(key, { data, expires: now() + ttl, version });
          while (cache.size > maxEntries) cache.delete(cache.keys().next().value);
        }
        return data;
      } finally {
        clearTimeout(timer);
        if (pending.get(key) === entry) pending.delete(key);
      }
    })();

    // Prevent unhandled rejections when the final consumer aborts before the underlying fetch settles.
    entry.promise.catch(() => {});
    pending.set(key, entry);
    return awaitEntryWithSignal(key, entry, signal);
  };
}
export const cachedJson = createRequestCache();
