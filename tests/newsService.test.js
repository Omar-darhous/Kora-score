import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NEWS_PROVIDERS,
  createNewsProvider,
  getEnabledNewsProviders,
  parseProviderFeed,
  parsePublishedDate,
  formatRelativeArabicDate,
  canonicalizeArticleUrl,
  validateProviderArticleUrl,
  validateProviderImageUrl,
  classifySportsArticle,
  sortNewsArticles,
  deduplicateNewsArticles,
  createNewsFetcher,
  getArticleSourceName,
  getExternalArticleLabel,
  createNewsRefreshController
} from '../src/services/newsService.js';
import { enrichNewsImages, createArticleImageResolver } from '../src/services/footballService.js';

const NOW_MS = Date.parse('2026-11-19T14:00:00.000Z');

test('parses CNN Arabic RSS feed with CDATA, full body, high-res media image, and attribution', () => {
  const cnnXml = `<?xml version="1.0" encoding="UTF-8"?>
  <rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:media="http://search.yahoo.com/mrss/">
    <channel>
      <item>
        <guid isPermaLink="false">node-story-205555</guid>
        <link>https://arabic.cnn.com/sport/article/2026/11/19/gianni-infantino-fifa</link>
        <title><![CDATA[3 منافسين لجياني إنفانتينو على رئاسة "فيفا".. من هم؟]]></title>
        <pubDate>Wed, 18 Nov 2026 21:35:20 +0000</pubDate>
        <description><![CDATA[ستجرى انتخابات رئاسة الاتحاد الدولي لكرة القدم (فيفا) في 18 مارس 2027.]]></description>
        <category>رياضة</category>
        <category>الفيفا</category>
        <content:encoded><![CDATA[<p><strong>(CNN)--</strong> ستجرى انتخابات رئاسة الاتحاد الدولي لكرة القدم.</p><p>وينافس إنفانتينو ثلاثة مرشحين.</p>]]></content:encoded>
        <media:thumbnail url="https://cnn-arabic-images.cnn.io/thumb.jpg" width="320" />
        <media:content medium="image" type="image/jpeg" height="1080" width="1920" url="https://cnn-arabic-images.cnn.io/cloudinary/image/upload/cnnarabic/2026/11/19/images/350260.jpg" />
      </item>
    </channel>
  </rss>`;

  const items = parseProviderFeed(cnnXml, NEWS_PROVIDERS['cnn-ar'], { nowMs: NOW_MS });
  assert.equal(items.length, 1);

  const [article] = items;
  assert.equal(article.id, 'cnn-ar:node-story-205555');
  assert.equal(article.title, '3 منافسين لجياني إنفانتينو على رئاسة "فيفا".. من هم؟');
  assert.equal(article.desc, 'ستجرى انتخابات رئاسة الاتحاد الدولي لكرة القدم (فيفا) في 18 مارس 2027.');
  assert.equal(article.body.includes('\n'), true);
  assert.equal(article.link, 'https://arabic.cnn.com/sport/article/2026/11/19/gianni-infantino-fifa');
  assert.equal(article.img, 'https://cnn-arabic-images.cnn.io/cloudinary/image/upload/cnnarabic/2026/11/19/images/350260.jpg');
  assert.deepEqual(article.source, {
    id: 'cnn-ar',
    name: 'CNN بالعربية',
    url: 'https://arabic.cnn.com/sport'
  });
  assert.equal(article.tag, 'كرة القدم');
  assert.equal(article.isFootball, true);
  assert.equal(article.publishedAt, '2026-11-18T21:35:20.000Z');
  assert.equal(article.publishedTs, Date.parse('2026-11-18T21:35:20.000Z'));
  assert.equal(article.date, 'منذ 16 ساعة');
  assert.equal(typeof article.readTime, 'string');
});

test('parses DW Arabic RDF and RSS items accurately while leaving missing image empty for DW resolver', () => {
  const dwRdfXml = `<?xml version="1.0" encoding="UTF-8"?>
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:dc="http://purl.org/dc/elements/1.1/">
    <item rdf:about="https://www.dw.com/ar/salah-mania/a-79899877?maca=ara-rss-ar-sports-3232-xml-mrss">
      <title>&quot;صلاح مانيا&quot;.. تركيا تصاب بهوس محمد صلاح!</title>
      <link>https://www.dw.com/ar/salah-mania/a-79899877?maca=ara-rss-ar-sports-3232-xml-mrss</link>
      <dc:description>تفاعل جماهيري كبير حول النجم المصري محمد صلاح.</dc:description>
      <dc:date>2026-11-07T16:08:00Z</dc:date>
      <dc:subject>رياضة</dc:subject>
    </item>
  </rdf:RDF>`;

  const items = parseProviderFeed(dwRdfXml, NEWS_PROVIDERS['dw-ar'], { nowMs: NOW_MS });
  assert.equal(items.length, 1);

  const [article] = items;
  assert.equal(article.title, '"صلاح مانيا".. تركيا تصاب بهوس محمد صلاح!');
  assert.equal(article.img, '');
  assert.equal(article.source.id, 'dw-ar');
  assert.equal(article.source.name, 'DW العربية');
  assert.equal(article.tag, 'كرة القدم');
  assert.equal(article.publishedAt, '2026-11-07T16:08:00.000Z');
  assert.equal(
    canonicalizeArticleUrl(article.link),
    'https://www.dw.com/ar/salah-mania/a-79899877'
  );
});

test('parses publication dates accurately across timezones and handles invalid or missing dates without fabricating now', () => {
  const rfcUtc = parsePublishedDate('Wed, 18 Nov 2026 21:35:20 +0000');
  assert.equal(rfcUtc.publishedAt, '2026-11-18T21:35:20.000Z');

  const rfcOffset = parsePublishedDate('Thu, 19 Nov 2026 15:00:00 +0200');
  assert.equal(rfcOffset.publishedAt, '2026-11-19T13:00:00.000Z');

  const sqlUtc = parsePublishedDate('2026-11-11 06:57:00');
  assert.equal(sqlUtc.publishedAt, '2026-11-11T06:57:00.000Z');

  for (const invalid of ['', '   ', null, undefined, 'not-a-date', 'الخميس، 19 نوفمبر 2026 03:30 م', '1970-01-01T00:00:00Z']) {
    const parsed = parsePublishedDate(invalid);
    assert.equal(parsed.publishedAt, null);
    assert.equal(parsed.publishedTs, 0);
  }

  assert.equal(formatRelativeArabicDate(0, NOW_MS), 'تاريخ غير محدد');
  assert.equal(formatRelativeArabicDate(NOW_MS + 60000, NOW_MS), 'منذ أقل من ساعة');
  assert.equal(formatRelativeArabicDate(NOW_MS - 2 * 3600 * 1000, NOW_MS), 'منذ ساعتين');
});

test('sorts articles newest-first and places articles with unknown dates last', () => {
  const sorted = sortNewsArticles([
    { id: 'unknown-1', publishedTs: 0 },
    { id: 'older', publishedTs: Date.parse('2026-11-10T10:00:00Z') },
    { id: 'newest', publishedTs: Date.parse('2026-11-19T12:00:00Z') },
    { id: 'middle', publishedTs: Date.parse('2026-11-18T12:00:00Z') },
    { id: 'unknown-2', publishedTs: 0 }
  ]);

  assert.deepEqual(
    sorted.map(item => item.id),
    ['newest', 'middle', 'older', 'unknown-1', 'unknown-2']
  );
});

test('deduplicates by canonical URL and normalized title without deleting distinct stories', () => {
  const articles = [
    {
      id: 'dw-ar:1',
      title: 'إنجاز تاريخي للمغرب في تصنيف الاتحاد الدولي لكرة القدم',
      link: 'https://www.dw.com/ar/morocco/a-1?maca=rss-1',
      img: '',
      desc: 'ملخص قصير',
      body: 'ملخص قصير',
      publishedTs: Date.parse('2026-11-18T15:00:00Z')
    },
    {
      id: 'dw-ar:1-dup',
      title: 'انجاز تاريخى للمغرب في تصنيف الاتحاد الدولي لكره القدم!',
      link: 'https://www.dw.com/ar/morocco/a-1?utm_source=feed',
      img: 'https://static.dw.com/image/1_6.jpg',
      desc: 'ملخص قصير',
      body: 'ملخص قصير\nتفاصيل إضافية كاملة',
      publishedTs: Date.parse('2026-11-18T15:00:00Z')
    },
    {
      id: 'cnn-ar:short-1',
      title: 'أخبار الرياضة',
      link: 'https://arabic.cnn.com/sport/article/2026/11/19/story-a',
      img: 'https://cnn-arabic-images.cnn.io/a.jpg',
      desc: 'قصة أولى مستقلة',
      body: 'قصة أولى مستقلة',
      publishedTs: Date.parse('2026-11-19T10:00:00Z')
    },
    {
      id: 'dw-ar:short-2',
      title: 'أخبار الرياضة',
      link: 'https://www.dw.com/ar/story-b/a-2',
      img: '',
      desc: 'قصة ثانية مستقلة تماماً',
      body: 'قصة ثانية مستقلة تماماً',
      publishedTs: Date.parse('2026-11-19T09:00:00Z')
    }
  ];

  const deduped = deduplicateNewsArticles(articles);
  assert.equal(deduped.length, 3);
  assert.equal(deduped[0].id, 'dw-ar:1-dup');
  assert.equal(deduped[1].id, 'cnn-ar:short-1');
  assert.equal(deduped[2].id, 'dw-ar:short-2');
});

test('validates HTTPS article and image URLs strictly against approved providers', () => {
  const cnn = NEWS_PROVIDERS['cnn-ar'];
  const dw = NEWS_PROVIDERS['dw-ar'];

  assert.equal(
    validateProviderArticleUrl('https://arabic.cnn.com/sport/article/2026/11/19/test', cnn),
    'https://arabic.cnn.com/sport/article/2026/11/19/test'
  );
  assert.equal(validateProviderArticleUrl('http://arabic.cnn.com/sport/article/test', cnn), '');
  assert.equal(validateProviderArticleUrl('https://arabic.cnn.com.evil.test/sport', cnn), '');
  assert.equal(validateProviderArticleUrl('javascript:alert(1)', cnn), '');

  assert.equal(
    validateProviderImageUrl('https://cnn-arabic-images.cnn.io/photo.jpg', cnn),
    'https://cnn-arabic-images.cnn.io/photo.jpg'
  );
  assert.equal(validateProviderImageUrl('https://static.dw.com/image/1_6.jpg', cnn), '');
  assert.equal(validateProviderImageUrl('https://static.dw.com/image/1_6.jpg', dw), 'https://static.dw.com/image/1_6.jpg');
  assert.equal(validateProviderImageUrl('https://evil-dw.com/image/1_6.jpg', dw), '');
  assert.equal(validateProviderImageUrl('data:image/png;base64,AAAA', dw), '');
});

test('classifies football conservatively and keeps non-football or uncertain sports distinct', () => {
  const football = classifySportsArticle({
    title: 'تقدم السعودية وتراجع مصر في تصنيف فيفا الشهري',
    desc: 'أعلن الاتحاد الدولي لكرة القدم التصنيف الجديد للمنتخبات.'
  });
  assert.equal(football.isFootball, true);
  assert.equal(football.category, 'كرة القدم');

  const boxing = classifySportsArticle({
    title: 'وفاة ملاكم بعد تعرضه لضربة قاضية مروعة في الحلبة',
    desc: 'أعلن منظمو نزال الوزن الثقيل وفاة الملاكم.'
  });
  assert.equal(boxing.isFootball, false);
  assert.equal(boxing.category, 'ملاكمة');

  const tennis = classifySportsArticle({
    title: 'ألكاراز يتوج بلقب بطولة ويمبلدون للتنس',
    desc: 'فاز اللاعب الإسباني بمجموعتين نظيفتين.'
  });
  assert.equal(tennis.isFootball, false);
  assert.equal(tennis.category, 'تنس');

  const uncertain = classifySportsArticle({
    title: 'وزير الرياضة يهنئ البعثة المصرية على الإنجاز الدولي الجديد',
    desc: 'أشاد الوزير بأداء اللاعبين في البطولة العالمية.'
  });
  assert.equal(uncertain.isFootball, null);
  assert.equal(uncertain.category, 'رياضة عامة');
});

test('exposes configurable provider registry with CNN and DW active and France 24 not activated yet', () => {
  const active = getEnabledNewsProviders();
  assert.deepEqual(active.map(p => p.id), ['cnn-ar', 'dw-ar']);

  const custom = createNewsProvider({
    id: 'france24-ar',
    name: 'فرانس 24',
    feedUrl: 'https://www.france24.com/ar/sport/rss',
    enabled: false,
    allowedArticleHosts: ['www.france24.com'],
    allowedImageHosts: ['s.france24.com']
  });
  assert.equal(custom.enabled, false);
  assert.deepEqual(getEnabledNewsProviders([...active, custom]).map(p => p.id), ['cnn-ar', 'dw-ar']);
});

const CNN_FEED_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <item>
      <guid>cnn-1</guid>
      <link>https://arabic.cnn.com/sport/article/2026/11/19/fifa-ranking</link>
      <title><![CDATA[تقدم السعودية وتراجع مصر في تصنيف فيفا]]></title>
      <pubDate>Thu, 19 Nov 2026 12:00:00 +0000</pubDate>
      <description><![CDATA[أعلن الاتحاد الدولي لكرة القدم التصنيف الشهري.]]></description>
      <media:content medium="image" type="image/jpeg" width="1920" url="https://cnn-arabic-images.cnn.io/fifa.jpg" />
    </item>
    <item>
      <guid>cnn-boxing</guid>
      <link>https://arabic.cnn.com/sport/article/2026/11/19/boxing-bout</link>
      <title><![CDATA[فوز ساحق بالضربة القاضية في نزال الملاكمة العالمي]]></title>
      <pubDate>Thu, 19 Nov 2026 13:00:00 +0000</pubDate>
      <description><![CDATA[حسم الملاكم النزال في الجولة الثالثة.]]></description>
      <media:content medium="image" type="image/jpeg" width="1920" url="https://cnn-arabic-images.cnn.io/box.jpg" />
    </item>
    <item>
      <guid>cnn-uncertain</guid>
      <link>https://arabic.cnn.com/sport/article/2026/11/18/general-sport</link>
      <title><![CDATA[وزير الرياضة يكرم البعثة الدولية]]></title>
      <pubDate>Wed, 18 Nov 2026 10:00:00 +0000</pubDate>
      <description><![CDATA[تكريم رسمي للإنجاز الرياضي الأخير.]]></description>
      <media:content medium="image" type="image/jpeg" width="1920" url="https://cnn-arabic-images.cnn.io/gen.jpg" />
    </item>
  </channel>
</rss>`;

const DW_FEED_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <guid>dw-1</guid>
      <link>https://www.dw.com/ar/salah-liverpool/a-1001?maca=ara-rss</link>
      <title>محمد صلاح يقود ليفربول لفوز مثير في الدوري الإنجليزي</title>
      <pubDate>Thu, 19 Nov 2026 10:00:00 GMT</pubDate>
      <description>سجل محمد صلاح هدفين في قمة البريميرليغ.</description>
    </item>
    <item>
      <guid>dw-nodate</guid>
      <link>https://www.dw.com/ar/undated-football/a-1002</link>
      <title>تحليل خاص حول تكتيكات دوري أبطال أوروبا</title>
      <description>نظرة معمقة على الفرق المتأهلة.</description>
    </item>
  </channel>
</rss>`;

const EMPTY_FEED_XML = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel></channel></rss>`;

const xmlResponse = (xml, ok = true, status = 200) => ({
  ok,
  status,
  text: async () => xml
});

test('createNewsFetcher merges CNN and DW, excludes unrelated sports, sorts newest-first, and limits DW enrichment to DW only', async () => {
  const newsFetcher = createNewsFetcher({
    now: () => NOW_MS,
    fetcher: async (url) => {
      if (url === NEWS_PROVIDERS['cnn-ar'].feedUrl) return xmlResponse(CNN_FEED_XML);
      if (url === NEWS_PROVIDERS['dw-ar'].feedUrl) return xmlResponse(DW_FEED_XML);
      throw new Error('Unexpected URL: ' + url);
    }
  });

  const articles = await newsFetcher.fetchNews({ strict: true });

  // Boxing article excluded; uncertain general sport kept with conservative tag; undated DW placed last.
  assert.deepEqual(
    articles.map(a => a.id),
    ['cnn-ar:cnn-1', 'dw-ar:dw-1', 'cnn-ar:cnn-uncertain', 'dw-ar:dw-nodate']
  );
  assert.equal(articles[0].img, 'https://cnn-arabic-images.cnn.io/fifa.jpg');
  assert.equal(articles[0].source.name, 'CNN بالعربية');
  assert.equal(articles[1].img, '');
  assert.equal(articles[1].source.name, 'DW العربية');
  assert.equal(articles[2].tag, 'رياضة عامة');
  assert.equal(articles[2].isFootball, null);
  assert.equal(articles[3].publishedAt, null);
  assert.equal(articles[3].date, 'تاريخ غير محدد');

  // Verify enrichNewsImages only fetches DW articles missing images, never CNN.
  const fetchedForImages = [];
  const resolver = createArticleImageResolver({
    fetcher: async (url) => {
      fetchedForImages.push(url);
      return {
        ok: true,
        text: async () => '<meta property="og:image" content="https://static.dw.com/image/777_6.jpg" />'
      };
    }
  });
  const enriched = await enrichNewsImages(articles, { resolver });
  assert.equal(fetchedForImages.length, 2);
  assert.equal(fetchedForImages.every(url => url.startsWith('https://www.dw.com/')), true);
  assert.equal(enriched[1].img, 'https://static.dw.com/image/777_6.jpg');
});

test('createNewsFetcher handles partial provider failures, total failure, and genuine empty feeds', async () => {
  // CNN fails, DW succeeds
  const cnnFails = createNewsFetcher({
    now: () => NOW_MS,
    fetcher: async (url) => {
      if (url === NEWS_PROVIDERS['cnn-ar'].feedUrl) return xmlResponse('', false, 503);
      return xmlResponse(DW_FEED_XML);
    }
  });
  const dwOnly = await cnnFails.fetchNews({ strict: true });
  assert.equal(dwOnly.length, 2);
  assert.equal(dwOnly.every(a => a.source.id === 'dw-ar'), true);

  // DW fails, CNN succeeds
  const dwFails = createNewsFetcher({
    now: () => NOW_MS,
    fetcher: async (url) => {
      if (url === NEWS_PROVIDERS['dw-ar'].feedUrl) throw new Error('DW network error');
      return xmlResponse(CNN_FEED_XML);
    }
  });
  const cnnOnly = await dwFails.fetchNews({ strict: true });
  assert.equal(cnnOnly.length, 2);
  assert.equal(cnnOnly.every(a => a.source.id === 'cnn-ar'), true);

  // Both fail
  const bothFail = createNewsFetcher({
    now: () => NOW_MS,
    fetcher: async () => xmlResponse('', false, 500)
  });
  await assert.rejects(() => bothFail.fetchNews({ strict: true }));
  assert.deepEqual(await bothFail.fetchNews({ strict: false }), []);

  // Genuine empty feeds
  const emptyFeeds = createNewsFetcher({
    now: () => NOW_MS,
    fetcher: async () => xmlResponse(EMPTY_FEED_XML)
  });
  assert.deepEqual(await emptyFeeds.fetchNews({ strict: true }), []);
});

test('createNewsFetcher reuses cache within TTL, supports forceRefresh, and prevents stale overwrite', async () => {
  let clock = NOW_MS;
  let calls = 0;
  let firstDeferredResolve;
  const firstDeferred = new Promise(resolve => { firstDeferredResolve = resolve; });

  const newsFetcher = createNewsFetcher({
    now: () => clock,
    defaultTtl: 180000,
    fetcher: async (url) => {
      calls += 1;
      if (url === NEWS_PROVIDERS['cnn-ar'].feedUrl) {
        if (calls <= 2) return xmlResponse(CNN_FEED_XML);
        if (calls === 3) return firstDeferred;
        return xmlResponse(`<?xml version="1.0"?><rss><channel><item>
          <guid>cnn-fresh</guid>
          <link>https://arabic.cnn.com/sport/article/2026/11/19/fresh</link>
          <title>خبر عاجل عن دوري أبطال أوروبا</title>
          <pubDate>Thu, 19 Nov 2026 13:55:00 +0000</pubDate>
        </item></channel></rss>`);
      }
      return xmlResponse(EMPTY_FEED_XML);
    }
  });

  // 1. Initial fetch -> 2 provider calls
  const initial = await newsFetcher.fetchNews({ strict: true });
  assert.equal(calls, 2);
  assert.equal(initial[0].id, 'cnn-ar:cnn-1');

  // 2. Within 3-minute TTL -> served from cache (no extra network calls)
  clock += 60000;
  const cached = await newsFetcher.fetchNews({ strict: true });
  assert.equal(calls, 2);
  assert.equal(cached[0].id, 'cnn-ar:cnn-1');

  // 3. Stale slow forceRefresh vs newer fast forceRefresh
  const slowForce = newsFetcher.fetchNews({ strict: true, forceRefresh: true });
  const fastForce = newsFetcher.fetchNews({ strict: true, forceRefresh: true });

  const newerResult = await fastForce;
  assert.equal(newerResult[0].id, 'cnn-ar:cnn-fresh');

  firstDeferredResolve(xmlResponse(CNN_FEED_XML));
  const olderResolved = await slowForce;
  // Stale response must not overwrite newer result
  assert.equal(olderResolved[0].id, 'cnn-ar:cnn-fresh');
});

test('createNewsFetcher handles independent provider timeout and caller AbortController cancellation', async () => {
  // CNN times out independently while DW succeeds
  const timeoutFetcher = createNewsFetcher({
    now: () => NOW_MS,
    providerTimeout: 30,
    fetcher: (url, { signal }) => {
      if (url === NEWS_PROVIDERS['cnn-ar'].feedUrl) {
        return new Promise((_res, rej) => {
          signal.addEventListener('abort', () => {
            const err = new Error('Timed out');
            err.name = 'AbortError';
            rej(err);
          }, { once: true });
        });
      }
      return Promise.resolve(xmlResponse(DW_FEED_XML));
    }
  });

  const partial = await timeoutFetcher.fetchNews({ strict: true });
  assert.equal(partial.length, 2);
  assert.equal(partial.every(a => a.source.id === 'dw-ar'), true);

  // External AbortController cancels both providers cleanly
  const abortController = new AbortController();
  let abortedSignals = 0;
  const cancelFetcher = createNewsFetcher({
    now: () => NOW_MS,
    providerTimeout: 5000,
    fetcher: (_url, { signal }) => new Promise((_res, rej) => {
      signal.addEventListener('abort', () => {
        abortedSignals += 1;
        const err = new Error('Aborted');
        err.name = 'AbortError';
        rej(err);
      }, { once: true });
    })
  });

  const pending = cancelFetcher.fetchNews({ strict: true, signal: abortController.signal });
  abortController.abort();
  await assert.rejects(() => pending, (err) => err?.name === 'AbortError');
  assert.equal(abortedSignals, 2);
});

test('dynamic publisher attribution formats CNN, DW, and fallback labels accurately', () => {
  const cnnArticle = { source: { id: 'cnn-ar', name: 'CNN بالعربية' } };
  const dwArticle = { source: { id: 'dw-ar', name: 'DW العربية' } };
  const unknownArticle = {};

  assert.equal(getArticleSourceName(cnnArticle), 'CNN بالعربية');
  assert.equal(getExternalArticleLabel(cnnArticle), 'قراءة التقرير من المصدر الرسمي (CNN بالعربية)');

  assert.equal(getArticleSourceName(dwArticle), 'DW العربية');
  assert.equal(getExternalArticleLabel(dwArticle), 'قراءة التقرير من المصدر الرسمي (DW العربية)');

  assert.equal(getArticleSourceName(unknownArticle), '');
  assert.equal(getExternalArticleLabel(unknownArticle), 'قراءة التقرير من المصدر الرسمي');
});

test('createNewsRefreshController performs background refresh without spinner, preserves images and open article, and updates relative dates', async () => {
  let clock = NOW_MS;
  let scheduledCallback = null;
  let clearCount = 0;
  const fetchCalls = [];
  const enrichBatches = [];
  const loadingHistory = [];

  const initialCnn = {
    id: 'cnn-ar:1',
    title: 'خبر CNN',
    link: 'https://arabic.cnn.com/sport/article/2026/11/19/1',
    img: 'https://cnn-arabic-images.cnn.io/1.jpg',
    source: { id: 'cnn-ar', name: 'CNN بالعربية' },
    publishedTs: NOW_MS - 60 * 60 * 1000,
    date: 'منذ ساعة واحدة'
  };
  const initialDw = {
    id: 'dw-ar:1',
    title: 'خبر DW',
    link: 'https://www.dw.com/ar/story/a-1',
    img: '',
    source: { id: 'dw-ar', name: 'DW العربية' },
    publishedTs: NOW_MS - 2 * 60 * 60 * 1000,
    date: 'منذ ساعتين'
  };

  let round = 0;
  const controller = createNewsRefreshController({
    now: () => clock,
    refreshIntervalMs: 300000,
    getVisibilityState: () => 'visible',
    addVisibilityListener: () => {},
    removeVisibilityListener: () => {},
    setTimer: (fn) => {
      scheduledCallback = fn;
      return 1;
    },
    clearTimer: () => {
      clearCount += 1;
      scheduledCallback = null;
    },
    fetchNews: async (opts) => {
      fetchCalls.push(opts);
      round += 1;
      if (round === 1) return [initialCnn, initialDw];
      // Background refresh returns DW without img again, plus a brand new CNN story, while initialCnn aged out
      return [
        {
          id: 'cnn-ar:2',
          title: 'خبر عاجل جديد',
          link: 'https://arabic.cnn.com/sport/article/2026/11/19/2',
          img: 'https://cnn-arabic-images.cnn.io/2.jpg',
          source: { id: 'cnn-ar', name: 'CNN بالعربية' },
          publishedTs: clock - 10 * 60 * 1000,
          date: 'منذ أقل من ساعة'
        },
        { ...initialDw, img: '' }
      ];
    },
    enrichImages: async (items, { onImageResolved }) => {
      enrichBatches.push(items.map(i => i.id));
      for (const item of items) {
        if (item.id === 'dw-ar:1') {
          onImageResolved('dw-ar:1', 'https://static.dw.com/image/dw1_6.jpg');
        }
      }
    },
    onStateChange: (s) => {
      loadingHistory.push(s.loading);
    }
  });

  await controller.start({ forceRefresh: false });
  assert.equal(fetchCalls[0].forceRefresh, false);
  assert.deepEqual(enrichBatches, [['dw-ar:1']]);
  assert.equal(controller.getState().news[1].img, 'https://static.dw.com/image/dw1_6.jpg');

  // Open initialCnn in modal before background refresh
  controller.setActiveArticle(controller.getState().news[0]);
  loadingHistory.length = 0;

  // Advance 1 hour and trigger scheduled background refresh
  clock += 60 * 60 * 1000;
  assert.equal(typeof scheduledCallback, 'function');
  await scheduledCallback();

  // Background refresh used forceRefresh: true and NEVER turned loading spinner on
  assert.equal(fetchCalls[1].forceRefresh, true);
  assert.equal(loadingHistory.includes(true), false);

  // DW image preserved across background refresh (no second enrichment call!)
  const nextState = controller.getState();
  assert.equal(enrichBatches.length, 1);
  assert.equal(nextState.news.find(n => n.id === 'dw-ar:1').img, 'https://static.dw.com/image/dw1_6.jpg');
  assert.equal(nextState.news.find(n => n.id === 'dw-ar:1').date, 'منذ 3 ساعات');

  // Open article preserved even though it aged out of the feed, with updated relative date
  assert.equal(nextState.activeArticle.id, 'cnn-ar:1');
  assert.equal(nextState.activeArticle.date, 'منذ ساعتين');

  controller.dispose();
  assert.equal(clearCount > 0, true);
});

test('createNewsRefreshController handles one provider failing, all providers failing, hidden tab, overlapping prevention, and unmount cleanup', async () => {
  let clock = NOW_MS;
  let visibility = 'visible';
  let visibilityListener = null;
  let listenerRemoved = false;
  let activeTimer = null;

  // 1. Partial failure vs total failure during background refresh
  let mode = 'both-ok';
  const newsFetcher = createNewsFetcher({
    now: () => clock,
    fetcher: async (url) => {
      if (mode === 'all-fail') return xmlResponse('', false, 500);
      if (mode === 'cnn-fail' && url === NEWS_PROVIDERS['cnn-ar'].feedUrl) {
        return xmlResponse('', false, 503);
      }
      if (url === NEWS_PROVIDERS['cnn-ar'].feedUrl) return xmlResponse(CNN_FEED_XML);
      return xmlResponse(DW_FEED_XML);
    }
  });

  const controller = createNewsRefreshController({
    now: () => clock,
    refreshIntervalMs: 300000,
    fetchNews: (opts) => newsFetcher.fetchNews(opts),
    getVisibilityState: () => visibility,
    addVisibilityListener: (fn) => { visibilityListener = fn; },
    removeVisibilityListener: (fn) => { if (fn === visibilityListener) listenerRemoved = true; },
    setTimer: (fn) => { activeTimer = fn; return 42; },
    clearTimer: () => { activeTimer = null; }
  });

  await controller.start();
  assert.equal(controller.getState().news.length, 4);

  // One provider fails during background refresh -> keeps successful DW results
  mode = 'cnn-fail';
  await controller.refresh({ isBackground: true, forceRefresh: true });
  assert.equal(controller.getState().news.length, 2);
  assert.equal(controller.getState().error, null);

  // All providers fail during background refresh -> preserves existing news and no full-page error
  mode = 'all-fail';
  await controller.refresh({ isBackground: true, forceRefresh: true });
  assert.equal(controller.getState().news.length, 2);
  assert.equal(controller.getState().error, null);

  // Hidden tab pauses timer and blocks background refresh
  visibility = 'hidden';
  visibilityListener();
  assert.equal(activeTimer, null);
  const ranWhileHidden = await controller.refresh({ isBackground: true, forceRefresh: true });
  assert.equal(ranWhileHidden, false);

  // Returning to visible after interval elapsed resumes refresh safely
  mode = 'both-ok';
  clock += 300000;
  visibility = 'visible';
  visibilityListener();
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(controller.getState().news.length, 4);

  // Dispose removes listener and clears timers
  controller.dispose();
  assert.equal(listenerRemoved, true);
  assert.equal(activeTimer, null);
});

test('createNewsRefreshController prevents overlapping refreshes and aborts in-flight request on dispose', async () => {
  let fetchCount = 0;
  let aborted = false;

  const controller = createNewsRefreshController({
    getVisibilityState: () => 'visible',
    addVisibilityListener: () => {},
    removeVisibilityListener: () => {},
    setTimer: () => 1,
    clearTimer: () => {},
    fetchNews: ({ signal }) => {
      fetchCount += 1;
      return new Promise((_res, rej) => {
        signal.addEventListener('abort', () => {
          aborted = true;
          const err = new Error('Aborted');
          err.name = 'AbortError';
          rej(err);
        }, { once: true });
      });
    }
  });

  const first = controller.start();
  const overlapping = await controller.refresh({ isBackground: true, forceRefresh: true });
  assert.equal(overlapping, false);
  assert.equal(fetchCount, 1);

  controller.dispose();
  await first;
  assert.equal(aborted, true);
});

test('React StrictMode remount cleanup does not leave active news controller stuck in loading state', async () => {
  let networkCalls = 0;
  const newsFetcher = createNewsFetcher({
    now: () => NOW_MS,
    fetcher: (url, { signal }) => {
      networkCalls += 1;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          if (url === NEWS_PROVIDERS['cnn-ar'].feedUrl) resolve(xmlResponse(CNN_FEED_XML));
          else resolve(xmlResponse(DW_FEED_XML));
        }, 15);
        signal.addEventListener('abort', () => {
          clearTimeout(timer);
          const err = new Error('signal is aborted');
          err.name = 'AbortError';
          reject(err);
        }, { once: true });
      });
    }
  });

  const mount1States = [];
  const mount2States = [];

  const controller1 = createNewsRefreshController({
    fetchNews: (opts) => newsFetcher.fetchNews(opts),
    getVisibilityState: () => 'visible',
    addVisibilityListener: () => {},
    removeVisibilityListener: () => {},
    setTimer: () => 1,
    clearTimer: () => {},
    onStateChange: (s) => mount1States.push(s)
  });

  const controller2 = createNewsRefreshController({
    fetchNews: (opts) => newsFetcher.fetchNews(opts),
    getVisibilityState: () => 'visible',
    addVisibilityListener: () => {},
    removeVisibilityListener: () => {},
    setTimer: () => 2,
    clearTimer: () => {},
    onStateChange: (s) => mount2States.push(s)
  });

  // Simulate React StrictMode: mount 1 starts, immediately unmounts, mount 2 starts synchronously.
  const p1 = controller1.start();
  controller1.dispose();
  const p2 = controller2.start();

  await Promise.all([p1, p2]);

  assert.equal(controller2.getState().loading, false);
  assert.equal(controller2.getState().error, null);
  assert.equal(controller2.getState().news.length, 4);
  assert.equal(mount2States.at(-1).loading, false);
  assert.equal(mount1States.every(s => s.news.length === 0), true);
  assert.equal(networkCalls, 4);

  controller2.dispose();
});

test('aborting one consumer of a shared pending request does not abort other active consumers', async () => {
  let fetchCount = 0;
  let underlyingAborted = false;
  let resolveFetch;

  const newsFetcher = createNewsFetcher({
    now: () => NOW_MS,
    fetcher: (url, { signal }) => {
      fetchCount += 1;
      signal.addEventListener('abort', () => { underlyingAborted = true; }, { once: true });
      if (url === NEWS_PROVIDERS['dw-ar'].feedUrl) {
        return Promise.resolve(xmlResponse(DW_FEED_XML));
      }
      return new Promise((resolve) => {
        resolveFetch = () => resolve(xmlResponse(CNN_FEED_XML));
      });
    }
  });

  const abort1 = new AbortController();
  const abort2 = new AbortController();

  const req1 = newsFetcher.fetchNews({ strict: true, signal: abort1.signal });
  const req2 = newsFetcher.fetchNews({ strict: true, signal: abort2.signal });

  // Both consumers share the same underlying CNN + DW fetches (2 total, not 4)
  assert.equal(fetchCount, 2);

  // Consumer 1 cancels while Consumer 2 remains active
  abort1.abort();
  await assert.rejects(() => req1, (err) => err?.name === 'AbortError');
  assert.equal(underlyingAborted, false);

  // Underlying fetch finishes and Consumer 2 receives the complete merged news
  resolveFetch();
  const result2 = await req2;
  assert.equal(result2.length, 4);
});

test('active news controller surfaces error instead of staying stuck when all providers time out', async () => {
  const timeoutFetcher = createNewsFetcher({
    now: () => NOW_MS,
    providerTimeout: 20,
    fetcher: (_url, { signal }) => new Promise((_res, rej) => {
      signal.addEventListener('abort', () => {
        const err = new Error('signal is aborted');
        err.name = 'AbortError';
        rej(err);
      }, { once: true });
    })
  });

  const controller = createNewsRefreshController({
    fetchNews: (opts) => timeoutFetcher.fetchNews(opts),
    getVisibilityState: () => 'visible',
    addVisibilityListener: () => {},
    removeVisibilityListener: () => {},
    setTimer: () => 1,
    clearTimer: () => {}
  });

  await controller.start();
  assert.equal(controller.getState().loading, false);
  assert.equal(typeof controller.getState().error, 'string');
  assert.equal(controller.getState().news.length, 0);
  controller.dispose();
});
