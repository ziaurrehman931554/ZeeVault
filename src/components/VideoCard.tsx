import React from 'react';
import { DecryptJob, VideoItem } from '../types/index';

interface VideoCardProps {
  video: VideoItem;
  job?: DecryptJob;
  onDecrypt: (video: VideoItem) => void;
  onPlay: (video: VideoItem) => void;
  onClear: (video: VideoItem) => void;
}

const VideoCard: React.FC<VideoCardProps> = ({
  video,
  job,
  onDecrypt,
  onPlay,
  onClear,
}) => {
  const status = job?.status ?? 'idle';
  const progress = job?.progress ?? 0;

  return (
    <article className={`video-card status-${status}`}>
      <div className="thumbnail">
        <div className="thumbnail-glow" />

        <div className="thumbnail-content">
          <div className="media-icon">
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
          <span>{video.extension.toUpperCase()}</span>
        </div>

        {status === 'decrypting' && (
          <div className="card-progress">
            <div className="progress-track">
              <span style={{ width: `${progress}%` }} />
            </div>
            <strong>{Math.round(progress)}%</strong>
          </div>
        )}
      </div>

      <div className="video-card-body">
        <div className="video-meta-row">
          <p className="video-title" title={video.originalName}>
            {video.originalName}
          </p>
          <span className="video-duration">{formatDuration(video.duration)}</span>
        </div>
        <div className="card-actions">
          {status === 'ready' ? (
            <div className="ready-actions">
              <button type="button" className="play-button" onClick={() => onPlay(video)}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8 5v14l11-7z" />
                </svg>
                Play
              </button>
              <button
                type="button"
                className="clear-cache-button"
                onClick={() => onClear(video)}
                aria-label={`Clear ${video.originalName} from cache`}
                title="Clear from cache"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 7h12m-10 0l1 13h6l1-13m-5 4v6m4-6v6M9 7l1-3h4l1 3" />
                </svg>
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="decrypt-button"
              onClick={() => onDecrypt(video)}
              disabled={status === 'decrypting'}
            >
              {status === 'decrypting' ? 'Decrypting' : 'Decrypt'}
            </button>
          )}
        </div>
        {status === 'error' && <small>{job?.error || 'Decryption failed'}</small>}
      </div>
    </article>
  );
};

const formatDuration = (duration?: string | number): string => {
  if (duration === undefined || duration === null || duration === '') return '-:-';
  if (typeof duration === 'string') return duration;

  const totalSeconds = Math.max(0, Math.floor(duration));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}`;
  }

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export default VideoCard;
