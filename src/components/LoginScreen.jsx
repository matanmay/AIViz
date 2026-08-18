import React, { useState } from 'react';
import { Bot, Lock, User, Eye, EyeOff, Loader2, AlertCircle, Sparkles, Shield, Sun, Moon } from 'lucide-react';
import { loginUser } from '../services/supabase';

export default function LoginScreen({ onLoginSuccess, theme, onToggleTheme }) {
  const [teamName, setTeamName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!teamName.trim() || !password) {
      setError('Please enter both group name and password.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const data = await loginUser(teamName, password);
      if (data && data.user) {
        onLoginSuccess(data.user);
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-screen-wrapper">
      {/* Top Bar for theme toggle */}
      <div className="login-top-bar">
        <button
          className="login-theme-btn"
          onClick={onToggleTheme}
          aria-label="Toggle theme"
          type="button"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>

      <div className="login-card-container">
        {/* Brand Header */}
        <div className="login-header">
          <div className="login-logo-glow">
            <Bot size={36} />
          </div>
          <h1 className="login-title">AIViz Workspace</h1>
          <p className="login-subtitle">
            Private AI Chat &amp; Analytics Interface
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="login-form">
          {error && (
            <div className="login-error-alert" role="alert">
              <AlertCircle size={18} className="error-icon" />
              <span>{error}</span>
            </div>
          )}

          <div className="login-input-group">
            <label htmlFor="login-team-name">Group Name</label>
            <div className="login-input-wrapper">
              <User size={18} className="input-leading-icon" />
              <input
                id="login-team-name"
                type="text"
                required
                placeholder="e.g. Group A"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                disabled={isLoading}
                autoComplete="username"
                className="login-input"
              />
            </div>
          </div>

          <div className="login-input-group">
            <label htmlFor="login-password">Password</label>
            <div className="login-input-wrapper">
              <Lock size={18} className="input-leading-icon" />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                autoComplete="current-password"
                className="login-input with-trailing"
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                aria-label="Toggle password visibility"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="login-submit-btn"
          >
            {isLoading ? (
              <>
                <Loader2 size={18} className="spinner" />
                <span>Verifying credentials...</span>
              </>
            ) : (
              <>
                <Sparkles size={18} />
                <span>Sign In</span>
              </>
            )}
          </button>
        </form>

        {/* Private Access Notice (No Register) */}
        <div className="login-security-notice">
          <Shield size={16} className="security-icon" />
          <span>
            Access is restricted to authorized groups. Contact your system administrator to request access.
          </span>
        </div>
      </div>
    </div>
  );
}
