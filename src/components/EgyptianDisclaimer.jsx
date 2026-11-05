import React from 'react';
import { AlertCircle } from 'lucide-react';

export const EGYPTIAN_DISCLAIMER_TEXT =
  'تنويه: بيانات الدوري المصري المعروضة حاليًا تجريبية وغير رسمية، ولا تمثل النتائج أو الترتيب الفعلي للموسم الحالي أو المواسم السابقة.';

export const EGYPTIAN_BADGE_TEXT = 'بيانات تجريبية';

export const EgyptianBadge = ({ className = '', style = {} }) => {
  return (
    <span className={`egyptian-mock-badge ${className}`} style={style}>
      {EGYPTIAN_BADGE_TEXT}
    </span>
  );
};

export const EgyptianDisclaimer = ({ className = '', style = {} }) => {
  return (
    <div
      className={`egyptian-disclaimer-banner ${className}`}
      style={style}
      role="note"
      aria-label="تنبيه بيانات تجريبية"
    >
      <AlertCircle size={18} className="egyptian-disclaimer-icon" aria-hidden="true" />
      <span className="egyptian-disclaimer-text">
        {EGYPTIAN_DISCLAIMER_TEXT}
      </span>
    </div>
  );
};

export default EgyptianDisclaimer;

