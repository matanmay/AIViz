import React, { useState, useEffect } from 'react';
import { X, Star, Check, AlertCircle, Loader2, MessageSquare, Bot } from 'lucide-react';

export const RATINGS = [
  { value: 1, emoji: '😞', label: 'Not helpful', desc: 'Inaccurate or confusing' },
  { value: 2, emoji: '😕', label: 'Slightly helpful', desc: 'Partially correct' },
  { value: 3, emoji: '😐', label: 'Somewhat helpful', desc: 'Acceptable but basic' },
  { value: 4, emoji: '🙂', label: 'Helpful', desc: 'Good and clear' },
  { value: 5, emoji: '😄', label: 'Very helpful', desc: 'Excellent and accurate' },
];

export default function FeedbackModal({
  isOpen,
  onClose,
  onSubmit,
  targetMessage,
  currentUser,
}) {
  const [selectedRating, setSelectedRating] = useState(null);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Sync initial values when modal opens
  useEffect(() => {
    if (isOpen && targetMessage) {
      setSelectedRating(targetMessage.userRating ?? null);
      setComment(targetMessage.feedbackComment || '');
      setErrorMessage('');
      setIsSubmitting(false);
    }
  }, [isOpen, targetMessage]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedRating) {
      setErrorMessage('Please select a rating score between 1 and 5.');
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
      onClose();
    } catch (err) {
      console.error('Failed to submit feedback:', err);
      setErrorMessage(err.message || 'Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !targetMessage) return null;

  // Extract preview text from response
  const responseSnippet = (targetMessage.content || '')
    .replace(/```[\s\S]*?```/g, '[Diagram / Code]')
    .trim();
  const truncatedSnippet =
    responseSnippet.length > 180
      ? responseSnippet.slice(0, 180) + '...'
      : responseSnippet;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="feedback-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="feedback-modal-title"
      >
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <h3 id="feedback-modal-title" className="modal-title">
              <Star size={18} className="text-warning" />
              Rate AI Response
            </h3>
            <span className="modal-subtitle">
              Your feedback helps evaluate the conceptual modeling experiment
            </span>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body Form */}
        <form className="feedback-form" onSubmit={handleSubmit}>
          {errorMessage && (
            <div className="feedback-error-banner">
              <AlertCircle size={16} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Response Preview Card */}
          <div className="feedback-message-preview">
            <div className="preview-top">
              <div className="preview-author">
                <Bot size={14} />
                <span>AI Assistant Response</span>
              </div>
              {targetMessage.timestamp && (
                <span className="preview-time">
                  {new Date(targetMessage.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              )}
            </div>
            <p className="preview-body">{truncatedSnippet || 'AI response content'}</p>
          </div>

          {/* Rating Options (1 to 5) */}
          <div className="feedback-section">
            <label className="feedback-section-label">
              How helpful was this response? <span className="required-star">*</span>
            </label>
            <div className="feedback-rating-grid" role="radiogroup">
              {RATINGS.map(({ value, emoji, label, desc }) => {
                const isSelected = selectedRating === value;
                return (
                  <button
                    key={value}
                    type="button"
                    className={`rating-card-btn ${isSelected ? 'selected' : ''}`}
                    onClick={() => {
                      setSelectedRating(value);
                      setErrorMessage('');
                    }}
                    role="radio"
                    aria-checked={isSelected}
                  >
                    <span className="rating-emoji">{emoji}</span>
                    <span className="rating-score">{value} / 5</span>
                    <span className="rating-label">{label}</span>
                    <span className="rating-desc">{desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Feedback Comments / Notes */}
          <div className="feedback-section">
            <div className="feedback-section-header">
              <label className="feedback-section-label" htmlFor="feedback-notes">
                <MessageSquare size={14} />
                Comments & Suggestions (הערות לפידבק)
              </label>
              <span className="feedback-optional-tag">Optional</span>
            </div>
            <textarea
              id="feedback-notes"
              className="feedback-comment-textarea"
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="What was helpful or unhelpful? Any missing elements or inaccuracies in the model..."
              disabled={isSubmitting}
              maxLength={1000}
            />
            <div className="textarea-footer">
              <span className="textarea-char-count">{comment.length} / 1000 chars</span>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="modal-footer feedback-modal-footer">
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
              className="feedback-submit-btn"
              disabled={isSubmitting || !selectedRating}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="spin" />
                  <span>Saving Feedback...</span>
                </>
              ) : (
                <>
                  <Check size={16} />
                  <span>Submit Feedback</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
