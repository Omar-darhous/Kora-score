import { finishedMatchLabel, isUnplayedMatchStatus, getMatchStatusLabel, getLiveMatchDisplay } from '../services/matchResult';
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { X, Award, BarChart2, Users, Clock, Activity, Shield } from 'lucide-react';
import { EgyptianDisclaimer, EgyptianBadge } from './EgyptianDisclaimer';
import {
  buildTeamRoute,
  buildTeamNavigationState,
  resolveMatchSideTeamId,
  lockBodyScroll,
  releaseBodyScrollLock
} from '../utils/teamNavigation';

const MatchDetailModal = ({ match, details, loading, onClose, isStandalone = false }) => {
  const [activeTab, setActiveTab] = useState('stats');
  const navigate = useNavigate();
  const navigatingTeamRef = useRef(false);

  useEffect(() => {
    if (isStandalone) return undefined;
    lockBodyScroll();
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        releaseBodyScrollLock();
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      releaseBodyScrollLock();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isStandalone, onClose]);

  if (!match) return null;
  if (details?.match && String(details.match.id) === String(match.id)) {
    match = { ...match, ...details.match };
  }

  const homeTeamId = resolveMatchSideTeamId(match, details, 'home');
  const awayTeamId = resolveMatchSideTeamId(match, details, 'away');
  const homeTeamRoute = buildTeamRoute(homeTeamId, match.leagueId);
  const awayTeamRoute = buildTeamRoute(awayTeamId, match.leagueId);

  const handleTeamNavigate = (e, { teamId, teamName, teamLogo, route }) => {
    e.preventDefault();
    e.stopPropagation();
    if (!route || navigatingTeamRef.current) return;
    navigatingTeamRef.current = true;
    releaseBodyScrollLock();
    navigate(route, {
      state: buildTeamNavigationState({
        teamId,
        teamName,
        teamLogo,
        leagueId: match.leagueId
      })
    });
  };

  const stats = details?.stats || {
    possession: [50, 50],
    shots: [0, 0],
    shotsOnGoal: [0, 0],
    corners: [0, 0],
    fouls: [0, 0],
    yellowCards: [0, 0],
    redCards: [0, 0]
  };

  const statItems = [
    { label: 'نسبة الاستحواذ %', key: 'possession' },
    { label: 'إجمالي التسديدات', key: 'shots' },
    { label: 'التسديدات على المرمى', key: 'shotsOnGoal' },
    { label: 'الضربات الركنية', key: 'corners' },
    { label: 'الأخطاء المرتكبة', key: 'fouls' },
    { label: 'البطاقات الصفراء', key: 'yellowCards' },
    { label: 'البطاقات الحمراء', key: 'redCards' }
  ];

  const events = details?.events || [];
  const lineups = details?.lineups || { home: [], away: [] };
  const rosters = details?.rosters || null;

  const toPlayerObjects = (rosterPlayers, fallbackNames) => {
    if (Array.isArray(rosterPlayers) && rosterPlayers.length > 0) {
      return rosterPlayers;
    }
    return (fallbackNames || []).map((name, idx) => ({
      id: `fallback-${idx}`,
      name,
      jersey: null,
      position: '',
      starter: true,
      subbedIn: false,
      subbedOut: false,
      subInMinute: null,
      subOutMinute: null
    }));
  };

  const homeStarters = toPlayerObjects(rosters?.home?.starters, lineups.home);
  const awayStarters = toPlayerObjects(rosters?.away?.starters, lineups.away);
  const homeSubstitutes = rosters?.home?.substitutes || details?.substitutes?.home || [];
  const awaySubstitutes = rosters?.away?.substitutes || details?.substitutes?.away || [];
  const hasAnyLineups = homeStarters.length > 0 || awayStarters.length > 0 || homeSubstitutes.length > 0 || awaySubstitutes.length > 0;
  const hasAnySubstitutes = homeSubstitutes.length > 0 || awaySubstitutes.length > 0;

  const getEventPresentation = (event) => {
    const code = event.eventType || (
      event.type === 'goal' ? 'GOAL' :
        event.type === 'penalty_missed' ? 'PENALTY_MISSED' :
          event.type === 'penalty_saved' ? 'PENALTY_SAVED' :
            event.type === 'substitution' ? 'SUBSTITUTION' :
              event.type === 'var' ? 'VAR_DECISION' :
                event.type === 'card' && event.cardType === 'second_yellow' ? 'SECOND_YELLOW_RED' :
                  event.type === 'card' && event.cardType === 'red' ? 'RED_CARD' :
                    event.type === 'card' ? 'YELLOW_CARD' : ''
    );

    switch (code) {
      case 'GOAL':
        return { icon: '⚽', label: event.label || 'هدف', variant: 'goal' };
      case 'PENALTY_GOAL':
        return { icon: '⚽', label: event.label || 'هدف من ركلة جزاء', variant: 'goal' };
      case 'OWN_GOAL':
        return { icon: '⚽', label: event.label || 'هدف عكسي', variant: 'own-goal' };
      case 'PENALTY_MISSED':
        return { icon: '❌', label: event.label || 'ركلة جزاء ضائعة', variant: 'penalty-missed' };
      case 'PENALTY_SAVED':
        return { icon: '🧤', label: event.label || 'ركلة جزاء متصدى لها', variant: 'penalty-saved' };
      case 'YELLOW_CARD':
        return { icon: '🟨', label: event.label || 'بطاقة صفراء', variant: 'yellow-card' };
      case 'SECOND_YELLOW_RED':
        return { icon: '🟨🟥', label: event.label || 'بطاقة حمراء (إنذار ثانٍ)', variant: 'red-card' };
      case 'RED_CARD':
        return { icon: '🟥', label: event.label || 'بطاقة حمراء', variant: 'red-card' };
      case 'SUBSTITUTION':
        return { icon: '🔄', label: event.label || 'تبديل', variant: 'substitution' };
      case 'VAR_DECISION':
        return { icon: '📺', label: event.label || 'قرار تقنية الفيديو (VAR)', variant: 'var' };
      default:
        return { icon: '•', label: event.label || '', variant: 'default' };
    }
  };

  const renderEventContent = (event, align) => {
    const meta = getEventPresentation(event);
    const isSub = event.eventType === 'SUBSTITUTION' || event.type === 'substitution';
    const isVar = event.eventType === 'VAR_DECISION' || event.type === 'var';
    const showBadgeLabel = meta.variant !== 'goal' || event.eventType === 'PENALTY_GOAL';

    return (
      <div className={`match-event-card align-${align} variant-${meta.variant}`}>
        <div className="match-event-main">
          <span className="match-event-icon" aria-hidden="true">{meta.icon}</span>
          {isSub ? (
            <div className="match-event-sub-pair">
              {event.playerIn && (
                <span className="match-event-sub-in">
                  <span className="sub-dir-tag in">دخول</span>
                  <span>{event.playerIn}</span>
                </span>
              )}
              {event.playerOut && (
                <span className="match-event-sub-out">
                  <span className="sub-dir-tag out">خروج</span>
                  <span>{event.playerOut}</span>
                </span>
              )}
              {!event.playerIn && !event.playerOut && (
                <span className="match-event-player">{event.player || meta.label}</span>
              )}
            </div>
          ) : isVar ? (
            <div className="match-event-text-block">
              <span className="match-event-player">{meta.label}</span>
              {(event.detail || event.player) && (
                <span className="match-event-subtext">{event.detail || event.player}</span>
              )}
            </div>
          ) : (
            <div className="match-event-text-block">
              <span className="match-event-player">{event.player || meta.label}</span>
              <div className="match-event-meta-row">
                {showBadgeLabel && meta.label && (
                  <span className={`match-event-tag variant-${meta.variant}`}>{meta.label}</span>
                )}
                {event.assist && event.assist !== 'مجهود فردي' && (
                  <span className="match-event-subtext">صناعة: {event.assist}</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderLineupList = (players, { emptyText, isBench = false }) => {
    if (!players || players.length === 0) {
      return <p className="lineup-empty-note">{emptyText}</p>;
    }
    return (
      <ul className="lineup-player-list">
        {players.map((player, idx) => {
          const hasRealJersey = player.jersey !== null && player.jersey !== undefined && String(player.jersey).trim() !== '';
          const enteredMatch = isBench && Boolean(player.subbedIn || player.subInMinute);
          return (
            <li
              key={player.id || `${player.name}-${idx}`}
              className={`lineup-player-row ${enteredMatch ? 'is-subbed-in' : ''}`}
            >
              <span
                className={`lineup-jersey-badge ${hasRealJersey ? '' : 'is-missing'}`}
                title={hasRealJersey ? `رقم القميص ${player.jersey}` : 'رقم القميص غير متاح'}
              >
                <bdi>{hasRealJersey ? player.jersey : '—'}</bdi>
              </span>
              <div className="lineup-player-info">
                <span className="lineup-player-name">{player.name}</span>
                {player.position && (
                  <span className="lineup-player-pos">{player.position}</span>
                )}
              </div>
              <div className="lineup-player-badges">
                {player.rating !== null && player.rating !== undefined && (
                  <span
                    className="lineup-rating-badge"
                    aria-label={`تقييم المباراة ${player.ratingDisplay || Number(player.rating).toFixed(1)}`}
                    title={`تقييم المباراة: ${player.ratingDisplay || Number(player.rating).toFixed(1)}`}
                  >
                    <bdi>{player.ratingDisplay || Number(player.rating).toFixed(1)}</bdi>
                  </span>
                )}
                {player.subbedOut && (
                  <span className="lineup-sub-badge out" title="خرج من الملعب">
                    ↙ {player.subOutMinute ? <bdi>{player.subOutMinute}′</bdi> : 'خروج'}
                  </span>
                )}
                {player.subbedIn && (
                  <span className="lineup-sub-badge in" title="شارك كبديل">
                    ↗ {player.subInMinute ? <bdi>{player.subInMinute}′</bdi> : 'دخول'}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    );
  };

  const isEgyptian = match?.leagueId === 'egypt.1' || String(match?.id).startsWith('egy-');

  const modalInner = (
    <>
      {/* Modal / Standalone Top Bar */}
      <div className="modal-header">
        <div className="d-flex align-center gap-1">
          <Shield size={18} color="var(--primary)" />
          <span className="modal-title">{match.leagueName || 'مركز المباراة'}</span>
          {isEgyptian && <EgyptianBadge style={{ marginRight: 6 }} />}
        </div>
        {onClose && (
          <button
            type="button"
            className="close-modal-btn"
            onClick={onClose}
            aria-label="إغلاق"
          >
            <X size={20} />
          </button>
        )}
      </div>

      <div className="modal-body" style={{ padding: 0 }}>
        {/* Match Scoreboard Header */}
        <div className="details-header">
          {/* Home Team */}
          {homeTeamRoute ? (
            <button
              type="button"
              className="details-team details-team-link"
              onClick={(e) => handleTeamNavigate(e, {
                teamId: homeTeamId,
                teamName: match.homeTeam,
                teamLogo: match.homeLogo,
                route: homeTeamRoute
              })}
              aria-label={`الانتقال إلى صفحة فريق ${match.homeTeam}`}
              title={`عرض صفحة فريق ${match.homeTeam}`}
            >
              {match.homeLogo ? (
                <img
                  src={match.homeLogo}
                  alt={match.homeTeam}
                  className="details-team-logo"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              ) : (
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--border-subtle)' }} />
              )}
              <span className="details-team-name">{match.homeTeam}</span>
            </button>
          ) : (
            <div className="details-team">
              {match.homeLogo ? (
                <img
                  src={match.homeLogo}
                  alt={match.homeTeam}
                  className="details-team-logo"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              ) : (
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--border-subtle)' }} />
              )}
              <span className="details-team-name">{match.homeTeam}</span>
            </div>
          )}

          {/* Score & Match Status */}
          <div className="details-score-container">
            {(() => {
              const liveDisplay = match.status === 'LIVE' ? getLiveMatchDisplay(match) : null;
              return (
                <span
                  className={`live-badge ${liveDisplay?.isHalfTime ? 'is-halftime' : ''}`}
                  style={
                    match.status === 'LIVE' ? {} :
                      match.status === 'FT' ? { background: 'var(--finished-light)', color: 'var(--text-muted)', borderColor: 'transparent' } :
                        { background: 'var(--scheduled-light)', color: 'var(--scheduled)', borderColor: 'transparent' }
                  }
                >
                  {liveDisplay?.isRunningClock && <span className="live-dot" />}
                  {match.status === 'LIVE' ? (
                    <bdi>{liveDisplay.modalLabel}</bdi>
                  ) : match.status === 'FT' ? finishedMatchLabel(match) : ['POSTPONED', 'CANCELLED', 'ABANDONED', 'SUSPENDED'].includes(match.status) ? getMatchStatusLabel(match) : 'لم تبدأ بعد'}
                </span>
              );
            })()}

            <span className="details-score">
              {isUnplayedMatchStatus(match.status) || !Number.isFinite(match.homeScore) || !Number.isFinite(match.awayScore) ? 'VS' : `${match.homeScore} - ${match.awayScore}`}
            </span>

            {['extra-time', 'penalties'].includes(match.finishType) && <div className="match-period-summary">
              <span>نهاية 90 دقيقة: <bdi>{match.regulationScore ? match.regulationScore.join(' - ') : 'غير متاحة'}</bdi></span>
              {(match.extraTimeScore || match.finishType === 'extra-time') && <span>بعد الوقت الإضافي: <bdi>{(match.extraTimeScore || [match.homeScore, match.awayScore]).join(' - ')}</bdi></span>}
              {match.finishType === 'penalties' && <span>ركلات الترجيح: <bdi>{Number.isFinite(match.homePenalties) && Number.isFinite(match.awayPenalties) ? match.homePenalties + ' - ' + match.awayPenalties : 'غير متاحة'}</bdi></span>}
            </div>}
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700 }}>
              {match.roundName || match.time}
            </span>
          </div>

          {/* Away Team */}
          {awayTeamRoute ? (
            <button
              type="button"
              className="details-team details-team-link"
              onClick={(e) => handleTeamNavigate(e, {
                teamId: awayTeamId,
                teamName: match.awayTeam,
                teamLogo: match.awayLogo,
                route: awayTeamRoute
              })}
              aria-label={`الانتقال إلى صفحة فريق ${match.awayTeam}`}
              title={`عرض صفحة فريق ${match.awayTeam}`}
            >
              {match.awayLogo ? (
                <img
                  src={match.awayLogo}
                  alt={match.awayTeam}
                  className="details-team-logo"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              ) : (
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--border-subtle)' }} />
              )}
              <span className="details-team-name">{match.awayTeam}</span>
            </button>
          ) : (
            <div className="details-team">
              {match.awayLogo ? (
                <img
                  src={match.awayLogo}
                  alt={match.awayTeam}
                  className="details-team-logo"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              ) : (
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--border-subtle)' }} />
              )}
              <span className="details-team-name">{match.awayTeam}</span>
            </div>
          )}
        </div>

        {/* تنبيه البيانات التجريبية للمباريات المصرية */}
        {isEgyptian && (
          <div style={{ padding: '14px 20px 0' }}>
            <EgyptianDisclaimer style={{ marginBottom: 0 }} />
          </div>
        )}

        {/* Sub Navigation Tabs */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 8,
          padding: '12px 20px',
          background: 'var(--bg-surface-elevated)',
          borderBottom: '1px solid var(--border-subtle)'
        }}>
          <button
            type="button"
            className={`sub-tab-btn ${activeTab === 'stats' ? 'active' : ''}`}
            onClick={() => setActiveTab('stats')}
          >
            <BarChart2 size={14} style={{ display: 'inline', marginLeft: 4 }} />
            الإحصائيات
          </button>
          <button
            type="button"
            className={`sub-tab-btn ${activeTab === 'events' ? 'active' : ''}`}
            onClick={() => setActiveTab('events')}
          >
            <Award size={14} style={{ display: 'inline', marginLeft: 4 }} />
            الأحداث ({events.length})
          </button>
          <button
            type="button"
            className={`sub-tab-btn ${activeTab === 'lineups' ? 'active' : ''}`}
            onClick={() => setActiveTab('lineups')}
          >
            <Users size={14} style={{ display: 'inline', marginLeft: 4 }} />
            التشكيل والبدلاء
          </button>
        </div>

        {/* Tab Content */}
        <div style={{ padding: '20px' }}>
          {loading ? (
            <div className="empty-state" style={{ padding: '40px 0' }}>
              <Activity className="empty-icon" size={32} style={{ animation: 'pulse-dot 1.4s infinite' }} />
              <p style={{ fontSize: '0.9rem' }}>جاري جلب إحصائيات وتشكيلات اللقاء من المصدر...</p>
            </div>
          ) : (
            <>
              {/* Stats Tab */}
              {activeTab === 'stats' && (
                <div>
                  {match.status === 'NS' ? (
                    <div className="empty-state" style={{ padding: 24 }}>
                      <Clock size={32} className="empty-icon" />
                      <p style={{ fontSize: '0.9rem' }}>ستبدأ المباراة في تمام الساعة {match.time}. ستتوفر الإحصائيات الحية فور انطلاق اللقاء.</p>
                    </div>
                  ) : (
                    <div className="stats-section" style={{ marginTop: 0 }}>
                      {statItems.map((item) => {
                        const homeVal = stats[item.key][0];
                        const awayVal = stats[item.key][1];
                        const total = homeVal + awayVal || 1;
                        const homePct = (homeVal / total) * 100;
                        const awayPct = (awayVal / total) * 100;

                        return (
                          <div key={item.key} className="stat-row">
                            <div className="stat-labels">
                              <span style={{ color: 'var(--primary)' }}>{homeVal}</span>
                              <span>{item.label}</span>
                              <span style={{ color: 'var(--accent)' }}>{awayVal}</span>
                            </div>
                            <div className="stat-bar-bg">
                              <div className="stat-bar-left" style={{ width: `${homePct}%` }} />
                              <div className="stat-bar-right" style={{ width: `${awayPct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Events Tab */}
              {activeTab === 'events' && (
                <div>
                  {events.length === 0 ? (
                    <div className="empty-state" style={{ padding: 24 }}>
                      <Award size={32} className="empty-icon" />
                      <p style={{ fontSize: '0.9rem' }}>لم تسجل أي أحداث رئيسية في هذه المباراة حتى الآن.</p>
                    </div>
                  ) : (
                    <div className="details-events-list">
                      {events.map((event, idx) => {
                        const cleanMinute = String(event.time ?? '').replace(/['"’`\u2032]/g, '').trim();
                        const isNeutral = event.team !== 'home' && event.team !== 'away';

                        if (isNeutral) {
                          return (
                            <div key={event.id || idx} className="details-event-row is-neutral">
                              <div className="details-event-minute">
                                {cleanMinute ? <><bdi>{cleanMinute}</bdi> د</> : '—'}
                              </div>
                              <div className="details-event-neutral-body">
                                {renderEventContent(event, 'center')}
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div key={event.id || idx} className="details-event-row">
                            <div className="details-event-col home">
                              {event.team === 'home' && renderEventContent(event, 'home')}
                            </div>

                            <div className="details-event-minute">
                              {cleanMinute ? <><bdi>{cleanMinute}</bdi> د</> : '—'}
                            </div>

                            <div className="details-event-col away">
                              {event.team === 'away' && renderEventContent(event, 'away')}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Lineups Tab */}
              {activeTab === 'lineups' && (
                <div>
                  {!hasAnyLineups ? (
                    <div className="empty-state" style={{ padding: 24 }}>
                      <Users size={32} className="empty-icon" />
                      <p style={{ fontSize: '0.9rem' }}>لم يعلن المدربان عن التشكيلة الرسمية حتى الآن.</p>
                    </div>
                  ) : (
                    <div className="lineups-container">
                      {/* التشكيل الأساسي */}
                      <section className="lineup-section">
                        <div className="lineup-section-heading">
                          <span>التشكيل الأساسي</span>
                        </div>
                        <div className="lineup-teams-grid">
                          <div className="lineup-team-column">
                            <div className="lineup-team-header home">
                              <h4>{match.homeTeam}</h4>
                              {rosters?.home?.formation && (
                                <span className="lineup-formation-pill"><bdi>{rosters.home.formation}</bdi></span>
                              )}
                            </div>
                            {renderLineupList(homeStarters, { emptyText: 'التشكيل الأساسي غير متاح حالياً' })}
                          </div>

                          <div className="lineup-team-column">
                            <div className="lineup-team-header away">
                              <h4>{match.awayTeam}</h4>
                              {rosters?.away?.formation && (
                                <span className="lineup-formation-pill"><bdi>{rosters.away.formation}</bdi></span>
                              )}
                            </div>
                            {renderLineupList(awayStarters, { emptyText: 'التشكيل الأساسي غير متاح حالياً' })}
                          </div>
                        </div>
                      </section>

                      {/* البدلاء */}
                      <section className="lineup-section">
                        <div className="lineup-section-heading">
                          <span>البدلاء</span>
                          {hasAnySubstitutes && (
                            <span className="lineup-section-count">
                              ({homeSubstitutes.length} / {awaySubstitutes.length})
                            </span>
                          )}
                        </div>
                        {!hasAnySubstitutes ? (
                          <div className="lineup-subs-unavailable">
                            بيانات البدلاء غير متاحة حالياً
                          </div>
                        ) : (
                          <div className="lineup-teams-grid">
                            <div className="lineup-team-column">
                              <div className="lineup-team-header home compact">
                                <h4>{match.homeTeam}</h4>
                                <span className="lineup-count-pill">{homeSubstitutes.length}</span>
                              </div>
                              {renderLineupList(homeSubstitutes, { emptyText: 'بيانات البدلاء غير متاحة حالياً', isBench: true })}
                            </div>

                            <div className="lineup-team-column">
                              <div className="lineup-team-header away compact">
                                <h4>{match.awayTeam}</h4>
                                <span className="lineup-count-pill">{awaySubstitutes.length}</span>
                              </div>
                              {renderLineupList(awaySubstitutes, { emptyText: 'بيانات البدلاء غير متاحة حالياً', isBench: true })}
                            </div>
                          </div>
                        )}
                      </section>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );

  if (isStandalone) {
    return (
      <div className="standalone-match-container">
        <div className="standalone-match-content">
          {modalInner}
        </div>
      </div>
    );
  }

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="تفاصيل المباراة"
    >
      <motion.div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.94, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 30 }}
        transition={{ type: 'spring', damping: 25, stiffness: 260 }}
      >
        {modalInner}
      </motion.div>
    </div>
  );
};

export default MatchDetailModal;
