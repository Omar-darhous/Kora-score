import NewsImage from './NewsImage';
import RequestState from './RequestState';
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Newspaper, Clock, X, ExternalLink, Globe } from 'lucide-react';
import { getNews, enrichNewsImages } from '../services/footballService';
import {
  createNewsRefreshController,
  getArticleSourceName,
  getExternalArticleLabel
} from '../services/newsService';
import { NewsCardSkeleton } from './Skeleton';

const NewsSection = () => {
  const [viewState, setViewState] = useState({
    news: [],
    activeArticle: null,
    loading: true,
    error: null
  });
  const [retryCount, setRetryCount] = useState(0);
  const controllerRef = useRef(null);

  useEffect(() => {
    const controller = createNewsRefreshController({
      fetchNews: getNews,
      enrichImages: enrichNewsImages,
      onStateChange: (nextState) => setViewState(nextState)
    });
    controllerRef.current = controller;
    controller.start({ forceRefresh: retryCount > 0 });

    return () => {
      controller.dispose();
      if (controllerRef.current === controller) {
        controllerRef.current = null;
      }
    };
  }, [retryCount]);

  const { news, activeArticle, loading, error } = viewState;
  const setActiveArticle = (article) => {
    controllerRef.current?.setActiveArticle(article);
  };

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
        <div className="news-grid" role="status" aria-label="جارٍ تحميل الأخبار" aria-busy="true">
          {[...Array(6)].map((_, i) => (
            <NewsCardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <RequestState message={error} onRetry={() => setRetryCount(value => value + 1)} />
      ) : news.length === 0 ? (
        <div className="glass-card empty-state">
          <Newspaper size={36} className="empty-icon" />
          <h3 style={{ fontSize: '1.05rem', fontWeight: 800 }}>لا توجد أخبار متاحة حالياً</h3>
          <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
            لم ينشر المصدر أخباراً لعرضها. يمكنك العودة لاحقاً.
          </p>
        </div>
      ) : (
        <div className="news-grid">
          {news.map((item) => {
            const sourceName = getArticleSourceName(item);
            return (
              <motion.article
                key={item.id}
                className="news-card"
                onClick={() => setActiveArticle(item)}
                whileHover={{ y: -4 }}
                transition={{ duration: 0.18 }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setActiveArticle(item);
                  }
                }}
                aria-label={sourceName ? `${item.title} — ${sourceName}` : item.title}
              >
                <div className="news-img-container">
                  <NewsImage src={item.img} alt={item.title} className="news-img" loading="lazy" />
                  <span className="news-tag">{item.tag}</span>
                </div>

                <div className="news-info">
                  <div className="news-meta">
                    {sourceName && <span className="news-source-badge">{sourceName}</span>}
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
            );
          })}
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
                  <NewsImage src={activeArticle.img} alt={activeArticle.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <span className="news-tag" style={{ bottom: 14, right: 14, top: 'auto', left: 'auto' }}>
                    {activeArticle.tag}
                  </span>
                </div>

                <div style={{ padding: '22px' }}>
                  <div className="news-meta" style={{ marginBottom: 12 }}>
                    {getArticleSourceName(activeArticle) && (
                      <span className="news-source-badge">{getArticleSourceName(activeArticle)}</span>
                    )}
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
                      <span>{getExternalArticleLabel(activeArticle)}</span>
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
