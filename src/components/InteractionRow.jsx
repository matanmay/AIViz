import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Bot, User, Copy, Check, RotateCcw, Clock, Loader2 } from 'lucide-react';

/**
 * InteractionRow — displays a user prompt and its AI response side-by-side
 * in the same row, each with its own timestamp.
 */
export default function InteractionRow({
  userMessage,
  assistantMessage,
  isLoading,
  isLast,
  onRetry,
  onCopy,
}) {
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedResponse, setCopiedResponse] = useState(false);

  const formatTime = (isoString) => {
    if (!isoString) return '';
    try {
      return new Date(isoString).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return '';
    }
  };

  const handleCopy = (text, side, type = 'text') => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    if (side === 'prompt') {
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    } else {
      setCopiedResponse(true);
      setTimeout(() => setCopiedResponse(false), 2000);
    }
    if (onCopy) {
      onCopy({ content: text, contentType: type });
    }
  };

  return (
    <div className="interaction-row">
      {/* ── Prompt Column ─────────────────────────────── */}
      <div className="interaction-cell prompt-cell">
        <div className="cell-header">
          <div className="cell-avatar user-avatar-sm">
            <User size={14} />
          </div>
          <span className="cell-label">Prompt</span>
          {userMessage?.timestamp && (
            <span className="cell-time">
              <Clock size={11} />
              {formatTime(userMessage.timestamp)}
            </span>
          )}
        </div>
        <div className="cell-body prompt-body">
          <p className="prompt-text">{userMessage?.content}</p>
        </div>
        {userMessage?.content && (
          <div className="cell-actions">
            <button
              className="action-btn"
              onClick={() => handleCopy(userMessage.content, 'prompt')}
              title="Copy prompt"
            >
              {copiedPrompt ? <Check size={12} className="text-success" /> : <Copy size={12} />}
              <span>{copiedPrompt ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        )}
      </div>

      {/* ── Divider ───────────────────────────────────── */}
      <div className="interaction-divider">
        <div className="divider-arrow">→</div>
      </div>

      {/* ── Response Column ───────────────────────────── */}
      <div className="interaction-cell response-cell">
        <div className="cell-header">
          <div className="cell-avatar assistant-avatar-sm">
            <Bot size={14} />
          </div>
          <span className="cell-label">Response</span>
          {assistantMessage?.timestamp && (
            <span className="cell-time">
              <Clock size={11} />
              {formatTime(assistantMessage.timestamp)}
            </span>
          )}
        </div>

        <div className="cell-body response-body">
          {isLoading && isLast && !assistantMessage ? (
            <div className="response-loading">
              <Loader2 size={16} className="spinner" />
              <span>Generating response…</span>
            </div>
          ) : assistantMessage ? (
            <div className="markdown-content response-markdown">
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
                              onClick={() =>
                                handleCopy(codeContent, 'response', lang)
                              }
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
                {assistantMessage.content}
              </ReactMarkdown>
            </div>
          ) : null}
        </div>

        {assistantMessage && (
          <div className="cell-actions">
            <button
              className="action-btn"
              onClick={() => handleCopy(assistantMessage.content, 'response')}
              title="Copy response"
            >
              {copiedResponse ? (
                <Check size={12} className="text-success" />
              ) : (
                <Copy size={12} />
              )}
              <span>{copiedResponse ? 'Copied' : 'Copy'}</span>
            </button>
            {onRetry && isLast && (
              <button
                className="action-btn"
                onClick={onRetry}
                title="Regenerate response"
              >
                <RotateCcw size={12} />
                <span>Regenerate</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
