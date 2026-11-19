const TRUSTED_DW_ARTICLE_HOSTS = new Set(['dw.com', 'www.dw.com', 'm.dw.com']);

const decodeHtmlEntities = (value = '') => String(value)
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>');

export const isTrustedDwArticleUrl = (value) => {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'https:' && TRUSTED_DW_ARTICLE_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
};

export const isTrustedDwImageUrl = (value) => {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const parsed = new URL(value.trim());
    const host = parsed.hostname.toLowerCase();
    return parsed.protocol === 'https:' && (host === 'dw.com' || host.endsWith('.dw.com'));
  } catch {
    return false;
  }
};

export const extractArticleMetaImage = (html) => {
  if (typeof html !== 'string' || !html) return '';
  const metaTags = html.match(/<meta\b[^>]*>/gi) || [];
  let twitterFallback = '';

  for (const tag of metaTags) {
    const attrs = {};
    const attrPattern = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
    let match;
    while ((match = attrPattern.exec(tag)) !== null) {
      const attrName = match[1].toLowerCase();
      const attrValue = match[2] ?? match[3] ?? match[4] ?? '';
      attrs[attrName] = attrValue;
    }

    const key = (attrs.property || attrs.name || '').trim().toLowerCase();
    if (!key || !attrs.content) continue;

    const candidate = decodeHtmlEntities(attrs.content).trim();
    if (!isTrustedDwImageUrl(candidate)) continue;

    if (key === 'og:image' || key === 'og:image:secure_url') {
      return candidate;
    }
    if (!twitterFallback && (key === 'twitter:image' || key === 'twitter:image:src')) {
      twitterFallback = candidate;
    }
  }

  return twitterFallback;
};

export const createArticleImageResolver = ({
  fetcher = (...args) => fetch(...args),
  timeout = 6000,
  maxCacheEntries = 100
} = {}) => {
  const cache = new Map();
  const pending = new Map();

  const remember = (url, imageUrl) => {
    if (!cache.has(url) && cache.size >= maxCacheEntries) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey !== undefined) cache.delete(oldestKey);
    }
    cache.set(url, imageUrl);
  };

  const resolve = (articleUrl, { signal } = {}) => {
    if (!isTrustedDwArticleUrl(articleUrl)) return Promise.resolve('');
    const normalizedUrl = articleUrl.trim();
    if (cache.has(normalizedUrl)) return Promise.resolve(cache.get(normalizedUrl));
    if (pending.has(normalizedUrl)) return pending.get(normalizedUrl);
    if (signal?.aborted) return Promise.resolve('');

    const request = (async () => {
      const controller = new AbortController();
      const onExternalAbort = () => controller.abort();
      if (signal) signal.addEventListener('abort', onExternalAbort, { once: true });
      const timer = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetcher(normalizedUrl, { signal: controller.signal });
        if (!response?.ok) {
          remember(normalizedUrl, '');
          return '';
        }
        const html = await response.text();
        const imageUrl = extractArticleMetaImage(html);
        remember(normalizedUrl, imageUrl);
        return imageUrl;
      } catch {
        if (!signal?.aborted) {
          remember(normalizedUrl, '');
        }
        return '';
      } finally {
        clearTimeout(timer);
        if (signal) signal.removeEventListener('abort', onExternalAbort);
        pending.delete(normalizedUrl);
      }
    })();

    pending.set(normalizedUrl, request);
    return request;
  };

  return {
    resolve,
    clearCache: () => cache.clear(),
    getCacheSize: () => cache.size
  };
};

export const defaultArticleImageResolver = createArticleImageResolver();

export const enrichNewsImages = async (
  articles,
  { resolver = defaultArticleImageResolver, concurrency = 3, onImageResolved, signal } = {}
) => {
  if (!Array.isArray(articles) || articles.length === 0) return [];
  const queue = articles.filter(item => item && !item.img && isTrustedDwArticleUrl(item.link));
  if (queue.length === 0) return articles;

  const resolvedById = new Map();
  let cursor = 0;
  const workerCount = Math.min(Math.max(1, concurrency), queue.length);

  const worker = async () => {
    while (cursor < queue.length && !signal?.aborted) {
      const article = queue[cursor++];
      const imageUrl = await resolver.resolve(article.link, { signal });
      if (!signal?.aborted && imageUrl) {
        resolvedById.set(article.id, imageUrl);
        onImageResolved?.(article.id, imageUrl);
      }
    }
  };

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  if (resolvedById.size === 0) return articles;

  return articles.map(item => (
    resolvedById.has(item.id) ? { ...item, img: resolvedById.get(item.id) } : item
  ));
};
