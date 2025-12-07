import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';

/**
 * Professional Image Viewer Modal Component
 * Refactored to address all layout and logic issues:
 * - Uses createPortal to render at body level (fixes nesting constraints)
 * - Fullscreen fixed layout with no card styling
 * - Correct transform order (translate then scale)
 * - Global event handling for zoom/pan
 */
export default function ImageViewer({ isOpen, src, alt, onClose }) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  
  // Touch state
  const lastTouchDistance = useRef(null);
  const lastTouchPosition = useRef(null);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
      setIsLoading(true);
      setHasError(false);
      lastTouchDistance.current = null;
      lastTouchPosition.current = null;
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, src]);

  // Keyboard support
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === '+' || e.key === '=') handleZoomIn();
      if (e.key === '-') handleZoomOut();
      if (e.key === '0') handleResetZoom();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleZoomIn = useCallback(() => {
    setScale(s => Math.min(s + 0.5, 5));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale(s => {
      const newScale = Math.max(s - 0.5, 1);
      if (newScale === 1) setPosition({ x: 0, y: 0 });
      return newScale;
    });
  }, []);

  const handleResetZoom = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY * -0.002;
    setScale(prev => {
      const newScale = Math.min(Math.max(prev + delta, 1), 5);
      if (newScale === 1) setPosition({ x: 0, y: 0 });
      return newScale;
    });
  }, []);

  const handleMouseDown = useCallback((e) => {
    if (scale > 1) {
      e.preventDefault();
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  }, [scale, position]);

  const handleMouseMove = useCallback((e) => {
    if (isDragging && scale > 1) {
      e.preventDefault();
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  }, [isDragging, dragStart, scale]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Touch Handlers
  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      lastTouchDistance.current = dist;
    } else if (e.touches.length === 1 && scale > 1) {
      setIsDragging(true);
      lastTouchPosition.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      setDragStart({ x: e.touches[0].clientX - position.x, y: e.touches[0].clientY - position.y });
    }
  }, [scale, position]);

  const handleTouchMove = useCallback((e) => {
    if (e.touches.length === 2 && lastTouchDistance.current !== null) {
      // Pinch Zoom
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const delta = dist - lastTouchDistance.current;
      setScale(prev => Math.min(Math.max(prev + delta * 0.01, 1), 5));
      lastTouchDistance.current = dist;
    } else if (e.touches.length === 1 && isDragging && scale > 1) {
      // Pan
      e.preventDefault(); // Prevent scrolling
      setPosition({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y
      });
    }
  }, [isDragging, scale, dragStart]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    lastTouchDistance.current = null;
    lastTouchPosition.current = null;
  }, []);

  const handleDownload = async () => {
    try {
      const response = await fetch(src);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = alt || 'download';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      window.open(src, '_blank');
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center overflow-hidden touch-none"
      onWheel={handleWheel}
    >
      {/* Toolbar - Fixed at top, high z-index */}
      <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-4">
          <button 
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-all"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          <span className="text-white font-medium truncate max-w-[200px]">{alt || 'Image Preview'}</span>
        </div>

        <div className="pointer-events-auto flex items-center gap-2 bg-black/40 backdrop-blur-md rounded-full px-2 py-1 border border-white/10">
          <button onClick={handleZoomOut} className="p-2 text-white hover:text-blue-400" disabled={scale <= 1}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
          </button>
          <span className="text-white text-sm w-12 text-center">{Math.round(scale * 100)}%</span>
          <button onClick={handleZoomIn} className="p-2 text-white hover:text-blue-400" disabled={scale >= 5}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          </button>
          <div className="w-px h-4 bg-white/20 mx-1" />
          <button onClick={handleDownload} className="p-2 text-white hover:text-green-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          </button>
        </div>
      </div>

      {/* Interactive Container */}
      <div
        className="w-full h-full flex items-center justify-center cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-40">
            <div className="w-12 h-12 border-4 border-white/20 border-t-blue-500 rounded-full animate-spin" />
          </div>
        )}

        <img
          src={src}
          alt={alt}
          onLoad={() => setIsLoading(false)}
          onError={() => { setIsLoading(false); setHasError(true); }}
          draggable={false}
          className={`max-w-full max-h-full object-contain transition-transform duration-75 ease-linear select-none ${isLoading ? 'opacity-0' : 'opacity-100'}`}
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            willChange: 'transform'
          }}
        />
        
        {hasError && (
          <div className="absolute inset-0 flex items-center justify-center text-white">
            <div className="text-center">
              <p className="text-xl font-bold mb-2">Failed to load image</p>
              <button onClick={onClose} className="text-blue-400 hover:underline">Close</button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

ImageViewer.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  src: PropTypes.string,
  alt: PropTypes.string,
  onClose: PropTypes.func.isRequired,
};
