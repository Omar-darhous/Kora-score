import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isTrustedDwArticleUrl,
  isTrustedDwImageUrl,
  extractArticleMetaImage,
  createArticleImageResolver,
  enrichNewsImages
} from '../src/services/footballService.js';
import * as dwImageResolver from '../src/services/dwImageResolver.js';

const createDeferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

test('validates trusted DW article and image URLs and rejects unsafe or unrelated URLs', () => {
  assert.equal(isTrustedDwArticleUrl('https://www.dw.com/ar/example/a-12345'), true);
  assert.equal(isTrustedDwArticleUrl('https://dw.com/ar/example/a-12345'), true);
  assert.equal(isTrustedDwArticleUrl('https://m.dw.com/ar/example/a-12345'), true);

  assert.equal(isTrustedDwArticleUrl('http://www.dw.com/ar/example/a-12345'), false);
  assert.equal(isTrustedDwArticleUrl('https://evil-dw.com/ar/example'), false);
  assert.equal(isTrustedDwArticleUrl('https://dw.com.evil.test/ar/example'), false);
  assert.equal(isTrustedDwArticleUrl('javascript:alert(1)'), false);
  assert.equal(isTrustedDwArticleUrl(''), false);

  assert.equal(isTrustedDwImageUrl('https://static.dw.com/image/71234567_6.jpg'), true);
  assert.equal(isTrustedDwImageUrl('https://www.dw.com/image/71234567_6.jpg'), true);
  assert.equal(isTrustedDwImageUrl('http://static.dw.com/image/71234567_6.jpg'), false);
  assert.equal(isTrustedDwImageUrl('https://images.unsplash.com/photo-123.jpg'), false);
  assert.equal(isTrustedDwImageUrl('data:image/png;base64,AAAA'), false);
});

test('extractArticleMetaImage extracts valid og:image, prefers og:image over twitter:image, and decodes entities', () => {
  const html = `
    <html><head>
      <meta name="twitter:image" content="https://static.dw.com/image/111_6.jpg" />
      <meta content="https://static.dw.com/image/222_6.jpg?w=1200&amp;q=80" property="og:image" />
    </head></html>
  `;
  assert.equal(extractArticleMetaImage(html), 'https://static.dw.com/image/222_6.jpg?w=1200&q=80');

  const twitterOnlyHtml = `
    <html><head>
      <meta property="og:image" content="https://untrusted.example.com/fake.jpg" />
      <meta name="twitter:image" content="https://static.dw.com/image/333_6.jpg" />
    </head></html>
  `;
  assert.equal(extractArticleMetaImage(twitterOnlyHtml), 'https://static.dw.com/image/333_6.jpg');
});

test('extractArticleMetaImage returns empty string when metadata is missing or untrusted', () => {
  assert.equal(extractArticleMetaImage('<html><head><title>DW</title></head></html>'), '');
  assert.equal(
    extractArticleMetaImage('<meta property="og:image" content="https://cdn.other.com/img.jpg" />'),
    ''
  );
  assert.equal(
    extractArticleMetaImage('<meta property="og:image" content="http://static.dw.com/image/1_6.jpg" />'),
    ''
  );
});

test('createArticleImageResolver rejects untrusted article URLs without fetching', async () => {
  let fetchCount = 0;
  const resolver = createArticleImageResolver({
    fetcher: async () => {
      fetchCount += 1;
      return { ok: true, text: async () => '' };
    }
  });

  const result = await resolver.resolve('https://untrusted.example.com/article');
  assert.equal(result, '');
  assert.equal(fetchCount, 0);
});

test('createArticleImageResolver handles failed HTTP responses and timeouts gracefully', async () => {
  let calls = 0;
  const failingResolver = createArticleImageResolver({
    fetcher: async () => {
      calls += 1;
      return { ok: false, status: 500, text: async () => 'error' };
    }
  });

  const failedUrl = 'https://www.dw.com/ar/failed-article/a-100';
  assert.equal(await failingResolver.resolve(failedUrl), '');
  assert.equal(await failingResolver.resolve(failedUrl), '');
  assert.equal(calls, 1);

  const timeoutResolver = createArticleImageResolver({
    timeout: 25,
    fetcher: (_url, { signal }) => new Promise((_res, rej) => {
      signal.addEventListener('abort', () => rej(new Error('Aborted')), { once: true });
    })
  });

  const timedOut = await timeoutResolver.resolve('https://www.dw.com/ar/slow-article/a-200');
  assert.equal(timedOut, '');
});

test('createArticleImageResolver deduplicates concurrent requests and reuses cache', async () => {
  let fetchCount = 0;
  const deferred = createDeferred();
  const resolver = createArticleImageResolver({
    fetcher: () => {
      fetchCount += 1;
      return deferred.promise;
    }
  });

  const articleUrl = 'https://www.dw.com/ar/cached-article/a-300';
  const p1 = resolver.resolve(articleUrl);
  const p2 = resolver.resolve(articleUrl);

  assert.equal(fetchCount, 1);
  deferred.resolve({
    ok: true,
    text: async () => '<meta property="og:image" content="https://static.dw.com/image/999_6.jpg" />'
  });

  const [r1, r2] = await Promise.all([p1, p2]);
  assert.equal(r1, 'https://static.dw.com/image/999_6.jpg');
  assert.equal(r2, 'https://static.dw.com/image/999_6.jpg');

  const r3 = await resolver.resolve(articleUrl);
  assert.equal(r3, 'https://static.dw.com/image/999_6.jpg');
  assert.equal(fetchCount, 1);
});

test('enrichNewsImages preserves existing RSS images, respects concurrency, and updates missing images progressively', async () => {
  let activeFetches = 0;
  let maxConcurrentFetches = 0;
  const fetchedUrls = [];

  const resolver = createArticleImageResolver({
    fetcher: async (url) => {
      fetchedUrls.push(url);
      activeFetches += 1;
      maxConcurrentFetches = Math.max(maxConcurrentFetches, activeFetches);
      await new Promise(resolve => setTimeout(resolve, 15));
      activeFetches -= 1;
      const id = url.split('a-')[1];
      return {
        ok: true,
        text: async () => `<meta property="og:image" content="https://static.dw.com/image/${id}_6.jpg" />`
      };
    }
  });

  const articles = [
    { id: 'rss-1', link: 'https://www.dw.com/ar/rss-has-img/a-1', img: 'https://static.dw.com/image/rss_6.jpg' },
    { id: 'dw-2', link: 'https://www.dw.com/ar/missing-img/a-2', img: '' },
    { id: 'dw-3', link: 'https://www.dw.com/ar/missing-img/a-3', img: '' },
    { id: 'dw-4', link: 'https://www.dw.com/ar/missing-img/a-4', img: '' },
    { id: 'dw-5', link: 'https://www.dw.com/ar/missing-img/a-5', img: '' },
    { id: 'bad-6', link: 'https://other-site.example/news/6', img: '' }
  ];

  const resolvedEvents = [];
  const enriched = await enrichNewsImages(articles, {
    resolver,
    concurrency: 2,
    onImageResolved: (id, img) => resolvedEvents.push({ id, img })
  });

  assert.equal(maxConcurrentFetches <= 2, true);
  assert.equal(fetchedUrls.includes('https://www.dw.com/ar/rss-has-img/a-1'), false);
  assert.equal(fetchedUrls.includes('https://other-site.example/news/6'), false);
  assert.equal(fetchedUrls.length, 4);
  assert.equal(resolvedEvents.length, 4);

  assert.equal(enriched[0].img, 'https://static.dw.com/image/rss_6.jpg');
  assert.equal(enriched[1].img, 'https://static.dw.com/image/2_6.jpg');
  assert.equal(enriched[4].img, 'https://static.dw.com/image/5_6.jpg');
  assert.equal(enriched[5].img, '');
});

test('createArticleImageResolver aborts cleanly without poisoning cache and skips CNN articles', async () => {
  let fetchCalls = 0;
  let abortedInFetch = false;
  const resolver = createArticleImageResolver({
    fetcher: (url, { signal }) => {
      fetchCalls += 1;
      if (fetchCalls === 1) {
        return new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => {
            abortedInFetch = true;
            const err = new Error('Aborted');
            err.name = 'AbortError';
            reject(err);
          }, { once: true });
        });
      }
      return Promise.resolve({
        ok: true,
        text: async () => `<meta property="og:image" content="https://static.dw.com/image/recovered_6.jpg" />`
      });
    }
  });

  const controller = new AbortController();
  const dwUrl = 'https://www.dw.com/ar/abort-recovery/a-900';
  const pending = resolver.resolve(dwUrl, { signal: controller.signal });
  controller.abort();

  assert.equal(await pending, '');
  assert.equal(abortedInFetch, true);
  assert.equal(resolver.getCacheSize(), 0);

  // Subsequent non-aborted call succeeds because abort did not poison cache
  assert.equal(await resolver.resolve(dwUrl), 'https://static.dw.com/image/recovered_6.jpg');
  assert.equal(fetchCalls, 2);

  // CNN articles (with or without RSS image) are preserved and never fetched by DW resolver
  const cnnArticles = [
    { id: 'cnn-1', link: 'https://arabic.cnn.com/sport/article/1', img: 'https://cnn-arabic-images.cnn.io/1.jpg' },
    { id: 'cnn-2', link: 'https://arabic.cnn.com/sport/article/2', img: '' }
  ];
  const enrichedCnn = await enrichNewsImages(cnnArticles, { resolver });
  assert.equal(fetchCalls, 2);
  assert.equal(enrichedCnn[0].img, 'https://cnn-arabic-images.cnn.io/1.jpg');
  assert.equal(enrichedCnn[1].img, '');
});

test('footballService re-exports exact DW image resolver functions with single shared default instance', () => {
  assert.equal(isTrustedDwArticleUrl, dwImageResolver.isTrustedDwArticleUrl);
  assert.equal(isTrustedDwImageUrl, dwImageResolver.isTrustedDwImageUrl);
  assert.equal(extractArticleMetaImage, dwImageResolver.extractArticleMetaImage);
  assert.equal(createArticleImageResolver, dwImageResolver.createArticleImageResolver);
  assert.equal(enrichNewsImages, dwImageResolver.enrichNewsImages);
  assert.equal(typeof dwImageResolver.defaultArticleImageResolver.resolve, 'function');
});
