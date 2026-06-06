import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const faqs = [
  { q: 'What is ZeeVault?', a: 'ZeeVault is a privacy-focused desktop and web application that lets you securely store, manage, and play your personal video collection. Your media files are encrypted at rest using XOR-based encryption and are decrypted only in-memory during playback.' },
  { q: 'Is my password stored anywhere?', a: 'No. Your password is never stored or transmitted. A SHA-256 hash of your password is saved in the vault.meta file for local verification only. The actual password exists only in memory during your session.' },
  { q: 'Are my videos uploaded to a server?', a: 'Never. Everything happens locally on your machine. The web version uses your browser\'s file picker and processes files entirely in-memory. The desktop app reads directly from your disk. No data ever leaves your computer.' },
  { q: 'What encryption does ZeeVault use?', a: 'ZeeVault uses a streaming XOR cipher with keys derived from your password via SHA-256. This provides strong protection for local privacy while maintaining high performance for large video files.' },
  { q: 'Can I use ZeeVault on mobile?', a: 'The web version works in mobile browsers, allowing you to unlock and view your vault from any device with a browser. However, files must be accessible via the browser file picker.' },
  { q: 'What file formats are supported?', a: 'ZeeVault supports common media formats: MP4, MKV, AVI, MOV, WMV, WebM, and TS. For images: JPG, PNG, GIF, BMP, TIFF, and WebP.' },
  { q: 'How do I encrypt my videos?', a: 'Download the ZeeVault.ps1 PowerShell script, place it in your video folder, and run it. The script encrypts all supported media files, renames them to random .enc filenames, and creates a vault.meta manifest.' },
  { q: 'Can I recover my videos if I forget my password?', a: 'No. There is no password recovery mechanism. The encryption key is derived directly from your password. If you lose your password, your encrypted files cannot be recovered.' },
];

const reviews = [
  { name: 'Alex Chen', role: 'Privacy Advocate', avatar: 'AC', text: 'Finally a video viewer that takes privacy seriously. The fact that everything runs locally with no cloud upload gives me real peace of mind.', rating: 5 },
  { name: 'Sarah Mitchell', role: 'Freelance Videographer', avatar: 'SM', text: 'I use ZeeVault to store client footage securely. The encryption script makes it dead simple to lock up entire projects before archiving.', rating: 5 },
  { name: 'James Okafor', role: 'Software Engineer', avatar: 'JO', text: 'The custom video player is surprisingly polished — zone-based controls and mini player feel premium. Open source too, which is a huge plus.', rating: 5 },
  { name: 'Priya Sharma', role: 'Digital Security Trainer', avatar: 'PS', text: 'I recommend ZeeVault to my students as a practical example of local-first encryption. The SHA-256 verification and XOR cipher implementation is clean.', rating: 4 },
  { name: 'Marcus Rivera', role: 'Content Creator', avatar: 'MR', text: 'Being able to encrypt sensitive raw footage before uploading to cloud backup is a game changer. Simple, fast, and effective.', rating: 5 },
  { name: 'Elena Vasquez', role: 'Tech Journalist', avatar: 'EV', text: 'In an era of surveillance capitalism, ZeeVault stands out as a tool that genuinely respects user privacy. No accounts, no tracking, no cloud.', rating: 5 },
];

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window === 'undefined') return 'dark';
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  });
  const [scrolled, setScrolled] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className={`app-shell theme-${theme}`}>
      <div className="ambient-shape shape-one" />
      <div className="ambient-shape shape-two" />
      <div className="ambient-shape shape-three" />

      {/* ---- Header ---- */}
      <header className={`home-header ${scrolled ? 'scrolled' : ''}`}>
        <div className="home-header-inner">
          <div className="header-logo" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <img src="./ZeeVault.png" alt="ZeeVault" className="header-logo-img" />
            <strong>ZeeVault</strong>
          </div>
          <nav className="home-nav">
            <a href="#features" onClick={(e) => { e.preventDefault(); scrollToSection('features'); }}>Features</a>
            <a href="#how-it-works" onClick={(e) => { e.preventDefault(); scrollToSection('how-it-works'); }}>How&nbsp;It&nbsp;Works</a>
            <a href="#reviews" onClick={(e) => { e.preventDefault(); scrollToSection('reviews'); }}>Reviews</a>
            <a href="#faq" onClick={(e) => { e.preventDefault(); scrollToSection('faq'); }}>FAQ</a>
            <a href="#download" onClick={(e) => { e.preventDefault(); scrollToSection('download'); }}>Download</a>
            <button className="primary-button nav-cta" onClick={() => navigate('/app/login')}>
              Launch App
            </button>
            <button className="theme-toggle header-theme-btn" onClick={toggleTheme} aria-label="Toggle theme">
              {theme === 'dark' ? (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                </svg>
              )}
            </button>
          </nav>
        </div>
      </header>

      {/* ---- Hero ---- */}
      <section className="home-hero">
        <div className="hero-split">
          <div className="hero-visual">
            <div className="hero-graphic">
              <div className="hero-shield">
                <div className="hero-shield-ring" />
                <div className="hero-shield-inner">
                  <img src="./ZeeVault.png" alt="ZeeVault" className="hero-shield-img" />
                </div>
              </div>
              <div className="hero-orb orb-1" />
              <div className="hero-orb orb-2" />
              <div className="hero-orb orb-3" />
              <div className="hero-grid" />
            </div>
            <div className="hero-stats-row">
              <div className="hero-stat">
                <span className="hero-stat-value">100%</span>
                <span className="hero-stat-label">Local & Private</span>
              </div>
              <div className="hero-stat">
                <span className="hero-stat-value">XOR-256</span>
                <span className="hero-stat-label">Encryption</span>
              </div>
              <div className="hero-stat">
                <span className="hero-stat-value">OSS</span>
                <span className="hero-stat-label">Open Source</span>
              </div>
            </div>
          </div>
          <div className="hero-content">
            <div className="hero-badge">v1.0.0</div>
            <h1>
              <span className="hero-title-accent">Z</span>ee<span className="hero-title-accent">V</span>ault
            </h1>
            <p className="hero-subtitle">Encrypted Video Viewer</p>
            <p className="hero-description">
              Securely store, manage, and play your personal video collection.
              Your files are encrypted at rest and decrypted only in-memory during playback.
              Nothing is ever uploaded — everything stays on your machine.
            </p>
            <div className="hero-actions">
              <button className="primary-button hero-btn" onClick={() => navigate('/app/login')}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
                Launch App
              </button>
              <a href="#download" className="secondary-button hero-btn" onClick={(e) => { e.preventDefault(); scrollToSection('download'); }}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download Installer
              </a>
            </div>
            <p className="hero-legal">Free & Open Source &bull; No account required &bull; Works offline</p>
          </div>
        </div>
      </section>

      {/* ---- Features ---- */}
      <section id="features" className="home-section">
        <h2 className="section-title">Features</h2>
        <div className="features-grid">
          <div className="feature-card glass-panel">
            <div className="feature-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg></div>
            <h3>XOR Encryption</h3>
            <p>Streaming XOR cipher with SHA-256 derived keys. Files are encrypted at rest and never decrypted to disk.</p>
          </div>
          <div className="feature-card glass-panel">
            <div className="feature-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg></div>
            <h3>Custom Video Player</h3>
            <p>Glass-UI player with zone-based controls, Apple-TV-style hide/show, and a picture-in-picture mini player.</p>
          </div>
          <div className="feature-card glass-panel">
            <div className="feature-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg></div>
            <h3>Local & Private</h3>
            <p>Everything runs locally. Your password is verified locally, files are never uploaded, and no data leaves your machine.</p>
          </div>
          <div className="feature-card glass-panel">
            <div className="feature-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg></div>
            <h3>Desktop + Web</h3>
            <p>Available as a native Windows desktop app (Electron) or directly in your browser via GitHub Pages.</p>
          </div>
          <div className="feature-card glass-panel">
            <div className="feature-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" /></svg></div>
            <h3>Persistent Folder</h3>
            <p>Your vault folder is remembered for quick unlock. Just enter your password and go.</p>
          </div>
          <div className="feature-card glass-panel">
            <div className="feature-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" /></svg></div>
            <h3>Dark / Light Theme</h3>
            <p>Adapts to your system theme automatically with full support for both dark and light modes.</p>
          </div>
        </div>
      </section>

      {/* ---- How It Works ---- */}
      <section id="how-it-works" className="home-section">
        <h2 className="section-title">How It Works</h2>
        <div className="steps">
          <div className="step glass-panel">
            <div className="step-number">1</div>
            <h3>Encrypt Your Videos</h3>
            <p>Place the <code>ZeeVault.ps1</code> script in your video folder and run it. It encrypts each file using XOR cipher, renames them to random names, and creates a <code>vault.meta</code> manifest.</p>
          </div>
          <div className="step-arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg></div>
          <div className="step glass-panel">
            <div className="step-number">2</div>
            <h3>Unlock in ZeeVault</h3>
            <p>Open ZeeVault, select your vault folder, and enter your password. The app reads <code>vault.meta</code>, verifies your password, and shows your gallery.</p>
          </div>
          <div className="step-arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg></div>
          <div className="step glass-panel">
            <div className="step-number">3</div>
            <h3>Decrypt & Play</h3>
            <p>Click a video to decrypt it in-memory. The decrypted stream is served via a blob URL — never written to disk. Press Play to watch with the custom video player.</p>
          </div>
        </div>
      </section>

      {/* ---- Reviews ---- */}
      <section id="reviews" className="home-section">
        <h2 className="section-title">What People Say</h2>
        <div className="reviews-grid">
          {reviews.map((r, i) => (
            <div key={i} className="review-card glass-panel">
              <div className="review-author">
                <div className="review-avatar">{r.avatar}</div>
                <div>
                  <span className="review-name">{r.name}</span>
                  <span className="review-role">{r.role}</span>
                </div>
              </div>
              <div className="review-stars">
                {Array.from({ length: 5 }).map((_, si) => (
                  <svg key={si} viewBox="0 0 24 24" width="14" height="14" fill={si < r.rating ? 'var(--accent)' : 'none'} stroke="var(--accent)" strokeWidth="2">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                ))}
              </div>
              <p className="review-text">"{r.text}"</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---- FAQ ---- */}
      <section id="faq" className="home-section">
        <h2 className="section-title">Frequently Asked Questions</h2>
        <div className="faq-list">
          {faqs.map((faq, i) => (
            <div key={i} className={`faq-item glass-panel ${openFaq === i ? 'open' : ''}`}>
              <button className="faq-question" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                <span>{faq.q}</span>
                <svg className="faq-chevron" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              <div className="faq-answer">
                <p>{faq.a}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---- Download ---- */}
      <section id="download" className="home-section">
        <h2 className="section-title">Download</h2>
        <div className="download-grid">
          <a href="https://github.com/ziaurrehman931554/ZeeVault/releases/latest/download/ZeeVault-Setup-1.0.0.exe" className="download-card glass-panel" target="_blank" rel="noreferrer">
            <div className="download-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </div>
            <h3>ZeeVault Setup</h3>
            <p>Windows installer (NSIS)</p>
            <span className="download-size">~220 MB</span>
            <div className="download-badge">Recommended</div>
          </a>
          <a href="https://github.com/ziaurrehman931554/ZeeVault/releases/latest/download/ZeeVault-win32-x64.zip" className="download-card glass-panel" target="_blank" rel="noreferrer">
            <div className="download-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </div>
            <h3>Portable ZIP</h3>
            <p>No install needed, just unzip and run</p>
            <span className="download-size">~302 MB</span>
          </a>
          <a href="https://github.com/ziaurrehman931554/ZeeVault/releases/latest/download/ZeeVault.ps1" className="download-card glass-panel" target="_blank" rel="noreferrer">
            <div className="download-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </div>
            <h3>Encryption Script</h3>
            <p>PowerShell script to encrypt your videos</p>
            <span className="download-size">~11 KB</span>
          </a>
          <a href="https://ziaurrehman931554.github.io/ZeeVault/" className="download-card glass-panel" target="_blank" rel="noreferrer">
            <div className="download-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
              </svg>
            </div>
            <h3>Web App</h3>
            <p>Use directly in your browser</p>
            <span className="download-size">No install needed</span>
          </a>
        </div>
      </section>

      {/* ---- Footer ---- */}
      <footer className="home-footer">
        <div className="home-footer-main">
          <div className="footer-col footer-brand">
            <div className="footer-logo">
              <img src="./ZeeVault.png" alt="ZeeVault" className="footer-logo-img" />
              <strong>ZeeVault</strong>
            </div>
            <p className="footer-desc">Encrypted video viewer. Store, manage, and play your personal video collection securely — locally, privately, and free.</p>
            <div className="footer-social">
              <a href="https://github.com/ziaurrehman931554/ZeeVault" target="_blank" rel="noreferrer" aria-label="GitHub">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" /></svg>
              </a>
              <a href="https://github.com/ziaurrehman931554/ZeeVault/releases" target="_blank" rel="noreferrer" aria-label="Releases">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
              </a>
            </div>
          </div>
          <div className="footer-col">
            <h4>Product</h4>
            <a href="#features" onClick={(e) => { e.preventDefault(); scrollToSection('features'); }}>Features</a>
            <a href="#how-it-works" onClick={(e) => { e.preventDefault(); scrollToSection('how-it-works'); }}>How It Works</a>
            <a href="#download" onClick={(e) => { e.preventDefault(); scrollToSection('download'); }}>Download</a>
            <a href="#faq" onClick={(e) => { e.preventDefault(); scrollToSection('faq'); }}>FAQ</a>
            <a href="https://ziaurrehman931554.github.io/ZeeVault/" target="_blank" rel="noreferrer">Web App</a>
          </div>
          <div className="footer-col">
            <h4>Support</h4>
            <a href="https://github.com/ziaurrehman931554/ZeeVault/issues" target="_blank" rel="noreferrer">Report Issue</a>
            <a href="https://github.com/ziaurrehman931554/ZeeVault/discussions" target="_blank" rel="noreferrer">Discussions</a>
            <a href="https://github.com/ziaurrehman931554/ZeeVault" target="_blank" rel="noreferrer">GitHub</a>
            <a href="https://github.com/ziaurrehman931554/ZeeVault/releases" target="_blank" rel="noreferrer">Changelog</a>
          </div>
          <div className="footer-col">
            <h4>Legal</h4>
            <a href="https://github.com/ziaurrehman931554/ZeeVault/blob/main/LICENSE" target="_blank" rel="noreferrer">License</a>
            <a href="https://github.com/ziaurrehman931554/ZeeVault" target="_blank" rel="noreferrer">Privacy</a>
            <a href="https://github.com/ziaurrehman931554/ZeeVault/security" target="_blank" rel="noreferrer">Security</a>
          </div>
        </div>
        <div className="home-footer-bottom">
          <p>Copyright 2026 ZeeVault. All rights reserved. Made with ❤️ by <a href="https://github.com/ziaurrehman931554" target="_blank" rel="noreferrer">Zia Ur Rehman</a>.</p>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
