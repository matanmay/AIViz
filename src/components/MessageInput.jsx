import React, { useRef, useEffect, useState } from 'react';
import { ArrowUp, Loader2, Paperclip, X, Image as ImageIcon, Send } from 'lucide-react';

export default function MessageInput({
  input,
  setInput,
  onSend,
  isLoading,
  placeholder = 'Write your prompt... (Enter to send, Shift+Enter for new line)',
  disabled = false,
  onSubmitDiagram,
}) {
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const [typingStartTime, setTypingStartTime] = useState(null);
  const [attachment, setAttachment] = useState(null);

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

  // Process file into attachment state with dataUrl
  const processFile = (file) => {
    if (!file) return;

    // Read as Data URL for preview and multimodal AI payload
    const reader = new FileReader();
    reader.onload = (e) => {
      setAttachment({
        file,
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        dataUrl: e.target?.result,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  // Support pasting images from clipboard (e.g. screenshots)
  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile();
        if (file) {
          processFile(file);
          break;
        }
      }
    }
  };

  const handleRemoveAttachment = () => {
    setAttachment(null);
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
        <div className="input-container">
          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*,.png,.jpg,.jpeg,.webp,.svg,.gif,.pdf,.txt,.json,.uml,.puml"
            style={{ display: 'none' }}
          />

          {/* Attachment Preview Bar */}
          {attachment && (
            <div className="attachment-preview-container">
              {attachment.type?.startsWith('image/') || attachment.dataUrl?.startsWith('data:image/') ? (
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
              ) : (
                <div className="attachment-thumb-group">
                  <div className="attachment-file-icon">
                    <Paperclip size={16} />
                  </div>
                  <div className="attachment-meta">
                    <span className="attachment-name" title={attachment.name}>
                      {attachment.name}
                    </span>
                    <span className="attachment-size">
                      {(attachment.size / 1024).toFixed(1)} KB
                    </span>
                  </div>
                </div>
              )}
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
                className={`attach-file-btn ${attachment ? 'active' : ''}`}
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || isLoading}
                title="Attach image or file (or paste from clipboard)"
                aria-label="Attach image or file"
              >
                <ImageIcon size={18} />
              </button>
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
            className="submit-diagram-prompt-btn"
            onClick={onSubmitDiagram}
            title="Submit diagram solution for evaluation"
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
