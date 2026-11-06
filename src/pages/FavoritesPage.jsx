import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Star,
  Trophy,
  Shield,
  Calendar,
  Info,
  Trash2,
  ChevronLeft,
  Sparkles,
  Clock
} from 'lucide-react';
import { useFavorites } from '../context/FavoritesContext';
import { getFavoriteMatchesFromLoaded } from '../services/favoritesService';
import { POPULAR_TEAMS } from '../services/searchService';
import FavoriteButton from '../components/FavoriteButton';
import { EgyptianDisclaimer, EgyptianBadge } from '../components/EgyptianDisclaimer';

const FavoritesPage = ({ matches = [], leagues = [], onMatchClick }) => {
  const {
    favorites,
    favoriteLeagues,
    favoriteTeams,
    totalFavoritesCount,
    clearAllFavorites
  } = useFavorites();

  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'teams' | 'leagues' | 'matches'

  // إثراء بيانات البطولات المفضلة من قائمة البطولات الحية إن توفرت
  const enrichedFavoriteLeagues = useMemo(() => {
    return favoriteLeagues.map((favLeague) => {
      const found = leagues.find((l) => l.id === favLeague.id);
      return {
        ...favLeague,
        name: found?.name || favLeague.name,
        country: found?.country || favLeague.country || '',
        logo: found?.logo || favLeague.logo || '',
        isMock: favLeague.id === 'egypt.1' || Boolean(favLeague.isMock)
      };
    });
  }, [favoriteLeagues, leagues]);

  // إثراء بيانات الأندية المفضلة من قاعدة الأندية المعتمدة لضمان الشعارات والأسماء العربية
  const enrichedFavoriteTeams = useMemo(() => {
    return favoriteTeams.map((favTeam) => {
      const known = POPULAR_TEAMS.find((t) => t.id === favTeam.id);
      const isEgyptian =
        favTeam.id.startsWith('egy-team-') ||
        favTeam.leagueId === 'egypt.1' ||
        Boolean(favTeam.isMock);

      const leagueObj = leagues.find(
        (l) => l.id === (favTeam.leagueId || known?.leagueId)
      );

      return {
        ...favTeam,
        name: favTeam.name || known?.name || favTeam.id,
        arabicName: favTeam.arabicName || known?.arabicName || favTeam.name || favTeam.id,
        leagueId: favTeam.leagueId || known?.leagueId || (isEgyptian ? 'egypt.1' : ''),
        leagueName:
          favTeam.leagueName ||
          leagueObj?.name ||
          known?.leagueName ||
          (isEgyptian ? 'الدوري المصري الممتاز' : ''),
        logo: favTeam.logo || known?.logo || '',
        isMock: isEgyptian
      };
    });
  }, [favoriteTeams, leagues]);

  // استخراج المباريات المرتبطة بالمفضلة من بيانات المباريات المحملة حالياً في الذاكرة فقط
  const favoriteMatches = useMemo(() => {
    return getFavoriteMatchesFromLoaded(matches, favorites);
  }, [matches, favorites]);

  // التحقق من وجود أي بيانات مصرية تجريبية ضمن المفضلة المعروضة لإظهار التنويه الرسمي
  const hasEgyptianDataInView = useMemo(() => {
    const hasEgyLeague = enrichedFavoriteLeagues.some((l) => l.isMock || l.id === 'egypt.1');
    const hasEgyTeam = enrichedFavoriteTeams.some(
      (t) => t.isMock || t.id.startsWith('egy-team-') || t.leagueId === 'egypt.1'
    );
    const hasEgyMatch = favoriteMatches.some((m) => m.leagueId === 'egypt.1');

    if (activeTab === 'leagues') return hasEgyLeague;
    if (activeTab === 'teams') return hasEgyTeam;
    if (activeTab === 'matches') return hasEgyMatch;
    return hasEgyLeague || hasEgyTeam || hasEgyMatch;
  }, [enrichedFavoriteLeagues, enrichedFavoriteTeams, favoriteMatches, activeTab]);

  // قائمة مقترحات سريعة من الأندية المعتمدة (دولية + الأندية المصرية الستة المدعومة)
  const suggestedTeams = useMemo(() => {
    const targetIds = [
      '364', // ليفربول
      '86',  // ريال مدريد
      '83',  // برشلونة
      '382', // مانشستر سيتي
      '359', // آرسنال
      '929', // الهلال
      'egy-team-ahly',     // الأهلي
      'egy-team-zamalek',  // الزمالك
      'egy-team-pyramids', // بيراميدز
      'egy-team-masry',    // المصري البورسعيدي
      'egy-team-ittihad',  // الاتحاد السكندري
      'egy-team-ismaily'   // الإسماعيلي
    ];
    return targetIds
      .map((id) => POPULAR_TEAMS.find((t) => t.id === id))
      .filter(Boolean);
  }, []);

  const showTeamsSection = activeTab === 'all' || activeTab === 'teams';
  const showLeaguesSection = activeTab === 'all' || activeTab === 'leagues';
  const showMatchesSection = activeTab === 'all' || activeTab === 'matches';

  return (
    <div className="favorites-page-container">
      {/* بطاقة الترويسة الرئيسية لصفحة المفضلة */}
      <div className="favorites-hero-card">
        <div className="favorites-hero-main">
          <div className="favorites-hero-icon">
            <Star size={28} color="var(--accent)" fill="var(--accent)" />
          </div>
          <div className="favorites-hero-info">
            <h1 className="favorites-hero-title">قائمتي المفضلة</h1>
            <p className="favorites-hero-subtitle">
              تابع أنديتك وبطولاتك المفضلة والوصول السريع لمبارياتها المعروضة حالياً في مكان واحد
            </p>
          </div>
        </div>

        <div className="favorites-hero-stats">
          <div className="fav-stat-pill">
            <Shield size={15} color="var(--primary)" />
            <span>الأندية:</span>
            <strong>{enrichedFavoriteTeams.length}</strong>
          </div>
          <div className="fav-stat-pill">
            <Trophy size={15} color="var(--accent)" />
            <span>البطولات:</span>
            <strong>{enrichedFavoriteLeagues.length}</strong>
          </div>
          <div className="fav-stat-pill">
            <Calendar size={15} color="var(--text-secondary)" />
            <span>مباريات بالجدول الحالي:</span>
            <strong>{favoriteMatches.length}</strong>
          </div>

          {totalFavoritesCount > 0 && (
            <button
              type="button"
              onClick={clearAllFavorites}
              className="fav-clear-all-btn"
              title="مسح كافة العناصر من المفضلة"
            >
              <Trash2 size={14} />
              <span>مسح الكل</span>
            </button>
          )}
        </div>
      </div>

      {/* شريط التبويبات للتصفية */}
      <div className="favorites-tabs-bar" role="tablist" aria-label="أقسام المفضلة">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'all'}
          className={`fav-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          <Star size={15} />
          <span>الكل ({totalFavoritesCount})</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'teams'}
          className={`fav-tab-btn ${activeTab === 'teams' ? 'active' : ''}`}
          onClick={() => setActiveTab('teams')}
        >
          <Shield size={15} />
          <span>الأندية ({enrichedFavoriteTeams.length})</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'leagues'}
          className={`fav-tab-btn ${activeTab === 'leagues' ? 'active' : ''}`}
          onClick={() => setActiveTab('leagues')}
        >
          <Trophy size={15} />
          <span>البطولات ({enrichedFavoriteLeagues.length})</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'matches'}
          className={`fav-tab-btn ${activeTab === 'matches' ? 'active' : ''}`}
          onClick={() => setActiveTab('matches')}
        >
          <Calendar size={15} />
          <span>مباريات الجدول الحالي ({favoriteMatches.length})</span>
        </button>
      </div>

      {/* إظهار تنويه الدوري المصري عند وجود أي عنصر مصري تجريبي في العرض */}
      {hasEgyptianDataInView && <EgyptianDisclaimer />}

      {/* المحتوى عند عدم وجود أي مفضلة بعد */}
      {totalFavoritesCount === 0 ? (
        <div className="glass-card favorites-empty-state">
          <div className="favorites-empty-icon-wrap">
            <Star size={40} color="var(--accent)" />
          </div>
          <h2 className="favorites-empty-title">قائمتك المفضلة فارغة حالياً</h2>
          <p className="favorites-empty-desc">
            يمكنك إضافة أي نادٍ أو بطولة إلى مفضلتك بالضغط على رمز النجمة ⭐ في صفحات البطولات، صفحات الأندية، جداول الترتيب، أو من الاقتراحات السريعة أدناه.
          </p>
        </div>
      ) : (
        <div className="favorites-sections-stack">
          {/* 1. قسم الأندية المفضلة */}
          {showTeamsSection && (
            <section className="favorites-section">
              <div className="favorites-section-header">
                <div className="d-flex align-center gap-2">
                  <Shield size={19} color="var(--primary)" />
                  <h2 className="favorites-section-title">الأندية المفضلة</h2>
                  <span className="section-badge-count">{enrichedFavoriteTeams.length}</span>
                </div>
              </div>

              {enrichedFavoriteTeams.length === 0 ? (
                <div className="glass-card fav-subsection-empty">
                  <p>لم تقم بإضافة أي نادٍ إلى المفضلة حتى الآن.</p>
                </div>
              ) : (
                <div className="favorites-cards-grid">
                  {enrichedFavoriteTeams.map((team) => {
                    const teamRoute = team.leagueId
                      ? `/team/${team.id}?league=${team.leagueId}`
                      : `/team/${team.id}`;

                    return (
                      <Link
                        key={team.id}
                        to={teamRoute}
                        className="favorite-entity-card"
                      >
                        <div className="favorite-card-top">
                          <div className="favorite-card-identity">
                            <div className="favorite-card-logo-box">
                              {team.logo ? (
                                <img
                                  src={team.logo}
                                  alt={team.arabicName}
                                  className="favorite-card-logo"
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                  }}
                                />
                              ) : (
                                <span className="favorite-card-logo-fallback">
                                  {(team.arabicName || team.name).charAt(0)}
                                </span>
                              )}
                            </div>

                            <div className="favorite-card-text">
                              <div className="d-flex align-center gap-1 flex-wrap">
                                <h3 className="favorite-card-title">{team.arabicName}</h3>
                                {team.isMock && <EgyptianBadge />}
                              </div>
                              {team.leagueName && (
                                <span className="favorite-card-sub">
                                  {team.leagueName}
                                </span>
                              )}
                            </div>
                          </div>

                          <FavoriteButton
                            type="team"
                            item={team}
                            size={18}
                          />
                        </div>

                        <div className="favorite-card-footer">
                          <span className="favorite-card-link-hint">
                            عرض صفحة النادي والإحصائيات
                          </span>
                          <ChevronLeft size={15} />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* 2. قسم البطولات المفضلة */}
          {showLeaguesSection && (
            <section className="favorites-section">
              <div className="favorites-section-header">
                <div className="d-flex align-center gap-2">
                  <Trophy size={19} color="var(--accent)" />
                  <h2 className="favorites-section-title">البطولات المفضلة</h2>
                  <span className="section-badge-count">{enrichedFavoriteLeagues.length}</span>
                </div>
              </div>

              {enrichedFavoriteLeagues.length === 0 ? (
                <div className="glass-card fav-subsection-empty">
                  <p>لم تقم بإضافة أي بطولة إلى المفضلة حتى الآن.</p>
                </div>
              ) : (
                <div className="favorites-cards-grid">
                  {enrichedFavoriteLeagues.map((league) => (
                    <Link
                      key={league.id}
                      to={`/league/${league.id}`}
                      className="favorite-entity-card"
                    >
                      <div className="favorite-card-top">
                        <div className="favorite-card-identity">
                          <div className="favorite-card-logo-box">
                            {league.logo ? (
                              <img
                                src={league.logo}
                                alt={league.name}
                                className="favorite-card-logo"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                }}
                              />
                            ) : (
                              <Trophy size={22} color="var(--accent)" />
                            )}
                          </div>

                          <div className="favorite-card-text">
                            <div className="d-flex align-center gap-1 flex-wrap">
                              <h3 className="favorite-card-title">{league.name}</h3>
                              {league.isMock && <EgyptianBadge />}
                            </div>
                            {league.country && (
                              <span className="favorite-card-sub">{league.country}</span>
                            )}
                          </div>
                        </div>

                        <FavoriteButton
                          type="league"
                          item={league}
                          size={18}
                        />
                      </div>

                      <div className="favorite-card-footer">
                        <span className="favorite-card-link-hint">
                          استعراض جدول الترتيب والفرق
                        </span>
                        <ChevronLeft size={15} />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* 3. قسم مباريات المفضلة ضمن البيانات المحملة حالياً */}
          {showMatchesSection && (
            <section className="favorites-section">
              <div className="favorites-section-header">
                <div className="d-flex align-center gap-2">
                  <Calendar size={19} color="var(--primary)" />
                  <h2 className="favorites-section-title">
                    مباريات المفضلة (من الجدول المحمّل حالياً)
                  </h2>
                  <span className="section-badge-count">{favoriteMatches.length}</span>
                </div>
              </div>

              {/* تنبيه نطاق المباريات المحملة في الذاكرة */}
              <div className="favorites-matches-scope-note">
                <Info size={16} color="var(--primary)" style={{ flexShrink: 0 }} />
                <span>
                  تُعرض هنا المباريات المتوفرة في جدول التاريخ المحمّل حالياً فقط، ولا تمثل سجل مباريات الموسم بالكامل. لتصفح جدول موسم نادٍ أو بطولة بالكامل، اضغط على بطاقة النادي أو البطولة أعلاه.
                </span>
              </div>

              {favoriteMatches.length === 0 ? (
                <div className="glass-card fav-subsection-empty">
                  <p>
                    لا توجد مباريات لفرقك أو بطولاتك المفضلة ضمن جدول التاريخ المحمّل حالياً.
                  </p>
                </div>
              ) : (
                <div className="favorites-matches-list">
                  {favoriteMatches.map((match) => {
                    const isEgyMatch = match.leagueId === 'egypt.1';

                    let statusLabel = 'لم تبدأ';
                    if (isEgyMatch) {
                      if (match.status === 'LIVE') statusLabel = 'جارية (تجريبية)';
                      else if (match.status === 'FINISHED') statusLabel = 'انتهت (تجريبية)';
                      else statusLabel = match.time || 'مجدولة (تجريبية)';
                    } else {
                      if (match.status === 'LIVE') statusLabel = `مباشر • ${match.minute || ''}`;
                      else if (match.status === 'FINISHED') statusLabel = 'انتهت';
                      else statusLabel = match.time || 'قادمة';
                    }

                    return (
                      <div
                        key={match.id}
                        className="favorite-match-row glass-card"
                        onClick={() => {
                          if (onMatchClick) onMatchClick(match);
                        }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            if (onMatchClick) onMatchClick(match);
                          }
                        }}
                      >
                        <div className="favorite-match-meta">
                          <span className="favorite-match-league">{match.leagueName}</span>
                          {isEgyMatch && <EgyptianBadge />}
                          <span
                            className={`favorite-match-status ${
                              match.status === 'LIVE' && !isEgyMatch ? 'is-live' : ''
                            }`}
                          >
                            {match.status === 'UPCOMING' && <Clock size={12} />}
                            <span>{statusLabel}</span>
                          </span>
                        </div>

                        <div className="favorite-match-teams">
                          {/* الفريق المضيف */}
                          <div className="fav-match-side home">
                            <span className="fav-match-team-name">{match.homeTeam}</span>
                            {match.homeLogo && (
                              <img
                                src={match.homeLogo}
                                alt={match.homeTeam}
                                className="fav-match-team-logo"
                                onError={(e) => (e.target.style.display = 'none')}
                              />
                            )}
                          </div>

                          {/* النتيجة أو التوقيت */}
                          <div className="fav-match-score-box">
                            {match.status === 'UPCOMING' ? (
                              <span className="fav-match-vs">VS</span>
                            ) : (
                              <span className="fav-match-score">
                                {match.homeScore} - {match.awayScore}
                              </span>
                            )}
                          </div>

                          {/* الفريق الضيف */}
                          <div className="fav-match-side away">
                            {match.awayLogo && (
                              <img
                                src={match.awayLogo}
                                alt={match.awayTeam}
                                className="fav-match-team-logo"
                                onError={(e) => (e.target.style.display = 'none')}
                              />
                            )}
                            <span className="fav-match-team-name">{match.awayTeam}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {/* قسم الاقتراحات السريعة لإضافة البطولات والأندية المعتمدة بسهولة */}
      <section className="favorites-discovery-section">
        <div className="favorites-section-header">
          <div className="d-flex align-center gap-2">
            <Sparkles size={18} color="var(--accent)" />
            <h2 className="favorites-section-title">إضافة سريعة للبطولات والأندية المدعومة</h2>
          </div>
        </div>

        {/* بطولات مقترحة */}
        <div className="fav-discovery-group">
          <h3 className="fav-discovery-subtitle">البطولات المتاحة</h3>
          <div className="fav-discovery-chips">
            {leagues.map((league) => {
              const isMock = league.id === 'egypt.1';
              return (
                <div key={league.id} className="fav-discovery-chip">
                  <Link to={`/league/${league.id}`} className="fav-chip-info">
                    {league.logo && (
                      <img
                        src={league.logo}
                        alt={league.name}
                        className="fav-chip-logo"
                        onError={(e) => (e.target.style.display = 'none')}
                      />
                    )}
                    <span className="fav-chip-name">{league.name}</span>
                    {isMock && <EgyptianBadge />}
                  </Link>
                  <FavoriteButton
                    type="league"
                    item={{
                      id: league.id,
                      name: league.name,
                      country: league.country,
                      logo: league.logo,
                      isMock
                    }}
                    size={16}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* أندية مقترحة (دولية + الأندية المصرية الستة المعتمدة) */}
        <div className="fav-discovery-group" style={{ marginTop: 18 }}>
          <h3 className="fav-discovery-subtitle">أبرز الأندية الدولية والأندية المصرية الستة المدعومة</h3>
          <div className="fav-discovery-chips">
            {suggestedTeams.map((team) => (
              <div key={team.id} className="fav-discovery-chip">
                <Link
                  to={`/team/${team.id}?league=${team.leagueId}`}
                  className="fav-chip-info"
                >
                  {team.logo ? (
                    <img
                      src={team.logo}
                      alt={team.arabicName}
                      className="fav-chip-logo"
                      onError={(e) => (e.target.style.display = 'none')}
                    />
                  ) : (
                    <span className="fav-chip-logo-fallback">
                      {team.arabicName.charAt(0)}
                    </span>
                  )}
                  <span className="fav-chip-name">{team.arabicName}</span>
                  {team.isMock && <EgyptianBadge />}
                </Link>
                <FavoriteButton
                  type="team"
                  item={team}
                  size={16}
                />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default FavoritesPage;
