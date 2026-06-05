import { FFmpeg } from '@ffmpeg/ffmpeg';

let ffmpeg: FFmpeg | null = null;
let ffLoadPromise: Promise<FFmpeg> | null = null;

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpeg?.loaded) return ffmpeg;
  if (ffLoadPromise) return ffLoadPromise;

  ffLoadPromise = (async () => {
    const instance = new FFmpeg();
    instance.on('log', ({ type, message }) => {
      if (type === 'stderr') console.debug('[ffmpeg]', message);
    });
    await instance.load();
    ffmpeg = instance;
    return instance;
  })();

  return ffLoadPromise;
}

export async function createMseBlob(tsBuffer: Uint8Array): Promise<{ url: string; cleanup: () => void }> {
  const instance = await getFFmpeg();

  await instance.writeFile('input.ts', tsBuffer);

  const ret = await instance.exec([
    '-i', 'input.ts',
    '-c', 'copy',
    '-movflags', '+faststart',
    'output.mp4',
  ]);

  if (ret !== 0) {
    await instance.deleteFile('input.ts');
    throw new Error(`ffmpeg exited with code ${ret}`);
  }

  const data = await instance.readFile('output.mp4');

  await instance.deleteFile('input.ts');
  await instance.deleteFile('output.mp4');

  const bytes = data as Uint8Array;
  if (!bytes || bytes.byteLength === 0) {
    throw new Error('ffmpeg produced empty output');
  }

  const blob = new Blob([bytes], { type: 'video/mp4' });
  const url = URL.createObjectURL(blob);
  return { url, cleanup: () => URL.revokeObjectURL(url) };
}
