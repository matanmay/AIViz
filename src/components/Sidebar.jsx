import React from 'react';
import {
  Plus,
  MessageSquare,
  Trash2,
  Moon,
  Sun,
  Database,
  X,
  Bot,
  LogOut,
  User,
} from 'lucide-react';
import { isSupabaseConfigured } from '../services/supabase';

export default function Sidebar({
  chats,
  activeChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  onClearAllChats,
  theme,
  onToggleTheme,
  isOpen,
  onClose,
  currentUser,
  onLogout,
}) {
  const isConnectedToSupabase = isSupabaseConfigured();

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && <div className="sidebar-backdrop" onClick={onClose} />}

      <aside className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}>
        {/* Top Header */}
        <div className="sidebar-header">
          <div className="brand-logo">
            <div className="logo-icon">
              <Bot size={20} />
            </div>
            <div className="brand-text">
              <span className="brand-title">AIViz Study</span>
              {/* <span className="brand-sub">Conceptual Modeling</span> */}
            </div>
          </div>
          <button className="sidebar-close-btn" onClick={onClose} aria-label="Close sidebar">
            <X size={18} />
          </button>
        </div>

        {/* Experiment Pill */}
        {/* <div className="experiment-study-card">
          <div className="study-badge-row">
            <FlaskConical size={14} className="study-icon" />
            <span className="study-title">HITL Research Session</span>
          </div>
          <span className="study-desc">Interaction Telemetry Active</span>
        </div> */}

        {/* New Session Button */}
        <div className="sidebar-action-section">
          <button className="new-chat-btn" onClick={onNewChat}>
            <Plus size={18} />
            <span>New Session</span>
          </button>
        </div>

        {/* Chat History Sessions List */}
        <div className="chat-history-section">
          <div className="history-label-row">
            <span className="history-label"> Sessions</span>
            {chats.length > 0 && (
              <span className="history-count">{chats.length}</span>
            )}
          </div>

          <div className="chat-sessions-list">
            {chats.length === 0 ? (
              <div className="empty-history">
                <MessageSquare size={20} className="empty-history-icon" />
                <p>No sessions yet</p>
              </div>
            ) : (
              chats.map((chat) => (
                <div
                  key={chat.id}
                  className={`chat-session-item ${activeChatId === chat.id ? 'active' : ''}`}
                  onClick={() => onSelectChat(chat.id)}
                >
                  <MessageSquare size={16} className="session-icon" />
                  <span className="session-title" title={chat.title}>
                    {chat.title || 'New Session'}
                  </span>
                  <button
                    className="delete-session-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteChat(chat.id);
                    }}
                    title="Delete session"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Supabase Status Indicator */}
        <div className="supabase-status-card">
          <div className="status-indicator-row">
            <div className="status-dot-wrapper">
              <span className={`status-dot ${isConnectedToSupabase ? 'connected' : 'local'}`} />
            </div>
            <div className="status-text-info">
              <span className="status-title">
                {isConnectedToSupabase ? 'Telemetry Connected' : 'Local Telemetry Cache'}
              </span>
              <span className="status-sub">
                {isConnectedToSupabase ? 'Logging events to DB' : 'Events saved locally'}
              </span>
            </div>
            <Database size={16} className="status-db-icon" />
          </div>
        </div>

        {/* User Profile Card */}
        {currentUser && (
          <div className="user-profile-section">
            <div className="user-profile-card">
              <div className="user-profile-avatar">
                <User size={16} />
              </div>
              <div className="user-profile-info">
                <span className="user-profile-email" title={currentUser.team_name || currentUser.email}>
                  {currentUser.team_name || currentUser.email || 'Participant'}
                </span>
                <span className="user-profile-role">Group Active</span>
              </div>
              <button
                className="user-logout-btn"
                onClick={onLogout}
                title="Log Out"
                aria-label="Log Out"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Sidebar Footer Controls */}
        <div className="sidebar-footer">
          {chats.length > 0 && (
            <button className="sidebar-footer-btn clear-all-btn" onClick={onClearAllChats}>
              <Trash2 size={16} />
              <span>Clear History</span>
            </button>
          )}

          <div className="footer-action-row">
            <button className="sidebar-footer-btn theme-toggle-btn" onClick={onToggleTheme}>
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
