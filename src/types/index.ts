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
