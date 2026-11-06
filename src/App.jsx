import React, { useState, useEffect } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Flame, AlertCircle } from 'lucide-react';

// استيراد المكونات المشتركة
import Header from './components/Header';
import MatchModalRoute from './components/MatchModalRoute';
import ApiSettingsModal from './components/ApiSettingsModal';
import SearchModal from './components/SearchModal';

// استيراد صفحات المسارات
import HomePage from './pages/HomePage';
import MatchesPage from './pages/MatchesPage';
import StandingsPage from './pages/StandingsPage';
import NewsPage from './pages/NewsPage';
import MatchPage from './pages/MatchPage';
import LeaguePage from './pages/LeaguePage';
import TeamPage from './pages/TeamPage';
import FavoritesPage from './pages/FavoritesPage';
import NotFoundPage from './pages/NotFoundPage';

// استيراد سياق المفضلة والخدمات
import { FavoritesProvider } from './context/FavoritesContext';
import { getMatches, getLeagues, subscribeToLiveMatches } from './services/footballService';

// مساعدة للحصول على تاريخ اليوم منسق كـ YYYYMMDD
const getTodayDateStr = () => {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
};

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const backgroundLocation = location.state?.backgroundLocation;

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'dark';
  });

  const [matches, setMatches] = useState([]);
  const [leagues, setLeagues] = useState([]);
  const [selectedDateStr, setSelectedDateStr] = useState(getTodayDateStr);
  const [selectedLeague, setSelectedLeague] = useState('all');

  const [showSettings, setShowSettings] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [goalToast, setGoalToast] = useState(null);
  const [feedbackToast, setFeedbackToast] = useState(null);

  // الاستماع لاختصار لوحة المفاتيح Ctrl+K أو Cmd+K لفتح البحث من أي مكان في التطبيق
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowSearch((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // تطبيق المظهر
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // جلب البطولات المتاحة
  useEffect(() => {
    setLeagues(getLeagues());
  }, []);

  // جلب المباريات عند تغيير التاريخ
  useEffect(() => {
    const loadMatches = async () => {
      try {
        const data = await getMatches(selectedDateStr);
        setMatches(data);
      } catch (e) {
        console.error('Failed to load matches for date:', e);
      }
    };
    loadMatches();
  }, [selectedDateStr]);

  // الاشتراك في تحديثات المباريات المباشرة الحقيقية للـ "اليوم"
  useEffect(() => {
    const unsubscribe = subscribeToLiveMatches((updatedMatches) => {
      const todayStr = getTodayDateStr();
      setSelectedDateStr(prevDate => {
        if (prevDate === todayStr) {
          setMatches(prevMatches => {
            // فحص الأهداف لإطلاق التنبيهات الفورية
            updatedMatches.forEach(newMatch => {
              if (newMatch.status === 'LIVE') {
                const oldMatch = prevMatches.find(m => m.id === newMatch.id);
                if (oldMatch && oldMatch.status === 'LIVE') {
                  const oldTotalGoals = oldMatch.homeScore + oldMatch.awayScore;
                  const newTotalGoals = newMatch.homeScore + newMatch.awayScore;
                  if (newTotalGoals > oldTotalGoals) {
                    const isHomeGoal = newMatch.homeScore > oldMatch.homeScore;
                    setGoalToast({
                      homeTeam: newMatch.homeTeam,
                      awayTeam: newMatch.awayTeam,
                      homeScore: newMatch.homeScore,
                      awayScore: newMatch.awayScore,
                      minute: newMatch.minute,
                      scorer: isHomeGoal ? `هدف لصالح ${newMatch.homeTeam}` : `هدف لصالح ${newMatch.awayTeam}`
                    });

                    setTimeout(() => setGoalToast(null), 6000);
                  }
                }
              }
            });

            return updatedMatches;
          });
        }
        return prevDate;
      });
    });

    return () => unsubscribe();
  }, []);

  // الانتقال لصفحة/نافذة تفاصيل المباراة مع حفظ الموقع الخلفي بعد التحقق الصارم
  const handleMatchClick = (match) => {
    const rawId = match?.id;
    const rawLeagueId = match?.leagueId;

    if (!rawId || !rawLeagueId || (typeof rawId !== 'string' && typeof rawId !== 'number') || typeof rawLeagueId !== 'string') {
      setFeedbackToast('تفاصيل هذه المباراة غير متوفرة حالياً لعدم اكتمال بيانات البطولة.');
      setTimeout(() => setFeedbackToast(null), 4000);
      return;
    }

    const cleanMatchId = String(rawId).trim();
    const cleanLeagueId = String(rawLeagueId).trim();

    if (!cleanMatchId || !cleanLeagueId) {
      setFeedbackToast('تفاصيل هذه المباراة غير متوفرة حالياً لعدم اكتمال بيانات البطولة.');
      setTimeout(() => setFeedbackToast(null), 4000);
      return;
    }

    navigate(`/match/${cleanLeagueId}/${cleanMatchId}`, {
      state: { backgroundLocation: location, match }
    });
  };

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const triggerFeedback = (msg) => {
    setFeedbackToast(msg);
    setTimeout(() => setFeedbackToast(null), 3500);
  };

  return (
    <FavoritesProvider onNotify={triggerFeedback}>
      <div className="app-container">
      {/* إشعار هدف مباشر بنمط البث التلفزيوني الرياضي */}
      <AnimatePresence>
        {goalToast && (
          <motion.div
            style={{
              position: 'fixed',
              top: 24,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 9999,
              padding: '14px 22px',
              background: 'var(--bg-surface-elevated)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-medium)',
              borderRight: '4px solid var(--primary)',
              borderLeft: '4px solid var(--live)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-lg), 0 0 24px rgba(16, 185, 129, 0.2)',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              direction: 'rtl',
              minWidth: 320
            }}
            initial={{ opacity: 0, y: -40, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -40, x: '-50%' }}
            transition={{ type: 'spring', damping: 20, stiffness: 280 }}
          >
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 'var(--radius-full)',
              background: 'var(--live-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--live)'
            }}>
              <Flame size={22} className="animate-pulse" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span className="live-dot" />
                <h4 style={{ fontWeight: 900, fontSize: '1rem', color: 'var(--live)' }}>
                  هدف مباشر! GOAL
                </h4>
              </div>
              <p style={{ fontSize: '0.88rem', fontWeight: 700, margin: 0 }}>
                {goalToast.homeTeam} <span style={{ fontFamily: 'var(--font-mono)' }}>{goalToast.homeScore} - {goalToast.awayScore}</span> {goalToast.awayTeam} (<bdi>{String(goalToast.minute || '').replace(/['"’`]/g, '').trim()}</bdi> د)
              </p>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                {goalToast.scorer}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Header
        theme={theme}
        toggleTheme={toggleTheme}
        onOpenSettings={() => setShowSettings(true)}
        onOpenSearch={() => setShowSearch(true)}
      />

      <main className="main-content">
        <Routes location={backgroundLocation || location}>
          <Route
            path="/"
            element={
              <HomePage
                matches={matches}
                selectedDateStr={selectedDateStr}
                setSelectedDateStr={setSelectedDateStr}
                selectedLeague={selectedLeague}
                setSelectedLeague={setSelectedLeague}
                leagues={leagues}
                onMatchClick={handleMatchClick}
              />
            }
          />

          <Route
            path="/matches"
            element={
              <MatchesPage
                matches={matches}
                selectedDateStr={selectedDateStr}
                setSelectedDateStr={setSelectedDateStr}
                selectedLeague={selectedLeague}
                setSelectedLeague={setSelectedLeague}
                leagues={leagues}
                onMatchClick={handleMatchClick}
              />
            }
          />

          <Route
            path="/standings"
            element={<StandingsPage onMatchClick={handleMatchClick} />}
          />

          <Route
            path="/news"
            element={<NewsPage />}
          />

          <Route
            path="/favorites"
            element={
              <FavoritesPage
                matches={matches}
                leagues={leagues}
                onMatchClick={handleMatchClick}
              />
            }
          />

          <Route
            path="/league/:leagueId"
            element={
              <LeaguePage
                matches={matches}
                leagues={leagues}
                onMatchClick={handleMatchClick}
              />
            }
          />

          <Route
            path="/team/:teamId"
            element={
              <TeamPage
                matches={matches}
                leagues={leagues}
                onMatchClick={handleMatchClick}
              />
            }
          />

          <Route
            path="/match/:leagueId/:matchId"
            element={<MatchPage matches={matches} leagues={leagues} />}
          />

          <Route
            path="*"
            element={<NotFoundPage />}
          />
        </Routes>
      </main>

      <footer className="app-footer">
        <p>حقوق النشر © {new Date().getFullYear()} كورة سكور — منصة النتائج الرياضية المباشرة. جميع الحقوق محفوظة.</p>
        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
          البيانات والمواعيد مستخرجة في الوقت الفعلي من ملاعب كرة القدم العالمية وموجز الأخبار الرسمي.
        </p>
      </footer>

      {/* نافذة تفاصيل المباراة عند التصفح الداخلي عبر Background Location */}
      {backgroundLocation && (
        <Routes>
          <Route
            path="/match/:leagueId/:matchId"
            element={
              <MatchModalRoute
                matches={matches}
                onClose={() => navigate(-1)}
              />
            }
          />
        </Routes>
      )}

      {/* نافذة البحث السريع الشامل */}
      <SearchModal
        isOpen={showSearch}
        onClose={() => setShowSearch(false)}
        matches={matches}
        leagues={leagues}
        onMatchClick={handleMatchClick}
      />

      {/* نافذة إعدادات الـ API */}
      <AnimatePresence>
        {showSettings && (
          <ApiSettingsModal
            onClose={() => setShowSettings(false)}
            onSave={() => { }}
          />
        )}
      </AnimatePresence>

      {/* رسالة تنبيه للمباريات غير مكتملة المعرفات */}
      <AnimatePresence>
        {feedbackToast && (
          <motion.div
            style={{
              position: 'fixed',
              bottom: 80,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 9999,
              padding: '12px 20px',
              background: 'var(--bg-surface-elevated)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-medium)',
              borderRight: '4px solid var(--accent)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-lg)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              direction: 'rtl',
              fontSize: '0.85rem',
              fontWeight: 600,
              maxWidth: '90vw'
            }}
            initial={{ opacity: 0, y: 20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 20, x: '-50%' }}
            transition={{ duration: 0.2 }}
          >
            <AlertCircle size={18} color="var(--accent)" />
            <span>{feedbackToast}</span>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </FavoritesProvider>
  );
}

export default App;
