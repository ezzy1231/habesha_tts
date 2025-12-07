import { useState, useEffect, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';

/**
 * Professional Image Viewer Modal Component
 * Features: Zoom, Pan, Download, Keyboard navigation, Touch gestures
 */
export default function ImageViewer({ isOpen, src, alt, onClose }) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [touchDistance, setTouchDistance] = useState(0);
  const [isTouchPanning, setIsTouchPanning] = useState(false);
  
  const containerRef = useRef(null);
  const imageRef = useRef(null);

// Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
      setIsLoading(true);
      setHasError(false);
      setTouchDistance(0);
      setIsTouchPanning(false);
    }
  }, [isOpen, src]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case '+':
        case '=':
          handleZoomIn();
          break;
        case '-':
          handleZoomOut();
          break;
        case '0':
          handleResetZoom();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

const handleZoomIn = useCallback(() => {
    setScale((prev) => Math.min(prev + 0.25, 3));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale((prev) => {
      const newScale = Math.max(prev - 0.25, 0.5);
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
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale((prev) => {
      const newScale = Math.min(Math.max(prev + delta, 0.5), 3);
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
        y: e.clientY - dragStart.y,
      });
    }
  }, [isDragging, dragStart, scale]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Touch gesture handlers
  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 2) {
      // Pinch to zoom
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      setTouchDistance(distance);
    } else if (e.touches.length === 1 && scale > 1) {
      // Touch pan
      setIsTouchPanning(true);
      setDragStart({
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y,
      });
    }
  }, [scale, position]);

  const handleTouchMove = useCallback((e) => {
    if (e.touches.length === 2 && touchDistance > 0) {
      // Pinch zoom
      e.preventDefault();
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      const scaleDelta = (distance - touchDistance) / 100;
      setScale((prev) => Math.min(Math.max(prev + scaleDelta, 0.5), 3));
      setTouchDistance(distance);
    } else if (e.touches.length === 1 && isTouchPanning) {
      // Touch pan
      e.preventDefault();
      setPosition({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y,
      });
    }
  }, [touchDistance, isTouchPanning, dragStart]);

  const handleTouchEnd = useCallback(() => {
    setTouchDistance(0);
    setIsTouchPanning(false);
  }, []);

  const handleDownload = useCallback(async () => {
    try {
      const response = await fetch(src);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = alt || 'image';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
      // Fallback: open in new tab
      window.open(src, '_blank');
    }
  }, [src, alt]);

  if (!isOpen) return null;

return (
    <div
      className="fixed inset-0 z-[var(--z-image-viewer)] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/90 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Header Controls */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/70 to-transparent">
        <div className="flex items-center gap-2 text-white/90">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-sm font-medium hidden sm:inline">Image Preview</span>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1 bg-white/10 rounded-full px-3 py-1.5 backdrop-blur-md border border-white/10">
          <button
            onClick={handleZoomOut}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-all"
            title="Zoom out (-)"
            disabled={scale <= 0.5}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <span className="text-white text-sm font-medium min-w-[3.5rem] text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-all"
            title="Zoom in (+)"
            disabled={scale >= 3}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          <div className="w-px h-4 bg-white/20 mx-1" />
          <button
            onClick={handleResetZoom}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-all"
            title="Reset zoom (0)"
            disabled={scale === 1}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleDownload}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-all"
            title="Download image"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>
          <button
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-all"
            title="Close (Esc)"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Image Container */}
      <div
        ref={containerRef}
        className="relative flex items-center justify-center w-full h-full pt-20 pb-16 px-4 overflow-hidden"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ cursor: scale > 1 ? (isDragging || isTouchPanning ? 'grabbing' : 'grab') : 'default' }}
      >
        {/* Loading State */}
        {isLoading && !hasError && (
          <div className="absolute inset-0 flex items-center justify-center z-20">
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 border-3 border-white/20 border-t-white rounded-full animate-spin mb-3" />
              <p className="text-white/60 text-sm">Loading image...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {hasError && (
          <div className="flex flex-col items-center justify-center text-white/70 max-w-md">
            <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-base font-medium mb-1">Failed to load image</p>
            <p className="text-sm text-white/50 text-center">The image could not be displayed. Please try again.</p>
            <button
              onClick={() => {
                setIsLoading(true);
                setHasError(false);
              }}
              className="mt-3 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Image */}
        <img
          ref={imageRef}
          src={src}
          alt={alt || 'Preview'}
          className={`w-auto h-auto max-w-[85vw] max-h-[calc(100vh-10rem)] object-contain rounded-lg shadow-2xl transition-all duration-300 select-none ${isLoading ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}
          style={{
            transform: `scale(${scale}) translate(${position.x}px, ${position.y}px)`,
            transformOrigin: 'center center',
            willChange: 'transform',
          }}
          onLoad={() => setIsLoading(false)}
          onError={() => {
            setIsLoading(false);
            setHasError(true);
          }}
          draggable={false}
        />
      </div>

      {/* Footer Help Text */}
      <div className="absolute bottom-0 left-0 right-0 z-10 flex items-center justify-center p-4 bg-gradient-to-t from-black/50 to-transparent">
        <p className="text-white/40 text-xs font-medium tracking-wide">
          <span className="hidden sm:inline">Scroll to zoom • Drag to pan • </span>
          <span className="sm:hidden">Pinch to zoom • Drag to pan • </span>
          Press <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white/60 text-[11px]">Esc</kbd> to close
        </p>
      </div>
    </div>
  );
}

ImageViewer.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  src: PropTypes.string,
  alt: PropTypes.string,
  onClose: PropTypes.func.isRequired,
};
