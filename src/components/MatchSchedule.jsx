import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Filter, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';

const ARABIC_DAYS = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
const ARABIC_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
];

// تنسيق التاريخ كـ YYYYMMDD
const formatDateToYYYYMMDD = (date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
};

// تنسيق التاريخ كـ DD/MM/YYYY للعرض في الزر
const formatDateToDisplay = (dateStr) => {
  if (!dateStr) return '';
  const y = dateStr.substring(0, 4);
  const m = parseInt(dateStr.substring(4, 6)) - 1;
  const d = parseInt(dateStr.substring(6, 8));
  
  const dateObj = new Date(y, m, d);
  const dayName = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'][dateObj.getDay()];
  const monthName = ARABIC_MONTHS[m];
  return `${dayName}، ${d} ${monthName} ${y}`;
};

const MatchSchedule = ({ matches, selectedDateStr, setSelectedDateStr, selectedLeague, setSelectedLeague, leagues, onMatchClick }) => {
  const [showCalendar, setShowCalendar] = useState(false);
  const calendarRef = useRef(null);

  // استخراج تفاصيل التاريخ المختار لضبط وضع البداية للتقويم
  const selectedDateObj = useMemo(() => {
    if (!selectedDateStr) return new Date();
    const y = parseInt(selectedDateStr.substring(0, 4));
    const m = parseInt(selectedDateStr.substring(4, 6)) - 1;
    const d = parseInt(selectedDateStr.substring(6, 8));
    return new Date(y, m, d);
  }, [selectedDateStr]);

  // حالة لتصفح الأشهر في التقويم
  const [viewYear, setViewYear] = useState(selectedDateObj.getFullYear());
  const [viewMonth, setViewMonth] = useState(selectedDateObj.getMonth());

  // مزامنة شهر التقويم مع التاريخ المختار عند تبديله من الخارج
  useEffect(() => {
    setViewYear(selectedDateObj.getFullYear());
    setViewMonth(selectedDateObj.getMonth());
  }, [selectedDateObj]);

  // إغلاق التقويم عند النقر في الخارج
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target)) {
        setShowCalendar(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // حساب الأيام لعرضها في شبكة التقويم (Grid) للشهر المختار
  const calendarDays = useMemo(() => {
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay(); // 0 = الأحد، إلخ.

    const list = [];
    
    // خلايا فارغة لضبط بداية أول يوم في الأسبوع
    for (let i = 0; i < firstDayIndex; i++) {
      list.push({ type: 'empty', id: `empty-${i}` });
    }

    // أيام الشهر
    const today = new Date();
    for (let day = 1; day <= daysInMonth; day++) {
      const dObj = new Date(viewYear, viewMonth, day);
      const formatted = formatDateToYYYYMMDD(dObj);
      const isTodayVal = dObj.getDate() === today.getDate() &&
        dObj.getMonth() === today.getMonth() &&
        dObj.getFullYear() === today.getFullYear();

      list.push({
        type: 'day',
        dayNum: day,
        formatted,
        isToday: isTodayVal,
        id: formatted
      });
    }

    return list;
  }, [viewYear, viewMonth]);

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(prev => prev - 1);
    } else {
      setViewMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(prev => prev + 1);
    } else {
      setViewMonth(prev => prev + 1);
    }
  };

  const handleSelectDay = (formatted) => {
    setSelectedDateStr(formatted);
    setShowCalendar(false);
  };

  const handleSelectToday = () => {
    const today = new Date();
    setSelectedDateStr(formatDateToYYYYMMDD(today));
    setShowCalendar(false);
  };

  // تصفية المباريات حسب الدوري المختار
  const filteredMatches = selectedLeague === 'all'
    ? matches
    : matches.filter(m => m.leagueId === selectedLeague);

  // تجميع المباريات حسب الدوري لعرضها بشكل منظم
  const groupedMatches = filteredMatches.reduce((groups, match) => {
    const key = match.leagueName;
    if (!groups[key]) {
      groups[key] = {
        name: match.leagueName,
        logo: match.leagueLogo,
        items: []
      };
    }
    groups[key].items.push(match);
    return groups;
  }, {});

  const groupKeys = Object.keys(groupedMatches);

  return (
    <div className="schedule-container">
      <div className="schedule-filters" style={{ flexWrap: 'wrap', gap: 16 }}>
        <h2 className="section-title" style={{ marginBottom: 0 }}>
          <Calendar size={22} color="var(--primary)" />
          جدول المباريات اليومية
        </h2>

        <div className="d-flex align-center gap-2 flex-wrap" style={{ direction: 'rtl' }}>
          {/* محدد التاريخ الذكي (Calendar Popover) */}
          <div className="calendar-wrapper" ref={calendarRef}>
            <button 
              className="calendar-toggle-btn" 
              onClick={() => setShowCalendar(!showCalendar)}
            >
              <Calendar size={16} color="var(--primary)" />
              <span>{formatDateToDisplay(selectedDateStr)}</span>
            </button>

            <AnimatePresence>
              {showCalendar && (
                <motion.div 
                  className="calendar-popover"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.15 }}
                >
                  {/* رأس التقويم */}
                  <div className="calendar-popover-header">
                    <button type="button" className="calendar-nav-btn" onClick={handleNextMonth}>
                      <ChevronRight size={18} />
                    </button>
                    <span>
                      {ARABIC_MONTHS[viewMonth]} {viewYear}
                    </span>
                    <button type="button" className="calendar-nav-btn" onClick={handlePrevMonth}>
                      <ChevronLeft size={18} />
                    </button>
                  </div>

                  {/* أيام الأسبوع */}
                  <div className="calendar-grid-weekdays">
                    {ARABIC_DAYS.map(day => (
                      <span key={day}>{day}</span>
                    ))}
                  </div>

                  {/* شبكة الأيام */}
                  <div className="calendar-grid-days">
                    {calendarDays.map((cell) => {
                      if (cell.type === 'empty') {
                        return <div key={cell.id} className="calendar-day-cell empty"></div>;
                      }

                      return (
                        <div
                          key={cell.formatted}
                          className={`calendar-day-cell ${selectedDateStr === cell.formatted ? 'active' : ''} ${cell.isToday ? 'today' : ''}`}
                          onClick={() => handleSelectDay(cell.formatted)}
                        >
                          {cell.dayNum}
                        </div>
                      );
                    })}
                  </div>

                  {/* تذييل التقويم */}
                  <div className="calendar-popover-footer">
                    <button 
                      type="button" 
                      className="calendar-shortcut-btn" 
                      onClick={handleSelectToday}
                    >
                      العودة لليوم الحالي
                    </button>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>اختر أي تاريخ للتصفح</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* فلتر الدوري */}
          <div className="d-flex align-center gap-1">
            <Filter size={16} className="text-secondary" />
            <select
              className="league-filter"
              value={selectedLeague}
              onChange={(e) => setSelectedLeague(e.target.value)}
            >
              <option value="all">كل البطولات</option>
              {leagues.map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="matches-list">
        {groupKeys.length === 0 ? (
          <div className="glass-card empty-state">
            <p>لا توجد مباريات جارية أو مجدولة لهذا اليوم بالتصفية المحددة.</p>
          </div>
        ) : (
          groupKeys.map((leagueName) => {
            const league = groupedMatches[leagueName];
            return (
              <div key={leagueName} className="league-group">
                <div className="league-group-header">
                  <img 
                    src={league.logo} 
                    alt={league.name} 
                    className="team-logo" 
                    style={{ width: 22, height: 22 }} 
                    onError={(e) => e.target.style.display = 'none'}
                  />
                  <span>{league.name}</span>
                </div>
                
                <div className="d-flex flex-column gap-1" style={{ marginTop: 8 }}>
                  {league.items.map((match) => (
                    <motion.div
                      key={match.id}
                      className="glass-card match-row-card"
                      onClick={() => onMatchClick(match)}
                      whileHover={{ scale: 1.005, backgroundColor: 'rgba(255, 255, 255, 0.03)' }}
                      transition={{ duration: 0.1 }}
                      layoutId={`match-row-${match.id}`}
                    >
                      {/* الفريق صاحب الأرض */}
                      <div className="match-team-left">
                        <span className="team-name">{match.homeTeam}</span>
                        {match.homeLogo && (
                          <img 
                            src={match.homeLogo} 
                            alt={match.homeTeam} 
                            className="team-logo" 
                            onError={(e) => e.target.style.display = 'none'}
                          />
                        )}
                      </div>

                      {/* النتيجة والتوقيت */}
                      <div className="match-score-center">
                        {match.roundName && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 800, marginBottom: 2 }}>
                            {match.roundName}
                          </span>
                        )}
                        <div className="score-display">
                          {match.status === 'NS' ? (
                            <span className="match-schedule-time">{match.time}</span>
                          ) : (
                            <>
                              <span className="score-val">{match.homeScore}</span>
                              <span className="score-divider">-</span>
                              <span className="score-val">{match.awayScore}</span>
                            </>
                          )}
                        </div>
                        
                        {match.status === 'LIVE' && (
                          <span className="match-row-status live">
                            د {match.minute}'
                          </span>
                        )}
                        {match.status === 'FT' && (
                          <span className="match-row-status" style={{ color: 'var(--text-muted)' }}>
                            انتهت
                          </span>
                        )}
                        {match.status === 'NS' && (
                          <span className="match-row-status" style={{ color: 'var(--primary)' }}>
                            لم تبدأ
                          </span>
                        )}
                      </div>

                      {/* الفريق الضيف */}
                      <div className="match-team-right">
                        {match.awayLogo && (
                          <img 
                            src={match.awayLogo} 
                            alt={match.awayTeam} 
                            className="team-logo" 
                            onError={(e) => e.target.style.display = 'none'}
                          />
                        )}
                        <span className="team-name">{match.awayTeam}</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default MatchSchedule;
