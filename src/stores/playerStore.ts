import { create } from 'zustand';
import { PlayerState, SubtitleSearchState, SubtitleTrack, VideoItem } from '../types/index';

export interface MiniPlayerData {
  videoUrl: string;
  currentVideo: VideoItem;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
}

export interface SubtitleState {
  tracks: SubtitleTrack[];
  activeTrackId: string | null;
  enabled: boolean;
  search: SubtitleSearchState;
  setTracks: (tracks: SubtitleTrack[]) => void;
  addTrack: (track: SubtitleTrack) => void;
  removeTrack: (trackId: string) => void;
  setActiveTrackId: (id: string | null) => void;
  setEnabled: (enabled: boolean) => void;
  setSearch: (search: Partial<SubtitleSearchState>) => void;
  setCurrentVideo: (video: VideoItem | null) => void;
}

export const usePlayerStore = create<PlayerState & {
  setCurrentVideo: (video: VideoItem | null) => void;
  setIsDecrypting: (decrypting: boolean) => void;
  setDecryptProgress: (progress: number) => void;
  setVideoUrl: (url: string | null) => void;
  miniPlayer: MiniPlayerData | null;
  setMiniPlayer: (data: MiniPlayerData | null) => void;
  reset: () => void;
} & SubtitleState>((set) => ({
  currentVideo: null,
  isDecrypting: false,
  decryptProgress: 0,
  videoUrl: null,
  miniPlayer: null,

  tracks: [],
  activeTrackId: null,
  enabled: true,
  search: {
    visible: false,
    query: '',
    results: [],
    loading: false,
    error: null,
    source: 'opensubtitles',
    selectedFormat: null,
  },

  setCurrentVideo: (video) => set({ currentVideo: video, tracks: [], activeTrackId: null }),
  setIsDecrypting: (decrypting) => set({ isDecrypting: decrypting }),
  setDecryptProgress: (progress) => set({ decryptProgress: progress }),
  setVideoUrl: (url) => set({ videoUrl: url }),
  setMiniPlayer: (data) => set({ miniPlayer: data }),

  setTracks: (tracks) => set({ tracks }),
  addTrack: (track) => set((state) => ({ tracks: [...state.tracks, track] })),
  removeTrack: (trackId) => set((state) => ({
    tracks: state.tracks.filter((t) => t.id !== trackId),
    activeTrackId: state.activeTrackId === trackId ? null : state.activeTrackId,
  })),
  setActiveTrackId: (id) => set({ activeTrackId: id }),
  setEnabled: (enabled) => set({ enabled }),
  setSearch: (search) => set((state) => ({ search: { ...state.search, ...search } })),

  reset: () =>
    set({
      currentVideo: null,
      isDecrypting: false,
      decryptProgress: 0,
      videoUrl: null,
      miniPlayer: null,
      tracks: [],
      activeTrackId: null,
      enabled: true,
      search: {
        visible: false,
        query: '',
        results: [],
        loading: false,
        error: null,
        source: 'opensubtitles',
        selectedFormat: null,
      },
    }),
}));
