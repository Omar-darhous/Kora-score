import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trophy, RefreshCw, Star } from 'lucide-react';
import { getStandings, getLeagues, getWorldCupKnockouts } from '../services/footballService';

// دالة لتصنيف المراكز حسب البطولة وتحديد لون الهامش الأيمن والتسمية
const getRankStyleAndText = (leagueId, rank) => {
  // دوريات أبطال القارات والهبوط
  if (leagueId === 'fifa.world' || leagueId === 'uefa.champions' || leagueId === 'uefa.europa') {
    if (rank <= 2) {
      return {
        color: '#10b981', // أخضر للتأهل
        bg: 'rgba(16, 185, 129, 0.1)',
        borderRight: '4px solid #10b981',
        label: 'تأهل إلى الدور التالي'
      };
    }
    return null;
  }

  // الدوري الإنجليزي، الإسباني، الإيطالي
  if (leagueId === 'eng.1' || leagueId === 'esp.1' || leagueId === 'ita.1') {
    if (rank <= 4) {
      return {
        color: '#3b82f6', // أزرق للأبطال
        bg: 'rgba(59, 130, 246, 0.1)',
        borderRight: '4px solid #3b82f6',
        label: 'تأهل إلى دوري أبطال أوروبا'
      };
    }
    if (rank === 5 || rank === 6) {
      return {
        color: '#f59e0b', // برتقالي لليوروباليغ
        bg: 'rgba(245, 158, 11, 0.1)',
        borderRight: '4px solid #f59e0b',
        label: 'تأهل إلى الدوري الأوروبي'
      };
    }
    if (rank === 7) {
      return {
        color: '#10b981', // أخضر لدوري المؤتمر
        bg: 'rgba(16, 185, 129, 0.1)',
        borderRight: '4px solid #10b981',
        label: 'تأهل إلى دوري المؤتمر الأوروبي'
      };
    }
    if (rank >= 18) {
      return {
        color: '#ef4444', // أحمر للهبوط
        bg: 'rgba(239, 68, 68, 0.1)',
        borderRight: '4px solid #ef4444',
        label: 'الهبوط للدرجة الثانية'
      };
    }
  }

  // الدوري الألماني
  if (leagueId === 'ger.1') {
    if (rank <= 4) {
      return {
        color: '#3b82f6',
        bg: 'rgba(59, 130, 246, 0.1)',
        borderRight: '4px solid #3b82f6',
        label: 'تأهل إلى دوري أبطال أوروبا'
      };
    }
    if (rank === 5 || rank === 6) {
      return {
        color: '#f59e0b',
        bg: 'rgba(245, 158, 11, 0.1)',
        borderRight: '4px solid #f59e0b',
        label: 'تأهل إلى الدوري الأوروبي'
      };
    }
    if (rank === 7) {
      return {
        color: '#10b981',
        bg: 'rgba(16, 185, 129, 0.1)',
        borderRight: '4px solid #10b981',
        label: 'تأهل إلى دوري المؤتمر الأوروبي'
      };
    }
    if (rank >= 17) {
      return {
        color: '#ef4444',
        bg: 'rgba(239, 68, 68, 0.1)',
        borderRight: '4px solid #ef4444',
        label: 'الهبوط المباشر للدرجة الثانية'
      };
    }
    if (rank === 16) {
      return {
        color: '#f43f5e',
        bg: 'rgba(244, 63, 94, 0.1)',
        borderRight: '4px solid #f43f5e',
        label: 'ملحق البقاء / الهبوط'
      };
    }
  }

  // الدوري الفرنسي
  if (leagueId === 'fra.1') {
    if (rank <= 3) {
      return {
        color: '#3b82f6',
        bg: 'rgba(59, 130, 246, 0.1)',
        borderRight: '4px solid #3b82f6',
        label: 'تأهل إلى دوري أبطال أوروبا'
      };
    }
    if (rank === 4) {
      return {
        color: '#6366f1',
        bg: 'rgba(99, 102, 241, 0.1)',
        borderRight: '4px solid #6366f1',
        label: 'تصفيات دوري أبطال أوروبا'
      };
    }
    if (rank === 5) {
      return {
        color: '#f59e0b',
        bg: 'rgba(245, 158, 11, 0.1)',
        borderRight: '4px solid #f59e0b',
        label: 'تأهل إلى الدوري الأوروبي'
      };
    }
    if (rank === 6) {
      return {
        color: '#10b981',
        bg: 'rgba(16, 185, 129, 0.1)',
        borderRight: '4px solid #10b981',
        label: 'تأهل إلى دوري المؤتمر الأوروبي'
      };
    }
    if (rank >= 17) {
      return {
        color: '#ef4444',
        bg: 'rgba(239, 68, 68, 0.1)',
        borderRight: '4px solid #ef4444',
        label: 'الهبوط المباشر للدرجة الثانية'
      };
    }
    if (rank === 16) {
      return {
        color: '#f43f5e',
        bg: 'rgba(244, 63, 94, 0.1)',
        borderRight: '4px solid #f43f5e',
        label: 'ملحق البقاء / الهبوط'
      };
    }
  }

  // الدوري السعودي
  if (leagueId === 'ksa.1') {
    if (rank <= 3) {
      return {
        color: '#3b82f6',
        bg: 'rgba(59, 130, 246, 0.1)',
        borderRight: '4px solid #3b82f6',
        label: 'تأهل إلى دوري أبطال آسيا للنخبة'
      };
    }
    if (rank === 4) {
      return {
        color: '#f59e0b',
        bg: 'rgba(245, 158, 11, 0.1)',
        borderRight: '4px solid #f59e0b',
        label: 'تأهل إلى دوري أبطال آسيا 2'
      };
    }
    if (rank >= 16) {
      return {
        color: '#ef4444',
        bg: 'rgba(239, 68, 68, 0.1)',
        borderRight: '4px solid #ef4444',
        label: 'الهبوط لدوري يلو الدرجة الأولى'
      };
    }
  }

  // الدوري المصري الممتاز
  if (leagueId === 'egypt.1') {
    if (rank <= 2) {
      return {
        color: '#3b82f6',
        bg: 'rgba(59, 130, 246, 0.1)',
        borderRight: '4px solid #3b82f6',
        label: 'تأهل إلى دوري أبطال أفريقيا'
      };
    }
    if (rank === 3) {
      return {
        color: '#f59e0b',
        bg: 'rgba(245, 158, 11, 0.1)',
        borderRight: '4px solid #f59e0b',
        label: 'تأهل إلى كأس الكونفدرالية الأفريقية'
      };
    }
    if (rank >= 15) {
      return {
        color: '#ef4444',
        bg: 'rgba(239, 68, 68, 0.1)',
        borderRight: '4px solid #ef4444',
        label: 'الهبوط لدوري القسم الثاني'
      };
    }
  }

  // الدوري الأمريكي (MLS)
  if (leagueId === 'usa.1') {
    if (rank <= 7) {
      return {
        color: '#10b981',
        bg: 'rgba(16, 185, 129, 0.1)',
        borderRight: '4px solid #10b981',
        label: 'تأهل إلى تصفيات كأس الدوري الأمريكي (Playoffs)'
      };
    }
    if (rank === 8 || rank === 9) {
      return {
        color: '#f59e0b',
        bg: 'rgba(245, 158, 11, 0.1)',
        borderRight: '4px solid #f59e0b',
        label: 'ملحق تصفيات كأس الدوري الأمريكي (Wild Card)'
      };
    }
  }

  return null;
};

// تجميع عناصر الدليل الفريدة لعرضها أسفل الجدول
const getLegendItems = (leagueId) => {
  const items = [];
  const addedLabels = new Set();
  
  // نفحص المراكز من 1 إلى 20
  for (let r = 1; r <= 20; r++) {
    const zone = getRankStyleAndText(leagueId, r);
    if (zone && !addedLabels.has(zone.label)) {
      addedLabels.add(zone.label);
      items.push({
        label: zone.label,
        color: zone.color
      });
    }
  }
  return items;
};

// مكون بطاقة المباراة في شجرة الأدوار الإقصائية
const BracketMatchCard = ({ match, onMatchClick, round, index, hoverState, setHoverState }) => {
  if (!match) {
    return (
      <div className="bracket-match-card placeholder">
        <span className="text-muted" style={{ fontSize: '0.75rem' }}>مباراة لم تحدد بعد</span>
      </div>
    );
  }

  const isFT = match.status === 'FT';
  const isLive = match.status === 'LIVE';
  
  // التحقق من الفريق الفائز
  const isHomeWinner = isFT && match.homeScore > match.awayScore;
  const isAwayWinner = isFT && match.awayScore > match.homeScore;

  // إدارة تظليل مسار الفريق عند تمرير مؤشر الفأرة
  const handleMouseEnter = () => {
    setHoverState({ round, index, homeTeam: match.homeTeam, awayTeam: match.awayTeam });
  };
  const handleMouseLeave = () => {
    setHoverState(null);
  };

  // التحقق من تظليل المسار
  let isHighlighted = false;
  if (hoverState) {
    if (match.homeTeam.includes(hoverState.homeTeam) || match.homeTeam.includes(hoverState.awayTeam) ||
        match.awayTeam.includes(hoverState.homeTeam) || match.awayTeam.includes(hoverState.awayTeam)) {
      isHighlighted = true;
    }
  }

  return (
    <motion.div
      className={`bracket-match-card ${isHighlighted ? 'highlighted' : ''} ${isLive ? 'live-border' : ''}`}
      onClick={() => onMatchClick && onMatchClick(match)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      whileHover={{ scale: 1.02, translateY: -2 }}
      transition={{ duration: 0.15 }}
      style={{ cursor: 'pointer' }}
    >
      <div className="match-card-header">
        <span className="match-round-tag">
          {isLive ? `مباشر د ${match.minute}'` : isFT ? 'انتهت' : match.time}
        </span>
        {isLive && <span className="live-dot animate-pulse"></span>}
      </div>
      
      <div className="match-card-body d-flex flex-column gap-1">
        {/* الفريق المستضيف */}
        <div className={`bracket-team-row ${isHomeWinner ? 'winner' : ''}`}>
          <div className="bracket-team-info">
            {match.homeLogo && (
              <img src={match.homeLogo} alt={match.homeTeam} className="bracket-team-logo" onError={(e) => e.target.style.display = 'none'} />
            )}
            <span className="bracket-team-name">{match.homeTeam}</span>
          </div>
          <span className="bracket-team-score">{match.homeScore}</span>
        </div>
        
        {/* الفريق الضيف */}
        <div className={`bracket-team-row ${isAwayWinner ? 'winner' : ''}`}>
          <div className="bracket-team-info">
            {match.awayLogo && (
              <img src={match.awayLogo} alt={match.awayTeam} className="bracket-team-logo" onError={(e) => e.target.style.display = 'none'} />
            )}
            <span className="bracket-team-name">{match.awayTeam}</span>
          </div>
          <span className="bracket-team-score">{match.awayScore}</span>
        </div>
      </div>
    </motion.div>
  );
};

// مكون شجرة الأدوار الإقصائية
const KnockoutBracket = ({ bracketData, onMatchClick, hoverState, setHoverState }) => {
  if (!bracketData) {
    return (
      <div className="glass-card empty-state" style={{ padding: '60px 0' }}>
        <p>لم نتمكن من العثور على بيانات الأدوار الإقصائية حالياً.</p>
      </div>
    );
  }

  return (
    <div className="bracket-scroll-container">
      <div className="bracket-wrapper">
        {/* العمود الأول: دور الـ 16 */}
        <div className="bracket-column">
          <div className="column-header">دور الـ 16 (1/8)</div>
          <div className="matches-column-flow">
            {bracketData.r16.map((match, idx) => (
              <BracketMatchCard 
                key={idx} 
                match={match} 
                onMatchClick={onMatchClick} 
                round="r16" 
                index={idx} 
                hoverState={hoverState} 
                setHoverState={setHoverState} 
              />
            ))}
          </div>
        </div>

        {/* العمود الثاني: ربع النهائي */}
        <div className="bracket-column">
          <div className="column-header">ربع النهائي (1/4)</div>
          <div className="matches-column-flow">
            {bracketData.qf.map((match, idx) => (
              <BracketMatchCard 
                key={idx} 
                match={match} 
                onMatchClick={onMatchClick} 
                round="qf" 
                index={idx} 
                hoverState={hoverState} 
                setHoverState={setHoverState} 
              />
            ))}
          </div>
        </div>

        {/* العمود الثالث: نصف النهائي */}
        <div className="bracket-column">
          <div className="column-header">نصف النهائي (1/2)</div>
          <div className="matches-column-flow">
            {bracketData.sf.map((match, idx) => (
              <BracketMatchCard 
                key={idx} 
                match={match} 
                onMatchClick={onMatchClick} 
                round="sf" 
                index={idx} 
                hoverState={hoverState} 
                setHoverState={setHoverState} 
              />
            ))}
          </div>
        </div>

        {/* العمود الرابع: النهائي والمركز الثالث */}
        <div className="bracket-column">
          <div className="column-header">النهائي والمركز الثالث</div>
          <div className="matches-column-flow" style={{ justifyContent: 'center', gap: '80px' }}>
            <div className="final-match-wrapper">
              <span className="special-round-label">
                <Star size={12} color="var(--accent)" fill="var(--accent)" />
                المباراة النهائية
              </span>
              <BracketMatchCard 
                match={bracketData.final} 
                onMatchClick={onMatchClick} 
                round="final" 
                index={0} 
                hoverState={hoverState} 
                setHoverState={setHoverState} 
              />
            </div>

            <div className="final-match-wrapper">
              <span className="special-round-label" style={{ color: 'var(--text-secondary)' }}>
                تحديد المركز الثالث
              </span>
              <BracketMatchCard 
                match={bracketData.thirdPlace} 
                onMatchClick={onMatchClick} 
                round="third" 
                index={0} 
                hoverState={hoverState} 
                setHoverState={setHoverState} 
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const LeagueStandings = ({ onMatchClick }) => {
  const leagues = getLeagues();
  const [activeLeague, setActiveLeague] = useState(leagues[0].id);
  const [standingsGroups, setStandingsGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // حالات الأدوار الإقصائية
  const [subTab, setSubTab] = useState('groups'); // groups | knockout
  const [knockoutData, setKnockoutData] = useState(null);
  const [loadingKnockout, setLoadingKnockout] = useState(false);
  const [hoverState, setHoverState] = useState(null);

  // مزامنة التبويب الفرعي عند تغيير البطولة
  useEffect(() => {
    setSubTab('groups');
  }, [activeLeague]);

  // جلب ترتيب المجموعات
  useEffect(() => {
    const fetchLeagueStandings = async () => {
      setLoading(true);
      try {
        const data = await getStandings(activeLeague);
        setStandingsGroups(data);
      } catch (e) {
        console.error('Failed to load standings', e);
      } finally {
        setLoading(false);
      }
    };
    fetchLeagueStandings();
  }, [activeLeague]);

  // جلب بيانات الأدوار الإقصائية لكأس العالم
  useEffect(() => {
    if (activeLeague === 'fifa.world' && subTab === 'knockout') {
      const fetchKnockout = async () => {
        setLoadingKnockout(true);
        try {
          const data = await getWorldCupKnockouts();
          setKnockoutData(data);
        } catch (e) {
          console.error("Failed to load knockout bracket", e);
        } finally {
          setLoadingKnockout(false);
        }
      };
      fetchKnockout();
    }
  }, [activeLeague, subTab]);

  return (
    <div className="standings-container">
      <div className="d-flex align-center justify-between">
        <h2 className="section-title" style={{ marginBottom: 0 }}>
          <Trophy size={22} color="var(--accent)" />
          ترتيب البطولات والدوريات الكبرى
        </h2>
      </div>

      {/* تبويبات اختيار الدوري */}
      <div className="tabs-container">
        {leagues.map((league) => (
          <button
            key={league.id}
            className={`tab-btn ${activeLeague === league.id ? 'active' : ''}`}
            onClick={() => setActiveLeague(league.id)}
          >
            <span className="d-flex align-center gap-1">
              <img 
                src={league.logo} 
                alt={league.name} 
                style={{ width: 18, height: 18, objectFit: 'contain' }} 
                onError={(e) => e.target.style.display = 'none'}
              />
              {league.name}
            </span>
          </button>
        ))}
      </div>

      {/* تبويبات فرعية لكأس العالم لتحديد دور المجموعات أو الأدوار الاقصائية */}
      {activeLeague === 'fifa.world' && (
        <div className="d-flex align-center justify-center gap-2" style={{ margin: '8px 0 16px 0', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px' }}>
          <button
            className={`sub-tab-btn ${subTab === 'groups' ? 'active' : ''}`}
            onClick={() => setSubTab('groups')}
          >
            دور المجموعات (الترتيب)
          </button>
          <button
            className={`sub-tab-btn ${subTab === 'knockout' ? 'active' : ''}`}
            onClick={() => setSubTab('knockout')}
          >
            الأدوار الإقصائية (المخطط)
          </button>
        </div>
      )}

      {/* المحتوى الرئيسي */}
      {activeLeague === 'fifa.world' && subTab === 'knockout' ? (
        loadingKnockout ? (
          <div className="glass-card empty-state" style={{ padding: '60px 0' }}>
            <RefreshCw className="empty-icon animate-spin" size={32} style={{ animation: 'spin 1.5s linear infinite' }} />
            <p>جاري تحميل مخطط الأدوار الإقصائية لكأس العالم...</p>
          </div>
        ) : (
          <KnockoutBracket 
            bracketData={knockoutData} 
            onMatchClick={onMatchClick} 
            hoverState={hoverState} 
            setHoverState={setHoverState} 
          />
        )
      ) : (
        /* جداول الترتيب (دور المجموعات أو الدوريات الأخرى) */
        loading ? (
          <div className="glass-card empty-state" style={{ padding: '60px 0' }}>
            <RefreshCw className="empty-icon animate-spin" size={32} style={{ animation: 'spin 1.5s linear infinite' }} />
            <p>جاري تحميل جدول الترتيب الحالي...</p>
          </div>
        ) : standingsGroups.length === 0 ? (
          <div className="glass-card empty-state">
            <p>لم نتمكن من العثور على جداول الترتيب لهذه البطولة حالياً.</p>
          </div>
        ) : (
          <div className="d-flex flex-column gap-3">
            {standingsGroups.map((group, groupIdx) => (
              <div key={groupIdx} className="d-flex flex-column gap-1">
                {/* عرض اسم المجموعة إذا كان هناك أكثر من مجموعة واحدة (مثل كأس العالم) */}
                {standingsGroups.length > 1 && (
                  <h3 
                    style={{ 
                      fontSize: '1.1rem', 
                      fontWeight: 800, 
                      color: 'var(--accent)', 
                      padding: '8px 4px', 
                      borderBottom: '1px solid var(--border-color)',
                      marginTop: groupIdx > 0 ? 12 : 0
                    }}
                  >
                    {group.name}
                  </h3>
                )}

                <div className="glass-card table-responsive" style={{ overflow: 'hidden' }}>
                  <table className="standings-table">
                    <thead>
                      <tr>
                        <th style={{ width: 50, textAlign: 'center' }}>#</th>
                        <th style={{ textAlign: 'right' }}>الفريق</th>
                        <th style={{ width: 50, textAlign: 'center' }}>لعب</th>
                        <th style={{ width: 45, textAlign: 'center' }}>فاز</th>
                        <th style={{ width: 45, textAlign: 'center' }}>تعادل</th>
                        <th style={{ width: 45, textAlign: 'center' }}>خسر</th>
                        <th style={{ width: 80, textAlign: 'center' }}>أهداف</th>
                        <th style={{ width: 60, textAlign: 'center' }}>نقاط</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.entries.map((team, idx) => {
                        const zone = getRankStyleAndText(activeLeague, team.rank);
                        return (
                          <motion.tr
                            key={team.team}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.04 }}
                            style={zone ? { backgroundColor: zone.bg } : undefined}
                          >
                            <td 
                              className="team-rank" 
                              style={zone ? { borderRight: zone.borderRight, textAlign: 'center' } : { textAlign: 'center' }}
                            >
                              <span 
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: 24,
                                  height: 24,
                                  borderRadius: '50%',
                                  background: team.rank === 1 ? 'rgba(251, 191, 36, 0.15)' : 'transparent',
                                  color: team.rank === 1 ? 'var(--accent)' : 'var(--text-secondary)',
                                  fontWeight: team.rank === 1 ? 'bold' : 'normal'
                                }}
                              >
                                {team.rank}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <div className="team-cell">
                                {team.logo && (
                                  <img 
                                    src={team.logo} 
                                    alt={team.team} 
                                    className="team-logo" 
                                    style={{ width: 24, height: 24 }} 
                                    onError={(e) => e.target.style.display = 'none'}
                                  />
                                )}
                                <span style={{ fontWeight: team.rank === 1 ? 700 : 'normal' }}>{team.team}</span>
                              </div>
                            </td>
                            <td className="stat-cell">{team.played}</td>
                            <td className="stat-cell" style={{ color: 'var(--primary)' }}>{team.win}</td>
                            <td className="stat-cell" style={{ color: 'var(--text-muted)' }}>{team.draw}</td>
                            <td className="stat-cell" style={{ color: 'var(--danger)' }}>{team.loss}</td>
                            <td className="stat-cell" style={{ direction: 'ltr', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                              {team.goalsFor}:{team.goalsAgainst}
                            </td>
                            <td className="stat-cell points">{team.points}</td>
                          </motion.tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* دليل الألوان والمراكز التأهيلية والهبوط في أسفل جدول كل دوري */}
                  {getLegendItems(activeLeague).length > 0 && (
                    <div className="standings-legend" style={{ 
                      display: 'flex', 
                      flexWrap: 'wrap', 
                      gap: '16px', 
                      padding: '16px 20px', 
                      borderTop: '1px solid var(--border-color)', 
                      backgroundColor: 'rgba(0, 0, 0, 0.15)',
                      fontSize: '0.75rem',
                      fontWeight: 500
                    }}>
                      {getLegendItems(activeLeague).map((item, idx) => (
                        <div key={idx} className="d-flex align-center gap-1">
                          <span style={{ 
                            display: 'inline-block', 
                            width: '10px', 
                            height: '10px', 
                            borderRadius: '2px', 
                            backgroundColor: item.color 
                          }}></span>
                          <span style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }

        /* تنسيقات التبويبات الفرعية للأدوار الإقصائية */
        .sub-tab-btn {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--border-color);
          color: var(--text-secondary);
          padding: 8px 20px;
          border-radius: var(--radius-full);
          font-family: inherit;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: all var(--transition-fast);
        }
        .sub-tab-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          color: var(--text-primary);
        }
        .sub-tab-btn.active {
          background: var(--primary);
          border-color: var(--primary);
          color: white;
          box-shadow: 0 0 12px var(--primary-glow);
        }

        /* تنسيق مخطط شجرة الإقصائيات */
        .bracket-scroll-container {
          overflow-x: auto;
          width: 100%;
          padding: 10px 0;
          direction: ltr; /* الحفاظ على اتجاه الشجرة القياسي من اليسار لليمين */
          margin-top: 10px;
        }
        .bracket-wrapper {
          display: flex;
          min-width: 950px;
          justify-content: space-between;
          height: 850px;
          padding: 24px;
          background: var(--bg-card);
          border-radius: var(--radius-md);
          border: 1px solid var(--border-color);
          backdrop-filter: var(--glass-blur);
          position: relative;
        }
        .bracket-column {
          display: flex;
          flex-direction: column;
          width: 215px;
        }
        .column-header {
          text-align: center;
          font-weight: 800;
          color: var(--accent);
          margin-bottom: 24px;
          font-size: 0.85rem;
          border-bottom: 1px solid var(--border-color);
          padding-bottom: 8px;
          font-family: 'Cairo', sans-serif;
          direction: rtl;
        }
        .matches-column-flow {
          display: flex;
          flex-direction: column;
          height: 100%;
          justify-content: space-around;
        }

        /* بطاقة مباراة الإقصائيات */
        .bracket-match-card {
          background: rgba(11, 15, 23, 0.55);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-sm);
          padding: 10px 12px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          transition: all var(--transition-fast);
          min-width: 200px;
          box-shadow: var(--shadow-sm);
        }
        .bracket-match-card:hover {
          border-color: var(--accent);
          box-shadow: 0 0 12px var(--accent-glow);
          background: rgba(251, 191, 36, 0.05);
        }
        .bracket-match-card.placeholder {
          justify-content: center;
          align-items: center;
          height: 75px;
          border-style: dashed;
          background: rgba(255, 255, 255, 0.02);
        }
        .bracket-match-card.highlighted {
          border-color: var(--primary);
          box-shadow: 0 0 12px var(--primary-glow);
          background: rgba(16, 185, 129, 0.07);
        }
        .bracket-match-card.live-border {
          border-color: var(--danger);
          box-shadow: 0 0 12px rgba(239, 68, 68, 0.25);
        }
        .match-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.65rem;
          color: var(--text-muted);
          font-weight: 700;
        }
        .live-dot {
          width: 6px;
          height: 6px;
          background: var(--danger);
          border-radius: 50%;
        }
        .bracket-team-row {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.8rem;
          color: var(--text-secondary);
          justify-content: space-between;
        }
        .bracket-team-row.winner {
          color: var(--text-primary);
          font-weight: 700;
        }
        .bracket-team-logo {
          width: 18px;
          height: 18px;
          object-fit: contain;
        }
        .bracket-team-info {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 1;
          min-width: 0;
        }
        .bracket-team-name {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          text-align: left;
        }
        .bracket-team-score {
          font-weight: 700;
          color: var(--text-primary);
          font-family: monospace;
          font-size: 0.9rem;
        }
        .special-round-label {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 0.75rem;
          font-weight: 800;
          color: var(--accent);
          margin-bottom: 6px;
          direction: rtl;
        }
        .final-match-wrapper {
          display: flex;
          flex-direction: column;
        }
      `}</style>
    </div>
  );
};

export default LeagueStandings;
