import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  FAVORITES_STORAGE_KEY,
  loadFavorites,
  saveFavorites,
  isLeagueFavorite,
  isTeamFavorite,
  toggleFavoriteLeagueItem,
  toggleFavoriteTeamItem
} from '../services/favoritesService';

const FavoritesContext = createContext(null);

export const FavoritesProvider = ({ children, onNotify }) => {
  const [favorites, setFavorites] = useState(() => loadFavorites());

  // مزامنة المفضلة عبر التبويبات المختلفة للمتصفح في الوقت الفعلي
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === FAVORITES_STORAGE_KEY || e.key === null) {
        setFavorites(loadFavorites());
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // التحقق من وجود البطولة في المفضلة
  const checkIsLeagueFavorite = useCallback(
    (leagueId) => isLeagueFavorite(favorites, leagueId),
    [favorites]
  );

  // التحقق من وجود النادي في المفضلة
  const checkIsTeamFavorite = useCallback(
    (teamId) => isTeamFavorite(favorites, teamId),
    [favorites]
  );

  // إضافة أو إزالة بطولة من المفضلة
  const toggleLeague = useCallback(
    (leagueInput) => {
      let result = null;
      setFavorites((prev) => {
        result = toggleFavoriteLeagueItem(prev, leagueInput);
        return result.favorites;
      });

      if (result?.item && onNotify) {
        const msg = result.added
          ? `تمت إضافة بطولة "${result.item.name}" إلى المفضلة ⭐`
          : `تمت إزالة بطولة "${result.item.name}" من المفضلة`;
        onNotify(msg);
      }

      return result;
    },
    [onNotify]
  );

  // إضافة أو إزالة نادٍ من المفضلة
  const toggleTeam = useCallback(
    (teamInput) => {
      let result = null;
      setFavorites((prev) => {
        result = toggleFavoriteTeamItem(prev, teamInput);
        return result.favorites;
      });

      if (result?.item && onNotify) {
        const displayName = result.item.arabicName || result.item.name;
        const msg = result.added
          ? `تمت إضافة نادي "${displayName}" إلى المفضلة ⭐`
          : `تمت إزالة نادي "${displayName}" من المفضلة`;
        onNotify(msg);
      }

      return result;
    },
    [onNotify]
  );

  // مسح كافة عناصر المفضلة
  const clearAllFavorites = useCallback(() => {
    const empty = saveFavorites({ leagues: [], teams: [] });
    setFavorites(empty);
    if (onNotify) {
      onNotify('تم مسح قائمة المفضلة بالكامل');
    }
  }, [onNotify]);

  const contextValue = useMemo(
    () => ({
      favorites,
      favoriteLeagues: favorites.leagues,
      favoriteTeams: favorites.teams,
      totalFavoritesCount: favorites.leagues.length + favorites.teams.length,
      isLeagueFavorite: checkIsLeagueFavorite,
      isTeamFavorite: checkIsTeamFavorite,
      toggleLeague,
      toggleTeam,
      clearAllFavorites
    }),
    [
      favorites,
      checkIsLeagueFavorite,
      checkIsTeamFavorite,
      toggleLeague,
      toggleTeam,
      clearAllFavorites
    ]
  );

  return (
    <FavoritesContext.Provider value={contextValue}>
      {children}
    </FavoritesContext.Provider>
  );
};

// oxlint-disable-next-line react/only-export-components
export const useFavorites = () => {
  const context = useContext(FavoritesContext);
  if (!context) {
    return {
      favorites: { leagues: [], teams: [] },
      favoriteLeagues: [],
      favoriteTeams: [],
      totalFavoritesCount: 0,
      isLeagueFavorite: () => false,
      isTeamFavorite: () => false,
      toggleLeague: () => {},
      toggleTeam: () => {},
      clearAllFavorites: () => {}
    };
  }
  return context;
};

export default FavoritesContext;
