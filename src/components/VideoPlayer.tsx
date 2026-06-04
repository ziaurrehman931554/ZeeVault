import React, { useEffect, useRef, useState } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import { usePlayerStore } from '../stores/playerStore';
import { useAppStore } from '../stores/appStore';

const VideoPlayer: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const [showTitle, setShowTitle] = useState(true);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { currentVideo, videoUrl, setVideoUrl } = usePlayerStore();
  const { setCurrentScreen } = useAppStore();

  useEffect(() => {
    const options = {
      controls: true,
      autoplay: true,
      preload: 'metadata',
      width: '100%',
      height: '100%',
      fluid: false,
      responsive: true,
      fill: true,
      controlBar: {
        children: [
          'playToggle',
          'volumePanel',
          'currentTimeDisplay',
          'timeDivider',
          'durationDisplay',
          'progressControl',
          'remainingTimeDisplay',
          'playbackRateMenuButton',
          'fullscreenToggle',
        ],
      },
      playbackRates: [0.5, 1, 1.25, 1.5, 2],
    };

    if (containerRef.current && !playerRef.current) {
      const videoElement = document.createElement('video-js');
      videoElement.classList.add('vjs-big-play-centered');
      containerRef.current.appendChild(videoElement);
      const player = videojs(videoElement, options);
      playerRef.current = player;

      player.ready(() => {
        const onPlay = () => {
          setShowTitle(false);
          if (hideTimerRef.current) {
            clearTimeout(hideTimerRef.current);
            hideTimerRef.current = null;
          }
        };
        const onPause = () => setShowTitle(true);
        const onPlaying = () => {
          if (hideTimerRef.current === null) {
            hideTimerRef.current = setTimeout(() => {
              setShowTitle(false);
              hideTimerRef.current = null;
            }, 3000);
          }
        };
        player.on('play', onPlay);
        player.on('pause', onPause);
        player.on('playing', onPlaying);

        if (!player.paused()) {
          hideTimerRef.current = setTimeout(() => {
            setShowTitle(false);
            hideTimerRef.current = null;
          }, 3000);
        }
      });
    }

    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
      if (playerRef.current) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (videoUrl && playerRef.current) {
      playerRef.current.src({
        src: videoUrl,
        type: currentVideo ? getVideoType(currentVideo.originalName) : 'video/mp4',
      });
      playerRef.current.ready(() => {
        setShowTitle(true);
        if (hideTimerRef.current) {
          clearTimeout(hideTimerRef.current);
          hideTimerRef.current = null;
        }
        playerRef.current?.play()?.catch(() => undefined);
      });
    }
  }, [currentVideo, videoUrl]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const player = playerRef.current;
      if (!player) return;

      const target = event.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;

      if (event.code === 'Space') {
        event.preventDefault();
        if (player.paused()) {
          player.play()?.catch(() => undefined);
        } else {
          player.pause();
        }
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        if (!useAppStore.getState().isLocked) {
          setCurrentScreen('gallery');
        }
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        player.currentTime(Math.max(0, player.currentTime() - 5));
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        player.currentTime(Math.min(player.duration() || 0, player.currentTime() + 5));
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        player.volume(Math.min(1, player.volume() + 0.1));
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        player.volume(Math.max(0, player.volume() - 0.1));
      }

      if (event.key.toLowerCase() === 'm') {
        event.preventDefault();
        player.muted(!player.muted());
      }

      if (event.key === '.') {
        event.preventDefault();
        event.stopPropagation();
        const currentRate = player.playbackRate();
        player.playbackRate(Math.min(4, currentRate + 0.25));
      }

      if (event.key === ',') {
        event.preventDefault();
        event.stopPropagation();
        const currentRate = player.playbackRate();
        player.playbackRate(Math.max(0.25, currentRate - 0.25));
      }

      if (event.key.toLowerCase() === 'f') {
        event.preventDefault();
        if (player.isFullscreen()) {
          player.exitFullscreen();
        } else {
          player.requestFullscreen();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [setCurrentScreen]);

  useEffect(() => {
    return () => {
      setVideoUrl(null);
    };
  }, []);

  return (
    <div className="player-page">
      <header className={`player-header${showTitle ? '' : ' hidden'}`}>
        <button
          onClick={() => setCurrentScreen('gallery')}
          className="back-button"
          type="button"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="player-title-wrap">
          <h1>{currentVideo?.originalName}</h1>
        </div>
      </header>

      <div className="player-shell">
        <div data-vjs-player ref={containerRef} className="video-container" />
      </div>
    </div>
  );
};

const getVideoType = (filename: string): string => {
  const extension = filename.toLowerCase().split('.').pop();
  if (extension === 'mov') return 'video/quicktime';
  if (extension === 'webm') return 'video/webm';
  return 'video/mp4';
};

export default VideoPlayer;
