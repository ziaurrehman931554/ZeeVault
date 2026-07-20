import React, { useCallback, useEffect, useRef, useState } from 'react';

const HEADER_HEIGHT = 76;

const CustomScrollbar: React.FC = () => {
  const thumbRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const hoveringRef = useRef(false);
  const draggingRef = useRef(false);
  const dragStartY = useRef(0);
  const dragStartScroll = useRef(0);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();

  const scheduleHide = useCallback(() => {
    clearTimeout(hideTimer.current);
    if (!hoveringRef.current && !draggingRef.current) {
      hideTimer.current = setTimeout(() => setVisible(false), 800);
    }
  }, []);

  const show = useCallback(() => {
    setVisible(true);
    scheduleHide();
  }, [scheduleHide]);

  const getMetrics = useCallback(() => {
    const el = document.documentElement;
    const trackH = el.clientHeight - HEADER_HEIGHT;
    const scrollRange = el.scrollHeight - el.clientHeight;
    const ratio = trackH / el.scrollHeight;
    const thumbH = Math.max(30, trackH * ratio);
    const thumbTop = scrollRange > 0 ? (el.scrollTop / scrollRange) * (trackH - thumbH) : 0;
    return { trackH, scrollRange, thumbH, thumbTop };
  }, []);

  const updateThumb = useCallback(() => {
    const { thumbH, thumbTop } = getMetrics();
    if (!thumbRef.current) return;
    thumbRef.current.style.height = `${thumbH}px`;
    thumbRef.current.style.top = `${thumbTop}px`;
  }, [getMetrics]);

  useEffect(() => {
    const onScroll = () => { show(); updateThumb(); };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', updateThumb, { passive: true });
    updateThumb();
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', updateThumb);
      clearTimeout(hideTimer.current);
    };
  }, [show, updateThumb]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    draggingRef.current = true;
    dragStartY.current = e.clientY;
    dragStartScroll.current = document.documentElement.scrollTop;
    setVisible(true);

    const onMouseMove = (ev: MouseEvent) => {
      if (!draggingRef.current) return;
      const { trackH, scrollRange, thumbH } = getMetrics();
      if (scrollRange <= 0) return;
      const deltaY = ev.clientY - dragStartY.current;
      const scrollDelta = deltaY * (scrollRange / (trackH - thumbH));
      document.documentElement.scrollTop = dragStartScroll.current + scrollDelta;
    };

    const onMouseUp = () => {
      draggingRef.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      scheduleHide();
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [getMetrics, scheduleHide]);

  return (
    <div
      style={{
        position: 'fixed',
        top: HEADER_HEIGHT,
        right: 2,
        width: 12,
        height: `calc(100vh - ${HEADER_HEIGHT}px)`,
        zIndex: 99999,
        pointerEvents: 'none',
      }}
      onMouseEnter={() => { hoveringRef.current = true; setVisible(true); clearTimeout(hideTimer.current); }}
      onMouseLeave={() => { hoveringRef.current = false; if (!draggingRef.current) scheduleHide(); }}
    >
      <div
        ref={thumbRef}
        onMouseDown={onMouseDown}
        style={{
          position: 'absolute',
          right: 4,
          width: 4,
          height: 40,
          borderRadius: 999,
          background: 'rgba(128, 128, 128, 0.5)',
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.25s ease',
          pointerEvents: 'auto',
          cursor: 'default',
        }}
      />
    </div>
  );
};

export default CustomScrollbar;
