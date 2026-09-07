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
      const cleaned = metaContent.replace(/^\uFEFF/, '');
      return JSON.parse(cleaned) as MetaFile;
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

  static metaToEncryptedVideos(
    meta: MetaFile,
    folderPath: string,
    resolvePath?: (encryptedName: string) => string
  ): VideoItem[] {
    const videos: VideoItem[] = [];
    for (const [encryptedName, entry] of Object.entries(meta.files)) {
      const details = typeof entry === 'string' ? {} as MetaVideoEntry : entry;
      const originalName = typeof entry === 'string'
        ? entry
        : details.originalName || details.name || details.filename || encryptedName;

      const extension = originalName.split('.').pop() || '';
      const kind = this.classifyExtension(extension) || 'video';
      const filePath = resolvePath
        ? resolvePath(encryptedName)
        : `${folderPath}\\${encryptedName}`;

      videos.push({
        id: filePath,
        encryptedName,
        originalName,
        extension,
        filePath,
        folderPath,
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
        id: file.path,
        encryptedName: file.name,
        originalName: file.name,
        extension: file.extension,
        filePath: file.path,
        folderPath,
        encrypted: false,
        mediaType: kind === 'image' ? 'unencrypted_image' : 'unencrypted_video',
        dateAdded: file.dateAdded,
        dateModified: file.dateModified,
        fileSize: file.size,
      });
    }

    return videos;
  }

  private static dirOf(p: string): string {
    const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'));
    return i >= 0 ? p.slice(0, i) : '';
  }

  static mergeMedia(
    encrypted: VideoItem[],
    unencrypted: VideoItem[]
  ): VideoItem[] {
    const keyOf = (v: VideoItem) =>
      `${this.dirOf(v.filePath)}/${v.originalName.toLowerCase()}`;
    const encMap = new Map<string, VideoItem>();
    for (const e of encrypted) {
      encMap.set(keyOf(e), e);
    }

    for (const u of unencrypted) {
      const key = keyOf(u);
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

  static async readMetaContent(folderPath: string, browserFiles?: File[], folderPrefix?: string): Promise<string | null> {
    if ((window as any).electronAPI?.readMetaFile) {
      return (window as any).electronAPI.readMetaFile(folderPath);
    }

    if (browserFiles) {
      for (let i = 0; i < browserFiles.length; i++) {
        const file = browserFiles[i];
        const relPath = file.webkitRelativePath || file.name;
        if (folderPrefix && !relPath.startsWith(`${folderPrefix}/`)) continue;
        if (file.name === 'vault.meta') {
          return file.text();
        }
      }
    }

    return null;
  }

  static async scanFolderFiles(folderPath: string, browserFiles?: File[], folderPrefix?: string): Promise<ScannedFile[]> {
    if ((window as any).electronAPI?.listMediaFiles) {
      return (window as any).electronAPI.listMediaFiles(folderPath);
    }

    if (browserFiles) {
      const results: ScannedFile[] = [];
      const seen = new Set<string>();

      for (let i = 0; i < browserFiles.length; i++) {
        const file = browserFiles[i];
        const relPath = file.webkitRelativePath || file.name;
        if (folderPrefix && !relPath.startsWith(`${folderPrefix}/`)) continue;
        const parts = relPath.split('/');
        const fileName = parts[parts.length - 1];

        const seenKey = relPath.toLowerCase();
        if (seen.has(seenKey)) continue;
        seen.add(seenKey);

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
