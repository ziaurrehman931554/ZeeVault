import { create } from 'zustand';
import { PlayerState, VideoItem } from '../types/index';

export interface MiniPlayerData {
  videoUrl: string;
  currentVideo: VideoItem;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
}

export const usePlayerStore = create<PlayerState & {
  setCurrentVideo: (video: VideoItem | null) => void;
  setIsDecrypting: (decrypting: boolean) => void;
  setDecryptProgress: (progress: number) => void;
  setVideoUrl: (url: string | null) => void;
  miniPlayer: MiniPlayerData | null;
  setMiniPlayer: (data: MiniPlayerData | null) => void;
  reset: () => void;
}>((set) => ({
  currentVideo: null,
  isDecrypting: false,
  decryptProgress: 0,
  videoUrl: null,
  miniPlayer: null,

  setCurrentVideo: (video) => set({ currentVideo: video }),
  setIsDecrypting: (decrypting) => set({ isDecrypting: decrypting }),
  setDecryptProgress: (progress) => set({ decryptProgress: progress }),
  setVideoUrl: (url) => set({ videoUrl: url }),
  setMiniPlayer: (data) => set({ miniPlayer: data }),
  reset: () =>
    set({
      currentVideo: null,
      isDecrypting: false,
      decryptProgress: 0,
      videoUrl: null,
      miniPlayer: null,
    }),
}));
