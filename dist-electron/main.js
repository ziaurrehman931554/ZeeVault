import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let mainWindow = null;
const createWindow = () => {
    mainWindow = new BrowserWindow({
        title: 'ZeeVault',
        icon: path.join(__dirname, '../ZeeVault.png'),
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
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
app.on('ready', createWindow);
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
        title: 'Select Folder with Encrypted Videos',
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
// Handle any uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});
