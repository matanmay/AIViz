import React, { useRef, useEffect, useState } from 'react';
import { ArrowUp, Loader2 } from 'lucide-react';

export default function MessageInput({
  input,
  setInput,
  onSend,
  isLoading,
  placeholder = 'Write your prompt... (Enter to send, Shift+Enter for new line)',
  disabled = false,
}) {
  const textareaRef = useRef(null);
  const [typingStartTime, setTypingStartTime] = useState(null);

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

  const handleTriggerSend = () => {
    if (!isLoading && input.trim() && !disabled) {
      const draftingDurationMs = typingStartTime ? Date.now() - typingStartTime : 0;
      setTypingStartTime(null);
      onSend(draftingDurationMs);
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

  return (
    <form className="message-input-form" onSubmit={handleSubmit}>
      <div className="input-container">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          disabled={disabled || isLoading}
          className="chat-textarea"
          aria-label="Conceptual model input message"
        />

        <div className="input-actions-bar">
          <span className="char-count">
            {input.length > 0 && `${input.length} chars`}
          </span>

          <button
            type="submit"
            disabled={!input.trim() || isLoading || disabled}
            className={`send-button ${input.trim() && !isLoading ? 'active' : ''}`}
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
      <div className="input-disclaimer">
        All interactions are recorded for the research study.
      </div>
    </form>
  );
}
