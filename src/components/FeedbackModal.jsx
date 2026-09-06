import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Check, AlertCircle, Loader2, MessageSquare, Bot } from 'lucide-react';

export const RATINGS = [
  { value: 1, emoji: '😞', label: 'Not helpful',      color: '#ef4444', bg: 'rgba(239,68,68,0.12)'   },
  { value: 2, emoji: '😕', label: 'Slightly helpful', color: '#f97316', bg: 'rgba(249,115,22,0.12)'  },
  { value: 3, emoji: '😐', label: 'Okay',             color: '#eab308', bg: 'rgba(234,179,8,0.12)'   },
  { value: 4, emoji: '🙂', label: 'Helpful',          color: '#22c55e', bg: 'rgba(34,197,94,0.12)'   },
  { value: 5, emoji: '😄', label: 'Very helpful',     color: '#6366f1', bg: 'rgba(99,102,241,0.14)'  },
];

const MAX_CHARS = 1000;

export default function FeedbackModal({
  isOpen,
  onClose,
  onSubmit,
  targetMessage,
  currentUser,
}) {
  const [selectedRating, setSelectedRating] = useState(null);
  const [comment, setComment]               = useState('');
  const [isSubmitting, setIsSubmitting]     = useState(false);
  const [errorMessage, setErrorMessage]     = useState('');
  const [submitted, setSubmitted]           = useState(false);

  const modalRef = useRef(null);
  const firstBtnRef = useRef(null);

  /* ── Reset state on open ── */
  useEffect(() => {
    if (isOpen && targetMessage) {
      setSelectedRating(targetMessage.userRating ?? null);
      setComment(targetMessage.feedbackComment || '');
      setErrorMessage('');
      setIsSubmitting(false);
      setSubmitted(false);
    }
  }, [isOpen, targetMessage]);

  /* ── Auto-focus first emoji button ── */
  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => firstBtnRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  /* ── ESC + focus trap ── */
  const handleKeyDown = useCallback((e) => {
    if (!isOpen) return;
    if (e.key === 'Escape' && !isSubmitting) { onClose(); return; }
    if (e.key === 'Tab') {
      const focusable = modalRef.current?.querySelectorAll(
        'button:not(:disabled), textarea:not(:disabled)'
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last  = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    }
  }, [isOpen, isSubmitting, onClose]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  /* ── Submit ── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedRating) {
      setErrorMessage('Please choose a rating before submitting.');
      firstBtnRef.current?.focus();
      return;
    }
    setIsSubmitting(true);
    setErrorMessage('');
    try {
      if (onSubmit) {
        await onSubmit({
          rating: selectedRating,
          comment: comment.trim() || null,
          messageId: targetMessage?.id,
          interactionId: targetMessage?.interactionId || targetMessage?.id,
        });
      }
      setSubmitted(true);
      setTimeout(() => onClose(), 1000);
    } catch (err) {
      console.error('Failed to submit feedback:', err);
      setErrorMessage(err.message || 'Failed to submit. Please try again.');
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !targetMessage) return null;

  const rawText = (targetMessage.content || '')
    .replace(/```[\s\S]*?```/g, '[Code / Diagram]')
    .trim();
  const previewText = rawText.length > 200 ? rawText.slice(0, 200) + '…' : rawText;

  const charCount = comment.length;
  const charNear  = charCount > MAX_CHARS * 0.85;
  const charOver  = charCount >= MAX_CHARS;

  const activeMeta = RATINGS.find(r => r.value === selectedRating);

  return (
    <div className="modal-backdrop" onClick={onClose} aria-hidden="true">
      <div
        ref={modalRef}
        className="feedback-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="fm-title"
        aria-describedby="fm-subtitle"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="fm-header">
          <div className="fm-header-left">
            {/* Animated emoji hero based on selection */}
            <div
              className="fm-header-emoji"
              aria-hidden="true"
              style={activeMeta ? { background: activeMeta.bg, borderColor: activeMeta.color } : undefined}
            >
              {activeMeta ? activeMeta.emoji : '💬'}
            </div>
            <div className="fm-header-text">
              <h3 id="fm-title" className="fm-title">Rate AI Response</h3>
              <p id="fm-subtitle" className="fm-subtitle">
                Your feedback helps improve the experiment
              </p>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close feedback dialog"
          >
            <X size={18} />
          </button>
        </div>

        <form className="feedback-form" onSubmit={handleSubmit} noValidate>

          {/* Error banner */}
          {errorMessage && (
            <div className="feedback-error-banner" role="alert" aria-live="assertive">
              <AlertCircle size={15} aria-hidden="true" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* AI Response preview */}
          <div className="feedback-message-preview">
            <div className="preview-top">
              <div className="preview-author">
                <Bot size={13} aria-hidden="true" />
                <span>AI Assistant</span>
              </div>
              {targetMessage.timestamp && (
                <span className="preview-time">
                  {new Date(targetMessage.timestamp).toLocaleTimeString([], {
                    hour: '2-digit', minute: '2-digit',
                  })}
                </span>
              )}
            </div>
            <p className="preview-body">{previewText || 'AI response content'}</p>
          </div>

          {/* ── Emoji Rating ── */}
          <div className="feedback-section">
            <span className="feedback-section-label">
              How helpful was this response?
              <span className="required-star" aria-hidden="true"> *</span>
            </span>

            <div className="fm-emoji-row" role="radiogroup" aria-label="Rating">
              {RATINGS.map(({ value, emoji, label, color, bg }, idx) => {
                const isSelected = selectedRating === value;
                return (
                  <button
                    key={value}
                    ref={idx === 0 ? firstBtnRef : undefined}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    aria-label={`${value} – ${label}`}
                    className={`fm-emoji-btn ${isSelected ? 'selected' : ''}`}
                    style={isSelected ? { '--rating-color': color, '--rating-bg': bg } : undefined}
                    onClick={() => { setSelectedRating(value); setErrorMessage(''); }}
                    disabled={isSubmitting}
                  >
                    <span className="fm-emoji" aria-hidden="true">{emoji}</span>
                    <span className="fm-emoji-label">{label}</span>
                  </button>
                );
              })}
            </div>

            {/* Selection feedback strip */}
            <div className={`fm-selection-strip ${activeMeta ? 'visible' : ''}`}>
              {activeMeta && (
                <>
                  <span className="fm-strip-dot" style={{ background: activeMeta.color }} />
                  <span className="fm-strip-text" style={{ color: activeMeta.color }}>
                    {activeMeta.value} / 5 — {activeMeta.label}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* ── Comments ── */}
          <div className="feedback-section">
            <div className="feedback-section-header">
              <label className="feedback-section-label" htmlFor="fm-comments">
                <MessageSquare size={13} aria-hidden="true" />
                Comments &amp; Notes
                <span className="fm-lang-hint"> (הערות)</span>
              </label>
              <span className="feedback-optional-tag">Optional</span>
            </div>
            <textarea
              id="fm-comments"
              className="feedback-comment-textarea"
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="What was helpful or unhelpful? Any missing elements or inaccuracies…"
              disabled={isSubmitting}
              maxLength={MAX_CHARS}
              aria-describedby="fm-char-count"
            />
            <div className="textarea-footer">
              <span
                id="fm-char-count"
                className={`textarea-char-count ${charNear ? 'near' : ''} ${charOver ? 'over' : ''}`}
                aria-live="polite"
              >
                {charCount} / {MAX_CHARS}
              </span>
            </div>
          </div>

          {/* ── Footer ── */}
          <div className="fm-footer">
            <button
              type="button"
              className="material-cancel-btn"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`feedback-submit-btn ${submitted ? 'submitted' : ''}`}
              disabled={isSubmitting || !selectedRating || submitted}
              aria-busy={isSubmitting}
            >
              {submitted ? (
                <><Check size={16} aria-hidden="true" /><span>Saved!</span></>
              ) : isSubmitting ? (
                <><Loader2 size={16} className="spin" aria-hidden="true" /><span>Saving…</span></>
              ) : (
                <><Check size={16} aria-hidden="true" /><span>Submit Feedback</span></>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}



