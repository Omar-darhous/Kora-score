import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Star } from 'lucide-react';

const LiveMatches = ({ matches, onMatchClick }) => {
  const liveMatches = matches.filter(m => m.status === 'LIVE');

  if (liveMatches.length === 0) {
    return (
      <div className="live-matches-container">
        <h2 className="section-title">
          <Flame size={22} color="var(--live-pulse)" />
          المباريات المباشرة الآن
        </h2>
        <div className="glass-card empty-state">
          <p>لا توجد مباريات حية تدور الآن. يمكنك متابعة جدول المباريات اليومية في الأسفل.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="live-matches-container">
      <h2 className="section-title">
        <span className="live-badge">
          <span className="live-dot"></span>
          مباشر الآن
        </span>
        المباريات الجارية
      </h2>
      
      <div className="live-matches-scroll">
        <AnimatePresence>
          {liveMatches.map((match) => (
            <motion.div
              key={match.id}
              className="glass-card match-ticker-card"
              onClick={() => onMatchClick(match)}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              layoutId={`match-card-${match.id}`}
            >
              <div className="ticker-header">
                <span className="ticker-league">
                  <img 
                    src={match.leagueLogo} 
                    alt={match.leagueName} 
                    className="team-logo" 
                    style={{ width: 16, height: 16 }} 
                    onError={(e) => e.target.style.display = 'none'}
                  />
                  {match.leagueName}
                </span>
                <span className="live-badge">
                  <span className="live-dot"></span>
                  د {match.minute}'
                </span>
              </div>
              
              <div className="ticker-teams">
                <div className="ticker-team-row">
                  <div className="team-info">
                    {match.homeLogo && (
                      <img 
                        src={match.homeLogo} 
                        alt={match.homeTeam} 
                        className="team-logo" 
                        onError={(e) => e.target.style.display = 'none'}
                      />
                    )}
                    <span>{match.homeTeam}</span>
                  </div>
                  <span className="team-score">{match.homeScore}</span>
                </div>
                
                <div className="ticker-team-row">
                  <div className="team-info">
                    {match.awayLogo && (
                      <img 
                        src={match.awayLogo} 
                        alt={match.awayTeam} 
                        className="team-logo" 
                        onError={(e) => e.target.style.display = 'none'}
                      />
                    )}
                    <span>{match.awayTeam}</span>
                  </div>
                  <span className="team-score">{match.awayScore}</span>
                </div>
              </div>
              
              <div className="ticker-footer">
                <span className="match-status">جارية الآن {match.roundName ? `• ${match.roundName}` : ''}</span>
                <span className="match-time">انطلقت {match.time}</span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default LiveMatches;
