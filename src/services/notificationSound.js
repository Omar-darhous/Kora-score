/**
 * مولّد صوت تنبيه أصلي وقصير باستخدام Web Audio API بدون أي ملفات صوتية خارجية أو محمية بحقوق نشر.
 * - معطّل افتراضياً ويُفعّل فقط بناءً على اختيار المستخدم.
 * - يُهيّأ/يُفكّ قفله فقط بعد تفاعل مباشر من المستخدم (user gesture).
 * - يمنع تداخل الأصوات ويحمي التطبيق بالكامل عند حظر التشغيل التلقائي أو عدم دعم الصوت.
 */

export const createNotificationSoundPlayer = ({
  getAudioContextClass = () => {
    if (typeof window === 'undefined') return null;
    return window.AudioContext || window.webkitAudioContext || null;
  },
  now = () => Date.now(),
  minIntervalMs = 1200
} = {}) => {
  let audioCtx = null;
  let unlocked = false;
  let lastPlayedAt = 0;

  const ensureContext = () => {
    if (audioCtx) return audioCtx;
    try {
      const AudioCtx = getAudioContextClass();
      if (!AudioCtx) return null;
      audioCtx = new AudioCtx();
      return audioCtx;
    } catch {
      return null;
    }
  };

  const unlock = async () => {
    const ctx = ensureContext();
    if (!ctx) return false;
    try {
      if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
        await ctx.resume();
      }
      unlocked = ctx.state === 'running' || ctx.state === undefined;
      return unlocked;
    } catch {
      return false;
    }
  };

  const play = async ({ enabled = false, force = false } = {}) => {
    if (!enabled && !force) {
      return { played: false, reason: 'disabled' };
    }

    const currentTs = now();
    if (!force && lastPlayedAt > 0 && currentTs - lastPlayedAt < minIntervalMs) {
      return { played: false, reason: 'throttled' };
    }

    const ctx = ensureContext();
    if (!ctx) {
      return { played: false, reason: 'unsupported' };
    }

    try {
      if (ctx.state === 'suspended') {
        if (!force && !unlocked) {
          return { played: false, reason: 'blocked' };
        }
        if (typeof ctx.resume === 'function') {
          await ctx.resume();
        }
      }

      if (ctx.state === 'suspended') {
        return { played: false, reason: 'blocked' };
      }

      const start = typeof ctx.currentTime === 'number' ? ctx.currentTime : 0;

      // نغمة قصيرة أصلية ثنائية التردد (A5 ثم D6) لمدة ~0.35 ثانية
      const tones = [
        { freq: 880, offset: 0, duration: 0.14, peak: 0.12 },
        { freq: 1174.66, offset: 0.13, duration: 0.22, peak: 0.11 }
      ];

      for (const tone of tones) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(tone.freq, start + tone.offset);

        gain.gain.setValueAtTime(0.0001, start + tone.offset);
        gain.gain.exponentialRampToValueAtTime(tone.peak, start + tone.offset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + tone.offset + tone.duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(start + tone.offset);
        osc.stop(start + tone.offset + tone.duration + 0.01);
      }

      unlocked = true;
      lastPlayedAt = currentTs;
      return { played: true, reason: 'ok' };
    } catch {
      return { played: false, reason: 'blocked' };
    }
  };

  const reset = () => {
    lastPlayedAt = 0;
  };

  return {
    unlock,
    play,
    reset,
    isUnlocked: () => unlocked
  };
};

export const notificationSoundPlayer = createNotificationSoundPlayer();
