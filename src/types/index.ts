// Core interfaces and types for the app

export interface MetaFile {
  state: 'encrypted' | 'decrypted';
  password_hash: string;
  files: Record<string, string | MetaVideoEntry>; // { encrypted_name: original_name | details }
}

export interface MetaVideoEntry {
  name?: string;
  originalName?: string;
  filename?: string;
  duration?: string | number;
}

export interface VideoItem {
  encryptedName: string;
  originalName: string;
  extension: string;
  filePath: string;
  duration?: string | number;
}

export type ThemeMode = 'dark' | 'light';

export type DecryptStatus = 'idle' | 'decrypting' | 'ready' | 'error';

export interface DecryptJob {
  status: DecryptStatus;
  progress: number;
  url?: string;
  error?: string;
  _cleanup?: () => void;
}

export interface NotificationItem {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

export interface AppState {
  currentScreen: 'login' | 'gallery' | 'player';
  folderPath: string;
  password: string;
  metaFile: MetaFile | null;
  videos: VideoItem[];
  isLoading: boolean;
  error: string | null;
  browserFiles?: FileList; // For browser mode file picker
  isLocked: boolean;
}

export interface PlayerState {
  currentVideo: VideoItem | null;
  isDecrypting: boolean;
  decryptProgress: number;
  videoUrl: string | null;
}

export interface DecryptionOptions {
  chunkSize?: number;
  onProgress?: (progress: number) => void;
}
