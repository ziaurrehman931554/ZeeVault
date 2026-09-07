export type MediaType = 'encrypted_video' | 'unencrypted_video' | 'encrypted_image' | 'unencrypted_image';

export type FilterType = 'all' | 'videos' | 'images' | 'encrypted' | 'unencrypted';

export type SortField = 'name' | 'dateAdded' | 'dateModified' | 'type' | 'size';

export interface MetaFile {
  state: 'encrypted' | 'decrypted';
  password_hash: string;
  version?: number;
  files: Record<string, string | MetaVideoEntry>;
}

export interface MetaVideoEntry {
  name?: string;
  originalName?: string;
  filename?: string;
  duration?: string | number;
  dateAdded?: string;
  dateModified?: string;
  fileSize?: number;
  width?: number;
  height?: number;
  thumbnail?: string;
}

export interface VideoItem {
  id: string;
  encryptedName: string;
  originalName: string;
  extension: string;
  filePath: string;
  folderPath: string;
  duration?: string | number;
  encrypted: boolean;
  mediaType: MediaType;
  dateAdded?: string;
  dateModified?: string;
  fileSize?: number;
  width?: number;
  height?: number;
  thumbnailEncrypted?: string;
  thumbnailUrl?: string;
}

export type ThemeMode = 'dark' | 'light';

export type AccentColor =
  | 'sky'
  | 'blue'
  | 'green'
  | 'emerald'
  | 'purple'
  | 'violet'
  | 'pink'
  | 'rose'
  | 'amber'
  | 'orange'
  | 'teal'
  | 'red';

export type VideoCardSize = 'small' | 'medium' | 'large';

export interface AppSettings {
  userName: string;
  theme: ThemeMode;
  accentColor: AccentColor;
  videoCardSize: VideoCardSize;
}

export const DEFAULT_SETTINGS: AppSettings = {
  userName: 'Guest',
  theme: 'dark',
  accentColor: 'sky',
  videoCardSize: 'medium',
};

export const ACCENT_PRESETS: { key: AccentColor; label: string; dark: string; light: string }[] = [
  { key: 'sky', label: 'Sky', dark: '#38bdf8', light: '#0284c7' },
  { key: 'blue', label: 'Blue', dark: '#3b82f6', light: '#2563eb' },
  { key: 'green', label: 'Green', dark: '#22c55e', light: '#16a34a' },
  { key: 'emerald', label: 'Emerald', dark: '#10b981', light: '#059669' },
  { key: 'teal', label: 'Teal', dark: '#2dd4bf', light: '#0d9488' },
  { key: 'purple', label: 'Purple', dark: '#a855f7', light: '#7c3aed' },
  { key: 'violet', label: 'Violet', dark: '#8b5cf6', light: '#6d28d9' },
  { key: 'pink', label: 'Pink', dark: '#ec4899', light: '#db2777' },
  { key: 'rose', label: 'Rose', dark: '#f43f5e', light: '#e11d48' },
  { key: 'red', label: 'Red', dark: '#ef4444', light: '#dc2626' },
  { key: 'amber', label: 'Amber', dark: '#f59e0b', light: '#d97706' },
  { key: 'orange', label: 'Orange', dark: '#f97316', light: '#ea580c' },
];

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
  currentScreen: 'login' | 'gallery' | 'player' | 'settings';
  folderPaths: string[];
  passwords: Record<string, string>;
  metas: Record<string, MetaFile | null>;
  videos: VideoItem[];
  isLoading: boolean;
  error: string | null;
  browserFiles?: File[];
  isLocked: boolean;
  filterType: FilterType;
  sortField: SortField;
  sortAscending: boolean;
  thumbnailsReady: boolean;
  imageViewer: ImageViewerState;
}

export interface ImageViewerState {
  items: VideoItem[];
  currentIndex: number;
  visible: boolean;
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

export const MEDIA_EXTENSIONS = {
  video: ['mp4', 'webm', 'mkv', 'avi', 'mov', 'wmv', 'm4v', 'mpeg', 'mpg', 'ogv', '3gp', 'flv', 'ts'],
  image: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'tif', 'webp'],
  subtitle: ['srt', 'vtt', 'ass', 'ssa', 'sub'],
} as const;

export const VIDEO_EXTENSIONS = new Set(MEDIA_EXTENSIONS.video);
export const IMAGE_EXTENSIONS = new Set(MEDIA_EXTENSIONS.image);
export const SUBTITLE_EXTENSIONS = new Set(MEDIA_EXTENSIONS.subtitle);
export const ALL_MEDIA_EXTENSIONS = new Set([...MEDIA_EXTENSIONS.video, ...MEDIA_EXTENSIONS.image]);

export type SubtitleFormat = 'srt' | 'vtt' | 'ass' | 'ssa' | 'sub';

export interface SubtitleTrack {
  id: string;
  label: string;
  language: string;
  languageCode: string;
  format: SubtitleFormat;
  source: 'local' | 'opensubtitles' | 'subdl';
  vttUrl?: string;
  srtContent?: string;
}

export interface SubtitleSearchResult {
  id: string;
  releaseName: string;
  fileName: string;
  language: string;
  languageCode: string;
  format: SubtitleFormat;
  uploader: string;
  downloadCount?: number;
  source: 'opensubtitles' | 'subdl';
  downloadUrl: string;
  matchScore?: number;
}

export interface SubtitleSearchState {
  visible: boolean;
  query: string;
  results: SubtitleSearchResult[];
  loading: boolean;
  error: string | null;
  source: 'opensubtitles' | 'subdl' | 'both';
  selectedFormat: SubtitleFormat | null;
}
