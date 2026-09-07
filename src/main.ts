import { app, BrowserWindow, dialog, ipcMain, Menu } from 'electron';import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const getConfigPath = () => {
  return path.join(app.getPath('userData'), 'zeevault-config.json');
};

let mainWindow: BrowserWindow | null = null;

// Serialize config read-modify-write cycles so two IPC handlers can't stomp
// each other's keys (e.g. folder paths being saved while a settings write is
// in flight, which would silently drop the settings object).
let configWriteChain: Promise<unknown> = Promise.resolve();
const updateConfigFile = async (update: (config: Record<string, unknown>) => void): Promise<boolean> => {
  const run = async (): Promise<boolean> => {
    try {
      const configPath = getConfigPath();
      let config: Record<string, unknown> = {};
      try {
        const data = await fs.readFile(configPath, 'utf-8');
        config = JSON.parse(data);
      } catch {
        config = {};
      }
      update(config);
      await fs.writeFile(configPath, JSON.stringify(config), 'utf-8');
      return true;
    } catch {
      return false;
    }
  };
  const result = configWriteChain.then(run);
  configWriteChain = result.catch(() => undefined);
  return result;
};

export type WindowMaterial = 'solid' | 'mica' | 'acrylic';

const applyWindowMaterial = (material: WindowMaterial = 'solid') => {
  if (!mainWindow || process.platform !== 'win32') return;
  try {
    const materialMap: Record<WindowMaterial, Parameters<BrowserWindow['setBackgroundMaterial']>[0]> = {
      solid: 'none',
      mica: 'mica',
      acrylic: 'acrylic',
    };
    mainWindow.setBackgroundMaterial(materialMap[material]);
    // A transparent window background lets the material show through the
    // userland content; solid reverts to the normal opaque shell.
    mainWindow.setBackgroundColor(material === 'solid' ? '#09090b' : '#00000000');
    // Fastest path: schedule a full repaint of the web contents.
    mainWindow.webContents.invalidate();
    // DWM also needs the layered-window surface flushed, otherwise the freshly
    // transparent client area stays opaque until the user interacts with the
    // window (e.g. clicking an input). A hair-thin opacity toggle forces a
    // layered-window update, then restore imperceptibly.
    forceWindowRecompose();
  } catch {
    // Material is unsupported (e.g. Windows 10 without acrylic, or older OS).
  }
};

const forceWindowRecompose = () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const restore = mainWindow.getOpacity();
  const wasTopMost = mainWindow.isAlwaysOnTop();
  try {
    mainWindow.setOpacity(restore === 1 ? 0.9999 : 1);
    mainWindow.webContents.invalidate();
    if (!wasTopMost) {
      // A window-manager-level topmost toggle forces DWM to fully re-layout and
      // re-composite the window (stronger than opacity/invalidate alone), which
      // is what actually flushes a stale layered-window surface on Win10/11.
      mainWindow.setAlwaysOnTop(true, 'screen-saver');
    }
  } catch {
    // ignore
  }
  setTimeout(() => {
    try {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setOpacity(restore);
        if (!wasTopMost) mainWindow.setAlwaysOnTop(false);
        mainWindow.webContents.invalidate();
      }
    } catch {
      // ignore
    }
  }, 120);
};

const createWindow = (initialMaterial: WindowMaterial = 'solid') => {
  Menu.setApplicationMenu(null);
  mainWindow = new BrowserWindow({
    title: 'ZeeVault',
    icon: path.join(__dirname, '../dist/ZeeVault.png'),
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 600,
    backgroundColor: initialMaterial === 'solid' ? '#09090b' : '#00000000',
    frame: true,
    // Stay hidden until the material and transparency are in place, so the
    // very first frame the user sees is already composited (avoids DWM
    // latching onto an opaque first paint).
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  applyWindowMaterial(initialMaterial);

  const isDev = process.env.NODE_ENV === 'development';
  const startUrl = isDev
    ? 'http://localhost:5173'
    : `file://${path.join(__dirname, '../dist/index.html')}`;

  mainWindow.loadURL(startUrl);

  const reveal = (forceMaterial: WindowMaterial) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    applyWindowMaterial(forceMaterial);
    if (!mainWindow.isVisible()) {
      mainWindow.show();
      mainWindow.focus();
      mainWindow.maximize();
    }
  };

  mainWindow.once('ready-to-show', () => {
    reveal(initialMaterial);
    // DWM sometimes needs a few passes to flush the layered surface after the
    // renderer re-applies the material during settings hydration; schedule
    // gentle nudges so the acrylic never requires a click to "wake up".
    for (const t of [450, 1300, 2800]) {
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          applyWindowMaterial(initialMaterial);
          forceWindowRecompose();
        }
      }, t);
    }
  });

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow?.webContents.insertCSS(`
      ::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }
      html { scrollbar-width: none !important; }
    `);
    if (mainWindow && !mainWindow.isVisible()) reveal(initialMaterial);
  });

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

app.on('ready', async () => {
  let initialMaterial: WindowMaterial = 'solid';
  try {
    const configPath = getConfigPath();
    const data = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(data);
    const m = config.settings?.windowMaterial;
    if (m === 'mica' || m === 'acrylic') initialMaterial = m;
  } catch {
    // no saved material — default to solid
  }
  createWindow(initialMaterial);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow('solid');
  }
});

ipcMain.handle('setWindowMaterial', (_event, material: unknown) => {
  applyWindowMaterial(material === 'mica' || material === 'acrylic' ? material : 'solid');
  return true;
});

// IPC Handlers

ipcMain.handle('selectFolder', async () => {
  if (!mainWindow) return null;

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select Folder with Videos',
    buttonLabel: 'Select',
  });

  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.handle('selectFolders', async () => {
  if (!mainWindow) return [];

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'multiSelections'],
    title: 'Select Folders with Videos',
    buttonLabel: 'Add Folders',
  });

  if (result.canceled) return [];
  return result.filePaths;
});

ipcMain.handle('readMetaFile', async (_event, folderPath: string) => {
  try {
    const metaPath = path.join(folderPath, 'vault.meta');
    const content = await fs.readFile(metaPath, 'utf-8');
    return content;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error('Error reading meta file:', error);
    }
    return null;
  }
});

ipcMain.handle('readFile', async (_event, filePath: string) => {
  try {
    const buffer = await fs.readFile(filePath);
    return buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength
    );
  } catch (error) {
    console.error('Error reading file:', error);
    throw error;
  }
});

ipcMain.handle('readFileChunk', async (_event, filePath: string, offset: number, length: number) => {
  if (typeof offset !== 'number' || offset < 0 || typeof length !== 'number' || length < 1) {
    throw new Error('readFileChunk: invalid offset/length');
  }
  // Cap each chunk well below Node's 2 GiB Buffer limit.
  const maxChunk = 64 * 1024 * 1024;
  const readLength = Math.min(length, maxChunk);
  const handle = await fs.open(filePath, 'r');
  try {
    const stat = await handle.stat();
    if (offset >= stat.size) {
      return { done: true, data: null };
    }
    const buf = Buffer.alloc(readLength);
    const { bytesRead } = await handle.read(buf, 0, readLength, offset);
    if (bytesRead === 0) {
      return { done: true, data: null };
    }
    return {
      done: false,
      data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + bytesRead),
    };
  } finally {
    await handle.close();
  }
});

ipcMain.handle('getFileSize', async (_event, filePath: string) => {
  try {
    const stat = await fs.stat(filePath);
    return stat.size;
  } catch {
    return -1;
  }
});

ipcMain.handle('fileExists', async (_event, filePath: string) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
});

const SUPPORTED_VIDEO = new Set(['.mp4', '.webm', '.mkv', '.avi', '.mov', '.wmv', '.m4v', '.mpeg', '.mpg', '.ogv', '.3gp', '.flv', '.ts']);
const SUPPORTED_IMAGE = new Set(['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.tif', '.webp']);

async function walkMediaFiles(dir: string, results: any[]) {
  let entries: import('fs').Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkMediaFiles(fullPath, results);
      continue;
    }
    const ext = path.extname(entry.name).toLowerCase();
    const isVideo = SUPPORTED_VIDEO.has(ext);
    const isImage = SUPPORTED_IMAGE.has(ext);
    const isEncrypted = ext === '.enc';
    if (!isVideo && !isImage && !isEncrypted) continue;

    try {
      const stat = await fs.stat(fullPath);
      results.push({
        name: entry.name,
        path: fullPath,
        extension: ext.replace('.', ''),
        size: stat.size,
        dateAdded: stat.birthtime.toISOString(),
        dateModified: stat.mtime.toISOString(),
        isEncrypted,
      });
    } catch {
      // skip files that can't be stat'd
    }
  }
}

ipcMain.handle('listMediaFiles', async (_event, folderPath: string) => {
  try {
    const results: any[] = [];
    await walkMediaFiles(folderPath, results);
    return results;
  } catch (error) {
    console.error('Error listing media files:', error);
    return [];
  }
});

ipcMain.handle('getStoredFolderPath', async () => {
  try {
    const configPath = getConfigPath();
    const data = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(data);
    return config.folderPath || null;
  } catch {
    return null;
  }
});

ipcMain.handle('setStoredFolderPath', async (_event, folderPath: string) =>
  updateConfigFile((config) => {
    config.folderPath = folderPath;
  })
);

ipcMain.handle('getStoredFolderPaths', async () => {
  try {
    const configPath = getConfigPath();
    const data = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(data);
    if (Array.isArray(config.folderPaths)) return config.folderPaths;
    if (typeof config.folderPath === 'string' && config.folderPath) return [config.folderPath];
    return [];
  } catch {
    return [];
  }
});

ipcMain.handle('setStoredFolderPaths', async (_event, folderPaths: string[]) =>
  updateConfigFile((config) => {
    config.folderPaths = Array.isArray(folderPaths) ? folderPaths : [];
  })
);

ipcMain.handle('getSettings', async () => {
  try {
    const configPath = getConfigPath();
    const data = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(data);
    return config.settings || null;
  } catch {
    return null;
  }
});

ipcMain.handle('setSettings', async (_event, settings: unknown) =>
  updateConfigFile((config) => {
    config.settings = settings || {};
  })
);

ipcMain.handle('checkPath', async (_event, folderPath: string) => {
  try {
    if (typeof folderPath !== 'string' || !folderPath) return false;
    if (!path.isAbsolute(folderPath)) return false;
    const stat = await fs.stat(folderPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
});

ipcMain.handle('restoreFolder', async (_event, folderPath: string) => {
  try {
    const entries = await fs.readdir(folderPath, { withFileTypes: true });
    const videos: any[] = [];

    for (const entry of entries) {
      if (entry.isDirectory()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (!SUPPORTED_VIDEO.has(ext) && !SUPPORTED_IMAGE.has(ext) && ext !== '.enc') continue;

      const isEncrypted = ext === '.enc';
      const rawExt = ext.replace('.', '');
      const isImage = SUPPORTED_IMAGE.has(ext);

      let mediaType: string;
      if (isEncrypted) {
        mediaType = isImage ? 'encrypted_image' : 'encrypted_video';
      } else {
        mediaType = isImage ? 'unencrypted_image' : 'unencrypted_video';
      }

      const fullPath = path.join(folderPath, entry.name);
      let stat;
      try { stat = await fs.stat(fullPath); } catch { continue; }

      const originalName = isEncrypted ? entry.name.replace(/\.enc$/i, '') : entry.name;

      videos.push({
        encryptedName: entry.name,
        originalName,
        extension: rawExt,
        filePath: fullPath,
        encrypted: isEncrypted,
        mediaType,
        dateAdded: stat.birthtime ? stat.birthtime.toISOString() : undefined,
        dateModified: stat.mtime ? stat.mtime.toISOString() : undefined,
        fileSize: stat.size,
      });
    }

    return videos;
  } catch (error) {
    console.error('[restoreFolder] error:', error);
    return [];
  }
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});
