// خدمة إدارة المفضلة المحلية في منصة كورة سكور (Favorites Service)
// تعتمد على localStorage مع حماية كاملة ضد البيانات التالفة أو عدم توفر التخزين، دون الحاجة لحسابات أو خادم خارجي

export const FAVORITES_STORAGE_KEY = 'kora_score_favorites';

// نسخة احتياطية في الذاكرة في حال كان المتصفح يمنع الوصول إلى localStorage (مثل وضع التصفح المقيد)
let memoryFallback = {
  leagues: [],
  teams: []
};

/**
 * التحقق الصارم من صلاحية المعرف
 */
export const isValidFavoriteId = (id) => {
  if (id === null || id === undefined) return false;
  const str = String(id).trim();
  return (
    str.length > 0 &&
    str !== 'null' &&
    str !== 'undefined' &&
    str !== 'NaN'
  );
};

/**
 * تطهير وتوحيد كائن البطولة المفضلة
 */
export const sanitizeLeagueFavorite = (item) => {
  if (!item || typeof item !== 'object') return null;
  const rawId = item.id || item.leagueId;
  if (!isValidFavoriteId(rawId)) return null;

  const cleanId = String(rawId).trim();
  const isMock = cleanId === 'egypt.1' || Boolean(item.isMock);

  return {
    id: cleanId,
    name: String(item.name || item.arabicName || cleanId).trim(),
    country: item.country ? String(item.country).trim() : '',
    logo: item.logo ? String(item.logo).trim() : '',
    isMock
  };
};

/**
 * تطهير وتوحيد كائن النادي المفضل
 */
export const sanitizeTeamFavorite = (item) => {
  if (!item || typeof item !== 'object') return null;
  const rawId = item.id || item.teamId;
  if (!isValidFavoriteId(rawId)) return null;

  const cleanId = String(rawId).trim();
  const isEgyptian =
    cleanId.startsWith('egy-team-') ||
    item.leagueId === 'egypt.1' ||
    Boolean(item.isMock);

  const displayName = String(
    item.arabicName || item.name || item.team || cleanId
  ).trim();

  return {
    id: cleanId,
    name: String(item.name || item.team || displayName).trim(),
    arabicName: displayName,
    leagueId: item.leagueId
      ? String(item.leagueId).trim()
      : isEgyptian
      ? 'egypt.1'
      : '',
    leagueName: item.leagueName
      ? String(item.leagueName).trim()
      : isEgyptian
      ? 'الدوري المصري الممتاز'
      : '',
    logo: item.logo ? String(item.logo).trim() : '',
    isMock: isEgyptian
  };
};

/**
 * إزالة التكرار وتطهير قوائم المفضلة بالكامل
 */
export const sanitizeFavoritesState = (rawState) => {
  if (!rawState || typeof rawState !== 'object') {
    return { leagues: [], teams: [] };
  }

  const rawLeagues = Array.isArray(rawState.leagues) ? rawState.leagues : [];
  const rawTeams = Array.isArray(rawState.teams) ? rawState.teams : [];

  const leaguesMap = new Map();
  rawLeagues.forEach((item) => {
    const clean = sanitizeLeagueFavorite(item);
    if (clean && !leaguesMap.has(clean.id)) {
      leaguesMap.set(clean.id, clean);
    }
  });

  const teamsMap = new Map();
  rawTeams.forEach((item) => {
    const clean = sanitizeTeamFavorite(item);
    if (clean && !teamsMap.has(clean.id)) {
      teamsMap.set(clean.id, clean);
    }
  });

  return {
    leagues: Array.from(leaguesMap.values()),
    teams: Array.from(teamsMap.values())
  };
};

/**
 * قراءة المفضلة بأمان من localStorage
 */
export const loadFavorites = () => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return sanitizeFavoritesState(memoryFallback);
    }

    const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) {
      return { leagues: [], teams: [] };
    }

    const parsed = JSON.parse(raw);
    const sanitized = sanitizeFavoritesState(parsed);
    memoryFallback = sanitized;
    return sanitized;
  } catch (err) {
    console.warn('Could not load favorites from localStorage, using safe fallback:', err);
    return sanitizeFavoritesState(memoryFallback);
  }
};

/**
 * حفظ المفضلة بأمان في localStorage
 */
export const saveFavorites = (favoritesState) => {
  const sanitized = sanitizeFavoritesState(favoritesState);
  memoryFallback = sanitized;

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(sanitized));
    }
  } catch (err) {
    console.warn('Could not persist favorites to localStorage:', err);
  }

  return sanitized;
};

/**
 * التحقق مما إذا كانت البطولة مضافة للمفضلة
 */
export const isLeagueFavorite = (favoritesState, leagueId) => {
  if (!isValidFavoriteId(leagueId) || !favoritesState?.leagues) return false;
  const target = String(leagueId).trim();
  return favoritesState.leagues.some((l) => l.id === target);
};

/**
 * التحقق مما إذا كان النادي مضافاً للمفضلة
 */
export const isTeamFavorite = (favoritesState, teamId) => {
  if (!isValidFavoriteId(teamId) || !favoritesState?.teams) return false;
  const target = String(teamId).trim();
  return favoritesState.teams.some((t) => t.id === target);
};

/**
 * تبديل حالة بطولة في المفضلة (إضافة أو حذف)
 */
export const toggleFavoriteLeagueItem = (currentFavorites, leagueInput) => {
  const cleanLeague = sanitizeLeagueFavorite(leagueInput);
  if (!cleanLeague) {
    return { favorites: sanitizeFavoritesState(currentFavorites), added: false, item: null };
  }

  const current = sanitizeFavoritesState(currentFavorites);
  const exists = current.leagues.some((l) => l.id === cleanLeague.id);

  let nextLeagues;
  if (exists) {
    nextLeagues = current.leagues.filter((l) => l.id !== cleanLeague.id);
  } else {
    nextLeagues = [...current.leagues, cleanLeague];
  }

  const updated = saveFavorites({
    ...current,
    leagues: nextLeagues
  });

  return {
    favorites: updated,
    added: !exists,
    item: cleanLeague
  };
};

/**
 * تبديل حالة نادٍ في المفضلة (إضافة أو حذف)
 */
export const toggleFavoriteTeamItem = (currentFavorites, teamInput) => {
  const cleanTeam = sanitizeTeamFavorite(teamInput);
  if (!cleanTeam) {
    return { favorites: sanitizeFavoritesState(currentFavorites), added: false, item: null };
  }

  const current = sanitizeFavoritesState(currentFavorites);
  const exists = current.teams.some((t) => t.id === cleanTeam.id);

  let nextTeams;
  if (exists) {
    nextTeams = current.teams.filter((t) => t.id !== cleanTeam.id);
  } else {
    nextTeams = [...current.teams, cleanTeam];
  }

  const updated = saveFavorites({
    ...current,
    teams: nextTeams
  });

  return {
    favorites: updated,
    added: !exists,
    item: cleanTeam
  };
};

/**
 * تصفية المباريات المحملة حالياً في الذاكرة لإظهار المباريات المرتبطة بالبطولات أو الفرق المفضلة
 */
export const getFavoriteMatchesFromLoaded = (matches = [], favoritesState) => {
  if (!Array.isArray(matches) || matches.length === 0) return [];
  const state = sanitizeFavoritesState(favoritesState);

  const favLeagueIds = new Set(state.leagues.map((l) => l.id));
  const favTeamIds = new Set(state.teams.map((t) => t.id));

  if (favLeagueIds.size === 0 && favTeamIds.size === 0) return [];

  return matches.filter((m) => {
    if (!m) return false;
    const matchLeague = m.leagueId ? String(m.leagueId).trim() : '';
    const homeId = m.homeTeamId ? String(m.homeTeamId).trim() : '';
    const awayId = m.awayTeamId ? String(m.awayTeamId).trim() : '';

    return (
      (matchLeague && favLeagueIds.has(matchLeague)) ||
      (homeId && favTeamIds.has(homeId)) ||
      (awayId && favTeamIds.has(awayId))
    );
  });
};

