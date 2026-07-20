import { create } from 'zustand';
import { AppState } from '../types/index';

export const useAppStore = create<AppState & {
  setCurrentScreen: (screen: AppState['currentScreen']) => void;
  setFolderPath: (path: string) => void;
  setPassword: (pwd: string | null) => void;
  setMetaFile: (meta: AppState['metaFile']) => void;
  setVideos: (videos: AppState['videos']) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setBrowserFiles: (files?: FileList) => void;
  setLocked: (locked: boolean) => void;
  setHasEncryptedContent: (has: boolean) => void;
  setFilterType: (type: AppState['filterType']) => void;
  setSortField: (field: AppState['sortField']) => void;
  setSortAscending: (asc: boolean) => void;
  setThumbnailsReady: (ready: boolean) => void;
  setImageViewer: (viewer: AppState['imageViewer']) => void;
  reset: () => void;
}>((set) => ({
  currentScreen: 'login',
  folderPath: '',
  password: null,
  metaFile: null,
  videos: [],
  isLoading: false,
  error: null,
  browserFiles: undefined,
  isLocked: false,
  hasEncryptedContent: false,
  filterType: 'all',
  sortField: 'name',
  sortAscending: true,
  thumbnailsReady: false,
  imageViewer: { items: [], currentIndex: 0, visible: false },

  setCurrentScreen: (screen) => set({ currentScreen: screen }),
  setFolderPath: (path) => set({ folderPath: path }),
  setPassword: (pwd) => set({ password: pwd }),
  setMetaFile: (meta) => set({ metaFile: meta }),
  setVideos: (videos) => set({ videos }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  setBrowserFiles: (files) => set({ browserFiles: files }),
  setLocked: (locked) => set({ isLocked: locked }),
  setHasEncryptedContent: (has) => set({ hasEncryptedContent: has }),
  setFilterType: (type) => set({ filterType: type }),
  setSortField: (field) => set({ sortField: field }),
  setSortAscending: (asc) => set({ sortAscending: asc }),
  setThumbnailsReady: (ready) => set({ thumbnailsReady: ready }),
  setImageViewer: (viewer) => set({ imageViewer: viewer }),
  reset: () =>
    set({
      currentScreen: 'login',
      folderPath: '',
      password: null,
      metaFile: null,
      videos: [],
      isLoading: false,
      error: null,
      browserFiles: undefined,
      isLocked: false,
      hasEncryptedContent: false,
      filterType: 'all',
      sortField: 'name',
      sortAscending: true,
      thumbnailsReady: false,
      imageViewer: { items: [], currentIndex: 0, visible: false },
    }),
}));
