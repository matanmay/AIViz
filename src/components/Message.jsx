import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Bot, User, Copy, Check, RotateCcw, AlertCircle } from 'lucide-react';

const RATINGS = [
  { value: 1, emoji: '😞', label: 'Not helpful' },
  { value: 2, emoji: '😕', label: 'Slightly helpful' },
  { value: 3, emoji: '😐', label: 'Somewhat helpful' },
  { value: 4, emoji: '🙂', label: 'Helpful' },
  { value: 5, emoji: '😄', label: 'Very helpful' },
];

export default function Message({ message, onRetry, onCopy, onRate, isLast, requiresFeedback }) {
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
                <ReactMarkdown
                  components={{
                    code({ node, inline, className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || '');
                      const codeContent = String(children).replace(/\n$/, '');
                      const lang = match ? match[1] : 'code';

                      if (!inline) {
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
                  }}
                >
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

