import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { MetaFile, MetaVideoEntry } from '../types/index';
import { ScannedFile } from '../services/mediaScanner';
import { MetaService } from '../services/metaService';

type OperationTab = 'encrypt' | 'decrypt';
type ListedMedia = ScannedFile & { originalName?: string; missing?: boolean };
type OperationProgress = { operation: OperationTab; completed: number; total: number; currentName: string };

interface FileOperationsScreenProps {
  onBack: () => void;
  onFolderChanged: (folderPath: string) => Promise<void>;
}

const normalizePath = (value: string) => value.replace(/\\/g, '/').replace(/^\.\//, '').toLowerCase();

const readableSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let size = bytes / 1024;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) { size /= 1024; unit++; }
  return `${size.toFixed(size >= 10 ? 1 : 2)} ${units[unit]}`;
};

const readableDate = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : '';
};

const entryDetails = (entry: MetaVideoEntry | string, encryptedKey: string) => {
  if (typeof entry === 'string') return { originalName: entry, originalRelativePath: entry };
  const originalName = entry.originalName || entry.name || entry.filename || encryptedKey.replace(/\.enc$/i, '');
  return {
    originalName,
    originalRelativePath: entry.originalRelativePath || originalName,
    fileSize: entry.fileSize,
    dateAdded: entry.dateAdded,
    dateModified: entry.dateModified,
  };
};

const FileOperationsScreen: React.FC<FileOperationsScreenProps> = ({ onBack, onFolderChanged }) => {
  const [tab, setTab] = useState<OperationTab>('encrypt');
  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [files, setFiles] = useState<ListedMedia[]>([]);
  const [manifest, setManifest] = useState<MetaFile | null>(null);
  const [vaultMetaExists, setVaultMetaExists] = useState(false);
  const [portableOptionVisible, setPortableOptionVisible] = useState(false);
  const [portableScript, setPortableScript] = useState(false);
  const [loadingFolder, setLoadingFolder] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [progress, setProgress] = useState<OperationProgress | null>(null);

  useEffect(() => {
    const unsubscribe = (window as any).electronAPI?.onVaultOperationProgress?.((next: OperationProgress) => setProgress(next));
    return () => unsubscribe?.();
  }, []);

  const loadFolder = useCallback(async (selectedPath: string, operation: OperationTab) => {
    const api = (window as any).electronAPI;
    setLoadingFolder(true);
    setError(null);
    setResult(null);
    setManifest(null);
    setVaultMetaExists(false);
    try {
      const scanned: ScannedFile[] = await api.listVaultMediaFiles(selectedPath);
      if (operation === 'encrypt') {
        const rawMeta = await api.readMetaFile(selectedPath);
        setVaultMetaExists(Boolean(rawMeta));
        setPortableOptionVisible(!rawMeta);
        let existing: MetaFile | null = null;
        if (rawMeta) {
          try {
            existing = MetaService.parseMeta(rawMeta);
          } catch {
            setError('The folder contains a vault.meta file that could not be read. Resolve it before encrypting.');
          }
        }
        const alreadyTracked = new Set(Object.values(existing?.files || {}).map((entry) =>
          (typeof entry === 'string' ? entry : entry.originalName || entry.name || entry.filename || '').toLowerCase()));
        const available = scanned.filter((file) => !file.isEncrypted && !alreadyTracked.has(file.name.toLowerCase()));
        setFiles(available);
        if (!available.length) setError(scanned.some((file) => file.isEncrypted)
          ? 'This folder has no new media files to encrypt. Switch to the Decryption tab to restore its encrypted files.'
          : 'No supported media files were found in this folder.');
      } else {
        setVaultMetaExists(false);
        setPortableOptionVisible(false);
        const rawMeta = await api.readMetaFile(selectedPath);
        if (!rawMeta) {
          setFiles([]);
          setError('No vault.meta file was found in this folder.');
        } else {
          const parsed = MetaService.parseMeta(rawMeta);
          if (!MetaService.validateMeta(parsed)) {
            setFiles([]);
            setError('The vault.meta file is missing a valid encrypted file manifest.');
          } else {
            setManifest(parsed);
            const scannedEncrypted = scanned.filter((file) => file.isEncrypted);
            const listed = Object.entries(parsed.files).map(([encryptedKey, entry]) => {
              const details = entryDetails(entry, encryptedKey);
              const wanted = normalizePath(encryptedKey);
              const found = scannedEncrypted.find((file) => {
                const relativePath = file.path.slice(selectedPath.length).replace(/^[/\\]+/, '');
                return normalizePath(relativePath) === wanted || normalizePath(file.name) === normalizePath(encryptedKey.split(/[\\/]/).pop() || encryptedKey);
              });
              return {
                name: found?.name || encryptedKey.split(/[\\/]/).pop() || encryptedKey,
                path: found?.path || encryptedKey,
                extension: 'enc',
                size: details.fileSize ?? found?.size ?? 0,
                dateAdded: details.dateAdded || found?.dateAdded || '',
                dateModified: details.dateModified || found?.dateModified || '',
                isEncrypted: true,
                originalName: details.originalName,
                missing: !found,
              };
            });
            setFiles(listed);
            const missingCount = listed.filter((file) => file.missing).length;
            if (missingCount) setError(`${missingCount} file${missingCount === 1 ? '' : 's'} listed in vault.meta could not be found in this folder.`);
          }
        }
      }
      setFolderPath(selectedPath);
    } catch (loadError) {
      setFiles([]);
      setManifest(null);
      setError(loadError instanceof Error ? loadError.message : 'Could not read the selected folder.');
    } finally {
      setLoadingFolder(false);
    }
  }, []);

  const chooseFolder = async () => {
    const selected = await (window as any).electronAPI?.selectFolder?.();
    if (selected) await loadFolder(selected, tab);
  };

  const switchTab = (nextTab: OperationTab) => {
    if (working) return;
    setTab(nextTab);
    setFolderPath(null);
    setFiles([]);
    setManifest(null);
    setVaultMetaExists(false);
    setPortableOptionVisible(false);
    setPortableScript(false);
    setError(null);
    setResult(null);
    setProgress(null);
  };

  const canStart = useMemo(() => {
    if (!folderPath || loadingFolder || working || !files.length || error) return false;
    return tab === 'encrypt' || (Boolean(manifest) && files.every((file) => !file.missing));
  }, [folderPath, loadingFolder, working, files, error, tab, manifest]);

  const submitOperation = async () => {
    if (!password.length) { setPasswordError('Enter a password to continue.'); return; }
    if (tab === 'encrypt' && !vaultMetaExists && password !== confirmPassword) { setPasswordError('The passwords do not match.'); return; }
    if (!folderPath) return;

    const operation = tab;
    const startedAt = performance.now();
    let retryPassword = false;
    let elapsedSeconds = 0;
    setWorking(true);
    setPasswordError(null);
    setError(null);
    setResult(null);
    setProgress({ operation: tab, completed: 0, total: files.length, currentName: '' });
    try {
      const response = operation === 'encrypt'
        ? await (window as any).electronAPI.encryptFolder(folderPath, password, portableScript)
        : await (window as any).electronAPI.decryptFolder(folderPath, password);
      elapsedSeconds = Math.max(0.1, (performance.now() - startedAt) / 1000);
      await onFolderChanged(folderPath);
      setPasswordOpen(false);
      if (operation === 'encrypt') {
        const videos = files.filter((file) => /\.(mp4|mkv|avi|mov|wmv|m4v|mpeg|mpg|ogv|3gp|flv|ts)$/i.test(file.name)).length;
        const photos = Math.max(0, response.count - videos);
        setFiles([]);
        setVaultMetaExists(true);
        setPortableOptionVisible(false);
        setError(null);
        setResult(`Encryption complete: ${response.count} files encrypted (${videos} ${videos === 1 ? 'video' : 'videos'}, ${photos} ${photos === 1 ? 'photo' : 'photos'}) in ${elapsedSeconds.toFixed(1)} seconds.`);
      } else {
        const videos = files.filter((file) => /\.(mp4|mkv|avi|mov|wmv|m4v|mpeg|mpg|ogv|3gp|flv|ts)$/i.test(file.originalName || file.name)).length;
        const photos = Math.max(0, response.count - videos);
        setFiles([]);
        setManifest(null);
        setError(null);
        setResult(`Decryption complete: ${response.count} files restored (${videos} ${videos === 1 ? 'video' : 'videos'}, ${photos} ${photos === 1 ? 'photo' : 'photos'}) in ${elapsedSeconds.toFixed(1)} seconds.`);
      }
    } catch (operationError) {
      const message = operationError instanceof Error ? operationError.message : 'The operation failed.';
      if (/incorrect|previously used|wrong password|invalid password/i.test(message)) {
        retryPassword = true;
        setPassword('');
        setConfirmPassword('');
        setPasswordError('That password is incorrect. Please try again.');
        setPasswordOpen(true);
      } else {
        setPasswordOpen(false);
        await loadFolder(folderPath, operation);
        setError(message);
      }
    } finally {
      if (!retryPassword) {
        setPassword('');
        setConfirmPassword('');
      }
      setWorking(false);
      setProgress(null);
    }
  };

  const openPasswordDialog = () => {
    if (!canStart) return;
    setPassword('');
    setConfirmPassword('');
    setPasswordError(null);
    setPasswordOpen(true);
  };

  return (
    <div className="file-operations-page">
      <div className="file-operations-heading">
        <button type="button" className="back-button settings-back" onClick={onBack} aria-label="Back to gallery" title="Back to gallery">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width="18" height="18"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <div><p className="eyebrow">ZeeVault</p><h2>Encrypt &amp; decrypt files</h2><p className="file-operations-subtitle">Process media folders directly on this device.</p></div>
      </div>

      <div className="file-operations-card">
        <div className="file-operations-tabs" role="tablist" aria-label="File operation">
          <button type="button" role="tab" aria-selected={tab === 'encrypt'} className={tab === 'encrypt' ? 'active' : ''} onClick={() => switchTab('encrypt')}>Encrypt</button>
          <button type="button" role="tab" aria-selected={tab === 'decrypt'} className={tab === 'decrypt' ? 'active' : ''} onClick={() => switchTab('decrypt')}>Decrypt</button>
        </div>

        <div className="file-operations-intro">
          <div className={`file-operation-icon ${tab}`} aria-hidden="true">{tab === 'encrypt' ? '🔒' : '🔓'}</div>
          <div><h3>{tab === 'encrypt' ? 'Encrypt a folder' : 'Restore an encrypted folder'}</h3><p>{tab === 'encrypt' ? 'Supported videos and images are encrypted in place and listed in a new vault.meta manifest.' : 'Choose a folder with vault.meta to inspect the encrypted files and restore their original names.'}</p></div>
        </div>

        <div className="file-operations-picker">
          <div className="file-operations-selected-path"><span className="eyebrow">Selected folder</span><strong title={folderPath || undefined}>{folderPath || 'No folder selected'}</strong></div>
          <button type="button" className="settings-btn" onClick={chooseFolder} disabled={loadingFolder || working}>{loadingFolder ? 'Scanning…' : 'Select folder'}</button>
        </div>

        {tab === 'encrypt' && folderPath && portableOptionVisible && (
          <label className="file-operations-portable-option">
            <input type="checkbox" checked={portableScript} onChange={(event) => setPortableScript(event.target.checked)} disabled={working} />
            <span><strong>Portable device</strong><small>Include a copy of ZeeVault.ps1 so this folder can be encrypted or decrypted without the app.</small></span>
          </label>
        )}

        {error && <div className="file-operation-message error" role="alert">{error}</div>}
        {result && <div className="file-operation-message success" role="status">{result}</div>}

        {folderPath && !loadingFolder && !error && (
          <div className="file-operations-list-wrap">
            <div className="file-operations-list-heading"><div><h4>{tab === 'encrypt' ? 'Files ready to encrypt' : 'Files in this vault'}</h4><span>{files.length} file{files.length === 1 ? '' : 's'} · {readableSize(files.reduce((sum, file) => sum + file.size, 0))}</span></div></div>
            {files.length === 0 ? <div className="file-operations-empty">{tab === 'decrypt' && result?.startsWith('Decryption complete') ? 'No encrypted files remain in this folder.' : tab === 'encrypt' && vaultMetaExists ? 'No new files are ready to encrypt.' : 'No supported files were found.'}</div> : (
              <div className="file-operations-list">
                {files.map((file, index) => (
                  <div key={`${file.path}-${index}`} className={`file-operations-row${file.missing ? ' missing' : ''}`}>
                    <span className="file-operation-file-icon" aria-hidden="true">{file.originalName?.match(/\.(png|jpe?g|gif|bmp|webp|tiff?)$/i) ? '▧' : '▶'}</span>
                    <div className="file-operation-file-name"><strong>{tab === 'decrypt' ? file.originalName : file.name}</strong><span>{tab === 'decrypt' ? file.name : file.path.slice(folderPath.length).replace(/^[/\\]+/, '')}</span></div>
                    <span className="file-operation-file-attributes"><strong>{readableSize(file.size)}</strong>{readableDate(file.dateModified) && <time>{readableDate(file.dateModified)}</time>}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {working && progress && (
          <div className="file-operation-progress" role="status">
            <div><strong>{tab === 'encrypt' ? 'Encrypting files…' : 'Decrypting files…'}</strong><span>{progress.completed} / {progress.total}{progress.currentName ? ` · ${progress.currentName}` : ''}</span></div>
            <div className="file-operation-progress-track"><span style={{ width: `${progress.total ? Math.min(100, (progress.completed / progress.total) * 100) : 0}%` }} /></div>
          </div>
        )}

        <div className="file-operations-footer">
          <p>{tab === 'encrypt' ? 'Original files will be replaced with randomly named .enc files.' : 'Encrypted files will be restored. vault.meta remains with the decrypted state and password hash.'}</p>
          <button type="button" className="settings-btn primary" onClick={openPasswordDialog} disabled={!canStart}>
            {tab === 'encrypt' ? 'Start encrypting' : 'Start decrypting'}
          </button>
        </div>
      </div>

      {passwordOpen && (
        createPortal(
          <div className="password-overlay visible file-tools-password-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget && !working) setPasswordOpen(false); }}>
            <form className="password-card file-tools-password-card" onSubmit={(event) => { event.preventDefault(); if (!working) void submitOperation(); }}>
              <div className="password-brand">
                <div className="brand-mark large"><span>Z</span><span>V</span></div>
                <h2>{tab === 'encrypt' ? (vaultMetaExists ? 'Confirm Vault Password' : 'Create Vault Password') : 'Unlock Vault'}</h2>
              </div>
              <p className="password-desc">{tab === 'encrypt' ? (vaultMetaExists ? 'Enter the password previously used for this folder.' : 'This password is required to restore your files. Keep it somewhere safe.') : 'Enter the password used to encrypt this folder.'}</p>
              <div className="password-input-row">
                <input autoFocus type="password" autoComplete={tab === 'encrypt' ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Vault password" disabled={working} />
              </div>
              {tab === 'encrypt' && !vaultMetaExists && <div className="password-input-row"><input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Confirm password" disabled={working} /></div>}
              {passwordError && <div className="file-tools-password-error" role="alert">{passwordError}</div>}
              <div className="password-actions">
                <button type="button" className="password-cancel" onClick={() => setPasswordOpen(false)} disabled={working}>Cancel</button>
                <button type="submit" className="password-submit" disabled={working}>{working ? 'Working…' : tab === 'encrypt' ? 'Start encrypting' : 'Start decrypting'}</button>
              </div>
            </form>
          </div>,
          document.querySelector('.app-shell') || document.body
        )
      )}
    </div>
  );
};

export default FileOperationsScreen;
