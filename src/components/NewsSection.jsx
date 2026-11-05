import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Newspaper, Clock, X, ExternalLink, Globe } from 'lucide-react';
import { getNews } from '../services/footballService';
import { NewsCardSkeleton } from './Skeleton';

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
        console.error('Failed to load news:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchNews();
  }, []);

  return (
    <div className="news-container">
      <div className="d-flex align-center justify-between">
        <h2 className="section-title">
          <Newspaper size={20} color="var(--primary)" />
          <span>أحدث الأخبار والتقارير الرياضية</span>
          {news.length > 0 && <span className="section-badge-count">{news.length}</span>}
        </h2>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }} className="d-flex align-center gap-1">
          <Globe size={13} />
          <span>تغطية حية من الملاعب</span>
        </span>
      </div>

      {loading ? (
        <div className="news-grid">
          {[...Array(6)].map((_, i) => (
            <NewsCardSkeleton key={i} />
          ))}
        </div>
      ) : news.length === 0 ? (
        <div className="glass-card empty-state">
          <Newspaper size={36} className="empty-icon" />
          <h3 style={{ fontSize: '1.05rem', fontWeight: 800 }}>لم نتمكن من جلب الأخبار الرياضية حالياً</h3>
          <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
            يرجى التحقق من اتصالك بالإنترنت أو إعادة المحاولة لاحقاً.
          </p>
        </div>
      ) : (
        <div className="news-grid">
          {news.map((item) => (
            <motion.article
              key={item.id}
              className="news-card"
              onClick={() => setActiveArticle(item)}
              whileHover={{ y: -4 }}
              transition={{ duration: 0.18 }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveArticle(item); }}
              aria-label={item.title}
            >
              <div className="news-img-container">
                <img 
                  src={item.img} 
                  alt={item.title} 
                  className="news-img" 
                  loading="lazy"
                  onError={(e) => {
                    e.target.src = 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&q=80&w=600';
                  }}
                />
                <span className="news-tag">{item.tag}</span>
              </div>
              
              <div className="news-info">
                <div className="news-meta">
                  <span className="d-flex align-center gap-1">
                    <Clock size={12} />
                    <span>{item.date}</span>
                  </span>
                  <span>•</span>
                  <span>{item.readTime}</span>
                </div>
                
                <h3 className="news-title">{item.title}</h3>
                <p className="news-desc">{item.desc}</p>
              </div>
            </motion.article>
          ))}
        </div>
      )}

      {/* Modal: Full Article Reading Experience */}
      <AnimatePresence>
        {activeArticle && (
          <div 
            className="modal-overlay" 
            onClick={() => setActiveArticle(null)}
            role="dialog"
            aria-modal="true"
            aria-label={activeArticle.title}
          >
            <motion.div
              className="modal-content"
              style={{ maxWidth: 680 }}
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.94, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 30 }}
              transition={{ type: 'spring', damping: 25, stiffness: 260 }}
            >
              <div className="modal-header">
                <span className="modal-title d-flex align-center gap-1">
                  <Newspaper size={18} color="var(--primary)" />
                  <span>تفاصيل الخبر الرياضي</span>
                </span>
                <button 
                  type="button"
                  className="close-modal-btn" 
                  onClick={() => setActiveArticle(null)}
                  aria-label="إغلاق"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="modal-body" style={{ padding: 0 }}>
                <div style={{ width: '100%', height: 260, position: 'relative', overflow: 'hidden' }}>
                  <img 
                    src={activeArticle.img} 
                    alt={activeArticle.title} 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                  />
                  <span className="news-tag" style={{ bottom: 14, right: 14, top: 'auto', left: 'auto' }}>
                    {activeArticle.tag}
                  </span>
                </div>
                
                <div style={{ padding: '22px' }}>
                  <div className="news-meta" style={{ marginBottom: 12 }}>
                    <span className="d-flex align-center gap-1">
                      <Clock size={13} />
                      <span>{activeArticle.date}</span>
                    </span>
                    <span>•</span>
                    <span>{activeArticle.readTime}</span>
                  </div>
                  
                  <h2 style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--text-primary)', marginBottom: 14, lineHeight: 1.45 }}>
                    {activeArticle.title}
                  </h2>
                  
                  <p style={{ fontSize: '0.98rem', color: 'var(--text-secondary)', lineHeight: 1.85, whiteSpace: 'pre-line', marginBottom: 22 }}>
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
                      <span>قراءة التقرير من المصدر الرسمي (DW)</span>
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
