import { VideoItem } from '../types/index';
import { CryptoService } from './cryptoService';

export async function decryptAllThumbnails(
  videos: VideoItem[],
  password: string
): Promise<VideoItem[]> {
  const updated = [...videos];

  for (let i = 0; i < updated.length; i++) {
    const video = updated[i];
    if (video.thumbnailEncrypted && password) {
      const url = CryptoService.decryptThumbnail(video.thumbnailEncrypted, password);
      if (url) {
        updated[i] = { ...video, thumbnailUrl: url };
      }
    }
  }

  return updated;
}

export function cleanupThumbnails(videos: VideoItem[]): void {
  for (const video of videos) {
    if (video.thumbnailUrl) {
      URL.revokeObjectURL(video.thumbnailUrl);
    }
  }
}

export async function generateUnencryptedThumbnailFromBuffer(
  buffer: Uint8Array,
  originalName: string
): Promise<string | null> {
  const ext = originalName.split('.').pop()?.toLowerCase() || '';
  const imageExts = new Set(['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'tif', 'webp']);
  const videoExts = new Set(['mp4', 'webm', 'mkv', 'avi', 'mov', 'wmv', 'm4v', 'mpeg', 'mpg', 'ogv', '3gp', 'flv', 'ts']);

  if (imageExts.has(ext)) {
    const blob = new Blob([buffer], { type: `image/${ext === 'jpg' ? 'jpeg' : ext}` });
    return URL.createObjectURL(blob);
  }

  if (videoExts.has(ext)) {
    return generateVideoThumbnailFromBuffer(buffer, originalName);
  }

  return null;
}

function generateVideoThumbnailFromBuffer(buffer: Uint8Array, originalName: string): Promise<string | null> {
  return new Promise((resolve) => {
    const ext = originalName.split('.').pop()?.toLowerCase() || '';
    const mimeTypes: Record<string, string> = {
      mp4: 'video/mp4', webm: 'video/webm', mkv: 'video/x-matroska',
      avi: 'video/x-msvideo', mov: 'video/quicktime', wmv: 'video/x-ms-wmv',
      m4v: 'video/x-m4v', mpeg: 'video/mpeg', mpg: 'video/mpeg',
      ogv: 'video/ogg', '3gp': 'video/3gpp', flv: 'video/x-flv', ts: 'video/mp2t',
    };
    const blob = new Blob([buffer], { type: mimeTypes[ext] || 'video/mp4' });
    const url = URL.createObjectURL(blob);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.playsInline = true;
    video.muted = true;
    video.src = url;

    video.onloadeddata = () => { video.currentTime = Math.min(1, video.duration * 0.1); };

    video.onseeked = () => {
      const canvas = document.createElement('canvas');
      let { videoWidth: width, videoHeight: height } = video;
      const maxDimension = 320;
      if (width > maxDimension || height > maxDimension) {
        const ratio = Math.min(maxDimension / width, maxDimension / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { cleanup(); resolve(null); return; }
      ctx.drawImage(video, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
      cleanup();
      resolve(dataUrl);
    };

    video.onerror = () => { cleanup(); resolve(null); };

    const cleanup = () => { URL.revokeObjectURL(url); video.remove(); };
    setTimeout(() => { cleanup(); resolve(null); }, 10000);
  });
}

export async function generateBrowserThumbnail(file: File, maxDimension: number = 320): Promise<string | null> {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const imageExts = new Set(['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'tif', 'webp']);
  const videoExts = new Set(['mp4', 'webm', 'mkv', 'avi', 'mov', 'wmv', 'm4v', 'mpeg', 'mpg', 'ogv', '3gp', 'flv', 'ts']);

  if (imageExts.has(ext)) {
    return generateImageThumbnail(file, maxDimension);
  }

  if (videoExts.has(ext)) {
    return generateVideoThumbnail(file, maxDimension);
  }

  return null;
}

function generateImageThumbnail(file: File, maxDimension: number): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        const ratio = Math.min(maxDimension / width, maxDimension / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(null); return; }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

function generateVideoThumbnail(file: File, maxDimension: number): Promise<string | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.playsInline = true;
    video.muted = true;
    const url = URL.createObjectURL(file);
    video.src = url;

    video.onloadeddata = () => {
      video.currentTime = Math.min(1, video.duration * 0.1);
    };

    video.onseeked = () => {
      const canvas = document.createElement('canvas');
      let { videoWidth: width, videoHeight: height } = video;
      if (width > maxDimension || height > maxDimension) {
        const ratio = Math.min(maxDimension / width, maxDimension / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { cleanup(); resolve(null); return; }
      ctx.drawImage(video, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
      cleanup();
      resolve(dataUrl);
    };

    video.onerror = () => { cleanup(); resolve(null); };

    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.remove();
    };

    setTimeout(() => { cleanup(); resolve(null); }, 10000);
  });
}
