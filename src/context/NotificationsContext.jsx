import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useFavorites } from './FavoritesContext';
import { getMatchDetails } from '../services/footballService';
import {
  NOTIFICATION_PREFS_KEY,
  loadNotificationPrefs,
  saveNotificationPrefs,
  getNotificationPermissionState,
  requestBrowserNotificationPermission,
  createNotificationEngine,
  deliverBrowserNotification,
  registerNotificationServiceWorker
} from '../services/notificationsService';
import { notificationSoundPlayer } from '../services/notificationSound';

const NotificationsContext = createContext(null);

export const NotificationsProvider = ({ children, liveMatches = [], matchesLoaded = false, onFeedback }) => {
  const { favoriteTeams } = useFavorites();
  const navigate = useNavigate();
  const location = useLocation();

  const [prefs, setPrefs] = useState(() => loadNotificationPrefs());
  const [permission, setPermission] = useState(() => getNotificationPermissionState());
  const [isModalOpen, setIsModalOpen] = useState(false);

  const engineRef = useRef(null);
  const lastNavRef = useRef({ url: '', ts: 0 });
  const latestMatchesRef = useRef(liveMatches);
  const latestTeamsRef = useRef(favoriteTeams);
  const latestPrefsRef = useRef(prefs);
  const locationPathRef = useRef(location.pathname);

  latestMatchesRef.current = liveMatches;
  latestTeamsRef.current = favoriteTeams;
  latestPrefsRef.current = prefs;
  locationPathRef.current = location.pathname;

  if (!engineRef.current) {
    engineRef.current = createNotificationEngine({
      getMatchDetailsFn: getMatchDetails
    });
  }

  // تنظيف موارد التنسيق عبر التبويبات عند التفكيك
  useEffect(() => {
    const engine = engineRef.current;
    return () => {
      engine?.coordinator?.destroy?.();
    };
  }, []);

  // مزامنة الإعدادات وحالة الإذن بين التبويبات وعند عودة التبويب للواجهة
  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === NOTIFICATION_PREFS_KEY || e.key === null) {
        setPrefs(loadNotificationPrefs());
      }
    };
    const handleVisibility = () => {
      setPermission(getNotificationPermissionState());
    };
    const handleOnline = () => {
      setPermission(getNotificationPermissionState());
    };

    window.addEventListener('storage', handleStorage);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('storage', handleStorage);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  const navigateFromNotification = useCallback((url, match = null) => {
    if (!url) return;
    const now = Date.now();
    // منع التنقل المكرر عند النقر السريع أو استلام نفس الرسالة مرتين
    if (lastNavRef.current.url === url && now - lastNavRef.current.ts < 1500) {
      return;
    }
    if (locationPathRef.current === url) {
      return;
    }
    lastNavRef.current = { url, ts: now };
    navigate(url, match ? { state: { match } } : undefined);
  }, [navigate]);

  // استقبال رسائل النقر على الإشعار من Service Worker
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.serviceWorker) return undefined;
    const handleMessage = (event) => {
      if (event?.data?.type === 'KORA_NOTIFICATION_NAVIGATE' && event.data.url) {
        navigateFromNotification(event.data.url);
      }
    };
    navigator.serviceWorker.addEventListener('message', handleMessage);
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
    };
  }, [navigateFromNotification]);

  // تسجيل Service Worker فقط عند تفعيل الإشعارات مع إذن granted
  useEffect(() => {
    if (prefs.enabled && permission === 'granted') {
      registerNotificationServiceWorker();
    }
  }, [prefs.enabled, permission]);

  // معالجة تحديثات المباريات المشتركة بدون أي polling مستقل إضافي
  useEffect(() => {
    if (!matchesLoaded) return;
    let cancelled = false;

    const run = async () => {
      const engine = engineRef.current;
      if (!engine) return;

      const currentPrefs = latestPrefsRef.current;
      const effectivePrefs = {
        ...currentPrefs,
        enabled: currentPrefs.enabled && permission === 'granted'
      };

      const detected = await engine.processMatches(
        liveMatches,
        favoriteTeams,
        effectivePrefs
      );

      if (cancelled || detected.length === 0) return;

      for (const item of detected) {
        const result = await deliverBrowserNotification(item, {
          onNavigate: navigateFromNotification
        });
        if (result.delivered && currentPrefs.soundEnabled) {
          await notificationSoundPlayer.play({ enabled: true });
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [liveMatches, matchesLoaded, favoriteTeams, prefs.enabled, prefs.soundEnabled, prefs.events, permission, navigateFromNotification]);

  const updatePrefs = useCallback((updater) => {
    setPrefs((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
      return saveNotificationPrefs(next);
    });
  }, []);

  const toggleEventPref = useCallback((eventKey) => {
    updatePrefs((prev) => ({
      ...prev,
      events: {
        ...prev.events,
        [eventKey]: !prev.events[eventKey]
      }
    }));
  }, [updatePrefs]);

  // تفعيل الإشعارات فقط عبر ضغطة مباشرة من المستخدم
  const enableNotifications = useCallback(async () => {
    const currentPerm = getNotificationPermissionState();
    setPermission(currentPerm);

    if (currentPerm === 'unsupported') {
      onFeedback?.('متصفحك الحالي لا يدعم إشعارات المتصفح.');
      return { ok: false, permission: 'unsupported' };
    }

    const grantedPerm = currentPerm === 'granted'
      ? 'granted'
      : await requestBrowserNotificationPermission();
    setPermission(grantedPerm);

    if (grantedPerm !== 'granted') {
      updatePrefs((prev) => ({ ...prev, enabled: false }));
      if (grantedPerm === 'denied') {
        onFeedback?.('تم حظر الإشعارات في المتصفح. يرجى السماح بها من إعدادات الموقع في المتصفح.');
      }
      return { ok: false, permission: grantedPerm };
    }

    // تأسيس خط الأساس للحالة الحالية فور التفعيل حتى لا تُعاد إشعارات قديمة
    if (engineRef.current) {
      await engineRef.current.processMatches(
        latestMatchesRef.current,
        latestTeamsRef.current,
        { ...latestPrefsRef.current, enabled: true },
        { isInitialBaseline: true }
      );
    }

    await registerNotificationServiceWorker();
    updatePrefs((prev) => ({ ...prev, enabled: true }));
    onFeedback?.('تم تفعيل إشعارات الأندية المفضلة بنجاح 🔔');
    return { ok: true, permission: 'granted' };
  }, [onFeedback, updatePrefs]);

  const disableNotifications = useCallback(() => {
    updatePrefs((prev) => ({ ...prev, enabled: false }));
    onFeedback?.('تم إيقاف إشعارات الأندية المفضلة');
  }, [onFeedback, updatePrefs]);

  const toggleSound = useCallback(async () => {
    const nextEnabled = !latestPrefsRef.current.soundEnabled;
    if (nextEnabled) {
      await notificationSoundPlayer.unlock();
    }
    updatePrefs((prev) => ({ ...prev, soundEnabled: nextEnabled }));
  }, [updatePrefs]);

  const testSound = useCallback(async () => {
    await notificationSoundPlayer.unlock();
    const res = await notificationSoundPlayer.play({ enabled: true, force: true });
    if (!res.played) {
      onFeedback?.('تعذر تشغيل صوت التنبيه بسبب قيود الصوت في المتصفح أو الجهاز.');
    }
    return res;
  }, [onFeedback]);

  const sendTestNotification = useCallback(async () => {
    const currentPerm = getNotificationPermissionState();
    setPermission(currentPerm);

    if (currentPerm === 'unsupported') {
      onFeedback?.('متصفحك الحالي لا يدعم إشعارات المتصفح.');
      return { delivered: false };
    }
    if (currentPerm !== 'granted') {
      onFeedback?.('يرجى الضغط على "تفعيل الإشعارات" والسماح بالإذن أولاً.');
      return { delivered: false };
    }

    const firstTeam = latestTeamsRef.current[0];
    const teamName = firstTeam ? (firstTeam.arabicName || firstTeam.name) : 'فريقك المفضل';
    const result = await deliverBrowserNotification({
      eventKey: `test:${Date.now()}`,
      tag: 'kora-score-test',
      title: `🔔 إشعار تجريبي من كورة سكور`,
      body: `الإشعارات جاهزة لمتابعة أحداث ${teamName} مباشرة أثناء بقاء الموقع مفتوحاً.`,
      url: '/favorites'
    }, {
      onNavigate: navigateFromNotification
    });

    if (result.delivered && latestPrefsRef.current.soundEnabled) {
      await notificationSoundPlayer.unlock();
      await notificationSoundPlayer.play({ enabled: true, force: true });
    }

    if (result.delivered) {
      onFeedback?.('تم إرسال الإشعار التجريبي بنجاح.');
    } else {
      onFeedback?.('تعذر إرسال الإشعار التجريبي. تحقق من إعدادات إشعارات النظام.');
    }
    return result;
  }, [navigateFromNotification, onFeedback]);

  const value = useMemo(() => ({
    prefs,
    permission,
    isNotificationsActive: prefs.enabled && permission === 'granted',
    followedTeamsCount: favoriteTeams.length,
    isModalOpen,
    openNotificationSettings: () => setIsModalOpen(true),
    closeNotificationSettings: () => setIsModalOpen(false),
    enableNotifications,
    disableNotifications,
    toggleSound,
    testSound,
    sendTestNotification,
    toggleEventPref
  }), [
    prefs,
    permission,
    favoriteTeams.length,
    isModalOpen,
    enableNotifications,
    disableNotifications,
    toggleSound,
    testSound,
    sendTestNotification,
    toggleEventPref
  ]);

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
};

// oxlint-disable-next-line react/only-export-components
export const useNotifications = () => {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    return {
      prefs: loadNotificationPrefs(null),
      permission: 'unsupported',
      isNotificationsActive: false,
      followedTeamsCount: 0,
      isModalOpen: false,
      openNotificationSettings: () => {},
      closeNotificationSettings: () => {},
      enableNotifications: async () => ({ ok: false }),
      disableNotifications: () => {},
      toggleSound: async () => {},
      testSound: async () => ({ played: false }),
      sendTestNotification: async () => ({ delivered: false }),
      toggleEventPref: () => {}
    };
  }
  return ctx;
};

export default NotificationsContext;
