import { app, BrowserWindow, dialog, ipcMain, Menu } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const getConfigPath = () => {
    return path.join(app.getPath('userData'), 'zeevault-config.json');
};
let mainWindow = null;
const createWindow = () => {
    Menu.setApplicationMenu(null);
    mainWindow = new BrowserWindow({
        title: 'ZeeVault',
        icon: path.join(__dirname, '../dist/ZeeVault.png'),
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });
    const isDev = process.env.NODE_ENV === 'development';
    const startUrl = isDev
        ? 'http://localhost:5173'
        : `file://${path.join(__dirname, '../dist/index.html')}`;
    mainWindow.loadURL(startUrl);
    if (isDev) {
        mainWindow.webContents.openDevTools();
    }
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
};
app.on('ready', () => {
    createWindow();
});
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});
// IPC Handlers
ipcMain.handle('selectFolder', async () => {
    if (!mainWindow)
        return null;
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
        title: 'Select Folder with Videos',
        buttonLabel: 'Select',
    });
    if (result.canceled)
        return null;
    return result.filePaths[0];
});
ipcMain.handle('readMetaFile', async (_event, folderPath) => {
    try {
        const metaPath = path.join(folderPath, 'vault.meta');
        const content = await fs.readFile(metaPath, 'utf-8');
        return content;
    }
    catch (error) {
        console.error('Error reading meta file:', error);
        return null;
    }
});
ipcMain.handle('readFile', async (_event, filePath) => {
    try {
        const buffer = await fs.readFile(filePath);
        return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    }
    catch (error) {
        console.error('Error reading file:', error);
        throw error;
    }
});
ipcMain.handle('fileExists', async (_event, filePath) => {
    try {
        await fs.access(filePath);
        return true;
    }
    catch {
        return false;
    }
});
const SUPPORTED_VIDEO = new Set(['.mp4', '.webm', '.mkv', '.avi', '.mov', '.wmv', '.m4v', '.mpeg', '.mpg', '.ogv', '.3gp', '.flv', '.ts']);
const SUPPORTED_IMAGE = new Set(['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.tif', '.webp']);
ipcMain.handle('listMediaFiles', async (_event, folderPath) => {
    try {
        const entries = await fs.readdir(folderPath, { withFileTypes: true });
        const results = [];
        for (const entry of entries) {
            if (entry.isDirectory())
                continue;
            const ext = path.extname(entry.name).toLowerCase();
            const isVideo = SUPPORTED_VIDEO.has(ext);
            const isImage = SUPPORTED_IMAGE.has(ext);
            const isEncrypted = ext === '.enc';
            if (!isVideo && !isImage && !isEncrypted)
                continue;
            const fullPath = path.join(folderPath, entry.name);
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
            }
            catch {
                // skip files that can't be stat'd
            }
        }
        return results;
    }
    catch (error) {
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
    }
    catch {
        return null;
    }
});
ipcMain.handle('setStoredFolderPath', async (_event, folderPath) => {
    try {
        const configPath = getConfigPath();
        await fs.writeFile(configPath, JSON.stringify({ folderPath }), 'utf-8');
        return true;
    }
    catch {
        return false;
    }
});
ipcMain.handle('checkPath', async (_event, folderPath) => {
    try {
        if (typeof folderPath !== 'string' || !folderPath)
            return false;
        if (!path.isAbsolute(folderPath))
            return false;
        const stat = await fs.stat(folderPath);
        return stat.isDirectory();
    }
    catch {
        return false;
    }
});
ipcMain.handle('restoreFolder', async (_event, folderPath) => {
    try {
        const entries = await fs.readdir(folderPath, { withFileTypes: true });
        const videos = [];
        for (const entry of entries) {
            if (entry.isDirectory())
                continue;
            const ext = path.extname(entry.name).toLowerCase();
            if (!SUPPORTED_VIDEO.has(ext) && !SUPPORTED_IMAGE.has(ext) && ext !== '.enc')
                continue;
            const isEncrypted = ext === '.enc';
            const rawExt = ext.replace('.', '');
            const isImage = SUPPORTED_IMAGE.has(ext);
            let mediaType;
            if (isEncrypted) {
                mediaType = isImage ? 'encrypted_image' : 'encrypted_video';
            }
            else {
                mediaType = isImage ? 'unencrypted_image' : 'unencrypted_video';
            }
            const fullPath = path.join(folderPath, entry.name);
            let stat;
            try {
                stat = await fs.stat(fullPath);
            }
            catch {
                continue;
            }
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
    }
    catch (error) {
        console.error('[restoreFolder] error:', error);
        return [];
    }
});
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});
