import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../stores/appStore';

const LockScreen: React.FC = () => {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [visible, setVisible] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { password, setLocked } = useAppStore();

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    if (input === password) {
      setVisible(false);
      setTimeout(() => setLocked(false), 350);
    } else {
      setError('Incorrect password');
      setInput('');
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <div className={`lock-overlay ${visible ? 'visible' : 'leaving'}`}>
      <div className="lock-card">
        <div className="lock-brand">
          <div className="brand-mark large">
            <span>Z</span><span>V</span>
          </div>
          <h2>ZeeVault</h2>
        </div>
        <p className="lock-prompt">Enter password to unlock</p>
        <div className="lock-input-row">
          <input
            ref={inputRef}
            type="password"
            value={input}
            onChange={(e) => { setInput(e.target.value); setError(''); }}
            onKeyDown={handleKeyDown}
            placeholder="Password"
          />
          <button type="button" onClick={handleSubmit} className="lock-submit">
            <svg viewBox="0 0 24 24">
              <path d="M9 16l-4-4 1.41-1.41L9 13.17l7.59-7.59L18 7l-9 9z" />
            </svg>
          </button>
        </div>
        {error && <p className="lock-error">{error}</p>}
      </div>
    </div>
  );
};

export default LockScreen;
