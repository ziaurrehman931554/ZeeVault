import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../stores/appStore';
import { CryptoService } from '../services/cryptoService';
import { MetaService } from '../services/metaService';

interface LoginScreenProps {
  onNotify: (message: string, type?: 'success' | 'error' | 'info') => void;
  savedFolderPath?: string;
  onClearSavedFolder?: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onNotify, savedFolderPath, onClearSavedFolder }) => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [folderPath, setFolderPath] = useState(savedFolderPath || '');
  const [localError, setLocalError] = useState('');
  const [loading, setLoading] = useState(false);
  const [changingFolder, setChangingFolder] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showQuickUnlock = !!(savedFolderPath && !changingFolder);

  const {
    setCurrentScreen,
    setFolderPath: setAppFolderPath,
    setPassword: setAppPassword,
    setMetaFile,
    setVideos,
    setError: setAppError,
    setBrowserFiles,
  } = useAppStore();

  const handleFolderSelect = async () => {
    // Try Electron first (if app is packaged)
    if ((window as any).electronAPI?.selectFolder) {
      try {
        const result = await (window as any).electronAPI.selectFolder();
        if (result) {
          setFolderPath(result);
          setLocalError('');
        }
      } catch (error) {
        const message = 'Failed to select folder';
        setLocalError(message);
        onNotify(message, 'error');
      }
    } else {
      // Fallback to browser file picker for development
      fileInputRef.current?.click();
    }
  };

  const handleBrowserFolderSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (files && files.length > 0) {
      // Get the folder path from the first file
      const filePath = files[0].webkitRelativePath || '';
      const folderPath = filePath.split('/')[0];
      if (folderPath) {
        const displayPath = `${folderPath}`;
        setFolderPath(displayPath);
        setBrowserFiles(files); // Store files for later use
        setLocalError('');
        onNotify(`Selected ${displayPath}`, 'success');
      }
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderPath || !password) {
      const message = 'Please select folder and enter password';
      setLocalError(message);
      onNotify(message, 'error');
      return;
    }

    setLoading(true);
    setLocalError('');

    try {
      // Call Electron IPC to load meta file (or browser fallback)
      let metaContent;
      
      if ((window as any).electronAPI?.readMetaFile) {
        // Electron mode
        metaContent = await (window as any).electronAPI.readMetaFile(folderPath);
      } else {
        // Browser mode - read from file input
        const files = fileInputRef.current?.files;
        if (!files) {
          throw new Error('No files selected');
        }
        
        // Find vault.meta file
        let metaFile = null;
        for (let i = 0; i < files.length; i++) {
          if (files[i].name === 'vault.meta') {
            metaFile = files[i];
            break;
          }
        }
        
        if (!metaFile) {
          throw new Error('No .meta file found in selected folder');
        }
        
        metaContent = await metaFile.text();
      }

      if (!metaContent) {
        throw new Error('No .meta file found in selected folder');
      }

      const meta = MetaService.parseMeta(metaContent);

      if (!MetaService.isValidMetaFile(meta)) {
        throw new Error('Invalid .meta file format');
      }

      // Verify password
      if (!CryptoService.verifyPassword(password, meta.password_hash)) {
        throw new Error('Invalid password');
      }

      // Convert meta to videos
      const videos = MetaService.metaToVideos(meta, folderPath);

      // Store in app state
      setAppFolderPath(folderPath);
      setAppPassword(password);
      setMetaFile(meta);
      setVideos(videos);

      // Persist folder path (Electron only — browser mode can't rehydrate FileList)
      if ((window as any).electronAPI?.readMetaFile) {
        try { localStorage.setItem('vault-folder-path', folderPath); } catch {}
      }

      // Switch to gallery screen
      setCurrentScreen('gallery');
      onNotify('Vault unlocked successfully.', 'success');
      navigate('/app/gallery');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed';
      setLocalError(message);
      setAppError(message);
      onNotify(message, 'error');
    } finally {
      setLoading(false);
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
          {showQuickUnlock ? (
            <p>Quick unlock</p>
          ) : (
            <p>Unlock your encrypted videos</p>
          )}
        </div>

        <form onSubmit={handleLogin} className="vault-form">
          {showQuickUnlock ? (
            <>
              <div className="field-group quick-folder">
                <label>Folder</label>
                <div className="folder-display">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width="18" height="18">
                    <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                  </svg>
                  <span className="folder-name">{savedFolderPath}</span>
                </div>
                <button type="button" className="link-btn" onClick={() => { setChangingFolder(true); setFolderPath(''); onClearSavedFolder?.(); }}>
                  Change folder
                </button>
              </div>
              <div className="field-group">
                <label>Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter vault password"
                  autoFocus
                />
              </div>
            </>
          ) : (
            <>
              <div className="field-group">
                <label>Folder Path</label>
                <div className="folder-row">
                  <input
                    type="text"
                    value={folderPath}
                    onChange={(e) => setFolderPath(e.target.value)}
                    placeholder="Select folder containing vault.meta"
                    readOnly
                  />
                  <button type="button" onClick={handleFolderSelect}>
                    Browse
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

              <div className="field-group">
                <label>Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter vault password"
                />
              </div>
            </>
          )}

          {localError && <div className="form-error">{localError}</div>}

          <button type="submit" disabled={loading} className="primary-button">
            {loading ? (
              <span className="button-loader">
                <span />
                Unlocking...
              </span>
            ) : (
              'Unlock Vault'
            )}
          </button>
        </form>

        <p className="login-note">
          Your password is never stored. It is verified locally only.
        </p>
      </div>
    </div>
  );
};

export default LoginScreen;
