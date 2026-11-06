import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useSearchParams, useLocation, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Trophy,
  Calendar,
  Users,
  MapPin,
  Clock,
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  Activity,
  Flame,
  Shield,
  Percent,
  TrendingUp,
  Hash
} from 'lucide-react';
import {
  getTeamDetails,
  getTeamSchedule,
  getTeamRoster,
  getStandings
} from '../services/footballService';
import FavoriteButton from '../components/FavoriteButton';
import { EgyptianDisclaimer, EgyptianBadge } from '../components/EgyptianDisclaimer';

const TeamPage = ({ matches = [], leagues = [], onMatchClick }) => {
  const { teamId } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  // التحقق المبدئي الصارم من صلاحية معرف النادي
  const isValidTeamId = Boolean(
    teamId &&
    teamId !== 'null' &&
    teamId !== 'undefined' &&
    String(teamId).trim() !== '' &&
    String(teamId).trim() !== 'NaN'
  );

  // التبويب النشط
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'schedule' | 'squad' | 'today'

  // بيانات النادي
  const [teamDetails, setTeamDetails] = useState(() => {
    // استخدام البيانات التمهيدية الممررة عبر الحالة للتسريع البصري إن وجدت
    if (location.state?.team && String(location.state.team.teamId) === String(teamId)) {
      return {
        id: String(teamId),
        name: location.state.team.team,
        shortName: location.state.team.team,
        abbreviation: '',
        logo: location.state.team.logo || '',
        venue: null,
        defaultLeague: null
      };
    }
    return null;
  });
  const [loadingTeam, setLoadingTeam] = useState(true);
  const [errorTeam, setErrorTeam] = useState(null);

  // حل وتحديد معرف البطولة المعنية
  const queryLeague = searchParams.get('league');
  const stateLeague = location.state?.leagueId;

  const resolvedLeagueId = useMemo(() => {
    // 1. إذا كان فريقاً مصرياً محاكياً
    if (String(teamId).startsWith('egy-team-')) {
      return 'egypt.1';
    }
    // 2. معامل الرابط ?league=
    if (queryLeague && leagues.some(l => l.id.toLowerCase() === queryLeague.toLowerCase())) {
      return leagues.find(l => l.id.toLowerCase() === queryLeague.toLowerCase())?.id || queryLeague;
    }
    // 3. الحالة المنقولة عبر التنقل الداخلي
    if (stateLeague && leagues.some(l => l.id.toLowerCase() === stateLeague.toLowerCase())) {
      return leagues.find(l => l.id.toLowerCase() === stateLeague.toLowerCase())?.id || stateLeague;
    }
    // 4. استنتاج البطولة الافتراضية للنادي من تفاصيل ESPN
    if (teamDetails?.defaultLeague?.midsizeName) {
      const mid = teamDetails.defaultLeague.midsizeName.toLowerCase();
      const matched = leagues.find(l => l.id.toLowerCase() === mid);
      if (matched) return matched.id;
    }
    return queryLeague || stateLeague || null;
  }, [teamId, queryLeague, stateLeague, leagues, teamDetails]);

  // كائن البطولة المعتمدة
  const league = useMemo(() => {
    if (!resolvedLeagueId) return null;
    return leagues.find(l => l.id.toLowerCase() === resolvedLeagueId.toLowerCase()) || null;
  }, [leagues, resolvedLeagueId]);

  // هل الفريق تابع للدوري المصري ذو البيانات التجريبية
  const isEgyptian = useMemo(() => {
    return resolvedLeagueId === 'egypt.1' || String(teamId).startsWith('egy-team-');
  }, [resolvedLeagueId, teamId]);

  // جدول الترتيب وإحصائيات النادي من الترتيب
  const [standings, setStandings] = useState([]);
  const [loadingStandings, setLoadingStandings] = useState(false);

  // جدول المباريات والنتائج الأخيرة
  const [schedule, setSchedule] = useState([]);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [errorSchedule, setErrorSchedule] = useState(null);

  // قائمة اللاعبين (تحميل كسلان Lazy Loading فقط عند فتح التبويب)
  const [roster, setRoster] = useState(null);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [errorRoster, setErrorRoster] = useState(null);

  // الرجوع الآمن للصفحة السابقة
  const handleSafeBack = () => {
    const hasInternalHistory = window.history.state && typeof window.history.state.idx === 'number' && window.history.state.idx > 0;
    if (hasInternalHistory) {
      navigate(-1);
    } else if (resolvedLeagueId) {
      navigate(`/league/${resolvedLeagueId}`);
    } else {
      navigate('/standings');
    }
  };

  // 1. جلب هوية وتفاصيل النادي الأساسية
  useEffect(() => {
    if (!isValidTeamId) return;

    let isMounted = true;
    const fetchTeamInfo = async () => {
      setLoadingTeam(true);
      setErrorTeam(null);
      try {
        const details = await getTeamDetails(teamId);
        if (isMounted) {
          if (!details) {
            setErrorTeam('تعذر العثور على بيانات هذا الفريق أو قد لا يكون مسجلاً في السجلات الرياضية.');
          } else {
            setTeamDetails(prev => ({ ...prev, ...details }));
          }
        }
      } catch (err) {
        if (isMounted) {
          console.error('Failed to fetch team details:', err);
          setErrorTeam('حدث خطأ أثناء جلب تفاصيل الفريق.');
        }
      } finally {
        if (isMounted) setLoadingTeam(false);
      }
    };

    fetchTeamInfo();
    return () => { isMounted = false; };
  }, [teamId, isValidTeamId]);

  // 2. جلب الترتيب العام لاستخراج إحصائيات النادي في البطولة
  useEffect(() => {
    if (!resolvedLeagueId) return;

    let isMounted = true;
    const fetchLeagueStandings = async () => {
      setLoadingStandings(true);
      try {
        const data = await getStandings(resolvedLeagueId);
        if (isMounted) {
          setStandings(data || []);
        }
      } catch (err) {
        if (isMounted) console.error('Failed to load standings for team:', err);
      } finally {
        if (isMounted) setLoadingStandings(false);
      }
    };

    fetchLeagueStandings();
    return () => { isMounted = false; };
  }, [resolvedLeagueId]);

  // 3. جلب نتائج ومباريات النادي الأخيرة
  useEffect(() => {
    if (!isValidTeamId || !resolvedLeagueId) return;

    let isMounted = true;
    const fetchTeamMatches = async () => {
      setLoadingSchedule(true);
      setErrorSchedule(null);
      try {
        const data = await getTeamSchedule(resolvedLeagueId, teamId);
        if (isMounted) {
          setSchedule(data || []);
        }
      } catch (err) {
        if (isMounted) {
          console.error('Failed to load team schedule:', err);
          setErrorSchedule('تعذر جلب سجل مباريات الفريق.');
        }
      } finally {
        if (isMounted) setLoadingSchedule(false);
      }
    };

    fetchTeamMatches();
    return () => { isMounted = false; };
  }, [isValidTeamId, resolvedLeagueId, teamId]);

  // 4. التحميل الكسلان لقائمة اللاعبين عند فتح تبويب 'squad' لأول مرة
  const loadRosterLazy = useCallback(async () => {
    if (roster !== null || loadingRoster || !isValidTeamId || !resolvedLeagueId) return;

    setLoadingRoster(true);
    setErrorRoster(null);
    try {
      const data = await getTeamRoster(resolvedLeagueId, teamId);
      setRoster(data || []);
    } catch (err) {
      console.error('Failed to lazy load roster:', err);
      setErrorRoster('تعذر جلب قائمة لاعبي الفريق، يرجى المحاولة مرة أخرى.');
    } finally {
      setLoadingRoster(false);
    }
  }, [roster, loadingRoster, isValidTeamId, resolvedLeagueId, teamId]);

  useEffect(() => {
    if (activeTab === 'squad') {
      loadRosterLazy();
    }
  }, [activeTab, loadRosterLazy]);

  // استخراج إحصائيات النادي المباشرة من جدول الترتيب
  const teamStanding = useMemo(() => {
    if (!standings || standings.length === 0) return null;
    for (const group of standings) {
      const found = group.entries?.find(e => String(e.teamId) === String(teamId));
      if (found) {
        return {
          ...found,
          groupName: group.name,
          season: group.season
        };
      }
    }
    return null;
  }, [standings, teamId]);

  // حساب المقاييس الرقمية الموثوقة من الترتيب
  const metrics = useMemo(() => {
    if (!teamStanding) return null;
    const played = teamStanding.played || 0;
    const win = teamStanding.win || 0;
    const draw = teamStanding.draw || 0;
    const loss = teamStanding.loss || 0;
    const goalsFor = teamStanding.goalsFor || 0;
    const goalsAgainst = teamStanding.goalsAgainst || 0;
    const goalDiff = goalsFor - goalsAgainst;
    const points = teamStanding.points || 0;
    const rank = teamStanding.rank || '-';

    const winRate = played > 0 ? Math.round((win / played) * 100) : 0;
    const ptsPerMatch = played > 0 ? (points / played).toFixed(2) : '0.00';

    return {
      rank,
      points,
      played,
      win,
      draw,
      loss,
      goalsFor,
      goalsAgainst,
      goalDiff,
      winRate,
      ptsPerMatch
    };
  }, [teamStanding]);

  // التحقق من وجود مباراة للنادي في اليوم الحالي من المصفوفة المركزية matches (بدون أي طلب شبكة إضافي)
  const todayTeamMatch = useMemo(() => {
    if (!matches || matches.length === 0 || !isValidTeamId) return null;
    return matches.find(m => String(m.homeTeamId) === String(teamId) || String(m.awayTeamId) === String(teamId)) || null;
  }, [matches, teamId, isValidTeamId]);

  // تقسيم قائمة اللاعبين حسب المراكز التكتيكية
  const groupedRoster = useMemo(() => {
    if (!roster || roster.length === 0) {
      return { goalkeepers: [], defenders: [], midfielders: [], forwards: [], other: [] };
    }
    return {
      goalkeepers: roster.filter(p => p.positionGroup === 'goalkeepers'),
      defenders: roster.filter(p => p.positionGroup === 'defenders'),
      midfielders: roster.filter(p => p.positionGroup === 'midfielders'),
      forwards: roster.filter(p => p.positionGroup === 'forwards'),
      other: roster.filter(p => p.positionGroup === 'other')
    };
  }, [roster]);

  // معالجة النقر على صف المباراة المباشرة بأمان
  const handleMatchRowClick = (match) => {
    if (onMatchClick && match) {
      onMatchClick(match);
    }
  };

  // حالة الخطأ: معرف النادي غير صالح
  if (!isValidTeamId) {
    return (
      <div className="team-page-container">
        <div className="team-top-bar">
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
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: 8 }}>معرف النادي غير صالح</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: 440, margin: '0 auto 20px' }}>
            الرابط الذي تحاول الوصول إليه لا يحتوي على معرف صحيح لنادٍ معتمد. يرجى اختيار النادي من جدول ترتيب البطولة.
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

  // حالة الخطأ: فشل جلب تفاصيل الفريق الأساسية
  if (errorTeam && !teamDetails) {
    return (
      <div className="team-page-container">
        <div className="team-top-bar">
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
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: 8 }}>بيانات النادي غير متوفرة</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: 460, margin: '0 auto 20px' }}>
            {errorTeam}
          </p>
          <div className="d-flex align-center justify-center gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="tab-btn active"
            >
              <RefreshCw size={14} />
              <span>إعادة المحاولة</span>
            </button>
            <Link to="/standings" className="tab-btn">
              جدول الدوريات
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // حالة التحميل التمهيدي عند فتح الرابط المباشر دون بيانات سابقة
  if (loadingTeam && !teamDetails) {
    return (
      <div className="team-page-container">
        <div className="team-top-bar">
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

        <div className="team-hero-card skeleton-pulse" style={{ height: 130, marginTop: 8 }} />
        <div className="team-metrics-grid" style={{ marginTop: 16 }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="team-metric-box skeleton-pulse" style={{ height: 85 }} />
          ))}
        </div>
      </div>
    );
  }

  const teamName = teamDetails?.name || 'نادي كروي';
  const teamLogo = teamDetails?.logo || '';

  return (
    <div className="team-page-container">
      {/* 1. شريط التنقل العلوي وزر الرجوع الآمن والمسار التراكمي */}
      <div className="team-top-bar">
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

        <nav className="team-breadcrumbs" aria-label="مسار التنقل">
          <Link to="/">الرئيسية</Link>
          <span className="crumb-sep">/</span>
          <Link to="/standings">الدوريات</Link>
          {league && (
            <>
              <span className="crumb-sep">/</span>
              <Link to={`/league/${league.id}`}>{league.name}</Link>
            </>
          )}
          <span className="crumb-sep">/</span>
          <span className="crumb-current">{teamName}</span>
        </nav>
      </div>

      {/* 2. بطاقة هوية النادي المتميزة (Team Hero Card) */}
      <div className="team-hero-card">
        <div className="team-hero-main">
          <div className="team-hero-logo-box">
            {teamLogo ? (
              <img
                src={teamLogo}
                alt={teamName}
                className="team-hero-logo"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            ) : (
              <div className="team-hero-logo-placeholder">
                {teamName.charAt(0)}
              </div>
            )}
          </div>

          <div className="team-hero-info">
            <div className="d-flex align-center gap-2 flex-wrap" style={{ marginBottom: 6 }}>
              <h1 className="team-hero-title">{teamName}</h1>
              {isEgyptian && <EgyptianBadge />}
              {teamDetails?.abbreviation && (
                <span className="team-badge code-badge">{teamDetails.abbreviation}</span>
              )}
            </div>

            <div className="team-hero-badges">
              {/* شارة البطولة المشارك بها النادي مع رابط مباشر إليها */}
              {league && (
                <Link
                  to={`/league/${league.id}`}
                  className="team-badge league-badge-link"
                  title={`عرض تفاصيل بطولة ${league.name}`}
                >
                  <Trophy size={13} color="var(--primary)" />
                  <span>{league.name}</span>
                </Link>
              )}

              {/* شارة بيانات تجريبية */}
              {isEgyptian && (
                <span className="team-badge" style={{ borderColor: 'var(--accent)', background: 'var(--accent-light)', color: 'var(--accent)' }}>
                  <AlertCircle size={13} color="var(--accent)" />
                  <span>بيانات تجريبية</span>
                </span>
              )}

              {/* شارة الملعب واسمه وسعته إن وجدت */}
              {teamDetails?.venue?.name && (
                <span className="team-badge venue-badge" title={`ملعب ${teamDetails.venue.name}`}>
                  <MapPin size={13} color="var(--accent)" />
                  <span>{teamDetails.venue.name}</span>
                  {teamDetails.venue.capacity && (
                    <span className="capacity-text">
                      ({teamDetails.venue.capacity.toLocaleString('ar-EG')} متفرج)
                    </span>
                  )}
                </span>
              )}

              {/* شارة المدينة */}
              {teamDetails?.venue?.city && (
                <span className="team-badge city-badge">
                  <span>{teamDetails.venue.city}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* أزرار الإجراءات السريعة في بطاقة الهوية */}
        <div className="team-hero-actions">
          <FavoriteButton
            type="team"
            item={{
              id: teamId,
              name: teamName,
              arabicName: teamName,
              leagueId: resolvedLeagueId || (isEgyptian ? 'egypt.1' : ''),
              leagueName: league?.name || (isEgyptian ? 'الدوري المصري الممتاز' : ''),
              logo: teamLogo,
              isMock: isEgyptian
            }}
            size={15}
            showLabel
          />
          {resolvedLeagueId && (
            <Link
              to={`/league/${resolvedLeagueId}`}
              className="team-action-link"
              title="تصفح ترتيب البطولة والأندية المنافسة"
            >
              <Trophy size={15} />
              <span>ترتيب البطولة</span>
            </Link>
          )}
          {resolvedLeagueId && (
            <Link
              to={`/matches?league=${resolvedLeagueId}`}
              className="team-action-link secondary"
              title="مواعيد مباريات البطولة كاملة"
            >
              <Calendar size={15} />
              <span>مباريات البطولة</span>
            </Link>
          )}
        </div>
      </div>

      {/* تنبيه البيانات التجريبية للدوري المصري */}
      {isEgyptian && (
        <div style={{ marginTop: 14 }}>
          <EgyptianDisclaimer />
        </div>
      )}

      {/* 3. شريط ألسنة وتبويبات أقسام الصفحة */}
      <div className="team-sub-tabs">
        <button
          type="button"
          className={`team-sub-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <Activity size={16} />
          <span>نظرة عامة والترتيب</span>
        </button>

        <button
          type="button"
          className={`team-sub-tab-btn ${activeTab === 'schedule' ? 'active' : ''}`}
          onClick={() => setActiveTab('schedule')}
        >
          <Calendar size={16} />
          <span>المباريات الأخيرة</span>
          {schedule.length > 0 && (
            <span className="team-tab-badge">{schedule.length}</span>
          )}
        </button>

        <button
          type="button"
          className={`team-sub-tab-btn ${activeTab === 'squad' ? 'active' : ''}`}
          onClick={() => setActiveTab('squad')}
        >
          <Users size={16} />
          <span>قائمة اللاعبين</span>
          {roster && roster.length > 0 && (
            <span className="team-tab-badge">{roster.length}</span>
          )}
        </button>

        {todayTeamMatch && (
          <button
            type="button"
            className={`team-sub-tab-btn live-tab ${activeTab === 'today' ? 'active' : ''}`}
            onClick={() => setActiveTab('today')}
          >
            <Flame size={16} color="var(--live)" className="animate-pulse" />
            <span>مباراة اليوم</span>
            <span className="team-tab-badge live">1</span>
          </button>
        )}
      </div>

      {/* 4. محتوى التبويب النشط */}
      <div className="team-tab-content">
        {/* ========================================== */}
        {/* التبويب الأول: نظرة عامة والترتيب والإحصائيات */}
        {/* ========================================== */}
        {activeTab === 'overview' && (
          <div className="team-overview-section">
            {/* مباراة اليوم البارزة إن وجدت */}
            {todayTeamMatch && (
              <div className="team-today-match-banner" style={{ marginBottom: 20 }}>
                <div className="d-flex align-center justify-between" style={{ marginBottom: 10 }}>
                  <div className="d-flex align-center gap-2">
                    <span className="live-dot" />
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0, color: 'var(--live)' }}>
                      مباراة اليوم المباشرة
                    </h3>
                  </div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    اضغط لعرض التفاصيل والأحداث
                  </span>
                </div>

                <div
                  className="match-row-card"
                  onClick={() => handleMatchRowClick(todayTeamMatch)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleMatchRowClick(todayTeamMatch); }}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="match-team-home">
                    {todayTeamMatch.homeLogo && (
                      <img
                        src={todayTeamMatch.homeLogo}
                        alt={todayTeamMatch.homeTeam}
                        className="team-logo"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    )}
                    <span className="team-name" style={{ fontWeight: todayTeamMatch.homeTeamId === teamId ? 900 : 600 }}>
                      {todayTeamMatch.homeTeam}
                    </span>
                  </div>

                  <div className="match-score-center">
                    <div className="score-display-pill">
                      {todayTeamMatch.status === 'NS' ? (
                        <span className="match-time-text">{todayTeamMatch.time}</span>
                      ) : (
                        <>
                          <span className="score-num">{todayTeamMatch.homeScore}</span>
                          <span className="score-sep">-</span>
                          <span className="score-num">{todayTeamMatch.awayScore}</span>
                        </>
                      )}
                    </div>

                    {todayTeamMatch.status === 'LIVE' && (
                      <span className="match-status-tag live">
                        <span className="live-dot" />
                        <span><bdi>{String(todayTeamMatch.minute ?? '').replace(/['"’`]/g, '').trim()}</bdi> د</span>
                      </span>
                    )}
                    {todayTeamMatch.status === 'FT' && (
                      <span className="match-status-tag ft">انتهت</span>
                    )}
                  </div>

                  <div className="match-team-away">
                    <span className="team-name" style={{ fontWeight: todayTeamMatch.awayTeamId === teamId ? 900 : 600 }}>
                      {todayTeamMatch.awayTeam}
                    </span>
                    {todayTeamMatch.awayLogo && (
                      <img
                        src={todayTeamMatch.awayLogo}
                        alt={todayTeamMatch.awayTeam}
                        className="team-logo"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* إحصائيات الفريق المشتقة من جدول الترتيب الرسمي */}
            <div className="team-section-header">
              <h3 className="section-title" style={{ margin: 0 }}>
                <Trophy size={18} color="var(--primary)" />
                <span>إحصائيات الفريق في {league ? league.name : 'الدوري'}</span>
              </h3>
              {resolvedLeagueId && (
                <Link
                  to={`/league/${resolvedLeagueId}`}
                  className="d-flex align-center gap-1"
                  style={{ fontSize: '0.82rem', color: 'var(--primary)', textDecoration: 'none', fontWeight: 700 }}
                >
                  <span>عرض جدول الترتيب الكامل</span>
                  <ChevronLeft size={16} />
                </Link>
              )}
            </div>

            {loadingStandings ? (
              <div className="team-metrics-grid">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="team-metric-box skeleton-pulse" style={{ height: 85 }} />
                ))}
              </div>
            ) : metrics ? (
              <>
                <div className="team-metrics-grid">
                  <div className="team-metric-box highlight">
                    <div className="metric-box-header">
                      <Hash size={14} color="var(--primary)" />
                      <span className="metric-label">المركز</span>
                    </div>
                    <span className="metric-value highlight">{metrics.rank}</span>
                    <span className="metric-sub">{teamStanding.groupName || 'في الترتيب العام'}</span>
                  </div>

                  <div className="team-metric-box highlight">
                    <div className="metric-box-header">
                      <Trophy size={14} color="var(--accent)" />
                      <span className="metric-label">النقاط</span>
                    </div>
                    <span className="metric-value highlight">{metrics.points}</span>
                    <span className="metric-sub">نقطة مسجلة</span>
                  </div>

                  <div className="team-metric-box">
                    <div className="metric-box-header">
                      <Calendar size={14} color="var(--text-secondary)" />
                      <span className="metric-label">لعب</span>
                    </div>
                    <span className="metric-value">{metrics.played}</span>
                    <span className="metric-sub">مباراة</span>
                  </div>

                  <div className="team-metric-box success">
                    <div className="metric-box-header">
                      <TrendingUp size={14} color="var(--live)" />
                      <span className="metric-label">فوز</span>
                    </div>
                    <span className="metric-value" style={{ color: 'var(--live)' }}>{metrics.win}</span>
                    <span className="metric-sub">انتصار</span>
                  </div>

                  <div className="team-metric-box">
                    <div className="metric-box-header">
                      <Activity size={14} color="var(--text-secondary)" />
                      <span className="metric-label">تعادل</span>
                    </div>
                    <span className="metric-value">{metrics.draw}</span>
                    <span className="metric-sub">مباراة</span>
                  </div>

                  <div className="team-metric-box danger">
                    <div className="metric-box-header">
                      <AlertCircle size={14} color="var(--danger)" />
                      <span className="metric-label">خسارة</span>
                    </div>
                    <span className="metric-value" style={{ color: 'var(--danger)' }}>{metrics.loss}</span>
                    <span className="metric-sub">هزيمة</span>
                  </div>

                  <div className="team-metric-box">
                    <div className="metric-box-header">
                      <Shield size={14} color="var(--text-secondary)" />
                      <span className="metric-label">الأهداف (له / عليه)</span>
                    </div>
                    <span className="metric-value">{metrics.goalsFor} : {metrics.goalsAgainst}</span>
                    <span className="metric-sub">
                      فارق الأهداف: {metrics.goalDiff > 0 ? `+${metrics.goalDiff}` : metrics.goalDiff}
                    </span>
                  </div>

                  <div className="team-metric-box">
                    <div className="metric-box-header">
                      <Percent size={14} color="var(--primary)" />
                      <span className="metric-label">نسبة الانتصارات</span>
                    </div>
                    <span className="metric-value">{metrics.winRate}%</span>
                    <span className="metric-sub">معدل: {metrics.ptsPerMatch} نقطة/مباراة</span>
                  </div>
                </div>

                {/* صف الترتيب الخاص بالنادي */}
                <div className="glass-card" style={{ padding: 16, marginTop: 16 }}>
                  <div className="d-flex align-center justify-between" style={{ marginBottom: 10 }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-secondary)' }}>
                      ملخص موقع الفريق في جدول المسابقة
                    </span>
                    {resolvedLeagueId && (
                      <Link
                        to={`/standings?league=${resolvedLeagueId}`}
                        style={{ fontSize: '0.78rem', color: 'var(--primary)', textDecoration: 'none', fontWeight: 700 }}
                      >
                        عرض مقارنة الدوريات
                      </Link>
                    )}
                  </div>

                  <div style={{ overflowX: 'auto' }}>
                    <table className="standings-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
                      <thead>
                        <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>
                          <th style={{ padding: '8px 6px', textAlign: 'center' }}>#</th>
                          <th style={{ padding: '8px 10px', textAlign: 'right' }}>الفريق</th>
                          <th style={{ padding: '8px 6px' }}>لعب</th>
                          <th style={{ padding: '8px 6px' }}>فاز</th>
                          <th style={{ padding: '8px 6px' }}>تعادل</th>
                          <th style={{ padding: '8px 6px' }}>خسر</th>
                          <th style={{ padding: '8px 6px' }}>له</th>
                          <th style={{ padding: '8px 6px' }}>عليه</th>
                          <th style={{ padding: '8px 6px' }}>الفارق</th>
                          <th style={{ padding: '8px 6px', fontWeight: 800 }}>النقاط</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr style={{ background: 'var(--surface-hover)', fontWeight: 700, borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>
                          <td style={{ padding: '10px 6px', textAlign: 'center', color: 'var(--primary)' }}>{metrics.rank}</td>
                          <td style={{ padding: '10px 10px', textAlign: 'right' }}>
                            <div className="d-flex align-center gap-2">
                              {teamLogo && (
                                <img
                                  src={teamLogo}
                                  alt={teamName}
                                  style={{ width: 22, height: 22, objectFit: 'contain' }}
                                  onError={(e) => { e.target.style.display = 'none'; }}
                                />
                              )}
                              <span>{teamName}</span>
                            </div>
                          </td>
                          <td style={{ padding: '10px 6px' }}>{metrics.played}</td>
                          <td style={{ padding: '10px 6px', color: 'var(--live)' }}>{metrics.win}</td>
                          <td style={{ padding: '10px 6px' }}>{metrics.draw}</td>
                          <td style={{ padding: '10px 6px', color: 'var(--danger)' }}>{metrics.loss}</td>
                          <td style={{ padding: '10px 6px' }}>{metrics.goalsFor}</td>
                          <td style={{ padding: '10px 6px' }}>{metrics.goalsAgainst}</td>
                          <td style={{ padding: '10px 6px', direction: 'ltr' }}>
                            {metrics.goalDiff > 0 ? `+${metrics.goalDiff}` : metrics.goalDiff}
                          </td>
                          <td style={{ padding: '10px 6px', fontWeight: 900, color: 'var(--accent)', fontSize: '0.95rem' }}>
                            {metrics.points}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <div className="glass-card empty-state" style={{ padding: '36px 16px', textAlign: 'center' }}>
                <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                  بيانات ترتيب هذا الفريق في البطولة غير متوفرة حالياً.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ========================================== */}
        {/* التبويب الثاني: المباريات والنتائج الأخيرة */}
        {/* ========================================== */}
        {activeTab === 'schedule' && (
          <div className="team-schedule-section">
            <div className="team-section-header">
              <h3 className="section-title" style={{ margin: 0 }}>
                <Clock size={18} color="var(--primary)" />
                <span>سجل المباريات الأخيرة لـ {teamName}</span>
                <span className="section-badge-count">{schedule.length}</span>
              </h3>
            </div>

            {loadingSchedule ? (
              <div className="d-flex flex-column gap-2">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="match-row-card skeleton-pulse" style={{ height: 60 }} />
                ))}
              </div>
            ) : errorSchedule ? (
              <div className="glass-card empty-state" style={{ padding: '40px 20px', textAlign: 'center' }}>
                <AlertCircle size={32} color="var(--danger)" style={{ marginBottom: 12 }} />
                <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>{errorSchedule}</p>
                <button
                  type="button"
                  onClick={() => {
                    setLoadingSchedule(true);
                    getTeamSchedule(resolvedLeagueId, teamId)
                      .then(setSchedule)
                      .catch(() => setErrorSchedule('تعذر إعادة التحميل'))
                      .finally(() => setLoadingSchedule(false));
                  }}
                  className="tab-btn active"
                >
                  <RefreshCw size={14} />
                  <span>إعادة المحاولة</span>
                </button>
              </div>
            ) : schedule.length === 0 ? (
              <div className="glass-card empty-state" style={{ padding: '50px 20px', textAlign: 'center' }}>
                <Clock size={36} className="empty-icon" style={{ marginBottom: 12 }} />
                <h4 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: 6 }}>لا توجد نتائج مسجلة حديثاً</h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: 440, margin: '0 auto' }}>
                  لم يتم العثور على مباريات سابقة مسجلة لهذا الفريق في بطولة {league ? league.name : 'الحالية'}.
                </p>
              </div>
            ) : (
              <div className="d-flex flex-column gap-2">
                {schedule.map((item) => {
                  const matchDate = item.date ? new Date(item.date) : null;
                  const dateText = matchDate
                    ? matchDate.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' })
                    : '';

                  return (
                    <motion.div
                      key={item.id}
                      className="match-row-card team-schedule-row"
                      whileHover={{ scale: 1.002 }}
                      transition={{ duration: 0.1 }}
                    >
                      {/* تاريخ ومكان المباراة */}
                      <div className="schedule-meta-col">
                        <span className="schedule-date">{dateText}</span>
                        <span className={`schedule-venue-badge ${item.isHome ? 'home' : 'away'}`}>
                          {item.isHome ? 'ملعبنا' : 'خارج الديار'}
                        </span>
                      </div>

                      {/* الفريق المستضيف */}
                      <div className="match-team-home">
                        <span className="team-name" style={{ fontWeight: item.isHome ? 900 : 500 }}>
                          {item.homeTeam}
                        </span>
                      </div>

                      {/* النتيجة وشارة الفوز/الخسارة/التعادل */}
                      <div className="match-score-center">
                        <div className="score-display-pill">
                          <span className="score-num">{item.homeScore}</span>
                          <span className="score-sep">-</span>
                          <span className="score-num">{item.awayScore}</span>
                        </div>

                        {item.result === 'W' && (
                          <span className="team-result-badge win">فوز W</span>
                        )}
                        {item.result === 'D' && (
                          <span className="team-result-badge draw">تعادل D</span>
                        )}
                        {item.result === 'L' && (
                          <span className="team-result-badge loss">خسارة L</span>
                        )}
                      </div>

                      {/* الفريق الضيف */}
                      <div className="match-team-away">
                        <span className="team-name" style={{ fontWeight: !item.isHome ? 900 : 500 }}>
                          {item.awayTeam}
                        </span>
                        {item.opponentLogo && (
                          <img
                            src={item.opponentLogo}
                            alt={item.opponentName}
                            className="team-logo"
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================== */}
        {/* التبويب الثالث: قائمة اللاعبين (Lazy Loaded) */}
        {/* ========================================== */}
        {activeTab === 'squad' && (
          <div className="team-roster-section">
            <div className="team-section-header">
              <h3 className="section-title" style={{ margin: 0 }}>
                <Users size={18} color="var(--primary)" />
                <span>قائمة لاعبي {teamName}</span>
                {roster && <span className="section-badge-count">{roster.length}</span>}
              </h3>
            </div>

            {loadingRoster ? (
              <div className="roster-grid">
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="roster-player-card skeleton-pulse" style={{ height: 80 }} />
                ))}
              </div>
            ) : errorRoster ? (
              <div className="glass-card empty-state" style={{ padding: '40px 20px', textAlign: 'center' }}>
                <AlertCircle size={32} color="var(--danger)" style={{ marginBottom: 12 }} />
                <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>{errorRoster}</p>
                <button
                  type="button"
                  onClick={loadRosterLazy}
                  className="tab-btn active"
                >
                  <RefreshCw size={14} />
                  <span>إعادة المحاولة</span>
                </button>
              </div>
            ) : !roster || roster.length === 0 ? (
              <div className="glass-card empty-state" style={{ padding: '50px 20px', textAlign: 'center' }}>
                <Users size={36} className="empty-icon" style={{ marginBottom: 12 }} />
                <h4 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: 6 }}>قائمة اللاعبين غير متوفرة</h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: 440, margin: '0 auto' }}>
                  لم يوفر المصدر قائمة رسمية للاعبي هذا الفريق في الوقت الحالي.
                </p>
              </div>
            ) : (
              <div className="d-flex flex-column gap-4">
                {/* حراس المرمى */}
                {groupedRoster.goalkeepers.length > 0 && (
                  <div className="roster-position-group">
                    <h4 className="roster-group-title">
                      <Shield size={16} color="var(--primary)" />
                      <span>حراسة المرمى ({groupedRoster.goalkeepers.length})</span>
                    </h4>
                    <div className="roster-grid">
                      {groupedRoster.goalkeepers.map((player) => (
                        <div key={player.id} className="roster-player-card">
                          <div className="player-card-number">
                            {player.jersey ? `#${player.jersey}` : <Shield size={14} />}
                          </div>
                          <div className="player-card-avatar">
                            {player.photo ? (
                              <img
                                src={player.photo}
                                alt={player.name}
                                className="player-photo"
                                onError={(e) => { e.target.style.display = 'none'; }}
                              />
                            ) : (
                              <div className="player-avatar-fallback">
                                {player.name.charAt(0)}
                              </div>
                            )}
                          </div>
                          <div className="player-card-info">
                            <span className="player-name" title={player.name}>{player.name}</span>
                            <div className="player-sub-info">
                              <span className="player-pos-badge">{player.position}</span>
                              {player.citizenship && (
                                <span className="player-country">{player.citizenship}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* خط الدفاع */}
                {groupedRoster.defenders.length > 0 && (
                  <div className="roster-position-group">
                    <h4 className="roster-group-title">
                      <Shield size={16} color="var(--accent)" />
                      <span>خط الدفاع ({groupedRoster.defenders.length})</span>
                    </h4>
                    <div className="roster-grid">
                      {groupedRoster.defenders.map((player) => (
                        <div key={player.id} className="roster-player-card">
                          <div className="player-card-number">
                            {player.jersey ? `#${player.jersey}` : <Shield size={14} />}
                          </div>
                          <div className="player-card-avatar">
                            {player.photo ? (
                              <img
                                src={player.photo}
                                alt={player.name}
                                className="player-photo"
                                onError={(e) => { e.target.style.display = 'none'; }}
                              />
                            ) : (
                              <div className="player-avatar-fallback">
                                {player.name.charAt(0)}
                              </div>
                            )}
                          </div>
                          <div className="player-card-info">
                            <span className="player-name" title={player.name}>{player.name}</span>
                            <div className="player-sub-info">
                              <span className="player-pos-badge">{player.position}</span>
                              {player.citizenship && (
                                <span className="player-country">{player.citizenship}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* خط الوسط */}
                {groupedRoster.midfielders.length > 0 && (
                  <div className="roster-position-group">
                    <h4 className="roster-group-title">
                      <Activity size={16} color="var(--primary)" />
                      <span>خط الوسط ({groupedRoster.midfielders.length})</span>
                    </h4>
                    <div className="roster-grid">
                      {groupedRoster.midfielders.map((player) => (
                        <div key={player.id} className="roster-player-card">
                          <div className="player-card-number">
                            {player.jersey ? `#${player.jersey}` : <Activity size={14} />}
                          </div>
                          <div className="player-card-avatar">
                            {player.photo ? (
                              <img
                                src={player.photo}
                                alt={player.name}
                                className="player-photo"
                                onError={(e) => { e.target.style.display = 'none'; }}
                              />
                            ) : (
                              <div className="player-avatar-fallback">
                                {player.name.charAt(0)}
                              </div>
                            )}
                          </div>
                          <div className="player-card-info">
                            <span className="player-name" title={player.name}>{player.name}</span>
                            <div className="player-sub-info">
                              <span className="player-pos-badge">{player.position}</span>
                              {player.citizenship && (
                                <span className="player-country">{player.citizenship}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* خط الهجوم */}
                {groupedRoster.forwards.length > 0 && (
                  <div className="roster-position-group">
                    <h4 className="roster-group-title">
                      <Flame size={16} color="var(--live)" />
                      <span>خط الهجوم ({groupedRoster.forwards.length})</span>
                    </h4>
                    <div className="roster-grid">
                      {groupedRoster.forwards.map((player) => (
                        <div key={player.id} className="roster-player-card">
                          <div className="player-card-number">
                            {player.jersey ? `#${player.jersey}` : <Flame size={14} />}
                          </div>
                          <div className="player-card-avatar">
                            {player.photo ? (
                              <img
                                src={player.photo}
                                alt={player.name}
                                className="player-photo"
                                onError={(e) => { e.target.style.display = 'none'; }}
                              />
                            ) : (
                              <div className="player-avatar-fallback">
                                {player.name.charAt(0)}
                              </div>
                            )}
                          </div>
                          <div className="player-card-info">
                            <span className="player-name" title={player.name}>{player.name}</span>
                            <div className="player-sub-info">
                              <span className="player-pos-badge">{player.position}</span>
                              {player.citizenship && (
                                <span className="player-country">{player.citizenship}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* لاعبون آخرون إن وجدوا */}
                {groupedRoster.other.length > 0 && (
                  <div className="roster-position-group">
                    <h4 className="roster-group-title">
                      <Users size={16} color="var(--text-secondary)" />
                      <span>لاعبون آخرون ({groupedRoster.other.length})</span>
                    </h4>
                    <div className="roster-grid">
                      {groupedRoster.other.map((player) => (
                        <div key={player.id} className="roster-player-card">
                          <div className="player-card-number">
                            {player.jersey ? `#${player.jersey}` : '#'}
                          </div>
                          <div className="player-card-info">
                            <span className="player-name" title={player.name}>{player.name}</span>
                            <div className="player-sub-info">
                              <span className="player-pos-badge">{player.position}</span>
                              {player.citizenship && (
                                <span className="player-country">{player.citizenship}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ========================================== */}
        {/* التبويب الرابع: مباراة اليوم المنفردة */}
        {/* ========================================== */}
        {activeTab === 'today' && todayTeamMatch && (
          <div className="team-today-section">
            <div className="team-section-header">
              <h3 className="section-title" style={{ margin: 0 }}>
                <Flame size={18} color="var(--live)" />
                <span>مباراة اليوم لـ {teamName}</span>
              </h3>
            </div>

            <div
              className="match-row-card"
              onClick={() => handleMatchRowClick(todayTeamMatch)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleMatchRowClick(todayTeamMatch); }}
              style={{ cursor: 'pointer', padding: '16px 20px' }}
            >
              <div className="match-team-home">
                {todayTeamMatch.homeLogo && (
                  <img
                    src={todayTeamMatch.homeLogo}
                    alt={todayTeamMatch.homeTeam}
                    className="team-logo"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                )}
                <span className="team-name" style={{ fontWeight: todayTeamMatch.homeTeamId === teamId ? 900 : 600 }}>
                  {todayTeamMatch.homeTeam}
                </span>
              </div>

              <div className="match-score-center">
                <div className="score-display-pill">
                  {todayTeamMatch.status === 'NS' ? (
                    <span className="match-time-text">{todayTeamMatch.time}</span>
                  ) : (
                    <>
                      <span className="score-num">{todayTeamMatch.homeScore}</span>
                      <span className="score-sep">-</span>
                      <span className="score-num">{todayTeamMatch.awayScore}</span>
                    </>
                  )}
                </div>

                {todayTeamMatch.status === 'LIVE' && (
                  <span className="match-status-tag live">
                    <span className="live-dot" />
                    <span><bdi>{String(todayTeamMatch.minute ?? '').replace(/['"’`]/g, '').trim()}</bdi> د</span>
                  </span>
                )}
                {todayTeamMatch.status === 'FT' && (
                  <span className="match-status-tag ft">انتهت</span>
                )}
              </div>

              <div className="match-team-away">
                <span className="team-name" style={{ fontWeight: todayTeamMatch.awayTeamId === teamId ? 900 : 600 }}>
                  {todayTeamMatch.awayTeam}
                </span>
                {todayTeamMatch.awayLogo && (
                  <img
                    src={todayTeamMatch.awayLogo}
                    alt={todayTeamMatch.awayTeam}
                    className="team-logo"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                )}
              </div>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: 12 }}>
              اضغط على بطاقة المباراة لعرض التشكيلات والإحصائيات والأحداث المباشرة دقيقة بدقيقة.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeamPage;
