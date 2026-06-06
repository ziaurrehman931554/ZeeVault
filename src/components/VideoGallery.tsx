import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../stores/appStore';
import { usePlayerStore } from '../stores/playerStore';
import VideoCard from './VideoCard';
import { DecryptJob, ThemeMode, VideoItem } from '../types/index';

interface VideoGalleryProps {
  decryptJobs: Record<string, DecryptJob>;
  collectiveProgress: {
    requested: number;
    done: number;
    active: boolean;
    percent: number;
  };
  theme: ThemeMode;
  onThemeToggle: () => void;
  onVideoDecrypt: (video: VideoItem) => void;
  onVideoPlay: (video: VideoItem) => void;
  onVideoClear: (video: VideoItem) => void;
  onClearAllCache: () => void;
}

const VideoGallery: React.FC<VideoGalleryProps> = ({
  decryptJobs,
  collectiveProgress,
  theme,
  onThemeToggle,
  onVideoDecrypt,
  onVideoPlay,
  onVideoClear,
  onClearAllCache,
}) => {
  const navigate = useNavigate();
  const { folderPath, videos } = useAppStore();
  const [search, setSearch] = useState('');
  const [showScrollTop, setShowScrollTop] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 360);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;

      if (event.key.toLowerCase() === 's') {
        event.preventDefault();
        searchRef.current?.focus();
      }

      if (event.key.toLowerCase() === 'c') {
        event.preventDefault();
        onClearAllCache();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClearAllCache]);

  const filteredVideos = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return videos;
    return videos.filter((video) =>
      video.originalName.toLowerCase().includes(query)
    );
  }, [search, videos]);

  const handleLogout = () => {
    Object.values(decryptJobs).forEach((job) => {
      if (job.url) URL.revokeObjectURL(job.url);
    });
    const playerStore = usePlayerStore.getState();
    if (playerStore.miniPlayer) {
      URL.revokeObjectURL(playerStore.miniPlayer.videoUrl);
    }
    playerStore.reset();
    useAppStore.setState({
      currentScreen: 'login',
      folderPath: '',
      password: '',
      metaFile: null,
      videos: [],
      isLoading: false,
      error: null,
      browserFiles: undefined,
    });
    navigate('/app/login');
  };

  const pathParts = folderPath
    .split(/[\\/]+/)
    .filter(Boolean)
    .map((part, index, parts) => {
      if (index === 0 && /^[A-Za-z]:$/.test(part)) return part.replace(':', '://');
      if (index === 0 && /^[A-Za-z]:/.test(part)) return part.replace(':\\', '://');
      return index === parts.length - 1 ? part : part;
    });

  return (
    <div className="gallery-page">
      <header className="topbar">
        <div className="brand-lockup" aria-label="ZeeVault">
          <div className="brand-mark">
            <span>Z</span>
            <span>V</span>
          </div>
          <h1>
            <span>Z</span>ee<span>V</span>ault
          </h1>
        </div>

        <label className="search-box">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M21 21l-4.3-4.3m1.3-5.2a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
          </svg>
          <input
            ref={searchRef}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search videos"
            type="search"
          />
        </label>

        <div className="nav-actions">
          <CircularProgress
            percent={collectiveProgress.percent}
            label={`${collectiveProgress.done}/${collectiveProgress.requested || 0}`}
            active={collectiveProgress.active}
            onClearAllCache={onClearAllCache}
          />
          <button className="icon-button" onClick={onThemeToggle} type="button" title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
            {theme === 'dark' ? (
              <svg viewBox="0 0 24 24" className="theme-icon" aria-hidden="true">
                <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="theme-icon" aria-hidden="true">
                <circle cx="12" cy="12" r="5" />
                <path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
            )}
          </button>
          <button className="logout-button" onClick={handleLogout} type="button">
            <svg viewBox="0 0 24 24" className="logout-icon" aria-hidden="true">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4m7 14l5-5-5-5m5 5H9" />
            </svg>
            Logout
          </button>
        </div>
      </header>

      <main className="gallery-main">
        <div className="path-panel">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 7.5A2.5 2.5 0 015.5 5H10l2 2h6.5A2.5 2.5 0 0121 9.5v7A2.5 2.5 0 0118.5 19h-13A2.5 2.5 0 013 16.5v-9z" />
          </svg>
          <div className="path-crumbs">
            {(pathParts.length ? pathParts : [folderPath]).map((part, index) => (
              <React.Fragment key={`${part}-${index}`}>
                {index > 0 && <span className="path-separator">&gt;</span>}
                <span>{part}</span>
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="gallery-heading">
          <div>
            <p className="eyebrow">Your Videos</p>
            <h2>{filteredVideos.length} videos available</h2>
          </div>
          <p>
            Decrypt a video from its card. When it is ready, press Play to open
            the player.
          </p>
        </div>

        {filteredVideos.length === 0 ? (
          <div className="empty-state">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
            <p>No videos match your search.</p>
          </div>
        ) : (
          <div className="video-grid">
            {filteredVideos.map((video) => (
              <VideoCard
                key={video.encryptedName}
                video={video}
                job={decryptJobs[video.encryptedName]}
                onDecrypt={onVideoDecrypt}
                onPlay={onVideoPlay}
                onClear={onVideoClear}
              />
            ))}
          </div>
        )}
      </main>

      <footer className="footer">
        <div className="brand-lockup compact">
          <div className="brand-mark">
            <span>Z</span>
            <span>V</span>
          </div>
          <strong>
            <span>Z</span>ee<span>V</span>ault
          </strong>
        </div>
        <p>Copyright 2026 ZeeVault. All rights reserved.</p>
        <div className="social-links">
          <a href="https://www.instagram.com/__zee.___/" target="_blank" rel="noreferrer" aria-label="Instagram">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
              <circle cx="12" cy="12" r="5" />
              <circle cx="17.5" cy="6.5" r="1.5" />
            </svg>
          </a>
          <a href="https://github.com/ziaurrehman931554" target="_blank" rel="noreferrer" aria-label="GitHub">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22" />
            </svg>
          </a>
          <a href="https://x.com/@ZiaurRe90691074" target="_blank" rel="noreferrer" aria-label="X">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>
        </div>
      </footer>

      {showScrollTop && (
        <button
          className="scroll-top"
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="Scroll to top"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 5l7 7m-7-7l-7 7m7-7v14" />
          </svg>
        </button>
      )}
    </div>
  );
};

const CircularProgress: React.FC<{
  percent: number;
  label: string;
  active: boolean;
  onClearAllCache: () => void;
}> = ({
  percent,
  label,
  active,
  onClearAllCache,
}) => {
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div
      className={`circle-progress ${active ? 'active' : ''}`}
      onClick={onClearAllCache}
      title="Click to clear cache"
    >
      <svg viewBox="0 0 44 44" aria-hidden="true">
        <circle cx="22" cy="22" r={radius} />
        <circle
          cx="22"
          cy="22"
          r={radius}
          style={{
            strokeDasharray: circumference,
            strokeDashoffset: offset,
          }}
        />
      </svg>
      <span>{label}</span>
      <div className="progress-popover">
        Click to clear cache
      </div>
    </div>
  );
};

export default VideoGallery;
