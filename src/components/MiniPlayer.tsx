import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MiniPlayerData, usePlayerStore } from '../stores/playerStore';
import { useAppStore } from '../stores/appStore';
import { formatTime } from './VideoPlayer';

interface MiniPlayerProps {
  data: MiniPlayerData;
}

const MiniPlayer: React.FC<MiniPlayerProps> = ({ data }) => {
  const [hovered, setHovered] = useState(false);
  const [titleOverflows, setTitleOverflows] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const titleRef = useRef<HTMLSpanElement>(null);
  const titleWrapRef = useRef<HTMLDivElement>(null);
  const { setCurrentVideo, setVideoUrl, setMiniPlayer } = usePlayerStore();
  const { setCurrentScreen } = useAppStore();

  useEffect(() => {
    const title = titleRef.current;
    const wrap = titleWrapRef.current;
    if (title && wrap) {
      setTitleOverflows(title.scrollWidth > wrap.clientWidth);
    }
  }, [data.currentVideo.originalName]);

  const duration = data.duration || 0;

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const onLoaded = () => {
      if (data.currentTime > 0) {
        el.currentTime = data.currentTime;
      }
    };
    el.addEventListener('loadedmetadata', onLoaded);
    return () => el.removeEventListener('loadedmetadata', onLoaded);
  }, [data.currentTime]);

  const progress = duration > 0 ? (data.currentTime / duration) * 100 : 0;

  const openPlayer = useCallback(() => {
    setCurrentVideo(data.currentVideo);
    setVideoUrl(data.videoUrl);
    setCurrentScreen('player');
    queueMicrotask(() => setMiniPlayer(null));
  }, [data, setCurrentVideo, setVideoUrl, setMiniPlayer, setCurrentScreen]);

  const dismissMiniPlayer = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setMiniPlayer(null);
  }, [setMiniPlayer]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'v') {
        e.preventDefault();
        openPlayer();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [openPlayer]);

  return (
    <>
      {hovered && <div className="miniplayer-dim" />}
      <div
        className={`miniplayer${hovered ? ' hovered' : ''}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={openPlayer}
      >
        <div className="miniplayer-thumb">
          <video
            ref={videoRef}
            src={data.videoUrl}
            preload="metadata"
            muted
            playsInline
            className="miniplayer-video"
          />
          {hovered && (
            <div className="miniplayer-thumb-overlay">
              <button className="miniplayer-resume-btn" onClick={(e) => { e.stopPropagation(); openPlayer(); }}>
                <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </button>
            </div>
          )}
        </div>
        <div className="miniplayer-info">
          <div className="miniplayer-title-wrap" ref={titleWrapRef}>
            <span className={`miniplayer-title${titleOverflows ? '' : ' no-marquee'}`} ref={titleRef}>{data.currentVideo.originalName}</span>
          </div>
          <div className="miniplayer-time">
            <span>{formatTime(data.currentTime)}</span>
            <span> / </span>
            <span>{formatTime(duration)}</span>
          </div>
          <div className="miniplayer-seek-track">
            <div className="miniplayer-seek-played" style={{ width: `${progress}%` }} />
          </div>
        </div>
        {hovered && (
          <button className="miniplayer-close" onClick={dismissMiniPlayer} title="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </>
  );
};

export default MiniPlayer;