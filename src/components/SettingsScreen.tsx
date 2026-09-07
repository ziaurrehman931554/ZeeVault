import React, { useEffect, useState } from 'react';
import { useSettingsStore } from '../stores/settingsStore';
import { ACCENT_PRESETS, MetaFile, ThemeMode, VideoCardSize } from '../types/index';

interface SettingsScreenProps {
  folderPaths: string[];
  metas: Record<string, MetaFile | null>;
  passwords: Record<string, string>;
  theme: ThemeMode;
  onBack: () => void;
  onUnlockFolder: (folderPath: string) => void;
  onLockFolder: (folderPath: string) => void;
  onRemoveFolder: (folderPath: string) => void;
  onAddFolders: () => void;
  onNotify: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const folderDisplayName = (path: string): string => {
  const parts = path.split(/[\\/]+/).filter(Boolean);
  return parts[parts.length - 1] || path;
};

const SettingsScreen: React.FC<SettingsScreenProps> = ({
  folderPaths,
  metas,
  passwords,
  theme,
  onBack,
  onUnlockFolder,
  onLockFolder,
  onRemoveFolder,
  onAddFolders,
  onNotify,
}) => {
  const {
    userName, accentColor, accentCustom, videoCardSize,
    setUserName, setTheme, setAccentColor, setAccentCustom, setVideoCardSize,
  } = useSettingsStore();

  const [nameDraft, setNameDraft] = useState(userName);
  useEffect(() => setNameDraft(userName), [userName]);

  const handleNameSave = () => {
    const trimmed = nameDraft.trim();
    setUserName(trimmed || 'Guest');
    onNotify('Name updated', 'success');
  };

  const handleTheme = (t: ThemeMode) => {
    setTheme(t);
    onNotify(`Switched to ${t === 'dark' ? 'dark' : 'light'} theme`, 'info');
  };

  const handleCardSize = (s: VideoCardSize) => {
    setVideoCardSize(s);
    onNotify(`Card size: ${s}`, 'info');
  };

  const handleCustomColor = (hex: string) => {
    setAccentCustom(hex);
    onNotify(`Accent color: ${hex}`, 'info');
  };

  const sectionTitle = (icon: React.ReactNode, title: string, desc: string) => (
    <div className="settings-section-head">
      <span className="settings-section-icon">{icon}</span>
      <div>
        <h3>{title}</h3>
        <p>{desc}</p>
      </div>
    </div>
  );

  return (
    <div className="settings-page">
      <div className="settings-header">
        <button type="button" className="back-button settings-back" onClick={onBack}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width="18" height="18">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to Gallery
        </button>
        <div>
          <p className="eyebrow">ZeeVault</p>
          <h2>Settings</h2>
        </div>
      </div>

      <div className="settings-body">
        {/* Profile */}
        <section className="settings-card">
          {sectionTitle(
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width="20" height="20">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
            </svg>,
            'Profile',
            'Edit how you appear in the app'
          )}
          <div className="settings-row">
            <label className="settings-label" htmlFor="username">Display name</label>
            <div className="settings-control">
              <input
                id="username"
                className="settings-input"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleNameSave(); }}
                maxLength={40}
              />
              <button type="button" className="settings-btn primary" onClick={handleNameSave}>Save</button>
            </div>
          </div>
        </section>

        {/* Appearance */}
        <section className="settings-card">
          {sectionTitle(
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width="20" height="20">
              <circle cx="13.5" cy="6.5" r="1.5" />
              <circle cx="17.5" cy="10.5" r="1.5" />
              <circle cx="8.5" cy="7.5" r="1.5" />
              <circle cx="6.5" cy="12.5" r="1.5" />
              <path d="M12 2C6.5 5.5 4 9 4 14a8 8 0 0016 0c0-2.5-2-5-4-6.5" />
            </svg>,
            'Appearance',
            'Theme and accent color'
          )}
          <div className="settings-row">
            <span className="settings-label">Theme</span>
            <div className="settings-segmented">
              {(['dark', 'light'] as ThemeMode[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`settings-seg-btn ${theme === t ? 'active' : ''}`}
                  onClick={() => handleTheme(t)}
                >
                  {t === 'dark' ? 'Dark' : 'Light'}
                </button>
              ))}
            </div>
          </div>

          <div className="settings-row">
            <span className="settings-label">Accent color</span>
            <div className="accent-control">
              <div className="accent-picker">
                {ACCENT_PRESETS.map((preset) => (
                  <button
                    key={preset.key}
                    type="button"
                    className={`accent-swatch ${accentColor === preset.key ? 'active' : ''}`}
                    style={{
                      background: `linear-gradient(135deg, ${preset.dark}, ${preset.light})`,
                      ['--swatch' as any]: preset.dark,
                    }}
                    title={preset.label}
                    onClick={() => {
                      setAccentColor(preset.key);
                      onNotify(`Accent color: ${preset.label}`, 'info');
                    }}
                  >
                    {accentColor === preset.key && (
                      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} width="14" height="14">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                ))}
                <label
                  className={`accent-swatch custom-swatch ${accentColor === 'custom' ? 'active' : ''}`}
                  title={`Custom color (${accentCustom})`}
                  style={{ ['--swatch' as any]: accentCustom }}
                >
                  <input
                    type="color"
                    className="custom-color-input"
                    value={accentCustom}
                    onChange={(e) => handleCustomColor(e.target.value)}
                  />
                  {accentColor === 'custom' && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} width="14" height="14">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </label>
              </div>
              {accentColor === 'custom' && (
                <span className="custom-hex">{accentCustom}</span>
              )}
            </div>
          </div>

          <div className="settings-row">
            <span className="settings-label">Video card size</span>
            <div className="settings-segmented">
              {(['small', 'medium', 'large'] as VideoCardSize[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`settings-seg-btn ${videoCardSize === s ? 'active' : ''}`}
                  onClick={() => handleCardSize(s)}
                >
                  {s[0].toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Folders */}
        <section className="settings-card">
          {sectionTitle(
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width="20" height="20">
              <path d="M3 7.5A2.5 2.5 0 015.5 5H10l2 2h6.5A2.5 2.5 0 0121 9.5v7A2.5 2.5 0 0118.5 19h-13A2.5 2.5 0 013 16.5v-9z" />
            </svg>,
            'Folders',
            'Add, remove, unlock, or lock your vault folders'
          )}
          <div className="settings-row">
            <button type="button" className="settings-btn primary settings-add-btn" onClick={onAddFolders}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width="16" height="16">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Folder
            </button>
          </div>

          {folderPaths.length === 0 ? (
            <p className="settings-empty">No folders added yet.</p>
          ) : (
            <div className="settings-folder-list">
              {folderPaths.map((folder) => {
                const hasMeta = Boolean(metas[folder]);
                const unlocked = Boolean(passwords[folder]);
                return (
                  <div key={folder} className="settings-folder-row">
                    <div className="settings-folder-info">
                      <span className={`settings-folder-dot ${unlocked ? 'is-unlocked' : hasMeta ? 'is-locked' : ''}`} />
                      <div className="settings-folder-name" title={folder}>{folderDisplayName(folder)}</div>
                    </div>
                    <div className="settings-folder-actions">
                      {hasMeta && !unlocked && (
                        <button type="button" className="settings-chip unlock" onClick={() => onUnlockFolder(folder)}>Unlock</button>
                      )}
                      {hasMeta && unlocked && (
                        <button type="button" className="settings-chip lock" onClick={() => onLockFolder(folder)}>Lock</button>
                      )}
                      <button type="button" className="settings-chip remove" onClick={() => onRemoveFolder(folder)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width="13" height="13">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default SettingsScreen;
