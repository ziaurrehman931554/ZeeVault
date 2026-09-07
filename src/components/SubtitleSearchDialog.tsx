import React, { useCallback, useEffect, useRef, useState } from 'react';
import { usePlayerStore } from '../stores/playerStore';
import { SubtitleSearchResult, SubtitleTrack } from '../types/index';
import { searchSubtitles, downloadSubtitle, buildVideoSearchQuery, getApiKeys } from '../services/subtitleService';
import ApiKeySettings from './ApiKeySettings';

const LANGUAGES = [
  { code: 'all', label: 'All Languages' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'it', label: 'Italian' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'ru', label: 'Russian' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'zh', label: 'Chinese' },
  { code: 'ar', label: 'Arabic' },
  { code: 'hi', label: 'Hindi' },
  { code: 'tr', label: 'Turkish' },
  { code: 'pl', label: 'Polish' },
  { code: 'nl', label: 'Dutch' },
  { code: 'sv', label: 'Swedish' },
  { code: 'da', label: 'Danish' },
  { code: 'no', label: 'Norwegian' },
  { code: 'fi', label: 'Finnish' },
];

const SubtitleSearchDialog: React.FC = () => {
  const { search, setSearch, addTrack, setActiveTrackId } = usePlayerStore();
  const { currentVideo } = usePlayerStore();
  const [query, setQuery] = useState(search.query);
  const [language, setLanguage] = useState('all');
  const [downloading, setDownloading] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const keys = getApiKeys();
  const hasApiKeys = Boolean(keys.opensubtitles || keys.subdl);
  const [showApiSettings, setShowApiSettings] = useState(false);

  useEffect(() => {
    if (search.visible && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [search.visible]);

  useEffect(() => {
    if (search.visible && currentVideo && !search.query) {
      const autoQuery = buildVideoSearchQuery(currentVideo.originalName);
      setQuery(autoQuery);
      setSearch({ query: autoQuery });
    }
  }, [search.visible, currentVideo]);

  const performSearch = useCallback(async (q: string, lang: string) => {
    if (!q.trim()) {
      setSearch({ results: [], error: null });
      return;
    }

    setSearch({ loading: true, error: null, query: q });

    try {
      const results = await searchSubtitles(q, lang, 'opensubtitles');
      setSearch({ results, loading: false });
    } catch (err) {
      setSearch({
        loading: false,
        error: err instanceof Error ? err.message : 'Search failed',
      });
    }
  }, [setSearch]);

  const handleSearch = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    performSearch(query, language);
  }, [query, language, performSearch]);

  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (value.trim().length >= 2) {
        performSearch(value, language);
      }
    }, 600);
  }, [language, performSearch]);

  const handleLanguageChange = useCallback((lang: string) => {
    setLanguage(lang);
    if (query.trim().length >= 2) {
      performSearch(query, lang);
    }
  }, [query, performSearch]);

  const handleDownload = useCallback(async (result: SubtitleSearchResult) => {
    setDownloading(result.id);
    try {
      const downloaded = await downloadSubtitle(result);
      if (downloaded) {
        const track: SubtitleTrack = {
          id: `track-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          label: `${result.language} — ${result.releaseName.substring(0, 40)}`,
          language: result.language,
          languageCode: result.languageCode,
          format: downloaded.format,
          source: result.source,
          vttUrl: downloaded.vttUrl,
        };
        addTrack(track);
        setActiveTrackId(track.id);
        setSearch({ visible: false });
      }
    } catch (err) {
      console.error('Download failed:', err);
    } finally {
      setDownloading(null);
    }
  }, [addTrack, setActiveTrackId, setSearch]);

  const handleClose = useCallback(() => {
    setSearch({ visible: false, results: [], error: null });
  }, [setSearch]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClose();
    }
    if (e.key === 'Enter') {
      handleSearch();
    }
  }, [handleClose, handleSearch]);

  if (!search.visible) return null;

  return (
    <>
    <div className="subtitle-dialog-overlay" onClick={handleClose}>
      <div className="subtitle-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="subtitle-dialog-header">
          <div className="subtitle-dialog-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width="20" height="20">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="M7 8h10M7 12h6" />
            </svg>
            <span>Search Subtitles</span>
          </div>
          <div className="subtitle-dialog-actions">
            <button
              className="subtitle-api-key-btn"
              onClick={() => setShowApiSettings(true)}
              title="Subtitle API settings"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width="15" height="15">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
            </button>
            <button className="subtitle-dialog-close" onClick={handleClose} title="Close">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width="18" height="18">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {!hasApiKeys && (
          <div className="subtitle-api-notice">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width="16" height="16">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
            <span>
              Add your API keys to search subtitles. Get free keys at{' '}
              <a href="https://www.opensubtitles.com/api" target="_blank" rel="noreferrer">OpenSubtitles</a>
              {' '}and{' '}
              <a href="https://subdl.com/developers" target="_blank" rel="noreferrer">SubDL</a>.
            </span>
            <button className="subtitle-api-setup-btn" onClick={() => setShowApiSettings(true)}>Setup Keys</button>
          </div>
        )}

        <div className="subtitle-search-bar">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search by movie title..."
            className="subtitle-search-input"
          />
          <select
            value={language}
            onChange={(e) => handleLanguageChange(e.target.value)}
            className="subtitle-language-select"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>{lang.label}</option>
            ))}
          </select>
          <button
            className="subtitle-search-btn"
            onClick={handleSearch}
            disabled={!query.trim() || search.loading}
          >
            {search.loading ? (
              <div className="subtitle-search-spinner" />
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width="18" height="18">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
            )}
          </button>
        </div>

        <div className="subtitle-results">
          {search.loading && (
            <div className="subtitle-results-loading">
              <div className="subtitle-results-spinner" />
              <span>Searching subtitles...</span>
            </div>
          )}

          {search.error && (
            <div className="subtitle-results-error">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width="16" height="16">
                <circle cx="12" cy="12" r="10" />
                <path d="M15 9l-6 6M9 9l6 6" />
              </svg>
              <span>{search.error}</span>
            </div>
          )}

          {!search.loading && !search.error && search.results.length === 0 && search.query && (
            <div className="subtitle-results-empty">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width="32" height="32">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="M7 8h10M7 12h6" />
              </svg>
              <p>No subtitles found for "{search.query}"</p>
              <p className="subtitle-results-hint">Try a different search term or language</p>
            </div>
          )}

          {!search.loading && search.results.length > 0 && (
            <>
              <div className="subtitle-results-count">
                {search.results.length} subtitle{search.results.length !== 1 ? 's' : ''} found
              </div>
              {search.results.map((result) => (
                <div
                  key={result.id}
                  className={`subtitle-result-item ${downloading === result.id ? 'downloading' : ''}`}
                >
                  <div className="subtitle-result-info">
                    <div className="subtitle-result-name" title={result.releaseName}>
                      {result.releaseName}
                    </div>
                    <div className="subtitle-result-meta">
                      <span className="subtitle-result-lang">{result.language}</span>
                      <span className="subtitle-result-source">{result.source === 'opensubtitles' ? 'OpenSubtitles' : 'SubDL'}</span>
                      <span className="subtitle-result-uploader">by {result.uploader}</span>
                      {result.downloadCount !== undefined && result.downloadCount > 0 && (
                        <span className="subtitle-result-downloads">
                          {result.downloadCount.toLocaleString()} downloads
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    className="subtitle-result-download"
                    onClick={() => handleDownload(result)}
                    disabled={downloading === result.id}
                    title="Download & apply subtitle"
                  >
                    {downloading === result.id ? (
                      <div className="subtitle-download-spinner" />
                    ) : (
                      <>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width="14" height="14">
                          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        Download
                      </>
                    )}
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
    {showApiSettings && <ApiKeySettings onClose={() => setShowApiSettings(false)} />}
    </>
  );
};

export default SubtitleSearchDialog;
