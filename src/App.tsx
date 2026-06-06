import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage';
import AppContent from './AppContent';

const isElectron = (): boolean => {
  try {
    return typeof window !== 'undefined' && window.navigator.userAgent.includes('Electron');
  } catch {
    return false;
  }
};

const App: React.FC = () => {
  useEffect(() => {
    if (isElectron()) {
      document.documentElement.classList.add('electron');
    }
  }, []);

  return (
    <HashRouter>
      <Routes>
        <Route path="/home" element={<HomePage />} />
        <Route path="/app/login" element={<AppContent />} />
        <Route path="/app/gallery" element={<AppContent />} />
        <Route path="/app/view/:encryptedName" element={<AppContent />} />
        <Route path="/app" element={<Navigate to="/app/login" replace />} />
        <Route path="*" element={<Navigate to={isElectron() ? '/app/login' : '/home'} replace />} />
      </Routes>
    </HashRouter>
  );
};

export default App;
