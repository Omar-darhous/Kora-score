import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Award, BarChart2, Users, Clock, Activity, Shield } from 'lucide-react';
import { EgyptianDisclaimer, EgyptianBadge } from './EgyptianDisclaimer';

const MatchDetailModal = ({ match, details, loading, onClose, isStandalone = false }) => {
  const [activeTab, setActiveTab] = useState('stats');

  if (!match) return null;

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

            {/* Score & Match Status */}
            <div className="details-score-container">
              <span 
                className="live-badge" 
                style={
                  match.status === 'LIVE' ? {} : 
                  match.status === 'FT' ? { background: 'var(--finished-light)', color: 'var(--text-muted)', borderColor: 'transparent' } :
                  { background: 'var(--scheduled-light)', color: 'var(--scheduled)', borderColor: 'transparent' }
                }
              >
                {match.status === 'LIVE' && <span className="live-dot" />}
                {match.status === 'LIVE' ? (
                  <>مباشر (<bdi>{String(match.minute ?? '').replace(/['"’`]/g, '').trim()}</bdi> د)</>
                ) : match.status === 'FT' ? 'انتهت المباراة' : 'لم تبدأ بعد'}
              </span>

              <span className="details-score">
                {match.status === 'NS' ? 'VS' : `${match.homeScore} - ${match.awayScore}`}
              </span>

              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                {match.roundName || match.time}
              </span>
            </div>

            {/* Away Team */}
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
              التشكيل الأساسي
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
                        <p style={{ fontSize: '0.9rem' }}>لم تسجل أي أهداف أو بطاقات حتى الآن في هذه المباراة.</p>
                      </div>
                    ) : (
                      <div className="details-events-list">
                        {events.map((event, idx) => (
                          <div 
                            key={idx} 
                            style={{ 
                              display: 'grid', 
                              gridTemplateColumns: '1fr 60px 1fr', 
                              alignItems: 'center', 
                              padding: '10px 0', 
                              borderBottom: '1px solid var(--border-subtle)',
                              fontSize: '0.86rem'
                            }}
                          >
                            <div style={{ textAlign: 'right' }}>
                              {event.team === 'home' && (
                                <div style={{ fontWeight: 600 }}>
                                  {event.type === 'goal' && <span style={{ marginLeft: 6 }}>⚽</span>}
                                  {event.type === 'card' && <span style={{ marginLeft: 6 }}>{event.cardType === 'yellow' ? '🟨' : '🟥'}</span>}
                                  <span>{event.player}</span>
                                </div>
                              )}
                            </div>

                            <div style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--primary)' }}>
                              <bdi>{String(event.time || '').replace(/['"’`]/g, '').trim()}</bdi> د
                            </div>

                            <div style={{ textAlign: 'left' }}>
                              {event.team === 'away' && (
                                <div style={{ fontWeight: 600 }}>
                                  <span>{event.player}</span>
                                  {event.type === 'goal' && <span style={{ marginRight: 6 }}>⚽</span>}
                                  {event.type === 'card' && <span style={{ marginRight: 6 }}>{event.cardType === 'yellow' ? '🟨' : '🟥'}</span>}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Lineups Tab */}
                {activeTab === 'lineups' && (
                  <div>
                    {lineups.home.length === 0 && lineups.away.length === 0 ? (
                      <div className="empty-state" style={{ padding: 24 }}>
                        <Users size={32} className="empty-icon" />
                        <p style={{ fontSize: '0.9rem' }}>لم يعلن المدربان عن التشكيلة الرسمية حتى الآن.</p>
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        <div>
                          <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--primary)', marginBottom: 10 }}>
                            {match.homeTeam}
                          </h4>
                          <ul style={{ listStyle: 'none', padding: 0, fontSize: '0.84rem' }}>
                            {lineups.home.map((p, i) => (
                              <li key={i} style={{ padding: '6px 0', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontSize: '0.74rem' }}>{i + 1}</span>
                                <span>{p}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div>
                          <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--accent)', marginBottom: 10 }}>
                            {match.awayTeam}
                          </h4>
                          <ul style={{ listStyle: 'none', padding: 0, fontSize: '0.84rem' }}>
                            {lineups.away.map((p, i) => (
                              <li key={i} style={{ padding: '6px 0', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontSize: '0.74rem' }}>{i + 1}</span>
                                <span>{p}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
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
