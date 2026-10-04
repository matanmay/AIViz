import React, { useRef, useEffect, useState } from 'react';
import { ArrowUp, Loader2, X, Image as ImageIcon, Send, Sparkles, AlertCircle } from 'lucide-react';

export default function MessageInput({
  input,
  setInput,
  onSend,
  isLoading,
  placeholder = 'Write your prompt... (Enter to send, Shift+Enter for new line)',
  disabled = false,
  awaitingFeedback = false,
  onSubmitDiagram,
  onOpenTemplates,
  userImageCount = 0,
  maxImages = 3,
}) {
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const errorTimeoutRef = useRef(null);
  const [typingStartTime, setTypingStartTime] = useState(null);
  const [attachment, setAttachment] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const isQuotaExceeded = userImageCount >= maxImages;
  const MAX_IMAGE_SIZE_BYTES = 3 * 1024 * 1024; // 3MB

  // Auto-clear error after 6 seconds
  const showError = (msg) => {
    setErrorMessage(msg);
    if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
    errorTimeoutRef.current = setTimeout(() => {
      setErrorMessage(null);
    }, 6000);
  };

  useEffect(() => {
    return () => {
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
    };
  }, []);

  // Auto-resize textarea to fit content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, 180)}px`;
    }
  }, [input]);

  const handleInputChange = (e) => {
    if (!typingStartTime && e.target.value.length > 0) {
      setTypingStartTime(Date.now());
    } else if (e.target.value.length === 0) {
      setTypingStartTime(null);
    }
    setInput(e.target.value);
  };

  // Validate and process file into attachment state with dataUrl
  const processFile = (file) => {
    if (!file) return;

    // 1. Enforce user total image limit (max 3 images total per user)
    if (isQuotaExceeded) {
      showError(`You have reached the maximum limit of ${maxImages} images per user. No more images can be uploaded.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // 2. Enforce 1 image at a time
    if (attachment) {
      showError('You can only upload one image at a time.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // 3. Enforce only image files
    const isImage = file.type
      ? file.type.startsWith('image/')
      : /\.(png|jpe?g|webp|svg|gif|bmp)$/i.test(file.name || '');

    if (!isImage) {
      showError('Only image files are allowed (PNG, JPG, WebP, SVG, etc.).');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // 4. Enforce maximum file size of 3MB
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      showError(`Image size (${sizeMB}MB) exceeds the 3MB limit. Please choose a smaller image.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Clear any previous error
    setErrorMessage(null);

    // Read as Data URL for preview and multimodal AI payload
    const reader = new FileReader();
    reader.onload = (e) => {
      setAttachment({
        file,
        name: file.name,
        type: file.type || 'image/png',
        size: file.size,
        dataUrl: e.target?.result,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (files.length > 1 || attachment) {
      showError('You can only upload one image at a time.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    processFile(files[0]);
  };

  // Support pasting images from clipboard (e.g. screenshots)
  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const fileItems = Array.from(items).filter((item) => item.kind === 'file');
    if (fileItems.length > 1 || (attachment && fileItems.length > 0)) {
      showError('You can only upload one image at a time.');
      return;
    }

    if (fileItems.length === 1) {
      const item = fileItems[0];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          processFile(file);
        }
      } else {
        showError('Only image files up to 3MB are allowed.');
      }
    }
  };

  // Drag and drop image onto input
  const handleDrop = (e) => {
    e.preventDefault();
    if (disabled || isLoading) return;
    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;

    if (files.length > 1 || attachment) {
      showError('You can only upload one image at a time.');
      return;
    }

    processFile(files[0]);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleAttachClick = () => {
    if (isQuotaExceeded) {
      showError(`You have reached the maximum limit of ${maxImages} images per user.`);
      return;
    }
    if (attachment) {
      showError('You can only upload one image at a time.');
      return;
    }
    fileInputRef.current?.click();
  };

  const handleRemoveAttachment = () => {
    setAttachment(null);
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleTriggerSend = () => {
    const hasText = Boolean(input.trim());
    const hasAttachment = Boolean(attachment);

    if (!isLoading && (hasText || hasAttachment) && !disabled) {
      const draftingDurationMs = typingStartTime ? Date.now() - typingStartTime : 0;
      setTypingStartTime(null);
      const currentAttachment = attachment;
      setAttachment(null);
      setErrorMessage(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      onSend(draftingDurationMs, currentAttachment);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleTriggerSend();
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleTriggerSend();
  };

  const canSend = (input.trim() || attachment) && !isLoading && !disabled;

  return (
    <form className="message-input-form" onSubmit={handleSubmit}>
      <div className="input-row-wrapper">
        <div
          className="input-container"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*,.png,.jpg,.jpeg,.webp,.svg,.gif,.bmp"
            multiple
            style={{ display: 'none' }}
          />

          {/* Validation Error Banner */}
          {errorMessage && (
            <div className="message-input-error-banner" role="alert">
              <div className="error-banner-content">
                <AlertCircle size={15} className="error-banner-icon" />
                <span className="error-banner-text">{errorMessage}</span>
              </div>
              <button
                type="button"
                className="error-banner-close"
                onClick={() => setErrorMessage(null)}
                title="Dismiss"
                aria-label="Dismiss error message"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Attachment Preview Bar */}
          {attachment && (
            <div className="attachment-preview-container">
              <div className="attachment-thumb-group">
                <img
                  src={attachment.dataUrl}
                  alt={attachment.name}
                  className="attachment-thumbnail"
                />
                <div className="attachment-meta">
                  <span className="attachment-name" title={attachment.name}>
                    {attachment.name}
                  </span>
                  <span className="attachment-size">
                    {(attachment.size / 1024).toFixed(1)} KB
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="remove-attachment-btn"
                onClick={handleRemoveAttachment}
                title="Remove attachment"
                aria-label="Remove attachment"
              >
                <X size={14} />
              </button>
            </div>
          )}

          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={attachment ? 'Add a message or press Enter to send...' : placeholder}
            rows={1}
            disabled={disabled || isLoading}
            className="chat-textarea"
            aria-label="Conceptual model input message"
          />

          <div className="input-actions-bar">
            <div className="input-left-actions">
              <button
                type="button"
                className={`attach-file-btn ${attachment ? 'active' : ''} ${isQuotaExceeded ? 'quota-blocked' : ''}`}
                onClick={handleAttachClick}
                disabled={disabled || isLoading}
                title={
                  isQuotaExceeded
                    ? `You have reached the maximum limit of ${maxImages} images per user`
                    : `Attach image (${userImageCount}/${maxImages} used - up to 3MB, 1 image per message)`
                }
                aria-label="Attach image"
              >
                <ImageIcon size={18} />
              </button>

              {onOpenTemplates && (
                <button
                  type="button"
                  className="template-picker-btn"
                  onClick={onOpenTemplates}
                  disabled={disabled || isLoading}
                  title="Choose and execute a prompt template"
                  aria-label="Prompt Templates"
                >
                  <Sparkles size={15} />
                  <span>Templates</span>
                </button>
              )}

              <span className="char-count">
                {input.length > 0 && `${input.length} chars`}
              </span>
            </div>

            <button
              type="submit"
              disabled={!canSend}
              className={`send-button ${canSend ? 'active' : ''}`}
              aria-label="Send message"
              title={isLoading ? 'Generating response...' : 'Send message (Enter)'}
            >
              {isLoading ? (
                <Loader2 size={18} className="spinner" />
              ) : (
                <ArrowUp size={18} />
              )}
            </button>
          </div>
        </div>

        {onSubmitDiagram && (
          <button
            type="button"
            className={`submit-diagram-prompt-btn ${awaitingFeedback ? 'feedback-blocked' : ''}`}
            onClick={onSubmitDiagram}
            title={awaitingFeedback ? 'Please rate the AI response before submitting the diagram' : 'Submit diagram solution for evaluation'}
            aria-label="Submit diagram"
          >
            <Send size={15} />
            <span>Submit Diagram</span>
          </button>
        )}
      </div>

      <div className="input-disclaimer">
        All interactions and uploaded models are recorded for the research study.
      </div>
    </form>
  );
}
