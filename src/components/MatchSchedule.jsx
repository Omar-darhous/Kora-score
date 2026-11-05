import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar as CalendarIcon, Filter, ChevronLeft, ChevronRight, Clock, X } from 'lucide-react';
import Dropdown from './Dropdown';
import { EgyptianDisclaimer, EgyptianBadge, EGYPTIAN_BADGE_TEXT } from './EgyptianDisclaimer';

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
  const m = parseInt(dateStr.substring(4, 6), 10) - 1;
  const d = parseInt(dateStr.substring(6, 8), 10);
  
  const dateObj = new Date(y, m, d);
  const dayName = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'][dateObj.getDay()];
  const monthName = ARABIC_MONTHS[m];
  return `${dayName}، ${d} ${monthName} ${y}`;
};

const MatchSchedule = ({ 
  matches, 
  selectedDateStr, 
  setSelectedDateStr, 
  selectedLeague, 
  setSelectedLeague, 
  leagues, 
  onMatchClick 
}) => {
  const [showCalendar, setShowCalendar] = useState(false);
  const calendarRef = useRef(null);

  // حساب تواريخ سريعة: أمس، اليوم، غداً
  const todayStr = useMemo(() => formatDateToYYYYMMDD(new Date()), []);
  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return formatDateToYYYYMMDD(d);
  }, []);
  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return formatDateToYYYYMMDD(d);
  }, []);

  // استخراج تفاصيل التاريخ المختار لضبط وضع البداية للتقويم
  const selectedDateObj = useMemo(() => {
    if (!selectedDateStr) return new Date();
    const y = parseInt(selectedDateStr.substring(0, 4), 10);
    const m = parseInt(selectedDateStr.substring(4, 6), 10) - 1;
    const d = parseInt(selectedDateStr.substring(6, 8), 10);
    return new Date(y, m, d);
  }, [selectedDateStr]);

  const [viewYear, setViewYear] = useState(selectedDateObj.getFullYear());
  const [viewMonth, setViewMonth] = useState(selectedDateObj.getMonth());

  useEffect(() => {
    setViewYear(selectedDateObj.getFullYear());
    setViewMonth(selectedDateObj.getMonth());
  }, [selectedDateObj]);

  // إغلاق التقويم عند النقر في الخارج أو الضغط على زر الهروب (Escape)
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target)) {
        setShowCalendar(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setShowCalendar(false);
      }
    };

    if (showCalendar) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside, { passive: true });
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showCalendar]);

  // حساب الأيام لعرضها في شبكة التقويم للشهر المختار
  const calendarDays = useMemo(() => {
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay();

    const list = [];
    for (let i = 0; i < firstDayIndex; i++) {
      list.push({ type: 'empty', id: `empty-${i}` });
    }

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

  // تصفية المباريات حسب البطولة
  const filteredMatches = selectedLeague === 'all'
    ? matches
    : matches.filter(m => m.leagueId === selectedLeague);

  // تجميع المباريات حسب الدوري
  const groupedMatches = useMemo(() => {
    return filteredMatches.reduce((groups, match) => {
      const key = match.leagueName || 'أخرى';
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
  }, [filteredMatches]);

  const groupKeys = Object.keys(groupedMatches);

  return (
    <div className="schedule-container">
      {/* Controls Bar: Dates & League Filters */}
      <div className="schedule-controls">
        <div className="schedule-controls-top">
          <h2 className="section-title" style={{ margin: 0 }}>
            <CalendarIcon size={20} color="var(--primary)" />
            <span>جدول المباريات</span>
            <span className="section-badge-count">{filteredMatches.length}</span>
          </h2>

          {/* League Selector Dropdown */}
          <Dropdown
            options={[
              { value: 'all', label: 'كل البطولات' },
              ...leagues.map(l => ({ 
                value: l.id, 
                label: l.id === 'egypt.1' ? `${l.name} (${EGYPTIAN_BADGE_TEXT})` : l.name, 
                icon: l.logo 
              }))
            ]}
            value={selectedLeague}
            onChange={setSelectedLeague}
            icon={<Filter size={14} />}
            ariaLabel="تصفية حسب البطولة"
            className="league-filter-dropdown"
          />
        </div>

        {/* Date Filter Bar */}
        <div className="schedule-controls-dates">
          {/* Quick Date Pills */}
          <div className="date-quick-bar">
            <button
              type="button"
              className={`date-quick-btn ${selectedDateStr === yesterdayStr ? 'active' : ''}`}
              onClick={() => setSelectedDateStr(yesterdayStr)}
            >
              أمس
            </button>
            <button
              type="button"
              className={`date-quick-btn ${selectedDateStr === todayStr ? 'active' : ''}`}
              onClick={() => setSelectedDateStr(todayStr)}
            >
              اليوم
            </button>
            <button
              type="button"
              className={`date-quick-btn ${selectedDateStr === tomorrowStr ? 'active' : ''}`}
              onClick={() => setSelectedDateStr(tomorrowStr)}
            >
              غداً
            </button>
          </div>

          {/* Calendar Picker Popover */}
          <div className="calendar-wrapper" ref={calendarRef}>
            <button 
              type="button"
              className="calendar-toggle-btn" 
              onClick={() => setShowCalendar(!showCalendar)}
              aria-label="اختيار تاريخ مخصص"
            >
              <CalendarIcon size={14} color="var(--primary)" />
              <span>{formatDateToDisplay(selectedDateStr)}</span>
            </button>

            <AnimatePresence>
              {showCalendar && (
                <>
                  <div 
                    className="calendar-backdrop" 
                    onClick={() => setShowCalendar(false)} 
                    aria-hidden="true" 
                  />
                  <motion.div 
                    className="calendar-popover"
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                  >
                    <div className="calendar-popover-header">
                      <div className="calendar-header-nav">
                        <button 
                          type="button" 
                          className="calendar-nav-btn" 
                          onClick={handlePrevMonth} 
                          aria-label="الشهر السابق"
                          title="الشهر السابق"
                        >
                          <ChevronRight size={18} />
                        </button>
                        <span className="calendar-header-title">{ARABIC_MONTHS[viewMonth]} {viewYear}</span>
                        <button 
                          type="button" 
                          className="calendar-nav-btn" 
                          onClick={handleNextMonth} 
                          aria-label="الشهر التالي"
                          title="الشهر التالي"
                        >
                          <ChevronLeft size={18} />
                        </button>
                      </div>
                      <button 
                        type="button" 
                        className="calendar-close-btn" 
                        onClick={() => setShowCalendar(false)} 
                        aria-label="إغلاق التقويم"
                      >
                        <X size={16} />
                      </button>
                    </div>

                  <div className="calendar-grid-weekdays">
                    {ARABIC_DAYS.map(day => (
                      <span key={day}>{day}</span>
                    ))}
                  </div>

                  <div className="calendar-grid-days">
                    {calendarDays.map((cell) => {
                      if (cell.type === 'empty') {
                        return <div key={cell.id} className="calendar-day-cell empty" />;
                      }
                      return (
                        <div
                          key={cell.formatted}
                          className={`calendar-day-cell ${selectedDateStr === cell.formatted ? 'active' : ''} ${cell.isToday ? 'today' : ''}`}
                          onClick={() => handleSelectDay(cell.formatted)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleSelectDay(cell.formatted); }}
                        >
                          {cell.dayNum}
                        </div>
                      );
                    })}
                  </div>

                  <div className="calendar-popover-footer">
                    <button 
                      type="button" 
                      className="calendar-shortcut-btn" 
                      onClick={() => { setSelectedDateStr(todayStr); setShowCalendar(false); }}
                    >
                      العودة لتاريخ اليوم
                    </button>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>اضغط على أي يوم للتصفح</span>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Matches List */}
      <div className="matches-list">
        {selectedLeague === 'egypt.1' && <EgyptianDisclaimer />}
        {groupKeys.length === 0 ? (
          <div className="glass-card empty-state">
            <Clock size={36} className="empty-icon" />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800 }}>لا توجد مباريات لهذا اليوم</h3>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', maxWidth: 400 }}>
              لم يتم العثور على أي مباريات جارية أو مجدولة في هذا التاريخ بالتصفية المحددة. يمكنك اختيار تاريخ آخر عبر التقويم أعلاه.
            </p>
          </div>
        ) : (
          groupKeys.map((leagueName) => {
            const league = groupedMatches[leagueName];
            const isEgyptianGroup = league.items[0]?.leagueId === 'egypt.1';
            return (
              <div key={leagueName} className="league-group">
                {/* League Header */}
                <div className="league-group-header">
                  {league.logo && (
                    <img 
                      src={league.logo} 
                      alt={league.name} 
                      className="team-logo" 
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  )}
                  <span>{league.name}</span>
                  {isEgyptianGroup && <EgyptianBadge style={{ marginRight: 6 }} />}
                </div>
                
                {/* Notice for Egyptian League in multi-league list */}
                {isEgyptianGroup && selectedLeague !== 'egypt.1' && (
                  <EgyptianDisclaimer style={{ margin: '8px 0 12px' }} />
                )}

                {/* League Match Rows */}
                <div className="d-flex flex-column gap-1">
                  {league.items.map((match) => (
                    <motion.div
                      key={match.id}
                      className="match-row-card"
                      onClick={() => onMatchClick(match)}
                      whileHover={{ scale: 1.003 }}
                      transition={{ duration: 0.12 }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onMatchClick(match); }}
                      aria-label={`${match.homeTeam} ضد ${match.awayTeam}`}
                    >
                      {/* Home Team (Right in RTL) */}
                      <div className="match-team-home">
                        {match.homeLogo && (
                          <img 
                            src={match.homeLogo} 
                            alt={match.homeTeam} 
                            className="team-logo" 
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                        )}
                        <span className="team-name" title={match.homeTeam}>{match.homeTeam}</span>
                      </div>

                      {/* Center Score & Time */}
                      <div className="match-score-center">
                        <div className="score-display-pill">
                          {match.status === 'NS' ? (
                            <span className="match-time-text">{match.time}</span>
                          ) : (
                            <>
                              <span className="score-num">{match.homeScore}</span>
                              <span className="score-sep">-</span>
                              <span className="score-num">{match.awayScore}</span>
                            </>
                          )}
                        </div>
                        
                        {match.status === 'LIVE' && (
                          <span className="match-status-tag live">
                            <span className="live-dot" />
                            <span><bdi>{String(match.minute ?? '').replace(/['"’`]/g, '').trim()}</bdi> د</span>
                          </span>
                        )}
                        {match.status === 'FT' && (
                          <span className="match-status-tag ft">
                            انتهت
                          </span>
                        )}
                        {match.status === 'NS' && (
                          <span className="match-status-tag ns">
                            لم تبدأ
                          </span>
                        )}
                      </div>

                      {/* Away Team (Left in RTL) */}
                      <div className="match-team-away">
                        <span className="team-name" title={match.awayTeam}>{match.awayTeam}</span>
                        {match.awayLogo && (
                          <img 
                            src={match.awayLogo} 
                            alt={match.awayTeam} 
                            className="team-logo" 
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                        )}
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
