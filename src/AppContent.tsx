import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAppStore } from './stores/appStore';
import { usePlayerStore } from './stores/playerStore';
import LoginScreen from './components/LoginScreen';
import VideoGallery from './components/VideoGallery';
import SettingsScreen from './components/SettingsScreen';
import VideoPlayer from './components/VideoPlayer';
import MiniPlayer from './components/MiniPlayer';
import LockScreen from './components/LockScreen';
import ImageViewer from './components/ImageViewer';
import SubtitleSearchDialog from './components/SubtitleSearchDialog';
import PasswordPrompt from './components/PasswordPrompt';
import CustomScrollbar from './components/CustomScrollbar';
import { DecryptJob, MetaFile, NotificationItem, VideoItem } from './types/index';
import { CryptoService } from './services/cryptoService';
import { MediaScanner } from './services/mediaScanner';
import { createMseBlob } from './services/tsTransmuxer';
import { decryptAllThumbnails, generateUnencryptedThumbnailFromBuffer } from './services/thumbnailManager';
import { loadSettings, useSettingsStore } from './stores/settingsStore';
import { ACCENT_PRESETS, DEFAULT_SETTINGS } from './types/index';

const MAX_READY_CACHE = 20;

// Compute the shell background tint alphas for the native window materials.
// intensity (0-100) = how strongly frosted the glass is (also maps to blur px).
// opacity (0-100) = backdrop tint blended toward fully opaque (material hidden).
const materialTints = (
  material: 'mica' | 'acrylic',
  isLight: boolean,
  intensity: number,
  opacity: number,
): { a: number; b: number; c: number; blurPx: number } => {
  const i = Math.max(0, Math.min(1, intensity / 100));
  const o = Math.max(0, Math.min(1, opacity / 100));
  const defs = material === 'mica'
    ? isLight
      ? [{ min: 0.15, span: 0.46 }, { min: 0.13, span: 0.42 }, { min: 0.14, span: 0.44 }]
      : [{ min: 0.12, span: 0.44 }, { min: 0.1, span: 0.4 }, { min: 0.11, span: 0.42 }]
    : isLight
      ? [{ min: 0.02, span: 0.26 }, { min: 0.018, span: 0.22 }, { min: 0.02, span: 0.24 }]
      : [{ min: 0.02, span: 0.26 }, { min: 0.018, span: 0.22 }, { min: 0.02, span: 0.24 }];
  const stop = (min: number, span: number) => {
    const alpha = min + (1 - i) * span;
    return alpha + (1 - alpha) * o;
  };
  return {
    a: stop(defs[0].min, defs[0].span),
    b: stop(defs[1].min, defs[1].span),
    c: stop(defs[2].min, defs[2].span),
    blurPx: Math.round(i * (material === 'mica' ? 12 : 42)),
  };
};

const folderDisplayName = (path: string): string => {
  const parts = path.split(/[\\/]+/).filter(Boolean);
  return parts[parts.length - 1] || path;
};

const AppContent: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { videoId } = useParams<{ videoId: string }>();
  const {
    currentScreen, browserFiles, isLocked, videos, folderPaths, metas, passwords,
    setLocked, setCurrentScreen, setPasswordForFolder,
    setVideos, setThumbnailsReady,
  } = useAppStore();
  const { currentVideo, videoUrl, miniPlayer, setCurrentVideo, setIsDecrypting, setDecryptProgress, setVideoUrl } = usePlayerStore();
  const [savedFolderPaths, setSavedFolderPaths] = useState<string[] | null>(null);

  const settingsTheme = useSettingsStore((s) => s.theme);
  const settingsAccent = useSettingsStore((s) => s.accentColor);
  const settingsAccentCustom = useSettingsStore((s) => s.accentCustom);
  const settingsCardSize = useSettingsStore((s) => s.videoCardSize);
  const settingsMaterial = useSettingsStore((s) => s.windowMaterial);
  const settingsMaterialIntensity = useSettingsStore((s) => s.materialIntensity);
  const settingsBackdropOpacity = useSettingsStore((s) => s.backdropOpacity);
  const setSettingsTheme = useSettingsStore((s) => s.setTheme);
  const settingsHydrated = useSettingsStore((s) => s.hydrated);

  // Hydrate persisted settings once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const loaded = await loadSettings();
      if (cancelled) return;
      useSettingsStore.setState({ ...loaded, hydrated: true });
    })();
    return () => { cancelled = true; };
  }, []);

  // Apply the native window material (Mica/Acrylic) once settings are hydrated.
  useEffect(() => {
    if (!settingsHydrated) return;
    if ((window as any).electronAPI?.setWindowMaterial) {
      void (window as any).electronAPI.setWindowMaterial(settingsMaterial).catch(() => {});
    }
  }, [settingsMaterial, settingsHydrated]);

  // Apply accent color via CSS variables on the document root (inherits down).
  useEffect(() => {
    let dark: string;
    let light: string;
    if (settingsAccent === 'custom') {
      dark = settingsAccentCustom || DEFAULT_SETTINGS.accentCustom;
      light = dark;
    } else {
      const preset = ACCENT_PRESETS.find((p) => p.key === settingsAccent) ?? ACCENT_PRESETS[0];
      dark = preset.dark;
      light = preset.light;
    }
    document.documentElement.style.setProperty('--accent-app-dark', dark);
    document.documentElement.style.setProperty('--accent-app-light', light);
  }, [settingsAccent, settingsAccentCustom]);

  const toggleTheme = () => {
    setSettingsTheme(settingsTheme === 'dark' ? 'light' : 'dark');
  };

  useEffect(() => {
    // Browser mode: always show login, no persistent storage
    if (!(window as any).electronAPI) {
      let fallback: string[] = [];
      try {
        const stored = localStorage.getItem('vault-folder-paths');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) fallback = parsed.filter(Boolean);
        } else {
          const legacy = localStorage.getItem('vault-folder-path');
          if (legacy) fallback = [legacy];
        }
      } catch {}
      setSavedFolderPaths(fallback);
      return;
    }

    let cancelled = false;
    (async () => {
      let paths: string[] = [];
      try {
        if ((window as any).electronAPI?.getStoredFolderPaths) {
          paths = await (window as any).electronAPI.getStoredFolderPaths();
        }
        if ((!paths || paths.length === 0) && (window as any).electronAPI?.getStoredFolderPath) {
          const legacy = await (window as any).electronAPI.getStoredFolderPath();
          if (legacy) paths = [legacy];
        }
      } catch {}

      if (!cancelled) setSavedFolderPaths(paths ?? []);
    })();
    return () => { cancelled = true; };
  }, []);

  // Reload warning (browser only) — keyboard shortcut intercept, no beforeunload
  const [reloadPending, setReloadPending] = useState(false);
  const handleReloadConfirm = useCallback(() => { window.location.reload(); }, []);
  const handleReloadCancel = useCallback(() => setReloadPending(false), []);

  useEffect(() => {
    if ((window as any).electronAPI) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F5' || (e.ctrlKey && e.key === 'r') || (e.metaKey && e.key === 'r')) {
        e.preventDefault();
        setReloadPending(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  const [decryptJobs, setDecryptJobs] = useState<Record<string, DecryptJob>>({});
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [passwordPromptVisible, setPasswordPromptVisible] = useState(false);
  const [pendingDecryptVideo, setPendingDecryptVideo] = useState<VideoItem | null>(null);
  const [pendingUnlockFolder, setPendingUnlockFolder] = useState<string | null>(null);
  const decryptJobsRef = useRef(decryptJobs);
  const readyOrderRef = useRef<string[]>([]);
  const unencryptedThumbsGeneratedRef = useRef(false);
  const autoStartRef = useRef(true);

  const openSettings = useCallback(() => {
    setCurrentScreen('settings');
  }, [setCurrentScreen]);

  const closeSettings = useCallback(() => {
    setCurrentScreen('gallery');
  }, [setCurrentScreen]);

  const updateDecryptJobs = useCallback(
    (updater: Record<string, DecryptJob> | ((jobs: Record<string, DecryptJob>) => Record<string, DecryptJob>)) => {
      setDecryptJobs((jobs) => {
        const nextJobs = typeof updater === 'function' ? updater(jobs) : updater;
        decryptJobsRef.current = nextJobs;
        return nextJobs;
      });
    }, []
  );

  const getNotifyCategory = useCallback((message: string): 'videosFound' | 'decrypt' | 'cache' | 'other' => {
    const m = message.toLowerCase();
    if (m.includes('media files') || m.includes('media files in')) return 'videosFound';
    if (m.includes('decrypt') || m.includes('processing') || m.includes('ready:')) return 'decrypt';
    if (m.includes('cache') || m.includes('cleared')) return 'cache';
    return 'other';
  }, []);

  const notify = useCallback(
    (message: string, type: NotificationItem['type'] = 'info') => {
      const settings = useSettingsStore.getState();
      const category = getNotifyCategory(message);
      if (category === 'videosFound' && !settings.notifyVideosFound) return;
      if (category === 'decrypt' && !settings.notifyDecrypt) return;
      if (category === 'cache' && !settings.notifyCache) return;
      if (category === 'other' && !settings.notifyOther) return;

      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      setNotifications((items) => [...items, { id, type, message }]);
      window.setTimeout(() => {
        setNotifications((items) => items.filter((item) => item.id !== id));
      }, 4200);
    }, [getNotifyCategory]
  );

  const readVideoFile = useCallback(
    async (video: VideoItem): Promise<ArrayBuffer | Uint8Array> => {
      if ((window as any).electronAPI?.readFile) {
        return (window as any).electronAPI.readFile(video.filePath);
      }

      if (!browserFiles) {
        throw new Error('No browser file source is available');
      }

      const targetFile = browserFiles.find((file) => {
        const relativePath = file.webkitRelativePath || file.name;
        const normalized = relativePath.replace(/\\/g, '/');
        return normalized === video.filePath.replace(/\\/g, '/') || normalized.endsWith(video.encryptedName);
      });

      if (!targetFile) {
        throw new Error(`File not found: ${video.originalName}`);
      }

      return targetFile.arrayBuffer();
    }, [browserFiles]
  );

  const readVideoFileChunk = useCallback(
    async (_filePath: string, offset: number, length: number): Promise<{ done: boolean; data: ArrayBuffer | null }> => {
      const api = (window as any).electronAPI;
      if (api?.readFileChunk) {
        return api.readFileChunk(_filePath, offset, length);
      }
      // Browser fallback isn't supported for streaming; signal EOF so the
      // caller can abort gracefully.
      return { done: true, data: null };
    }, []
  );

  const rememberReadyVideo = useCallback(
    (jobs: Record<string, DecryptJob>, videoId: string, readyJob: DecryptJob) => {
      const nextJobs = { ...jobs };
      const previous = nextJobs[videoId];
      if (previous?.url && previous.url !== readyJob.url) {
        if (previous._cleanup) previous._cleanup();
        else URL.revokeObjectURL(previous.url);
      }

      nextJobs[videoId] = readyJob;
      readyOrderRef.current = readyOrderRef.current.filter((name) => name !== videoId);
      readyOrderRef.current.push(videoId);

      while (readyOrderRef.current.length > MAX_READY_CACHE) {
        const oldestName = readyOrderRef.current.shift();
        if (!oldestName) break;
        const oldestJob = nextJobs[oldestName];
        if (oldestJob?.url) {
          if (oldestJob._cleanup) oldestJob._cleanup();
          else URL.revokeObjectURL(oldestJob.url);
        }
        delete nextJobs[oldestName];
      }

      return nextJobs;
    }, []
  );

  const clearVideoCache = useCallback(
    (video: VideoItem, silent = false) => {
      updateDecryptJobs((jobs) => {
        const job = jobs[video.id];
        if (job?.url) {
          if (job._cleanup) job._cleanup();
          else URL.revokeObjectURL(job.url);
        }
        readyOrderRef.current = readyOrderRef.current.filter((name) => name !== video.id);
        const nextJobs = { ...jobs };
        delete nextJobs[video.id];
        return nextJobs;
      });

      const playerState = usePlayerStore.getState();
      if (playerState.currentVideo?.id === video.id) {
        setVideoUrl(null);
      }

      if (!silent) notify(`Cleared from cache: ${video.originalName}`, 'success');
    }, [notify, setVideoUrl, updateDecryptJobs]
  );

  const decryptSingleVideo = useCallback(async (video: VideoItem) => {
    const existing = decryptJobsRef.current[video.id];
    if (existing?.status === 'decrypting') return;
    if (existing?.status === 'ready') {
      notify('This media is already decrypted.', 'info');
      return;
    }

    const pwd = useAppStore.getState().passwords[video.folderPath] || null;

    if (video.encrypted && !pwd) {
      setPendingDecryptVideo(video);
      setPendingUnlockFolder(null);
      setPasswordPromptVisible(true);
      return;
    }

    setCurrentVideo(video);
    setIsDecrypting(true);
    setDecryptProgress(0);
    updateDecryptJobs((jobs) => ({
      ...jobs,
      [video.id]: { status: 'decrypting', progress: 0 },
    }));
    notify(`Processing ${video.originalName}`, 'info');

    try {
      const isImage = video.mediaType === 'encrypted_image' || video.mediaType === 'unencrypted_image';

      if (!video.encrypted) {
        const mimeType = CryptoService.getMimeType(video.originalName);
        const { url } = await CryptoService.streamToBlobUrl(
          video.filePath, null, mimeType, readVideoFileChunk,
          (done, total) => {
            const progress = Math.max(1, Math.round((done / total) * 100));
            setDecryptProgress(progress);
            updateDecryptJobs((jobs) => ({ ...jobs, [video.id]: { status: 'decrypting', progress } }));
          }
        );
        updateDecryptJobs((jobs) =>
          rememberReadyVideo(jobs, video.id, { status: 'ready', progress: 100, url })
        );
        setIsDecrypting(false);
        setDecryptProgress(100);
        notify(`Ready: ${video.originalName}`, 'success');

        if (video.mediaType === 'unencrypted_video') {
          setVideoUrl(url);
          useAppStore.setState({ currentScreen: 'player' });
          navigate(`/app/view/${encodeURIComponent(video.id)}`);
        }
        return;
      }

      // Encrypted content
      if (isImage || video.extension === 'ts') {
        const fileBuffer = await readVideoFile(video);
        const fileBytes = fileBuffer instanceof Uint8Array ? fileBuffer : new Uint8Array(fileBuffer);

        // XOR decrypt into a single buffer (images & .ts are smaller/buffered).
        const totalSize = fileBytes.length;
        let processedSize = 0;
        const decryptedChunks: Uint8Array[] = [];
        const chunkSize = 4 * 1024 * 1024;

        for (const chunk of CryptoService.xorDecryptChunked(fileBytes, pwd!, chunkSize)) {
          decryptedChunks.push(chunk);
          processedSize += chunk.length;
          const progress = Math.max(1, Math.round((processedSize / totalSize) * 100));
          setDecryptProgress(progress);
          updateDecryptJobs((jobs) => ({
            ...jobs,
            [video.id]: { status: 'decrypting', progress },
          }));
          await new Promise((resolve) => window.setTimeout(resolve, 0));
        }

        const decryptedBuffer = new Uint8Array(totalSize);
        let offset = 0;
        for (const chunk of decryptedChunks) {
          decryptedBuffer.set(chunk, offset);
          offset += chunk.length;
        }

        if (!isImage && video.extension === 'ts') {
          try {
            const { url, cleanup } = await createMseBlob(decryptedBuffer);
            updateDecryptJobs((jobs) =>
              rememberReadyVideo(jobs, video.id, { status: 'ready', progress: 100, url, _cleanup: cleanup })
            );
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            updateDecryptJobs((jobs) => ({
              ...jobs,
              [video.id]: { status: 'error', progress: 0, error: msg },
            }));
            setIsDecrypting(false);
            setDecryptProgress(0);
            notify(`Could not play .ts file: ${msg}`, 'error');
            return;
          }
        } else {
          const mimeType = isImage ? `image/${video.extension}` : CryptoService.getMimeType(video.originalName);
          const url = CryptoService.bufferToBlob(decryptedBuffer, mimeType);
          updateDecryptJobs((jobs) =>
            rememberReadyVideo(jobs, video.id, { status: 'ready', progress: 100, url })
          );
        }
      } else {
        // Large encrypted video: stream-decrypt directly into a blob URL.
        const mimeType = CryptoService.getMimeType(video.originalName);
        const { url, cleanup } = await CryptoService.streamToBlobUrl(
          video.filePath, pwd!, mimeType, readVideoFileChunk,
          (done, total) => {
            const progress = Math.max(1, Math.round((done / total) * 100));
            setDecryptProgress(progress);
            updateDecryptJobs((jobs) => ({ ...jobs, [video.id]: { status: 'decrypting', progress } }));
          }
        );
        updateDecryptJobs((jobs) =>
          rememberReadyVideo(jobs, video.id, { status: 'ready', progress: 100, url, _cleanup: cleanup })
        );
      }

      setIsDecrypting(false);
      setDecryptProgress(100);
      notify(`Ready: ${video.originalName}`, 'success');

      if (isImage) {
        const state = useAppStore.getState();
        const allImages = state.videos.filter(v =>
          v.mediaType === 'encrypted_image' || v.mediaType === 'unencrypted_image'
        );
        const idx = allImages.findIndex(v => v.id === video.id);
        useAppStore.getState().setImageViewer({ items: allImages, currentIndex: Math.max(0, idx), visible: true });
      } else {
        const url = decryptJobsRef.current[video.id]?.url;
        if (url) {
          setVideoUrl(url);
          useAppStore.setState({ currentScreen: 'player' });
          navigate(`/app/view/${encodeURIComponent(video.id)}`);
        }
      }

    } catch (error) {
      const message = error instanceof Error ? error.message : `Failed to process ${video.originalName}`;
      setIsDecrypting(false);
      setDecryptProgress(0);
      updateDecryptJobs((jobs) => ({
        ...jobs,
        [video.id]: { status: 'error', progress: 0, error: message },
      }));
      notify(message, 'error');
    }
  }, [notify, readVideoFile, rememberReadyVideo, setCurrentVideo, setDecryptProgress, setIsDecrypting, updateDecryptJobs, setVideoUrl, navigate]);

  const handleUnlockFolder = useCallback((folderPath: string) => {
    setPendingUnlockFolder(folderPath);
    setPendingDecryptVideo(null);
    setPasswordPromptVisible(true);
  }, []);

  const handleLockFolder = useCallback((folderPath: string) => {
    const state = useAppStore.getState();
    state.setPasswordForFolder(folderPath, null);

    const folderVideoIds = new Set<string>();
    let thumbsChanged = false;
    const nextVideos = state.videos.map((v) => {
      if (v.folderPath !== folderPath) return v;
      folderVideoIds.add(v.id);
      if (!v.thumbnailUrl) return v;
      URL.revokeObjectURL(v.thumbnailUrl);
      thumbsChanged = true;
      return { ...v, thumbnailUrl: undefined };
    });
    if (thumbsChanged) setVideos(nextVideos);

    updateDecryptJobs((jobs) => {
      const nextJobs = { ...jobs };
      Object.keys(nextJobs).forEach((id) => {
        if (!folderVideoIds.has(id)) return;
        const job = nextJobs[id];
        if (job?.url) {
          if (job._cleanup) job._cleanup();
          else URL.revokeObjectURL(job.url);
        }
        readyOrderRef.current = readyOrderRef.current.filter((name) => name !== id);
        delete nextJobs[id];
      });
      return nextJobs;
    });

    const playerState = usePlayerStore.getState();
    if (playerState.currentVideo?.folderPath === folderPath) {
      setVideoUrl(null);
    }
    if (playerState.miniPlayer?.currentVideo?.folderPath === folderPath) {
      playerState.setMiniPlayer(null);
    }

    notify(`Locked: ${folderDisplayName(folderPath)}`, 'info');
  }, [notify, setVideos, setVideoUrl, updateDecryptJobs]);

  const handleRemoveFolder = useCallback((folderPath: string) => {
    const state = useAppStore.getState();

    const paths = state.folderPaths.filter((p) => p !== folderPath);
    state.setFolderPaths(paths);
    state.setMetas((() => {
      const nextMetas = { ...state.metas };
      delete nextMetas[folderPath];
      return nextMetas;
    })());
    state.setPasswordForFolder(folderPath, null);

    const folderVideoIds = new Set<string>();
    let videosChanged = false;
    const nextVideos = state.videos.filter((v) => {
      if (v.folderPath !== folderPath) return true;
      folderVideoIds.add(v.id);
      if (v.thumbnailUrl) {
        URL.revokeObjectURL(v.thumbnailUrl);
        videosChanged = true;
      }
      return false;
    });
    if (videosChanged || nextVideos.length !== state.videos.length) setVideos(nextVideos);

    updateDecryptJobs((jobs) => {
      const nextJobs = { ...jobs };
      Object.keys(nextJobs).forEach((id) => {
        if (!folderVideoIds.has(id)) return;
        const job = nextJobs[id];
        if (job?.url) {
          if (job._cleanup) job._cleanup();
          else URL.revokeObjectURL(job.url);
        }
        readyOrderRef.current = readyOrderRef.current.filter((name) => name !== id);
        delete nextJobs[id];
      });
      return nextJobs;
    });

    const playerState = usePlayerStore.getState();
    if (playerState.currentVideo?.folderPath === folderPath) {
      setVideoUrl(null);
    }
    if (playerState.miniPlayer?.currentVideo?.folderPath === folderPath) {
      playerState.setMiniPlayer(null);
    }

    try {
      if ((window as any).electronAPI?.setStoredFolderPaths) {
        void (window as any).electronAPI.setStoredFolderPaths(paths);
      } else {
        localStorage.setItem('vault-folder-paths', JSON.stringify(paths));
      }
    } catch {}

    notify(`Removed ${folderDisplayName(folderPath)}`, 'success');
  }, [notify, setVideos, setVideoUrl, updateDecryptJobs]);

  const addFoldersInputRef = useRef<HTMLInputElement>(null);

  const appendFolders = useCallback(
    async (newFolders: Array<{ path: string; files: File[] }>) => {
      const storeState = useAppStore.getState();
      const existingPaths = new Set(storeState.folderPaths.map((p) => p.toLowerCase()));
      const nextFolderPaths = [...storeState.folderPaths];
      const nextMetas = { ...storeState.metas };
      const nextVideos = [...storeState.videos];
      const existingIds = new Set(nextVideos.map((v) => v.id));
      const addedFiles: File[] = [];
      let added = 0;
      let failed = 0;

      for (const folder of newFolders) {
        if (!folder.path || existingPaths.has(folder.path.toLowerCase())) continue;
        try {
          const scannedFiles = await MediaScanner.scanFolderFiles(
            folder.path, folder.files, folder.files.length > 0 ? folder.path : undefined
          );
          const fromScan = await MediaScanner.readMetaContent(folder.path, folder.files, folder.path);
          let meta: MetaFile | null = null;
          let encryptedVideos: VideoItem[] = [];
          if (fromScan) {
            meta = MediaScanner.parseMeta(fromScan);
            if (MediaScanner.isValidMetaFile(meta)) {
              const encPathByName = new Map<string, string>();
              for (const f of scannedFiles) {
                if (f.isEncrypted) encPathByName.set(f.name.toLowerCase(), f.path);
              }
              encryptedVideos = MediaScanner.metaToEncryptedVideos(
                meta,
                folder.path,
                (encryptedName: string) => encPathByName.get(encryptedName.toLowerCase()) ?? `${folder.path}\\${encryptedName}`
              );
            } else {
              meta = null;
            }
          }
          const unencryptedVideos = MediaScanner.scannedToUnencryptedVideos(scannedFiles, folder.path);
          const folderVideos = MediaScanner.mergeMedia(encryptedVideos, unencryptedVideos).filter((v) => {
            if (existingIds.has(v.id)) return false;
            existingIds.add(v.id);
            return true;
          });

          nextFolderPaths.push(folder.path);
          nextMetas[folder.path] = meta;
          nextVideos.push(...folderVideos);
          addedFiles.push(...folder.files);
          added++;
        } catch (e) {
          failed++;
          const message = e instanceof Error ? e.message : 'Failed to read folder';
          notify(`Could not open "${folderDisplayName(folder.path)}": ${message}`, 'error');
        }
      }

      if (added === 0) {
        if (failed === 0) notify('That folder is already loaded', 'info');
        return;
      }

      const state = useAppStore.getState();
      state.setFolderPaths(nextFolderPaths);
      state.setMetas(nextMetas);
      state.setVideos(nextVideos);
      if (addedFiles.length > 0) {
        state.setBrowserFiles([...(state.browserFiles || []), ...addedFiles]);
      }

      try {
        if ((window as any).electronAPI?.setStoredFolderPaths) {
          await (window as any).electronAPI.setStoredFolderPaths(nextFolderPaths);
        } else {
          localStorage.setItem('vault-folder-paths', JSON.stringify(nextFolderPaths));
        }
      } catch {}

      unencryptedThumbsGeneratedRef.current = false;

      notify(
        failed
          ? `Added ${added} folder${added !== 1 ? 's' : ''} (skipped ${failed} failed)`
          : `Added ${added} folder${added !== 1 ? 's' : ''}`,
        'success'
      );
    }, [notify]
  );

  const handleAddFolders = useCallback(() => {
    const api = (window as any).electronAPI;
    if (api?.selectFolders) {
      void (async () => {
        try {
          const result = await api.selectFolders();
          if (result && result.length > 0) {
            await appendFolders(result.map((p: string) => ({ path: p, files: [] })));
          }
        } catch (e) {
          notify(e instanceof Error ? e.message : 'Failed to select folders', 'error');
        }
      })();
    } else {
      addFoldersInputRef.current?.click();
    }
  }, [appendFolders, notify]);

  const handleAddFoldersInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.currentTarget.files || []);
    e.currentTarget.value = '';
    if (files.length === 0) return;

    const byFolder = new Map<string, File[]>();
    files.forEach((file) => {
      const rel = (file.webkitRelativePath || file.name).replace(/\\/g, '/').split('/');
      const folderName = rel[0] || file.name;
      const list = byFolder.get(folderName) || [];
      list.push(file);
      byFolder.set(folderName, list);
    });

    await appendFolders(
      Array.from(byFolder.entries()).map(([folderName, folderFiles]) => ({
        path: folderName,
        files: folderFiles,
      }))
    );
  }, [appendFolders]);

  const handlePasswordSubmit = useCallback(async (pwd: string | null) => {
    const decryptVideo = pendingDecryptVideo;
    const unlockFolder = decryptVideo?.folderPath ?? pendingUnlockFolder;
    setPasswordPromptVisible(false);

    if (pwd && unlockFolder) {
      const meta = useAppStore.getState().metas[unlockFolder];
      if (meta && !CryptoService.verifyPassword(pwd, meta.password_hash)) {
        notify('Invalid password', 'error');
        setPasswordPromptVisible(true);
        return;
      }
      setPasswordForFolder(unlockFolder, pwd);

      const currentVideos = useAppStore.getState().videos;
      const updated = await decryptAllThumbnails(currentVideos, pwd, unlockFolder);
      setVideos(updated);
      setThumbnailsReady(true);
      notify(`Unlocked: ${folderDisplayName(unlockFolder)}`, 'success');

      if (decryptVideo) {
        setPendingDecryptVideo(null);
        setPendingUnlockFolder(null);
        setTimeout(() => decryptSingleVideo(decryptVideo), 100);
        return;
      }
    } else if (!pwd) {
      notify('Password required to access encrypted content', 'info');
    }

    setPendingDecryptVideo(null);
    setPendingUnlockFolder(null);
  }, [pendingDecryptVideo, pendingUnlockFolder, setPasswordForFolder, setVideos, setThumbnailsReady, notify, decryptSingleVideo]);

  const handleVideoDecrypt = useCallback((video: VideoItem) => {
    void decryptSingleVideo(video);
  }, [decryptSingleVideo]);

  const playUnencryptedVideo = useCallback(async (video: VideoItem) => {
    const existing = decryptJobsRef.current[video.id];
    if (existing?.url) {
      setCurrentVideo(video);
      setVideoUrl(existing.url);
      setIsDecrypting(false);
      useAppStore.setState({ currentScreen: 'player' });
      navigate(`/app/view/${encodeURIComponent(video.id)}`);
      return;
    }

    setIsDecrypting(true);
    try {
      const mimeType = CryptoService.getMimeType(video.originalName);
      const { url } = await CryptoService.streamToBlobUrl(
        video.filePath, null, mimeType, readVideoFileChunk,
        (done, total) => {
          const progress = Math.max(1, Math.round((done / total) * 100));
          setDecryptProgress(progress);
        }
      );

      updateDecryptJobs((jobs) =>
        rememberReadyVideo(jobs, video.id, { status: 'ready', progress: 100, url })
      );
      setCurrentVideo(video);
      setVideoUrl(url);
      setIsDecrypting(false);
      useAppStore.setState({ currentScreen: 'player' });
      navigate(`/app/view/${encodeURIComponent(video.id)}`);
    } catch (error) {
      setIsDecrypting(false);
      notify(`Failed to play: ${video.originalName}`, 'error');
    }
  }, [readVideoFileChunk, rememberReadyVideo, setCurrentVideo, setVideoUrl, setIsDecrypting, navigate, notify]);

  const handleVideoPlay = useCallback((video: VideoItem) => {
    if (!video.encrypted) {
      void playUnencryptedVideo(video);
      return;
    }

    // Encrypted content is only playable after it has been decrypted once.
    const job = decryptJobs[video.id];
    if (!job?.url) {
      void decryptSingleVideo(video);
      return;
    }
    setCurrentVideo(video);
    setVideoUrl(job.url);
    setIsDecrypting(false);
    useAppStore.setState({ currentScreen: 'player' });
    navigate(`/app/view/${encodeURIComponent(video.id)}`);
  }, [decryptJobs, decryptSingleVideo, playUnencryptedVideo, setCurrentVideo, setIsDecrypting, setVideoUrl, navigate]);

  // Play the next video after `from` that is already decrypted / cached (or an
  // unencrypted video, which streams on demand), so "auto play next" advances
  // without re-decrypting already-cached content.
  const handlePlayNext = useCallback((from: VideoItem): VideoItem | null => {
    const all = useAppStore.getState().videos;
    const idx = all.findIndex((v) => v.id === from.id);
    if (idx === -1) return null;
    for (let i = idx + 1; i < all.length; i++) {
      const next = all[i];
      const isVideo = next.mediaType === 'encrypted_video' || next.mediaType === 'unencrypted_video';
      if (!isVideo) continue;
      if (!next.encrypted) {
        void playUnencryptedVideo(next);
        return next;
      }
      const job = decryptJobs[next.id];
      if (job?.url) {
        setCurrentVideo(next);
        setVideoUrl(job.url);
        setIsDecrypting(false);
        return next;
      }
    }
    return null;
  }, [decryptJobs, playUnencryptedVideo, setCurrentVideo, setVideoUrl, setIsDecrypting]);

  const handleViewImage = useCallback((video: VideoItem) => {
    const allImages = videos.filter(v =>
      v.mediaType === 'encrypted_image' || v.mediaType === 'unencrypted_image'
    );
    const idx = allImages.findIndex(v => v.id === video.id);
    useAppStore.getState().setImageViewer({ items: allImages, currentIndex: Math.max(0, idx), visible: true });
  }, [videos]);

  const handleClearAllCache = useCallback(() => {
    let clearedCount = 0;
    updateDecryptJobs((jobs) => {
      const nextJobs: Record<string, DecryptJob> = {};
      Object.entries(jobs).forEach(([name, job]) => {
        if (job.url) {
          if (job._cleanup) job._cleanup();
          else URL.revokeObjectURL(job.url);
          clearedCount++;
          return;
        }
        if (job.status === 'decrypting') {
          nextJobs[name] = job;
        }
      });
      return nextJobs;
    });

    readyOrderRef.current = [];
    const playerState = usePlayerStore.getState();
    if (playerState.videoUrl) setVideoUrl(null);
    if (playerState.miniPlayer) {
      URL.revokeObjectURL(playerState.miniPlayer.videoUrl);
      usePlayerStore.getState().setMiniPlayer(null);
    }
    notify(clearedCount ? `Cleared ${clearedCount} from cache.` : 'No cached media to clear.', clearedCount ? 'success' : 'info');
  }, [notify, setVideoUrl, updateDecryptJobs]);

  const collectiveProgress = useMemo(() => {
    const jobs = Object.values(decryptJobs);
    const requested = jobs.length;
    const done = jobs.filter((job) => job.status === 'ready').length;
    const active = jobs.some((job) => job.status === 'decrypting');
    const percent = requested ? Math.round((done / requested) * 100) : 0;
    return { requested, done, active, percent };
  }, [decryptJobs]);

  useEffect(() => {
    decryptJobsRef.current = decryptJobs;
  }, [decryptJobs]);

  useEffect(() => {
    return () => {
      Object.values(decryptJobsRef.current).forEach((job) => {
        if (job.url) {
          if (job._cleanup) job._cleanup();
          else URL.revokeObjectURL(job.url);
        }
      });
    };
  }, []);

  useEffect(() => {
    if (currentScreen !== 'gallery' || unencryptedThumbsGeneratedRef.current) return;
    const unencrypted = videos.filter(v => !v.encrypted && !v.thumbnailUrl);
    if (unencrypted.length === 0) return;
    unencryptedThumbsGeneratedRef.current = true;
    (async () => {
      const patch: Record<string, string> = {};
      for (const video of unencrypted) {
        try {
          const fileData = await readVideoFile(video);
          const bytes = fileData instanceof Uint8Array ? fileData : new Uint8Array(fileData);
          const url = await generateUnencryptedThumbnailFromBuffer(bytes, video.originalName);
          if (url) patch[video.id] = url;
        } catch {}
      }
      const current = useAppStore.getState().videos;
      const updated = current.map(v => patch[v.id] ? { ...v, thumbnailUrl: patch[v.id] } : v);
      setVideos(updated);
    })();
  }, [currentScreen, videos, readVideoFile, setVideos]);

  useEffect(() => {
    const path = location.pathname.replace(/\/app\//, '');
    if (path === 'gallery' && currentScreen !== 'gallery') {
      setCurrentScreen('gallery');
    } else if (path === 'login') {
      if (currentScreen !== 'login') setCurrentScreen('login');
      unencryptedThumbsGeneratedRef.current = false;
    }
  }, [location.pathname]);

  useEffect(() => {
    if (videoId) {
      const video = useAppStore.getState().videos.find(v => v.id === videoId || v.encryptedName === videoId);
      if (video) {
        const job = decryptJobs[video.id];
        if (job?.url) {
          setCurrentVideo(video);
          setVideoUrl(job.url);
          setIsDecrypting(false);
          useAppStore.setState({ currentScreen: 'player' });
        }
      }
    }
  }, [videoId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (currentScreen === 'login') return;
      const target = event.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;
      if (event.key.toLowerCase() === 'l' && !isLocked) {
        event.preventDefault();
        setLocked(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentScreen, isLocked, setLocked]);

  const passwordDescription = useMemo(() => {
    if (pendingDecryptVideo) {
      return `Enter the vault password for "${folderDisplayName(pendingDecryptVideo.folderPath)}" to decrypt "${pendingDecryptVideo.originalName}".`;
    }
    if (pendingUnlockFolder) {
      return `Enter the vault password to unlock "${folderDisplayName(pendingUnlockFolder)}".`;
    }
    return 'Enter the vault password to access encrypted content.';
  }, [pendingDecryptVideo, pendingUnlockFolder]);

  const shellStyle = settingsMaterial === 'mica' || settingsMaterial === 'acrylic'
    ? (() => {
        const tints = materialTints(settingsMaterial, settingsTheme === 'light', settingsMaterialIntensity, settingsBackdropOpacity);
        return {
          ['--material-a' as any]: String(tints.a.toFixed(3)),
          ['--material-b' as any]: String(tints.b.toFixed(3)),
          ['--material-c' as any]: String(tints.c.toFixed(3)),
          ['--mblur' as any]: `${tints.blurPx}px`,
        };
      })()
    : undefined;

  return (
    <div
      className={`app-shell theme-${settingsTheme}${settingsMaterial !== 'solid' ? ` material-${settingsMaterial}` : ''}`}
      data-accent={settingsAccent}
      data-cardsize={settingsCardSize}
      style={shellStyle}
    >
      <CustomScrollbar />
      <div className="material-backdrop" />
      <div className="ambient-shape shape-one" />
      <div className="ambient-shape shape-two" />
      <div className="ambient-shape shape-three" />
      <NotificationStack notifications={notifications} />
      {isLocked && <LockScreen />}
      {currentScreen === 'login' && savedFolderPaths === null && (
        <div className="loading-screen"><div className="loading-spinner" /></div>
      )}
      {currentScreen === 'login' && savedFolderPaths !== null && (
        <LoginScreen
          onNotify={notify}
          savedFolderPaths={savedFolderPaths}
          autoStart={autoStartRef.current}
          onAutoStart={() => { autoStartRef.current = false; }}
          onClearSavedFolders={async () => {
            setSavedFolderPaths([]);
            try {
              if ((window as any).electronAPI?.setStoredFolderPaths) {
                await (window as any).electronAPI.setStoredFolderPaths([]);
              }
              localStorage.removeItem('vault-folder-paths');
              localStorage.removeItem('vault-folder-path');
            } catch (e) {
              console.error('Failed to clear saved folder paths:', e);
            }
          }}
        />
      )}
      {currentScreen === 'gallery' && (
        <VideoGallery
          decryptJobs={decryptJobs}
          collectiveProgress={collectiveProgress}
          theme={settingsTheme}
          folderPaths={folderPaths}
          metas={metas}
          passwords={passwords}
          onUnlockFolder={handleUnlockFolder}
          onLockFolder={handleLockFolder}
          onRemoveFolder={handleRemoveFolder}
          onAddFolders={handleAddFolders}
          onOpenSettings={openSettings}
          onThemeToggle={toggleTheme}
          onVideoDecrypt={handleVideoDecrypt}
          onVideoPlay={handleVideoPlay}
          onVideoClear={clearVideoCache}
          onClearAllCache={handleClearAllCache}
          onViewImage={handleViewImage}
        />
      )}
      {currentScreen === 'settings' && (
        <SettingsScreen
          folderPaths={folderPaths}
          metas={metas}
          passwords={passwords}
          theme={settingsTheme}
          onBack={closeSettings}
          onUnlockFolder={handleUnlockFolder}
          onLockFolder={handleLockFolder}
          onRemoveFolder={handleRemoveFolder}
          onAddFolders={handleAddFolders}
        />
      )}
      {currentScreen === 'player' && (
        <VideoPlayer
          videoUrl={videoUrl}
          currentVideo={currentVideo}
          resumeTime={
            miniPlayer?.currentVideo?.id === currentVideo?.id
              ? miniPlayer?.currentTime
              : undefined
          }
          autoplay={useSettingsStore.getState().autoplay}
          defaultSpeed={useSettingsStore.getState().defaultSpeed}
          autoPlayNext={useSettingsStore.getState().autoPlayNext}
          onPlayNext={handlePlayNext}
        />
      )}
      {miniPlayer && currentScreen !== 'player' && <MiniPlayer data={miniPlayer} />}
      <input
        ref={addFoldersInputRef}
        type="file"
        multiple
        webkitdirectory=""
        style={{ display: 'none' }}
        onChange={handleAddFoldersInput}
      />
      <SubtitleSearchDialog />
      <ImageViewer />
      <PasswordPrompt
        visible={passwordPromptVisible}
        title="Password Required"
        description={passwordDescription}
        onSubmit={handlePasswordSubmit}
      />
      {reloadPending && (
        <div className="reload-overlay" onClick={handleReloadCancel}>
          <div className="reload-dialog" onClick={(e) => e.stopPropagation()}>
            <p className="reload-title">All data will be lost</p>
            <p className="reload-desc">Reloading will clear all loaded files. Continue?</p>
            <div className="reload-buttons">
              <button className="reload-btn reload-btn-cancel" onClick={handleReloadCancel}>Cancel</button>
              <button className="reload-btn reload-btn-confirm" onClick={handleReloadConfirm}>Reload</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const NotificationStack: React.FC<{ notifications: NotificationItem[] }> = ({ notifications }) => (
  <div className="notification-stack" aria-live="polite">
    {notifications.map((item) => (
      <div key={item.id} className={`toast toast-${item.type}`}>
        <span className="toast-dot" />
        <p>{item.message}</p>
      </div>
    ))}
  </div>
);

export default AppContent;