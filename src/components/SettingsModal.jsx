import React, { useState, useEffect } from 'react';
import { X, Key, Database, Check, Eye, EyeOff, ShieldCheck, Sparkles, Globe, Cpu } from 'lucide-react';
import { getSupabaseCredentials } from '../services/supabase';
import { getApiKey, DEFAULT_EXPERIMENT_MODEL } from '../services/api';

export default function SettingsModal({ isOpen, onClose, onSave }) {
  const [apiKey, setApiKey] = useState('');
  const [apiEndpoint, setApiEndpoint] = useState('');
  const [experimentModel, setExperimentModel] = useState('');
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [showSbKey, setShowSbKey] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setApiKey(getApiKey());
      setApiEndpoint(localStorage.getItem('aiviz_api_endpoint') || process.env.REACT_APP_API_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai');
      setExperimentModel(localStorage.getItem('aiviz_experiment_model') || DEFAULT_EXPERIMENT_MODEL);
      const sb = getSupabaseCredentials();
      setSupabaseUrl(sb.supabaseUrl);
      setSupabaseAnonKey(sb.supabaseAnonKey);
      setSavedSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = (e) => {
    e.preventDefault();
    localStorage.setItem('aiviz_api_key', apiKey.trim());
    localStorage.setItem('aiviz_openai_api_key', apiKey.trim());
    localStorage.setItem('aiviz_api_endpoint', apiEndpoint.trim());
    localStorage.setItem('aiviz_experiment_model', experimentModel.trim());
    localStorage.setItem('aiviz_supabase_url', supabaseUrl.trim());
    localStorage.setItem('aiviz_supabase_anon_key', supabaseAnonKey.trim());

    setSavedSuccess(true);
    if (onSave) onSave();
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1200);
  };

  const handleClear = () => {
    localStorage.removeItem('aiviz_api_key');
    localStorage.removeItem('aiviz_openai_api_key');
    localStorage.removeItem('aiviz_api_endpoint');
    localStorage.removeItem('aiviz_experiment_model');
    localStorage.removeItem('aiviz_supabase_url');
    localStorage.removeItem('aiviz_supabase_anon_key');
    setApiKey('');
    setApiEndpoint('https://generativelanguage.googleapis.com/v1beta/openai');
    setExperimentModel('gemini-2.5-flash-lite');
    setSupabaseUrl('');
    setSupabaseAnonKey('');
    if (onSave) onSave();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <ShieldCheck size={22} className="modal-shield-icon" />
            <div>
              <h3 className="modal-title">Researcher Settings</h3>
              <p className="modal-subtitle">Configure Gemini / OpenAI API, Endpoint & Supabase Telemetry</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave} className="modal-form">
          {/* AI Model & Endpoint Section */}
          <div className="settings-group">
            <div className="group-label-row">
              <Key size={16} className="text-accent" />
              <label htmlFor="ai-api-key">Gemini / OpenAI API Key</label>
            </div>
            <div className="input-with-icon">
              <input
                id="ai-api-key"
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy... (Gemini) or sk-... (OpenAI)"
                className="settings-input"
              />
              <button
                type="button"
                className="eye-toggle-btn"
                onClick={() => setShowKey(!showKey)}
                aria-label="Toggle password visibility"
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <span className="input-hint">
              Supports Google AI Studio Gemini keys (starts with <code>AIzaSy</code>) via OpenAI-compatibility.
            </span>
          </div>

          <div className="settings-group">
            <div className="group-label-row">
              <Globe size={16} className="text-accent" />
              <label htmlFor="api-endpoint">OpenAI-Compatible Endpoint</label>
            </div>
            <input
              id="api-endpoint"
              type="text"
              value={apiEndpoint}
              onChange={(e) => setApiEndpoint(e.target.value)}
              placeholder="https://generativelanguage.googleapis.com/v1beta/openai"
              className="settings-input"
            />
          </div>

          <div className="settings-group">
            <div className="group-label-row">
              <Cpu size={16} className="text-accent" />
              <label htmlFor="exp-model">Hidden Study Model ID</label>
            </div>
            <input
              id="exp-model"
              type="text"
              value={experimentModel}
              onChange={(e) => setExperimentModel(e.target.value)}
              placeholder="gemini-2.5-flash-lite"
              className="settings-input"
            />
            <span className="input-hint">
              Concealed from students in the UI. Logged secretly to <code>experiment_logs</code>.
            </span>
          </div>

          {/* Supabase Section */}
          <div className="settings-group">
            <div className="group-label-row">
              <Database size={16} className="text-accent" />
              <label htmlFor="supabase-url">Supabase Project URL</label>
            </div>
            <input
              id="supabase-url"
              type="text"
              value={supabaseUrl}
              onChange={(e) => setSupabaseUrl(e.target.value)}
              placeholder="https://xyzcompany.supabase.co"
              className="settings-input"
            />

            <div className="group-label-row mt-3">
              <Key size={16} className="text-accent" />
              <label htmlFor="supabase-anon">Supabase Anon Key</label>
            </div>
            <div className="input-with-icon">
              <input
                id="supabase-anon"
                type={showSbKey ? 'text' : 'password'}
                value={supabaseAnonKey}
                onChange={(e) => setSupabaseAnonKey(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                className="settings-input"
              />
              <button
                type="button"
                className="eye-toggle-btn"
                onClick={() => setShowSbKey(!showSbKey)}
                aria-label="Toggle key visibility"
              >
                {showSbKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={handleClear}>
              Reset Defaults
            </button>
            <div className="actions-right">
              <button type="button" className="btn-ghost" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                {savedSuccess ? (
                  <>
                    <Check size={16} />
                    <span>Saved!</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    <span>Save Settings</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
