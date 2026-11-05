import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Search,
  X,
  Trophy,
  Shield,
  Calendar,
  Clock,
  CornerDownLeft
} from 'lucide-react';
import { searchAll, getQuickSuggestions } from '../services/searchService';
import { EgyptianBadge } from './EgyptianDisclaimer';

const SearchModal = ({ isOpen, onClose, matches = [], leagues = [], onMatchClick }) => {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  // التركيز التلقائي على حقل الإدخال عند فتح النافذة
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(0);
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // إغلاق النافذة بزر Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // منع التمرير في الصفحة الخلفية أثناء فتح النافذة
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // تنفيذ البحث
  const searchResults = useMemo(() => {
    return searchAll({ query, matches, leagues });
  }, [query, matches, leagues]);

  const quickSuggestions = useMemo(() => {
    return getQuickSuggestions();
  }, []);

  const hasQuery = query.trim().length > 0;
  const hasResults =
    searchResults.leagues.length > 0 ||
    searchResults.teams.length > 0 ||
    searchResults.matches.length > 0;

  // تحويل النتائج لمصفوفة مسطحة للتنقل بالأسهم
  const flatResults = useMemo(() => {
    if (!hasQuery) return [];
    const list = [];
    searchResults.leagues.forEach((league) => {
      list.push({ type: 'league', data: league });
    });
    searchResults.teams.forEach((team) => {
      list.push({ type: 'team', data: team });
    });
    searchResults.matches.forEach((match) => {
      list.push({ type: 'match', data: match });
    });
    return list;
  }, [hasQuery, searchResults]);

  // إعادة تعيين المؤشر النشط عند تغيير نتائج البحث
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // التنقل واختيار النتيجة
  const handleSelectResult = useCallback((item) => {
    if (!item) return;

    if (item.type === 'league') {
      navigate(`/league/${item.data.id}`);
      onClose();
    } else if (item.type === 'team') {
      const q = item.data.leagueId ? `?league=${item.data.leagueId}` : '';
      navigate(`/team/${item.data.id}${q}`);
      onClose();
    } else if (item.type === 'match') {
      if (onMatchClick) {
        onMatchClick(item.data);
      } else {
        navigate(`/match/${item.data.leagueId}/${item.data.id}`);
      }
      onClose();
    }
  }, [navigate, onClose, onMatchClick]);

  // معالجة مفاتيح الأسهم و Enter
  const handleKeyDown = (e) => {
    if (!hasQuery || flatResults.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % flatResults.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 + flatResults.length) % flatResults.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (flatResults[activeIndex]) {
        handleSelectResult(flatResults[activeIndex]);
      }
    }
  };

  // تمرير العنصر النشط إلى مجال الرؤية
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.querySelector('.search-result-item.active');
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [activeIndex]);

  if (!isOpen) return null;

  let runningIndex = 0;

  return (
    <div
      className="search-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="نافذة البحث السريع"
    >
      <motion.div
        className="search-modal-card"
        initial={{ opacity: 0, scale: 0.96, y: -20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: -20 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
      >
        {/* شريط الإدخال الرئيسي */}
        <div className="search-input-wrapper">
          <Search size={20} className="search-input-icon" />
          <input
            ref={inputRef}
            type="text"
            className="search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="ابحث عن بطولة، نادٍ، أو مباراة (مثال: ريال مدريد، الدوري الإنجليزي)..."
            dir="rtl"
            autoComplete="off"
            spellCheck="false"
          />
          {query && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              title="مسح نص البحث"
              aria-label="مسح نص البحث"
            >
              <X size={16} />
            </button>
          )}
          <button
            type="button"
            className="search-close-btn"
            onClick={onClose}
            title="إغلاق (Esc)"
            aria-label="إغلاق نافذة البحث"
          >
            <span className="search-esc-key">Esc</span>
          </button>
        </div>

        {/* جسم النتائج أو الاقتراحات */}
        <div className="search-modal-body" ref={listRef}>
          {!hasQuery ? (
            /* الحالة الأولية قبل الكتابة: اقتراحات سريعة */
            <div className="search-suggestions-container">
              {/* البطولات الشائعة */}
              <div className="search-section">
                <div className="search-section-header">
                  <Trophy size={14} color="var(--primary)" />
                  <span>البطولات الأكثر متابعة</span>
                </div>
                <div className="search-quick-grid">
                  {quickSuggestions.popularLeagues.map((league) => (
                    <button
                      key={league.id}
                      type="button"
                      className="search-quick-card"
                      onClick={() => {
                        navigate(`/league/${league.id}`);
                        onClose();
                      }}
                    >
                      {league.logo && (
                        <img
                          src={league.logo}
                          alt={league.name}
                          className="search-quick-logo"
                          onError={(e) => (e.target.style.display = 'none')}
                        />
                      )}
                      <span className="search-quick-name">{league.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* الأندية الشائعة */}
              <div className="search-section">
                <div className="search-section-header">
                  <Shield size={14} color="var(--accent)" />
                  <span>أندية شائعة</span>
                </div>
                <div className="search-quick-grid">
                  {quickSuggestions.popularTeams.map((team) => (
                    <button
                      key={team.id}
                      type="button"
                      className="search-quick-card"
                      onClick={() => {
                        navigate(`/team/${team.id}`);
                        onClose();
                      }}
                    >
                      {team.logo ? (
                        <img
                          src={team.logo}
                          alt={team.name}
                          className="search-quick-logo"
                          onError={(e) => (e.target.style.display = 'none')}
                        />
                      ) : (
                        <div className="search-quick-placeholder">
                          {team.name.charAt(0)}
                        </div>
                      )}
                      <div className="d-flex align-center gap-1 flex-wrap">
                        <span className="search-quick-name">{team.name}</span>
                        {team.isMock && <EgyptianBadge style={{ fontSize: '0.65rem' }} />}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : !hasResults ? (
            /* حالة عدم وجود نتائج */
            <div className="search-empty-state">
              <Search size={36} className="search-empty-icon" />
              <h4>لم نتمكن من العثور على أي نتائج</h4>
              <p>
                لا توجد بطولات أو أندية أو مباريات تطابق <strong>"{query}"</strong>. تأكد من صحة كتابة الاسم أو جرب البحث باسم النادي باللغة الإنجليزية.
              </p>
            </div>
          ) : (
            /* قائمة النتائج المصنفة */
            <div className="search-results-list">
              {/* قسم 1: البطولات */}
              {searchResults.leagues.length > 0 && (
                <div className="search-group">
                  <div className="search-group-header">
                    <Trophy size={14} color="var(--primary)" />
                    <span>البطولات والدوريات ({searchResults.leagues.length})</span>
                  </div>
                  <div className="search-group-items">
                    {searchResults.leagues.map((league) => {
                      const itemIndex = runningIndex++;
                      const isHighlighted = itemIndex === activeIndex;
                      return (
                        <div
                          key={`league-${league.id}`}
                          className={`search-result-item ${isHighlighted ? 'active' : ''}`}
                          onClick={() => handleSelectResult({ type: 'league', data: league })}
                          role="option"
                          aria-selected={isHighlighted}
                        >
                          <div className="search-item-icon-box">
                            {league.logo ? (
                              <img
                                src={league.logo}
                                alt={league.name}
                                className="search-item-logo"
                                onError={(e) => (e.target.style.display = 'none')}
                              />
                            ) : (
                              <Trophy size={18} color="var(--primary)" />
                            )}
                          </div>
                          <div className="search-item-info">
                            <div className="d-flex align-center gap-1 flex-wrap">
                              <span className="search-item-title">{league.name}</span>
                              {league.isMock && <EgyptianBadge />}
                            </div>
                            <span className="search-item-subtitle">
                              {league.country} {league.isMock && '• بيانات تجريبية غير متصلة بالبث المباشر'}
                            </span>
                          </div>
                          <div className="search-item-action">
                            <span className="search-item-tag">بطولة</span>
                            <CornerDownLeft size={14} className="search-enter-icon" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* قسم 2: الأندية والفرق */}
              {searchResults.teams.length > 0 && (
                <div className="search-group">
                  <div className="search-group-header">
                    <Shield size={14} color="var(--accent)" />
                    <span>الأندية والفرق ({searchResults.teams.length})</span>
                  </div>
                  <div className="search-group-items">
                    {searchResults.teams.map((team) => {
                      const itemIndex = runningIndex++;
                      const isHighlighted = itemIndex === activeIndex;
                      return (
                        <div
                          key={`team-${team.id}`}
                          className={`search-result-item ${isHighlighted ? 'active' : ''}`}
                          onClick={() => handleSelectResult({ type: 'team', data: team })}
                          role="option"
                          aria-selected={isHighlighted}
                        >
                          <div className="search-item-icon-box">
                            {team.logo ? (
                              <img
                                src={team.logo}
                                alt={team.arabicName || team.name}
                                className="search-item-logo"
                                onError={(e) => (e.target.style.display = 'none')}
                              />
                            ) : (
                              <div className="search-item-placeholder">
                                {(team.arabicName || team.name).charAt(0)}
                              </div>
                            )}
                          </div>
                          <div className="search-item-info">
                            <div className="d-flex align-center gap-1 flex-wrap">
                              <span className="search-item-title">
                                {team.arabicName || team.name}
                              </span>
                              {team.isMock && <EgyptianBadge />}
                            </div>
                            <span className="search-item-subtitle">
                              {team.leagueName || 'نادي كروي'}
                              {team.name && team.name !== team.arabicName && ` • ${team.name}`}
                              {team.isMock && ' (بيانات تجريبية)'}
                            </span>
                          </div>
                          <div className="search-item-action">
                            <span className="search-item-tag">فريق</span>
                            <CornerDownLeft size={14} className="search-enter-icon" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* قسم 3: المباريات المتاحة حالياً */}
              {searchResults.matches.length > 0 && (
                <div className="search-group">
                  <div className="search-group-header">
                    <Calendar size={14} color="var(--primary)" />
                    <span>مباريات اليوم المتاحة ({searchResults.matches.length})</span>
                  </div>
                  <div className="search-group-items">
                    {searchResults.matches.map((match) => {
                      const itemIndex = runningIndex++;
                      const isHighlighted = itemIndex === activeIndex;
                      return (
                        <div
                          key={`match-${match.id}`}
                          className={`search-result-item ${isHighlighted ? 'active' : ''}`}
                          onClick={() => handleSelectResult({ type: 'match', data: match })}
                          role="option"
                          aria-selected={isHighlighted}
                        >
                          <div className="search-item-icon-box">
                            <Clock size={16} color="var(--text-muted)" />
                          </div>
                          <div className="search-item-info">
                            <div className="d-flex align-center gap-1 flex-wrap">
                              <span className="search-item-title">
                                {match.homeTeam} ضد {match.awayTeam}
                              </span>
                              {match.isMock && <EgyptianBadge />}
                            </div>
                            <span className="search-item-subtitle">
                              {match.leagueName} • {match.status === 'LIVE' ? `مباشر (${match.minute} د)` : match.status === 'FT' ? `انتهت (${match.homeScore} - ${match.awayScore})` : match.time}
                            </span>
                          </div>
                          <div className="search-item-action">
                            <span className="search-item-tag">مباراة</span>
                            <CornerDownLeft size={14} className="search-enter-icon" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* شريط الإرشادات السفلي */}
        <div className="search-modal-footer">
          <div className="search-hints">
            <span className="search-hint-pill">
              <kbd>↑</kbd> <kbd>↓</kbd> للتنقل
            </span>
            <span className="search-hint-pill">
              <kbd>Enter</kbd> للاختيار
            </span>
            <span className="search-hint-pill">
              <kbd>Esc</kbd> للإغلاق
            </span>
          </div>
          <span className="search-footer-note">
            كورة سكور • بحث شامل وفوري
          </span>
        </div>
      </motion.div>
    </div>
  );
};

export default SearchModal;
