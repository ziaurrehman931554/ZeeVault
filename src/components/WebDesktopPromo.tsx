import React, { useEffect, useState } from 'react';

const RELEASES_URL = 'https://github.com/ziaurrehman931554/ZeeVault/releases';

interface WebDesktopPromoProps {
  active: boolean;
  lifted?: boolean;
}

const WebDesktopPromo: React.FC<WebDesktopPromoProps> = ({ active, lifted = false }) => {
  const [hasShown, setHasShown] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!active) {
      setVisible(false);
      return;
    }
    if (hasShown) return;

    const showTimer = window.setTimeout(() => {
      setHasShown(true);
      setVisible(true);
    }, 5000);
    return () => window.clearTimeout(showTimer);
  }, [active, hasShown]);

  useEffect(() => {
    if (!visible) return;
    const hideTimer = window.setTimeout(() => setVisible(false), 5000);
    return () => window.clearTimeout(hideTimer);
  }, [visible]);

  const dismiss = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setHasShown(true);
    setVisible(false);
  };

  return (
    <aside
      className={`web-desktop-promo${visible && active ? ' visible' : ''}${lifted ? ' lifted' : ''}`}
      role="status"
      aria-hidden={!visible || !active}
    >
      <div className="web-desktop-promo-mark" aria-hidden="true">Z</div>
      <div className="web-desktop-promo-copy">
        <strong>Get more from ZeeVault on desktop</strong>
        <span>Enjoy more themes and built-in file encryption and decryption.</span>
      </div>
      <a href={RELEASES_URL} target="_blank" rel="noreferrer" className="web-desktop-promo-download">
        Download desktop app
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M7 17 17 7M8 7h9v9" />
        </svg>
      </a>
      <button type="button" className="web-desktop-promo-dismiss" onClick={dismiss} aria-label="Dismiss desktop app notice">×</button>
    </aside>
  );
};

export default WebDesktopPromo;
