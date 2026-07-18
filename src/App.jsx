import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, Trophy } from 'lucide-react';

// استيراد المكونات
import Header from './components/Header';
import LiveMatches from './components/LiveMatches';
import MatchSchedule from './components/MatchSchedule';
import LeagueStandings from './components/LeagueStandings';
import NewsSection from './components/NewsSection';
import MatchDetailModal from './components/MatchDetailModal';
import ApiSettingsModal from './components/ApiSettingsModal';

// استيراد الخدمات
import { getMatches, getLeagues, subscribeToLiveMatches, getMatchDetails } from './services/footballService';

// مساعدة للحصول على تاريخ اليوم منسق كـ YYYYMMDD
const getTodayDateStr = () => {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
};

function App() {
  const [activeTab, setActiveTab] = useState('live');
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'dark';
  });
  
  const [matches, setMatches] = useState([]);
  const [leagues, setLeagues] = useState([]);
  const [selectedDateStr, setSelectedDateStr] = useState(getTodayDateStr);
  const [selectedLeague, setSelectedLeague] = useState('all');
  
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [selectedMatchDetails, setSelectedMatchDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [goalToast, setGoalToast] = useState(null);

  // تطبيق المظهر
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // جلب الدوريات المتاحة
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
        console.error(e);
      }
    };
    loadMatches();
  }, [selectedDateStr]);

  // الاشتراك في تحديثات المباريات المباشرة الحقيقية للـ "اليوم"
  useEffect(() => {
    const unsubscribe = subscribeToLiveMatches((updatedMatches) => {
      // نقوم بتحديث قائمة المباريات فقط في حال كان التاريخ المختار هو تاريخ اليوم
      const todayStr = getTodayDateStr();
      setSelectedDateStr(prevDate => {
        if (prevDate === todayStr) {
          setMatches(prevMatches => {
            // فحص الأهداف لإطلاق التنبيهات
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

  // جلب التفاصيل الإضافية عند اختيار مباراة
  const handleMatchClick = async (match) => {
    setSelectedMatch(match);
    setSelectedMatchDetails(null);
    setLoadingDetails(true);
    try {
      const details = await getMatchDetails(match.leagueId, match.id);
      setSelectedMatchDetails(details);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDetails(false);
    }
  };

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  return (
    <div className="app-container">
      {/* إشعار هدف مباشر حقيقي */}
      <AnimatePresence>
        {goalToast && (
          <motion.div
            className="glass-card"
            style={{
              position: 'fixed',
              top: 24,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 9999,
              padding: '16px 24px',
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.95), rgba(251, 191, 36, 0.95))',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              boxShadow: '0 10px 30px rgba(16, 185, 129, 0.4)',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              direction: 'rtl'
            }}
            initial={{ opacity: 0, y: -50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -50, x: '-50%' }}
          >
            <Bell size={24} className="animate-bounce" />
            <div>
              <h4 style={{ fontWeight: 800, fontSize: '1.05rem', marginBottom: 2 }}>جووووووول! هدف مباشر حقيقي</h4>
              <p style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                {goalToast.homeTeam} {goalToast.homeScore} - {goalToast.awayScore} {goalToast.awayTeam} (د {goalToast.minute}')
                <br />
                {goalToast.scorer}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        theme={theme}
        toggleTheme={toggleTheme}
        onOpenSettings={() => setShowSettings(true)}
      />

      <main className="main-content">
        {activeTab === 'live' && (
          <>
            <LiveMatches 
              matches={matches} 
              onMatchClick={handleMatchClick} 
            />
            
            <MatchSchedule
              matches={matches}
              selectedDateStr={selectedDateStr}
              setSelectedDateStr={setSelectedDateStr}
              selectedLeague={selectedLeague}
              setSelectedLeague={setSelectedLeague}
              leagues={leagues}
              onMatchClick={handleMatchClick}
            />
          </>
        )}

        {activeTab === 'matches' && (
          <MatchSchedule
            matches={matches}
            selectedDateStr={selectedDateStr}
            setSelectedDateStr={setSelectedDateStr}
            selectedLeague={selectedLeague}
            setSelectedLeague={setSelectedLeague}
            leagues={leagues}
            onMatchClick={handleMatchClick}
          />
        )}

        {activeTab === 'standings' && (
          <LeagueStandings onMatchClick={handleMatchClick} />
        )}

        {activeTab === 'news' && (
          <NewsSection />
        )}
      </main>

      <footer className="app-footer">
        <p>حقوق النشر © {new Date().getFullYear()} كورة سكور. جميع الحقوق محفوظة.</p>
        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>
          البيانات مستخرجة بالكامل من مصادر ESPN الحية وموجز DW الرياضي في الوقت الفعلي.
        </p>
      </footer>

      {/* النوافذ العائمة */}
      <AnimatePresence>
        {selectedMatch && (
          <MatchDetailModal
            match={selectedMatch}
            details={selectedMatchDetails}
            loading={loadingDetails}
            onClose={() => {
              setSelectedMatch(null);
              setSelectedMatchDetails(null);
            }}
          />
        )}

        {showSettings && (
          <ApiSettingsModal
            onClose={() => setShowSettings(false)}
            onSave={() => {}}
          />
        )}
      </AnimatePresence>

      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: 'var(--primary)', stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: 'var(--accent)', stopOpacity: 1 }} />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

export default App;
