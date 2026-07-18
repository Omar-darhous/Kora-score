import React from 'react';
import { motion } from 'framer-motion';
import { X, Award, BarChart2, Users, Calendar, RefreshCw } from 'lucide-react';

const MatchDetailModal = ({ match, details, loading, onClose }) => {
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
    { label: 'الاستحواذ %', key: 'possession' },
    { label: 'إجمالي التسديدات', key: 'shots' },
    { label: 'تسديدات على المرمى', key: 'shotsOnGoal' },
    { label: 'الضربات الركنية', key: 'corners' },
    { label: 'الأخطاء المرتكبة', key: 'fouls' },
    { label: 'الكروت الصفراء', key: 'yellowCards' },
    { label: 'الكروت الحمراء', key: 'redCards' }
  ];

  const events = details?.events || [];
  const lineups = details?.lineups || { home: [], away: [] };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.9, y: 50 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 50 }}
        transition={{ type: 'spring', damping: 25, stiffness: 250 }}
      >
        <div className="modal-header">
          <span className="modal-title d-flex align-center gap-1">
            <Calendar size={18} />
            تفاصيل المباراة الحية
          </span>
          <button className="close-modal-btn" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="modal-body" style={{ padding: 0 }}>
          {/* لوحة النتيجة */}
          <div className="details-header">
            <div className="details-team">
              {match.homeLogo && (
                <img 
                  src={match.homeLogo} 
                  alt={match.homeTeam} 
                  className="details-team-logo" 
                  onError={(e) => e.target.style.display = 'none'}
                />
              )}
              <span className="details-team-name">{match.homeTeam}</span>
            </div>

            <div className="details-score-container">
              <span className="match-row-status" style={{ color: match.status === 'LIVE' ? 'var(--danger)' : 'var(--text-muted)' }}>
                {match.status === 'LIVE' ? `مباشر (د ${match.minute})` : match.status === 'FT' ? 'انتهت' : 'لم تبدأ بعد'}
              </span>
              <span className="details-score">
                {match.status === 'NS' ? 'vs' : `${match.homeScore} - ${match.awayScore}`}
              </span>
              <span className="match-schedule-time">{match.leagueName}</span>
            </div>

            <div className="details-team">
              {match.awayLogo && (
                <img 
                  src={match.awayLogo} 
                  alt={match.awayTeam} 
                  className="details-team-logo" 
                  onError={(e) => e.target.style.display = 'none'}
                />
              )}
              <span className="details-team-name">{match.awayTeam}</span>
            </div>
          </div>

          <div style={{ padding: '20px' }}>
            {loading ? (
              <div className="empty-state" style={{ padding: '40px 0' }}>
                <RefreshCw className="empty-icon animate-spin" size={32} style={{ animation: 'spin 1.5s linear infinite' }} />
                <p>جاري تحميل تفاصيل اللقاء، التشكيلة، والإحصائيات من الملاعب...</p>
              </div>
            ) : (
              <>
                {/* أحداث اللقاء */}
                {events.length > 0 && (
                  <div className="details-events" style={{ marginBottom: 24 }}>
                    <h3 className="d-flex align-center gap-1" style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--accent)', marginBottom: 12 }}>
                      <Award size={16} />
                      أحداث اللقاء الأساسية
                    </h3>
                    <div className="details-events-list">
                      {events.map((event, idx) => (
                        <div key={idx} className="details-event-row" style={{ padding: '6px 0', borderBottom: '1px solid var(--border-color)' }}>
                          <div className="event-left">
                            {event.team === 'home' && (
                              <div style={{ fontSize: '0.85rem' }}>
                                {event.player}
                                {event.type === 'goal' && <span style={{ marginRight: 6 }}>⚽</span>}
                                {event.type === 'card' && <span style={{ marginRight: 6 }}>{event.cardType === 'yellow' ? '🟨' : '🟥'}</span>}
                              </div>
                            )}
                          </div>
                          <div className="event-time" style={{ fontSize: '0.85rem' }}>'{event.time}</div>
                          <div className="event-right">
                            {event.team === 'away' && (
                              <div style={{ fontSize: '0.85rem' }}>
                                {event.type === 'goal' && <span style={{ marginLeft: 6 }}>⚽</span>}
                                {event.type === 'card' && <span style={{ marginLeft: 6 }}>{event.cardType === 'yellow' ? '🟨' : '🟥'}</span>}
                                {event.player}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* إحصائيات المباراة */}
                {match.status !== 'NS' && (
                  <div className="stats-section">
                    <h3 className="d-flex align-center gap-1" style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--primary)', marginBottom: 4 }}>
                      <BarChart2 size={16} />
                      إحصائيات اللقاء
                    </h3>
                    {statItems.map((item) => {
                      const homeVal = stats[item.key][0];
                      const awayVal = stats[item.key][1];
                      const total = homeVal + awayVal || 1;
                      const homePct = (homeVal / total) * 100;
                      const awayPct = (awayVal / total) * 100;

                      return (
                        <div key={item.key} className="stat-row">
                          <div className="stat-labels">
                            <span>{homeVal}</span>
                            <span>{item.label}</span>
                            <span>{awayVal}</span>
                          </div>
                          <div className="stat-bar-bg">
                            <div className="stat-bar-left" style={{ width: `${homePct}%` }}></div>
                            <div className="stat-bar-right" style={{ width: `${awayPct}%` }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* تشكيلة الفريق الأساسية */}
                {lineups.home.length > 0 && (
                  <div className="lineups-section" style={{ marginTop: 24 }}>
                    <h3 className="d-flex align-center gap-1" style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 12 }}>
                      <Users size={16} />
                      التشكيلة الأساسية للفرق
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                      <div>
                        <h4 style={{ fontSize: '0.85rem', color: 'var(--primary)', marginBottom: 6 }}>{match.homeTeam}</h4>
                        <ul style={{ listStyle: 'none', padding: 0, fontSize: '0.8rem' }}>
                          {lineups.home.map((p, i) => (
                            <li key={i} style={{ padding: '6px 0', borderBottom: '1px solid var(--border-color)' }}>{p}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4 style={{ fontSize: '0.85rem', color: 'var(--accent)', marginBottom: 6 }}>{match.awayTeam}</h4>
                        <ul style={{ listStyle: 'none', padding: 0, fontSize: '0.8rem' }}>
                          {lineups.away.map((p, i) => (
                            <li key={i} style={{ padding: '6px 0', borderBottom: '1px solid var(--border-color)' }}>{p}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {match.status === 'NS' && !events.length && (
                  <div className="glass-card empty-state" style={{ padding: 20, marginTop: 12 }}>
                    <p style={{ fontSize: '0.9rem' }}>المباراة لم تبدأ بعد. الإحصائيات والتشكيلات وأحداث اللقاء ستتوفر فور انطلاق المباراة مباشرة.</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </motion.div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default MatchDetailModal;
