import React, { useState, useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import MatchDetailModal from './MatchDetailModal';
import { getMatchDetails } from '../services/footballService';

const MatchModalRoute = ({ matches = [], onClose }) => {
  const { leagueId, matchId } = useParams();
  const location = useLocation();
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  // استخراج بيانات المباراة الأساسية من حالة التوجيه أو من قائمة المباريات المحملة
  const match = location.state?.match || matches.find(m => String(m.id) === String(matchId));

  useEffect(() => {
    let isMounted = true;
    const loadDetails = async () => {
      if (!leagueId || !matchId) return;
      setLoading(true);
      try {
        const data = await getMatchDetails(leagueId, matchId);
        if (isMounted) {
          setDetails(data);
        }
      } catch (err) {
        console.error('Failed to fetch modal match details:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadDetails();
    return () => {
      isMounted = false;
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

