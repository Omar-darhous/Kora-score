import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { ArrowRight, Calendar, AlertCircle } from 'lucide-react';
import MatchDetailModal from '../components/MatchDetailModal';
import { getMatchDetails } from '../services/footballService';

const MatchPage = ({ matches = [], leagues = [] }) => {
  const { leagueId, matchId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // الرجوع الآمن: إذا كان هناك سجل تصفح داخلي سابق يعود للخلف، وإلا ينتقل بشكل موثوق إلى جدول المباريات
  const handleSafeBack = () => {
    const hasInternalHistory = window.history.state && typeof window.history.state.idx === 'number' && window.history.state.idx > 0;
    if (hasInternalHistory) {
      navigate(-1);
    } else {
      navigate('/matches');
    }
  };

  // استخراج المباراة إذا كانت ممررة في الحالة أو موجودة في قائمة المباريات
  const leagueObj = leagues.find(l => l.id === leagueId);
  const match = location.state?.match || matches.find(m => String(m.id) === String(matchId)) || {
    id: matchId,
    leagueId: leagueId,
    leagueName: leagueObj?.name || 'مركز المباراة',
    homeTeam: 'المباراة',
    awayTeam: ''
  };

  const hasFallbackData = Boolean(match.homeScore || (match.homeTeam && match.homeTeam !== 'المباراة'));

  useEffect(() => {
    let isMounted = true;
    const fetchDirectDetails = async () => {
      if (!leagueId || !matchId) {
        setError('معرف المباراة أو البطولة غير صالح.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const data = await getMatchDetails(leagueId, matchId);
        if (isMounted) {
          if (!data && !hasFallbackData) {
            setError('لم نتمكن من العثور على بيانات هذه المباراة أو أن الرابط المدخل غير صحيح.');
          } else {
            setDetails(data);
          }
        }
      } catch (err) {
        if (isMounted) {
          console.error('Error fetching direct match:', err);
          setError('حدث خطأ أثناء الاتصال بمزود البيانات.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchDirectDetails();
    return () => {
      isMounted = false;
    };
  }, [leagueId, matchId, hasFallbackData]);

  return (
    <div className="standalone-page-wrapper" style={{ maxWidth: 760, margin: '0 auto', width: '100%' }}>
      {/* Top Navigation Bar */}
      <div className="d-flex align-center justify-between" style={{ marginBottom: 16 }}>
        <button
          type="button"
          onClick={handleSafeBack}
          className="action-btn d-flex align-center gap-1"
          style={{ width: 'auto', padding: '8px 16px', fontSize: '0.85rem', fontWeight: 700 }}
          title="العودة للصفحة السابقة"
        >
          <ArrowRight size={16} />
          <span>العودة</span>
        </button>

        <div className="d-flex align-center gap-2">
          <Link
            to="/matches"
            className="d-flex align-center gap-1"
            style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.84rem', fontWeight: 600 }}
          >
            <Calendar size={14} color="var(--primary)" />
            <span>جدول المباريات</span>
          </Link>
        </div>
      </div>

      {error ? (
        <div className="glass-card empty-state" style={{ padding: '60px 20px', textAlign: 'center' }}>
          <AlertCircle size={42} color="var(--accent)" className="empty-icon" />
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: 12 }}>تفاصيل المباراة غير متوفرة</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', maxWidth: 420, margin: '8px auto 24px', lineHeight: 1.6 }}>
            {error}
          </p>
          <div className="d-flex align-center justify-center gap-2">
            <button
              type="button"
              onClick={handleSafeBack}
              className="action-btn"
              style={{ width: 'auto', padding: '8px 18px', fontWeight: 700 }}
            >
              العودة للخلف
            </button>
            <Link
              to="/matches"
              className="submit-btn"
              style={{ textDecoration: 'none', padding: '8px 20px', fontWeight: 700 }}
            >
              تصفح جدول المباريات
            </Link>
          </div>
        </div>
      ) : (
        <MatchDetailModal
          match={match}
          details={details}
          loading={loading}
          isStandalone={true}
          onClose={handleSafeBack}
        />
      )}
    </div>
  );
};

export default MatchPage;

