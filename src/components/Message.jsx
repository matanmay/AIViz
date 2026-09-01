import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Bot,
  User,
  Copy,
  Check,
  RotateCcw,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ImageOff,
  Edit3,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Download,
  X,
  Scan,
} from 'lucide-react';

// Global in-memory cache for rendered PlantUML image URLs
// Key: trimmed PlantUML code string, Value: Kroki URL string
const plantUmlUrlCache = new Map();

// Helper to generate Kroki GET URL with browser-native deflate compression
// GET requests on <img> elements have zero CORS restrictions.
async function getKrokiUrl(code) {
  try {
    if (typeof CompressionStream !== 'undefined') {
      const stream = new Blob([new TextEncoder().encode(code)]).stream();
      const compressedStream = stream.pipeThrough(new CompressionStream('deflate'));
      const buffer = await new Response(compressedStream).arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      return `https://kroki.io/plantuml/svg/${base64}`;
    }
  } catch (err) {
    console.warn('CompressionStream error:', err);
  }
  return null;
}

// ── PlantUML Diagram Renderer & Live Editor ──────────────────────────────────
// Renders diagrams in large view with zoom controls & fullscreen lightbox.
const PlantUMLDiagram = React.memo(function PlantUMLDiagram({ code, onSaveCode }) {
  const [showSource, setShowSource] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentCode, setCurrentCode] = useState(code);
  const [draftCode, setDraftCode] = useState(code);
  const [isModified, setIsModified] = useState(false);

  const initialKey = (code || '').trim();
  const [diagramUrl, setDiagramUrl] = useState(() => plantUmlUrlCache.get(initialKey) || null);
  const [fetchError, setFetchError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [savedBadge, setSavedBadge] = useState(false);

  // Zoom & Pan state
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = React.useRef({ x: 0, y: 0 });

  const [lightboxPanOffset, setLightboxPanOffset] = useState({ x: 0, y: 0 });
  const [isLightboxDragging, setIsLightboxDragging] = useState(false);
  const lightboxDragStartRef = React.useRef({ x: 0, y: 0 });
  const lightboxContainerRef = useRef(null);
  const lightboxImgRef = useRef(null);

  // Sync if outer code prop changes (e.g. from history load or parent update)
  React.useEffect(() => {
    setCurrentCode(code);
    setDraftCode(code);
  }, [code]);

  // Compute Kroki URL only when currentCode changes
  React.useEffect(() => {
    const key = (currentCode || '').trim();
    if (!key) return;

    // Instant cache hit
    if (plantUmlUrlCache.has(key)) {
      setDiagramUrl(plantUmlUrlCache.get(key));
      setFetchError(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setFetchError(false);

    getKrokiUrl(currentCode).then((url) => {
      if (cancelled) return;
      if (url) {
        plantUmlUrlCache.set(key, url);
        setDiagramUrl(url);
      } else {
        setFetchError(true);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [currentCode]);

  // Handle ESC key to close fullscreen modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    if (isFullscreen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  const handleCopy = () => {
    navigator.clipboard.writeText(isEditing ? draftCode : currentCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStartEdit = () => {
    setDraftCode(currentCode);
    setIsEditing(true);
    setShowSource(true);
  };

  const handleCancelEdit = () => {
    setDraftCode(currentCode);
    setIsEditing(false);
  };

  const handleApplySave = () => {
    const trimmed = draftCode.trim();
    if (!trimmed) return;

    setCurrentCode(draftCode);
    setIsModified(draftCode !== code);
    setIsEditing(false);
    setSavedBadge(true);
    setTimeout(() => setSavedBadge(false), 3000);

    if (onSaveCode) {
      onSaveCode(draftCode);
    }
  };

  const handleResetToOriginal = () => {
    setDraftCode(code);
    setCurrentCode(code);
    setIsModified(false);
    setIsEditing(false);
    setSavedBadge(true);
    setTimeout(() => setSavedBadge(false), 3000);

    if (onSaveCode) {
      onSaveCode(code);
    }
  };

  const handleZoomIn = (e) => {
    e?.stopPropagation();
    setZoomLevel((prev) => Math.min(5, Number((prev + (prev < 0.5 ? 0.1 : 0.2)).toFixed(2))));
  };

  const handleZoomOut = (e) => {
    e?.stopPropagation();
    setZoomLevel((prev) => Math.max(0.1, Number((prev - (prev <= 0.5 ? 0.05 : 0.2)).toFixed(2))));
  };

  const handleResetZoom = (e) => {
    e?.stopPropagation();
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
    setLightboxPanOffset({ x: 0, y: 0 });
  };

  const handleFitToScreen = (e) => {
    e?.stopPropagation();
    if (!lightboxImgRef.current || !lightboxContainerRef.current) return;
    const cWidth = lightboxContainerRef.current.clientWidth - 40;
    const cHeight = lightboxContainerRef.current.clientHeight - 40;
    const nWidth = lightboxImgRef.current.naturalWidth || lightboxImgRef.current.clientWidth;
    const nHeight = lightboxImgRef.current.naturalHeight || lightboxImgRef.current.clientHeight;

    if (nWidth && nHeight) {
      const scaleX = cWidth / nWidth;
      const scaleY = cHeight / nHeight;
      const fitScale = Math.min(scaleX, scaleY, 2.5);
      setZoomLevel(Math.max(0.1, Number(fitScale.toFixed(2))));
      setLightboxPanOffset({ x: 0, y: 0 });
    }
  };

  // Mouse Pan Handlers for Inline Diagram
  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - panOffset.x,
      y: e.clientY - panOffset.y,
    };
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPanOffset({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Mouse Pan Handlers for Fullscreen Lightbox
  const handleLightboxMouseDown = (e) => {
    if (e.button !== 0) return;
    setIsLightboxDragging(true);
    lightboxDragStartRef.current = {
      x: e.clientX - lightboxPanOffset.x,
      y: e.clientY - lightboxDragStartRef.current.y,
    };
  };

  const handleLightboxMouseMove = (e) => {
    if (!isLightboxDragging) return;
    setLightboxPanOffset({
      x: e.clientX - lightboxDragStartRef.current.x,
      y: e.clientY - lightboxDragStartRef.current.y,
    });
  };

  const handleLightboxMouseUp = () => {
    setIsLightboxDragging(false);
  };

  const handleDownload = async (e) => {
    e?.stopPropagation();
    if (!diagramUrl) return;
    try {
      const res = await fetch(diagramUrl);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `plantuml-diagram-${Date.now()}.svg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.warn('Download error:', err);
      window.open(diagramUrl, '_blank');
    }
  };

  return (
    <>
      <div className="plantuml-wrapper">
        {/* Diagram Area with floating toolbar */}
        <div className="plantuml-diagram-area">
          {/* Floating zoom & expand toolbar */}
          {diagramUrl && !loading && !fetchError && (
            <div className="plantuml-floating-toolbar">
              <div className="plantuml-zoom-controls">
                <button
                  className="plantuml-tool-btn"
                  onClick={handleZoomIn}
                  title="Zoom in (+)"
                  disabled={zoomLevel >= 5}
                >
                  <ZoomIn size={14} />
                </button>
                <button
                  className="plantuml-tool-btn zoom-indicator-btn"
                  onClick={handleResetZoom}
                  title="Reset zoom and position (100%)"
                >
                  <span>{Math.round(zoomLevel * 100)}%</span>
                </button>
                <button
                  className="plantuml-tool-btn"
                  onClick={handleZoomOut}
                  title="Zoom out (-)"
                  disabled={zoomLevel <= 0.1}
                >
                  <ZoomOut size={14} />
                </button>
              </div>

              {(panOffset.x !== 0 || panOffset.y !== 0) && (
                <button
                  className="plantuml-tool-btn pan-reset-btn"
                  onClick={() => setPanOffset({ x: 0, y: 0 })}
                  title="Reset pan position"
                >
                  <RotateCcw size={12} />
                  <span>Center</span>
                </button>
              )}

              <button
                className="plantuml-tool-btn"
                onClick={handleDownload}
                title="Download SVG diagram"
              >
                <Download size={14} />
              </button>

              <button
                className="plantuml-tool-btn expand-btn"
                onClick={() => {
                  setLightboxPanOffset({ x: 0, y: 0 });
                  setIsFullscreen(true);
                }}
                title="Full size view"
              >
                <Maximize2 size={14} />
                <span>Expand</span>
              </button>
            </div>
          )}

          {loading && (
            <div className="plantuml-loading">
              <div className="plantuml-spinner" />
              <span>Rendering diagram…</span>
            </div>
          )}

          {fetchError && !loading && (
            <div className="plantuml-error">
              <ImageOff size={28} />
              <span>Could not render diagram. Check your PlantUML syntax.</span>
            </div>
          )}

          {diagramUrl && (
            <div
              className={`plantuml-canvas-viewport ${isDragging ? 'is-dragging' : ''}`}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              title="Click & drag to move diagram"
            >
              <img
                src={diagramUrl}
                alt="PlantUML Diagram"
                style={{
                  transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
                  transformOrigin: 'center center',
                }}
                draggable={false}
                className={`plantuml-img ${loading ? 'plantuml-img-hidden' : ''}`}
                onLoad={() => {
                  setLoading(false);
                  setFetchError(false);
                }}
                onError={() => {
                  setLoading(false);
                  setFetchError(true);
                }}
              />
            </div>
          )}
        </div>

      {/* Footer: toggle source + edit button + copy */}
      <div className="plantuml-footer">
        <div className="plantuml-footer-left">
          <button
            className="plantuml-toggle-btn"
            onClick={() => {
              if (isEditing && showSource) {
                setIsEditing(false);
              }
              setShowSource((v) => !v);
            }}
          >
            {showSource ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            <span>{showSource ? 'Hide source' : 'Show PlantUML source'}</span>
          </button>

          {!isEditing && (
            <button
              className="plantuml-edit-toggle-btn"
              onClick={handleStartEdit}
              title="Edit PlantUML code manually"
            >
              <Edit3 size={13} />
              <span>Edit code</span>
            </button>
          )}

          {isModified && (
            <span className="plantuml-modified-pill" title="Code was edited manually">
              Edited
            </span>
          )}

          {savedBadge && (
            <span className="plantuml-saved-pill">
              <Check size={11} /> Saved & Updated
            </span>
          )}
        </div>

        <div className="plantuml-footer-right">
          {isModified && !isEditing && (
            <button
              className="plantuml-reset-btn"
              onClick={handleResetToOriginal}
              title="Reset to AI's original code"
            >
              <RotateCcw size={12} />
              <span>Reset</span>
            </button>
          )}
          <button className="code-copy-btn" onClick={handleCopy} title="Copy source">
            {copied ? <Check size={12} /> : <Copy size={12} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {/* Source View or Interactive Code Editor */}
      {showSource && (
        <div className="plantuml-source-section">
          {isEditing ? (
            <div className="plantuml-editor-container">
              <div className="plantuml-editor-top">
                <div className="plantuml-editor-title">
                  <Edit3 size={13} className="text-accent" />
                  <span>Editing PlantUML Source</span>
                  <span className="plantuml-editor-hint">
                    (Next prompts will build on your edited code)
                  </span>
                </div>
              </div>
              <textarea
                className="plantuml-code-textarea"
                value={draftCode}
                onChange={(e) => setDraftCode(e.target.value)}
                placeholder="Type PlantUML code here..."
                rows={Math.max(6, Math.min(20, draftCode.split('\n').length + 2))}
                spellCheck="false"
                autoFocus
              />
              <div className="plantuml-editor-actions">
                <div className="plantuml-editor-actions-left">
                  <button
                    className="plantuml-action-save-btn"
                    onClick={handleApplySave}
                    title="Apply changes and update diagram"
                  >
                    <Check size={13} />
                    <span>Apply & Save Changes</span>
                  </button>
                  <button
                    className="plantuml-action-cancel-btn"
                    onClick={handleCancelEdit}
                    title="Cancel editing"
                  >
                    <span>Cancel</span>
                  </button>
                </div>
                {draftCode !== code && (
                  <button
                    className="plantuml-action-revert-btn"
                    onClick={() => setDraftCode(code)}
                    title="Reset textarea to original code"
                  >
                    <RotateCcw size={12} />
                    <span>Revert to original</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="plantuml-source">
              <div className="plantuml-source-header">
                <span className="plantuml-source-lang">plantuml</span>
                <button
                  className="plantuml-edit-quick-btn"
                  onClick={handleStartEdit}
                  title="Edit this code"
                >
                  <Edit3 size={12} />
                  <span>Edit code</span>
                </button>
              </div>
              <pre className="code-pre">
                <code className="language-plantuml">{currentCode}</code>
              </pre>
            </div>
          )}
        </div>
      )}
    </div>

    {/* Fullscreen Lightbox Modal */}
    {isFullscreen && diagramUrl && (
      <div className="plantuml-lightbox-backdrop" onClick={() => setIsFullscreen(false)}>
        <div className="plantuml-lightbox-modal" onClick={(e) => e.stopPropagation()}>
          <div className="plantuml-lightbox-header">
            <div className="plantuml-lightbox-title">
              <span>PlantUML Diagram Preview</span>
            </div>
            <div className="plantuml-lightbox-actions">
              <div className="plantuml-zoom-controls">
                <button
                  className="plantuml-tool-btn"
                  onClick={handleZoomIn}
                  title="Zoom in (+)"
                  disabled={zoomLevel >= 5}
                >
                  <ZoomIn size={15} />
                </button>
                <button
                  className="plantuml-tool-btn zoom-indicator-btn"
                  onClick={handleResetZoom}
                  title="Reset zoom (100%)"
                >
                  <span>{Math.round(zoomLevel * 100)}%</span>
                </button>
                <button
                  className="plantuml-tool-btn"
                  onClick={handleZoomOut}
                  title="Zoom out (-)"
                  disabled={zoomLevel <= 0.1}
                >
                  <ZoomOut size={15} />
                </button>
              </div>
              <button
                className="plantuml-tool-btn"
                onClick={handleFitToScreen}
                title="Fit diagram to screen"
              >
                <Scan size={14} />
                <span>Fit</span>
              </button>

              {(lightboxPanOffset.x !== 0 || lightboxPanOffset.y !== 0) && (
                <button
                  className="plantuml-tool-btn pan-reset-btn"
                  onClick={() => setLightboxPanOffset({ x: 0, y: 0 })}
                  title="Reset pan position"
                >
                  <RotateCcw size={13} />
                  <span>Center</span>
                </button>
              )}
              <button
                className="plantuml-tool-btn download-btn"
                onClick={handleDownload}
                title="Download SVG diagram"
              >
                <Download size={14} />
                <span>Download SVG</span>
              </button>
              <button
                className="plantuml-lightbox-close-btn"
                onClick={() => setIsFullscreen(false)}
                title="Close (Esc)"
              >
                <X size={18} />
              </button>
            </div>
          </div>
          <div
            ref={lightboxContainerRef}
            className={`plantuml-lightbox-body ${isLightboxDragging ? 'is-dragging' : ''}`}
            onMouseDown={handleLightboxMouseDown}
            onMouseMove={handleLightboxMouseMove}
            onMouseUp={handleLightboxMouseUp}
            onMouseLeave={handleLightboxMouseUp}
            title="Click & drag to move diagram"
          >
            <img
              ref={lightboxImgRef}
              src={diagramUrl}
              alt="PlantUML Diagram Fullscreen"
              style={{
                transform: `translate(${lightboxPanOffset.x}px, ${lightboxPanOffset.y}px) scale(${zoomLevel})`,
                transformOrigin: 'center center',
              }}
              draggable={false}
              className="plantuml-lightbox-img"
            />
          </div>
        </div>
      </div>
    )}
  </>
  );
});
// ─────────────────────────────────────────────────────────────────────────────


const RATINGS = [
  { value: 1, emoji: '😞', label: 'Not helpful' },
  { value: 2, emoji: '😕', label: 'Slightly helpful' },
  { value: 3, emoji: '😐', label: 'Somewhat helpful' },
  { value: 4, emoji: '🙂', label: 'Helpful' },
  { value: 5, emoji: '😄', label: 'Very helpful' },
];

function Message({
  message,
  onRetry,
  onCopy,
  onRate,
  onUpdateMessage,
  isLast,
  requiresFeedback,
}) {
  const [copied, setCopied] = useState(false);
  const [hovered, setHovered] = useState(null);
  // Rating is stored in parent state (message.userRating) — not local state
  // so it survives re-renders and component remounts
  const rating = message.userRating ?? null;
  const isUser = message.role === 'user';
  const isError = message.isError || message.role === 'error';

  const handleCopyText = (text, type = 'text', language = null) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);

    if (onCopy) {
      onCopy({ content: text, contentType: type, language });
    }
  };

  const handleRate = (value) => {
    if (rating !== null) return; // already rated
    if (onRate) {
      onRate({ rating: value, messageId: message.id, interactionId: message.interactionId || null });
    }
  };

  const formatTime = (isoString) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  // Memoize markdown components to avoid destroying & remounting subcomponents on typing/hover
  const markdownComponents = React.useMemo(
    () => ({
      p({ children }) {
        return <div className="markdown-paragraph">{children}</div>;
      },
      code({ node, inline, className, children, ...props }) {
        const match = /language-(\w+)/.exec(className || '');
        const codeContent = String(children).replace(/\n$/, '');
        const lang = match ? match[1] : 'code';

        if (!inline) {
          // ── PlantUML: render diagram + editable source ──
          if (lang === 'plantuml') {
            return (
              <PlantUMLDiagram
                code={codeContent}
                onSaveCode={(newCode) => {
                  if (!onUpdateMessage) return;
                  let newContent = message.content;
                  const targetBlock = '```plantuml\n' + codeContent + '\n```';
                  if (newContent.includes(targetBlock)) {
                    newContent = newContent.replace(
                      targetBlock,
                      '```plantuml\n' + newCode + '\n```'
                    );
                  } else {
                    const escaped = codeContent
                      .trim()
                      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const regex = new RegExp(
                      '```plantuml\\s*' + escaped + '\\s*```',
                      'g'
                    );
                    if (regex.test(newContent)) {
                      newContent = newContent.replace(
                        regex,
                        '```plantuml\n' + newCode + '\n```'
                      );
                    } else {
                      newContent = newContent.replace(
                        /```plantuml[\s\S]*?```/,
                        '```plantuml\n' + newCode + '\n```'
                      );
                    }
                  }
                  onUpdateMessage(message.id, newContent, {
                    oldCode: codeContent,
                    newCode,
                  });
                }}
              />
            );
          }

          return (
            <div className="code-block-wrapper">
              <div className="code-header">
                <span className="code-lang">{lang}</span>
                <button
                  className="code-copy-btn"
                  onClick={() => handleCopyText(codeContent, 'code', lang)}
                  title="Copy code"
                >
                  <Copy size={12} />
                  <span>Copy</span>
                </button>
              </div>
              <pre className="code-pre">
                <code className={className} {...props}>
                  {children}
                </code>
              </pre>
            </div>
          );
        }
        return (
          <code className="inline-code" {...props}>
            {children}
          </code>
        );
      },
    }),
    [message.content, message.id, onUpdateMessage]
  );

  return (
    <div className={`message-row ${isUser ? 'user-row' : 'assistant-row'} ${isError ? 'error-row' : ''}`}>
      <div className="message-container">
        {/* Avatar */}
        <div className={`avatar ${isUser ? 'user-avatar' : 'assistant-avatar'} ${isError ? 'error-avatar' : ''}`}>
          {isUser ? (
            <User size={18} />
          ) : isError ? (
            <AlertCircle size={18} />
          ) : (
            <Bot size={18} />
          )}
        </div>

        {/* Content Bubble */}
        <div className="message-bubble-wrapper">
          <div className="message-header">
            <span className="sender-name">
              {isUser ? 'You' : 'AI Assistant'}
            </span>
            {message.timestamp && (
              <span className="message-time">{formatTime(message.timestamp)}</span>
            )}
          </div>

          <div className={`message-bubble ${isUser ? 'user-bubble' : 'assistant-bubble'} ${isError ? 'error-bubble' : ''}`}>
            {isError ? (
              <div className="error-content">
                <p>{message.content}</p>
                {onRetry && (
                  <button className="retry-btn" onClick={onRetry}>
                    <RotateCcw size={14} />
                    <span>Retry Request</span>
                  </button>
                )}
              </div>
            ) : isUser ? (
              <p className="user-text">{message.content}</p>
            ) : (
              <div className="markdown-content">
                <ReactMarkdown components={markdownComponents}>
                  {message.content}
                </ReactMarkdown>
              </div>
            )}
          </div>

          {/* Action Footer */}
          {!isError && (
            <div className="message-actions">
              <button
                className="action-btn"
                onClick={() => handleCopyText(message.content, 'message')}
                title="Copy message"
              >
                {copied ? <Check size={13} className="text-success" /> : <Copy size={13} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>

              {!isUser && onRetry && isLast && (
                <button
                  className="action-btn"
                  onClick={onRetry}
                  title="Regenerate response"
                >
                  <RotateCcw size={13} />
                  <span>Regenerate</span>
                </button>
              )}
            </div>
          )}

          {/* Feedback Rating — shown only for assistant messages */}
          {!isUser && !isError && (
            <div className={`feedback-rating ${requiresFeedback ? 'feedback-required' : ''}`}>
              {rating === null ? (
                <>
                  <span className="feedback-label">Was this helpful?</span>
                  <div className="feedback-emojis">
                    {RATINGS.map(({ value, emoji, label }) => (
                      <button
                        key={value}
                        className={`feedback-emoji-btn ${hovered === value ? 'hovered' : ''}`}
                        onClick={() => handleRate(value)}
                        onMouseEnter={() => setHovered(value)}
                        onMouseLeave={() => setHovered(null)}
                        title={label}
                        aria-label={`Rate ${value} - ${label}`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="feedback-submitted">
                  <span className="feedback-submitted-emoji">
                    {RATINGS.find((r) => r.value === rating)?.emoji}
                  </span>
                  <span className="feedback-submitted-text">Thanks for your feedback!</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default React.memo(Message);


