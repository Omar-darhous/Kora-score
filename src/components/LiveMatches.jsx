import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Radio, ChevronLeft, ChevronRight, Activity } from 'lucide-react';

const LiveMatches = ({ matches, onMatchClick }) => {
  const scrollContainerRef = useRef(null);
  const liveMatches = matches.filter(m => m.status === 'LIVE');

  const scroll = (direction) => {
    if (scrollContainerRef.current) {
      const scrollAmount = direction === 'left' ? -340 : 340;
      scrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  if (liveMatches.length === 0) {
    return (
      <div className="live-matches-container">
        <div className="live-empty-banner">
          <div className="d-flex align-center gap-2">
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 'var(--radius-full)',
              background: 'var(--primary-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary)'
            }}>
              <Activity size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '0.98rem', fontWeight: 800, marginBottom: 2 }}>
                لا توجد مباريات حية تدور في هذه اللحظة
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                تابع نتائج المباريات المنتهية ومواعيد المواجهات القادمة في جدول اليوم أدناه.
              </p>
            </div>
          </div>
          <span className="live-badge" style={{ background: 'var(--finished-light)', color: 'var(--text-muted)', borderColor: 'var(--border-subtle)' }}>
            استراحة المباريات
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="live-matches-container">
      <div className="d-flex align-center justify-between">
        <h2 className="section-title">
          <Radio size={20} color="var(--live)" />
          <span>المباريات المباشرة الآن</span>
          <span className="section-badge-count">{liveMatches.length}</span>
        </h2>

        {/* Scroll Controls (Desktop) */}
        {liveMatches.length > 2 && (
          <div className="d-flex align-center gap-1">
            <button
              type="button"
              className="action-btn"
              style={{ width: 30, height: 30 }}
              onClick={() => scroll('right')}
              title="تمرير لليمين"
              aria-label="تمرير لليمين"
            >
              <ChevronRight size={16} />
            </button>
            <button
              type="button"
              className="action-btn"
              style={{ width: 30, height: 30 }}
              onClick={() => scroll('left')}
              title="تمرير لليسار"
              aria-label="تمرير لليسار"
            >
              <ChevronLeft size={16} />
            </button>
          </div>
        )}
      </div>

      <div className="live-matches-wrapper">
        <div className="live-matches-scroll" ref={scrollContainerRef}>
          <AnimatePresence>
            {liveMatches.map((match) => (
              <motion.div
                key={match.id}
                className="match-ticker-card"
                onClick={() => onMatchClick(match)}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                whileHover={{ y: -3 }}
                transition={{ duration: 0.2 }}
                layoutId={`match-ticker-${match.id}`}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onMatchClick(match); }}
              >
                {/* Header */}
                <div className="ticker-header">
                  <div className="ticker-league">
                    {match.leagueLogo && (
                      <img 
                        src={match.leagueLogo} 
                        alt={match.leagueName} 
                        className="team-logo" 
                        style={{ width: 16, height: 16 }} 
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    )}
                    <span>{match.leagueName}</span>
                  </div>
                  <span className="live-badge">
                    <span className="live-dot" />
                    <span><bdi>{String(match.minute ?? '').replace(/['"’`]/g, '').trim()}</bdi> د</span>
                  </span>
                </div>

                {/* Teams & Scores */}
                <div className="ticker-teams">
                  <div className="ticker-team-row">
                    <div className="team-info">
                      {match.homeLogo ? (
                        <img 
                          src={match.homeLogo} 
                          alt={match.homeTeam} 
                          className="team-logo" 
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      ) : (
                        <div style={{ width: 22, height: 22, borderRadius: 4, background: 'var(--border-subtle)' }} />
                      )}
                      <span className="team-name-text">{match.homeTeam}</span>
                    </div>
                    <span className="team-score">{match.homeScore}</span>
                  </div>

                  <div className="ticker-team-row">
                    <div className="team-info">
                      {match.awayLogo ? (
                        <img 
                          src={match.awayLogo} 
                          alt={match.awayTeam} 
                          className="team-logo" 
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      ) : (
                        <div style={{ width: 22, height: 22, borderRadius: 4, background: 'var(--border-subtle)' }} />
                      )}
                      <span className="team-name-text">{match.awayTeam}</span>
                    </div>
                    <span className="team-score">{match.awayScore}</span>
                  </div>
                </div>

                {/* Footer */}
                <div className="ticker-footer">
                  <span className="match-status">جارية الآن {match.roundName ? `• ${match.roundName}` : ''}</span>
                  <span className="match-time">انطلقت {match.time}</span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default LiveMatches;
