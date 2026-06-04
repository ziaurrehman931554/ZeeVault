import { MetaFile, VideoItem } from '../types/index';

/**
 * Service for handling .meta file operations
 * Reads and parses the vault.meta file structure
 */

export class MetaService {
  /**
   * Parse meta file JSON
   */
  static parseMeta(metaContent: string): MetaFile {
    try {
      return JSON.parse(metaContent) as MetaFile;
    } catch (error) {
      throw new Error(`Failed to parse meta file: ${error}`);
    }
  }

  /**
   * Convert meta file to video items
   */
  static metaToVideos(meta: MetaFile, folderPath: string): VideoItem[] {
    const videos: VideoItem[] = [];

    for (const [encryptedName, entry] of Object.entries(meta.files)) {
      const originalName =
        typeof entry === 'string'
          ? entry
          : entry.originalName || entry.name || entry.filename || encryptedName;
      const duration = typeof entry === 'string' ? undefined : entry.duration;
      const extension = originalName.split('.').pop() || '';
      videos.push({
        encryptedName,
        originalName,
        extension,
        filePath: `${folderPath}\\${encryptedName}`,
        duration,
      });
    }

    return videos;
  }

  /**
   * Validate meta file structure
   */
  static validateMeta(meta: MetaFile): boolean {
    return Boolean(
      meta.state === 'encrypted' &&
      meta.password_hash &&
      typeof meta.files === 'object' &&
      Object.keys(meta.files).length > 0
    );
  }

  /**
   * Check if .meta file exists and is valid
   */
  static isValidMetaFile(meta: MetaFile): boolean {
    return (
      meta &&
      'state' in meta &&
      'password_hash' in meta &&
      'files' in meta &&
      meta.state === 'encrypted'
    );
  }
}
