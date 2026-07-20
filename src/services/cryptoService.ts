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
