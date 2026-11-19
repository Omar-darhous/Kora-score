const TRUSTED_PHOTO_HOSTS = new Set([
  'a.espncdn.com',
  's.espncdn.com',
  'espncdn.com'
]);

const DISALLOWED_PATH_SEGMENTS = [
  '/teamlogos/',
  '/leaguelogos/',
  '/league-logos/',
  'default-team-logo',
  'default-soccer',
  'nophoto',
  'placeholder'
];

const ARABIC_CHAR_RE = /[\u0600-\u06FF]/;

/**
 * Validates that a player photo URL is an official, safe HTTPS ESPN headshot URL.
 * Never invents URLs or accepts unsafe protocols / non-portrait assets.
 */
export const isValidPlayerPhotoUrl = (url) => {
  if (typeof url !== 'string') return false;
  const clean = url.trim();
  if (!clean) return false;

  let parsed;
  try {
    parsed = new URL(clean);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'https:') return false;

  const host = parsed.hostname.toLowerCase();
  const isTrustedHost = TRUSTED_PHOTO_HOSTS.has(host) || host.endsWith('.espncdn.com');
  if (!isTrustedHost) return false;

  const lowerPath = parsed.pathname.toLowerCase();
  if (DISALLOWED_PATH_SEGMENTS.some((seg) => lowerPath.includes(seg))) {
    return false;
  }

  return true;
};

/**
 * Extracts and validates an official photo URL from either an ESPN athlete object
 * or a raw URL string. Returns '' when unavailable or invalid.
 */
export const resolvePlayerPhoto = (athleteOrUrl) => {
  const candidate = typeof athleteOrUrl === 'string'
    ? athleteOrUrl
    : athleteOrUrl?.headshot?.href;

  return isValidPlayerPhotoUrl(candidate) ? candidate.trim() : '';
};

/**
 * Generates clean, readable initials for both Arabic and English/Latin player names.
 * Separates Arabic initials with a space so adjacent letters do not join into ligatures.
 */
export const getPlayerInitials = (name = '') => {
  if (typeof name !== 'string') return 'ل';
  const cleaned = name
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .trim();

  if (!cleaned) return 'ل';

  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'ل';

  const isArabic = ARABIC_CHAR_RE.test(cleaned);
  const firstChar = Array.from(parts[0])[0] || '';

  if (parts.length === 1) {
    return isArabic ? firstChar : firstChar.toUpperCase();
  }

  const lastChar = Array.from(parts[parts.length - 1])[0] || '';
  if (isArabic) {
    return `${firstChar} ${lastChar}`.trim();
  }

  return `${firstChar}${lastChar}`.toUpperCase();
};

/**
 * Pure helper computing avatar identity key and whether a previous load error
 * still applies to the current player/photo combination.
 */
export const getAvatarRenderState = ({ playerId = '', photo = '', failedKey = null } = {}) => {
  const validPhoto = resolvePlayerPhoto(photo);
  const avatarKey = `${playerId ?? ''}|${validPhoto}`;
  const showImage = Boolean(validPhoto) && failedKey !== avatarKey;
  return { validPhoto, avatarKey, showImage };
};
