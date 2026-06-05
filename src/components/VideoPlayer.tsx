import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { VideoItem } from '../types/index';

const formatTime = (seconds: number): string => {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
};

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

interface VideoPlayerProps {
  videoUrl: string | null;
  currentVideo: VideoItem | null;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ videoUrl, currentVideo }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem('player-volume');
    return saved ? parseFloat(saved) : 1;
  });
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [controlsVisible, setControlsVisible] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [buffered, setBuffered] = useState(0);
  const [showThinSeek, setShowThinSeek] = useState(false);
  const [previewTime, setPreviewTime] = useState<number | null>(null);
  const [previewX, setPreviewX] = useState(0);
  const [statusInfo, setStatusInfo] = useState<{ icon: string; text: string } | null>(null);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const { setCurrentScreen } = useAppStore();

  const showStatusInfo = useCallback((icon: string, text: string) => {
    setStatusInfo({ icon, text });
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    statusTimerRef.current = setTimeout(() => setStatusInfo(null), 1200);
  }, []);

  const video = videoRef.current;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedProgress = duration > 0 ? (buffered / duration) * 100 : 0;

  const showControls = useCallback(() => {
    setControlsVisible(true);
    setShowThinSeek(false);
    if (controlsTimerRef.current) {
      clearTimeout(controlsTimerRef.current);
      controlsTimerRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    if (controlsTimerRef.current) {
      clearTimeout(controlsTimerRef.current);
      controlsTimerRef.current = null;
    }
    if (!video?.paused) {
      controlsTimerRef.current = setTimeout(() => {
        setControlsVisible(false);
        setShowThinSeek(true);
        setShowSettings(false);
        setShowVolumeSlider(false);
        controlsTimerRef.current = null;
      }, 3000);
    }
  }, [video]);

  const handleMouseMove = useCallback(() => {
    showControls();
    scheduleHide();
  }, [showControls, scheduleHide]);

  const handleMouseLeave = useCallback(() => {
    if (!video?.paused) {
      setControlsVisible(false);
      setShowThinSeek(true);
      setShowSettings(false);
      setShowVolumeSlider(false);
    }
  }, [video]);

  const togglePlay = useCallback(() => {
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => undefined);
      showStatusInfo('play', 'Play');
    } else {
      video.pause();
      showStatusInfo('pause', 'Pause');
    }
  }, [video, showStatusInfo]);

  const skip = useCallback((seconds: number) => {
    if (!video) return;
    const dur = video.duration || 0;
    const newTime = Math.max(0, Math.min(dur, video.currentTime + seconds));
    video.currentTime = newTime;
    const icon = seconds > 0 ? 'forward' : 'backward';
    showStatusInfo(icon, `${seconds > 0 ? '+' : ''}${seconds}s  ${formatTime(newTime)} / ${formatTime(dur)}`);
  }, [video, showStatusInfo]);

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!video || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    video.currentTime = percent * duration;
  }, [video, duration]);

  const handleSeekPreview = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    setPreviewTime(percent * duration);
    setPreviewX(x);
  }, [duration]);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    setIsMuted(val === 0);
    if (video) {
      video.volume = val;
      video.muted = val === 0;
    }
    localStorage.setItem('player-volume', String(val));
    showStatusInfo('volume', `${Math.round(val * 100)}%`);
  }, [video, showStatusInfo]);

  const toggleMute = useCallback(() => {
    if (!video) return;
    if (video.volume === 0) {
      video.volume = 0.5;
      video.muted = false;
      setVolume(0.5);
      setIsMuted(false);
      showStatusInfo('unmute', 'Unmuted');
    } else {
      video.muted = !video.muted;
      setIsMuted(video.muted);
      showStatusInfo(video.muted ? 'mute' : 'unmute', video.muted ? 'Muted' : 'Unmuted');
    }
  }, [video, showStatusInfo]);

  const togglePiP = useCallback(async () => {
    if (!video) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await video.requestPictureInPicture();
      }
    } catch { /* not supported */ }
  }, [video]);

  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await containerRef.current.requestFullscreen();
      }
    } catch { /* not supported */ }
  }, []);

  const handleSpeedChange = useCallback((speed: number) => {
    if (video) video.playbackRate = speed;
    setPlaybackRate(speed);
    setShowSettings(false);
    showStatusInfo('speed', `${speed}x`);
  }, [video, showStatusInfo]);

  const closePlayer = useCallback(() => {
    if (!useAppStore.getState().isLocked) {
      setCurrentScreen('gallery');
    }
  }, [setCurrentScreen]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    if (el.readyState >= 2) {
      setIsLoading(false);
      if (!el.paused) setIsPlaying(true);
    }

    const onTimeUpdate = () => { setCurrentTime(el.currentTime); };
    const onDurationChange = () => { setDuration(el.duration || 0); };
    const onPlay = () => { setIsPlaying(true); setIsLoading(false); showControls(); scheduleHide(); };
    const onPause = () => { setIsPlaying(false); showControls(); if (controlsTimerRef.current) { clearTimeout(controlsTimerRef.current); controlsTimerRef.current = null; } };
    const onWaiting = () => { setIsLoading(true); };
    const onCanPlay = () => { setIsLoading(false); };
    const onProgress = () => {
      if (el.buffered.length > 0) {
        setBuffered(el.buffered.end(el.buffered.length - 1));
      }
    };
    const onVolumeChange = () => {
      setVolume(el.volume);
      setIsMuted(el.muted || el.volume === 0);
    };
    const onRateChange = () => { setPlaybackRate(el.playbackRate); };
    const onFullscreenChange = () => { setIsFullscreen(!!document.fullscreenElement); };
    const onError = () => { setIsLoading(false); };

    el.addEventListener('timeupdate', onTimeUpdate);
    el.addEventListener('durationchange', onDurationChange);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    el.addEventListener('waiting', onWaiting);
    el.addEventListener('canplay', onCanPlay);
    el.addEventListener('progress', onProgress);
    el.addEventListener('volumechange', onVolumeChange);
    el.addEventListener('ratechange', onRateChange);
    el.addEventListener('error', onError);
    document.addEventListener('fullscreenchange', onFullscreenChange);

    el.volume = volume;
    el.muted = isMuted;

    return () => {
      el.removeEventListener('timeupdate', onTimeUpdate);
      el.removeEventListener('durationchange', onDurationChange);
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('waiting', onWaiting);
      el.removeEventListener('canplay', onCanPlay);
      el.removeEventListener('progress', onProgress);
      el.removeEventListener('volumechange', onVolumeChange);
      el.removeEventListener('ratechange', onRateChange);
      el.removeEventListener('error', onError);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
    };
  }, [volume, isMuted, showControls, scheduleHide, videoUrl]);

  useEffect(() => {
    if (videoUrl) {
      const video = videoRef.current;
      if (video) {
        video.load();
        video.play().catch(() => undefined);
      }
      setCurrentTime(0);
      setDuration(0);
      setShowThinSeek(false);
      setControlsVisible(true);
      setIsLoading(true);
      if (controlsTimerRef.current) {
        clearTimeout(controlsTimerRef.current);
        controlsTimerRef.current = null;
      }
    }
  }, [videoUrl]);

  useEffect(() => {
    if (!videoUrl) return;
    const timer = setTimeout(() => setIsLoading(false), 10000);
    return () => clearTimeout(timer);
  }, [videoUrl]);

  useEffect(() => {
    return () => {
      if (controlsTimerRef.current) {
        clearTimeout(controlsTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;

      if (event.code === 'Space') {
        event.preventDefault();
        togglePlay();
      }
      if (event.key === 'Escape') {
        if (showSettings) { setShowSettings(false); return; }
        if (showVolumeSlider) { setShowVolumeSlider(false); return; }
        if (document.fullscreenElement) { document.exitFullscreen(); return; }
        if (!useAppStore.getState().isLocked) {
          setCurrentScreen('gallery');
        }
      }
      if (event.key === 'ArrowLeft') { event.preventDefault(); skip(-10); }
      if (event.key === 'ArrowRight') { event.preventDefault(); skip(10); }
      if (event.key === 'ArrowUp') { event.preventDefault(); handleVolumeChange({ target: { value: String(Math.min(1, volume + 0.1)) } } as any); }
      if (event.key === 'ArrowDown') { event.preventDefault(); handleVolumeChange({ target: { value: String(Math.max(0, volume - 0.1)) } } as any); }
      if (event.key.toLowerCase() === 'm') { event.preventDefault(); toggleMute(); }
      if (event.key.toLowerCase() === 'f') { event.preventDefault(); toggleFullscreen(); }
      if (event.key === '.') { event.preventDefault(); const idx = SPEEDS.indexOf(playbackRate); if (idx < SPEEDS.length - 1) handleSpeedChange(SPEEDS[idx + 1]); }
      if (event.key === ',') { event.preventDefault(); const idx = SPEEDS.indexOf(playbackRate); if (idx > 0) handleSpeedChange(SPEEDS[idx - 1]); }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [togglePlay, skip, toggleMute, toggleFullscreen, playbackRate, handleSpeedChange, handleVolumeChange, volume, setCurrentScreen, showSettings, showVolumeSlider]);

  const volumeIcon = useMemo(() => {
    const v = isMuted ? 0 : volume;
    if (v === 0) {
      return <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 8.5v5a4.47 4.47 0 002.5-1.5zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />;
    }
    if (v < 0.5) {
      return <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 8.5v5a4.47 4.47 0 002.5-1.5z" />;
    }
    return <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 8.5v5a4.47 4.47 0 002.5-1.5zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />;
  }, [volume, isMuted]);

  const formatTimeDisplay = useMemo(() => formatTime(currentTime), [currentTime]);
  const formatDuration = useMemo(() => formatTime(duration), [duration]);
  const formatPreview = useMemo(() => previewTime !== null ? formatTime(previewTime) : '', [previewTime]);

  return (
    <div
      ref={containerRef}
      className="player-page custom-player"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <video
        ref={videoRef}
        className="video-element"
        src={videoUrl || undefined}
        preload="auto"
        autoPlay
        muted
        playsInline
        onClick={togglePlay}
      />

      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner" />
        </div>
      )}

      <div
        className={`controls-overlay${controlsVisible ? ' visible' : ''}`}
        onClick={togglePlay}
      >
        <div className="top-bar" onClick={(e) => e.stopPropagation()}>
          <button className="ctrl-btn close-btn" onClick={closePlayer} title="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
          <div className="title-wrap">
            <span>{currentVideo?.originalName}</span>
          </div>
          <div className="top-right">
            <div className="volume-wrap">
              <div className="volume-slider-horizontal">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="volume-slider"
                  aria-label="Volume"
                  style={{ background: `linear-gradient(to right, var(--accent, #38bdf8) ${(isMuted ? 0 : volume) * 100}%, rgba(255,255,255,0.2) ${(isMuted ? 0 : volume) * 100}%)` }}
                />
              </div>
              <button className="ctrl-btn" onClick={toggleMute} title="Mute">
                <svg viewBox="0 0 24 24" fill="currentColor">{volumeIcon}</svg>
              </button>
            </div>
            <button className="ctrl-btn" onClick={togglePiP} title="Picture in Picture">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <rect x="11" y="10" width="9" height="7" rx="1" />
              </svg>
            </button>
          </div>
        </div>

        <div className="center-controls" onClick={(e) => e.stopPropagation()}>
          <button className="ctrl-btn ctrl-btn-lg" onClick={() => skip(-10)} title="Backward 10s">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M12.5 8c-2.65 0-4.05.99-5.5 2.17L4.5 8v6h6l-2.67-2.22C7.83 10.22 9.15 9.5 11 9.5c2.54 0 4.42 1.58 5.5 3.5l1.5-.75C16.5 9.75 14.15 8 12.5 8z" />
            </svg>
            <span className="skip-label">10</span>
          </button>
          <button className="ctrl-btn ctrl-btn-play" onClick={togglePlay} title={isPlaying ? 'Pause' : 'Play'}>
            {isPlaying ? (
              <svg viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
          <button className="ctrl-btn ctrl-btn-lg" onClick={() => skip(10)} title="Forward 10s">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M11.5 8c2.65 0 4.05.99 5.5 2.17L19.5 8v6h-6l2.67-2.22C16.17 10.22 14.85 9.5 13 9.5c-2.54 0-4.42 1.58-5.5 3.5l-1.5-.75C7.5 9.75 9.85 8 11.5 8z" />
            </svg>
            <span className="skip-label">10</span>
          </button>
        </div>

        <div className="bottom-bar" onClick={(e) => e.stopPropagation()}>
          <span className="time-display">{formatTimeDisplay}</span>
          <div
            className="seek-track"
            onClick={handleSeek}
            onMouseMove={handleSeekPreview}
            onMouseLeave={() => setPreviewTime(null)}
          >
            <div className="seek-buffered" style={{ width: `${bufferedProgress}%` }} />
            <div className="seek-played" style={{ width: `${progress}%` }} />
            <div className="seek-thumb" style={{ left: `${progress}%` }} />
            {previewTime !== null && (
              <div className="seek-preview" style={{ left: `${previewX}px` }}>
                <span>{formatPreview}</span>
              </div>
            )}
          </div>
          <span className="time-display">{formatDuration}</span>
          <div className="settings-wrap">
            <button className="ctrl-btn" onClick={() => { setShowSettings(!showSettings); setShowVolumeSlider(false); }} title="Settings">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
              </svg>
            </button>
            {showSettings && (
              <div className="settings-menu">
                <div className="settings-title">Playback Speed</div>
                {SPEEDS.map((speed) => (
                  <button
                    key={speed}
                    className={`settings-item${playbackRate === speed ? ' active' : ''}`}
                    onClick={() => handleSpeedChange(speed)}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className="ctrl-btn fullscreen-btn" onClick={toggleFullscreen} title="Fullscreen">
            {isFullscreen ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3m0 18v-3a2 2 0 012-2h3M3 16h3a2 2 0 012 2v3" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {statusInfo && (
        <div className="status-indicator">
          <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
            {statusInfo.icon === 'play' && <path d="M8 5v14l11-7z" />}
            {statusInfo.icon === 'pause' && <><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></>}
            {statusInfo.icon === 'mute' && <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 8.5v5a4.47 4.47 0 002.5-1.5zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />}
            {statusInfo.icon === 'unmute' && <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 8.5v5a4.47 4.47 0 002.5-1.5z" />}
            {statusInfo.icon === 'forward' && <path d="M11.5 8c2.65 0 4.05.99 5.5 2.17L19.5 8v6h-6l2.67-2.22C16.17 10.22 14.85 9.5 13 9.5c-2.54 0-4.42 1.58-5.5 3.5l-1.5-.75C7.5 9.75 9.85 8 11.5 8z" />}
            {statusInfo.icon === 'backward' && <path d="M12.5 8c-2.65 0-4.05.99-5.5 2.17L4.5 8v6h6l-2.67-2.22C7.83 10.22 9.15 9.5 11 9.5c2.54 0 4.42 1.58 5.5 3.5l1.5-.75C16.5 9.75 14.15 8 12.5 8z" />}
          </svg>
          <span>{statusInfo.text}</span>
        </div>
      )}

      <div className={`thin-seek${showThinSeek ? ' visible' : ''}`}>
        <div className="thin-seek-played" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
};

export default VideoPlayer;
