import CryptoJS from 'crypto-js';

type BinaryLike =
  | ArrayBuffer
  | Uint8Array
  | number[]
  | { data: number[] }
  | { buffer: ArrayBuffer; byteOffset?: number; byteLength?: number };

export class CryptoService {
  static hashPassword(password: string): string {
    return CryptoJS.SHA256(password).toString();
  }

  static verifyPassword(password: string, storedHash: string): boolean {
    const hash = this.hashPassword(password);
    return hash === storedHash;
  }

  private static toUint8Array(buffer: BinaryLike): Uint8Array {
    if (buffer instanceof Uint8Array) return buffer;
    if (buffer instanceof ArrayBuffer) return new Uint8Array(buffer);
    if (Array.isArray(buffer)) return new Uint8Array(buffer);
    if ('data' in buffer && Array.isArray(buffer.data)) {
      return new Uint8Array(buffer.data);
    }
    if ('buffer' in buffer && buffer.buffer instanceof ArrayBuffer) {
      return new Uint8Array(
        buffer.buffer,
        buffer.byteOffset ?? 0,
        buffer.byteLength ?? buffer.buffer.byteLength
      );
    }
    throw new Error('Unsupported encrypted file data format');
  }

  private static stringToUint8Array(str: string): Uint8Array {
    const encoder = new TextEncoder();
    return encoder.encode(str);
  }

  static xorDecrypt(encryptedBuffer: BinaryLike, password: string): Uint8Array {
    const buffer = this.toUint8Array(encryptedBuffer);
    const keyBytes = this.stringToUint8Array(password);
    const decrypted = new Uint8Array(buffer.length);
    const keyLen = keyBytes.length;

    for (let i = 0; i < buffer.length; i++) {
      decrypted[i] = buffer[i] ^ keyBytes[i % keyLen];
    }

    return decrypted;
  }

  static *xorDecryptChunked(
    encryptedBuffer: BinaryLike,
    password: string,
    chunkSize: number = 1024 * 1024
  ): Generator<Uint8Array> {
    const buffer = this.toUint8Array(encryptedBuffer);
    const keyBytes = this.stringToUint8Array(password);
    const keyLen = keyBytes.length;
    let keyIndex = 0;

    for (let offset = 0; offset < buffer.length; offset += chunkSize) {
      const size = Math.min(chunkSize, buffer.length - offset);
      const chunk = new Uint8Array(size);

      for (let i = 0; i < size; i++) {
        chunk[i] = buffer[offset + i] ^ keyBytes[keyIndex % keyLen];
        keyIndex++;
      }

      yield chunk;
    }
  }

  static xorEncryptBytes(data: Uint8Array, password: string): Uint8Array {
    return this.xorDecrypt(data, password);
  }

  static xorDecryptBytes(data: Uint8Array, password: string): Uint8Array {
    return this.xorDecrypt(data, password);
  }

  static bufferToBlob(buffer: BinaryLike, mimeType: string = 'video/mp4'): string {
    const uint8Array = this.toUint8Array(buffer);
    const arrayBuffer = new ArrayBuffer(uint8Array.byteLength);
    new Uint8Array(arrayBuffer).set(uint8Array);
    const blob = new Blob([arrayBuffer], { type: mimeType });
    return URL.createObjectURL(blob);
  }

  static revokeBlobUrl(url: string): void {
    if (url) {
      URL.revokeObjectURL(url);
    }
  }

  static getMimeType(filename: string): string {
    const ext = filename.toLowerCase().split('.').pop();
    const mimeTypes: Record<string, string> = {
      mp4: 'video/mp4',
      webm: 'video/webm',
      mkv: 'video/x-matroska',
      avi: 'video/x-msvideo',
      mov: 'video/mp4',
      wmv: 'video/x-ms-wmv',
      ts: 'video/mp2t',
      m4v: 'video/mp4',
      mpeg: 'video/mpeg',
      mpg: 'video/mpeg',
      ogv: 'video/ogg',
      ogx: 'video/ogg',
      '3gp': 'video/3gpp',
      flv: 'video/x-flv',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      bmp: 'image/bmp',
      tiff: 'image/tiff',
      tif: 'image/tiff',
      webp: 'image/webp',
    };
    return mimeTypes[ext || ''] || 'video/mp4';
  }

  /**
   * Streaming blob builder: reads the source file in chunks via the provided
   * chunk reader (returns { done, data: ArrayBuffer|null }), optionally XOR
   * decrypts each chunk in place (when a password is provided), and builds a
   * single blob URL. Avoids loading the entire file into memory at once and
   * avoids duplicating buffers — preventing both the >2 GiB read limit and
   * out-of-memory hangs on large files.
   *
   * Pass password = null to stream an unencrypted file (no transform).
   */
  static async streamToBlobUrl(
    filePath: string,
    password: string | null,
    mimeType: string,
    chunkReader: (filePath: string, offset: number, length: number) => Promise<{ done: boolean; data: ArrayBuffer | null }>,
    onProgress?: (decryptedBytes: number, totalBytes: number) => void
  ): Promise<{ url: string; cleanup: () => void }> {
    const keyBytes = password ? this.stringToUint8Array(password) : null;
    const keyLen = keyBytes ? keyBytes.length : 0;
    const CHUNK = 32 * 1024 * 1024;

    const totalBytes = await this.getFileSize(filePath);

    const parts: BlobPart[] = [];
    let offset = 0;
    let decryptedBytes = 0;
    let keyIndex = 0;

    while (true) {
      const res = await chunkReader(filePath, offset, CHUNK);
      if (res.done || !res.data || res.data.byteLength === 0) break;

      if (!keyBytes) {
        // No decryption: use the raw chunk directly.
        parts.push(res.data);
        offset += res.data.byteLength;
        decryptedBytes += res.data.byteLength;
      } else {
        const raw = new Uint8Array(res.data);
        const size = raw.length;
        const decrypted = new Uint8Array(size);

        for (let i = 0; i < size; i++) {
          decrypted[i] = raw[i] ^ keyBytes[keyIndex % keyLen];
          keyIndex++;
        }

        parts.push(decrypted.buffer);
        offset += size;
        decryptedBytes += size;
      }

      if (onProgress) onProgress(decryptedBytes, totalBytes > 0 ? totalBytes : offset);
      // Yield to the UI thread so large files don't freeze the app.
      await new Promise((r) => setTimeout(r, 0));
    }

    const blob = new Blob(parts, { type: mimeType });
    const url = URL.createObjectURL(blob);
    return { url, cleanup: () => URL.revokeObjectURL(url) };
  }

  static async getFileSize(filePath: string): Promise<number> {
    try {
      const api = (window as any).electronAPI;
      if (api?.getFileSize) {
        const size = await api.getFileSize(filePath);
        if (typeof size === 'number' && size > 0) return size;
      }
    } catch { /* ignore */ }
    return -1;
  }

  static decryptThumbnail(encryptedBase64: string, password: string): string | null {
    try {
      const encryptedBytes = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
      const decryptedBytes = this.xorDecrypt(encryptedBytes, password);
      const blob = new Blob([decryptedBytes], { type: 'image/jpeg' });
      return URL.createObjectURL(blob);
    } catch {
      return null;
    }
  }
}
