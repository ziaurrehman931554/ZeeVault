import React, { useEffect, useCallback, useState, useRef } from 'react';
import { useAppStore } from '../stores/appStore';
import { VideoItem } from '../types/index';

const ZOOM_LEVELS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];

const ImageViewer: React.FC = () => {
  const { imageViewer, setImageViewer, browserFiles } = useAppStore();
  const { items, currentIndex, visible } = imageViewer;
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [isFitToScreen, setIsFitToScreen] = useState(true);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [topCtrlVisible, setTopCtrlVisible] = useState(false);
  const [centerCtrlVisible, setCenterCtrlVisible] = useState(false);
  const [bottomCtrlVisible, setBottomCtrlVisible] = useState(false);
  const [showZoomMenu, setShowZoomMenu] = useState(false);
  const [dragEnabled, setDragEnabled] = useState(false);
  const ownsUrlRef = useRef(false);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const panStartRef = useRef({ x: 0, y: 0 });
  const wasDraggingRef = useRef(false);
  const zoomRef = useRef(1);
  const fitRef = useRef(true);
  const dragEnabledRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentItem = items[currentIndex] || null;

  const showAllControls = useCallback(() => {
    setTopCtrlVisible(true);
    setCenterCtrlVisible(true);
    setBottomCtrlVisible(true);
    if (controlsTimerRef.current) {
      clearTimeout(controlsTimerRef.current);
    }
    controlsTimerRef.current = setTimeout(() => {
      if (!isDraggingRef.current) {
        setTopCtrlVisible(false);
        setCenterCtrlVisible(false);
        setBottomCtrlVisible(false);
      }
      controlsTimerRef.current = null;
    }, 2500);
  }, []);

  const resetZoom = useCallback(() => {
    setZoom(1); zoomRef.current = 1;
    setIsFitToScreen(true); fitRef.current = true;
    setPan({ x: 0, y: 0 });
    showAllControls();
  }, [showAllControls]);

  const zoomIn = useCallback(() => {
    setIsFitToScreen(false); fitRef.current = false;
    setZoom((z) => {
      const next = ZOOM_LEVELS.find((l) => l > z);
      const val = next ?? z;
      zoomRef.current = val;
      return val;
    });
    showAllControls();
  }, [showAllControls]);

  const zoomOut = useCallback(() => {
    setIsFitToScreen(false); fitRef.current = false;
    setZoom((z) => {
      const prev = [...ZOOM_LEVELS].reverse().find((l) => l < z);
      const val = prev ?? z;
      zoomRef.current = val;
      return val;
    });
    showAllControls();
  }, [showAllControls]);

  const toggleDrag = useCallback(() => {
    setDragEnabled((d) => {
      const next = !d;
      dragEnabledRef.current = next;
      return next;
    });
  }, []);

  const loadImage = useCallback(async (item: VideoItem | null) => {
    if (!item) { setImgUrl(null); return; }
    if (item.thumbnailUrl) {
      setImgUrl(item.thumbnailUrl);
      ownsUrlRef.current = false;
      return;
    }
    setLoading(true);
    try {
      if ((window as any).electronAPI?.readFile) {
        const buffer = await (window as any).electronAPI.readFile(item.filePath);
        const mime = item.extension === 'png' ? 'image/png'
          : item.extension === 'gif' ? 'image/gif'
          : item.extension === 'webp' ? 'image/webp'
          : 'image/jpeg';
        const blob = new Blob([buffer], { type: mime });
        const url = URL.createObjectURL(blob);
        setImgUrl(url);
        ownsUrlRef.current = true;
        setLoading(false);
        return;
      }
    } catch { /* fall through */ }
    if (browserFiles) {
      try {
        const targetFile = Array.from(browserFiles).find((file) => {
          const relPath = file.webkitRelativePath || file.name;
          return relPath.endsWith(item.encryptedName);
        });
        if (targetFile) {
          const url = URL.createObjectURL(targetFile);
          setImgUrl(url);
          ownsUrlRef.current = true;
          setLoading(false);
          return;
        }
      } catch { /* fall through */ }
    }
    setLoading(false);
    setImgUrl(null);
    ownsUrlRef.current = false;
  }, [browserFiles]);

  useEffect(() => {
    if (visible && currentItem) {
      resetZoom();
      loadImage(currentItem);
    } else {
      if (imgUrl && ownsUrlRef.current) URL.revokeObjectURL(imgUrl);
      setImgUrl(null);
    }
  }, [visible, currentIndex, currentItem, loadImage, resetZoom]);

  useEffect(() => {
    if (!visible) {
      setDragEnabled(false);
      dragEnabledRef.current = false;
    }
  }, [visible]);

  const goTo = useCallback((index: number) => {
    if (items.length === 0) return;
    if (imgUrl && ownsUrlRef.current) URL.revokeObjectURL(imgUrl);
    setImgUrl(null);
    const newIndex = (index + items.length) % items.length;
    setImageViewer({ ...imageViewer, currentIndex: newIndex });
  }, [items.length, imageViewer, setImageViewer, imgUrl]);

  const close = useCallback(() => {
    if (imgUrl && ownsUrlRef.current) URL.revokeObjectURL(imgUrl);
    setImageViewer({ items: [], currentIndex: 0, visible: false });
  }, [setImageViewer, imgUrl]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setIsFitToScreen(false); fitRef.current = false;
    const delta = e.deltaY > 0 ? -1 : 1;
    setZoom((z) => {
      const idx = ZOOM_LEVELS.indexOf(z);
      if (idx === -1) {
        const clamped = delta > 0
          ? ZOOM_LEVELS.find((l) => l > z) ?? z
          : [...ZOOM_LEVELS].reverse().find((l) => l < z) ?? z;
        zoomRef.current = clamped;
        return clamped;
      }
      const next = idx + delta;
      if (next < 0 || next >= ZOOM_LEVELS.length) return z;
      zoomRef.current = ZOOM_LEVELS[next];
      return ZOOM_LEVELS[next];
    });
    showAllControls();
  }, [showAllControls]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if (!dragEnabledRef.current) return;
    wasDraggingRef.current = false;
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    setPan((p) => { panStartRef.current = { ...p }; return p; });
    if (controlsTimerRef.current) {
      clearTimeout(controlsTimerRef.current);
      controlsTimerRef.current = null;
    }
  }, []);

  // Window-level mousemove: zone detection (when not dragging) + drag (when dragging)
  useEffect(() => {
    if (!visible) return;

    const onMouseMove = (e: MouseEvent) => {
      if (isDraggingRef.current) {
        e.preventDefault();
        const dx = e.clientX - dragStartRef.current.x;
        const dy = e.clientY - dragStartRef.current.y;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) wasDraggingRef.current = true;
        setPan({ x: panStartRef.current.x + dx, y: panStartRef.current.y + dy });
        return;
      }

      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX;
      const y = e.clientY;
      const isOutside = x < rect.left || x > rect.right || y < rect.top || y > rect.bottom;

      if (isOutside) {
        setTopCtrlVisible(false);
        setCenterCtrlVisible(false);
        setBottomCtrlVisible(false);
        if (controlsTimerRef.current) {
          clearTimeout(controlsTimerRef.current);
          controlsTimerRef.current = null;
        }
        return;
      }

      const vY = y - rect.top;
      const height = rect.height;
      const width = rect.width;
      const centerX = width / 2;
      const centerY = height / 2;
      const inCenter =
        Math.abs(x - rect.left - centerX) < width * 0.1 &&
        Math.abs(vY - centerY) < height * 0.06;
      const inTop = vY < height * 0.12;
      const inBottom = vY > height * 0.88;
      if (inCenter) {
        setTopCtrlVisible(false);
        setCenterCtrlVisible(true);
        setBottomCtrlVisible(false);
      } else if (inTop) {
        setTopCtrlVisible(true);
        setCenterCtrlVisible(false);
        setBottomCtrlVisible(false);
      } else if (inBottom) {
        setTopCtrlVisible(false);
        setCenterCtrlVisible(false);
        setBottomCtrlVisible(true);
      } else {
        setTopCtrlVisible(false);
        setCenterCtrlVisible(false);
        setBottomCtrlVisible(false);
      }

      if (controlsTimerRef.current) {
        clearTimeout(controlsTimerRef.current);
      }
      controlsTimerRef.current = setTimeout(() => {
        if (!isDraggingRef.current) {
          setTopCtrlVisible(false);
          setCenterCtrlVisible(false);
          setBottomCtrlVisible(false);
        }
        controlsTimerRef.current = null;
      }, 2500);
    };

    const onMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        showAllControls();
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      if (controlsTimerRef.current) {
        clearTimeout(controlsTimerRef.current);
        controlsTimerRef.current = null;
      }
    };
  }, [visible, showAllControls]);

  useEffect(() => {
    if (!visible) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { close(); return; }
      if (e.key === 'ArrowLeft') { goTo(currentIndex - 1); return; }
      if (e.key === 'ArrowRight') { goTo(currentIndex + 1); return; }
      if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomIn(); return; }
      if (e.key === '-') { e.preventDefault(); zoomOut(); return; }
      if (e.key === '0') { e.preventDefault(); resetZoom(); return; }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [visible, close, goTo, currentIndex, zoomIn, zoomOut, resetZoom]);

  if (!visible) return null;

  const zoomPercent = isFitToScreen ? 'Fit' : `${Math.round(zoom * 100)}%`;
  const zoomLabel = isFitToScreen ? 'Fit to screen' : `${Math.round(zoom * 100)}% zoom`;
  const anyCtrl = topCtrlVisible || centerCtrlVisible || bottomCtrlVisible;

  return (
    <div
      ref={containerRef}
      className="image-viewer-overlay"
      onMouseDown={handleMouseDown}
      onWheel={handleWheel}
      onClick={() => { if (!wasDraggingRef.current) close(); }}
    >
      {loading ? (
        <div className="image-viewer-loading">
          <div className="loading-spinner" />
        </div>
      ) : imgUrl ? (
        <img
          src={imgUrl}
          alt={currentItem?.originalName || ''}
          className="image-viewer-img"
          draggable={false}
          style={{
            transform: isFitToScreen ? 'none' : `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            objectFit: isFitToScreen ? 'contain' : 'none',
            width: '100%',
            height: '100%',
            cursor: dragEnabled ? (isDraggingRef.current ? 'grabbing' : 'grab') : 'default',
          }}
        />
      ) : (
        <div className="image-viewer-error">Could not load image</div>
      )}

      <div className={`iv-controls-overlay${anyCtrl ? ' visible' : ''}`}>
        <div className={`iv-top-bar${topCtrlVisible ? ' visible' : ''}`} onClick={(e) => e.stopPropagation()}>
          <button className="ctrl-btn close-btn" onClick={close} title="Close (Esc)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
          <div className="iv-title-wrap">
            <span>{currentItem?.originalName || 'Image'}</span>
          </div>
          <span className="iv-counter">
            {currentIndex + 1} / {items.length}
          </span>
        </div>

        {centerCtrlVisible && (
          <div className="iv-center-controls" onClick={(e) => e.stopPropagation()}>
            {items.length > 1 && (
              <button className="ctrl-btn ctrl-btn-lg" onClick={() => goTo(currentIndex - 1)} title="Previous (←)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
            )}
            <button className="ctrl-btn ctrl-btn-play" onClick={resetZoom} title="Fit to screen (0)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" />
              </svg>
            </button>
            {items.length > 1 && (
              <button className="ctrl-btn ctrl-btn-lg" onClick={() => goTo(currentIndex + 1)} title="Next (→)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            )}
          </div>
        )}

        <div className={`iv-bottom-bar${bottomCtrlVisible ? ' visible' : ''}`} onClick={(e) => e.stopPropagation()}>
          <button className="ctrl-btn" onClick={zoomOut} title="Zoom out (-)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35M8 11h6" />
            </svg>
          </button>
          <div className="zoom-display-wrap">
            <button
              className="zoom-display"
              onClick={() => setShowZoomMenu(!showZoomMenu)}
              title={zoomLabel}
            >
              {zoomPercent}
            </button>
            {showZoomMenu && (
              <div className="zoom-menu">
                <button
                  className={`zoom-menu-item${isFitToScreen ? ' active' : ''}`}
                  onClick={() => { resetZoom(); setShowZoomMenu(false); }}
                >
                  Fit to screen
                </button>
                {ZOOM_LEVELS.map((level) => (
                  <button
                    key={level}
                    className={`zoom-menu-item${!isFitToScreen && zoom === level ? ' active' : ''}`}
                    onClick={() => { setIsFitToScreen(false); fitRef.current = false; setZoom(level); zoomRef.current = level; setPan({ x: 0, y: 0 }); setShowZoomMenu(false); }}
                  >
                    {Math.round(level * 100)}%
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className="ctrl-btn" onClick={zoomIn} title="Zoom in (+)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35M8 11h6M11 8v6" />
            </svg>
          </button>
          <span className="iv-separator" />
          <button
            className={`ctrl-btn${dragEnabled ? ' active' : ''}`}
            onClick={toggleDrag}
            title={dragEnabled ? 'Disable drag' : 'Enable drag'}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20" />
            </svg>
          </button>
          <button className="ctrl-btn" onClick={resetZoom} title="Fit to screen (0)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageViewer;
