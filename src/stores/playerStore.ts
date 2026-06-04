import { create } from 'zustand';
import { PlayerState, VideoItem } from '../types/index';

export const usePlayerStore = create<PlayerState & {
  setCurrentVideo: (video: VideoItem | null) => void;
  setIsDecrypting: (decrypting: boolean) => void;
  setDecryptProgress: (progress: number) => void;
  setVideoUrl: (url: string | null) => void;
  reset: () => void;
}>((set) => ({
  currentVideo: null,
  isDecrypting: false,
  decryptProgress: 0,
  videoUrl: null,

  setCurrentVideo: (video) => set({ currentVideo: video }),
  setIsDecrypting: (decrypting) => set({ isDecrypting: decrypting }),
  setDecryptProgress: (progress) => set({ decryptProgress: progress }),
  setVideoUrl: (url) => set({ videoUrl: url }),
  reset: () =>
    set({
      currentVideo: null,
      isDecrypting: false,
      decryptProgress: 0,
      videoUrl: null,
    }),
}));
