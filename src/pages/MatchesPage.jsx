import React, { useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import MatchSchedule from '../components/MatchSchedule';

const MatchesPage = ({
  matches,
  selectedDateStr,
  setSelectedDateStr,
  selectedLeague,
  setSelectedLeague,
  leagues,
  onMatchClick
}) => {
  const [searchParams, setSearchParams] = useSearchParams();

  // قراءة معلمات الاستعلام الأولية من الرابط
  useEffect(() => {
    const urlDate = searchParams.get('date');
    const urlLeague = searchParams.get('league');

    if (urlDate && urlDate !== selectedDateStr && /^\d{8}$/.test(urlDate)) {
      setSelectedDateStr(urlDate);
    }
    if (urlLeague && urlLeague !== selectedLeague) {
      setSelectedLeague(urlLeague);
    }
  }, [searchParams, selectedDateStr, selectedLeague, setSelectedDateStr, setSelectedLeague]);

  // تحديث الرابط عند تغيير التاريخ
  const handleDateChange = useCallback((newDate) => {
    setSelectedDateStr(newDate);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('date', newDate);
      return next;
    }, { replace: true });
  }, [setSelectedDateStr, setSearchParams]);

  // تحديث الرابط عند تغيير البطولة
  const handleLeagueChange = useCallback((newLeague) => {
    setSelectedLeague(newLeague);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (newLeague === 'all') {
        next.delete('league');
      } else {
        next.set('league', newLeague);
      }
      return next;
    }, { replace: true });
  }, [setSelectedLeague, setSearchParams]);

  return (
    <MatchSchedule
      matches={matches}
      selectedDateStr={selectedDateStr}
      setSelectedDateStr={handleDateChange}
      selectedLeague={selectedLeague}
      setSelectedLeague={handleLeagueChange}
      leagues={leagues}
      onMatchClick={onMatchClick}
    />
  );
};

export default MatchesPage;

