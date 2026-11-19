import { createRequestCache } from './requestCache.js';

export const DEFAULT_NEWS_CACHE_TTL = 180000;
export const DEFAULT_NEWS_PROVIDER_TIMEOUT = 8000;
export const DEFAULT_NEWS_REFRESH_INTERVAL = 300000;

const TRACKING_QUERY_PARAMS = new Set([
  'maca',
  'fbclid',
  'gclid',
  'mc_cid',
  'mc_eid',
  'ref',
  'ref_src',
  's'
]);

const NAMED_HTML_ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  laquo: '«',
  raquo: '»',
  ndash: '–',
  mdash: '—',
  hellip: '…'
};

export const NEWS_PROVIDERS = Object.freeze({
  'cnn-ar': Object.freeze({
    id: 'cnn-ar',
    name: 'CNN بالعربية',
    publisherUrl: 'https://arabic.cnn.com/sport',
    feedUrl: 'https://arabic.cnn.com/api/v1/rss/sport/rss.xml',
    format: 'rss',
    enabled: true,
    requiresArticleImageEnrichment: false,
    allowedArticleHosts: Object.freeze(['arabic.cnn.com']),
    allowedImageHosts: Object.freeze(['cnn-arabic-images.cnn.io', 'arabic.cnn.com', '*.cnn.io', '*.cnn.com'])
  }),
  'dw-ar': Object.freeze({
    id: 'dw-ar',
    name: 'DW العربية',
    publisherUrl: 'https://www.dw.com/ar',
    feedUrl: 'https://rss.dw.com/xml/rss-ar-sports',
    format: 'rss-rdf',
    enabled: true,
    requiresArticleImageEnrichment: true,
    allowedArticleHosts: Object.freeze(['dw.com', 'www.dw.com', 'm.dw.com']),
    allowedImageHosts: Object.freeze(['dw.com', '*.dw.com'])
  })
});

export const createNewsProvider = (config) => {
  if (!config || typeof config !== 'object') {
    throw new Error('News provider configuration must be an object');
  }
  const {
    id,
    name,
    publisherUrl,
    feedUrl,
    format = 'rss',
    enabled = true,
    requiresArticleImageEnrichment = false,
    allowedArticleHosts = [],
    allowedImageHosts = []
  } = config;

  if (!id || !name || !feedUrl) {
    throw new Error('News provider requires id, name, and feedUrl');
  }

  return Object.freeze({
    id: String(id),
    name: String(name),
    publisherUrl: publisherUrl ? String(publisherUrl) : '',
    feedUrl: String(feedUrl),
    format: String(format),
    enabled: Boolean(enabled),
    requiresArticleImageEnrichment: Boolean(requiresArticleImageEnrichment),
    allowedArticleHosts: Object.freeze([...allowedArticleHosts]),
    allowedImageHosts: Object.freeze([...allowedImageHosts])
  });
};

export const getEnabledNewsProviders = (providers = NEWS_PROVIDERS) => {
  const list = Array.isArray(providers) ? providers : Object.values(providers || {});
  return list.filter(provider => provider && provider.enabled);
};

export const decodeHtmlEntities = (value = '') => String(value).replace(
  /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
  (full, entity) => {
    const lower = entity.toLowerCase();
    if (lower.startsWith('#x')) {
      const code = Number.parseInt(lower.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : full;
    }
    if (lower.startsWith('#')) {
      const code = Number.parseInt(lower.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : full;
    }
    return Object.prototype.hasOwnProperty.call(NAMED_HTML_ENTITIES, lower)
      ? NAMED_HTML_ENTITIES[lower]
      : full;
  }
);

const unwrapCdata = (value = '') => String(value).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1');

export const stripHtmlToText = (value = '', { preserveLineBreaks = false } = {}) => {
  if (typeof value !== 'string' || !value) return '';
  let text = unwrapCdata(value);
  if (preserveLineBreaks) {
    text = text.replace(/<\s*(?:br\s*\/?|\/p|\/div|\/li|\/h[1-6])\s*>/gi, '\n');
  }
  text = text.replace(/<script\b[\s\S]*?<\/script>/gi, ' ');
  text = text.replace(/<style\b[\s\S]*?<\/style>/gi, ' ');
  text = text.replace(/<[^>]*>/g, ' ');
  text = decodeHtmlEntities(text);
  if (preserveLineBreaks) {
    return text
      .replace(/[ \t\r\f\v]+/g, ' ')
      .replace(/ *\n */g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
  return text.replace(/\s+/g, ' ').trim();
};

const matchesAllowedHost = (hostname, allowedHosts = []) => {
  const normalizedHost = String(hostname || '').toLowerCase();
  if (!normalizedHost || !Array.isArray(allowedHosts) || allowedHosts.length === 0) return false;
  return allowedHosts.some((pattern) => {
    const rule = String(pattern || '').trim().toLowerCase();
    if (!rule) return false;
    if (rule.startsWith('*.')) {
      const suffix = rule.slice(1); // '.dw.com'
      return normalizedHost.endsWith(suffix) && normalizedHost.length > suffix.length;
    }
    return normalizedHost === rule;
  });
};

export const isAllowedHttpsUrl = (value, allowedHosts = []) => {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== 'https:') return false;
    return matchesAllowedHost(parsed.hostname, allowedHosts);
  } catch {
    return false;
  }
};

export const validateProviderArticleUrl = (url, provider) => {
  if (!provider) return '';
  const candidate = decodeHtmlEntities(String(url || '')).trim();
  return isAllowedHttpsUrl(candidate, provider.allowedArticleHosts) ? candidate : '';
};

export const validateProviderImageUrl = (url, provider) => {
  if (!provider) return '';
  const candidate = decodeHtmlEntities(String(url || '')).trim();
  return isAllowedHttpsUrl(candidate, provider.allowedImageHosts) ? candidate : '';
};

export const canonicalizeArticleUrl = (url) => {
  if (typeof url !== 'string' || !url.trim()) return '';
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== 'https:') return '';
    parsed.hash = '';
    const keptParams = [];
    for (const [key, val] of parsed.searchParams.entries()) {
      const lowerKey = key.toLowerCase();
      if (lowerKey.startsWith('utm_') || TRACKING_QUERY_PARAMS.has(lowerKey)) continue;
      keptParams.push([key, val]);
    }
    keptParams.sort(([a], [b]) => a.localeCompare(b));
    parsed.search = '';
    for (const [key, val] of keptParams) {
      parsed.searchParams.append(key, val);
    }
    const cleanPath = parsed.pathname.replace(/\/+$/, '') || '/';
    return `${parsed.protocol}//${parsed.hostname.toLowerCase()}${cleanPath}${parsed.search}`;
  } catch {
    return '';
  }
};

export const normalizeTitleForComparison = (title = '') => String(title)
  .toLowerCase()
  .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
  .replace(/[أإآ]/g, 'ا')
  .replace(/ة/g, 'ه')
  .replace(/ى/g, 'ي')
  .replace(/[^\p{L}\p{N}\s]/gu, ' ')
  .replace(/\s+/g, ' ')
  .trim();

export const parsePublishedDate = (rawDate) => {
  if (typeof rawDate !== 'string') return { publishedAt: null, publishedTs: 0 };
  const trimmed = rawDate.trim();
  if (!trimmed) return { publishedAt: null, publishedTs: 0 };

  let normalized = trimmed;
  // Treat timezone-less SQL timestamps (e.g. "2026-11-11 06:57:00") explicitly as UTC.
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2})?$/.test(trimmed)) {
    normalized = `${trimmed.replace(' ', 'T')}Z`;
  }

  const parsedMs = Date.parse(normalized);
  if (!Number.isFinite(parsedMs)) return { publishedAt: null, publishedTs: 0 };

  const dateObj = new Date(parsedMs);
  const year = dateObj.getUTCFullYear();
  if (year < 2000 || year > 2100) return { publishedAt: null, publishedTs: 0 };

  return {
    publishedAt: dateObj.toISOString(),
    publishedTs: parsedMs
  };
};

export const formatRelativeArabicDate = (publishedTs, nowMs = Date.now()) => {
  if (!Number.isFinite(publishedTs) || publishedTs <= 0) {
    return 'تاريخ غير محدد';
  }
  const diffMs = Math.max(0, nowMs - publishedTs);
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffHours === 0) return 'منذ أقل من ساعة';
  if (diffHours === 1) return 'منذ ساعة واحدة';
  if (diffHours === 2) return 'منذ ساعتين';
  if (diffHours <= 10) return `منذ ${diffHours} ساعات`;
  if (diffHours < 24) return `منذ ${diffHours} ساعة`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'منذ يوم واحد';
  if (diffDays === 2) return 'منذ يومين';
  if (diffDays <= 10) return `منذ ${diffDays} أيام`;
  return `منذ ${diffDays} يوم`;
};

const estimateReadTime = (text = '') => {
  const words = String(text).trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.min(10, Math.max(1, Math.round(words / 180)));
  if (minutes === 1) return 'دقيقة قراءة';
  if (minutes === 2) return 'دقيقتان قراءة';
  return `${minutes} دقائق قراءة`;
};

const NON_FOOTBALL_PATTERNS = [
  { label: 'ملاكمة', pattern: /(?:^|\s)(?:ملاكم|ملاكمة|الملاكمة|ضربة قاضية|الوزن الثقيل|ufc|wwe|مصارعة|المصارعة)(?:\s|$)/i },
  { label: 'تنس', pattern: /(?:^|\s)(?:تنس|التنس|ويمبلدون|رولان غاروس|أستراليا المفتوحة|بطولة أمريكا المفتوحة|atp|wta|ديوكوفيتش|ألكاراز|سينر|نادال|فيدرر)(?:\s|$)/i },
  { label: 'كرة السلة', pattern: /(?:^|\s)(?:كرة السلة|السلة|nba|الإن بي إيه|ليبرون جيمس|ستيفن كوري)(?:\s|$)/i },
  { label: 'رياضة المحركات', pattern: /(?:^|\s)(?:فورمولا|سباق سيارات|رالي داكار|فيرستابن|هاميلتون|f1|موتو جي بي)(?:\s|$)/i },
  { label: 'ألعاب أخرى', pattern: /(?:^|\s)(?:كرة اليد|كرة الطائرة|الكرة الطائرة|ألعاب القوى|سباحة|السباحة|غولف|الغولف|كريكيت|شطرنج|الشطرنج|رفع أثقال|جودو|تايكوندو|جمباز|سلاح الشيش|دراجات|الدراجات|تزلج|الأولمبياد الشتوي)(?:\s|$)/i }
];

const FOOTBALL_PATTERNS = [
  /(?:كرة القدم|الفيفا|فيفا|يويفا|الكاف|الاتحاد الدولي لكرة القدم|الاتحاد الأوروبي لكرة القدم)/i,
  /(?:دوري أبطال|الدوري الإنجليزي|البريميرليغ|الدوري الإسباني|الليغا|الدوري الإيطالي|الكالتشيو|الدوري الألماني|البوندسليغا|الدوري الفرنسي|الدوري المصري|الدوري السعودي|دوري روشن|الدوري المغربي|دوري الأمم|كأس العالم|المونديال|كأس أمم أفريقيا|أمم أفريقيا|كأس آسيا|كوبا أمريكا|اليورو|كأس الملك|كأس السوبر)/i,
  /(?:الأهلي|الزمالك|بيراميدز|ريال مدريد|برشلونة|ليفربول|مانشستر سيتي|مانشستر يونايتد|أرسنال|تشيلسي|توتنهام|بايرن ميونخ|باريس سان جيرمان|يوفنتوس|ميلان|إنتر ميلان|أتلتيكو مدريد|الهلال|النصر|الاتحاد|الأهلي السعودي|الوداد|الرجاء|الترجي)/i,
  /(?:منتخب مصر|منتخب المغرب|منتخب السعودية|منتخب الجزائر|منتخب تونس|منتخب الأردن|منتخب العراق|منتخب قطر|منتخب الإمارات|منتخب البرازيل|منتخب الأرجنتين|منتخب فرنسا|منتخب إسبانيا|منتخب إنجلترا|منتخب ألمانيا|الفراعنة|أسود الأطلس|الأخضر السعودي)/i,
  /(?:محمد صلاح|ميسي|ليونيل ميسي|رونالدو|كريستيانو|مبابي|كيليان مبابي|هالاند|فينيسيوس|لامين يامال|بيلينغهام|سالم الدوسري|عمر مرموش|أشرف حكيمي|كلوب|يورغن كلوب|غوارديولا|أنشيلوتي|سكالوني|إنفانتينو|حسام حسن|كومباني|مورينيو|توتي|روني)/i,
  /(?:حارس مرمى|ركلة جزاء|ركلات الترجيح|تسلل|شباك|الميركاتو|الكرة الذهبية|الهداف|هدّاف|بطاقة حمراء|ديربي|كلاسيكو)/i
];

export const classifySportsArticle = ({ title = '', desc = '', categories = [] } = {}) => {
  const headlineAndDesc = `${title} ${desc}`;
  const fullContext = `${headlineAndDesc} ${(Array.isArray(categories) ? categories : []).join(' ')}`;

  const hasFootballSignal = FOOTBALL_PATTERNS.some(pattern => pattern.test(fullContext));
  const nonFootballMatch = NON_FOOTBALL_PATTERNS.find(({ pattern }) => pattern.test(headlineAndDesc));

  if (nonFootballMatch && !hasFootballSignal) {
    return {
      isFootball: false,
      category: nonFootballMatch.label,
      confidence: 'high'
    };
  }

  if (hasFootballSignal && !nonFootballMatch) {
    return {
      isFootball: true,
      category: 'كرة القدم',
      confidence: 'high'
    };
  }

  // If both signals appear, defer to headline-only check; otherwise stay conservative.
  if (hasFootballSignal && nonFootballMatch) {
    const footballInHeadline = FOOTBALL_PATTERNS.some(pattern => pattern.test(title));
    const nonFootballInHeadline = nonFootballMatch.pattern.test(title);
    if (footballInHeadline && !nonFootballInHeadline) {
      return { isFootball: true, category: 'كرة القدم', confidence: 'medium' };
    }
    if (nonFootballInHeadline && !footballInHeadline) {
      return { isFootball: false, category: nonFootballMatch.label, confidence: 'medium' };
    }
  }

  return {
    isFootball: null,
    category: 'رياضة عامة',
    confidence: 'uncertain'
  };
};

const parseXmlAttributes = (tagOpening = '') => {
  const attrs = {};
  const attrPattern = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let match;
  while ((match = attrPattern.exec(tagOpening)) !== null) {
    attrs[match[1].toLowerCase()] = decodeHtmlEntities(match[2] ?? match[3] ?? '');
  }
  return attrs;
};

const extractFirstTagContent = (xmlBlock, tagNames) => {
  for (const tagName of tagNames) {
    const escaped = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, 'i');
    const match = xmlBlock.match(regex);
    if (match && match[1] != null) {
      const value = unwrapCdata(match[1]).trim();
      if (value) return value;
    }
  }
  return '';
};

const extractAllTagContents = (xmlBlock, tagNames) => {
  const results = [];
  for (const tagName of tagNames) {
    const escaped = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, 'gi');
    let match;
    while ((match = regex.exec(xmlBlock)) !== null) {
      const cleaned = stripHtmlToText(match[1] || '');
      if (cleaned) results.push(cleaned);
    }
  }
  return results;
};

const extractImageCandidatesFromItem = (itemXml, rawContent = '', rawDescription = '') => {
  const mediaCandidates = [];
  const mediaTagRegex = /<(media:content|enclosure|media:thumbnail)\b([^>]*)>/gi;
  let match;

  while ((match = mediaTagRegex.exec(itemXml)) !== null) {
    const tagName = match[1].toLowerCase();
    const attrs = parseXmlAttributes(match[2]);
    const url = (attrs.url || '').trim();
    if (!url) continue;

    const medium = (attrs.medium || '').toLowerCase();
    const type = (attrs.type || '').toLowerCase();
    const isImage = tagName === 'media:thumbnail'
      || medium === 'image'
      || type.startsWith('image/')
      || (!type && /\.(?:jpe?g|png|webp|avif)(?:[?#]|$)/i.test(url));

    if (!isImage) continue;
    const width = Number.parseInt(attrs.width || '0', 10) || 0;
    const priority = tagName === 'media:content' ? 3 : tagName === 'enclosure' ? 2 : 1;
    mediaCandidates.push({ url, width, priority });
  }

  mediaCandidates.sort((a, b) => (b.width - a.width) || (b.priority - a.priority));

  const embedded = [];
  const htmlSource = `${unwrapCdata(rawContent)} ${unwrapCdata(rawDescription)}`;
  const imgRegex = /<img\b[^>]+src=["']([^"']+)["']/gi;
  let imgMatch;
  while ((imgMatch = imgRegex.exec(htmlSource)) !== null) {
    if (imgMatch[1]) embedded.push(decodeHtmlEntities(imgMatch[1]).trim());
  }

  return [...mediaCandidates.map(c => c.url), ...embedded];
};

export const parseFeedXml = (xmlText) => {
  if (typeof xmlText !== 'string' || !xmlText.trim()) return [];
  const itemRegex = /<item\b([^>]*)>([\s\S]*?)<\/item>/gi;
  const items = [];
  let match;

  while ((match = itemRegex.exec(xmlText)) !== null) {
    const itemAttrs = parseXmlAttributes(match[1] || '');
    const bodyXml = match[2] || '';

    const rawTitle = extractFirstTagContent(bodyXml, ['title']);
    const rawLink = extractFirstTagContent(bodyXml, ['link']) || itemAttrs['rdf:about'] || '';
    const rawGuid = extractFirstTagContent(bodyXml, ['guid', 'dc:identifier']) || itemAttrs['rdf:about'] || '';
    const rawPubDate = extractFirstTagContent(bodyXml, ['pubDate', 'dc:date', 'published', 'updated', 'dcterms:modified']);
    const rawDescription = extractFirstTagContent(bodyXml, ['description', 'dc:description', 'summary']);
    const rawContent = extractFirstTagContent(bodyXml, ['content:encoded', 'content']);
    const categories = extractAllTagContents(bodyXml, ['category', 'dc:subject']);
    const imageCandidates = extractImageCandidatesFromItem(bodyXml, rawContent, rawDescription);

    items.push({
      guid: stripHtmlToText(rawGuid),
      title: stripHtmlToText(rawTitle),
      link: decodeHtmlEntities(rawLink).trim(),
      pubDate: stripHtmlToText(rawPubDate),
      description: stripHtmlToText(rawDescription),
      content: stripHtmlToText(rawContent, { preserveLineBreaks: true }),
      categories,
      imageCandidates
    });
  }

  return items;
};

export const normalizeNewsItem = (rawItem, provider, { nowMs = Date.now(), fallbackIndex = 0 } = {}) => {
  if (!rawItem || !provider) return null;

  const title = stripHtmlToText(rawItem.title || '');
  const link = validateProviderArticleUrl(rawItem.link, provider);
  if (!title || !link) return null;

  const desc = stripHtmlToText(rawItem.description || rawItem.desc || '');
  const body = stripHtmlToText(rawItem.content || rawItem.body || '', { preserveLineBreaks: true }) || desc;
  const { publishedAt, publishedTs } = parsePublishedDate(rawItem.pubDate || rawItem.publishedAt || '');
  const date = formatRelativeArabicDate(publishedTs, nowMs);

  const imageList = Array.isArray(rawItem.imageCandidates)
    ? rawItem.imageCandidates
    : [rawItem.img, rawItem.thumbnail].filter(Boolean);
  const img = imageList.map(url => validateProviderImageUrl(url, provider)).find(Boolean) || '';

  const categories = Array.isArray(rawItem.categories) ? rawItem.categories : [];
  const classification = classifySportsArticle({ title, desc, categories });

  const canonicalUrl = canonicalizeArticleUrl(link);
  const stableKey = rawItem.guid || canonicalUrl || String(fallbackIndex);
  const id = `${provider.id}:${stableKey}`;

  return {
    id,
    title,
    desc,
    body,
    link,
    img,
    source: {
      id: provider.id,
      name: provider.name,
      url: provider.publisherUrl || ''
    },
    tag: classification.category,
    isFootball: classification.isFootball,
    publishedAt,
    publishedTs,
    date,
    readTime: estimateReadTime(body || desc)
  };
};

export const parseProviderFeed = (xmlText, provider, { nowMs = Date.now() } = {}) => {
  const rawItems = parseFeedXml(xmlText);
  return rawItems
    .map((item, idx) => normalizeNewsItem(item, provider, { nowMs, fallbackIndex: idx }))
    .filter(Boolean);
};

export const sortNewsArticles = (articles = []) => {
  if (!Array.isArray(articles)) return [];
  return [...articles].sort((a, b) => {
    const aHasDate = Number.isFinite(a?.publishedTs) && a.publishedTs > 0;
    const bHasDate = Number.isFinite(b?.publishedTs) && b.publishedTs > 0;
    if (aHasDate && !bHasDate) return -1;
    if (!aHasDate && bHasDate) return 1;
    if (aHasDate && bHasDate && b.publishedTs !== a.publishedTs) {
      return b.publishedTs - a.publishedTs;
    }
    const aFootball = a?.isFootball === true ? 1 : 0;
    const bFootball = b?.isFootball === true ? 1 : 0;
    if (bFootball !== aFootball) return bFootball - aFootball;
    return String(a?.id || '').localeCompare(String(b?.id || ''));
  });
};

export const filterFootballFeedArticles = (articles = []) => {
  if (!Array.isArray(articles)) return [];
  return articles.filter(article => article && article.isFootball !== false);
};

const scoreArticleRichness = (article) => {
  let score = 0;
  if (article?.img) score += 4;
  if (Number.isFinite(article?.publishedTs) && article.publishedTs > 0) score += 3;
  if (article?.isFootball === true) score += 2;
  if (article?.body && article.body.length > (article?.desc?.length || 0)) score += 2;
  if (article?.desc) score += 1;
  return score;
};

const isSpecificNormalizedTitle = (normalizedTitle) => (
  normalizedTitle.length >= 16 && normalizedTitle.split(' ').length >= 3
);

export const deduplicateNewsArticles = (articles = []) => {
  if (!Array.isArray(articles)) return [];
  const kept = [];
  const indexByUrl = new Map();
  const indexByTitle = new Map();

  for (const article of articles) {
    if (!article || !article.title) continue;
    const canonicalUrl = canonicalizeArticleUrl(article.link);
    const normalizedTitle = normalizeTitleForComparison(article.title);
    const useTitleKey = isSpecificNormalizedTitle(normalizedTitle);

    let existingIdx = -1;
    if (canonicalUrl && indexByUrl.has(canonicalUrl)) {
      existingIdx = indexByUrl.get(canonicalUrl);
    } else if (useTitleKey && indexByTitle.has(normalizedTitle)) {
      existingIdx = indexByTitle.get(normalizedTitle);
    }

    if (existingIdx === -1) {
      const nextIdx = kept.length;
      kept.push(article);
      if (canonicalUrl) indexByUrl.set(canonicalUrl, nextIdx);
      if (useTitleKey) indexByTitle.set(normalizedTitle, nextIdx);
      continue;
    }

    if (scoreArticleRichness(article) > scoreArticleRichness(kept[existingIdx])) {
      kept[existingIdx] = article;
      if (canonicalUrl) indexByUrl.set(canonicalUrl, existingIdx);
      if (useTitleKey) indexByTitle.set(normalizedTitle, existingIdx);
    }
  }

  return kept;
};

export const createNewsFetcher = ({
  providers = NEWS_PROVIDERS,
  fetcher = (...args) => fetch(...args),
  now = () => Date.now(),
  defaultTtl = DEFAULT_NEWS_CACHE_TTL,
  providerTimeout = DEFAULT_NEWS_PROVIDER_TIMEOUT,
  maxCacheEntries = 20
} = {}) => {
  const xmlCache = createRequestCache({
    fetcher,
    now,
    maxEntries: maxCacheEntries,
    parseResponse: (response) => response.text()
  });

  let latestFetchVersion = 0;
  let latestCompletedVersion = 0;
  let latestSuccessfulArticles = null;

  const fetchProvider = async (provider, { ttl, forceRefresh, timeout, signal }) => {
    const xmlText = await xmlCache(provider.feedUrl, {
      ttl,
      forceRefresh,
      timeout,
      signal
    });
    return parseProviderFeed(xmlText, provider, { nowMs: now() });
  };

  const fetchNews = async ({
    strict = false,
    forceRefresh = false,
    ttl = defaultTtl,
    timeout = providerTimeout,
    signal
  } = {}) => {
    const activeProviders = getEnabledNewsProviders(providers);
    if (activeProviders.length === 0) return [];
    if (signal?.aborted) {
      const abortError = new Error('News request aborted');
      abortError.name = 'AbortError';
      if (strict) throw abortError;
      return [];
    }

    const version = ++latestFetchVersion;
    const settled = await Promise.allSettled(
      activeProviders.map(provider => fetchProvider(provider, { ttl, forceRefresh, timeout, signal }))
    );

    if (signal?.aborted) {
      const abortError = new Error('News request aborted');
      abortError.name = 'AbortError';
      if (strict) throw abortError;
      return [];
    }

    const fulfilled = settled.filter(result => result.status === 'fulfilled');
    if (fulfilled.length === 0) {
      const firstError = settled[0]?.reason || new Error('News feed unavailable');
      if (strict) throw firstError;
      return [];
    }

    const merged = fulfilled.flatMap(result => result.value || []);
    const filtered = filterFootballFeedArticles(merged);
    const deduped = deduplicateNewsArticles(filtered);
    const sorted = sortNewsArticles(deduped);

    if (version < latestCompletedVersion && latestSuccessfulArticles) {
      return structuredClone(latestSuccessfulArticles);
    }
    latestCompletedVersion = version;
    latestSuccessfulArticles = sorted;
    return structuredClone(sorted);
  };

  return { fetchNews };
};

export const defaultNewsFetcher = createNewsFetcher();

export const getArticleSourceName = (article) => {
  const name = article?.source?.name;
  return typeof name === 'string' && name.trim() ? name.trim() : '';
};

export const getExternalArticleLabel = (article) => {
  const sourceName = getArticleSourceName(article);
  return sourceName
    ? `قراءة التقرير من المصدر الرسمي (${sourceName})`
    : 'قراءة التقرير من المصدر الرسمي';
};

export const mergeNewsArticlesPreservingImages = (
  prevArticles = [],
  nextArticles = [],
  nowMs = Date.now()
) => {
  if (!Array.isArray(nextArticles)) return [];
  const prevImagesById = new Map();
  if (Array.isArray(prevArticles)) {
    for (const item of prevArticles) {
      if (item?.id && item?.img) prevImagesById.set(item.id, item.img);
    }
  }

  return nextArticles.map((item) => {
    if (!item) return item;
    const preservedImg = item.img || prevImagesById.get(item.id) || '';
    const updatedDate = Number.isFinite(item.publishedTs) && item.publishedTs > 0
      ? formatRelativeArabicDate(item.publishedTs, nowMs)
      : (item.date || 'تاريخ غير محدد');
    if (preservedImg === item.img && updatedDate === item.date) return item;
    return { ...item, img: preservedImg, date: updatedDate };
  });
};

export const reconcileActiveArticle = (
  activeArticle,
  nextArticles = [],
  nowMs = Date.now()
) => {
  if (!activeArticle) return null;
  const match = Array.isArray(nextArticles)
    ? nextArticles.find(item => item?.id === activeArticle.id)
    : null;

  const targetTs = match?.publishedTs || activeArticle.publishedTs || 0;
  const nextDate = Number.isFinite(targetTs) && targetTs > 0
    ? formatRelativeArabicDate(targetTs, nowMs)
    : (activeArticle.date || 'تاريخ غير محدد');
  const nextImg = activeArticle.img || match?.img || '';

  if (nextImg === activeArticle.img && nextDate === activeArticle.date) {
    return activeArticle;
  }
  return { ...activeArticle, img: nextImg, date: nextDate };
};

export const createNewsRefreshController = ({
  fetchNews,
  enrichImages,
  onStateChange,
  refreshIntervalMs = DEFAULT_NEWS_REFRESH_INTERVAL,
  now = () => Date.now(),
  getVisibilityState = () => (typeof document !== 'undefined' ? document.visibilityState : 'visible'),
  addVisibilityListener = (handler) => {
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', handler);
  },
  removeVisibilityListener = (handler) => {
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', handler);
  },
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (id) => clearTimeout(id)
} = {}) => {
  let state = {
    news: [],
    activeArticle: null,
    loading: true,
    error: null
  };
  let disposed = false;
  let inFlight = false;
  let timerId = null;
  let lastCompletedAt = 0;
  let activeAbortController = null;
  let imageAbortController = null;

  const emit = () => {
    if (!disposed) onStateChange?.({ ...state });
  };

  const clearScheduledRefresh = () => {
    if (timerId !== null) {
      clearTimer(timerId);
      timerId = null;
    }
  };

  const scheduleNextRefresh = (delayMs = refreshIntervalMs) => {
    clearScheduledRefresh();
    if (disposed || getVisibilityState() !== 'visible') return;
    timerId = setTimer(() => {
      timerId = null;
      refresh({ isBackground: true, forceRefresh: true });
    }, Math.max(0, delayMs));
  };

  const runImageEnrichment = (articles) => {
    if (disposed || typeof enrichImages !== 'function') return;
    const needsEnrichment = articles.filter(item => item && !item.img);
    if (needsEnrichment.length === 0) return;

    if (imageAbortController) imageAbortController.abort();
    const controller = new AbortController();
    imageAbortController = controller;

    Promise.resolve(enrichImages(needsEnrichment, {
      signal: controller.signal,
      onImageResolved: (articleId, imageUrl) => {
        if (disposed || controller.signal.aborted || !imageUrl) return;
        let changed = false;
        const nextNews = state.news.map((item) => {
          if (item.id === articleId && !item.img) {
            changed = true;
            return { ...item, img: imageUrl };
          }
          return item;
        });
        let nextActive = state.activeArticle;
        if (nextActive && nextActive.id === articleId && !nextActive.img) {
          changed = true;
          nextActive = { ...nextActive, img: imageUrl };
        }
        if (changed) {
          state = { ...state, news: nextNews, activeArticle: nextActive };
          emit();
        }
      }
    })).catch(() => {});
  };

  const refresh = async ({ isBackground = true, forceRefresh = true } = {}) => {
    if (disposed || inFlight) return false;
    if (isBackground && getVisibilityState() !== 'visible') return false;

    inFlight = true;
    clearScheduledRefresh();

    if (!isBackground) {
      state = { ...state, loading: true, error: null };
      emit();
    }

    const controller = new AbortController();
    activeAbortController = controller;

    try {
      const fetched = await fetchNews({
        strict: true,
        forceRefresh,
        signal: controller.signal
      });
      if (disposed || controller.signal.aborted) return false;

      const currentNow = now();
      const merged = mergeNewsArticlesPreservingImages(state.news, fetched, currentNow);
      const nextActive = reconcileActiveArticle(state.activeArticle, merged, currentNow);

      state = {
        ...state,
        news: merged,
        activeArticle: nextActive,
        loading: false,
        error: null
      };
      emit();
      runImageEnrichment(merged);
      return true;
    } catch {
      if (disposed || controller.signal.aborted) return false;
      if (!isBackground) {
        state = {
          ...state,
          loading: false,
          error: 'تعذر الوصول إلى الأخبار. تحقق من اتصالك وأعد المحاولة.'
        };
        emit();
      }
      return false;
    } finally {
      if (activeAbortController === controller) activeAbortController = null;
      inFlight = false;
      lastCompletedAt = now();
      if (!disposed && getVisibilityState() === 'visible') {
        scheduleNextRefresh(refreshIntervalMs);
      }
    }
  };

  const handleVisibilityChange = () => {
    if (disposed) return;
    if (getVisibilityState() !== 'visible') {
      clearScheduledRefresh();
      return;
    }
    if (inFlight) return;
    const elapsed = now() - lastCompletedAt;
    if (lastCompletedAt > 0 && elapsed >= refreshIntervalMs) {
      refresh({ isBackground: true, forceRefresh: true });
    } else {
      const remaining = lastCompletedAt > 0 ? Math.max(0, refreshIntervalMs - elapsed) : refreshIntervalMs;
      scheduleNextRefresh(remaining);
    }
  };

  const start = ({ forceRefresh = false } = {}) => {
    if (disposed) return Promise.resolve(false);
    addVisibilityListener(handleVisibilityChange);
    return refresh({ isBackground: false, forceRefresh });
  };

  const setActiveArticle = (article) => {
    if (disposed) return;
    state = { ...state, activeArticle: article };
    emit();
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    clearScheduledRefresh();
    removeVisibilityListener(handleVisibilityChange);
    if (activeAbortController) {
      activeAbortController.abort();
      activeAbortController = null;
    }
    if (imageAbortController) {
      imageAbortController.abort();
      imageAbortController = null;
    }
  };

  return {
    start,
    refresh,
    setActiveArticle,
    handleVisibilityChange,
    dispose,
    getState: () => ({ ...state })
  };
};
