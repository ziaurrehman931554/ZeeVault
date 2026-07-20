import React, { useState, useEffect, useRef } from 'react';

interface PasswordPromptProps {
  visible: boolean;
  title?: string;
  description?: string;
  onSubmit: (password: string | null) => void;
}

const PasswordPrompt: React.FC<PasswordPromptProps> = ({
  visible,
  title = 'Enter Password',
  description = 'This folder contains encrypted content. Enter the vault password to access it.',
  onSubmit,
}) => {
  const [input, setInput] = useState('');
  const [show, setShow] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (visible) {
      requestAnimationFrame(() => {
        setShow(true);
        inputRef.current?.focus();
      });
    } else {
      setShow(false);
      setInput('');
    }
  }, [visible]);

  const handleCancel = () => {
    setShow(false);
    onSubmit(null);
  };

  const handleSubmit = () => {
    if (input.trim()) {
      setShow(false);
      onSubmit(input);
      setInput('');
    }
  };

  if (!visible && !show) return null;

  return (
    <div className={`password-overlay ${show ? 'visible' : 'leaving'}`}>
      <div className="password-card">
        <div className="password-brand">
          <div className="brand-mark large">
            <span>Z</span><span>V</span>
          </div>
          <h2>{title}</h2>
        </div>
        <p className="password-desc">{description}</p>
        <div className="password-input-row">
          <input
            ref={inputRef}
            type="password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit();
              if (e.key === 'Escape') handleCancel();
            }}
            placeholder="Vault password"
          />
        </div>
        <div className="password-actions">
          <button type="button" className="password-cancel" onClick={handleCancel}>
            Skip
          </button>
          <button type="button" className="password-submit" onClick={handleSubmit}>
            Unlock
          </button>
        </div>
      </div>
    </div>
  );
};

export default PasswordPrompt;
