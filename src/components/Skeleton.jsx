import React from 'react';

export const MatchTickerSkeleton = () => (
  <div className="skeleton-ticker-card">
    <div className="skeleton-line" style={{ width: '40%', height: 14 }} />
    <div className="d-flex flex-column gap-2" style={{ margin: '14px 0' }}>
      <div className="d-flex align-center justify-between">
        <div className="d-flex align-center gap-1" style={{ width: '70%' }}>
          <div className="skeleton-circle" style={{ width: 22, height: 22 }} />
          <div className="skeleton-line" style={{ width: '60%', height: 16 }} />
        </div>
        <div className="skeleton-box" style={{ width: 24, height: 20 }} />
      </div>
      <div className="d-flex align-center justify-between">
        <div className="d-flex align-center gap-1" style={{ width: '70%' }}>
          <div className="skeleton-circle" style={{ width: 22, height: 22 }} />
          <div className="skeleton-line" style={{ width: '60%', height: 16 }} />
        </div>
        <div className="skeleton-box" style={{ width: 24, height: 20 }} />
      </div>
    </div>
    <div className="skeleton-line" style={{ width: '50%', height: 12, marginTop: 'auto' }} />
  </div>
);

export const MatchRowSkeleton = () => (
  <div className="skeleton-match-row">
    <div className="d-flex align-center gap-1" style={{ flex: 1, justifyContent: 'flex-start' }}>
      <div className="skeleton-line" style={{ width: '60%', height: 16 }} />
      <div className="skeleton-circle" style={{ width: 24, height: 24 }} />
    </div>
    <div className="skeleton-box" style={{ width: 70, height: 32, borderRadius: 'var(--radius-sm)' }} />
    <div className="d-flex align-center gap-1" style={{ flex: 1, justifyContent: 'flex-end' }}>
      <div className="skeleton-circle" style={{ width: 24, height: 24 }} />
      <div className="skeleton-line" style={{ width: '60%', height: 16 }} />
    </div>
  </div>
);

export const TableRowSkeleton = () => (
  <tr className="skeleton-table-row">
    <td style={{ textAlign: 'center', width: 44 }}>
      <div className="skeleton-circle" style={{ width: 22, height: 22, margin: '0 auto' }} />
    </td>
    <td>
      <div className="d-flex align-center gap-1">
        <div className="skeleton-circle" style={{ width: 24, height: 24 }} />
        <div className="skeleton-line" style={{ width: '50%', height: 16 }} />
      </div>
    </td>
    {[...Array(6)].map((_, i) => (
      <td key={i} style={{ textAlign: 'center' }}>
        <div className="skeleton-line" style={{ width: 24, height: 14, margin: '0 auto' }} />
      </td>
    ))}
  </tr>
);

export const NewsCardSkeleton = () => (
  <div className="skeleton-news-card">
    <div className="skeleton-box" style={{ width: '100%', height: 180 }} />
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="skeleton-line" style={{ width: '30%', height: 12 }} />
      <div className="skeleton-line" style={{ width: '90%', height: 18 }} />
      <div className="skeleton-line" style={{ width: '70%', height: 14 }} />
    </div>
  </div>
);

