import React from 'react';
import LiveMatches from '../components/LiveMatches';
import MatchSchedule from '../components/MatchSchedule';

const HomePage = ({
  matches,
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
        onMatchClick={onMatchClick}
      />
      <MatchSchedule
        matches={matches}
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

