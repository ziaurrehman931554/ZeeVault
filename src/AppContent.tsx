import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAppStore } from './stores/appStore';
import { usePlayerStore } from './stores/playerStore';
import LoginScreen from './components/LoginScreen';
import VideoGallery from './components/VideoGallery';
import VideoPlayer from './components/VideoPlayer';
import MiniPlayer from './components/MiniPlayer';
import LockScreen from './components/LockScreen';
import ImageViewer from './components/ImageViewer';
import PasswordPrompt from './components/PasswordPrompt';
import { DecryptJob, NotificationItem, ThemeMode, VideoItem } from './types/index';
import { MediaScanner } from './services/mediaScanner';
import { CryptoService } from './services/cryptoService';
import { createMseBlob } from './services/tsTransmuxer';
import { decryptAllThumbnails, generateUnencryptedThumbnailFromBuffer } from './services/thumbnailManager';

const MAX_READY_CACHE = 20;

const AppContent: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { encryptedName: routeVideoName } = useParams<{ encryptedName: string }>();
  const {
    currentScreen, password, browserFiles, isLocked, videos, hasEncryptedContent,
    setLocked, setCurrentScreen, setPassword, setVideos, setThumbnailsReady,
    setHasEncryptedContent,
  } = useAppStore();
  const { currentVideo, videoUrl, miniPlayer, setCurrentVideo, setIsDecrypting, setDecryptProgress, setVideoUrl } = usePlayerStore();
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const [savedFolderPath, setSavedFolderPath] = useState<string | null>(null);

  useEffect(() => {
    // Browser mode: always show login, no persistent storage
    if (!(window as any).electronAPI) {
      setSavedFolderPath('');
      return;
    }

    let cancelled = false;
    (async () => {
      let p: string | null = null;
      try {
        p = await (window as any).electronAPI.getStoredFolderPath();
        if (!p) {
          try { p = localStorage.getItem('vault-folder-path'); } catch {}
        }
      } catch {}

      if (p) {
        try {
          let pathValid = false;
          try { pathValid = await (window as any).electronAPI.checkPath(p); } catch {}

          if (!pathValid) {
            try {
              if ((window as any).electronAPI?.setStoredFolderPath) {
                await (window as any).electronAPI.setStoredFolderPath('');
              }
              localStorage.removeItem('vault-folder-path');
            } catch {}
            setSavedFolderPath('');
            return;
          }

          const metaContent = await MediaScanner.readMetaContent(p);
          let encryptedVideos: any[] = [];
          let metaFile = null;
          let hasEncrypted = false;

          if (metaContent) {
            metaFile = MediaScanner.parseMeta(metaContent);
            if (MediaScanner.isValidMetaFile(metaFile)) {
              hasEncrypted = true;
              encryptedVideos = MediaScanner.metaToEncryptedVideos(metaFile, p);
            }
          }

          const scannedFiles = await MediaScanner.scanFolderFiles(p);
          const unencryptedVideos = MediaScanner.scannedToUnencryptedVideos(scannedFiles, p);
          const allVideos = MediaScanner.mergeMedia(encryptedVideos, unencryptedVideos);

          if (!cancelled) {
            useAppStore.setState({
              folderPath: p,
              metaFile,
              videos: allVideos,
              hasEncryptedContent: hasEncrypted,
              currentScreen: 'gallery',
            });
          }

          if ((window as any).electronAPI?.setStoredFolderPath) {
            await (window as any).electronAPI.setStoredFolderPath(p);
          } else {
            localStorage.setItem('vault-folder-path', p);
          }

          if (!cancelled) {
            navigate('/app/gallery', { replace: true });
            setSavedFolderPath('');
          }
          return;
        } catch {}
      }

      if (!cancelled) setSavedFolderPath(p ?? '');
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
  const [galleryPasswordPromptVisible, setGalleryPasswordPromptVisible] = useState(false);
  const [galleryPasswordDismissed, setGalleryPasswordDismissed] = useState(false);
  const decryptJobsRef = useRef(decryptJobs);
  const readyOrderRef = useRef<string[]>([]);
  const unencryptedThumbsGeneratedRef = useRef(false);

  const updateDecryptJobs = useCallback(
    (updater: Record<string, DecryptJob> | ((jobs: Record<string, DecryptJob>) => Record<string, DecryptJob>)) => {
      setDecryptJobs((jobs) => {
        const nextJobs = typeof updater === 'function' ? updater(jobs) : updater;
        decryptJobsRef.current = nextJobs;
        return nextJobs;
      });
    }, []
  );

  const notify = useCallback(
    (message: string, type: NotificationItem['type'] = 'info') => {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      setNotifications((items) => [...items, { id, type, message }]);
      window.setTimeout(() => {
        setNotifications((items) => items.filter((item) => item.id !== id));
      }, 4200);
    }, []
  );

  const readVideoFile = useCallback(
    async (video: VideoItem): Promise<ArrayBuffer | Uint8Array> => {
      if ((window as any).electronAPI?.readFile) {
        return (window as any).electronAPI.readFile(video.filePath);
      }

      if (!browserFiles) {
        throw new Error('No browser file source is available');
      }

      const targetFile = Array.from(browserFiles).find((file) => {
        const relativePath = file.webkitRelativePath || file.name;
        return relativePath.endsWith(video.encryptedName);
      });

      if (!targetFile) {
        throw new Error(`File not found: ${video.originalName}`);
      }

      return targetFile.arrayBuffer();
    }, [browserFiles]
  );

  const rememberReadyVideo = useCallback(
    (jobs: Record<string, DecryptJob>, videoName: string, readyJob: DecryptJob) => {
      const nextJobs = { ...jobs };
      const previous = nextJobs[videoName];
      if (previous?.url && previous.url !== readyJob.url) {
        if (previous._cleanup) previous._cleanup();
        else URL.revokeObjectURL(previous.url);
      }

      nextJobs[videoName] = readyJob;
      readyOrderRef.current = readyOrderRef.current.filter((name) => name !== videoName);
      readyOrderRef.current.push(videoName);

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
        const job = jobs[video.encryptedName];
        if (job?.url) {
          if (job._cleanup) job._cleanup();
          else URL.revokeObjectURL(job.url);
        }
        readyOrderRef.current = readyOrderRef.current.filter((name) => name !== video.encryptedName);
        const nextJobs = { ...jobs };
        delete nextJobs[video.encryptedName];
        return nextJobs;
      });

      const playerState = usePlayerStore.getState();
      if (playerState.currentVideo?.encryptedName === video.encryptedName) {
        setVideoUrl(null);
      }

      if (!silent) notify(`Cleared from cache: ${video.originalName}`, 'success');
    }, [notify, setVideoUrl, updateDecryptJobs]
  );

  const decryptSingleVideo = useCallback(async (video: VideoItem) => {
    const existing = decryptJobsRef.current[video.encryptedName];
    if (existing?.status === 'decrypting') return;
    if (existing?.status === 'ready') {
      notify('This media is already decrypted.', 'info');
      return;
    }

    const currentPassword = useAppStore.getState().password;

    if (video.encrypted && !currentPassword) {
      setPendingDecryptVideo(video);
      setPasswordPromptVisible(true);
      return;
    }

    setCurrentVideo(video);
    setIsDecrypting(true);
    setDecryptProgress(0);
    updateDecryptJobs((jobs) => ({
      ...jobs,
      [video.encryptedName]: { status: 'decrypting', progress: 0 },
    }));
    notify(`Processing ${video.originalName}`, 'info');

    try {
      const fileBuffer = await readVideoFile(video);
      const fileBytes = fileBuffer instanceof Uint8Array ? fileBuffer : new Uint8Array(fileBuffer);

      if (!video.encrypted) {
        const mimeType = CryptoService.getMimeType(video.originalName);
        const url = CryptoService.bufferToBlob(fileBytes, mimeType);
        updateDecryptJobs((jobs) =>
          rememberReadyVideo(jobs, video.encryptedName, { status: 'ready', progress: 100, url })
        );
        setIsDecrypting(false);
        setDecryptProgress(100);
        notify(`Ready: ${video.originalName}`, 'success');

        if (video.mediaType === 'unencrypted_video') {
          setVideoUrl(url);
          useAppStore.setState({ currentScreen: 'player' });
          navigate(`/app/view/${encodeURIComponent(video.encryptedName)}`);
        }
        return;
      }

      const totalSize = fileBytes.length;
      let processedSize = 0;
      const decryptedChunks: Uint8Array[] = [];
      const chunkSize = 4 * 1024 * 1024;

      for (const chunk of CryptoService.xorDecryptChunked(fileBytes, currentPassword!, chunkSize)) {
        decryptedChunks.push(chunk);
        processedSize += chunk.length;
        const progress = Math.max(1, Math.round((processedSize / totalSize) * 100));
        setDecryptProgress(progress);
        updateDecryptJobs((jobs) => ({
          ...jobs,
          [video.encryptedName]: { status: 'decrypting', progress },
        }));
        await new Promise((resolve) => window.setTimeout(resolve, 0));
      }

      const decryptedBuffer = new Uint8Array(totalSize);
      let offset = 0;
      for (const chunk of decryptedChunks) {
        decryptedBuffer.set(chunk, offset);
        offset += chunk.length;
      }

      const isImage = video.mediaType === 'encrypted_image';
      if (!isImage && video.extension === 'ts') {
        try {
          const { url, cleanup } = await createMseBlob(decryptedBuffer);
          updateDecryptJobs((jobs) =>
            rememberReadyVideo(jobs, video.encryptedName, { status: 'ready', progress: 100, url, _cleanup: cleanup })
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          updateDecryptJobs((jobs) => ({
            ...jobs,
            [video.encryptedName]: { status: 'error', progress: 0, error: msg },
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
          rememberReadyVideo(jobs, video.encryptedName, { status: 'ready', progress: 100, url })
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
        const idx = allImages.findIndex(v => v.encryptedName === video.encryptedName);
        useAppStore.getState().setImageViewer({ items: allImages, currentIndex: Math.max(0, idx), visible: true });
      } else {
        const url = decryptJobsRef.current[video.encryptedName]?.url;
        if (url) {
          setVideoUrl(url);
          useAppStore.setState({ currentScreen: 'player' });
          navigate(`/app/view/${encodeURIComponent(video.encryptedName)}`);
        }
      }

    } catch (error) {
      const message = error instanceof Error ? error.message : `Failed to process ${video.originalName}`;
      setIsDecrypting(false);
      setDecryptProgress(0);
      updateDecryptJobs((jobs) => ({
        ...jobs,
        [video.encryptedName]: { status: 'error', progress: 0, error: message },
      }));
      notify(message, 'error');
    }
  }, [notify, password, readVideoFile, rememberReadyVideo, setCurrentVideo, setDecryptProgress, setIsDecrypting, updateDecryptJobs, setVideoUrl, navigate]);

  const handleGalleryPasswordSubmit = useCallback(async (pwd: string | null) => {
    setGalleryPasswordPromptVisible(false);

    if (pwd) {
      const metaFile = useAppStore.getState().metaFile;
      if (metaFile && !CryptoService.verifyPassword(pwd, metaFile.password_hash)) {
        notify('Invalid password', 'error');
        return;
      }
      setPassword(pwd);
      setHasEncryptedContent(true);

      const currentVideos = useAppStore.getState().videos;
      const updated = await decryptAllThumbnails(currentVideos, pwd);
      setVideos(updated);
      setThumbnailsReady(true);
      notify('Password accepted. Thumbnails unlocked.', 'success');
    } else {
      setGalleryPasswordDismissed(true);
      notify('You can enter the password later to unlock encrypted content.', 'info');
    }
  }, [setPassword, setHasEncryptedContent, setVideos, setThumbnailsReady, notify]);

  useEffect(() => {
    if (currentScreen === 'gallery' && hasEncryptedContent && !password && !galleryPasswordPromptVisible && !galleryPasswordDismissed) {
      setGalleryPasswordPromptVisible(true);
    }
  }, [currentScreen, hasEncryptedContent, password, galleryPasswordPromptVisible, galleryPasswordDismissed]);

  const handlePasswordForDecrypt = useCallback(async (pwd: string | null) => {
    setPasswordPromptVisible(false);
    if (pwd && pendingDecryptVideo) {
      const metaFile = useAppStore.getState().metaFile;
      if (metaFile && !CryptoService.verifyPassword(pwd, metaFile.password_hash)) {
        notify('Invalid password', 'error');
        setPendingDecryptVideo(null);
        return;
      }
      setPassword(pwd);
      setHasEncryptedContent(true);

      const currentVideos = useAppStore.getState().videos;
      const updated = await decryptAllThumbnails(currentVideos, pwd);
      setVideos(updated);
      setThumbnailsReady(true);

      setPendingDecryptVideo(null);
      const videoToDecrypt = pendingDecryptVideo;
      setTimeout(() => decryptSingleVideo(videoToDecrypt), 100);
    } else {
      setPendingDecryptVideo(null);
      notify('Password required to decrypt encrypted content', 'info');
    }
  }, [pendingDecryptVideo, setPassword, setHasEncryptedContent, setVideos, setThumbnailsReady, notify, decryptSingleVideo]);

  const handleVideoDecrypt = useCallback((video: VideoItem) => {
    void decryptSingleVideo(video);
  }, [decryptSingleVideo]);

  const playUnencryptedVideo = useCallback(async (video: VideoItem) => {
    const existing = decryptJobsRef.current[video.encryptedName];
    if (existing?.url) {
      setCurrentVideo(video);
      setVideoUrl(existing.url);
      setIsDecrypting(false);
      useAppStore.setState({ currentScreen: 'player' });
      navigate(`/app/view/${encodeURIComponent(video.encryptedName)}`);
      return;
    }

    setIsDecrypting(true);
    try {
      const fileBuffer = await readVideoFile(video);
      const fileBytes = fileBuffer instanceof Uint8Array ? fileBuffer : new Uint8Array(fileBuffer);
      const mimeType = CryptoService.getMimeType(video.originalName);
      const url = CryptoService.bufferToBlob(fileBytes, mimeType);

      updateDecryptJobs((jobs) =>
        rememberReadyVideo(jobs, video.encryptedName, { status: 'ready', progress: 100, url })
      );
      setCurrentVideo(video);
      setVideoUrl(url);
      setIsDecrypting(false);
      useAppStore.setState({ currentScreen: 'player' });
      navigate(`/app/view/${encodeURIComponent(video.encryptedName)}`);
    } catch (error) {
      setIsDecrypting(false);
      notify(`Failed to play: ${video.originalName}`, 'error');
    }
  }, [readVideoFile, rememberReadyVideo, setCurrentVideo, setVideoUrl, setIsDecrypting, navigate, notify]);

  const handleVideoPlay = useCallback((video: VideoItem) => {
    if (!video.encrypted) {
      void playUnencryptedVideo(video);
      return;
    }

    const job = decryptJobs[video.encryptedName];
    if (!job?.url) {
      notify('Decrypt this video first, then press Play.', 'info');
      return;
    }
    setCurrentVideo(video);
    setVideoUrl(job.url);
    setIsDecrypting(false);
    useAppStore.setState({ currentScreen: 'player' });
    navigate(`/app/view/${encodeURIComponent(video.encryptedName)}`);
  }, [decryptJobs, notify, setCurrentVideo, setIsDecrypting, setVideoUrl, navigate, playUnencryptedVideo]);

  const handleViewImage = useCallback((video: VideoItem) => {
    const allImages = videos.filter(v =>
      v.mediaType === 'encrypted_image' || v.mediaType === 'unencrypted_image'
    );
    const idx = allImages.findIndex(v => v.encryptedName === video.encryptedName);
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

  const toggleTheme = () => setTheme((mode) => (mode === 'dark' ? 'light' : 'dark'));

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
          if (url) patch[video.encryptedName] = url;
        } catch {}
      }
      const current = useAppStore.getState().videos;
      const updated = current.map(v => patch[v.encryptedName] ? { ...v, thumbnailUrl: patch[v.encryptedName] } : v);
      setVideos(updated);
    })();
  }, [currentScreen, videos, readVideoFile, setVideos]);

  useEffect(() => {
    const path = location.pathname.replace(/\/app\//, '');
    if (path === 'gallery' && currentScreen !== 'gallery') {
      setCurrentScreen('gallery');
    } else if (path === 'login' && currentScreen !== 'login') {
      setCurrentScreen('login');
      unencryptedThumbsGeneratedRef.current = false;
    }
  }, [location.pathname]);

  useEffect(() => {
    if (routeVideoName) {
      const video = useAppStore.getState().videos.find(v => v.encryptedName === routeVideoName);
      if (video) {
        const job = decryptJobs[video.encryptedName];
        if (job?.url) {
          setCurrentVideo(video);
          setVideoUrl(job.url);
          setIsDecrypting(false);
          useAppStore.setState({ currentScreen: 'player' });
        }
      }
    }
  }, [routeVideoName]);

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

  return (
    <div className={`app-shell theme-${theme}`}>
      <div className="ambient-shape shape-one" />
      <div className="ambient-shape shape-two" />
      <div className="ambient-shape shape-three" />
      <NotificationStack notifications={notifications} />
      {isLocked && <LockScreen />}
      {currentScreen === 'login' && savedFolderPath === null && (
        <div className="loading-screen"><div className="loading-spinner" /></div>
      )}
      {currentScreen === 'login' && savedFolderPath !== null && (
        <LoginScreen
          onNotify={notify}
          savedFolderPath={savedFolderPath}
          onClearSavedFolder={async () => {
            setSavedFolderPath('');
            try {
              if ((window as any).electronAPI?.setStoredFolderPath) {
                await (window as any).electronAPI.setStoredFolderPath('');
              }
              localStorage.removeItem('vault-folder-path');
            } catch (e) {
              console.error('Failed to clear saved folder path:', e);
            }
          }}
        />
      )}
      {currentScreen === 'gallery' && (
        <VideoGallery
          decryptJobs={decryptJobs}
          collectiveProgress={collectiveProgress}
          theme={theme}
          onThemeToggle={toggleTheme}
          onVideoDecrypt={handleVideoDecrypt}
          onVideoPlay={handleVideoPlay}
          onVideoClear={clearVideoCache}
          onClearAllCache={handleClearAllCache}
          onViewImage={handleViewImage}
        />
      )}
      {currentScreen === 'player' && <VideoPlayer videoUrl={videoUrl} currentVideo={currentVideo} resumeTime={miniPlayer?.currentTime} />}
      {miniPlayer && currentScreen !== 'player' && <MiniPlayer data={miniPlayer} />}
      <ImageViewer />
      <PasswordPrompt
        visible={passwordPromptVisible}
        title="Password Required"
        description="Enter the vault password to decrypt this content."
        onSubmit={handlePasswordForDecrypt}
      />
      <PasswordPrompt
        visible={galleryPasswordPromptVisible}
        title="Encrypted Content Found"
        description="This folder contains encrypted media. Enter the vault password to unlock thumbnails and playback, or skip to browse unencrypted files only."
        onSubmit={handleGalleryPasswordSubmit}
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
