// واجهة توافق خلفية تعيد تصدير جميع خدمات كرة القدم المقسّمة إلى وحدات مستقلة
import { defaultNewsFetcher } from './newsService.js';

export {
  DEFAULT_TEAM_LOGO,
  resolveLeagueLogo,
  resolveTeamLogo,
  getLeagues
} from './logoUtils.js';

export { getMatchDetails } from './matchesService.js';

export { getMatches, subscribeToLiveMatches } from './liveMatchesService.js';

export { getStandings, createStandingsController } from './standingsService.js';

export {
  isTrustedDwArticleUrl,
  isTrustedDwImageUrl,
  extractArticleMetaImage,
  createArticleImageResolver,
  enrichNewsImages
} from './dwImageResolver.js';

export const getNews = async ({ strict = false, forceRefresh = false, signal } = {}) => {
  try {
    return await defaultNewsFetcher.fetchNews({ strict: true, forceRefresh, signal });
  } catch (e) {
    if (e?.name !== 'AbortError') {
      console.error("Failed to load real news:", e);
    }
    if (strict) throw e;
    return [];
  }
};

export { getTournamentKnockouts } from './knockoutsService.js';

export { getTeamDetails, getTeamSchedule, getTeamRoster } from './teamsService.js';
