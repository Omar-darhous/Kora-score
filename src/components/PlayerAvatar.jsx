import React, { useState } from 'react';
import { getPlayerInitials, getAvatarRenderState } from '../utils/playerAvatar';

const PlayerAvatar = ({ playerId = '', name = '', photo = '', className = '' }) => {
  const [failedKey, setFailedKey] = useState(null);
  const { validPhoto, avatarKey, showImage } = getAvatarRenderState({
    playerId,
    photo,
    failedKey
  });
  const initials = getPlayerInitials(name);

  return (
    <div className={`player-card-avatar ${className}`.trim()}>
      {showImage ? (
        <img
          key={avatarKey}
          src={validPhoto}
          alt={name || 'لاعب'}
          className="player-photo"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailedKey(avatarKey)}
        />
      ) : (
        <div className="player-avatar-fallback" aria-label={name || 'لاعب'}>
          {initials}
        </div>
      )}
    </div>
  );
};

export default PlayerAvatar;
