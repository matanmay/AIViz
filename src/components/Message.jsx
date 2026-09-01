import React, { useState } from 'react';
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
// Uses Kroki GET URLs rendered in <img> tags to completely avoid CORS issues.
// Re-renders only when code is received or manually edited.
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

  return (
    <div className="plantuml-wrapper">
      {/* Diagram Area */}
      <div className="plantuml-diagram-area">
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
          <img
            src={diagramUrl}
            alt="PlantUML Diagram"
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


