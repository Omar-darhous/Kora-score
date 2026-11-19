import React, { useMemo, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import LeagueStandings from '../components/LeagueStandings';
import { getLeagues } from '../services/footballService';
import { parseSeasonQueryParam, buildSeasonSearchParams } from '../services/standingsService';

const StandingsPage = ({ onMatchClick }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const leagues = useMemo(() => getLeagues(), []);
  const defaultLeagueId = leagues[0]?.id || 'eng.1';

  const rawLeague = searchParams.get('league');
  const isValidLeague = useMemo(() => {
    return rawLeague ? leagues.some((l) => l.id === rawLeague) : false;
  }, [leagues, rawLeague]);

  // مزامنة أولية وتصحيح المعلمات غير الصالحة عبر replace لتفادي تلويث سجل التصفح
  useEffect(() => {
    if (!rawLeague || !isValidLeague) {
      setSearchParams(
        (prev) => buildSeasonSearchParams(prev, { leagueId: defaultLeagueId, leagueChanged: !isValidLeague && Boolean(rawLeague) }),
        { replace: true }
      );
    }
  }, [rawLeague, isValidLeague, defaultLeagueId, setSearchParams]);

  const activeLeague = isValidLeague ? rawLeague : defaultLeagueId;
  const parsedSeason = useMemo(
    () => parseSeasonQueryParam(searchParams.get('season')),
    [searchParams]
  );

  // تغيير البطولة عند تفاعل المستخدم الفعلي عبر إضافة مدخل جديد للسجل وحذف season السابق لمنع تمرير موسم غير متوافق
  const handleLeagueChange = useCallback(
    (newLeagueId) => {
      if (newLeagueId === activeLeague) return;
      setSearchParams(
        (prev) => buildSeasonSearchParams(prev, { leagueId: newLeagueId, leagueChanged: true }),
        { replace: false }
      );
    },
    [activeLeague, setSearchParams]
  );

  const handleSeasonChange = useCallback(
    (nextSeason) => {
      setSearchParams(
        (prev) => buildSeasonSearchParams(prev, { leagueId: activeLeague, season: nextSeason }),
        { replace: false }
      );
    },
    [activeLeague, setSearchParams]
  );

  return (
    <LeagueStandings
      onMatchClick={onMatchClick}
      activeLeague={activeLeague}
      onLeagueChange={handleLeagueChange}
      selectedSeason={parsedSeason.season}
      invalidSeasonParam={!parsedSeason.valid}
      onSeasonChange={handleSeasonChange}
    />
  );
};

export default StandingsPage;
