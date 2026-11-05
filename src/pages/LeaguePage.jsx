import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowRight, 
  Calendar, 
  Trophy, 
  Users, 
  Globe, 
  Clock, 
  AlertCircle, 
  RefreshCw, 
  ChevronLeft,
  CalendarDays
} from 'lucide-react';
import LeagueStandings from '../components/LeagueStandings';
import { getStandings } from '../services/footballService';
import { EgyptianDisclaimer, EgyptianBadge } from '../components/EgyptianDisclaimer';

const LeaguePage = ({ matches = [], leagues = [], onMatchClick }) => {
  const { leagueId } = useParams();
  const navigate = useNavigate();

  // التحقق من صلاحية معرف البطولة ضد قائمة البطولات المعتمدة
  const league = useMemo(() => {
    return leagues.find((l) => l.id === leagueId);
  }, [leagues, leagueId]);

  // حالة التبويب النشط في الصفحة
  const [activeTab, setActiveTab] = useState('standings'); // 'standings' | 'matches' | 'teams'

  // حالة بيانات الترتيب والموسم (مالك الطلب الأوحد لمنع تكرار جلب البيانات)
  const [standings, setStandings] = useState([]);
  const [loadingStandings, setLoadingStandings] = useState(true);
  const [errorStandings, setErrorStandings] = useState(null);

  // الرجوع الآمن للصفحة السابقة أو العودة للترتيب العام
  const handleSafeBack = () => {
    const hasInternalHistory = window.history.state && typeof window.history.state.idx === 'number' && window.history.state.idx > 0;
    if (hasInternalHistory) {
      navigate(-1);
    } else {
      navigate('/standings?league=' + (leagueId || 'eng.1'));
    }
  };

  // جلب بيانات الترتيب والموسم مرة واحدة فقط
  useEffect(() => {
    if (!league) return;

    let isMounted = true;
    const fetchLeagueData = async () => {
      setLoadingStandings(true);
      setErrorStandings(null);
      try {
        const data = await getStandings(leagueId);
        if (isMounted) {
          setStandings(data);
        }
      } catch (err) {
        if (isMounted) {
          console.error('Error fetching league data:', err);
          setErrorStandings('تعذر جلب بيانات البطولة، يرجى المحاولة مرة أخرى.');
        }
      } finally {
        if (isMounted) {
          setLoadingStandings(false);
        }
      }
    };

    fetchLeagueData();
    return () => {
      isMounted = false;
    };
  }, [leagueId, league]);

  // استخراج البيانات الوصفية للموسم من كائن المجموعة الأولى group.season حصراً
  const seasonMetadata = useMemo(() => {
    if (!standings || standings.length === 0) return null;
    return standings[0]?.season || null;
  }, [standings]);

  // تصفية مباريات اليوم الخاصة بهذه البطولة من المصفوفة المركزية matches بدون أي طلب شبكة إضافي
  const todayLeagueMatches = useMemo(() => {
    if (!matches || matches.length === 0) return [];
    return matches.filter((m) => m.leagueId === leagueId);
  }, [matches, leagueId]);

  // حساب إجمالي الفرق المشاركة عبر جميع المجموعات بأمان تام
  const totalTeamsCount = useMemo(() => {
    if (!standings || standings.length === 0) return 0;
    return standings.reduce((acc, group) => acc + (group.entries?.length || 0), 0);
  }, [standings]);

  // حالة معرف البطولة غير الصالح
  if (!league) {
    return (
      <div className="league-page-container">
        <div className="league-top-bar">
          <button
            type="button"
            onClick={handleSafeBack}
            className="action-btn d-flex align-center gap-1"
            style={{ width: 'auto', padding: '8px 16px', fontSize: '0.85rem', fontWeight: 700 }}
          >
            <ArrowRight size={16} />
            <span>العودة</span>
          </button>
        </div>

        <div className="glass-card empty-state" style={{ padding: '60px 20px', textAlign: 'center', marginTop: 24 }}>
          <AlertCircle size={44} color="var(--danger)" style={{ marginBottom: 16 }} />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: 8 }}>البطولة غير متوفرة</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: 440, margin: '0 auto 20px' }}>
            معرف البطولة المدخل في الرابط غير صحيح أو غير مدرج ضمن بطولات منصة كورة سكور المعتمدة.
          </p>
          <div className="d-flex align-center justify-center gap-2">
            <Link to="/standings" className="tab-btn active">
              جدول الترتيب العام
            </Link>
            <Link to="/matches" className="tab-btn">
              جدول المباريات
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="league-page-container">
      {/* 1. شريط التنقل العلوي وزر الرجوع الآمن والمسار التراكمي */}
      <div className="league-top-bar">
        <button
          type="button"
          onClick={handleSafeBack}
          className="action-btn d-flex align-center gap-1"
          style={{ width: 'auto', padding: '8px 16px', fontSize: '0.85rem', fontWeight: 700 }}
          title="العودة للصفحة السابقة"
        >
          <ArrowRight size={16} />
          <span>العودة</span>
        </button>

        <nav className="league-breadcrumbs" aria-label="مسار التنقل">
          <Link to="/">الرئيسية</Link>
          <span className="crumb-sep">/</span>
          <Link to="/standings">الدوريات</Link>
          <span className="crumb-sep">/</span>
          <span className="crumb-current">{league.name}</span>
        </nav>
      </div>

      {/* 2. بطاقة هوية البطولة المتميزة (League Hero Card) */}
      <div className="league-hero-card">
        <div className="league-hero-main">
          {league.logo && (
            <div className="league-hero-logo-box">
              <img
                src={league.logo}
                alt={league.name}
                className="league-hero-logo"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            </div>
          )}

          <div className="league-hero-info">
            <div className="d-flex align-center gap-2 flex-wrap" style={{ marginBottom: 4 }}>
              <h1 className="league-hero-title">{league.name}</h1>
              {leagueId === 'egypt.1' && <EgyptianBadge />}
            </div>

            <div className="league-hero-badges">
              {/* دولة البطولة */}
              {league.country && (
                <span className="league-badge">
                  <Globe size={13} color="var(--primary)" />
                  <span>{league.country}</span>
                </span>
              )}

              {/* شارة بيانات تجريبية للدوري المصري */}
              {leagueId === 'egypt.1' && (
                <span className="league-badge season-badge" style={{ borderColor: 'var(--accent)' }}>
                  <AlertCircle size={13} color="var(--accent)" />
                  <span>بيانات تجريبية</span>
                </span>
              )}

              {/* سنة الموسم إن وجدت */}
              {seasonMetadata?.year && (
                <span className="league-badge season-badge">
                  <CalendarDays size={13} color="var(--accent)" />
                  <span>موسم {seasonMetadata.year}</span>
                </span>
              )}

              {/* اسم الموسم الرسمي من المصدر إن وجد */}
              {seasonMetadata?.displayName && (
                <span className="league-badge display-name-badge" title={seasonMetadata.displayName}>
                  <span>{seasonMetadata.displayName}</span>
                </span>
              )}

              {/* عدد الأندية المشاركة */}
              {totalTeamsCount > 0 && (
                <span className="league-badge teams-count-badge">
                  <Users size={13} color="var(--text-secondary)" />
                  <span>{totalTeamsCount} نادياً</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* أزرار التحويل السريع للجدول الشامل */}
        <div className="league-hero-actions">
          <Link
            to={`/matches?league=${leagueId}`}
            className="league-action-link"
            title="تصفح جميع مواعيد وجولات البطولة"
          >
            <Calendar size={15} />
            <span>جدول كل المواعيد</span>
          </Link>
          <Link
            to={`/standings?league=${leagueId}`}
            className="league-action-link secondary"
            title="مقارنة الترتيب في شاشة الدوريات"
          >
            <Trophy size={15} />
            <span>عرض في المقارنة</span>
          </Link>
        </div>
      </div>

      {/* تنبيه البيانات التجريبية للدوري المصري */}
      {leagueId === 'egypt.1' && (
        <div style={{ marginTop: 14 }}>
          <EgyptianDisclaimer />
        </div>
      )}

      {/* 3. شريط ألسنة / تبويبات أقسام الصفحة الداخلية */}
      <div className="league-sub-tabs">
        <button
          type="button"
          className={`league-sub-tab-btn ${activeTab === 'standings' ? 'active' : ''}`}
          onClick={() => setActiveTab('standings')}
        >
          <Trophy size={16} />
          <span>جدول الترتيب</span>
        </button>

        <button
          type="button"
          className={`league-sub-tab-btn ${activeTab === 'matches' ? 'active' : ''}`}
          onClick={() => setActiveTab('matches')}
        >
          <Calendar size={16} />
          <span>مباريات اليوم</span>
          {todayLeagueMatches.length > 0 && (
            <span className="league-tab-badge">{todayLeagueMatches.length}</span>
          )}
        </button>

        <button
          type="button"
          className={`league-sub-tab-btn ${activeTab === 'teams' ? 'active' : ''}`}
          onClick={() => setActiveTab('teams')}
        >
          <Users size={16} />
          <span>الأندية المشاركة</span>
          {totalTeamsCount > 0 && (
            <span className="league-tab-badge">{totalTeamsCount}</span>
          )}
        </button>
      </div>

      {/* 4. محتوى التبويب النشط */}
      <div className="league-tab-content">
        {/* التبويب الأول: جدول الترتيب والأدوار الإقصائية (إعادة استخدام كاملة للمكون الأصلي دون تكرار للطلب) */}
        {activeTab === 'standings' && (
          <div className="league-standings-section">
            {errorStandings ? (
              <div className="glass-card empty-state" style={{ padding: '40px 20px', textAlign: 'center' }}>
                <AlertCircle size={32} color="var(--danger)" style={{ marginBottom: 12 }} />
                <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>{errorStandings}</p>
                <button
                  type="button"
                  onClick={() => {
                    setLoadingStandings(true);
                    getStandings(leagueId).then(setStandings).catch(() => setErrorStandings('فشلت إعادة المحاولة.')).finally(() => setLoadingStandings(false));
                  }}
                  className="tab-btn active"
                >
                  <RefreshCw size={14} />
                  <span>إعادة المحاولة</span>
                </button>
              </div>
            ) : (
              <LeagueStandings
                activeLeague={leagueId}
                standingsData={standings}
                loading={loadingStandings}
                hideLeagueSelector={true}
                showTitle={false}
                onMatchClick={onMatchClick}
              />
            )}
          </div>
        )}

        {/* التبويب الثاني: مباريات اليوم الخاصة بهذه البطولة */}
        {activeTab === 'matches' && (
          <div className="league-matches-section">
            <div className="d-flex align-center justify-between" style={{ marginBottom: 14 }}>
              <h3 className="section-title" style={{ margin: 0 }}>
                <Clock size={18} color="var(--primary)" />
                <span>مباريات اليوم في {league.name}</span>
                <span className="section-badge-count">{todayLeagueMatches.length}</span>
              </h3>

              <Link
                to={`/matches?league=${leagueId}`}
                className="d-flex align-center gap-1"
                style={{ fontSize: '0.82rem', color: 'var(--primary)', textDecoration: 'none', fontWeight: 700 }}
              >
                <span>تصفح تواريخ أخرى</span>
                <ChevronLeft size={16} />
              </Link>
            </div>

            {todayLeagueMatches.length === 0 ? (
              <div className="glass-card empty-state" style={{ padding: '50px 20px', textAlign: 'center' }}>
                <Clock size={36} className="empty-icon" style={{ marginBottom: 12 }} />
                <h4 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: 6 }}>لا توجد مباريات لهذه البطولة اليوم</h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: 460, margin: '0 auto 18px' }}>
                  لم يتم جدولة أي مباريات جارية أو قادمة لـ {league.name} في تاريخ اليوم المحدد. يمكنك مراجعة جدول المباريات العام لاختيار أيام سابقة أو قادمة.
                </p>
                <Link to={`/matches?league=${leagueId}`} className="tab-btn active" style={{ display: 'inline-flex' }}>
                  <Calendar size={15} />
                  <span>فتح جدول المباريات للبطولة</span>
                </Link>
              </div>
            ) : (
              <div className="d-flex flex-column gap-2">
                {todayLeagueMatches.map((match) => (
                  <motion.div
                    key={match.id}
                    className="match-row-card"
                    onClick={() => onMatchClick(match)}
                    whileHover={{ scale: 1.003 }}
                    transition={{ duration: 0.12 }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onMatchClick(match); }}
                    aria-label={`${match.homeTeam} ضد ${match.awayTeam}`}
                  >
                    {/* الفريق المستضيف */}
                    <div className="match-team-home">
                      {match.homeLogo && (
                        <img
                          src={match.homeLogo}
                          alt={match.homeTeam}
                          className="team-logo"
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      )}
                      <span className="team-name" title={match.homeTeam}>{match.homeTeam}</span>
                    </div>

                    {/* النتيجة والتوقيت */}
                    <div className="match-score-center">
                      <div className="score-display-pill">
                        {match.status === 'NS' ? (
                          <span className="match-time-text">{match.time}</span>
                        ) : (
                          <>
                            <span className="score-num">{match.homeScore}</span>
                            <span className="score-sep">-</span>
                            <span className="score-num">{match.awayScore}</span>
                          </>
                        )}
                      </div>

                      {match.status === 'LIVE' && (
                        <span className="match-status-tag live">
                          <span className="live-dot" />
                          <span><bdi>{String(match.minute ?? '').replace(/['"’`]/g, '').trim()}</bdi> د</span>
                        </span>
                      )}
                      {match.status === 'FT' && (
                        <span className="match-status-tag ft">انتهت</span>
                      )}
                    </div>

                    {/* الفريق الضيف */}
                    <div className="match-team-away">
                      <span className="team-name" title={match.awayTeam}>{match.awayTeam}</span>
                      {match.awayLogo && (
                        <img
                          src={match.awayLogo}
                          alt={match.awayTeam}
                          className="team-logo"
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      )}
                    </div>
                  </motion.div>
                ))}

                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: 8 }}>
                  ملاحظة: هذه المباريات تخص اليوم الحالي فقط. لمتابعة جدول مواعيد الجولات الأخرى يرجى زيارة{' '}
                  <Link to={`/matches?league=${leagueId}`} style={{ color: 'var(--primary)', fontWeight: 700 }}>
                    جدول مباريات البطولة الكامل
                  </Link>.
                </p>
              </div>
            )}
          </div>
        )}

        {/* التبويب الثالث: الأندية المشاركة */}
        {activeTab === 'teams' && (
          <div className="league-teams-section">
            <div className="d-flex align-center justify-between" style={{ marginBottom: 14 }}>
              <h3 className="section-title" style={{ margin: 0 }}>
                <Users size={18} color="var(--primary)" />
                <span>أندية {league.name}</span>
                <span className="section-badge-count">{totalTeamsCount}</span>
              </h3>
            </div>

            {loadingStandings ? (
              <div className="league-teams-grid">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="league-team-card skeleton-pulse" style={{ height: 90 }} />
                ))}
              </div>
            ) : standings.length === 0 ? (
              <div className="glass-card empty-state" style={{ padding: '40px 20px', textAlign: 'center' }}>
                <p style={{ color: 'var(--text-muted)' }}>بيانات أندية هذه البطولة غير متوفرة حالياً.</p>
              </div>
            ) : (
              <div className="d-flex flex-column gap-4">
                {standings.map((group, gIdx) => (
                  <div key={gIdx} className="league-teams-group">
                    {/* إظهار اسم المجموعة إذا كانت البطولة بنظام المجموعات (كأس العالم) */}
                    {standings.length > 1 && (
                      <h4
                        style={{
                          fontSize: '1rem',
                          fontWeight: 800,
                          color: 'var(--accent)',
                          marginBottom: 12,
                          paddingBottom: 6,
                          borderBottom: '1px solid var(--border-color)'
                        }}
                      >
                        {group.name}
                      </h4>
                    )}

                    <div className="league-teams-grid">
                      {group.entries.map((team, tIdx) => {
                        const hasValidTeamId = team.teamId !== null && team.teamId !== undefined && String(team.teamId).trim() !== '' && String(team.teamId).trim() !== 'null' && String(team.teamId).trim() !== 'undefined';
                        
                        const cardBody = (
                          <>
                            <div className="league-team-card-top">
                              {team.logo ? (
                                <img
                                  src={team.logo}
                                  alt={team.team}
                                  className="league-team-logo"
                                  onError={(e) => { e.target.style.display = 'none'; }}
                                />
                              ) : (
                                <div className="league-team-logo-placeholder">
                                  {team.team.charAt(0)}
                                </div>
                              )}

                              <div className="league-team-card-info">
                                <span className="league-team-card-name" title={team.team}>
                                  {team.team}
                                </span>
                                <span className="league-team-card-stats">
                                  لعب: {team.played} | فاز: {team.win} | تعادل: {team.draw}
                                </span>
                              </div>
                            </div>

                            <div className="league-team-card-bottom">
                              <span className="league-team-rank-pill">
                                المركز {team.rank}
                              </span>
                              <span className="league-team-points-pill">
                                {team.points} نقطة
                              </span>
                            </div>
                          </>
                        );

                        if (hasValidTeamId) {
                          return (
                            <Link
                              key={team.teamId}
                              to={`/team/${team.teamId}?league=${leagueId}`}
                              state={{ leagueId, team }}
                              className="league-team-card clickable"
                              style={{ textDecoration: 'none', color: 'inherit' }}
                            >
                              {cardBody}
                            </Link>
                          );
                        }

                        return (
                          <div
                            key={`static-${team.team}-${tIdx}`}
                            className="league-team-card non-clickable"
                          >
                            {cardBody}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LeaguePage;

