import { create } from 'zustand';
import { AccentColor, AppSettings, DEFAULT_SETTINGS, ThemeMode, VideoCardSize } from '../types/index';

export const SETTINGS_KEY = 'vault-settings';

interface SettingsStore extends AppSettings {
  hydrated: boolean;
  setUserName: (userName: string) => void;
  setTheme: (theme: ThemeMode) => void;
  setAccentColor: (accentColor: AccentColor) => void;
  setVideoCardSize: (videoCardSize: VideoCardSize) => void;
  resetSettings: () => void;
}

const sanitizeSettings = (raw: any): AppSettings => {
  const base = { ...DEFAULT_SETTINGS };
  if (!raw || typeof raw !== 'object') return base;
  if (typeof raw.userName === 'string') base.userName = raw.userName;
  if (raw.theme === 'dark' || raw.theme === 'light') base.theme = raw.theme;
  if (typeof raw.accentColor === 'string') base.accentColor = raw.accentColor as AccentColor;
  if (raw.videoCardSize === 'small' || raw.videoCardSize === 'medium' || raw.videoCardSize === 'large') {
    base.videoCardSize = raw.videoCardSize;
  }
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
  setVideoCardSize: (videoCardSize) => {
    set({ videoCardSize });
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
