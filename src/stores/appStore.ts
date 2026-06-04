import { create } from 'zustand';
import { AppState } from '../types/index';

export const useAppStore = create<AppState & {
  setCurrentScreen: (screen: AppState['currentScreen']) => void;
  setFolderPath: (path: string) => void;
  setPassword: (pwd: string) => void;
  setMetaFile: (meta: AppState['metaFile']) => void;
  setVideos: (videos: AppState['videos']) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setBrowserFiles: (files?: FileList) => void;
  setLocked: (locked: boolean) => void;
  reset: () => void;
}>((set) => ({
  currentScreen: 'login',
  folderPath: '',
  password: '',
  metaFile: null,
  videos: [],
  isLoading: false,
  error: null,
  browserFiles: undefined,
  isLocked: false,

  setCurrentScreen: (screen) => set({ currentScreen: screen }),
  setFolderPath: (path) => set({ folderPath: path }),
  setPassword: (pwd) => set({ password: pwd }),
  setMetaFile: (meta) => set({ metaFile: meta }),
  setVideos: (videos) => set({ videos }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  setBrowserFiles: (files) => set({ browserFiles: files }),
  setLocked: (locked) => set({ isLocked: locked }),
  reset: () =>
    set({
      currentScreen: 'login',
      folderPath: '',
      password: '',
      metaFile: null,
      videos: [],
      isLoading: false,
      error: null,
      browserFiles: undefined,
      isLocked: false,
    }),
}));
