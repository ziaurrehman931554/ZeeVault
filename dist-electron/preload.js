"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    selectFolder: async () => {
        try {
            return await electron_1.ipcRenderer.invoke('selectFolder');
        }
        catch (error) {
            console.error('Error in selectFolder:', error);
            return null;
        }
    },
    readMetaFile: async (folderPath) => {
        try {
            return await electron_1.ipcRenderer.invoke('readMetaFile', folderPath);
        }
        catch (error) {
            console.error('Error in readMetaFile:', error);
            return null;
        }
    },
    readFile: async (filePath) => {
        try {
            return await electron_1.ipcRenderer.invoke('readFile', filePath);
        }
        catch (error) {
            console.error('Error in readFile:', error);
            throw error;
        }
    },
    fileExists: async (filePath) => {
        try {
            return await electron_1.ipcRenderer.invoke('fileExists', filePath);
        }
        catch {
            return false;
        }
    },
    listMediaFiles: async (folderPath) => {
        try {
            return await electron_1.ipcRenderer.invoke('listMediaFiles', folderPath);
        }
        catch (error) {
            console.error('Error in listMediaFiles:', error);
            return [];
        }
    },
    getStoredFolderPath: async () => {
        try {
            return await electron_1.ipcRenderer.invoke('getStoredFolderPath');
        }
        catch {
            return null;
        }
    },
    setStoredFolderPath: async (folderPath) => {
        try {
            return await electron_1.ipcRenderer.invoke('setStoredFolderPath', folderPath);
        }
        catch {
            return false;
        }
    },
    checkPath: async (folderPath) => {
        try {
            return await electron_1.ipcRenderer.invoke('checkPath', folderPath);
        }
        catch {
            return false;
        }
    },
    restoreFolder: async (folderPath) => {
        try {
            return await electron_1.ipcRenderer.invoke('restoreFolder', folderPath);
        }
        catch (error) {
            console.error('Error in restoreFolder:', error);
            return [];
        }
    },
});
