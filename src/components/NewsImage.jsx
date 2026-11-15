import React, { useState } from 'react';
import { Newspaper } from 'lucide-react';
export default function NewsImage({ src, alt, ...props }) {
  const [failedSrc, setFailedSrc] = useState(null);
  if (!src || failedSrc === src) return <div className="news-image-fallback" role="img" aria-label="لا توجد صورة متاحة لهذا الخبر"><Newspaper size={42} aria-hidden="true" /><span>كورة سكور</span><small>صورة الخبر غير متاحة</small></div>;
  return <img {...props} src={src} alt={alt} referrerPolicy="no-referrer" onError={() => setFailedSrc(src)} />;
}
