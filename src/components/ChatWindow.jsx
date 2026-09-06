import React, { useRef, useEffect, useState, useCallback } from 'react';
import Message from './Message';
import MessageInput from './MessageInput';
import SubmitDiagramModal from './SubmitDiagramModal';
import FeedbackModal from './FeedbackModal';
import { Bot, Edit3, Check, X, Download, AlertCircle, ExternalLink } from 'lucide-react';

export default function ChatWindow({
  activeChat,
  messages,
  input,
  setInput,
  onSend,
  onRetry,
  onRenameChat,
  onExportChat,
  onCopy,
  onRate,
  onUpdateMessage,
  onClearChat,
  onSelectPrompt,
  isLoading,
  awaitingFeedback,
  onToggleSidebar,
  currentUser,
}) {
  const messagesEndRef = useRef(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [headerTitle, setHeaderTitle] = useState('');
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [feedbackTargetMessage, setFeedbackTargetMessage] = useState(null);
  const [submitWarning, setSubmitWarning] = useState(false);
  const [openSubmitAfterFeedback, setOpenSubmitAfterFeedback] = useState(false);
  const [showUsabilityBanner, setShowUsabilityBanner] = useState(false);

  // Stable callback — avoids re-rendering React.memo(Message) on every keystroke
  const handleOpenFeedback = useCallback((targetMsg) => setFeedbackTargetMessage(targetMsg), []);

  const handleSubmitDiagramClick = () => {
    if (awaitingFeedback) {
      setSubmitWarning(true);
      setTimeout(() => setSubmitWarning(false), 5000);
      setOpenSubmitAfterFeedback(true);
      const unratedMsg = [...messages].reverse().find((m) => m.role === 'assistant');
      if (unratedMsg) {
        handleOpenFeedback(unratedMsg);
      }
      return;
    }
    setIsSubmitModalOpen(true);
  };

  // Synchronize headerTitle when activeChat changes or title changes
  useEffect(() => {
    setHeaderTitle(activeChat?.title || 'New Session');
    setIsEditingTitle(false);
  }, [activeChat?.id, activeChat?.title]);

  const handleStartEditing = () => {
    setHeaderTitle(activeChat?.title || 'New Session');
    setIsEditingTitle(true);
  };

  const handleSaveTitle = () => {
    const trimmed = headerTitle.trim();
    if (trimmed && activeChat?.id && onRenameChat) {
      onRenameChat(activeChat.id, trimmed);
    }
    setIsEditingTitle(false);
  };

  const handleCancelEditing = () => {
    setHeaderTitle(activeChat?.title || 'New Session');
    setIsEditingTitle(false);
  };

  // Helper to safely escape CSV cells (RFC 4180)
  const escapeCsvCell = (val) => {
    if (val == null) return '""';
    const str = String(val);
    return `"${str.replace(/"/g, '""')}"`;
  };

  // Export current chat messages to CSV file
  const handleExportCsv = () => {
    if (!messages || messages.length === 0) {
      alert('There are no messages in this session to export.');
      return;
    }

    const headers = [
      'Session ID',
      'Session Title',
      'Message ID',
      'Timestamp',
      'Role',
      'Content',
      'Attachment',
      'Rating',
      'Feedback Notes',
      'is_plantuml_edited',
      'original_plantuml_code',
      'edited_plantuml_code',
    ];
    const rows = messages.map((msg) => [
      activeChat?.id || '',
      activeChat?.title || 'New Session',
      msg.id || '',
      msg.timestamp || '',
      msg.role || '',
      msg.content || '',
      msg.attachment
        ? `${msg.attachment.name || 'file'}${msg.attachment.url ? ` (${msg.attachment.url})` : ''}`
        : '',
      msg.userRating != null ? msg.userRating : '',
      msg.feedbackComment || '',
      msg.role === 'assistant' ? (msg.isPlantumlEdited ? 'true' : 'false') : '',
      msg.originalPlantumlCode || '',
      msg.editedPlantumlCode || '',
    ]);

    // Prepend UTF-8 BOM (\uFEFF) so Excel opens Hebrew and UTF-8 characters cleanly
    const csvContent =
      '\uFEFF' +
      [headers, ...rows]
        .map((row) => row.map(escapeCsvCell).join(','))
        .join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const sanitizedTitle = (activeChat?.title || 'session')
      .replace(/[\\/:*?"<>|]/g, '_')
      .replace(/\s+/g, '_')
      .trim();
    const dateStr = new Date().toISOString().slice(0, 10);
    link.setAttribute('href', url);
    link.setAttribute('download', `${sanitizedTitle || 'chat'}_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    if (onExportChat && activeChat?.id) {
      onExportChat(activeChat.id, messages.length);
    }
  };

  // Auto-scroll to bottom whenever messages change or loading state triggers
  const scrollToBottom = (behavior = 'smooth') => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior, block: 'end' });
    }
  };

  useEffect(() => {
    scrollToBottom('smooth');
  }, [messages, isLoading]);

  return (
    <div className="chat-window">
      {/* Top Header */}
      <header className="chat-header">
        <div className="header-left">
          <button
            className="mobile-menu-btn"
            onClick={onToggleSidebar}
            aria-label="Toggle sidebar menu"
          >
            <span className="hamburger-line"></span>
            <span className="hamburger-line"></span>
            <span className="hamburger-line"></span>
          </button>
          <div className="header-title-container">
            {isEditingTitle ? (
              <div className="header-title-edit-form">
                <input
                  type="text"
                  className="header-title-input"
                  value={headerTitle}
                  onChange={(e) => setHeaderTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveTitle();
                    if (e.key === 'Escape') handleCancelEditing();
                  }}
                  autoFocus
                  onFocus={(e) => e.target.select()}
                />
                <button
                  className="header-title-save-btn"
                  onClick={handleSaveTitle}
                  title="Save title (Enter)"
                >
                  <Check size={14} />
                </button>
                <button
                  className="header-title-cancel-btn"
                  onClick={handleCancelEditing}
                  title="Cancel (Esc)"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="header-title-display-group">
                <h2
                  className="header-chat-title"
                  title="Double click or click the edit icon to change session title"
                  onDoubleClick={handleStartEditing}
                >
                  {activeChat?.title || 'New Session'}
                </h2>
                <button
                  className="header-edit-title-btn"
                  onClick={handleStartEditing}
                  title="Edit session title"
                  aria-label="Edit session title"
                >
                  <Edit3 size={14} />
                </button>
              </div>
            )}
            <span className="header-study-pill">
              Session
            </span>
          </div>
        </div>

        <div className="header-right">
          <button
            className="export-chat-btn"
            onClick={handleExportCsv}
            disabled={messages.length === 0}
            title={messages.length === 0 ? 'No messages to export' : 'Export conversation to CSV'}
            aria-label="Export conversation to CSV"
          >
            <Download size={15} />
            <span>Export CSV</span>
          </button>
        </div>
      </header>

      {/* Usability Questionnaire Top Banner */}
      {showUsabilityBanner && (
        <div className="chat-usability-top-banner" role="alert">
          <div className="chat-usability-top-content">
            <span className="chat-usability-top-icon">📋</span>
            <div className="chat-usability-top-text">
              <span>Don't forget to fill out the individual usability questionnaire (one questionnaire per student) at:</span>{' '}
              <a
                href="https://forms.gle/BMu4wuELRLXaiVdW6"
                target="_blank"
                rel="noopener noreferrer"
                className="chat-usability-top-link"
              >
                <span>https://forms.gle/BMu4wuELRLXaiVdW6</span>
                <ExternalLink size={13} />
              </a>
            </div>
          </div>
          <button
            className="chat-usability-top-close"
            onClick={() => setShowUsabilityBanner(false)}
            title="Dismiss notice"
            aria-label="Dismiss notice"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Messages Scroll Area */}
      <main className="messages-scroll-area">
        {messages.length === 0 ? (
          <div className="empty-state">
            <div className="empty-hero">
              <div className="empty-bot-badge">
                <Bot size={36} />
              </div>
              <h1 className="empty-title">AI Assistant</h1>
              <p className="empty-subtitle">
                Welcome to the course LLM assistant. Start by typing your question below.
              </p>
            </div>
          </div>
        ) : (
          <div className="messages-list">
            {messages.map((msg, index) => (
              <Message
                key={msg.id || index}
                message={msg}
                isLast={index === messages.length - 1}
                onCopy={onCopy}
                onRate={onRate}
                onOpenFeedback={handleOpenFeedback}
                onUpdateMessage={onUpdateMessage}
                requiresFeedback={awaitingFeedback && index === messages.length - 1 && msg.role === 'assistant'}
                onRetry={
                  index === messages.length - 1 && (msg.role === 'assistant' || msg.role === 'error')
                    ? onRetry
                    : null
                }
              />
            ))}

            {/* Typing / Loading Skeleton */}
            {isLoading && (
              <div className="message-row assistant-row loading-row">
                <div className="message-container">
                  <div className="avatar assistant-avatar pulse-avatar">
                    <Bot size={18} />
                  </div>
                  <div className="message-bubble-wrapper">
                    <div className="message-header">
                      <span className="sender-name">AI Assistant</span>
                    </div>
                    <div className="message-bubble assistant-bubble loading-bubble">
                      <div className="typing-indicator">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} className="messages-end-anchor" />
          </div>
        )}
      </main>

      {/* Fixed Bottom Input Area */}
      <footer className="chat-footer">
        {submitWarning && (
          <div className="submit-diagram-rating-warning" role="alert">
            <AlertCircle size={16} />
            <span>Please rate the AI response before submitting the diagram.</span>
          </div>
        )}
        <MessageInput
          input={input}
          setInput={setInput}
          onSend={onSend}
          isLoading={isLoading}
          disabled={awaitingFeedback}
          awaitingFeedback={awaitingFeedback}
          placeholder={
            awaitingFeedback
              ? '⭐ Please rate the response above before continuing...'
              : 'Write your prompt... (Enter to send, Shift+Enter for new line)'
          }
          onSubmitDiagram={handleSubmitDiagramClick}
        />
      </footer>

      {/* Submit Diagram Modal */}
      <SubmitDiagramModal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        currentUser={currentUser}
        activeChat={activeChat}
        messages={messages}
        awaitingFeedback={awaitingFeedback}
        onSubmitted={() => setShowUsabilityBanner(true)}
      />

      {/* Response Feedback Modal */}
      <FeedbackModal
        isOpen={Boolean(feedbackTargetMessage)}
        onClose={() => {
          setFeedbackTargetMessage(null);
          setOpenSubmitAfterFeedback(false);
        }}
        onSuccess={() => {
          if (openSubmitAfterFeedback) {
            setOpenSubmitAfterFeedback(false);
            setIsSubmitModalOpen(true);
          }
        }}
        onSubmit={async ({ rating, comment, messageId, interactionId }) => {
          if (onRate) {
            await onRate({ rating, comment, messageId, interactionId });
          }
        }}
        targetMessage={feedbackTargetMessage}
        currentUser={currentUser}
        submitDiagramPending={openSubmitAfterFeedback}
      />
    </div>
  );
}
