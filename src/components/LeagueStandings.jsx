import KnockoutBracket from './KnockoutBracket';
import { isTournament, qualification } from '../services/tournamentRules';
import RequestState from './RequestState';
import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trophy, RefreshCw } from 'lucide-react';
import { createStandingsController, getLeagues, getTournamentKnockouts } from '../services/footballService';
import { isHistoricalSeasonSelected } from '../services/standingsService';
import { TableRowSkeleton } from './Skeleton';
import Dropdown from './Dropdown';
import SeasonSelector from './SeasonSelector';
import FavoriteButton from './FavoriteButton';
import { EgyptianDisclaimer, EgyptianBadge, EGYPTIAN_BADGE_TEXT } from './EgyptianDisclaimer';

// دالة لتصنيف المراكز حسب البطولة وتحديد لون الهامش الأيمن والتسمية
const getRankStyleAndText = (leagueId, rank) => {
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
const LeagueStandings = ({
  onMatchClick,
  activeLeague: propActiveLeague,
  onLeagueChange,
  hideLeagueSelector = false,
  standingsData = null,
  loading: propLoading = null,
  showTitle = true,
  selectedSeason: propSelectedSeason = null,
  invalidSeasonParam = false,
  onSeasonChange = null,
  isHistoricalSeason: propIsHistoricalSeason = null
}) => {
  const leagues = getLeagues();
  const [internalLeague, setInternalLeague] = useState(leagues[0].id);
  const [internalSeason, setInternalSeason] = useState(null);

  const activeLeague = propActiveLeague !== undefined ? propActiveLeague : internalLeague;
  const selectedSeason = onSeasonChange ? propSelectedSeason : (propSelectedSeason ?? internalSeason);

  const setActiveLeague = (newLeague) => {
    if (onLeagueChange) {
      onLeagueChange(newLeague);
    } else {
      setInternalLeague(newLeague);
      setInternalSeason(null);
    }
  };

  const handleSeasonChange = (nextSeason) => {
    if (onSeasonChange) {
      onSeasonChange(nextSeason);
    } else {
      setInternalSeason(nextSeason);
    }
  };

  const [controllerState, setControllerState] = useState({
    leagueId: activeLeague,
    season: selectedSeason,
    standings: [],
    availableSeasons: [],
    loading: standingsData === null,
    error: null,
    isStale: false
  });
  const controllerRef = useRef(null);

  const isEgyptianHistoricalRequest = activeLeague === 'egypt.1' && selectedSeason !== null;
  const hasInvalidSeason = invalidSeasonParam || isEgyptianHistoricalRequest;

  const isSameControllerTarget = controllerState.leagueId === activeLeague && controllerState.season === selectedSeason;
  const standingsGroups = standingsData !== null
    ? standingsData
    : (hasInvalidSeason ? [] : (isSameControllerTarget ? controllerState.standings : []));
  const availableSeasons = controllerState.leagueId === activeLeague ? controllerState.availableSeasons : [];
  const loading = propLoading !== null
    ? propLoading
    : (standingsData !== null ? false : (hasInvalidSeason ? false : (isSameControllerTarget ? controllerState.loading : true)));
  const error = standingsData !== null
    ? null
    : (isSameControllerTarget ? controllerState.error : null);

  // حالات الأدوار الإقصائية
  const [subTab, setSubTab] = useState('groups'); // groups | knockout
  const [knockoutData, setKnockoutData] = useState(null);
  const [loadingKnockout, setLoadingKnockout] = useState(false);
  const [knockoutError, setKnockoutError] = useState(null);
  const [knockoutRetry, setKnockoutRetry] = useState(0);
  const seasonYear = standingsGroups[0]?.season?.year || selectedSeason;

  // مزامنة التبويب الفرعي عند تغيير البطولة أو الموسم
  useEffect(() => {
    setSubTab('groups');
  }, [activeLeague, selectedSeason]);

  // جلب ترتيب المجموعات عبر متحكم الترتيب الواعي بالموسم (فقط إذا لم يتم تمرير البيانات مسبقاً)
  useEffect(() => {
    if (standingsData !== null || hasInvalidSeason) return;
    const controller = createStandingsController({
      onStateChange: setControllerState
    });
    controllerRef.current = controller;
    controller.load(activeLeague, { season: selectedSeason });

    return () => {
      controller.dispose();
      if (controllerRef.current === controller) {
        controllerRef.current = null;
      }
    };
  }, [activeLeague, selectedSeason, standingsData, hasInvalidSeason]);

  useEffect(() => {
    let active = true;
    setKnockoutData(null);
    setKnockoutError(null);
    if (!isTournament(activeLeague) || !seasonYear || hasInvalidSeason) return;
    setLoadingKnockout(true);
    getTournamentKnockouts(activeLeague, seasonYear).then(data => {
      if (active) setKnockoutData(data);
    }).catch(() => {
      if (active) setKnockoutError('تعذر تحميل مواجهات الموسم. أعد المحاولة.');
    }).finally(() => { if (active) setLoadingKnockout(false); });
    return () => { active = false; };
  }, [activeLeague, seasonYear, knockoutRetry, hasInvalidSeason]);

  const effectiveIsHistorical = propIsHistoricalSeason !== null
    ? propIsHistoricalSeason
    : isHistoricalSeasonSelected(selectedSeason, availableSeasons);
  const suppressDomesticZones = !isTournament(activeLeague) && effectiveIsHistorical;

  const getZone = team => {
    if (isTournament(activeLeague)) {
      return qualification(activeLeague, team, standingsGroups, knockoutData);
    }
    if (suppressDomesticZones) return null;
    return getRankStyleAndText(activeLeague, team.rank);
  };
  const legend = isTournament(activeLeague)
    ? [...new Map(standingsGroups.flatMap(g => g.entries).map(getZone).filter(Boolean).map(z => [z.label, z])).values()]
    : (suppressDomesticZones ? [] : getLegendItems(activeLeague));

  const currentLeagueObj = leagues.find((l) => l.id === activeLeague);
  const leaguePageLink = currentLeagueObj
    ? `/league/${currentLeagueObj.id}${selectedSeason !== null ? `?season=${selectedSeason}` : ''}`
    : '/standings';

  return (
    <div className="standings-container">
      {showTitle && (
        <div className="d-flex align-center justify-between flex-wrap gap-2">
          <h2 className="section-title" style={{ marginBottom: 0 }}>
            <Trophy size={22} color="var(--accent)" />
            ترتيب البطولات والدوريات الكبرى
          </h2>
          {currentLeagueObj && (
            <div className="d-flex align-center flex-wrap gap-2">
              {standingsData === null && !hideLeagueSelector && (
                <SeasonSelector
                  leagueId={activeLeague}
                  availableSeasons={availableSeasons}
                  selectedSeason={selectedSeason}
                  currentSeasonYear={standingsGroups[0]?.season?.year ?? null}
                  onSeasonChange={handleSeasonChange}
                  loading={loading}
                />
              )}
              <FavoriteButton
                type="league"
                item={{
                  id: currentLeagueObj.id,
                  name: currentLeagueObj.name,
                  country: currentLeagueObj.country,
                  logo: currentLeagueObj.logo,
                  isMock: currentLeagueObj.id === 'egypt.1'
                }}
                size={15}
                showLabel
              />
              <Link
                to={leaguePageLink}
                className="league-action-link secondary"
                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              >
                <span>صفحة البطولة</span>
              </Link>
            </div>
          )}
        </div>
      )}

      {!hideLeagueSelector && (
        <>
          {/* اختيار البطولة في الهواتف الذكية عبر Dropdown موحد */}
          <div className="standings-mobile-dropdown">
            <Dropdown
              options={leagues.map(l => ({
                value: l.id,
                label: l.id === 'egypt.1' ? `${l.name} (${EGYPTIAN_BADGE_TEXT})` : l.name,
                icon: l.logo
              }))}
              value={activeLeague}
              onChange={setActiveLeague}
              icon={<Trophy size={14} color="var(--accent)" />}
              ariaLabel="اختيار البطولة"
              fullWidth
            />
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
                  {league.logo ? (
                    <img
                      src={league.logo}
                      alt={league.name}
                      style={{ width: 18, height: 18, objectFit: 'contain' }}
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  ) : (
                    <Trophy size={16} color="var(--accent)" />
                  )}
                  <span>{league.name}</span>
                  {league.id === 'egypt.1' && <EgyptianBadge style={{ marginRight: 4 }} />}
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* تنبيه البيانات التجريبية للدوري المصري */}
      {activeLeague === 'egypt.1' && (
        <EgyptianDisclaimer />
      )}

      {/* تبويبات فرعية لكأس العالم لتحديد دور المجموعات أو الأدوار الاقصائية */}
      {isTournament(activeLeague) && (
        <div className="d-flex align-center justify-center gap-2" style={{ margin: '8px 0 16px 0', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px' }}>
          <button
            className={`sub-tab-btn ${subTab === 'groups' ? 'active' : ''}`}
            onClick={() => setSubTab('groups')}
          >
            ترتيب البطولة
          </button>
          <button
            className={`sub-tab-btn ${subTab === 'knockout' ? 'active' : ''}`}
            onClick={() => setSubTab('knockout')}
          >
            الأدوار الإقصائية
          </button>
        </div>
      )}

      {isTournament(activeLeague) && <div className="glass-card request-state" role="note">
        <strong>{standingsGroups[0]?.season?.displayName || 'موسم البطولة'}</strong>
        <p>{activeLeague === 'fifa.world' && Number(seasonYear) === 2026 ? 'يتأهل أول وثاني كل مجموعة وأفضل 8 ثوالث إلى دور الـ32. تأكيد تأهل صاحب المركز الثالث يعتمد على مواجهات دور الـ32 المنشورة.' : activeLeague.startsWith('uefa.') && Number(seasonYear) >= 2024 ? 'المراكز 1–8 إلى دور الـ16، والمراكز 9–24 إلى الملحق. المراكز الحالية لا تعني ضمان التأهل قبل اكتمال مرحلة الدوري.' : 'تُعرض قواعد التأهل وفق موسم البطولة المتاح.'}</p>
        {knockoutError && subTab === 'groups' && <button type="button" className="tab-btn" onClick={() => setKnockoutRetry(n => n + 1)}>تعذر التحقق من المتأهلين — إعادة المحاولة</button>}
      </div>}
      {suppressDomesticZones && standingsGroups.length > 0 && (
        <div className="glass-card request-state" role="note" style={{ marginBottom: 10 }}>
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            ملاحظة: يتم إخفاء شارات التأهل والهبوط الحديثة في المواسم التاريخية المحلية لتفادي عرض لوائح غير مطابقة لذلك الموسم.
          </p>
        </div>
      )}

      {/* المحتوى الرئيسي */}
      {hasInvalidSeason && standingsData === null ? (
        <div className="glass-card empty-state" role="alert" style={{ padding: '36px 20px', textAlign: 'center' }}>
          <p style={{ marginBottom: 14 }}>
            {isEgyptianHistoricalRequest
              ? 'الدوري المصري يعرض بيانات تجريبية للموسم الحالي فقط ولا تتوفر له مواسم تاريخية.'
              : 'الموسم المطلوب في الرابط غير صالح أو غير مدعوم لهذه البطولة.'}
          </p>
          <button type="button" className="tab-btn active" onClick={() => handleSeasonChange(null)}>
            <span>العودة إلى الموسم الحالي</span>
          </button>
        </div>
      ) : isTournament(activeLeague) && subTab === 'knockout' ? (
        loadingKnockout || loading ? (
          <div className="glass-card empty-state" style={{ padding: '60px 0' }}>
            <RefreshCw className="empty-icon animate-spin" size={32} style={{ animation: 'spin 1.5s linear infinite' }} />
            <p>جارٍ تحميل مواجهات الموسم...</p>
          </div>
        ) : knockoutError ? (
          <RequestState message={knockoutError} onRetry={() => setKnockoutRetry(n => n + 1)} />
        ) : (
          <KnockoutBracket key={activeLeague + seasonYear}
            bracketData={knockoutData}
            onMatchClick={onMatchClick}
          />
        )
      ) : (
        /* جداول الترتيب (دور المجموعات أو الدوريات الأخرى) */
        loading ? (
          <div className="table-responsive">
            <table className="standings-table">
              <thead>
                <tr>
                  <th style={{ width: 44, textAlign: 'center' }}>#</th>
                  <th style={{ textAlign: 'right' }}>الفريق</th>
                  <th style={{ width: 50, textAlign: 'center' }}>لعب</th>
                  <th style={{ width: 45, textAlign: 'center' }}>فاز</th>
                  <th style={{ width: 45, textAlign: 'center' }}>تعادل</th>
                  <th style={{ width: 45, textAlign: 'center' }}>خسر</th>
                  <th style={{ width: 75, textAlign: 'center' }}>أهداف</th>
                  <th style={{ width: 60, textAlign: 'center' }}>نقاط</th>
                </tr>
              </thead>
              <tbody>
                {[...Array(8)].map((_, i) => (
                  <TableRowSkeleton key={i} />
                ))}
              </tbody>
            </table>
          </div>
        ) : error && standingsData === null ? (
          <div className="d-flex flex-column align-center gap-2">
            <RequestState
              message={selectedSeason !== null ? `تعذر تحميل ترتيب موسم ${selectedSeason}. قد لا يكون هذا الموسم متاحاً لهذه البطولة.` : error}
              onRetry={() => controllerRef.current?.retry()}
            />
            {selectedSeason !== null && (
              <button type="button" className="tab-btn" onClick={() => handleSeasonChange(null)}>
                <span>العودة إلى الموسم الحالي</span>
              </button>
            )}
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

                <div className="glass-card standings-table-card">
                  <div className="standings-mobile-scroll-hint" aria-hidden="true">
                    <span>اسحب الجدول يمينًا أو يسارًا لعرض باقي الإحصائيات</span>
                  </div>
                  <div
                    className="table-responsive standings-table-scroll"
                    role="region"
                    aria-label={group.name || 'جدول الترتيب'}
                    tabIndex={0}
                  >
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
                        const zone = getZone(team);
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
                              <div className="team-cell" style={{ justifyContent: 'space-between', width: '100%' }}>
                                <div className="d-flex align-center gap-2" style={{ minWidth: 0 }}>
                                  {team.logo && (
                                    <img
                                      src={team.logo}
                                      alt={team.team}
                                      className="team-logo"
                                      style={{ width: 24, height: 24, flexShrink: 0 }}
                                      onError={(e) => e.target.style.display = 'none'}
                                    />
                                  )}
                                  {team.teamId ? (
                                    <Link
                                      to={`/team/${team.teamId}?league=${activeLeague}`}
                                      state={{ leagueId: activeLeague, team }}
                                      className="standings-team-link"
                                      style={{
                                        fontWeight: team.rank === 1 ? 700 : 600,
                                        color: 'var(--text-primary)',
                                        textDecoration: 'none'
                                      }}
                                    >
                                      {team.team}
                                      {isTournament(activeLeague) && zone && <small className="qualification-label" style={{ color: zone.color }}>{zone.label}</small>}
                                    </Link>
                                  ) : (
                                    <span style={{ fontWeight: team.rank === 1 ? 700 : 'normal' }}>{team.team}</span>
                                  )}
                                </div>
                                {team.teamId && (
                                  <FavoriteButton
                                    type="team"
                                    item={{
                                      id: team.teamId,
                                      name: team.team,
                                      arabicName: team.team,
                                      leagueId: activeLeague,
                                      leagueName: currentLeagueObj?.name || '',
                                      logo: team.logo,
                                      isMock: activeLeague === 'egypt.1'
                                    }}
                                    size={14}
                                  />
                                )}
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
                  </div>

                  {/* دليل الألوان والمراكز التأهيلية والهبوط في أسفل جدول كل دوري */}
                  {legend.length > 0 && (
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
                      {legend.map((item, idx) => (
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
    </div>
  );
};

export default LeagueStandings;
