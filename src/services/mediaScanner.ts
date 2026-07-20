import {
  ALL_MEDIA_EXTENSIONS,
  IMAGE_EXTENSIONS,
  MetaFile,
  MetaVideoEntry,
  MediaType,
  VIDEO_EXTENSIONS,
  VideoItem,
} from '../types/index';

export interface ScannedFile {
  name: string;
  path: string;
  extension: string;
  size: number;
  dateAdded: string;
  dateModified: string;
  isEncrypted: boolean;
}

export class MediaScanner {
  static classifyExtension(ext: string): 'video' | 'image' | null {
    const lower = ext.toLowerCase();
    if (VIDEO_EXTENSIONS.has(lower)) return 'video';
    if (IMAGE_EXTENSIONS.has(lower)) return 'image';
    return null;
  }

  static getMediaType(extension: string, encrypted: boolean): MediaType {
    const kind = this.classifyExtension(extension);
    if (!kind) return encrypted ? 'encrypted_video' : 'unencrypted_video';
    if (kind === 'image') return encrypted ? 'encrypted_image' : 'unencrypted_image';
    return encrypted ? 'encrypted_video' : 'unencrypted_video';
  }

  static parseMeta(metaContent: string): MetaFile {
    try {
      return JSON.parse(metaContent) as MetaFile;
    } catch (error) {
      throw new Error(`Failed to parse meta file: ${error}`);
    }
  }

  static isValidMetaFile(meta: MetaFile): boolean {
    return Boolean(
      meta &&
      'state' in meta &&
      'password_hash' in meta &&
      'files' in meta &&
      meta.state === 'encrypted'
    );
  }

  static metaToEncryptedVideos(meta: MetaFile, folderPath: string): VideoItem[] {
    const videos: VideoItem[] = [];
    for (const [encryptedName, entry] of Object.entries(meta.files)) {
      const details = typeof entry === 'string' ? {} as MetaVideoEntry : entry;
      const originalName = typeof entry === 'string'
        ? entry
        : details.originalName || details.name || details.filename || encryptedName;

      const extension = originalName.split('.').pop() || '';
      const kind = this.classifyExtension(extension) || 'video';

      videos.push({
        encryptedName,
        originalName,
        extension,
        filePath: `${folderPath}\\${encryptedName}`,
        duration: typeof entry !== 'string' ? entry.duration : undefined,
        encrypted: true,
        mediaType: kind === 'image' ? 'encrypted_image' : 'encrypted_video',
        dateAdded: details.dateAdded,
        dateModified: details.dateModified,
        fileSize: details.fileSize,
        width: details.width,
        height: details.height,
        thumbnailEncrypted: details.thumbnail,
      });
    }

    return videos;
  }

  static scannedToUnencryptedVideos(scanned: ScannedFile[], folderPath: string): VideoItem[] {
    const videos: VideoItem[] = [];

    for (const file of scanned) {
      if (file.isEncrypted) continue;

      const kind = this.classifyExtension(file.extension);
      if (!kind) continue;

      videos.push({
        encryptedName: file.name,
        originalName: file.name,
        extension: file.extension,
        filePath: file.path,
        encrypted: false,
        mediaType: kind === 'image' ? 'unencrypted_image' : 'unencrypted_video',
        dateAdded: file.dateAdded,
        dateModified: file.dateModified,
        fileSize: file.size,
      });
    }

    return videos;
  }

  static mergeMedia(
    encrypted: VideoItem[],
    unencrypted: VideoItem[]
  ): VideoItem[] {
    const encMap = new Map<string, VideoItem>();
    for (const e of encrypted) {
      encMap.set(e.originalName.toLowerCase(), e);
    }

    for (const u of unencrypted) {
      const key = u.originalName.toLowerCase();
      if (!encMap.has(key)) {
        encMap.set(key, u);
      }
    }

    return Array.from(encMap.values());
  }

  static async checkVaultMeta(folderPath: string): Promise<boolean> {
    if ((window as any).electronAPI?.fileExists) {
      try {
        return await (window as any).electronAPI.fileExists(
          `${folderPath}\\vault.meta`
        );
      } catch {
        return false;
      }
    }
    return false;
  }

  static async readMetaContent(folderPath: string, browserFiles?: FileList): Promise<string | null> {
    if ((window as any).electronAPI?.readMetaFile) {
      return (window as any).electronAPI.readMetaFile(folderPath);
    }

    if (browserFiles) {
      for (let i = 0; i < browserFiles.length; i++) {
        if (browserFiles[i].name === 'vault.meta') {
          return browserFiles[i].text();
        }
      }
    }

    return null;
  }

  static async scanFolderFiles(folderPath: string, browserFiles?: FileList): Promise<ScannedFile[]> {
    if ((window as any).electronAPI?.listMediaFiles) {
      return (window as any).electronAPI.listMediaFiles(folderPath);
    }

    if (browserFiles) {
      const results: ScannedFile[] = [];
      const seen = new Set<string>();

      for (let i = 0; i < browserFiles.length; i++) {
        const file = browserFiles[i];
        const relPath = file.webkitRelativePath || file.name;
        const parts = relPath.split('/');
        const fileName = parts[parts.length - 1];

        if (seen.has(fileName)) continue;
        seen.add(fileName);

        if (fileName === 'vault.meta' || fileName === 'ZeeVault.ps1') continue;

        const ext = fileName.split('.').pop()?.toLowerCase() || '';
        const isEncrypted = ext === 'enc';
        const checkExt = isEncrypted ? '' : ext;

        if (isEncrypted || ALL_MEDIA_EXTENSIONS.has(checkExt)) {
          results.push({
            name: fileName,
            path: relPath,
            extension: isEncrypted ? 'enc' : ext,
            size: file.size,
            dateAdded: new Date(file.lastModified).toISOString(),
            dateModified: new Date(file.lastModified).toISOString(),
            isEncrypted,
          });
        }
      }

      return results;
    }

    return [];
  }
}
