import React, { useCallback, useState } from 'react';
import { getApiKeys, setApiKeys } from '../services/subtitleService';

interface ApiKeySettingsProps {
  onClose: () => void;
}

const ApiKeySettings: React.FC<ApiKeySettingsProps> = ({ onClose }) => {
  const current = getApiKeys();
  const [osKey, setOsKey] = useState(current.opensubtitles);
  const [subdlKey, setSubdlKey] = useState(current.subdl);
  const [saved, setSaved] = useState(false);

  const handleSave = useCallback(() => {
    setApiKeys(osKey.trim(), subdlKey.trim());
    setSaved(true);
    setTimeout(() => onClose(), 900);
  }, [osKey, subdlKey, onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !saved) onClose();
  }, [saved, onClose]);

  return (
    <div className="subtitle-dialog-overlay" onClick={() => !saved && onClose()}>
      <div className="api-settings-dialog" onClick={(e) => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <div className="subtitle-dialog-header">
          <div className="subtitle-dialog-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width="20" height="20">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
            <span>Subtitle API Settings</span>
          </div>
          <button className="subtitle-dialog-close" onClick={() => !saved && onClose()} title="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width="18" height="18">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="api-settings-body">
          <p className="api-settings-note">
            Your API keys are stored only in this browser's local storage and are never sent anywhere except to
            the corresponding subtitle provider. Get free keys at{' '}
            <a href="https://www.opensubtitles.com/api" target="_blank" rel="noreferrer">OpenSubtitles</a> and{' '}
            <a href="https://subdl.com/developers" target="_blank" rel="noreferrer">SubDL</a>.
          </p>

          <label className="api-settings-field">
            <span>OpenSubtitles API Key</span>
            <input
              type="password"
              value={osKey}
              onChange={(e) => setOsKey(e.target.value)}
              placeholder="Paste OpenSubtitles key"
              autoComplete="off"
            />
          </label>

          <label className="api-settings-field">
            <span>SubDL API Key</span>
            <input
              type="password"
              value={subdlKey}
              onChange={(e) => setSubdlKey(e.target.value)}
              placeholder="Paste SubDL key"
              autoComplete="off"
            />
          </label>

          {saved && (
            <div className="api-settings-saved">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width="16" height="16">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              API keys saved
            </div>
          )}
        </div>

        <div className="api-settings-actions">
          <button className="api-settings-cancel" onClick={onClose} disabled={saved}>Close</button>
          <button className="api-settings-save" onClick={handleSave} disabled={saved}>Save Keys</button>
        </div>
      </div>
    </div>
  );
};

export default ApiKeySettings;
