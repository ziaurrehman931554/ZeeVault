import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../stores/appStore';
import { MediaScanner } from '../services/mediaScanner';
import { MetaFile } from '../types/index';

interface SelectedFolder {
  path: string;
  files: File[];
}

interface LoginScreenProps {
  onNotify: (message: string, type?: 'success' | 'error' | 'info') => void;
  savedFolderPaths?: string[];
  onClearSavedFolders?: () => void;
  autoStart?: boolean;
  onAutoStart?: () => void;
}

const folderDisplayName = (path: string): string => {
  const parts = path.split(/[\\/]+/).filter(Boolean);
  return parts[parts.length - 1] || path;
};

const LoginScreen: React.FC<LoginScreenProps> = ({
  onNotify, savedFolderPaths, onClearSavedFolders, autoStart = true, onAutoStart,
}) => {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<SelectedFolder[]>(() =>
    (savedFolderPaths || []).map((path) => ({ path, files: [] }))
  );
  const [localError, setLocalError] = useState('');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const allFilesRef = useRef<File[]>([]);
  const autoStartedRef = useRef(false);

  const {
    setCurrentScreen,
    setFolderPaths,
    setMetas,
    setVideos,
    setError: setAppError,
    setBrowserFiles,
  } = useAppStore();

  const addFolders = useCallback((paths: string[]) => {
    setSelected((prev) => {
      const existing = new Set(prev.map((s) => s.path.toLowerCase()));
      const next = [...prev];
      for (const path of paths) {
        if (path && !existing.has(path.toLowerCase())) {
          existing.add(path.toLowerCase());
          next.push({ path, files: [] });
        }
      }
      return next;
    });
    setLocalError('');
  }, []);

  const scanFolder = useCallback(async (folderPath: string, files: File[]): Promise<{
    videos: any[];
    meta: MetaFile | null;
  }> => {
    const isBrowser = files.length > 0;
    const scannedFiles = await MediaScanner.scanFolderFiles(folderPath, files, isBrowser ? folderPath : undefined);

    const metaContent = await MediaScanner.readMetaContent(folderPath, files, folderPath);
    let encryptedVideos: any[] = [];
    let meta: MetaFile | null = null;

    if (metaContent) {
      meta = MediaScanner.parseMeta(metaContent);
      if (MediaScanner.isValidMetaFile(meta)) {
        const encPathByName = new Map<string, string>();
        for (const f of scannedFiles) {
          if (f.isEncrypted) encPathByName.set(f.name.toLowerCase(), f.path);
        }
        encryptedVideos = MediaScanner.metaToEncryptedVideos(
          meta,
          folderPath,
          (encryptedName) => encPathByName.get(encryptedName.toLowerCase()) ?? `${folderPath}\\${encryptedName}`
        );
      } else {
        meta = null;
      }
    }

    const unencryptedVideos = MediaScanner.scannedToUnencryptedVideos(scannedFiles, folderPath);
    const allVideos = MediaScanner.mergeMedia(encryptedVideos, unencryptedVideos);

    return { videos: allVideos, meta };
  }, []);

  const handleContinue = useCallback(async () => {
    if (selected.length === 0) return;

    setLoading(true);
    setLocalError('');

    try {
      const folderPaths: string[] = [];
      const metas: Record<string, MetaFile | null> = {};
      let allVideos: any[] = [];
      let failed = 0;

      for (const folder of selected) {
        try {
          const { videos, meta } = await scanFolder(folder.path, folder.files);
          folderPaths.push(folder.path);
          metas[folder.path] = meta;
          allVideos = allVideos.concat(videos);
        } catch (e) {
          failed++;
          const message = e instanceof Error ? e.message : 'Failed to read folder';
          onNotify(`Could not open "${folderDisplayName(folder.path)}": ${message}`, 'error');
        }
      }

      if (folderPaths.length === 0) {
        setLocalError('No valid folders were selected.');
        onNotify('No valid folders were selected', 'error');
        return;
      }

      // Keep ids unique across folders (they reuse file paths, but guard anyway).
      const seenIds = new Set<string>();
      allVideos = allVideos.filter((v) => {
        if (seenIds.has(v.id)) return false;
        seenIds.add(v.id);
        return true;
      });

      setFolderPaths(folderPaths);
      setMetas(metas);
      setVideos(allVideos);
      setBrowserFiles(allFilesRef.current.length > 0 ? allFilesRef.current : undefined);

      try {
        if ((window as any).electronAPI?.setStoredFolderPaths) {
          await (window as any).electronAPI.setStoredFolderPaths(folderPaths);
        } else {
          localStorage.setItem('vault-folder-paths', JSON.stringify(folderPaths));
        }
      } catch (e) {
        console.error('Failed to save folder paths:', e);
      }

      setCurrentScreen('gallery');
      onAutoStart?.();
      onNotify(
        failed
          ? `Loaded ${allVideos.length} media files from ${folderPaths.length} folder${folderPaths.length !== 1 ? 's' : ''} (${failed} skipped)`
          : `Found ${allVideos.length} media files in ${folderPaths.length} folder${folderPaths.length !== 1 ? 's' : ''}`,
        'success'
      );
      navigate('/app/gallery');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to read folders';
      setLocalError(message);
      setAppError(message);
      onNotify(message, 'error');
    } finally {
      setLoading(false);
    }
  }, [selected, scanFolder, onNotify, onAutoStart, setAppError, setCurrentScreen, setFolderPaths, setMetas, setVideos, setBrowserFiles, navigate]);

  // Reopen: if folders were already saved, auto-load them straight into the
  // gallery without forcing the user to pick folders again. Only runs once per
  // session (not after logout), gated by the `autoStart` prop.
  useEffect(() => {
    if (!autoStart) return;
    if (autoStartedRef.current) return;
    if (!savedFolderPaths || savedFolderPaths.length === 0) return;
    autoStartedRef.current = true;
    void handleContinue();
  }, [savedFolderPaths, handleContinue, autoStart]);

  const handleFolderSelect = async () => {
    if ((window as any).electronAPI?.selectFolders) {
      try {
        const result = await (window as any).electronAPI.selectFolders();
        if (result && result.length > 0) {
          addFolders(result);
          onNotify(`Added ${result.length} folder${result.length !== 1 ? 's' : ''}`, 'success');
        }
      } catch (error) {
        onNotify('Failed to select folders', 'error');
      }
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleBrowserFolderSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (!files || files.length === 0) return;

    const byFolder = new Map<string, File[]>();
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const relPath = file.webkitRelativePath || file.name;
      const folderName = relPath.split('/')[0];
      if (!folderName) continue;
      const list = byFolder.get(folderName) || [];
      list.push(file);
      byFolder.set(folderName, list);
    }

    const newFolders: SelectedFolder[] = [];
    byFolder.forEach((folderFiles, folderName) => {
      newFolders.push({ path: folderName, files: folderFiles });
      allFilesRef.current = allFilesRef.current.concat(folderFiles);
    });

    setSelected((prev) => {
      const existing = new Set(prev.map((s) => s.path.toLowerCase()));
      const next = [...prev];
      for (const folder of newFolders) {
        if (!existing.has(folder.path.toLowerCase())) {
          existing.add(folder.path.toLowerCase());
          next.push(folder);
        }
      }
      return next;
    });

    onNotify(`Added ${newFolders.length} folder${newFolders.length !== 1 ? 's' : ''}`, 'success');
    e.currentTarget.value = '';
  }, [onNotify]);

  const handleRemove = useCallback((index: number) => {
    setSelected((prev) => {
      const removed = prev[index];
      if (!removed) return prev;
      const removedFiles = new Set(removed.files.map((f) => f.webkitRelativePath || f.name));
      allFilesRef.current = allFilesRef.current.filter((f) => !removedFiles.has(f.webkitRelativePath || f.name));
      return prev.filter((_, i) => i !== index);
    });
  }, []);

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
          <p>Add one or more media folders to get started</p>
        </div>

        <div className="vault-form">
          <div className="field-group">
            <label>Selected Folders{selected.length > 0 ? ` (${selected.length})` : ''}</label>
            {selected.length === 0 ? (
              <p className="folder-empty-hint">Please select at least one folder to continue.</p>
            ) : (
              <div className={`folder-list${selected.length > 4 ? ' grid' : ''}`}>
                {selected.map((folder, index) => (
                  <div key={`${folder.path}-${index}`} className="folder-chip" title={folder.path}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width="16" height="16">
                      <path d="M3 7.5A2.5 2.5 0 015.5 5H10l2 2h6.5A2.5 2.5 0 0121 9.5v7A2.5 2.5 0 0118.5 19h-13A2.5 2.5 0 013 16.5v-9z" />
                    </svg>
                    <span className="folder-chip-name">{folderDisplayName(folder.path)}</span>
                    <button
                      type="button"
                      className="folder-chip-remove"
                      onClick={() => handleRemove(index)}
                      title="Remove folder"
                      disabled={loading}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width="14" height="14">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="field-group">
            <button type="button" className="add-folder-btn" onClick={handleFolderSelect} disabled={loading}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width="16" height="16">
                <path d="M12 8v8M8 12h8" />
                <path d="M3 7.5A2.5 2.5 0 015.5 5H10l2 2h6.5A2.5 2.5 0 0121 9.5v7A2.5 2.5 0 0118.5 19h-13A2.5 2.5 0 013 16.5v-9z" />
              </svg>
              {selected.length === 0 ? 'Select a folder' : 'Add another folder'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              webkitdirectory="true"
              multiple={true}
              onChange={handleBrowserFolderSelect}
              style={{ display: 'none' }}
            />
          </div>

          {savedFolderPaths && savedFolderPaths.length > 0 && (
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                allFilesRef.current = [];
                setSelected([]);
                onClearSavedFolders?.();
              }}
            >
              Clear saved folders
            </button>
          )}

          {localError && <div className="form-error">{localError}</div>}

          <div className="field-group">
            <button
              type="button"
              className="primary-button continue-btn"
              onClick={handleContinue}
              disabled={selected.length === 0 || loading}
            >
              {loading ? 'Scanning folders...' : `Continue with ${selected.length} folder${selected.length !== 1 ? 's' : ''}`}
            </button>
            {loading && (
              <div className="button-loader" style={{ justifyContent: 'center', padding: '6px 0' }}>
                <span />
              </div>
            )}
          </div>
        </div>

        <p className="login-note">
          Select one or more folders with videos, images, or encrypted media. Encrypted folders are unlocked per-folder with
          its password when you play content.
        </p>
      </div>
    </div>
  );
};

export default LoginScreen;