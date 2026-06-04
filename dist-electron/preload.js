import { contextBridge, ipcRenderer } from 'electron';
contextBridge.exposeInMainWorld('electronAPI', {
    selectFolder: async () => {
        try {
            return await ipcRenderer.invoke('selectFolder');
        }
        catch (error) {
            console.error('Error in selectFolder:', error);
            return null;
        }
    },
    readMetaFile: async (folderPath) => {
        try {
            return await ipcRenderer.invoke('readMetaFile', folderPath);
        }
        catch (error) {
            console.error('Error in readMetaFile:', error);
            return null;
        }
    },
    readFile: async (filePath) => {
        try {
            return await ipcRenderer.invoke('readFile', filePath);
        }
        catch (error) {
            console.error('Error in readFile:', error);
            throw error;
        }
    },
});
