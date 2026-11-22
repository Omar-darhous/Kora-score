import React, { useState, useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import MatchDetailModal from './MatchDetailModal';
import { getMatchDetails } from '../services/footballService';

const MatchModalRoute = ({ matches = [], onClose }) => {
  const { leagueId, matchId } = useParams();
  const location = useLocation();
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  // دمج آخر نسخة حية من قائمة المباريات فوق اللقطة الأولية حتى تتحدث حالة المباراة والنتيجة فورياً أثناء فتح النافذة
  const liveMatch = matches.find(m => String(m.id) === String(matchId));
  const match = liveMatch
    ? { ...(location.state?.match || {}), ...liveMatch }
    : location.state?.match;

  useEffect(() => {
    let isMounted = true;
    const loadDetails = async ({ forceRefresh = false } = {}) => {
      if (!leagueId || !matchId) return;
      if (!forceRefresh) setLoading(true);
      try {
        const data = await getMatchDetails(leagueId, matchId, { forceRefresh });
        if (isMounted) {
          setDetails(data);
        }
      } catch (err) {
        console.error('Failed to fetch modal match details:', err);
      } finally {
        if (isMounted && !forceRefresh) {
          setLoading(false);
        }
      }
    };

    loadDetails();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadDetails({ forceRefresh: true });
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      isMounted = false;
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [leagueId, matchId]);

  return (
    <MatchDetailModal
      match={match || { id: matchId, leagueId, homeTeam: 'المباراة', awayTeam: '' }}
      details={details}
      loading={loading}
      onClose={onClose}
    />
  );
};

export default MatchModalRoute;

