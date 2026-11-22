import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  X,
  Bell,
  BellOff,
  BellRing,
  Volume2,
  VolumeX,
  Play,
  Send,
  Star,
  Info,
  ShieldAlert
} from 'lucide-react';
import { useNotifications } from '../context/NotificationsContext';
import { lockBodyScroll, releaseBodyScrollLock } from '../utils/teamNavigation';

const EVENT_TOGGLES = [
  { key: 'goals', label: 'الأهداف', desc: 'أهداف الفريق المفضل والأهداف المستقبلة' },
  { key: 'kickoff', label: 'انطلاق المباراة', desc: 'تنبيه عند بداية المباراة مباشرة' },
  { key: 'fullTime', label: 'نهاية المباراة', desc: 'النتيجة النهائية عند صافرة الختام' },
  { key: 'redCards', label: 'البطاقات الحمراء', desc: 'الطرد المباشر أو الإنذار الثاني' },
  { key: 'penalties', label: 'ركلات الجزاء', desc: 'ركلات الجزاء المسجّلة والضائعة والمتصدى لها' },
  { key: 'halfTime', label: 'نهاية الشوط الأول (اختياري)', desc: 'نتيجة الاستراحة بين الشوطين' }
];

const NotificationSettingsModal = ({ onClose }) => {
  const {
    prefs,
    permission,
    isNotificationsActive,
    followedTeamsCount,
    enableNotifications,
    disableNotifications,
    toggleSound,
    testSound,
    sendTestNotification,
    toggleEventPref
  } = useNotifications();

  useEffect(() => {
    lockBodyScroll();
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      releaseBodyScrollLock();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const statusMeta = (() => {
    if (permission === 'unsupported') {
      return { text: 'غير مدعومة في هذا المتصفح', cls: 'status-muted' };
    }
    if (permission === 'denied') {
      return { text: 'محظورة من إعدادات المتصفح', cls: 'status-danger' };
    }
    if (isNotificationsActive) {
      return { text: 'مفعّلة ونشطة', cls: 'status-active' };
    }
    return { text: 'غير مفعّلة', cls: 'status-muted' };
  })();

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="إعدادات إشعارات الأندية المفضلة"
    >
      <motion.div
        className="modal-content notif-modal-content"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.94, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 24 }}
        transition={{ type: 'spring', damping: 25, stiffness: 260 }}
      >
        <div className="modal-header">
          <div className="d-flex align-center gap-1">
            {isNotificationsActive ? (
              <BellRing size={18} color="var(--primary)" />
            ) : (
              <Bell size={18} color="var(--primary)" />
            )}
            <span className="modal-title">إشعارات الأندية المفضلة</span>
          </div>
          <button
            type="button"
            className="close-modal-btn"
            onClick={onClose}
            aria-label="إغلاق إعدادات الإشعارات"
          >
            <X size={20} />
          </button>
        </div>

        <div className="modal-body notif-modal-body">
          {/* حالة التفعيل وزر التفعيل الصريح */}
          <div className="notif-hero-row">
            <div className="notif-status-col">
              <span className={`notif-status-pill ${statusMeta.cls}`}>
                {statusMeta.text}
              </span>
              <span className="notif-followed-count">
                <Star size={13} color="var(--accent)" />
                <span>الأندية المتابعة حالياً: <strong>{followedTeamsCount}</strong></span>
              </span>
            </div>

            {isNotificationsActive ? (
              <button
                type="button"
                className="notif-secondary-btn"
                onClick={disableNotifications}
              >
                <BellOff size={15} />
                <span>إيقاف الإشعارات</span>
              </button>
            ) : (
              <button
                type="button"
                className="notif-primary-btn"
                onClick={enableNotifications}
                disabled={permission === 'unsupported'}
              >
                <BellRing size={15} />
                <span>تفعيل الإشعارات</span>
              </button>
            )}
          </div>

          {permission === 'denied' && (
            <div className="notif-alert-box danger" role="alert">
              <ShieldAlert size={16} />
              <span>
                تم رفض إذن الإشعارات سابقاً في المتصفح. لتفعيلها، اضغط على أيقونة القفل بجانب عنوان الموقع واختر السماح بالإشعارات ثم أعد المحاولة.
              </span>
            </div>
          )}

          {/* التحكم بالصوت وأزرار التجربة */}
          <div className="notif-section">
            <div className="notif-control-row">
              <div className="notif-control-info">
                <div className="notif-control-title">
                  {prefs.soundEnabled ? <Volume2 size={16} color="var(--primary)" /> : <VolumeX size={16} color="var(--text-muted)" />}
                  <span>صوت التنبيه</span>
                </div>
                <span className="notif-control-desc">
                  نغمة قصيرة عند وصول إشعار جديد (معطّلة افتراضياً)
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={prefs.soundEnabled}
                aria-label="تفعيل أو إيقاف صوت التنبيه"
                className={`notif-switch ${prefs.soundEnabled ? 'on' : ''}`}
                onClick={toggleSound}
              >
                <span className="notif-switch-thumb" />
              </button>
            </div>

            <div className="notif-test-actions">
              <button
                type="button"
                className="notif-test-btn"
                onClick={testSound}
              >
                <Play size={14} />
                <span>تجربة الصوت</span>
              </button>
              <button
                type="button"
                className="notif-test-btn"
                onClick={sendTestNotification}
                disabled={permission !== 'granted'}
              >
                <Send size={14} />
                <span>إشعار تجريبي</span>
              </button>
            </div>
          </div>

          {/* تفضيلات الأحداث الفردية */}
          <div className="notif-section">
            <h4 className="notif-section-title">الأحداث المراد التنبيه عنها</h4>
            <div className="notif-events-grid">
              {EVENT_TOGGLES.map((item) => {
                const checked = Boolean(prefs.events[item.key]);
                return (
                  <label key={item.key} className="notif-event-item">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleEventPref(item.key)}
                      className="notif-checkbox"
                    />
                    <div className="notif-event-text">
                      <span className="notif-event-label">{item.label}</span>
                      <span className="notif-event-desc">{item.desc}</span>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* ملاحظات واضحة عن نطاق العمل والمفضلة */}
          <div className="notif-info-box">
            <Info size={16} className="notif-info-icon" />
            <div className="notif-info-lines">
              <p>
                تصلك الإشعارات فقط لمباريات <strong>الأندية المضافة إلى المفضلة</strong> (لا تشمل البطولات المفضلة وحدها).
                {' '}
                <Link to="/favorites" onClick={onClose} className="notif-inline-link">
                  إدارة الأندية المفضلة
                </Link>
              </p>
              <p>
                تعمل هذه النسخة طالما أن موقع <strong>كورة سكور مفتوح في المتصفح</strong> (في تبويب نشط أو بالخلفية)، ولا ترسل إشعارات عند إغلاق المتصفح بالكامل.
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default NotificationSettingsModal;
