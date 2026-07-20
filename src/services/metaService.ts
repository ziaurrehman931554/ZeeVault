import { MediaScanner } from './mediaScanner';
import { MetaFile, VideoItem } from '../types/index';

export class MetaService {
  static parseMeta(metaContent: string): MetaFile {
    return MediaScanner.parseMeta(metaContent);
  }

  static metaToVideos(meta: MetaFile, folderPath: string): VideoItem[] {
    return MediaScanner.metaToEncryptedVideos(meta, folderPath);
  }

  static validateMeta(meta: MetaFile): boolean {
    return Boolean(
      meta.state === 'encrypted' &&
      meta.password_hash &&
      typeof meta.files === 'object' &&
      Object.keys(meta.files).length > 0
    );
  }

  static isValidMetaFile(meta: MetaFile): boolean {
    return MediaScanner.isValidMetaFile(meta);
  }
}
