import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Settings, Database, Key } from 'lucide-react';

const ApiSettingsModal = ({ onClose, onSave }) => {
  const [useRealApi, setUseRealApi] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [apiProvider, setApiProvider] = useState('api-football');

  useEffect(() => {
    // تحميل الإعدادات المحفوظة
    try {
      const saved = localStorage.getItem('football_api_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        setUseRealApi(parsed.useRealApi || false);
        setApiKey(parsed.apiKey || '');
        setApiProvider(parsed.apiProvider || 'api-football');
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    const settings = { useRealApi, apiKey, apiProvider };
    localStorage.setItem('football_api_settings', JSON.stringify(settings));
    onSave(settings);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.9, y: 50 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 50 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      >
        <div className="modal-header">
          <span className="modal-title d-flex align-center gap-1">
            <Settings size={18} />
            إعدادات ربط البيانات الخارجي (API)
          </span>
          <button className="close-modal-btn" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="modal-body">
          <form className="api-form" onSubmit={handleSubmit}>
            <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center' }}>
              <input
                type="checkbox"
                id="useRealApi"
                checked={useRealApi}
                onChange={(e) => setUseRealApi(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: 'var(--primary)', cursor: 'pointer' }}
              />
              <label htmlFor="useRealApi" className="form-label" style={{ marginRight: 8, cursor: 'pointer' }}>
                تفعيل جلب البيانات الحقيقية من API خارجي
              </label>
            </div>

            {useRealApi && (
              <>
                <div className="form-group">
                  <label className="form-label">مزود الخدمة</label>
                  <select
                    className="form-input"
                    value={apiProvider}
                    onChange={(e) => setApiProvider(e.target.value)}
                  >
                    <option value="api-football">API-Football (موصى به)</option>
                    <option value="football-data">Football-Data.org</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">مفتاح API الخاص بك (API Key)</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="أدخل مفتاح الـ API..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    required
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    يمكنك الحصول على مفتاح مجاني من خلال التسجيل في موقع مزود الخدمة المختار.
                  </span>
                </div>
              </>
            )}

            <div 
              className="glass-card" 
              style={{ 
                padding: 16, 
                fontSize: '0.8rem', 
                color: 'var(--text-secondary)',
                backgroundColor: 'rgba(16, 185, 129, 0.05)',
                borderColor: 'var(--primary-glow)' 
              }}
            >
              <h4 style={{ color: 'var(--primary)', fontWeight: 700, marginBottom: 6 }} className="d-flex align-center gap-1">
                <Database size={14} />
                وضع محاكاة البيانات الذكي
              </h4>
              <p>
                بشكل افتراضي، يعمل الموقع بـ <strong>محرك المحاكاة الذكي</strong>. يقوم هذا المحرك بمحاكاة مباريات اليوم وأمس وغداً بالكامل، وتحديث أهداف الدقائق والبطاقات والإحصائيات مباشرة وبشكل حي ليجعل الموقع يبدو حياً 100% ودون الحاجة لأي إعدادات خارجية.
              </p>
            </div>

            <button type="submit" className="submit-btn" style={{ marginTop: 8 }}>
              حفظ الإعدادات وتحديث الموقع
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
};

export default ApiSettingsModal;
