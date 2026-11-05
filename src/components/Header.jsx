import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { Sun, Moon, Settings, Trophy, Calendar, Radio, Newspaper, Search } from 'lucide-react';

const Header = ({ theme, toggleTheme, onOpenSettings, onOpenSearch }) => {
  const menuItems = [
    { id: 'live', path: '/', label: 'المباشر واليوم', icon: Radio, end: true },
    { id: 'matches', path: '/matches', label: 'المباريات', icon: Calendar },
    { id: 'standings', path: '/standings', label: 'الترتيب', icon: Trophy },
    { id: 'news', path: '/news', label: 'الأخبار', icon: Newspaper },
  ];

  return (
    <>
      {/* Top Main Navigation Bar */}
      <header className="nav-bar">
        {/* Brand Section */}
        <Link
          to="/"
          className="logo-section"
          aria-label="الرئيسية - كورة سكور"
        >
          <div className="brand-badge">
            <Trophy size={20} strokeWidth={2.5} />
          </div>
          <div className="brand-text">
            <span className="brand-title">كورة سكور</span>
            <span className="brand-subtitle">Kora Score</span>
          </div>
        </Link>

        {/* Search Entry Point */}
        <div
          className="header-search-bar"
          title="البحث السريع (Ctrl+K)"
          tabIndex={0}
          role="button"
          onClick={onOpenSearch}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onOpenSearch?.();
            }
          }}
          aria-label="فتح نافذة البحث السريع"
        >
          <Search size={16} />
          <span className="search-placeholder">ابحث عن فريق، بطولة، أو مباراة...</span>
          <span className="search-shortcut">Ctrl+K</span>
        </div>

        {/* Desktop Navigation Links */}
        <ul className="nav-menu">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.id}>
                <NavLink
                  to={item.path}
                  end={item.end}
                  className={({ isActive }) => `nav-link-btn ${isActive ? 'active' : ''}`}
                >
                  {({ isActive }) => (
                    <>
                      <Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
                      <span>{item.label}</span>
                    </>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>

        {/* Action Controls */}
        <div className="header-actions">
          {/* زر البحث للشاشات الصغيرة */}
          <button
            type="button"
            className="action-btn mobile-search-btn"
            onClick={onOpenSearch}
            title="البحث السريع"
            aria-label="البحث السريع"
          >
            <Search size={18} />
          </button>

          <button
            type="button"
            className="action-btn"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'التحويل للوضع المضيء' : 'التحويل للوضع الداكن'}
            aria-label="تبديل المظهر"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <button
            type="button"
            className="action-btn"
            onClick={onOpenSettings}
            title="إعدادات الـ API والمصادر"
            aria-label="الإعدادات"
          >
            <Settings size={18} />
          </button>
        </div>
      </header>

      {/* Mobile Bottom Dock Navigation */}
      <nav className="mobile-bottom-nav" aria-label="شريط التنقل السفلي">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.id}
              to={item.path}
              end={item.end}
              className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
            >
              {({ isActive }) => (
                <>
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>
    </>
  );
};

export default Header;
