import React, { useState, useEffect } from 'react';
import {
  X,
  Send,
  Check,
  AlertCircle,
  Loader2,
  Eye,
  Code,
  ZoomIn,
  ZoomOut,
  ExternalLink,
  ImageOff,
} from 'lucide-react';
import { submitDiagramToSupabase } from '../services/supabase';
import { trackChatEvent } from '../services/telemetry';
import { getKrokiUrl } from '../services/plantuml';

export const DIAGRAM_TYPES = [
  'Class Diagram',
  'Use Case Diagram',
  'Sequence Diagram',
  'Activity Diagram',
  'State Machine Diagram',
  'ERD (Entity Relationship Diagram)',
  'Component Diagram',
  'Deployment Diagram',
  'Domain Model',
  'Other',
];

// Helper to extract all PlantUML blocks from session messages
export function extractDiagramsFromMessages(messages = []) {
  const diagrams = [];
  const regex = /```(?:plantuml|puml)\s*([\s\S]*?)```/gi;

  messages.forEach((msg, msgIndex) => {
    if (!msg.content) return;
    let match;
    let countInMsg = 1;
    regex.lastIndex = 0;
    while ((match = regex.exec(msg.content)) !== null) {
      const code = match[1].trim();
      if (code) {
        let detectedType = 'Class Diagram';
        const lower = code.toLowerCase();
        if (lower.includes('actor') || lower.includes('usecase')) {
          detectedType = 'Use Case Diagram';
        } else if (lower.includes('participant') || lower.includes('->') || lower.includes('-->')) {
          if (!lower.includes('class ') && !lower.includes('interface ')) {
            detectedType = 'Sequence Diagram';
          }
        } else if (lower.includes('entity ') || lower.includes('erd')) {
          detectedType = 'ERD (Entity Relationship Diagram)';
        } else if (lower.includes('state ') || lower.includes('[*]')) {
          detectedType = 'State Machine Diagram';
        } else if (lower.includes('start') && lower.includes('stop')) {
          detectedType = 'Activity Diagram';
        } else if (lower.includes('component ') || lower.includes('package ')) {
          detectedType = 'Component Diagram';
        }

        diagrams.push({
          id: `diag-${msg.id || msgIndex}-${countInMsg}`,
          code,
          suggestedType: detectedType,
          label: `Diagram #${diagrams.length + 1} (${detectedType}) - ${msg.role === 'user' ? 'User' : 'Assistant'}`,
        });
        countInMsg++;
      }
    }
  });

  return diagrams;
}

export default function SubmitDiagramModal({
  isOpen,
  onClose,
  currentUser,
  activeChat,
  messages = [],
  initialCode = '',
  initialType = '',
}) {
  const [availableDiagrams, setAvailableDiagrams] = useState([]);
  const [selectedDiagramIndex, setSelectedDiagramIndex] = useState('custom');
  const [diagramType, setDiagramType] = useState('Class Diagram');
  const [plantumlCode, setPlantumlCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [submittedData, setSubmittedData] = useState(null);

  // View mode tab: 'split' | 'preview' | 'code'
  const [viewMode, setViewMode] = useState('split');

  // Preview state
  const [previewUrl, setPreviewUrl] = useState('');
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);

  // Debounced URL generator for PlantUML preview
  useEffect(() => {
    const trimmed = plantumlCode.trim();
    if (!trimmed) {
      setPreviewUrl('');
      setIsPreviewLoading(false);
      setPreviewError(false);
      return;
    }

    let isCancelled = false;
    setIsPreviewLoading(true);
    setPreviewError(false);

    const timer = setTimeout(async () => {
      try {
        const url = await getKrokiUrl(trimmed);
        if (!isCancelled) {
          if (url) {
            setPreviewUrl(url);
            setPreviewError(false);
          } else {
            setPreviewError(true);
          }
          setIsPreviewLoading(false);
        }
      } catch (err) {
        if (!isCancelled) {
          console.warn('Preview generation failed:', err);
          setPreviewError(true);
          setIsPreviewLoading(false);
        }
      }
    }, 350);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [plantumlCode]);

  // Initialize diagrams and selection when modal opens
  useEffect(() => {
    if (!isOpen) {
      setSubmittedData(null);
      setErrorMessage('');
      setZoomLevel(1);
      return;
    }

    const diags = extractDiagramsFromMessages(messages);
    setAvailableDiagrams(diags);

    if (initialCode) {
      setPlantumlCode(initialCode);
      setDiagramType(initialType || 'Class Diagram');
      setSelectedDiagramIndex('custom');
      setViewMode('split');
    } else if (diags.length > 0) {
      // Auto-select latest diagram
      const latest = diags[diags.length - 1];
      setPlantumlCode(latest.code);
      setDiagramType(latest.suggestedType || 'Class Diagram');
      setSelectedDiagramIndex(String(diags.length - 1));
      setViewMode('split');
    } else {
      setPlantumlCode('');
      setDiagramType('Class Diagram');
      setSelectedDiagramIndex('custom');
      setViewMode('code');
    }
  }, [isOpen, messages, initialCode, initialType]);

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

  const handleDiagramSelect = (e) => {
    const val = e.target.value;
    setSelectedDiagramIndex(val);
    setZoomLevel(1);

    if (val === 'custom') {
      return;
    }

    const idx = parseInt(val, 10);
    if (!isNaN(idx) && availableDiagrams[idx]) {
      const chosen = availableDiagrams[idx];
      setPlantumlCode(chosen.code);
      setDiagramType(chosen.suggestedType);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    const trimmedCode = plantumlCode.trim();
    if (!trimmedCode) {
      setErrorMessage('Please provide the PlantUML code to submit.');
      return;
    }

    const teamName = currentUser?.team_name || currentUser?.username;
    if (!teamName) {
      setErrorMessage('User session not found. Please log in again.');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await submitDiagramToSupabase({
        teamName,
        chatId: activeChat?.id || null,
        sessionTitle: activeChat?.title || null,
        diagramType,
        plantumlCode: trimmedCode,
      });

      // Track telemetry event
      trackChatEvent({
        eventType: 'diagram_submitted',
        chatId: activeChat?.id,
        details: {
          diagramType,
          submissionId: result?.id,
          codeLength: trimmedCode.length,
        },
        user: currentUser,
      });

      setSubmittedData(result);
    } catch (err) {
      console.error('Submission error:', err);
      setErrorMessage(err.message || 'Failed to submit diagram. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleZoomIn = () => setZoomLevel((z) => Math.min(z + 0.25, 3));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(z - 0.25, 0.5));
  const handleResetZoom = () => setZoomLevel(1);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="submit-diagram-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="submit-modal-title"
      >
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <div>
              <h3 id="submit-modal-title" className="modal-title">
                Submit Diagram
              </h3>
              <span className="modal-subtitle">
                Submit your final conceptual model diagram for evaluation
              </span>
            </div>
          </div>
          <button
            className="modal-close-btn"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        {submittedData ? (
          <div className="submit-success-view">
            <div className="submit-success-icon-wrap">
              <Check size={28} />
            </div>
            <h4 className="submit-success-title">Diagram Submitted Successfully!</h4>
            <p className="submit-success-desc">
              Your <strong>{submittedData.diagram_type}</strong> has been saved to the database.
            </p>

            {/* Submitted Diagram Preview in Success Screen */}
            {previewUrl && (
              <div className="submit-success-preview-card">
                <div className="submit-preview-header">
                  <span className="submit-preview-badge">Submitted Diagram Preview</span>
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="submit-preview-link"
                    title="Open full diagram in new tab"
                  >
                    <ExternalLink size={13} />
                    <span>Open Full Image</span>
                  </a>
                </div>
                <div className="submit-preview-canvas">
                  <img
                    src={previewUrl}
                    alt={submittedData.diagram_type}
                    className="submit-preview-img"
                  />
                </div>
              </div>
            )}

            <div className="submit-success-card">
              <div className="submit-summary-grid">
                <div className="submit-summary-row">
                  <span className="submit-summary-label">Group / Team:</span>
                  <span className="submit-summary-value">{submittedData.team_name}</span>
                </div>
                <div className="submit-summary-row">
                  <span className="submit-summary-label">Diagram Type:</span>
                  <span className="submit-summary-value">{submittedData.diagram_type}</span>
                </div>
                <div className="submit-summary-row">
                  <span className="submit-summary-label">Session:</span>
                  <span className="submit-summary-value">{submittedData.session_title || 'Active Session'}</span>
                </div>
                <div className="submit-summary-row">
                  <span className="submit-summary-label">Submitted At:</span>
                  <span className="submit-summary-value">
                    {new Date(submittedData.created_at).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            <div className="modal-footer submit-modal-footer">
              <button
                type="button"
                className="submit-diagram-action-btn"
                onClick={onClose}
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form className="submit-diagram-form" onSubmit={handleSubmit}>
            {errorMessage && (
              <div className="submit-error-banner">
                <AlertCircle size={16} />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Top Bar: Team Info & View Tabs */}
            <div className="submit-form-topbar">
              <div className="submit-team-badge">
                <span className="badge-label">Submitting for:</span>
                <span className="badge-team-name">
                  {currentUser?.team_name || currentUser?.username || 'Current Team'}
                </span>
              </div>

              {/* View Mode Toggle: Split | Preview | Code */}
              <div className="submit-view-tabs" role="tablist">
                <button
                  type="button"
                  className={`submit-tab-btn ${viewMode === 'split' ? 'active' : ''}`}
                  onClick={() => setViewMode('split')}
                  title="Split View: Code & Diagram Preview"
                >
                  <Eye size={13} />
                  <span>Split View</span>
                </button>
                <button
                  type="button"
                  className={`submit-tab-btn ${viewMode === 'preview' ? 'active' : ''}`}
                  onClick={() => setViewMode('preview')}
                  title="Diagram Image Preview"
                >
                  <Eye size={13} />
                  <span>Preview</span>
                </button>
                <button
                  type="button"
                  className={`submit-tab-btn ${viewMode === 'code' ? 'active' : ''}`}
                  onClick={() => setViewMode('code')}
                  title="PlantUML Code Editor"
                >
                  <Code size={13} />
                  <span>Code</span>
                </button>
              </div>
            </div>

            {/* Select Diagram from Session (if present) & Diagram Type */}
            <div className="submit-selectors-grid">
              {availableDiagrams.length > 0 && (
                <div className="submit-field-group">
                  <label className="submit-field-label" htmlFor="diagram-picker">
                    Select Diagram from Session
                  </label>
                  <select
                    id="diagram-picker"
                    className="form-select"
                    value={selectedDiagramIndex}
                    onChange={handleDiagramSelect}
                    disabled={isSubmitting}
                  >
                    {availableDiagrams.map((d, i) => (
                      <option key={d.id} value={String(i)}>
                        {d.label}
                      </option>
                    ))}
                    <option value="custom">✏️ Enter / Paste custom PlantUML code</option>
                  </select>
                </div>
              )}

              <div className="submit-field-group">
                <label className="submit-field-label" htmlFor="diagram-type">
                  Diagram Type <span className="required-star">*</span>
                </label>
                <select
                  id="diagram-type"
                  className="form-select"
                  value={diagramType}
                  onChange={(e) => setDiagramType(e.target.value)}
                  disabled={isSubmitting}
                  required
                >
                  {DIAGRAM_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Main Interactive Workspace Area */}
            <div className={`submit-workspace-container view-${viewMode}`}>
              {/* Code Editor Panel */}
              {(viewMode === 'code' || viewMode === 'split') && (
                <div className="submit-code-panel">
                  <div className="panel-header">
                    <span className="panel-title">
                      <Code size={14} />
                      PlantUML Code <span className="required-star">*</span>
                    </span>
                    <span className="code-length-info">
                      {plantumlCode.split('\n').length} lines · {plantumlCode.length} chars
                    </span>
                  </div>
                  <textarea
                    id="plantuml-code"
                    className="plantuml-code-input"
                    rows={viewMode === 'split' ? 12 : 14}
                    value={plantumlCode}
                    onChange={(e) => {
                      setPlantumlCode(e.target.value);
                      setSelectedDiagramIndex('custom');
                    }}
                    placeholder={`@startuml\nclass User {\n  +id: UUID\n  +name: String\n}\n@enduml`}
                    disabled={isSubmitting}
                    required
                    spellCheck={false}
                  />
                </div>
              )}

              {/* Diagram Live Image Preview Panel */}
              {(viewMode === 'preview' || viewMode === 'split') && (
                <div className="submit-preview-panel">
                  <div className="panel-header">
                    <span className="panel-title">
                      <Eye size={14} />
                      Diagram Preview
                    </span>
                    {previewUrl && !isPreviewLoading && !previewError && (
                      <div className="preview-zoom-controls">
                        <button
                          type="button"
                          className="zoom-btn"
                          onClick={handleZoomOut}
                          title="Zoom out"
                          disabled={zoomLevel <= 0.5}
                        >
                          <ZoomOut size={13} />
                        </button>
                        <span className="zoom-text" onClick={handleResetZoom} title="Reset zoom">
                          {Math.round(zoomLevel * 100)}%
                        </span>
                        <button
                          type="button"
                          className="zoom-btn"
                          onClick={handleZoomIn}
                          title="Zoom in"
                          disabled={zoomLevel >= 3}
                        >
                          <ZoomIn size={13} />
                        </button>
                        <a
                          href={previewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="zoom-btn external-link-btn"
                          title="Open full diagram in new tab"
                        >
                          <ExternalLink size={13} />
                        </a>
                      </div>
                    )}
                  </div>

                  <div className="submit-preview-body">
                    {isPreviewLoading ? (
                      <div className="preview-loading-state">
                        <Loader2 size={24} className="spin" />
                        <span>Rendering diagram image...</span>
                      </div>
                    ) : previewError ? (
                      <div className="preview-error-state">
                        <ImageOff size={28} />
                        <span>Could not render diagram preview.</span>
                        <small>Ensure PlantUML syntax is valid.</small>
                      </div>
                    ) : previewUrl ? (
                      <div className="preview-image-scroll-wrapper">
                        <img
                          src={previewUrl}
                          alt="Diagram Preview"
                          className="submit-preview-img"
                          style={{
                            transform: `scale(${zoomLevel})`,
                            transformOrigin: 'top center',
                          }}
                        />
                      </div>
                    ) : (
                      <div className="preview-empty-state">
                        <Eye size={28} />
                        <span>Enter or select PlantUML code to preview the diagram.</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions with Material Design Cancel Button */}
            <div className="modal-footer submit-modal-footer">
              <button
                type="button"
                className="material-cancel-btn"
                onClick={onClose}
                disabled={isSubmitting}
                aria-label="Cancel diagram submission"
              >
                Cancel
              </button>

              <button
                type="submit"
                className="submit-diagram-action-btn"
                disabled={isSubmitting || !plantumlCode.trim()}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <Send size={15} />
                    <span>Submit Diagram</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
