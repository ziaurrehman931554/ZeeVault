import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../stores/appStore';
import { MediaScanner } from '../services/mediaScanner';

interface LoginScreenProps {
  onNotify: (message: string, type?: 'success' | 'error' | 'info') => void;
  savedFolderPath?: string;
  onClearSavedFolder?: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onNotify, savedFolderPath, onClearSavedFolder }) => {
  const navigate = useNavigate();
  const [folderPath, setFolderPath] = useState(savedFolderPath || '');
  const [localError, setLocalError] = useState('');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    setCurrentScreen,
    setFolderPath: setAppFolderPath,
    setMetaFile,
    setVideos,
    setError: setAppError,
    setBrowserFiles,
    setHasEncryptedContent,
  } = useAppStore();

  const processFolder = useCallback(async (path: string, files?: FileList) => {
    setLoading(true);
    setLocalError('');

    try {
      const metaContent = await MediaScanner.readMetaContent(path, files);
      let encryptedVideos: any[] = [];
      let metaFile = null;
      let hasEncrypted = false;

      if (metaContent) {
        metaFile = MediaScanner.parseMeta(metaContent);
        if (MediaScanner.isValidMetaFile(metaFile)) {
          hasEncrypted = true;
          encryptedVideos = MediaScanner.metaToEncryptedVideos(metaFile, path);
        }
      }

      const scannedFiles = await MediaScanner.scanFolderFiles(path, files);
      const unencryptedVideos = MediaScanner.scannedToUnencryptedVideos(scannedFiles, path);
      const allVideos = MediaScanner.mergeMedia(encryptedVideos, unencryptedVideos);

      setAppFolderPath(path);
      setMetaFile(metaFile);
      setVideos(allVideos);
      setHasEncryptedContent(hasEncrypted);

      if (files) {
        setBrowserFiles(files);
      }

      try {
        if ((window as any).electronAPI?.setStoredFolderPath) {
          await (window as any).electronAPI.setStoredFolderPath(path);
        } else {
          localStorage.setItem('vault-folder-path', path);
        }
      } catch (e) {
        console.error('Failed to save folder path:', e);
      }
      setCurrentScreen('gallery');
      onNotify(`Found ${allVideos.length} media files`, 'success');
      navigate('/app/gallery');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to read folder';
      setLocalError(message);
      setAppError(message);
      onNotify(message, 'error');
    } finally {
      setLoading(false);
    }
  }, [setAppFolderPath, setMetaFile, setVideos, setHasEncryptedContent, setBrowserFiles, setCurrentScreen, setAppError, onNotify, navigate]);

  const handleFolderSelect = async () => {
    if ((window as any).electronAPI?.selectFolder) {
      try {
        const result = await (window as any).electronAPI.selectFolder();
        if (result) {
          setFolderPath(result);
          setLocalError('');
          await processFolder(result);
        }
      } catch (error) {
        const message = 'Failed to select folder';
        setLocalError(message);
        onNotify(message, 'error');
      }
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleBrowserFolderSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (files && files.length > 0) {
      const filePath = files[0].webkitRelativePath || '';
      const folderPath = filePath.split('/')[0];
      if (folderPath) {
        const displayPath = folderPath;
        setFolderPath(displayPath);
        setLocalError('');
        onNotify(`Selected ${displayPath}`, 'success');
        await processFolder(displayPath, files);
      }
    }
  };

  return (
    <div className="login-page">
      <div className="login-card glass-panel">
        <div className="login-header">
          <div className="brand-lockup vertical" aria-label="ZeeVault">
            <div className="brand-mark large">
              <span>Z</span>
              <span>V</span>
            </div>
            <h1>
              <span>Z</span>ee<span>V</span>ault
            </h1>
          </div>
          <p>Open your media folder to get started</p>
        </div>

        <div className="vault-form">
          <div className="field-group">
            <label>Folder Path</label>
            <div className="folder-row">
              <input
                type="text"
                value={folderPath}
                onChange={(e) => setFolderPath(e.target.value)}
                placeholder="Select or enter folder path"
                readOnly
              />
              <button type="button" onClick={handleFolderSelect} disabled={loading}>
                {loading ? '...' : 'Browse'}
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              webkitdirectory="true"
              onChange={handleBrowserFolderSelect}
              style={{ display: 'none' }}
            />
          </div>

          {savedFolderPath && (
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                setFolderPath('');
                onClearSavedFolder?.();
              }}
              style={{ marginTop: '-14px' }}
            >
              Clear saved folder
            </button>
          )}

          {localError && <div className="form-error">{localError}</div>}

          {loading && (
            <div className="button-loader" style={{ justifyContent: 'center', padding: '12px 0' }}>
              <span />
              <span style={{ color: 'var(--muted)', fontSize: '14px' }}>Scanning folder...</span>
            </div>
          )}
        </div>

        <p className="login-note">
          Select a folder with videos, images, or encrypted media. Encrypted files will require a password to view.
        </p>
      </div>
    </div>
  );
};

export default LoginScreen;
