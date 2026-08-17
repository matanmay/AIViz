import React, { useState } from 'react';
import { Bot, Lock, Mail, Eye, EyeOff, Loader2, AlertCircle, Sparkles, Shield, Sun, Moon } from 'lucide-react';
import { loginUser } from '../services/supabase';

export default function LoginScreen({ onLoginSuccess, theme, onToggleTheme }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const data = await loginUser(email, password);
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
            Private AI Chat & Analytics Interface
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
            <label htmlFor="login-email">Email Address</label>
            <div className="login-input-wrapper">
              <Mail size={18} className="input-leading-icon" />
              <input
                id="login-email"
                type="email"
                required
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                autoComplete="email"
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
            Access is restricted to authorized accounts in the database. Contact your system administrator to request access.
          </span>
        </div>

        {/* Quick Demo Credentials Helper */}
        {/* <div className="demo-credentials-box">
          <div className="demo-header">
            <span>Demo credentials (Preview mode):</span>
            <button
              type="button"
              className="fill-demo-btn"
              onClick={handleFillDemo}
            >
              Fill Demo
            </button>
          </div>
          <code>admin@aiviz.ai / admin123</code>
        </div> */}
      </div>
    </div>
  );
}
