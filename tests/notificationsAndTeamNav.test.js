import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DEFAULT_NOTIFICATION_PREFS,
  MAX_SEEN_EVENTS,
  loadNotificationPrefs,
  saveNotificationPrefs,
  loadSeenEventIds,
  saveSeenEventIds,
  getFollowedTeamIds,
  getFollowedMatchContext,
  getNotificationPermissionState,
  requestBrowserNotificationPermission,
  createCrossTabCoordinator,
  createNotificationEngine,
  deliverBrowserNotification
} from '../src/services/notificationsService.js';
import { createNotificationSoundPlayer } from '../src/services/notificationSound.js';
import {
  isValidTeamNavigationId,
  buildTeamRoute,
  buildTeamNavigationState,
  resolveMatchSideTeamId,
  lockBodyScroll,
  releaseBodyScrollLock
} from '../src/utils/teamNavigation.js';
import {
  extractVerifiedPlayerRating,
  normalizeMatchRosters,
  normalizeScoreboardMatches
} from '../src/services/matchesService.js';
import {
  MATCH_PHASES,
  resolveEspnMatchPhase,
  isHalfTimePhase,
  getLiveMatchDisplay,
  getFavoriteMatchDisplay
} from '../src/services/matchResult.js';
import { subscribeToLiveMatches } from '../src/services/liveMatchesService.js';
import { createRequestCache } from '../src/services/requestCache.js';

const createMemoryStorage = () => {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
    clear: () => { map.clear(); }
  };
};

const createMockBroadcastChannelFactory = () => {
  const channelsByName = new Map();
  return class MockBroadcastChannel {
    constructor(name) {
      this.name = name;
      this.onmessage = null;
      this.closed = false;
      if (!channelsByName.has(name)) channelsByName.set(name, new Set());
      channelsByName.get(name).add(this);
    }
    postMessage(data) {
      if (this.closed) return;
      for (const peer of channelsByName.get(this.name) || []) {
        if (peer !== this && !peer.closed && typeof peer.onmessage === 'function') {
          peer.onmessage({ data });
        }
      }
    }
    close() {
      this.closed = true;
      channelsByName.get(this.name)?.delete(this);
    }
  };
};

test('PART A1: notification preferences, followed-team filtering (excluding leagues), kickoff, goals for/against, red cards, penalties, half-time, and full-time', async () => {
  const storage = createMemoryStorage();
  assert.deepEqual(loadNotificationPrefs(storage), DEFAULT_NOTIFICATION_PREFS);
  assert.equal(DEFAULT_NOTIFICATION_PREFS.soundEnabled, false, 'sound must be disabled by default');
  assert.equal(DEFAULT_NOTIFICATION_PREFS.events.halfTime, false, 'half-time must be optional/off by default');

  const savedPrefs = saveNotificationPrefs({
    enabled: true,
    soundEnabled: false,
    events: { goals: true, kickoff: true, fullTime: true, redCards: true, penalties: true, halfTime: true }
  }, storage);
  assert.equal(loadNotificationPrefs(storage).enabled, true);
  assert.equal(loadNotificationPrefs(storage).events.halfTime, true);

  // Favorite teams ONLY — leagues are NOT passed or treated as followed teams
  const favTeams = [{ id: '83', name: 'Barcelona' }];
  const followedIds = getFollowedTeamIds(favTeams);
  assert.equal(followedIds.has('83'), true);
  assert.equal(followedIds.has('esp.1'), false);

  const unrelatedMatch = {
    id: '9001',
    leagueId: 'esp.1',
    leagueName: 'الدوري الإسباني',
    homeTeamId: '86',
    homeTeam: 'Real Madrid',
    awayTeamId: '1068',
    awayTeam: 'Atletico Madrid',
    status: 'NS',
    homeScore: null,
    awayScore: null,
    minute: 0
  };
  assert.equal(getFollowedMatchContext(unrelatedMatch, followedIds).involvesFollowed, false);

  let barcaDetails = { events: [] };
  let detailFetchCalls = 0;
  let clockNow = 1_000_000;

  const engine = createNotificationEngine({
    storage,
    coordinator: createCrossTabCoordinator({ storage, BroadcastChannelCtor: null, now: () => clockNow }),
    now: () => clockNow,
    getMatchDetailsFn: async (leagueId, matchId) => {
      detailFetchCalls += 1;
      assert.equal(matchId, '401882804', 'must ONLY fetch details for followed live matches');
      assert.equal(leagueId, 'esp.1');
      return barcaDetails;
    }
  });

  const barcaMatch = {
    id: '401882804',
    leagueId: 'esp.1',
    leagueName: 'الدوري الإسباني',
    homeTeamId: '83',
    homeTeam: 'Barcelona',
    awayTeamId: '102',
    awayTeam: 'Villarreal',
    status: 'NS',
    homeScore: null,
    awayScore: null,
    minute: 0
  };

  // Initial baseline -> 0 notifications, 0 detail fetches for NS match
  const initial = await engine.processMatches([barcaMatch, unrelatedMatch], favTeams, savedPrefs);
  assert.equal(initial.length, 0);
  assert.equal(detailFetchCalls, 0);

  // Tick 2: Kickoff for BOTH matches -> only Barcelona notifies!
  clockNow += 30_000;
  const afterKickoff = await engine.processMatches([
    { ...barcaMatch, status: 'LIVE', homeScore: 0, awayScore: 0, minute: '1' },
    { ...unrelatedMatch, status: 'LIVE', homeScore: 1, awayScore: 0, minute: '1' }
  ], favTeams, savedPrefs);
  assert.equal(afterKickoff.length, 1);
  assert.equal(afterKickoff[0].kind, 'KICKOFF');
  assert.equal(afterKickoff[0].url, '/match/esp.1/401882804');

  // Tick 3: Goal conceded (0-1) + Missed penalty for Barcelona + Red card for Villarreal
  clockNow += 30_000;
  barcaDetails = {
    events: [
      { id: 'ev-g1', eventType: 'GOAL', team: 'away', teamId: '102', player: 'Tajon Buchanan', time: '5' },
      { id: 'ev-pm1', eventType: 'PENALTY_MISSED', team: 'home', teamId: '83', player: 'Lamine Yamal', time: '23' },
      { id: 'ev-rc1', eventType: 'RED_CARD', team: 'away', teamId: '102', player: 'Pape Gueye', time: '30' }
    ]
  };
  const tick3 = await engine.processMatches([
    { ...barcaMatch, status: 'LIVE', homeScore: 0, awayScore: 1, minute: '31' }
  ], favTeams, savedPrefs);
  assert.deepEqual(tick3.map(n => n.kind), ['GOAL', 'PENALTY_MISSED', 'RED_CARD']);
  assert.ok(tick3[0].title.includes('في مرمى Barcelona'), 'conceded goal should distinguish conceded vs scored');
  assert.ok(tick3[1].title.includes('ركلة جزاء ضائعة'));
  assert.ok(tick3[1].body.includes('Lamine Yamal'));
  assert.ok(tick3[2].title.includes('بطاقة حمراء'));

  // Tick 4: Reordered ESPN events on same poll -> zero duplicates!
  clockNow += 30_000;
  barcaDetails = { events: [...barcaDetails.events].reverse() };
  const tick4 = await engine.processMatches([
    { ...barcaMatch, status: 'LIVE', homeScore: 0, awayScore: 1, minute: '35' }
  ], favTeams, savedPrefs);
  assert.equal(tick4.length, 0, 'reordered events must never duplicate notifications');

  // Tick 5: Half-time + Penalty goal for Barcelona (1-1)
  clockNow += 30_000;
  barcaDetails = {
    events: [
      ...barcaDetails.events,
      { id: 'ev-pg1', eventType: 'PENALTY_GOAL', team: 'home', teamId: '83', player: 'Raphinha', time: '45+1' }
    ]
  };
  const tick5 = await engine.processMatches([
    { ...barcaMatch, status: 'LIVE', statusDetail: 'Halftime', homeScore: 1, awayScore: 1, minute: 'HT' }
  ], favTeams, savedPrefs);
  assert.deepEqual(tick5.map(n => n.kind), ['HALF_TIME', 'PENALTY_GOAL']);
  assert.ok(tick5[1].title.includes('هدف من ركلة جزاء لـ Barcelona'));

  // Tick 6: Full-time (2-1) with goal by Barcelona via score change fallback -> never infers cards/penalties
  clockNow += 30_000;
  const tick6 = await engine.processMatches([
    { ...barcaMatch, status: 'FT', homeScore: 2, awayScore: 1, minute: '90' }
  ], favTeams, savedPrefs);
  assert.deepEqual(tick6.map(n => n.kind), ['GOAL', 'FULL_TIME']);
  assert.ok(tick6[0].title.includes('هدف لـ Barcelona'));
  assert.ok(tick6[1].title.includes('انتهت المباراة'));

  // Removing Barcelona from favorites stops all future notifications immediately
  clockNow += 30_000;
  const afterRemoval = await engine.processMatches([
    { ...barcaMatch, id: '401882999', status: 'LIVE', homeScore: 3, awayScore: 0 }
  ], [], savedPrefs);
  assert.equal(afterRemoval.length, 0);
});

test('PART A2: initial seeding on newly favorited team, page refresh persistence, bounded seen history, cross-tab coordination, and sleep/network recovery', async () => {
  const storage = createMemoryStorage();

  // Bounded seen storage never exceeds MAX_SEEN_EVENTS
  const oversized = Array.from({ length: MAX_SEEN_EVENTS + 80 }, (_, i) => `evt:test:${i}`);
  const savedSeen = saveSeenEventIds(oversized, storage);
  assert.equal(savedSeen.length, MAX_SEEN_EVENTS);
  assert.equal(loadSeenEventIds(storage)[0], `evt:test:80`);

  // Cross-tab BroadcastChannel + localStorage coordination
  const sharedStorage = createMemoryStorage();
  const MockBC = createMockBroadcastChannelFactory();
  const tab1 = createCrossTabCoordinator({ tabId: 'tab-1', storage: sharedStorage, BroadcastChannelCtor: MockBC });
  const tab2 = createCrossTabCoordinator({ tabId: 'tab-2', storage: sharedStorage, BroadcastChannelCtor: MockBC });

  assert.equal(tab1.tryClaim('evt:esp.1:401882804:55534087'), true);
  assert.equal(tab2.tryClaim('evt:esp.1:401882804:55534087'), false, 'second tab must not notify for already-claimed event');
  tab1.destroy();
  tab2.destroy();

  // Cross-tab fallback without BroadcastChannel (storage-only)
  const storageOnly = createMemoryStorage();
  const tabA = createCrossTabCoordinator({ tabId: 'tab-a', storage: storageOnly, BroadcastChannelCtor: null });
  const tabB = createCrossTabCoordinator({ tabId: 'tab-b', storage: storageOnly, BroadcastChannelCtor: null });
  assert.equal(tabA.tryClaim('evt:ita.1:1:goal1'), true);
  assert.equal(tabB.tryClaim('evt:ita.1:1:goal1'), false);
  tabA.destroy();
  tabB.destroy();

  // Page refresh simulation: new engine instance sharing storage must NOT replay existing events
  const refreshStorage = createMemoryStorage();
  let clock = 2_000_000;
  const liveMatch = {
    id: '7001',
    leagueId: 'eng.1',
    leagueName: 'الدوري الإنجليزي',
    homeTeamId: '364',
    homeTeam: 'Liverpool',
    awayTeamId: '359',
    awayTeam: 'Arsenal',
    status: 'LIVE',
    homeScore: 1,
    awayScore: 0,
    minute: '34'
  };
  const liveDetails = {
    events: [{ id: 'g-1', eventType: 'GOAL', team: 'home', teamId: '364', player: 'Salah', time: '14' }]
  };
  const prefs = { ...DEFAULT_NOTIFICATION_PREFS, enabled: true };

  const engineBeforeRefresh = createNotificationEngine({
    storage: refreshStorage,
    coordinator: createCrossTabCoordinator({ storage: refreshStorage, BroadcastChannelCtor: null, now: () => clock }),
    now: () => clock,
    getMatchDetailsFn: async () => liveDetails
  });
  await engineBeforeRefresh.processMatches([liveMatch], [{ id: '364' }], prefs);

  // Simulate full browser refresh: fresh engine instance reads persisted seen IDs
  clock += 10_000;
  const engineAfterRefresh = createNotificationEngine({
    storage: refreshStorage,
    coordinator: createCrossTabCoordinator({ storage: refreshStorage, BroadcastChannelCtor: null, now: () => clock }),
    now: () => clock,
    getMatchDetailsFn: async () => liveDetails
  });
  const afterRefreshSeed = await engineAfterRefresh.processMatches([liveMatch], [{ id: '364' }], prefs);
  assert.equal(afterRefreshSeed.length, 0);

  // Newly added favorite team (Arsenal 359) in another match seeds before alerting
  const newFavMatch = {
    id: '7002',
    leagueId: 'eng.1',
    homeTeamId: '382',
    homeTeam: 'Man City',
    awayTeamId: '363',
    awayTeam: 'Chelsea',
    status: 'LIVE',
    homeScore: 2,
    awayScore: 1,
    minute: '60'
  };
  clock += 30_000;
  const onAddFav = await engineAfterRefresh.processMatches(
    [liveMatch, newFavMatch],
    [{ id: '364' }, { id: '382' }],
    prefs
  );
  assert.equal(onAddFav.length, 0, 'newly favorited team must seed existing live match without replaying old goals');

  // Sleep / network outage recovery (> 3 minutes gap) re-baselines silently without notification flood
  clock += 240_000;
  const afterLongOutage = await engineAfterRefresh.processMatches(
    [{ ...liveMatch, homeScore: 4, awayScore: 2, status: 'FT' }],
    [{ id: '364' }, { id: '382' }],
    prefs
  );
  assert.equal(afterLongOutage.length, 0, 'long inactivity/network outage must re-baseline silently instead of flooding');
});

test('PART A3: permission handling, notification delivery (SW & window fallback + single-shot click), and optional sound player', async () => {
  // Permission states
  assert.equal(getNotificationPermissionState(undefined), 'unsupported');
  assert.equal(getNotificationPermissionState({ permission: 'denied' }), 'unsupported'); // not a constructor fn

  class MockNotifGranted {
    static permission = 'granted';
    static async requestPermission() { return 'granted'; }
    constructor(title, opts) {
      this.title = title;
      this.opts = opts;
      this.closed = false;
      this.onclick = null;
    }
    close() { this.closed = true; }
  }
  class MockNotifDefault {
    static permission = 'default';
    static async requestPermission() {
      MockNotifDefault.permission = 'granted';
      return 'granted';
    }
  }
  class MockNotifDenied {
    static permission = 'denied';
    static async requestPermission() { return 'denied'; }
  }

  assert.equal(getNotificationPermissionState(MockNotifGranted), 'granted');
  assert.equal(getNotificationPermissionState(MockNotifDenied), 'denied');
  assert.equal(await requestBrowserNotificationPermission(MockNotifDefault), 'granted');

  // Denied permission does not deliver
  const deniedDelivery = await deliverBrowserNotification(
    { eventKey: 'k1', title: 'Test', body: 'Body', url: '/match/esp.1/1' },
    { NotificationCtor: MockNotifDenied }
  );
  assert.equal(deniedDelivery.delivered, false);

  // Prefers active Service Worker registration
  let swShown = null;
  const swDelivery = await deliverBrowserNotification(
    { eventKey: 'k-sw', title: 'هدف!', body: 'برشلونة 1 - 0', url: '/match/esp.1/401882804' },
    {
      NotificationCtor: MockNotifGranted,
      serviceWorker: {
        getRegistration: async () => ({
          active: true,
          showNotification: async (title, opts) => { swShown = { title, opts }; }
        })
      }
    }
  );
  assert.equal(swDelivery.delivered, true);
  assert.equal(swDelivery.method, 'service-worker');
  assert.equal(swShown.opts.tag, 'k-sw');
  assert.equal(swShown.opts.data.url, '/match/esp.1/401882804');

  // Window Notification fallback + focus + single-shot click navigation
  let focusCount = 0;
  const navigatedUrls = [];
  const winDelivery = await deliverBrowserNotification(
    { eventKey: 'k-win', title: 'هدف!', body: 'الأهلي 2 - 1', url: '/match/egypt.1/egy-match-1' },
    {
      NotificationCtor: MockNotifGranted,
      serviceWorker: null,
      windowObj: { focus: () => { focusCount += 1; } },
      onNavigate: (url) => { navigatedUrls.push(url); }
    }
  );
  assert.equal(winDelivery.delivered, true);
  assert.equal(winDelivery.method, 'window-notification');
  winDelivery.notification.onclick({ preventDefault: () => {} });
  winDelivery.notification.onclick({ preventDefault: () => {} });
  assert.equal(focusCount, 2);
  assert.deepEqual(navigatedUrls, ['/match/egypt.1/egy-match-1'], 'click navigation must fire once without duplicate pushes');

  // Sound player: disabled by default, unlocks on gesture, throttles overlap, handles blocked/unsupported gracefully
  let soundTime = 1000;
  let oscCreated = 0;
  class MockAudioContext {
    constructor() {
      this.state = 'suspended';
      this.currentTime = 0;
      this.destination = {};
    }
    async resume() { this.state = 'running'; }
    createOscillator() {
      oscCreated += 1;
      return {
        type: 'sine',
        frequency: { setValueAtTime: () => {} },
        connect: () => {},
        start: () => {},
        stop: () => {}
      };
    }
    createGain() {
      return {
        gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
        connect: () => {}
      };
    }
  }

  const player = createNotificationSoundPlayer({
    getAudioContextClass: () => MockAudioContext,
    now: () => soundTime,
    minIntervalMs: 1200
  });

  // Disabled -> does not play
  assert.deepEqual(await player.play({ enabled: false }), { played: false, reason: 'disabled' });
  // Suspended & not yet unlocked -> blocked safely without throwing
  assert.deepEqual(await player.play({ enabled: true }), { played: false, reason: 'blocked' });
  // Unlock via user gesture -> plays cleanly
  assert.equal(await player.unlock(), true);
  assert.deepEqual(await player.play({ enabled: true }), { played: true, reason: 'ok' });
  assert.equal(oscCreated, 2);
  // Overlap prevented within cooldown
  soundTime += 300;
  assert.deepEqual(await player.play({ enabled: true }), { played: false, reason: 'throttled' });
  // After cooldown plays again
  soundTime += 1500;
  assert.deepEqual(await player.play({ enabled: true }), { played: true, reason: 'ok' });

  // Unsupported/blocked browser AudioContext never throws
  const brokenPlayer = createNotificationSoundPlayer({
    getAudioContextClass: () => { throw new Error('Audio blocked'); }
  });
  assert.deepEqual(await brokenPlayer.play({ enabled: true, force: true }), { played: false, reason: 'unsupported' });

  // Verify settings UI contains explicit user-triggered button, sound test, and open-website disclaimer (never auto-requests permission)
  const settingsSrc = readFileSync(new URL('../src/components/NotificationSettingsModal.jsx', import.meta.url), 'utf8');
  const contextSrc = readFileSync(new URL('../src/context/NotificationsContext.jsx', import.meta.url), 'utf8');
  assert.equal(settingsSrc.includes('تفعيل الإشعارات'), true);
  assert.equal(settingsSrc.includes('تجربة الصوت'), true);
  assert.equal(settingsSrc.includes('مفتوح في المتصفح'), true);
  assert.equal(contextSrc.includes('requestBrowserNotificationPermission'), true);
});

test('PART B: clickable team navigation builds verified routes/state, rejects missing IDs, cleans up scroll lock, and guards modal interaction', () => {
  assert.equal(isValidTeamNavigationId('83'), true);
  assert.equal(isValidTeamNavigationId('egy-team-ahly'), true);
  assert.equal(isValidTeamNavigationId(null), false);
  assert.equal(isValidTeamNavigationId(undefined), false);
  assert.equal(isValidTeamNavigationId('null'), false);
  assert.equal(isValidTeamNavigationId('undefined'), false);
  assert.equal(isValidTeamNavigationId('NaN'), false);
  assert.equal(isValidTeamNavigationId('   '), false);

  assert.equal(buildTeamRoute('83', 'esp.1'), '/team/83?league=esp.1');
  assert.equal(buildTeamRoute('102', 'esp.1'), '/team/102?league=esp.1');
  assert.equal(buildTeamRoute('egy-team-ahly', 'egypt.1'), '/team/egy-team-ahly?league=egypt.1');
  assert.equal(buildTeamRoute('83', ''), '/team/83');
  assert.equal(buildTeamRoute(null, 'esp.1'), null);

  assert.deepEqual(
    buildTeamNavigationState({ teamId: '83', teamName: 'Barcelona', teamLogo: 'logo.png', leagueId: 'esp.1' }),
    { leagueId: 'esp.1', team: { teamId: '83', team: 'Barcelona', logo: 'logo.png' } }
  );

  // Resolve home/away team IDs from match or fallback to details.rosters while preserving home/away association
  const matchWithoutIds = { id: '401882804', leagueId: 'esp.1', homeTeam: 'Barcelona', awayTeam: 'Villarreal' };
  const detailsWithIds = {
    rosters: {
      home: { teamId: '83', starters: [], substitutes: [] },
      away: { teamId: '102', starters: [], substitutes: [] }
    }
  };
  assert.equal(resolveMatchSideTeamId(matchWithoutIds, detailsWithIds, 'home'), '83');
  assert.equal(resolveMatchSideTeamId(matchWithoutIds, detailsWithIds, 'away'), '102');
  assert.equal(resolveMatchSideTeamId(matchWithoutIds, null, 'home'), null);

  // Body scroll lock & cleanup
  const removedClasses = [];
  const addedClasses = [];
  const mockDoc = {
    body: {
      style: { overflow: '' },
      classList: {
        add: (c) => addedClasses.push(c),
        remove: (c) => removedClasses.push(c)
      }
    },
    documentElement: { style: { overflow: 'hidden' } }
  };
  lockBodyScroll(mockDoc);
  assert.equal(mockDoc.body.style.overflow, 'hidden');
  assert.deepEqual(addedClasses, ['modal-open']);

  releaseBodyScrollLock(mockDoc);
  assert.equal(mockDoc.body.style.overflow, '');
  assert.equal(mockDoc.documentElement.style.overflow, '');
  assert.deepEqual(removedClasses, ['modal-open']);

  // Verify MatchDetailModal implements clickable team buttons, non-interactive fallback, stopPropagation, and scroll-lock release
  const modalSrc = readFileSync(new URL('../src/components/MatchDetailModal.jsx', import.meta.url), 'utf8');
  assert.equal(modalSrc.includes('details-team-link'), true);
  assert.equal(modalSrc.includes('e.stopPropagation()'), true);
  assert.equal(modalSrc.includes('releaseBodyScrollLock()'), true);
  assert.equal(modalSrc.includes('navigatingTeamRef'), true);
});

test('PART C: player match ratings strictly extract verified match ratings only and never fabricate ratings from ESPN counting stats', () => {
  // 1. Valid verified rating (direct field & stats field)
  assert.deepEqual(
    extractVerifiedPlayerRating({ matchRating: 8.4 }),
    { rating: 8.4, ratingDisplay: '8.4' }
  );
  assert.deepEqual(
    extractVerifiedPlayerRating({
      stats: [{ name: 'matchRating', value: 7.6, displayValue: '7.6' }]
    }),
    { rating: 7.6, ratingDisplay: '7.6' }
  );

  // 2. Missing, null, zero, negative, out-of-range, and NaN ratings
  assert.deepEqual(extractVerifiedPlayerRating({}), { rating: null, ratingDisplay: null });
  assert.deepEqual(extractVerifiedPlayerRating({ matchRating: null }), { rating: null, ratingDisplay: null });
  assert.deepEqual(extractVerifiedPlayerRating({ matchRating: 0 }), { rating: null, ratingDisplay: null });
  assert.deepEqual(extractVerifiedPlayerRating({ matchRating: -2 }), { rating: null, ratingDisplay: null });
  assert.deepEqual(extractVerifiedPlayerRating({ matchRating: 11.5 }), { rating: null, ratingDisplay: null });
  assert.deepEqual(extractVerifiedPlayerRating({ matchRating: 'N/A' }), { rating: null, ratingDisplay: null });

  // 3. Unrelated numeric fields (real ESPN soccer roster stats, jersey, season average, fantasy points, rank) MUST be ignored
  const realEspnPlayerEntry = {
    starter: true,
    jersey: '10',
    formationPlace: '7',
    seasonRating: 7.9,
    fantasyPoints: 8.5,
    rank: 5,
    athlete: { id: '362150', displayName: 'Lamine Yamal' },
    stats: [
      { name: 'appearances', value: 1, displayValue: '1' },
      { name: 'totalGoals', value: 2, displayValue: '2' },
      { name: 'goalAssists', value: 1, displayValue: '1' },
      { name: 'totalShots', value: 5, displayValue: '5' },
      { name: 'saves', value: 4, displayValue: '4' }
    ]
  };
  assert.deepEqual(
    extractVerifiedPlayerRating(realEspnPlayerEntry),
    { rating: null, ratingDisplay: null },
    'must never treat jersey, goals, seasonRating, fantasyPoints, or ESPN counting stats as match ratings'
  );

  // 4. Roster normalization preserves valid ratings for starters & substitutes alongside real jerseys and sub minutes, and keeps missing ratings null
  const rosters = normalizeMatchRosters({
    rosters: [
      {
        homeAway: 'home',
        team: { id: '83', displayName: 'Barcelona' },
        roster: [
          realEspnPlayerEntry,
          {
            starter: true,
            jersey: '8',
            subbedOut: true,
            matchRating: { value: 8.2, displayValue: '8.2' },
            plays: [{ clock: { displayValue: "70'" }, substitution: true }],
            position: { name: 'Central Midfielder' },
            athlete: { id: '3003', displayName: 'Pedri' }
          },
          {
            starter: false,
            jersey: '20',
            subbedIn: true,
            stats: [{ name: 'matchRating', value: 7.4, displayValue: '7.4' }],
            plays: [{ clock: { displayValue: "70'" }, substitution: true }],
            position: { name: 'Substitute' },
            athlete: { id: '3004', displayName: 'Dani Olmo' }
          },
          {
            starter: false,
            jersey: '6',
            subbedIn: false,
            position: { name: 'Substitute' },
            athlete: { id: '3005', displayName: 'Gavi' }
          }
        ]
      },
      {
        homeAway: 'away',
        team: { id: '102', displayName: 'Villarreal' },
        roster: [
          { starter: true, jersey: '25', athlete: { id: '4001', displayName: 'Peter Gulacsi' } }
        ]
      }
    ]
  }, { homeTeamId: '83', awayTeamId: '102' });

  // Starter without ESPN rating -> null
  assert.equal(rosters.home.starters[0].jersey, '10');
  assert.equal(rosters.home.starters[0].rating, null);

  // Starter with verified rating -> preserved with jersey and subOutMinute
  assert.equal(rosters.home.starters[1].jersey, '8');
  assert.equal(rosters.home.starters[1].rating, 8.2);
  assert.equal(rosters.home.starters[1].ratingDisplay, '8.2');
  assert.equal(rosters.home.starters[1].subOutMinute, '70');

  // Substitute with verified rating -> preserved with jersey and subInMinute
  assert.equal(rosters.home.substitutes[0].jersey, '20');
  assert.equal(rosters.home.substitutes[0].rating, 7.4);
  assert.equal(rosters.home.substitutes[0].subInMinute, '70');

  // Unused substitute without rating -> null
  assert.equal(rosters.home.substitutes[1].rating, null);

  // UI conditional check: never renders fake 0.0 or N/A
  const modalSrc = readFileSync(new URL('../src/components/MatchDetailModal.jsx', import.meta.url), 'utf8');
  assert.equal(modalSrc.includes('player.rating !== null && player.rating !== undefined'), true);
  assert.equal(modalSrc.includes('0.0'), false);
  assert.equal(modalSrc.includes('N/A'), false);
});

test('LIVE PHASES: First Half (45+4) -> Half-Time (HT) -> Second Half -> Extra Time -> Penalties -> Full-Time, stale/delayed updates, visibility recovery, and no duplicate notifications', async () => {
  // 1. 45+4 during active First Half MUST NOT be inferred as Half-Time!
  const firstHalfStoppageStatus = {
    clock: 2940,
    displayClock: "45'+4'",
    period: 1,
    type: { id: '25', name: 'STATUS_FIRST_HALF', state: 'in', completed: false, description: 'First Half', detail: "45'+4'", shortDetail: "45'+4'" }
  };
  assert.equal(resolveEspnMatchPhase(firstHalfStoppageStatus), MATCH_PHASES.FIRST_HALF);

  const [fhMatch] = normalizeScoreboardMatches({
    events: [{
      id: '401882804',
      date: '2026-11-22T15:15:00Z',
      status: firstHalfStoppageStatus,
      competitions: [{
        competitors: [
          { homeAway: 'home', score: '0', team: { id: '83', displayName: 'Barcelona' } },
          { homeAway: 'away', score: '2', team: { id: '102', displayName: 'Villarreal' } }
        ]
      }]
    }]
  }, { id: 'esp.1', name: 'الدوري الإسباني', logo: '' }, '20261122');

  assert.equal(fhMatch.status, 'LIVE');
  assert.equal(fhMatch.matchPhase, MATCH_PHASES.FIRST_HALF);
  assert.equal(fhMatch.isHalfTime, false);
  assert.equal(fhMatch.minute, '45+4');
  assert.equal(isHalfTimePhase(fhMatch), false);
  const fhDisplay = getLiveMatchDisplay(fhMatch);
  assert.equal(fhDisplay.isHalfTime, false);
  assert.equal(fhDisplay.isRunningClock, true);
  assert.equal(fhDisplay.badgeText, '45+4 د');
  assert.equal(fhDisplay.statusLabel, 'جارية الآن');

  // 2. Verified ESPN Half-Time (even if displayClock still lingers at 45'+4'!) -> HT + استراحة بين الشوطين + preserved 0-2 score + no running clock
  const halftimeStatus = {
    clock: 2700,
    displayClock: "45'+4'",
    period: 1,
    type: { id: '22', name: 'STATUS_HALFTIME', state: 'in', completed: false, description: 'Halftime', detail: 'HT', shortDetail: 'HT' }
  };
  assert.equal(resolveEspnMatchPhase(halftimeStatus), MATCH_PHASES.HALFTIME);

  const [htMatch] = normalizeScoreboardMatches({
    events: [{
      id: '401882804',
      date: '2026-11-22T15:15:00Z',
      status: halftimeStatus,
      competitions: [{
        competitors: [
          { homeAway: 'home', score: '0', team: { id: '83', displayName: 'Barcelona' } },
          { homeAway: 'away', score: '2', team: { id: '102', displayName: 'Villarreal' } }
        ]
      }]
    }]
  }, { id: 'esp.1', name: 'الدوري الإسباني', logo: '' }, '20261122');

  assert.equal(htMatch.status, 'LIVE');
  assert.equal(htMatch.matchPhase, MATCH_PHASES.HALFTIME);
  assert.equal(htMatch.isHalfTime, true);
  assert.equal(htMatch.minute, 'HT');
  assert.equal(htMatch.homeScore, 0);
  assert.equal(htMatch.awayScore, 2);
  const htDisplay = getLiveMatchDisplay(htMatch);
  assert.equal(htDisplay.isHalfTime, true);
  assert.equal(htDisplay.isRunningClock, false);
  assert.equal(htDisplay.shortBadge, 'HT');
  assert.equal(htDisplay.badgeText, 'استراحة بين الشوطين');
  assert.equal(htDisplay.statusLabel, 'استراحة بين الشوطين');
  assert.equal(getFavoriteMatchDisplay(htMatch).statusLabel, 'استراحة بين الشوطين (HT)');

  // 3. Half-Time -> Second Half resumes live clock and indicator
  const secondHalfStatus = {
    clock: 3000,
    displayClock: "50'",
    period: 2,
    type: { id: '26', name: 'STATUS_SECOND_HALF', state: 'in', completed: false, description: 'Second Half', detail: "50'", shortDetail: "50'" }
  };
  const [shMatch] = normalizeScoreboardMatches({
    events: [{
      id: '401882804',
      date: '2026-11-22T15:15:00Z',
      status: secondHalfStatus,
      competitions: [{
        competitors: [
          { homeAway: 'home', score: '0', team: { id: '83', displayName: 'Barcelona' } },
          { homeAway: 'away', score: '2', team: { id: '102', displayName: 'Villarreal' } }
        ]
      }]
    }]
  }, { id: 'esp.1', name: 'الدوري الإسباني', logo: '' }, '20261122');

  assert.equal(shMatch.matchPhase, MATCH_PHASES.SECOND_HALF);
  assert.equal(shMatch.isHalfTime, false);
  assert.equal(shMatch.minute, '50');
  const shDisplay = getLiveMatchDisplay(shMatch);
  assert.equal(shDisplay.isRunningClock, true);
  assert.equal(shDisplay.badgeText, '50 د');
  assert.equal(shDisplay.statusLabel, 'جارية الآن');

  // 4. Extra time, ET Half-Time, Penalty Shootout, Full-Time, AET, PEN, and Postponed
  assert.equal(resolveEspnMatchPhase({ period: 3, type: { name: 'STATUS_FIRST_HALF_EXTRA_TIME', state: 'in' } }), MATCH_PHASES.EXTRA_TIME_FIRST_HALF);
  assert.equal(resolveEspnMatchPhase({ period: 3, type: { name: 'STATUS_HALFTIME_ET', state: 'in', detail: 'HT ET' } }), MATCH_PHASES.EXTRA_TIME_HALFTIME);
  assert.equal(resolveEspnMatchPhase({ period: 4, type: { name: 'STATUS_SECOND_HALF_EXTRA_TIME', state: 'in' } }), MATCH_PHASES.EXTRA_TIME_SECOND_HALF);
  assert.equal(resolveEspnMatchPhase({ period: 5, type: { name: 'STATUS_SHOOTOUT', state: 'in', detail: 'PEN' } }), MATCH_PHASES.PENALTIES);
  assert.equal(resolveEspnMatchPhase({ type: { name: 'STATUS_FULL_TIME', state: 'post', completed: true } }), MATCH_PHASES.FULL_TIME);
  assert.equal(resolveEspnMatchPhase({ type: { name: 'STATUS_FINAL_AET', state: 'post', completed: true } }), MATCH_PHASES.FULL_TIME);
  assert.equal(resolveEspnMatchPhase({ type: { name: 'STATUS_FINAL_PEN', state: 'post', completed: true } }), MATCH_PHASES.FULL_TIME);
  assert.equal(resolveEspnMatchPhase({ type: { name: 'STATUS_POSTPONED', state: 'post', completed: false } }), MATCH_PHASES.POSTPONED);

  // 5. forceRefresh bypasses browser HTTP cache with cache: 'no-store'
  const receivedOpts = [];
  const cacheGetter = createRequestCache({
    fetcher: async (_url, opts) => {
      receivedOpts.push(opts);
      return { ok: true, json: async () => ({ v: receivedOpts.length }) };
    }
  });
  await cacheGetter('https://example.test/live', { ttl: 15000, forceRefresh: false });
  await cacheGetter('https://example.test/live', { ttl: 15000, forceRefresh: true });
  assert.equal(receivedOpts[0].cache, undefined);
  assert.equal(receivedOpts[1].cache, 'no-store');

  // 6. Delayed ESPN transition + background tab visibility recovery in subscribeToLiveMatches
  const originalFetch = globalThis.fetch;
  let apiPhase = 'first_half';
  let fakeNow = 100_000;
  const listeners = { visibilitychange: [], online: [] };
  const mockDoc = {
    visibilityState: 'visible',
    addEventListener: (ev, fn) => listeners[ev]?.push(fn),
    removeEventListener: (ev, fn) => {
      if (listeners[ev]) listeners[ev] = listeners[ev].filter(f => f !== fn);
    }
  };
  const mockWin = {
    addEventListener: (ev, fn) => listeners[ev]?.push(fn),
    removeEventListener: (ev, fn) => {
      if (listeners[ev]) listeners[ev] = listeners[ev].filter(f => f !== fn);
    }
  };

  let pollTick = null;
  const snapshots = [];
  globalThis.fetch = async (url) => {
    if (String(url).includes('/esp.1/scoreboard')) {
      const status = apiPhase === 'first_half'
        ? firstHalfStoppageStatus
        : apiPhase === 'halftime'
        ? halftimeStatus
        : secondHalfStatus;
      return {
        ok: true,
        json: async () => ({
          events: [{
            id: '401882804',
            date: '2026-11-22T15:15:00Z',
            status,
            competitions: [{
              competitors: [
                { homeAway: 'home', score: '0', team: { id: '83', displayName: 'Barcelona' } },
                { homeAway: 'away', score: '2', team: { id: '102', displayName: 'Villarreal' } }
              ]
            }]
          }]
        })
      };
    }
    return { ok: true, json: async () => ({ events: [] }) };
  };

  try {
    const unsub = subscribeToLiveMatches((m) => snapshots.push(m), {
      dateStr: '20261122',
      setIntervalFn: (fn) => { pollTick = fn; return 777; },
      clearIntervalFn: () => { pollTick = null; },
      documentObj: mockDoc,
      windowObj: mockWin,
      now: () => fakeNow,
      visibilityCooldownMs: 5000
    });

    // Initial tick: still 45+4 (First Half)
    await pollTick();
    assert.equal(snapshots.length, 1);
    assert.equal(snapshots[0][0].matchPhase, MATCH_PHASES.FIRST_HALF);

    // Tab hidden while ESPN transitions to Half-Time; returning to visible tab after cooldown triggers immediate refresh!
    mockDoc.visibilityState = 'hidden';
    apiPhase = 'halftime';
    fakeNow += 10_000;
    mockDoc.visibilityState = 'visible';
    listeners.visibilitychange.forEach(fn => fn());
    await new Promise(r => setTimeout(r, 20));
    assert.equal(snapshots.length, 2);
    assert.equal(snapshots[1][0].matchPhase, MATCH_PHASES.HALFTIME);
    assert.equal(snapshots[1][0].minute, 'HT');

    // Second Half update after online recovery
    apiPhase = 'second_half';
    fakeNow += 10_000;
    listeners.online.forEach(fn => fn());
    await new Promise(r => setTimeout(r, 20));
    assert.equal(snapshots.length, 3);
    assert.equal(snapshots[2][0].matchPhase, MATCH_PHASES.SECOND_HALF);
    assert.equal(snapshots[2][0].minute, '50');

    unsub();
    assert.equal(listeners.visibilitychange.length, 0, 'visibilitychange listener must be cleaned up');
    assert.equal(listeners.online.length, 0, 'online listener must be cleaned up');
  } finally {
    globalThis.fetch = originalFetch;
  }

  // 7. No duplicate kickoff, half-time, or full-time notifications across noisy/delayed transitions
  const notifStorage = createMemoryStorage();
  let t = 5_000_000;
  const engine = createNotificationEngine({
    storage: notifStorage,
    coordinator: createCrossTabCoordinator({ storage: notifStorage, BroadcastChannelCtor: null, now: () => t }),
    now: () => t,
    getMatchDetailsFn: async () => ({ events: [] })
  });
  const prefs = {
    enabled: true,
    soundEnabled: false,
    events: { goals: true, kickoff: true, fullTime: true, redCards: true, penalties: true, halfTime: true }
  };
  const fav = [{ id: '83', name: 'Barcelona' }];
  const nsMatch = { ...fhMatch, status: 'NS', matchPhase: MATCH_PHASES.SCHEDULED, isHalfTime: false, homeScore: null, awayScore: null, minute: 0 };

  assert.equal((await engine.processMatches([nsMatch], fav, prefs)).length, 0);
  t += 30_000;
  assert.deepEqual((await engine.processMatches([fhMatch], fav, prefs)).map(n => n.kind), ['KICKOFF', 'GOAL']);
  // Stale/flickering 45+4 MUST NOT trigger half-time
  t += 30_000;
  assert.equal((await engine.processMatches([fhMatch], fav, prefs)).length, 0);
  // Real Half-Time triggers HALF_TIME exactly once
  t += 30_000;
  assert.deepEqual((await engine.processMatches([htMatch], fav, prefs)).map(n => n.kind), ['HALF_TIME']);
  // Flicker back to stale 45+4 then HT again MUST NOT emit duplicate HALF_TIME or KICKOFF
  t += 30_000;
  assert.equal((await engine.processMatches([fhMatch], fav, prefs)).length, 0);
  t += 30_000;
  assert.equal((await engine.processMatches([htMatch], fav, prefs)).length, 0);
  // Second half -> Full-Time emits FULL_TIME once
  t += 30_000;
  assert.equal((await engine.processMatches([shMatch], fav, prefs)).length, 0);
  const ftMatch = { ...shMatch, status: 'FT', matchPhase: MATCH_PHASES.FULL_TIME, isHalfTime: false, minute: '90' };
  t += 30_000;
  assert.deepEqual((await engine.processMatches([ftMatch], fav, prefs)).map(n => n.kind), ['FULL_TIME']);
  t += 30_000;
  assert.equal((await engine.processMatches([ftMatch], fav, prefs)).length, 0);
});
