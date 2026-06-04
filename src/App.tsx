import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from './stores/appStore';
import { usePlayerStore } from './stores/playerStore';
import LoginScreen from './components/LoginScreen';
import VideoGallery from './components/VideoGallery';
import VideoPlayer from './components/VideoPlayer';
import LockScreen from './components/LockScreen';
import { DecryptJob, NotificationItem, ThemeMode, VideoItem } from './types/index';
import { CryptoService } from './services/cryptoService';

const MAX_READY_CACHE = 20;

const App: React.FC = () => {
  const { currentScreen, password, browserFiles, isLocked, setLocked } = useAppStore();
  const { setCurrentVideo, setIsDecrypting, setDecryptProgress, setVideoUrl } =
    usePlayerStore();
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const [decryptJobs, setDecryptJobs] = useState<Record<string, DecryptJob>>({});
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const decryptJobsRef = useRef(decryptJobs);
  const readyOrderRef = useRef<string[]>([]);

  const updateDecryptJobs = useCallback(
    (
      updater:
        | Record<string, DecryptJob>
        | ((jobs: Record<string, DecryptJob>) => Record<string, DecryptJob>)
    ) => {
      setDecryptJobs((jobs) => {
        const nextJobs = typeof updater === 'function' ? updater(jobs) : updater;
        decryptJobsRef.current = nextJobs;
        return nextJobs;
      });
    },
    []
  );

  const notify = useCallback(
    (message: string, type: NotificationItem['type'] = 'info') => {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      setNotifications((items) => [...items, { id, type, message }]);
      window.setTimeout(() => {
        setNotifications((items) => items.filter((item) => item.id !== id));
      }, 4200);
    },
    []
  );

  const readEncryptedVideo = useCallback(
    async (video: VideoItem): Promise<ArrayBuffer | Uint8Array> => {
      if ((window as any).electronAPI?.readFile) {
        return (window as any).electronAPI.readFile(video.filePath);
      }

      if (!browserFiles) {
        throw new Error('No browser file source is available');
      }

      const encryptedFile = Array.from(browserFiles).find((file) => {
        const relativePath = file.webkitRelativePath || file.name;
        return relativePath.endsWith(video.encryptedName);
      });

      if (!encryptedFile) {
        throw new Error(`Encrypted file not found: ${video.encryptedName}`);
      }

      return encryptedFile.arrayBuffer();
    },
    [browserFiles]
  );

  const rememberReadyVideo = useCallback(
    (
      jobs: Record<string, DecryptJob>,
      videoName: string,
      readyJob: DecryptJob
    ) => {
      const nextJobs = { ...jobs };
      const previous = nextJobs[videoName];
      if (previous?.url && previous.url !== readyJob.url) {
        URL.revokeObjectURL(previous.url);
      }

      nextJobs[videoName] = readyJob;
      readyOrderRef.current = readyOrderRef.current.filter((name) => name !== videoName);
      readyOrderRef.current.push(videoName);

      while (readyOrderRef.current.length > MAX_READY_CACHE) {
        const oldestName = readyOrderRef.current.shift();
        if (!oldestName) break;
        const oldestJob = nextJobs[oldestName];
        if (oldestJob?.url) URL.revokeObjectURL(oldestJob.url);
        delete nextJobs[oldestName];
      }

      return nextJobs;
    },
    []
  );

  const clearVideoCache = useCallback(
    (video: VideoItem, silent = false) => {
      updateDecryptJobs((jobs) => {
        const job = jobs[video.encryptedName];
        if (job?.url) URL.revokeObjectURL(job.url);
        readyOrderRef.current = readyOrderRef.current.filter(
          (name) => name !== video.encryptedName
        );
        const nextJobs = { ...jobs };
        delete nextJobs[video.encryptedName];
        return nextJobs;
      });

      const playerState = usePlayerStore.getState();
      if (playerState.currentVideo?.encryptedName === video.encryptedName) {
        setVideoUrl(null);
      }

      if (!silent) notify(`Cleared from cache: ${video.originalName}`, 'success');
    },
    [notify, setVideoUrl, updateDecryptJobs]
  );

  const decryptSingleVideo = useCallback(async (video: VideoItem) => {
    const existing = decryptJobsRef.current[video.encryptedName];
    if (existing?.status === 'decrypting') return;
    if (existing?.status === 'ready') {
      notify('This video is already decrypted.', 'info');
      return;
    }

    setCurrentVideo(video);
    setIsDecrypting(true);
    setDecryptProgress(0);
    updateDecryptJobs((jobs) => ({
      ...jobs,
      [video.encryptedName]: { status: 'decrypting', progress: 1 },
    }));
    notify(`Decrypting ${video.originalName}`, 'info');

    try {
      const encryptedBuffer = await readEncryptedVideo(video);
      const encryptedBytes =
        encryptedBuffer instanceof Uint8Array
          ? encryptedBuffer
          : new Uint8Array(encryptedBuffer);
      const totalSize = encryptedBytes.length;
      let processedSize = 0;
      const decryptedChunks: Uint8Array[] = [];
      const chunkSize = 4 * 1024 * 1024;

      for (const chunk of CryptoService.xorDecryptChunked(
        encryptedBytes,
        password,
        chunkSize
      )) {
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
      const mimeType = CryptoService.getMimeType(video.originalName);
      const url = CryptoService.bufferToBlob(decryptedBuffer, mimeType);

      updateDecryptJobs((jobs) =>
        rememberReadyVideo(jobs, video.encryptedName, {
          status: 'ready',
          progress: 100,
          url,
        })
      );
      setIsDecrypting(false);
      setDecryptProgress(100);
      notify(`Ready to play: ${video.originalName}`, 'success');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to decrypt video';
      setIsDecrypting(false);
      setDecryptProgress(0);
      updateDecryptJobs((jobs) => ({
        ...jobs,
        [video.encryptedName]: { status: 'error', progress: 0, error: message },
      }));
      notify(message, 'error');
    }
  }, [
    notify,
    password,
    readEncryptedVideo,
    rememberReadyVideo,
    setCurrentVideo,
    setDecryptProgress,
    setIsDecrypting,
    updateDecryptJobs,
  ]);

  const handleVideoDecrypt = useCallback(
    (video: VideoItem) => {
      void decryptSingleVideo(video);
    },
    [decryptSingleVideo]
  );

  const handleClearAllCache = useCallback(() => {
    let clearedCount = 0;
    updateDecryptJobs((jobs) => {
      const nextJobs: Record<string, DecryptJob> = {};

      Object.entries(jobs).forEach(([name, job]) => {
        if (job.url) {
          URL.revokeObjectURL(job.url);
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
    if (playerState.videoUrl) {
      setVideoUrl(null);
    }
    notify(
      clearedCount
        ? `Cleared ${clearedCount} decrypted video${clearedCount === 1 ? '' : 's'} from cache.`
        : 'No decrypted videos are currently cached.',
      clearedCount ? 'success' : 'info'
    );
  }, [notify, setVideoUrl, updateDecryptJobs]);

  const handleVideoPlay = useCallback(
    (video: VideoItem) => {
      const job = decryptJobs[video.encryptedName];
      if (!job?.url) {
        notify('Decrypt this video first, then press Play.', 'info');
        return;
      }
      setCurrentVideo(video);
      setVideoUrl(job.url);
      setIsDecrypting(false);
      useAppStore.setState({ currentScreen: 'player' });
    },
    [decryptJobs, notify, setCurrentVideo, setIsDecrypting, setVideoUrl]
  );

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
        if (job.url) URL.revokeObjectURL(job.url);
      });
    };
  }, []);

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
      {currentScreen === 'login' && <LoginScreen onNotify={notify} />}
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
        />
      )}
      {currentScreen === 'player' && <VideoPlayer />}
    </div>
  );
};

const NotificationStack: React.FC<{ notifications: NotificationItem[] }> = ({
  notifications,
}) => (
  <div className="notification-stack" aria-live="polite">
    {notifications.map((item) => (
      <div key={item.id} className={`toast toast-${item.type}`}>
        <span className="toast-dot" />
        <p>{item.message}</p>
      </div>
    ))}
  </div>
);

export default App;
