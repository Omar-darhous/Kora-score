import React from 'react';
import { Star } from 'lucide-react';
import { useFavorites } from '../context/FavoritesContext';
import { isValidFavoriteId } from '../services/favoritesService';

/**
 * زر تفاعلي موحد لإضافة أو إزالة البطولات والأندية من المفضلة
 * يمنع انتشار الحدث (stopPropagation) لضمان عدم تفعيل الروابط الأبوية عن طريق الخطأ
 */
const FavoriteButton = ({
  type = 'team', // 'team' | 'league'
  item,
  size = 16,
  showLabel = false,
  labelFavorite = 'في المفضلة',
  labelUnfavorite = 'إضافة للمفضلة',
  className = '',
  style = {}
}) => {
  const { isLeagueFavorite, isTeamFavorite, toggleLeague, toggleTeam } = useFavorites();

  if (!item) return null;

  const rawId = item.id || item.teamId || item.leagueId;
  if (!isValidFavoriteId(rawId)) return null;

  const cleanId = String(rawId).trim();
  const isFav = type === 'league' ? isLeagueFavorite(cleanId) : isTeamFavorite(cleanId);
  const entityName = item.arabicName || item.name || item.team || cleanId;

  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (type === 'league') {
      toggleLeague({
        id: cleanId,
        name: item.name || entityName,
        country: item.country || '',
        logo: item.logo || '',
        isMock: cleanId === 'egypt.1' || Boolean(item.isMock)
      });
    } else {
      toggleTeam({
        id: cleanId,
        name: item.name || item.team || entityName,
        arabicName: item.arabicName || item.name || item.team || entityName,
        leagueId: item.leagueId || (cleanId.startsWith('egy-team-') ? 'egypt.1' : ''),
        leagueName: item.leagueName || '',
        logo: item.logo || '',
        isMock:
          cleanId.startsWith('egy-team-') ||
          item.leagueId === 'egypt.1' ||
          Boolean(item.isMock)
      });
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      handleClick(e);
    }
  };

  const actionTitle = isFav
    ? `إزالة "${entityName}" من المفضلة`
    : `إضافة "${entityName}" إلى المفضلة`;

  return (
    <button
      type="button"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-pressed={isFav}
      aria-label={actionTitle}
      title={actionTitle}
      className={`favorite-toggle-btn ${isFav ? 'is-favorite' : ''} ${
        showLabel ? 'with-label' : 'icon-only'
      } ${className}`}
      style={style}
    >
      <Star
        size={size}
        strokeWidth={isFav ? 2.4 : 2}
        color={isFav ? 'var(--accent)' : 'currentColor'}
        fill={isFav ? 'var(--accent)' : 'none'}
        className="favorite-star-icon"
      />
      {showLabel && (
        <span className="favorite-btn-label">
          {isFav ? labelFavorite : labelUnfavorite}
        </span>
      )}
    </button>
  );
};

export default FavoriteButton;

