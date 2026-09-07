import { create } from 'zustand';
import { AppSettings, DEFAULT_SETTINGS, ThemeMode, VideoCardSize } from '../types/index';

export const SETTINGS_KEY = 'vault-settings';

interface SettingsStore extends AppSettings {
  hydrated: boolean;
  setUserName: (userName: string) => void;
  setTheme: (theme: ThemeMode) => void;
  setAccentColor: (accentColor: AppSettings['accentColor']) => void;
  setAccentCustom: (accentCustom: string) => void;
  setVideoCardSize: (videoCardSize: VideoCardSize) => void;
  setAutoplay: (autoplay: boolean) => void;
  setDefaultSpeed: (defaultSpeed: number) => void;
  setAutoPlayNext: (autoPlayNext: boolean) => void;
  setNotifyVideosFound: (value: boolean) => void;
  setNotifyDecrypt: (value: boolean) => void;
  setNotifyCache: (value: boolean) => void;
  setNotifyOther: (value: boolean) => void;
  resetSettings: () => void;
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

const toHex = (value: unknown): string | null =>
  typeof value === 'string' && HEX_RE.test(value.trim()) ? value.trim().toLowerCase() : null;

const sanitizeSettings = (raw: any): AppSettings => {
  const base = { ...DEFAULT_SETTINGS };
  if (!raw || typeof raw !== 'object') return base;
  if (typeof raw.userName === 'string') base.userName = raw.userName;
  if (raw.theme === 'dark' || raw.theme === 'light') base.theme = raw.theme;
  if (typeof raw.accentColor === 'string') base.accentColor = raw.accentColor as AppSettings['accentColor'];
  const custom = toHex(raw.accentCustom);
  if (custom) base.accentCustom = custom;
  if (raw.videoCardSize === 'small' || raw.videoCardSize === 'medium' || raw.videoCardSize === 'large') {
    base.videoCardSize = raw.videoCardSize;
  }
  if (raw.autoplay === true || raw.autoplay === false) base.autoplay = raw.autoplay;
  if (typeof raw.defaultSpeed === 'number' && raw.defaultSpeed > 0) base.defaultSpeed = raw.defaultSpeed;
  if (raw.autoPlayNext === true || raw.autoPlayNext === false) base.autoPlayNext = raw.autoPlayNext;
  if (raw.notifyVideosFound === true || raw.notifyVideosFound === false) base.notifyVideosFound = raw.notifyVideosFound;
  if (raw.notifyDecrypt === true || raw.notifyDecrypt === false) base.notifyDecrypt = raw.notifyDecrypt;
  if (raw.notifyCache === true || raw.notifyCache === false) base.notifyCache = raw.notifyCache;
  if (raw.notifyOther === true || raw.notifyOther === false) base.notifyOther = raw.notifyOther;
  return base;
};

const saveToDisk = (settings: AppSettings) => {
  try {
    if ((window as any).electronAPI?.setSettings) {
      void (window as any).electronAPI.setSettings(settings).catch(() => {});
    } else {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    }
  } catch {
    // ignore persistence errors
  }
};

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  ...DEFAULT_SETTINGS,
  hydrated: false,

  setUserName: (userName) => {
    set({ userName });
    saveToDisk(get());
  },
  setTheme: (theme) => {
    set({ theme });
    saveToDisk(get());
  },
  setAccentColor: (accentColor) => {
    set({ accentColor });
    saveToDisk(get());
  },
  setAccentCustom: (hex) => {
    const normalized = toHex(hex);
    if (!normalized) return;
    set({ accentCustom: normalized, accentColor: 'custom' });
    saveToDisk(get());
  },
  setVideoCardSize: (videoCardSize) => {
    set({ videoCardSize });
    saveToDisk(get());
  },
  setAutoplay: (autoplay) => {
    set({ autoplay });
    saveToDisk(get());
  },
  setDefaultSpeed: (defaultSpeed) => {
    if (!(defaultSpeed > 0)) return;
    set({ defaultSpeed });
    saveToDisk(get());
  },
  setAutoPlayNext: (autoPlayNext) => {
    set({ autoPlayNext });
    saveToDisk(get());
  },
  setNotifyVideosFound: (value) => {
    set({ notifyVideosFound: value });
    saveToDisk(get());
  },
  setNotifyDecrypt: (value) => {
    set({ notifyDecrypt: value });
    saveToDisk(get());
  },
  setNotifyCache: (value) => {
    set({ notifyCache: value });
    saveToDisk(get());
  },
  setNotifyOther: (value) => {
    set({ notifyOther: value });
    saveToDisk(get());
  },
  resetSettings: () => {
    set({ ...DEFAULT_SETTINGS });
    saveToDisk(DEFAULT_SETTINGS);
  },
}));

export const loadSettings = async (): Promise<AppSettings> => {
  try {
    if ((window as any).electronAPI?.getSettings) {
      const raw = await (window as any).electronAPI.getSettings();
      return sanitizeSettings(raw);
    }
    const stored = localStorage.getItem(SETTINGS_KEY);
    return sanitizeSettings(stored ? JSON.parse(stored) : null);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
};
