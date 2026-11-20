import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseMatchResult,
  finishedMatchLabel,
  getFavoriteMatchDisplay,
  resolveEspnMatchStatus,
  isUnplayedMatchStatus,
  getMatchStatusLabel,
  getTeamMatchOutcome
} from '../src/services/matchResult.js';
import { normalizeScoreboardMatches } from '../src/services/matchesService.js';
import { getTournamentKnockouts } from '../src/services/knockoutsService.js';
import { buildBracket } from '../src/services/bracketLayout.js';

test('ordinary draw is not inferred to be extra time or penalties',()=>{
 const result=parseMatchResult({type:{state:'post',name:'STATUS_FULL_TIME'}},[]);
 assert.equal(result.finishType,'regular');
 assert.equal(finishedMatchLabel(result),'انتهت');
});
test('extra time is explicit, including a non-drawn result',()=>{
 const result=parseMatchResult({type:{state:'post',name:'STATUS_FINAL_AET'}},[]);
 assert.equal(finishedMatchLabel(result),'انتهت بعد الأشواط الإضافية');
});
test('penalty scores preserve home/away order and zero',()=>{
 const result=parseMatchResult({type:{state:'post',name:'STATUS_FINAL_PEN'}},[{homeAway:'away',shootoutScore:{value:3},winner:true},{homeAway:'home',shootoutScore:0}]);
 assert.equal(result.homePenalties,0);
 assert.equal(result.awayPenalties,3);
 assert.equal(result.awayWinner,true);
 assert.match(finishedMatchLabel(result),/0 - 3/);
});
test('missing shootout scores are never invented as 0-0',()=>{
 const result=parseMatchResult({type:{state:'post',detail:'FT-Pens'}},[]);
 assert.equal(result.homePenalties,null);
 assert.equal(finishedMatchLabel(result),'انتهت بركلات الترجيح');
});
test('ongoing shootout is not marked as a finished match',()=>{
 assert.equal(parseMatchResult({type:{state:'in',description:'Penalties'}},[]).finishType,null);
});
test('favorites match display shows VS and kickoff time for NS and UPCOMING matches instead of 0 - 0',()=>{
 const nsMatch = getFavoriteMatchDisplay({ status: 'NS', time: '22:00', homeScore: 0, awayScore: 0, leagueId: 'eng.1' });
 assert.equal(nsMatch.isUpcoming, true);
 assert.equal(nsMatch.centerText, 'VS');
 assert.equal(nsMatch.statusLabel, '22:00');

 const upcomingMatch = getFavoriteMatchDisplay({ status: 'UPCOMING', time: '19:30', homeScore: 0, awayScore: 0, leagueId: 'esp.1' });
 assert.equal(upcomingMatch.isUpcoming, true);
 assert.equal(upcomingMatch.centerText, 'VS');
 assert.equal(upcomingMatch.statusLabel, '19:30');

 const nsWithoutTime = getFavoriteMatchDisplay({ status: 'NS', time: '', homeScore: 0, awayScore: 0, leagueId: 'eng.1' });
 assert.equal(nsWithoutTime.isUpcoming, true);
 assert.equal(nsWithoutTime.centerText, 'VS');
 assert.equal(nsWithoutTime.statusLabel, 'قادمة');
});
test('favorites match display preserves scores and labels for LIVE, FT, AET and PEN matches',()=>{
 const liveMatch = getFavoriteMatchDisplay({ status: 'LIVE', minute: '64', homeScore: 2, awayScore: 1, leagueId: 'eng.1' });
 assert.equal(liveMatch.isUpcoming, false);
 assert.equal(liveMatch.isLive, true);
 assert.equal(liveMatch.centerText, '2 - 1');
 assert.equal(liveMatch.statusLabel, 'مباشر • 64');

 const ftMatch = getFavoriteMatchDisplay({ status: 'FT', finishType: 'regular', homeScore: 3, awayScore: 0, leagueId: 'eng.1' });
 assert.equal(ftMatch.isUpcoming, false);
 assert.equal(ftMatch.centerText, '3 - 0');
 assert.equal(ftMatch.statusLabel, 'انتهت');

 const aetMatch = getFavoriteMatchDisplay({ status: 'FT', finishType: 'extra-time', homeScore: 2, awayScore: 1, leagueId: 'uefa.champions' });
 assert.equal(aetMatch.centerText, '2 - 1');
 assert.equal(aetMatch.statusLabel, 'انتهت بعد الأشواط الإضافية');

 const penMatch = getFavoriteMatchDisplay({ status: 'FT', finishType: 'penalties', homeScore: 1, awayScore: 1, homePenalties: 5, awayPenalties: 4, leagueId: 'fifa.world' });
 assert.equal(penMatch.centerText, '1 - 1');
 assert.match(penMatch.statusLabel, /انتهت بركلات الترجيح/);
 assert.match(penMatch.statusLabel, /5 - 4/);
});

test('resolveEspnMatchStatus safely handles ESPN 2027 postponed payload, cancelled, abandoned, suspended, and completed=false', () => {
  // Exact live ESPN 2027 AFC Asian Cup anomalous payload
  const espn2027Postponed = {
    type: {
      id: '6',
      name: 'STATUS_POSTPONED',
      state: 'post',
      completed: false,
      description: 'Postponed',
      detail: 'Postponed',
      shortDetail: 'Postponed'
    }
  };
  assert.equal(resolveEspnMatchStatus(espn2027Postponed), 'POSTPONED');
  assert.equal(isUnplayedMatchStatus('POSTPONED'), true);
  assert.equal(getMatchStatusLabel({ status: 'POSTPONED' }), 'مؤجلة');

  // Cancelled / Canceled, Abandoned, Suspended — even with state: 'post'
  assert.equal(resolveEspnMatchStatus({ type: { name: 'STATUS_CANCELED', state: 'post', completed: false } }), 'CANCELLED');
  assert.equal(resolveEspnMatchStatus({ type: { description: 'Cancelled', state: 'post', completed: false } }), 'CANCELLED');
  assert.equal(resolveEspnMatchStatus({ type: { name: 'STATUS_ABANDONED', state: 'post', completed: false } }), 'ABANDONED');
  assert.equal(resolveEspnMatchStatus({ type: { name: 'STATUS_SUSPENDED', state: 'post', completed: false } }), 'SUSPENDED');
  assert.equal(getMatchStatusLabel({ status: 'CANCELLED' }), 'ملغاة');
  assert.equal(getMatchStatusLabel({ status: 'ABANDONED' }), 'متوقفة');
  assert.equal(getMatchStatusLabel({ status: 'SUSPENDED' }), 'معلّقة');

  // Generic state: 'post' with completed: false must NEVER become FT
  assert.equal(resolveEspnMatchStatus({ type: { state: 'post', completed: false } }), 'NS');

  // Legitimate NS, LIVE, FT, AET, PEN
  assert.equal(resolveEspnMatchStatus({ type: { state: 'pre', completed: false } }), 'NS');
  assert.equal(resolveEspnMatchStatus({ type: { state: 'in', completed: false } }), 'LIVE');
  assert.equal(resolveEspnMatchStatus({ type: { state: 'post', completed: true, name: 'STATUS_FULL_TIME' } }), 'FT');
  assert.equal(resolveEspnMatchStatus({ type: { state: 'post', completed: true, name: 'STATUS_FINAL_AET' } }), 'FT');
  assert.equal(resolveEspnMatchStatus({ type: { state: 'post', completed: true, name: 'STATUS_FINAL_PEN' } }), 'FT');
});

test('normalizeScoreboardMatches suppresses placeholder 0-0 for postponed/scheduled fixtures while preserving real 0-0 draws and live scores', () => {
  const league = { id: 'afc.asian.cup', name: 'كأس آسيا', logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/2243.png' };
  const matches = normalizeScoreboardMatches({
    leagues: [{}],
    events: [
      {
        id: '401872238',
        date: '2027-01-07T17:00Z',
        season: { year: 2027, slug: 'group-stage' },
        status: { type: { name: 'STATUS_POSTPONED', state: 'post', completed: false, description: 'Postponed', detail: 'Postponed' } },
        competitions: [{
          competitors: [
            { homeAway: 'home', score: '0', winner: false, team: { id: '655', displayName: 'Saudi Arabia' } },
            { homeAway: 'away', score: '0', winner: false, team: { id: '6167', displayName: 'Palestine' } }
          ]
        }]
      },
      {
        id: 'real-0-0',
        date: '2024-01-15T15:00Z',
        season: { year: 2023, slug: 'group-stage' },
        status: { type: { name: 'STATUS_FULL_TIME', state: 'post', completed: true, description: 'Full Time' } },
        competitions: [{
          competitors: [
            { homeAway: 'home', score: '0', winner: false, team: { id: '655', displayName: 'Saudi Arabia' } },
            { homeAway: 'away', score: '0', winner: false, team: { id: '2841', displayName: 'Oman' } }
          ]
        }]
      },
      {
        id: 'live-game',
        date: '2026-11-20T18:00Z',
        status: { displayClock: "62'", type: { name: 'STATUS_IN_PROGRESS', state: 'in', completed: false } },
        competitions: [{
          competitors: [
            { homeAway: 'home', score: '1', team: { id: '10', displayName: 'Home Live' } },
            { homeAway: 'away', score: '2', team: { id: '20', displayName: 'Away Live' } }
          ]
        }]
      }
    ]
  }, league, '20270107');

  // 2027 postponed match: NOT FT, suppressed null scores, no finishType, no winner, no team outcome, VS in favorite display
  const postponed = matches[0];
  assert.equal(postponed.status, 'POSTPONED');
  assert.equal(postponed.homeScore, null);
  assert.equal(postponed.awayScore, null);
  assert.equal(postponed.finishType, null);
  assert.equal(postponed.homeWinner, false);
  assert.equal(postponed.awayWinner, false);
  assert.equal(getTeamMatchOutcome(postponed, '655'), null);
  assert.equal(getFavoriteMatchDisplay(postponed).centerText, 'VS');
  assert.equal(getFavoriteMatchDisplay(postponed).statusLabel, 'مؤجلة');

  // Legitimate completed 0-0 draw preserved
  const realDraw = matches[1];
  assert.equal(realDraw.status, 'FT');
  assert.equal(realDraw.homeScore, 0);
  assert.equal(realDraw.awayScore, 0);
  assert.equal(realDraw.finishType, 'regular');
  assert.equal(getTeamMatchOutcome(realDraw, '655'), 'draw');

  // Valid live match preserved
  const live = matches[2];
  assert.equal(live.status, 'LIVE');
  assert.equal(live.homeScore, 1);
  assert.equal(live.awayScore, 2);
});

test('knockout matches with POSTPONED or SUSPENDED status never become FT, suppress placeholder scores, and cannot advance teams', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const str = String(url);
    if (str.includes('dates=2027')) {
      return {
        ok: true,
        json: async () => ({
          events: [
            {
              id: 'ko-postponed',
              season: { year: 2027, slug: 'round-of-16' },
              date: '2027-01-24T15:00Z',
              status: { type: { name: 'STATUS_POSTPONED', state: 'post', completed: false, detail: 'Postponed' } },
              competitions: [{
                competitors: [
                  { homeAway: 'home', score: '0', winner: true, team: { id: '655', displayName: 'Saudi Arabia' } },
                  { homeAway: 'away', score: '0', winner: false, team: { id: '627', displayName: 'Japan' } }
                ]
              }]
            },
            {
              id: 'ko-suspended',
              season: { year: 2027, slug: 'quarterfinals' },
              date: '2027-01-29T15:00Z',
              status: { type: { name: 'STATUS_SUSPENDED', state: 'post', completed: false, detail: 'Suspended' } },
              competitions: [{
                competitors: [
                  { homeAway: 'home', score: '0', winner: false, team: { id: '655', displayName: 'Saudi Arabia' } },
                  { homeAway: 'away', score: '0', winner: false, team: { id: '4398', displayName: 'Qatar' } }
                ]
              }]
            }
          ]
        })
      };
    }
    return { ok: true, json: async () => ({ events: [] }) };
  };

  try {
    const ko = await getTournamentKnockouts('afc.asian.cup', 2027);
    assert.equal(ko.r16[0].status, 'POSTPONED');
    assert.equal(ko.r16[0].homeScore, null);
    assert.equal(ko.r16[0].awayScore, null);
    assert.equal(ko.r16[0].homeWinner, false);
    assert.equal(ko.r16[0].awayWinner, false);
    assert.equal(ko.r16[0].finishType, null);

    assert.equal(ko.qf[0].status, 'SUSPENDED');
    assert.equal(ko.qf[0].homeScore, null);
    assert.equal(ko.qf[0].homeWinner, false);

    // Bracket must not declare any winner from postponed/suspended matches
    const bracket = buildBracket(ko);
    for (const node of bracket.nodes) {
      assert.equal(node.match.homeWinner, false);
      assert.equal(node.match.awayWinner, false);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});
