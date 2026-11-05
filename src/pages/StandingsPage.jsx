import React, { useMemo, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import LeagueStandings from '../components/LeagueStandings';
import { getLeagues } from '../services/footballService';

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
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('league', defaultLeagueId);
          return next;
        },
        { replace: true }
      );
    }
  }, [rawLeague, isValidLeague, defaultLeagueId, setSearchParams]);

  const activeLeague = isValidLeague ? rawLeague : defaultLeagueId;

  // تغيير البطولة عند تفاعل المستخدم الفعلي عبر إضافة مدخل جديد للسجل (push)
  const handleLeagueChange = useCallback(
    (newLeagueId) => {
      if (newLeagueId === activeLeague) return;
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('league', newLeagueId);
          return next;
        },
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
    />
  );
};

export default StandingsPage;
