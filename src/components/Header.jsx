import React from 'react';
import { Sun, Moon, Settings, Trophy, Calendar, Radio, Newspaper } from 'lucide-react';

const Header = ({ activeTab, setActiveTab, theme, toggleTheme, onOpenSettings }) => {
  const menuItems = [
    { id: 'live', label: 'المباشر واليوم', icon: Radio },
    { id: 'matches', label: 'المباريات', icon: Calendar },
    { id: 'standings', label: 'الترتيب', icon: Trophy },
    { id: 'news', label: 'الأخبار', icon: Newspaper },
  ];

  return (
    <>
      {/* Top Desktop Navigation */}
      <header className="nav-bar">
        <a href="#" className="logo-section" onClick={() => setActiveTab('live')}>
          <Trophy size={28} className="empty-icon" style={{ opacity: 1, stroke: 'url(#grad1)', color: 'var(--accent)' }} />
          <span>كورة سكور | KoraScore</span>
        </a>

        <ul className="nav-menu">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.id}>
                <a
                  className={`nav-item nav-link ${activeTab === item.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(item.id)}
                >
                  <span className="d-flex align-center gap-1">
                    <Icon size={18} />
                    {item.label}
                  </span>
                </a>
              </li>
            );
          })}
        </ul>

        <div className="header-actions">
          <button 
            className="action-btn" 
            onClick={toggleTheme} 
            title={theme === 'dark' ? 'الوضع المضيء' : 'الوضع الداكن'}
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          
          <button 
            className="action-btn" 
            onClick={onOpenSettings} 
            title="إعدادات الـ API"
          >
            <Settings size={20} />
          </button>
        </div>
      </header>

      {/* Bottom Mobile Navigation */}
      <nav className="mobile-bottom-nav">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={`bottom-nav-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              <Icon size={22} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
};

export default Header;
