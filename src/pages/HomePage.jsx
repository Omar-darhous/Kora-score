import React from 'react';
import LiveMatches from '../components/LiveMatches';
import MatchSchedule from '../components/MatchSchedule';

const HomePage = ({
  matches,
  matchesLoading,
  matchesError,
  onRetryMatches,
  selectedDateStr,
  setSelectedDateStr,
  selectedLeague,
  setSelectedLeague,
  leagues,
  onMatchClick
}) => {
  return (
    <>
      <LiveMatches
        matches={matches}
        loading={matchesLoading}
        error={matchesError}
        onRetry={onRetryMatches}
        onMatchClick={onMatchClick}
      />
      <MatchSchedule
        matches={matches}
        loading={matchesLoading}
        error={matchesError}
        onRetry={onRetryMatches}
        selectedDateStr={selectedDateStr}
        setSelectedDateStr={setSelectedDateStr}
        selectedLeague={selectedLeague}
        setSelectedLeague={setSelectedLeague}
        leagues={leagues}
        onMatchClick={onMatchClick}
      />
    </>
  );
};

export default HomePage;

