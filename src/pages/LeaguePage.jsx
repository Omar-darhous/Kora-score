import { finishedMatchLabel, isUnplayedMatchStatus, getMatchStatusLabel } from '../services/matchResult';
import RequestState from '../components/RequestState';
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
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
import SeasonSelector from '../components/SeasonSelector';
import Dropdown from '../components/Dropdown';
import FavoriteButton from '../components/FavoriteButton';
import { createStandingsController } from '../services/footballService';
import { isNationalTournament } from '../services/tournamentRules';
import {
  parseSeasonQueryParam,
  buildSeasonSearchParams,
  isHistoricalSeasonSelected
} from '../services/standingsService';
import {
  createHistoricalMatchesController,
  organizeHistoricalMatches
} from '../services/historicalMatchesService';
import { EgyptianDisclaimer, EgyptianBadge } from '../components/EgyptianDisclaimer';

const EMPTY_STANDINGS = [];
const EMPTY_SEASONS = [];
const EMPTY_MATCHES = [];

const LeaguePage = ({ matches = [], leagues = [], onMatchClick, matchesLoading, matchesError, onRetryMatches }) => {
  const { leagueId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const parsedSeason = useMemo(
    () => parseSeasonQueryParam(searchParams.get('season')),
    [searchParams]
  );
  const selectedSeason = parsedSeason.season;
  const isEgyptianHistoricalRequest = leagueId === 'egypt.1' && selectedSeason !== null;
  const hasInvalidSeason = !parsedSeason.valid || isEgyptianHistoricalRequest;

  const handleSeasonChange = useCallback((nextSeason) => {
    setSearchParams(
      (prev) => buildSeasonSearchParams(prev, { season: nextSeason }),
      { replace: false }
    );
  }, [setSearchParams]);

  // التحقق من صلاحية معرف البطولة ضد قائمة البطولات المعتمدة
  const league = useMemo(() => {
    return leagues.find((l) => l.id === leagueId);
  }, [leagues, leagueId]);

  // حالة التبويب النشط في الصفحة
  const [activeTab, setActiveTab] = useState('standings'); // 'standings' | 'matches' | 'teams'

  // حالة بيانات الترتيب والموسم (مالك الطلب الأوحد لمنع تكرار جلب البيانات)
  const [standingsState, setStandingsState] = useState({
    leagueId,
    season: selectedSeason,
    standings: [],
    availableSeasons: [],
    loading: !hasInvalidSeason,
    error: null,
    isStale: false
  });
  const controllerRef = useRef(null);

  const isSameTarget = standingsState.leagueId === leagueId && standingsState.season === selectedSeason;
  const standings = hasInvalidSeason ? EMPTY_STANDINGS : (isSameTarget ? standingsState.standings : EMPTY_STANDINGS);
  const availableSeasons = standingsState.leagueId === leagueId ? standingsState.availableSeasons : EMPTY_SEASONS;
  const loadingStandings = hasInvalidSeason ? false : (isSameTarget ? standingsState.loading : true);
  const errorStandings = isSameTarget ? standingsState.error : null;
  const isStaleStandings = isSameTarget ? standingsState.isStale : false;

  // الرجوع الآمن للصفحة السابقة أو العودة للترتيب العام
  const handleSafeBack = () => {
    const hasInternalHistory = window.history.state && typeof window.history.state.idx === 'number' && window.history.state.idx > 0;
    if (hasInternalHistory) {
      navigate(-1);
    } else {
      navigate('/standings?league=' + (leagueId || 'eng.1'));
    }
  };

  // جلب بيانات الترتيب والموسم مع دعم إعادة المحاولة وتنظيف الطلبات عند إلغاء التحميل
  useEffect(() => {
    if (!league || hasInvalidSeason) return;

    const controller = createStandingsController({
      onStateChange: setStandingsState
    });
    controllerRef.current = controller;
    controller.load(leagueId, { season: selectedSeason });

    return () => {
      controller.dispose();
      if (controllerRef.current === controller) {
        controllerRef.current = null;
      }
    };
  }, [leagueId, league, selectedSeason, hasInvalidSeason]);

  const handleRetryStandings = useCallback(() => {
    controllerRef.current?.retry();
  }, []);

  // استخراج البيانات الوصفية للموسم من كائن المجموعة الأولى group.season حصراً
  const seasonMetadata = useMemo(() => {
    if (!standings || standings.length === 0) return null;
    return standings[0]?.season || null;
  }, [standings]);

  const isHistoricalSeason = useMemo(
    () => isHistoricalSeasonSelected(selectedSeason, availableSeasons),
    [selectedSeason, availableSeasons]
  );

  // حالة مباريات الموسم التاريخي (معزولة تماماً عن مباريات اليوم والبث المباشر)
  const [historicalState, setHistoricalState] = useState({
    leagueId,
    season: selectedSeason,
    matches: EMPTY_MATCHES,
    loading: false,
    error: null
  });
  const [selectedHistoricalGroupId, setSelectedHistoricalGroupId] = useState(null);
  const [selectedHistoricalSubFilterId, setSelectedHistoricalSubFilterId] = useState(null);
  const historicalControllerRef = useRef(null);

  useEffect(() => {
    setSelectedHistoricalGroupId(null);
    setSelectedHistoricalSubFilterId(null);
  }, [leagueId, selectedSeason]);

  useEffect(() => {
    if (!league || !isHistoricalSeason || hasInvalidSeason || activeTab !== 'matches' || selectedSeason === null) {
      return;
    }

    const controller = createHistoricalMatchesController({
      onStateChange: setHistoricalState
    });
    historicalControllerRef.current = controller;
    controller.load(leagueId, selectedSeason);

    return () => {
      controller.dispose();
      if (historicalControllerRef.current === controller) {
        historicalControllerRef.current = null;
      }
    };
  }, [leagueId, league, selectedSeason, isHistoricalSeason, hasInvalidSeason, activeTab]);

  const handleRetryHistoricalMatches = useCallback(() => {
    historicalControllerRef.current?.retry();
  }, []);

  const isSameHistoricalTarget = historicalState.leagueId === leagueId && historicalState.season === selectedSeason;
  const historicalMatches = isSameHistoricalTarget ? historicalState.matches : EMPTY_MATCHES;
  const loadingHistoricalMatches = isSameHistoricalTarget ? historicalState.loading : (isHistoricalSeason && activeTab === 'matches' && !hasInvalidSeason);
  const errorHistoricalMatches = isSameHistoricalTarget ? historicalState.error : null;

  const organizedHistorical = useMemo(
    () => organizeHistoricalMatches(historicalMatches, leagueId),
    [historicalMatches, leagueId]
  );

  const activeHistoricalGroup = useMemo(() => {
    if (organizedHistorical.groups.length === 0) return null;
    return organizedHistorical.groups.find(g => g.id === selectedHistoricalGroupId)
      || organizedHistorical.groups[0];
  }, [organizedHistorical, selectedHistoricalGroupId]);

  const activeHistoricalSubFilter = useMemo(() => {
    if (!activeHistoricalGroup || activeHistoricalGroup.subFilters.length === 0) return null;
    return activeHistoricalGroup.subFilters.find(sf => sf.id === selectedHistoricalSubFilterId)
      || activeHistoricalGroup.subFilters[0];
  }, [activeHistoricalGroup, selectedHistoricalSubFilterId]);

  const visibleHistoricalGroups = activeHistoricalSubFilter
    ? activeHistoricalSubFilter.dateGroups
    : (activeHistoricalGroup?.dateGroups || []);

  const visibleHistoricalMatchCount = activeHistoricalSubFilter
    ? activeHistoricalSubFilter.count
    : (activeHistoricalGroup?.count || 0);

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

              {/* عدد الأندية / المنتخبات المشاركة */}
              {totalTeamsCount > 0 && (
                <span className="league-badge teams-count-badge">
                  <Users size={13} color="var(--text-secondary)" />
                  <span>{totalTeamsCount} {isNationalTournament(leagueId) ? 'منتخباً' : 'نادياً'}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* أزرار التحويل السريع للجدول الشامل ومحدد الموسم */}
        <div className="league-hero-actions">
          <SeasonSelector
            leagueId={leagueId}
            availableSeasons={availableSeasons}
            selectedSeason={selectedSeason}
            currentSeasonYear={seasonMetadata?.year ?? null}
            onSeasonChange={handleSeasonChange}
            loading={loadingStandings}
          />
          <FavoriteButton
            type="league"
            item={{
              id: leagueId,
              name: league.name,
              country: league.country,
              logo: league.logo,
              isMock: leagueId === 'egypt.1'
            }}
            size={15}
            showLabel
          />
          <Link
            to={`/matches?league=${leagueId}`}
            className="league-action-link"
            title="تصفح جميع مواعيد وجولات البطولة"
          >
            <Calendar size={15} />
            <span>جدول كل المواعيد</span>
          </Link>
          <Link
            to={`/standings?league=${leagueId}${selectedSeason !== null ? `&season=${selectedSeason}` : ''}`}
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
          <span>{isHistoricalSeason ? 'مباريات الموسم' : 'مباريات اليوم'}</span>
          {!isHistoricalSeason && todayLeagueMatches.length > 0 && (
            <span className="league-tab-badge">{todayLeagueMatches.length}</span>
          )}
          {isHistoricalSeason && historicalMatches.length > 0 && (
            <span className="league-tab-badge">{historicalMatches.length}</span>
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
            {hasInvalidSeason ? (
              <div className="glass-card empty-state" style={{ padding: '40px 20px', textAlign: 'center' }} role="alert">
                <AlertCircle size={32} color="var(--danger)" style={{ marginBottom: 12 }} />
                <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>
                  {isEgyptianHistoricalRequest
                    ? 'الدوري المصري يعرض بيانات تجريبية للموسم الحالي فقط ولا تتوفر له مواسم تاريخية.'
                    : 'معامل الموسم المطلوب في الرابط غير صالح أو غير مدعوم لهذه البطولة.'}
                </p>
                <button
                  type="button"
                  onClick={() => handleSeasonChange(null)}
                  className="tab-btn active"
                >
                  <span>العودة إلى الموسم الحالي</span>
                </button>
              </div>
            ) : errorStandings && standings.length === 0 ? (
              <div className="glass-card empty-state" style={{ padding: '40px 20px', textAlign: 'center' }} role="alert">
                <AlertCircle size={32} color="var(--danger)" style={{ marginBottom: 12 }} />
                <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>
                  {selectedSeason !== null
                    ? `تعذر جلب ترتيب موسم ${selectedSeason}. قد لا يكون هذا الموسم متاحاً لهذه البطولة.`
                    : errorStandings}
                </p>
                <div className="d-flex align-center justify-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handleRetryStandings}
                    disabled={loadingStandings}
                    className="tab-btn active"
                  >
                    <RefreshCw size={14} />
                    <span>إعادة المحاولة</span>
                  </button>
                  {selectedSeason !== null && (
                    <button
                      type="button"
                      onClick={() => handleSeasonChange(null)}
                      className="tab-btn"
                    >
                      <span>العودة إلى الموسم الحالي</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <>
                {errorStandings && isStaleStandings && (
                  <div className="glass-card request-state" role="alert" style={{ marginBottom: 14 }}>
                    <p style={{ margin: 0 }}>{errorStandings} — يتم عرض آخر نسخة صالحة محمّلة.</p>
                    <button
                      type="button"
                      onClick={handleRetryStandings}
                      disabled={loadingStandings}
                      className="tab-btn active"
                    >
                      <RefreshCw size={14} />
                      <span>إعادة المحاولة</span>
                    </button>
                  </div>
                )}
                <LeagueStandings
                  activeLeague={leagueId}
                  standingsData={standings}
                  loading={loadingStandings}
                  hideLeagueSelector={true}
                  showTitle={false}
                  selectedSeason={selectedSeason}
                  isHistoricalSeason={isHistoricalSeason}
                  onMatchClick={onMatchClick}
                />
              </>
            )}
          </div>
        )}

        {/* التبويب الثاني: مباريات اليوم (للموسم الحالي) أو مباريات الموسم التاريخي */}
        {activeTab === 'matches' && (
          <div className="league-matches-section">
            {isHistoricalSeason ? (
              <div className="d-flex flex-column gap-3">
                <div className="d-flex align-center justify-between flex-wrap gap-2">
                  <h3 className="section-title" style={{ margin: 0 }}>
                    <CalendarDays size={18} color="var(--primary)" />
                    <span>مباريات موسم {selectedSeason} في {league.name}</span>
                    {historicalMatches.length > 0 && (
                      <span className="section-badge-count">{historicalMatches.length}</span>
                    )}
                  </h3>
                  <button
                    type="button"
                    onClick={() => handleSeasonChange(null)}
                    className="tab-btn"
                    style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                  >
                    <span>العودة إلى الموسم الحالي</span>
                  </button>
                </div>

                {!loadingHistoricalMatches && !errorHistoricalMatches && organizedHistorical.groups.length > 0 && (
                  <div className="d-flex flex-column gap-2">
                    {organizedHistorical.mode === 'stages' ? (
                      <div className="tabs-container" style={{ marginBottom: 2 }}>
                        {organizedHistorical.groups.map((group) => (
                          <button
                            key={group.id}
                            type="button"
                            className={`tab-btn ${activeHistoricalGroup?.id === group.id ? 'active' : ''}`}
                            onClick={() => {
                              setSelectedHistoricalGroupId(group.id);
                              setSelectedHistoricalSubFilterId(null);
                            }}
                          >
                            <span>{group.label} ({group.count})</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="d-flex align-center justify-between flex-wrap gap-2">
                        <div className="d-flex align-center gap-2 flex-wrap">
                          <Dropdown
                            options={organizedHistorical.groups.map(group => ({
                              value: group.id,
                              label: `${group.label} (${group.count} مباراة)`
                            }))}
                            value={activeHistoricalGroup?.id || ''}
                            onChange={(nextId) => {
                              setSelectedHistoricalGroupId(nextId);
                              setSelectedHistoricalSubFilterId(null);
                            }}
                            icon={<CalendarDays size={14} color="var(--accent)" />}
                            ariaLabel={organizedHistorical.mode === 'rounds' ? 'اختيار الجولة' : 'اختيار الشهر'}
                            size="sm"
                            useDesktopPortal={true}
                          />
                          {activeHistoricalGroup && (
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                              {activeHistoricalGroup.label} • {visibleHistoricalMatchCount} مباراة
                            </span>
                          )}
                        </div>
                        {organizedHistorical.mode === 'months' && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            مرتّبة زمنياً حسب الشهر وتاريخ المباراة
                          </span>
                        )}
                      </div>
                    )}

                    {activeHistoricalGroup && activeHistoricalGroup.subFilters.length > 1 && (
                      <div className="d-flex align-center gap-2 flex-wrap">
                        <Dropdown
                          options={activeHistoricalGroup.subFilters.map(sf => ({
                            value: sf.id,
                            label: `${sf.label} (${sf.count} مباراة)`
                          }))}
                          value={activeHistoricalSubFilter?.id || ''}
                          onChange={setSelectedHistoricalSubFilterId}
                          icon={<Calendar size={14} color="var(--primary)" />}
                          ariaLabel="تصفية مباريات المرحلة حسب الشهر"
                          size="sm"
                          useDesktopPortal={true}
                        />
                        {activeHistoricalSubFilter && (
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                            {activeHistoricalSubFilter.label} • {activeHistoricalSubFilter.count} مباراة
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {loadingHistoricalMatches ? (
                  <RequestState loading={true} message="جارٍ تحميل مباريات الموسم التاريخي..." />
                ) : errorHistoricalMatches ? (
                  <div className="d-flex flex-column align-center gap-2">
                    <RequestState message={errorHistoricalMatches} onRetry={handleRetryHistoricalMatches} />
                    <button
                      type="button"
                      onClick={() => handleSeasonChange(null)}
                      className="tab-btn"
                    >
                      <span>العودة إلى الموسم الحالي</span>
                    </button>
                  </div>
                ) : visibleHistoricalGroups.length === 0 ? (
                  <div className="glass-card empty-state" style={{ padding: '48px 20px', textAlign: 'center' }}>
                    <CalendarDays size={36} className="empty-icon" style={{ marginBottom: 12 }} />
                    <h4 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: 8 }}>
                      لا توجد مباريات متاحة لهذا الموسم
                    </h4>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: 460, margin: '0 auto 18px' }}>
                      لم تتوفر بيانات مباريات مسجلة لهذا الموسم من المصدر الرسمي.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleSeasonChange(null)}
                      className="tab-btn active"
                      style={{ display: 'inline-flex' }}
                    >
                      <span>العودة إلى الموسم الحالي</span>
                    </button>
                  </div>
                ) : (
                  <div className="d-flex flex-column gap-3">
                    {visibleHistoricalGroups.map((group) => (
                      <div key={group.dateKey} className="d-flex flex-column gap-2">
                        <div
                          style={{
                            fontSize: '0.82rem',
                            fontWeight: 800,
                            color: 'var(--text-secondary)',
                            padding: '4px 6px',
                            borderBottom: '1px solid var(--border-subtle)'
                          }}
                        >
                          {group.label}
                        </div>
                        {group.matches.map((match) => (
                          <motion.div
                            key={match.id}
                            className="match-row-card"
                            onClick={() => onMatchClick(match)}
                            whileHover={{ scale: 1.003 }}
                            transition={{ duration: 0.12 }}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                onMatchClick(match);
                              }
                            }}
                            aria-label={`${match.homeTeam} ضد ${match.awayTeam}`}
                          >
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

                            <div className="match-score-center">
                              <div className="score-display-pill">
                                {isUnplayedMatchStatus(match.status) || !Number.isFinite(match.homeScore) || !Number.isFinite(match.awayScore) ? (
                                  <span className="match-time-text">{match.status === 'NS' ? match.time : 'VS'}</span>
                                ) : (
                                  <>
                                    <span className="score-num">{match.homeScore}</span>
                                    <span className="score-sep">-</span>
                                    <span className="score-num">{match.awayScore}</span>
                                  </>
                                )}
                              </div>

                              {match.status === 'FT' && (
                                <span className="match-status-tag ft">{finishedMatchLabel(match)}</span>
                              )}
                              {['POSTPONED', 'CANCELLED', 'ABANDONED', 'SUSPENDED'].includes(match.status) && (
                                <span className="match-status-tag ns">{getMatchStatusLabel(match)}</span>
                              )}
                              {match.roundName && match.roundName !== 'الدوري المنتظم' && (
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                  {match.roundName}
                                </span>
                              )}
                            </div>

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
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <>
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

                {matchesLoading || matchesError ? (<RequestState loading={matchesLoading} message={matchesError} onRetry={onRetryMatches} />) : todayLeagueMatches.length === 0 ? (
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
                            {isUnplayedMatchStatus(match.status) || !Number.isFinite(match.homeScore) || !Number.isFinite(match.awayScore) ? (
                              <span className="match-time-text">{match.status === 'NS' ? match.time : 'VS'}</span>
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
                            <span className="match-status-tag ft">{finishedMatchLabel(match)}</span>
                          )}
                          {['POSTPONED', 'CANCELLED', 'ABANDONED', 'SUSPENDED'].includes(match.status) && (
                            <span className="match-status-tag ns">{getMatchStatusLabel(match)}</span>
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
              </>
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

            {loadingStandings && standings.length === 0 ? (
              <div className="league-teams-grid">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="league-team-card skeleton-pulse" style={{ height: 90 }} />
                ))}
              </div>
            ) : errorStandings && standings.length === 0 ? (
              <div className="glass-card empty-state" style={{ padding: '40px 20px', textAlign: 'center' }} role="alert">
                <AlertCircle size={32} color="var(--danger)" style={{ marginBottom: 12 }} />
                <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>{errorStandings}</p>
                <button
                  type="button"
                  onClick={handleRetryStandings}
                  disabled={loadingStandings}
                  className="tab-btn active"
                >
                  <RefreshCw size={14} />
                  <span>إعادة المحاولة</span>
                </button>
              </div>
            ) : standings.length === 0 ? (
              <div className="glass-card empty-state" style={{ padding: '40px 20px', textAlign: 'center' }}>
                <p style={{ color: 'var(--text-muted)' }}>بيانات أندية هذه البطولة غير متوفرة حالياً.</p>
              </div>
            ) : (
              <div className="d-flex flex-column gap-4">
                {errorStandings && isStaleStandings && (
                  <div className="glass-card request-state" role="alert">
                    <p style={{ margin: 0 }}>{errorStandings} — يتم عرض آخر نسخة صالحة محمّلة.</p>
                    <button
                      type="button"
                      onClick={handleRetryStandings}
                      disabled={loadingStandings}
                      className="tab-btn active"
                    >
                      <RefreshCw size={14} />
                      <span>إعادة المحاولة</span>
                    </button>
                  </div>
                )}
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

                              <div className="league-team-card-info" style={{ flex: 1 }}>
                                <span className="league-team-card-name" title={team.team}>
                                  {team.team}
                                </span>
                                <span className="league-team-card-stats">
                                  لعب: {team.played} | فاز: {team.win} | تعادل: {team.draw}
                                </span>
                              </div>

                              {hasValidTeamId && (
                                <FavoriteButton
                                  type="team"
                                  item={{
                                    id: team.teamId,
                                    name: team.team,
                                    arabicName: team.team,
                                    leagueId,
                                    leagueName: league.name,
                                    logo: team.logo,
                                    isMock: leagueId === 'egypt.1'
                                  }}
                                  size={16}
                                />
                              )}
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

