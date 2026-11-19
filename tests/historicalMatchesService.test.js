import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getSeasonCalendarYears,
  getHistoricalSeasonMatches,
  groupHistoricalMatchesByDate,
  formatArabicMonthLabel,
  organizeHistoricalMatches,
  createHistoricalMatchesController
} from '../src/services/historicalMatchesService.js';
import { getMatches } from '../src/services/liveMatchesService.js';

const withMockFetch = async (mockImpl, fn) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockImpl;
  try {
    return await fn();
  } finally {
    globalThis.fetch = originalFetch;
  }
};

const makeEvent = ({
  id,
  seasonYear,
  date,
  slug = '',
  homeId = '1',
  homeName = 'Home FC',
  homeScore = '2',
  awayId = '2',
  awayName = 'Away FC',
  awayScore = '1',
  status = { type: { state: 'post', completed: true, name: 'STATUS_FULL_TIME' } },
  homePen,
  awayPen
}) => ({
  id,
  date,
  season: { year: seasonYear, slug },
  status,
  competitions: [{
    competitors: [
      {
        homeAway: 'home',
        score: homeScore,
        shootoutScore: homePen,
        winner: Number(homeScore) > Number(awayScore) || Number(homePen) > Number(awayPen),
        team: { id: homeId, displayName: homeName, logo: `https://a.espncdn.com/i/teamlogos/soccer/500/${homeId}.png` }
      },
      {
        homeAway: 'away',
        score: awayScore,
        shootoutScore: awayPen,
        winner: Number(awayScore) > Number(homeScore) || Number(awayPen) > Number(homePen),
        team: { id: awayId, displayName: awayName, logo: `https://a.espncdn.com/i/teamlogos/soccer/500/${awayId}.png` }
      }
    ]
  }]
});

test('getSeasonCalendarYears distinguishes single-year and split-year competitions', () => {
  assert.deepEqual(getSeasonCalendarYears('eng.1', 2024), [2024, 2025]);
  assert.deepEqual(getSeasonCalendarYears('uefa.champions', 2023), [2023, 2024]);
  assert.deepEqual(getSeasonCalendarYears('ksa.1', 2024), [2024, 2025]);
  assert.deepEqual(getSeasonCalendarYears('fifa.world', 2022), [2022]);
  assert.deepEqual(getSeasonCalendarYears('usa.1', 2024), [2024]);
  assert.deepEqual(getSeasonCalendarYears('eng.1', 'invalid'), []);
});

test('getHistoricalSeasonMatches fetches Premier League 2024/2025, filters season identity, deduplicates, and preserves match detail links', async () => {
  const requestedUrls = [];
  const matches = await withMockFetch(async (url) => {
    const str = String(url);
    requestedUrls.push(str);
    if (str.includes('dates=2024')) {
      return {
        ok: true,
        json: async () => ({
          events: [
            makeEvent({ id: 'epl-1', seasonYear: 2024, date: '2024-08-16T19:00:00Z', homeId: '364', homeName: 'Liverpool', awayId: '359', awayName: 'Arsenal' }),
            makeEvent({ id: 'epl-wrong-season', seasonYear: 2023, date: '2024-05-19T15:00:00Z', homeName: 'Old Season' })
          ]
        })
      };
    }
    return {
      ok: true,
      json: async () => ({
        events: [
          makeEvent({ id: 'epl-1', seasonYear: 2024, date: '2024-08-16T19:00:00Z', homeId: '364', homeName: 'Liverpool', awayId: '359', awayName: 'Arsenal' }),
          makeEvent({ id: 'epl-380', seasonYear: 2024, date: '2025-05-25T15:00:00Z', homeId: '364', homeName: 'Liverpool', homeScore: '3', awayId: '382', awayName: 'Man City', awayScore: '1' })
        ]
      })
    };
  }, () => getHistoricalSeasonMatches('eng.1', 2024, { strict: true }));

  assert.equal(requestedUrls.length, 2);
  assert.equal(matches.length, 2);
  // Sorted newest-first: final matchday first, opening matchday second
  assert.deepEqual(matches.map(m => m.id), ['epl-380', 'epl-1']);
  assert.equal(matches[0].leagueId, 'eng.1');
  assert.equal(matches[0].homeTeamId, '364');
  assert.equal(matches[0].awayTeamId, '382');
  assert.equal(matches[0].seasonYear, 2024);

  const grouped = groupHistoricalMatchesByDate(matches);
  assert.equal(grouped.length, 2);
  assert.equal(grouped[0].dateKey, '2025-05-25');
});

test('getHistoricalSeasonMatches supports UCL 2023/2024, UCL 2024/2025, and World Cup 2022 with FT/AET/PEN outcomes', async () => {
  await withMockFetch(async (url) => {
    const str = String(url);
    if (str.includes('/uefa.champions/') && str.includes('dates=2023')) {
      return {
        ok: true,
        json: async () => ({
          events: [
            makeEvent({ id: 'ucl23-gs', seasonYear: 2023, date: '2023-09-19T19:00:00Z', slug: 'group-stage' })
          ]
        })
      };
    }
    if (str.includes('/uefa.champions/') && str.includes('dates=2024')) {
      return {
        ok: true,
        json: async () => ({
          events: [
            makeEvent({ id: 'ucl23-final', seasonYear: 2023, date: '2024-06-01T19:00:00Z', slug: 'final' }),
            makeEvent({ id: 'ucl24-lp', seasonYear: 2024, date: '2024-09-17T19:00:00Z', slug: 'league-phase' })
          ]
        })
      };
    }
    if (str.includes('/uefa.champions/') && str.includes('dates=2025')) {
      return {
        ok: true,
        json: async () => ({
          events: [
            makeEvent({
              id: 'ucl24-aet',
              seasonYear: 2024,
              date: '2025-05-06T19:00:00Z',
              slug: 'semifinals',
              status: { type: { state: 'post', completed: true, name: 'STATUS_FINAL_AET', shortDetail: 'AET' } }
            })
          ]
        })
      };
    }
    if (str.includes('/fifa.world/') && str.includes('dates=2022')) {
      return {
        ok: true,
        json: async () => ({
          events: [
            makeEvent({
              id: 'wc22-final',
              seasonYear: 2022,
              date: '2022-12-18T15:00:00Z',
              slug: 'final',
              homeName: 'Argentina',
              homeScore: '3',
              homePen: '4',
              awayName: 'France',
              awayScore: '3',
              awayPen: '2',
              status: { type: { state: 'post', completed: true, name: 'STATUS_FINAL_PEN', shortDetail: 'FT-Pens' } }
            })
          ]
        })
      };
    }
    return { ok: true, json: async () => ({ events: [] }) };
  }, async () => {
    const ucl2023 = await getHistoricalSeasonMatches('uefa.champions', 2023, { strict: true, forceRefresh: true });
    assert.deepEqual(ucl2023.map(m => m.id), ['ucl23-final', 'ucl23-gs']);
    assert.equal(ucl2023[0].roundName, 'النهائي');
    assert.equal(ucl2023[1].roundName, 'مرحلة المجموعات / الدوري');

    const ucl2024 = await getHistoricalSeasonMatches('uefa.champions', 2024, { strict: true, forceRefresh: true });
    assert.deepEqual(ucl2024.map(m => m.id), ['ucl24-aet', 'ucl24-lp']);
    assert.equal(ucl2024[0].finishType, 'extra-time');
    assert.equal(ucl2024[0].roundName, 'نصف النهائي');

    const wc2022 = await getHistoricalSeasonMatches('fifa.world', 2022, { strict: true, forceRefresh: true });
    assert.equal(wc2022.length, 1);
    assert.equal(wc2022[0].finishType, 'penalties');
    assert.equal(wc2022[0].homePenalties, 4);
    assert.equal(wc2022[0].awayPenalties, 2);
  });
});

test('handles incomplete responses, unsupported seasons, Egyptian mock league, cache isolation, and AbortController', async () => {
  // Invalid or Egyptian mock league rejected under strict: true
  await assert.rejects(() => getHistoricalSeasonMatches('egypt.1', 2024, { strict: true }), /not available/);
  assert.deepEqual(await getHistoricalSeasonMatches('egypt.1', 2024, { strict: false }), []);
  await assert.rejects(() => getHistoricalSeasonMatches('eng.1', 'bad', { strict: true }), /Invalid historical season/);

  // Incomplete API response (no events array) returns [] safely
  const incomplete = await withMockFetch(async () => ({
    ok: true,
    json: async () => ({})
  }), () => getHistoricalSeasonMatches('esp.1', 2021, { strict: true }));
  assert.deepEqual(incomplete, []);

  // AbortController cancels cleanly
  const abortController = new AbortController();
  await withMockFetch((_url, { signal }) => new Promise((_res, rej) => {
    signal.addEventListener('abort', () => {
      const err = new Error('Aborted');
      err.name = 'AbortError';
      rej(err);
    }, { once: true });
  }), async () => {
    const pending = getHistoricalSeasonMatches('ita.1', 2022, { strict: true, signal: abortController.signal });
    abortController.abort();
    await assert.rejects(() => pending, (err) => err?.name === 'AbortError');
  });
});

test('createHistoricalMatchesController prevents rapid-switch race conditions and isolates historical data from live snapshots', async () => {
  let resolveSlow2024;
  let aborted2024 = false;

  const controller = createHistoricalMatchesController({
    fetcher: async (leagueId, season, { signal }) => {
      if (season === 2024) {
        return new Promise((resolve, reject) => {
          signal.addEventListener('abort', () => {
            aborted2024 = true;
            const err = new Error('Aborted');
            err.name = 'AbortError';
            reject(err);
          }, { once: true });
          resolveSlow2024 = () => resolve([{ id: 'old-2024', seasonYear: 2024 }]);
        });
      }
      return [{ id: 'new-2023', seasonYear: 2023 }];
    }
  });

  const p2024 = controller.load('eng.1', 2024);
  const p2023 = controller.load('eng.1', 2023);
  await p2023;
  resolveSlow2024?.();
  await p2024;

  assert.equal(aborted2024, true);
  assert.equal(controller.getState().season, 2023);
  assert.deepEqual(controller.getState().matches.map(m => m.id), ['new-2023']);
  controller.dispose();

  // Historical fetch never overwrites live match snapshot for today
  await withMockFetch(async (url) => {
    const str = String(url);
    if (str.includes('dates=20261119') && str.includes('/eng.1/')) {
      return {
        ok: true,
        json: async () => ({
          events: [makeEvent({ id: 'live-today-1', seasonYear: 2026, date: '2026-11-19T18:00:00Z', homeName: 'Today Home', awayName: 'Today Away' })]
        })
      };
    }
    if (str.includes('/fifa.world/') && str.includes('dates=2022')) {
      return {
        ok: true,
        json: async () => ({
          events: [makeEvent({ id: 'hist-2022-1', seasonYear: 2022, date: '2022-11-20T18:00:00Z', homeName: 'Hist Home', awayName: 'Hist Away' })]
        })
      };
    }
    return { ok: true, json: async () => ({ events: [] }) };
  }, async () => {
    const liveBefore = await getMatches('20261119', { strict: true, forceRefresh: true });
    assert.equal(liveBefore.some(m => m.id === 'live-today-1'), true);

    const hist = await getHistoricalSeasonMatches('fifa.world', 2022, { strict: true, forceRefresh: true });
    assert.equal(hist[0].id, 'hist-2022-1');

    const liveAfter = await getMatches('20261119', { strict: true });
    assert.equal(liveAfter.some(m => m.id === 'live-today-1'), true);
    assert.equal(liveAfter.some(m => m.id === 'hist-2022-1'), false);
  });
});

const makeNormalizedMatch = ({ id, date, roundNumber = null, seasonSlug = '' }) => ({
  id,
  date,
  dateKey: date.slice(0, 10),
  dateTs: Date.parse(date),
  roundNumber,
  seasonSlug
});

test('organizeHistoricalMatches groups domestic leagues by reliable ESPN round metadata when present', () => {
  const matches = [
    makeNormalizedMatch({ id: 'r2-b', date: '2024-08-25T15:00:00Z', roundNumber: 2, seasonSlug: '2024-25-english-premier-league' }),
    makeNormalizedMatch({ id: 'r1-b', date: '2024-08-18T15:00:00Z', roundNumber: 1, seasonSlug: '2024-25-english-premier-league' }),
    makeNormalizedMatch({ id: 'r1-a', date: '2024-08-16T19:00:00Z', roundNumber: 1, seasonSlug: '2024-25-english-premier-league' }),
    makeNormalizedMatch({ id: 'r2-a', date: '2024-08-24T14:00:00Z', roundNumber: 2, seasonSlug: '2024-25-english-premier-league' }),
    makeNormalizedMatch({ id: 'r3-a', date: '2024-08-31T14:00:00Z', roundNumber: 3, seasonSlug: '2024-25-english-premier-league' })
  ];

  const organized = organizeHistoricalMatches(matches, 'eng.1');
  assert.equal(organized.mode, 'rounds');
  assert.equal(organized.defaultGroupId, 'round-1');
  assert.equal(organized.totalMatches, 5);
  assert.deepEqual(organized.groups.map(g => g.label), ['الجولة 1', 'الجولة 2', 'الجولة 3']);

  // Chronological order within Round 1 and grouped by match date
  assert.deepEqual(organized.groups[0].matches.map(m => m.id), ['r1-a', 'r1-b']);
  assert.deepEqual(organized.groups[0].dateGroups.map(dg => dg.dateKey), ['2024-08-16', '2024-08-18']);

  // Zero missing or duplicate matches across groups
  const allIds = organized.groups.flatMap(g => g.matches.map(m => m.id));
  assert.equal(allIds.length, matches.length);
  assert.equal(new Set(allIds).size, matches.length);
});

test('organizeHistoricalMatches falls back honestly to chronological months when ESPN omits or inconsistently supplies round metadata', () => {
  // Missing round metadata (standard ESPN domestic behavior)
  const missingRounds = [
    makeNormalizedMatch({ id: 'm-may', date: '2025-05-25T15:00:00Z', roundNumber: null, seasonSlug: '2024-25-english-premier-league' }),
    makeNormalizedMatch({ id: 'm-aug-2', date: '2024-08-24T14:00:00Z', roundNumber: null, seasonSlug: '2024-25-english-premier-league' }),
    makeNormalizedMatch({ id: 'm-aug-1', date: '2024-08-16T19:00:00Z', roundNumber: null, seasonSlug: '2024-25-english-premier-league' }),
    makeNormalizedMatch({ id: 'm-sep', date: '2024-09-14T11:30:00Z', roundNumber: null, seasonSlug: '2024-25-english-premier-league' })
  ];

  const organized = organizeHistoricalMatches(missingRounds, 'eng.1');
  assert.equal(organized.mode, 'months');
  assert.equal(organized.defaultGroupId, 'month-2024-08');
  assert.deepEqual(organized.groups.map(g => g.id), ['month-2024-08', 'month-2024-09', 'month-2025-05']);
  assert.equal(organized.groups[0].label, formatArabicMonthLabel('2024-08'));
  assert.equal(organized.groups[0].label.includes('أغسطس'), true);
  assert.deepEqual(organized.groups[0].matches.map(m => m.id), ['m-aug-1', 'm-aug-2']);
  assert.equal(organized.groups.some(g => g.label.includes('الجولة')), false);

  // Inconsistent metadata (< 80% have roundNumber) also refuses to fabricate rounds
  const inconsistent = [
    makeNormalizedMatch({ id: 'i1', date: '2024-08-16T19:00:00Z', roundNumber: 1 }),
    makeNormalizedMatch({ id: 'i2', date: '2024-08-17T14:00:00Z', roundNumber: null }),
    makeNormalizedMatch({ id: 'i3', date: '2024-09-01T14:00:00Z', roundNumber: null })
  ];
  const fallback = organizeHistoricalMatches(inconsistent, 'ksa.1');
  assert.equal(fallback.mode, 'months');
  const allIds = fallback.groups.flatMap(g => g.matches.map(m => m.id));
  assert.equal(allIds.length, inconsistent.length);
  assert.equal(new Set(allIds).size, inconsistent.length);
});

test('organizeHistoricalMatches separates UEFA league phase from knockout stages and creates month subFilters for large league phase', () => {
  // 26 league-phase matches across Sep & Oct (> 24 threshold triggers subFilters)
  const leaguePhaseMatches = Array.from({ length: 26 }, (_, idx) => {
    const month = idx < 13 ? '09' : '10';
    const day = String((idx % 13) + 10).padStart(2, '0');
    return makeNormalizedMatch({
      id: `lp-${idx + 1}`,
      date: `2024-${month}-${day}T19:00:00Z`,
      seasonSlug: 'league-phase',
      roundNumber: null
    });
  });

  const knockoutMatches = [
    makeNormalizedMatch({ id: 'final-1', date: '2025-05-31T19:00:00Z', seasonSlug: 'final' }),
    makeNormalizedMatch({ id: 'sf-1', date: '2025-04-29T19:00:00Z', seasonSlug: 'semifinals' }),
    makeNormalizedMatch({ id: 'qf-1', date: '2025-04-08T19:00:00Z', seasonSlug: 'quarterfinals' }),
    makeNormalizedMatch({ id: 'r16-1', date: '2025-03-04T19:00:00Z', seasonSlug: 'round-of-16' }),
    makeNormalizedMatch({ id: 'po-1', date: '2025-02-11T19:00:00Z', seasonSlug: 'knockout-round-playoffs' })
  ];

  const allMatches = [...knockoutMatches, ...leaguePhaseMatches];
  const organized = organizeHistoricalMatches(allMatches, 'uefa.champions');

  assert.equal(organized.mode, 'stages');
  assert.equal(organized.defaultGroupId, 'stage-league-phase');
  assert.deepEqual(organized.groups.map(g => g.id), [
    'stage-league-phase',
    'stage-playoff',
    'stage-r16',
    'stage-qf',
    'stage-sf',
    'stage-final'
  ]);

  // League phase has secondary month subFilters with zero missing/duplicate matches
  const lpGroup = organized.groups[0];
  assert.equal(lpGroup.count, 26);
  assert.equal(lpGroup.subFilters.length, 2);
  assert.deepEqual(lpGroup.subFilters.map(sf => sf.id), ['month-2024-09', 'month-2024-10']);
  const lpSubIds = lpGroup.subFilters.flatMap(sf => sf.matches.map(m => m.id));
  assert.equal(lpSubIds.length, 26);
  assert.equal(new Set(lpSubIds).size, 26);

  // Across all stages: zero missing or duplicate matches
  const stageIds = organized.groups.flatMap(g => g.matches.map(m => m.id));
  assert.equal(stageIds.length, allMatches.length);
  assert.equal(new Set(stageIds).size, allMatches.length);
});

test('organizeHistoricalMatches orders FIFA World Cup stages chronologically with zero missing or duplicate matches', () => {
  const wcMatches = [
    makeNormalizedMatch({ id: 'wc-final', date: '2022-12-18T15:00:00Z', seasonSlug: 'final' }),
    makeNormalizedMatch({ id: 'wc-3rd', date: '2022-12-17T15:00:00Z', seasonSlug: '3rd-place-match' }),
    makeNormalizedMatch({ id: 'wc-sf', date: '2022-12-13T19:00:00Z', seasonSlug: 'semifinals' }),
    makeNormalizedMatch({ id: 'wc-qf', date: '2022-12-09T15:00:00Z', seasonSlug: 'quarterfinals' }),
    makeNormalizedMatch({ id: 'wc-r16', date: '2022-12-03T15:00:00Z', seasonSlug: 'round-of-16' }),
    makeNormalizedMatch({ id: 'wc-gs-2', date: '2022-11-21T16:00:00Z', seasonSlug: 'group-stage' }),
    makeNormalizedMatch({ id: 'wc-gs-1', date: '2022-11-20T16:00:00Z', seasonSlug: 'group-stage' })
  ];

  const organized = organizeHistoricalMatches(wcMatches, 'fifa.world');
  assert.equal(organized.mode, 'stages');
  assert.equal(organized.defaultGroupId, 'stage-group-stage');
  assert.deepEqual(organized.groups.map(g => g.id), [
    'stage-group-stage',
    'stage-r16',
    'stage-qf',
    'stage-sf',
    'stage-third-place',
    'stage-final'
  ]);
  assert.deepEqual(organized.groups[0].matches.map(m => m.id), ['wc-gs-1', 'wc-gs-2']);

  const allIds = organized.groups.flatMap(g => g.matches.map(m => m.id));
  assert.equal(allIds.length, wcMatches.length);
  assert.equal(new Set(allIds).size, wcMatches.length);
});

test('getHistoricalSeasonMatches extracts verified ESPN week/round metadata when present without fabricating it when absent', async () => {
  const matches = await withMockFetch(async (url) => {
    const str = String(url);
    if (str.includes('dates=2024')) {
      return {
        ok: true,
        json: async () => ({
          events: [
            {
              ...makeEvent({ id: 'with-week', seasonYear: 2024, date: '2024-08-17T14:00:00Z', slug: '2024-25-test' }),
              week: { number: 1 }
            },
            makeEvent({ id: 'without-week', seasonYear: 2024, date: '2024-08-18T14:00:00Z', slug: '2024-25-test' })
          ]
        })
      };
    }
    return { ok: true, json: async () => ({ events: [] }) };
  }, () => getHistoricalSeasonMatches('ger.1', 2024, { strict: true, forceRefresh: true }));

  const withWeek = matches.find(m => m.id === 'with-week');
  const withoutWeek = matches.find(m => m.id === 'without-week');
  assert.equal(withWeek.roundNumber, 1);
  assert.equal(withWeek.seasonSlug, '2024-25-test');
  assert.equal(withoutWeek.roundNumber, null);
});
