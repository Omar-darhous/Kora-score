import React, { Component, Suspense } from 'react';
import RequestState from './RequestState';

class PageErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error) { console.error('Page failed to load:', error); }
  render() {
    if (this.state.failed) return <div className="glass-card empty-state" role="alert">
      <h2>تعذر فتح الصفحة</h2>
      <p>تحقق من اتصالك ثم أعد تحميل الصفحة للمحاولة مرة أخرى.</p>
      <button type="button" className="tab-btn active" onClick={() => window.location.reload()}>إعادة تحميل الصفحة</button>
      <a href="/" className="tab-btn">العودة للرئيسية</a>
    </div>;
    return this.props.children;
  }
}

export default function PageBoundary({ children, onClose }) {
  return <PageErrorBoundary>
    <Suspense fallback={onClose ? <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="تحميل تفاصيل المباراة"><div className="modal-content" style={{ padding: 24 }}><button type="button" className="tab-btn" onClick={onClose} autoFocus>إغلاق</button><RequestState loading /></div></div> : <RequestState loading />}>
      {children}
    </Suspense>
  </PageErrorBoundary>;
}
