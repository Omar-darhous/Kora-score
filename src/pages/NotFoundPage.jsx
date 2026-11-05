import React from 'react';
import { Link } from 'react-router-dom';
import { Compass, Home } from 'lucide-react';

const NotFoundPage = () => {
  return (
    <div className="glass-card empty-state" style={{ padding: '60px 24px', textAlign: 'center', margin: '40px auto', maxWidth: 540 }}>
      <div style={{
        width: 64,
        height: 64,
        borderRadius: 'var(--radius-full)',
        background: 'var(--primary-light)',
        color: 'var(--primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 20px'
      }}>
        <Compass size={32} />
      </div>

      <h2 style={{ fontSize: '1.4rem', fontWeight: 900, marginBottom: 8, color: 'var(--text-primary)' }}>
        404 — الصفحة غير موجودة
      </h2>

      <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', maxWidth: 420, margin: '0 auto 24px', lineHeight: 1.6 }}>
        عذراً، الصفحة التي تبحث عنها غير متوفرة أو قد تم تغيير مسارها. يمكنك دائماً العودة إلى جدول المباريات والتغطية الحية.
      </p>

      <Link
        to="/"
        className="submit-btn"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          textDecoration: 'none',
          padding: '10px 24px'
        }}
      >
        <Home size={16} />
        <span>العودة إلى الرئيسية</span>
      </Link>
    </div>
  );
};

export default NotFoundPage;

