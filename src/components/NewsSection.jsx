import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Newspaper, Clock, X, ExternalLink, RefreshCw } from 'lucide-react';
import { getNews } from '../services/footballService';

const NewsSection = () => {
  const [news, setNews] = useState([]);
  const [activeArticle, setActiveArticle] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNews = async () => {
      setLoading(true);
      try {
        const data = await getNews();
        setNews(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchNews();
  }, []);

  return (
    <div className="news-container">
      <h2 className="section-title">
        <Newspaper size={22} color="var(--primary)" />
        أحدث الأخبار الرياضية المباشرة
      </h2>

      {loading ? (
        <div className="empty-state" style={{ padding: '60px 0' }}>
          <RefreshCw className="empty-icon animate-spin" size={32} style={{ animation: 'spin 1.5s linear infinite' }} />
          <p>جاري سحب شريط الأخبار الرياضية الحية...</p>
        </div>
      ) : news.length === 0 ? (
        <div className="glass-card empty-state">
          <p>لم نتمكن من جلب الأخبار حالياً. يرجى التحقق من اتصالك بالإنترنت.</p>
        </div>
      ) : (
        <div className="news-grid">
          {news.map((item) => (
            <motion.div
              key={item.id}
              className="glass-card news-card"
              onClick={() => setActiveArticle(item)}
              whileHover={{ y: -6 }}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <div className="news-img-container">
                <img src={item.img} alt={item.title} className="news-img" />
                <span className="news-tag">{item.tag}</span>
              </div>
              
              <div className="news-info">
                <div className="news-meta">
                  <span className="d-flex align-center gap-1">
                    <Clock size={12} />
                    {item.date}
                  </span>
                  <span>•</span>
                  <span>{item.readTime}</span>
                </div>
                
                <h3 className="news-title">{item.title}</h3>
                <p className="news-desc">{item.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* نافذة عرض المقال الكامل */}
      <AnimatePresence>
        {activeArticle && (
          <div className="modal-overlay" onClick={() => setActiveArticle(null)}>
            <motion.div
              className="modal-content"
              style={{ maxWidth: 700 }}
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.9, y: 50 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 50 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            >
              <div className="modal-header">
                <span className="modal-title d-flex align-center gap-1">
                  <Newspaper size={18} />
                  أخبار الرياضة المباشرة
                </span>
                <button className="close-modal-btn" onClick={() => setActiveArticle(null)}>
                  <X size={24} />
                </button>
              </div>

              <div className="modal-body" style={{ padding: 0 }}>
                <div style={{ width: '100%', height: 300, position: 'relative' }}>
                  <img src={activeArticle.img} alt={activeArticle.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <span className="news-tag" style={{ bottom: 16, right: 16, top: 'auto', left: 'auto' }}>
                    {activeArticle.tag}
                  </span>
                </div>
                
                <div style={{ padding: '24px' }}>
                  <div className="news-meta" style={{ marginBottom: 12 }}>
                    <span className="d-flex align-center gap-1">
                      <Clock size={12} />
                      {activeArticle.date}
                    </span>
                    <span>•</span>
                    <span>{activeArticle.readTime}</span>
                  </div>
                  
                  <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 16, lineHeight: 1.4 }}>
                    {activeArticle.title}
                  </h2>
                  
                  <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', lineHeight: 1.8, whiteSpace: 'pre-line', marginBottom: 24 }}>
                    {activeArticle.body}
                  </p>

                  {activeArticle.link && (
                    <a
                      href={activeArticle.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="submit-btn d-flex align-center justify-center gap-1"
                      style={{ textDecoration: 'none', textAlign: 'center' }}
                    >
                      <ExternalLink size={16} />
                      قراءة الخبر الكامل من المصدر الأصلي (DW)
                    </a>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NewsSection;
