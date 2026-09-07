import { create } from 'zustand';
import { AppState, MetaFile } from '../types/index';

export const useAppStore = create<AppState & {
  setCurrentScreen: (screen: AppState['currentScreen']) => void;
  setFolderPaths: (paths: string[]) => void;
  setPasswordForFolder: (folderPath: string, pwd: string | null) => void;
  setPasswords: (passwords: Record<string, string>) => void;
  setMetas: (metas: Record<string, MetaFile | null>) => void;
  setVideos: (videos: AppState['videos']) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setBrowserFiles: (files?: File[]) => void;
  setLocked: (locked: boolean) => void;
  setFilterType: (type: AppState['filterType']) => void;
  setSortField: (field: AppState['sortField']) => void;
  setSortAscending: (asc: boolean) => void;
  setThumbnailsReady: (ready: boolean) => void;
  setImageViewer: (viewer: AppState['imageViewer']) => void;
  reset: () => void;
}>((set) => ({
  currentScreen: 'login',
  folderPaths: [],
  passwords: {},
  metas: {},
  videos: [],
  isLoading: false,
  error: null,
  browserFiles: undefined,
  isLocked: false,
  filterType: 'all',
  sortField: 'name',
  sortAscending: true,
  thumbnailsReady: false,
  imageViewer: { items: [], currentIndex: 0, visible: false },

  setCurrentScreen: (screen) => set({ currentScreen: screen }),
  setFolderPaths: (paths) => set({ folderPaths: paths }),
  setPasswordForFolder: (folderPath, pwd) =>
    set((state) => {
      const passwords = { ...state.passwords };
      if (pwd) passwords[folderPath] = pwd;
      else delete passwords[folderPath];
      return { passwords };
    }),
  setPasswords: (passwords) => set({ passwords }),
  setMetas: (metas) => set({ metas }),
  setVideos: (videos) => set({ videos }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  setBrowserFiles: (files) => set({ browserFiles: files }),
  setLocked: (locked) => set({ isLocked: locked }),
  setFilterType: (type) => set({ filterType: type }),
  setSortField: (field) => set({ sortField: field }),
  setSortAscending: (asc) => set({ sortAscending: asc }),
  setThumbnailsReady: (ready) => set({ thumbnailsReady: ready }),
  setImageViewer: (viewer) => set({ imageViewer: viewer }),
  reset: () =>
    set({
      currentScreen: 'login',
      folderPaths: [],
      passwords: {},
      metas: {},
      videos: [],
      isLoading: false,
      error: null,
      browserFiles: undefined,
      isLocked: false,
      filterType: 'all',
      sortField: 'name',
      sortAscending: true,
      thumbnailsReady: false,
      imageViewer: { items: [], currentIndex: 0, visible: false },
    }),
}));