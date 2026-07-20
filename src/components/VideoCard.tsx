import React from 'react';
import { DecryptJob, VideoItem } from '../types/index';

interface VideoCardProps {
  video: VideoItem;
  job?: DecryptJob;
  onDecrypt: (video: VideoItem) => void;
  onPlay: (video: VideoItem) => void;
  onClear: (video: VideoItem) => void;
  onViewImage: (video: VideoItem) => void;
}

const formatDuration = (duration?: string | number): string => {
  if (duration === undefined || duration === null || duration === '') return '-:-';
  if (typeof duration === 'string') return duration;

  const totalSeconds = Math.max(0, Math.floor(duration));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const formatFileSize = (bytes?: number): string => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const VideoCard: React.FC<VideoCardProps> = ({
  video,
  job,
  onDecrypt,
  onPlay,
  onClear,
  onViewImage,
}) => {
  const status = job?.status ?? 'idle';
  const progress = job?.progress ?? 0;
  const isImage = video.mediaType === 'unencrypted_image' || video.mediaType === 'encrypted_image';
  const isEncrypted = video.encrypted;

  return (
    <article className={`video-card status-${status} type-${isImage ? 'image' : 'video'}`}>
      <div className="thumbnail">
        <div className="thumbnail-glow" />

        {video.thumbnailUrl ? (
          <img
            src={video.thumbnailUrl}
            alt={video.originalName}
            className="thumbnail-img"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div className="thumbnail-content">
            <div className="media-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                {isImage ? (
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4m4-3l3 3m0 0l3-3m-3 3V3" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                ) : (
                  <path d="M8 5v14l11-7z" />
                )}
              </svg>
            </div>
            <span>{video.extension.toUpperCase()}</span>
          </div>
        )}

        {isEncrypted && (
          <div className="encrypted-badge" title="Encrypted">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width="14" height="14">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
          </div>
        )}

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
          {!isImage && <span className="video-duration">{formatDuration(video.duration)}</span>}
        </div>

        <div className="video-sub-meta">
          {video.dateAdded && (
            <span className="video-date">
              {new Date(video.dateAdded).toLocaleDateString()}
            </span>
          )}
          {video.fileSize && (
            <span className="video-size">{formatFileSize(video.fileSize)}</span>
          )}
        </div>

        <div className="card-actions">
          {isImage && !isEncrypted && (
            <button type="button" className="play-button" onClick={() => onViewImage(video)}>
              <svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              View
            </button>
          )}
          {isImage && isEncrypted && status !== 'ready' && (
            <button type="button" className="decrypt-button" onClick={() => onDecrypt(video)} disabled={status === 'decrypting'}>
              {status === 'decrypting' ? 'Decrypting' : 'Decrypt'}
            </button>
          )}
          {isImage && isEncrypted && status === 'ready' && (
            <div className="ready-actions">
              <button type="button" className="play-button" onClick={() => onViewImage(video)}>View</button>
              <button type="button" className="clear-cache-button" onClick={() => onClear(video)} title="Clear from cache">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 7h12m-10 0l1 13h6l1-13m-5 4v6m4-6v6M9 7l1-3h4l1 3" /></svg>
              </button>
            </div>
          )}
          {!isImage && status === 'ready' && (
            <div className="ready-actions">
              <button type="button" className="play-button" onClick={() => onPlay(video)}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
                Play
              </button>
              <button type="button" className="clear-cache-button" onClick={() => onClear(video)} title="Clear from cache">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 7h12m-10 0l1 13h6l1-13m-5 4v6m4-6v6M9 7l1-3h4l1 3" /></svg>
              </button>
            </div>
          )}
          {!isImage && status !== 'ready' && (
            <button type="button" className={`${isEncrypted ? 'decrypt-button' : 'play-button'}`}
              onClick={isEncrypted ? () => onDecrypt(video) : () => onPlay(video)}
              disabled={status === 'decrypting'}
            >
              {status === 'decrypting' ? 'Decrypting' : isEncrypted ? 'Decrypt' : 'Play'}
            </button>
          )}
        </div>
        {status === 'error' && <small>{job?.error || 'Failed'}</small>}
      </div>
    </article>
  );
};

export default VideoCard;
