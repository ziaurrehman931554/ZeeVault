import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: async () => {
    try {
      return await ipcRenderer.invoke('selectFolder');
    } catch (error) {
      console.error('Error in selectFolder:', error);
      return null;
    }
  },

  selectFolders: async () => {
    try {
      return await ipcRenderer.invoke('selectFolders');
    } catch (error) {
      console.error('Error in selectFolders:', error);
      return [];
    }
  },

  readMetaFile: async (folderPath: string) => {
    try {
      return await ipcRenderer.invoke('readMetaFile', folderPath);
    } catch (error) {
      console.error('Error in readMetaFile:', error);
      return null;
    }
  },

  readFile: async (filePath: string) => {
    try {
      return await ipcRenderer.invoke('readFile', filePath);
    } catch (error) {
      console.error('Error in readFile:', error);
      throw error;
    }
  },

  readFileChunk: async (filePath: string, offset: number, length: number) => {
    try {
      return await ipcRenderer.invoke('readFileChunk', filePath, offset, length);
    } catch (error) {
      console.error('Error in readFileChunk:', error);
      throw error;
    }
  },

  getFileSize: async (filePath: string) => {
    try {
      return await ipcRenderer.invoke('getFileSize', filePath);
    } catch {
      return -1;
    }
  },

  fileExists: async (filePath: string) => {
    try {
      return await ipcRenderer.invoke('fileExists', filePath);
    } catch {
      return false;
    }
  },

  listMediaFiles: async (folderPath: string) => {
    try {
      return await ipcRenderer.invoke('listMediaFiles', folderPath);
    } catch (error) {
      console.error('Error in listMediaFiles:', error);
      return [];
    }
  },

  getStoredFolderPath: async () => {
    try {
      return await ipcRenderer.invoke('getStoredFolderPath');
    } catch {
      return null;
    }
  },

  setStoredFolderPath: async (folderPath: string) => {
    try {
      return await ipcRenderer.invoke('setStoredFolderPath', folderPath);
    } catch {
      return false;
    }
  },

  getStoredFolderPaths: async () => {
    try {
      return await ipcRenderer.invoke('getStoredFolderPaths');
    } catch {
      return [];
    }
  },

  setStoredFolderPaths: async (folderPaths: string[]) => {
    try {
      return await ipcRenderer.invoke('setStoredFolderPaths', folderPaths);
    } catch {
      return false;
    }
  },

  getSettings: async () => {
    try {
      return await ipcRenderer.invoke('getSettings');
    } catch {
      return null;
    }
  },

  setSettings: async (settings: unknown) => {
    try {
      return await ipcRenderer.invoke('setSettings', settings);
    } catch {
      return false;
    }
  },

  checkPath: async (folderPath: string) => {
    try {
      return await ipcRenderer.invoke('checkPath', folderPath);
    } catch {
      return false;
    }
  },

  restoreFolder: async (folderPath: string) => {
    try {
      return await ipcRenderer.invoke('restoreFolder', folderPath);
    } catch (error) {
      console.error('Error in restoreFolder:', error);
      return [];
    }
  },
});
