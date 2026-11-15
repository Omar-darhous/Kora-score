import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { MatchRowSkeleton } from './Skeleton';

export default function RequestState({ loading = false, message, onRetry }) {
  if (loading) return (
    <div role="status" aria-live="polite" aria-busy="true" className="request-loading">
      <p>جارٍ تحميل البيانات…</p>
      <div aria-hidden="true">{Array.from({ length: 3 }, (_, i) => <MatchRowSkeleton key={i} />)}</div>
    </div>
  );
  return (
    <div className="glass-card empty-state request-state" role="alert">
      <AlertCircle size={32} aria-hidden="true" />
      <h3>تعذر تحميل البيانات</h3>
      <p>{message || 'تحقق من اتصالك بالإنترنت ثم أعد المحاولة.'}</p>
      {onRetry && <button type="button" className="tab-btn active" onClick={onRetry}><RefreshCw size={16} aria-hidden="true" /> إعادة المحاولة</button>}
    </div>
  );
}
