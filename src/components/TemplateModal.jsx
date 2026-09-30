import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  Sparkles,
  Send,
  CornerDownLeft,
  Copy,
  Check,
  RotateCcw,
  BookOpen,
  Layers,
  HelpCircle,
  Eye,
  AlertCircle,
} from 'lucide-react';
import { TEMPLATES, fillTemplate } from '../templates';

// Pre-configured example values matching each template's official example
const TEMPLATE_EXAMPLE_VALUES = {
  'create-model': {
    model: 'class diagram',
    format: 'PlantUML',
    desc: "A University is interested in an information system that will assist in managing books. Each book has a title and one or more authors (e.g., Don Quixote, Miguel de Cervantes). In addition to the authors' names, their date of birth and death (if they are deceased) are also stored.",
  },
  'update-model': {
    model: 'class diagram',
    format: '',
    conc: 'the previous suggestion do not support multiple authors writing a single book.',
  },
  'create-list': {
    elements: 'classes',
    format: '',
    desc: "A University is interested in an information system that will assist in managing books. Each book has a title and one or more authors (e.g., Don Quixote, Miguel de Cervantes). In addition to the authors' names, their date of birth and death (if they are deceased) are also stored.",
  },
  'update-list': {
    elements: 'classes',
    format: 'a table with 3 columns – class name, attributes, operations',
    conc: 'the previous suggestion does not support multiple authors writing a single book.',
  },
  'generate-model': {
    model: 'class diagram',
    source: 'the list of classes generated in the previous prompt',
    format: 'PlantUML',
  },
  'present': {
    format: 'XMI',
  },
  'explain': {
    phenomenon: 'an author is a class',
    format: 'a list of arguments to support the suggestion',
  },
  'discuss': {
    setting: 'a university library',
    metric: 'correctness',
    format: '',
    variants: 'representing an author as a separate class vs. representing it as an attribute of a book',
  },
  'contextualize': {
    customPrompt:
      'You are an expert software engineer and conceptual modeling assistant helping me design a domain model for a university book management system.',
  },
};

// Helpful field descriptions and quick suggestion pills
const FIELD_CONFIG = {
  model: {
    label: 'Model Type (<model>)',
    placeholder: 'e.g. class diagram, use case diagram',
    multiline: false,
    suggestions: ['class diagram', 'use case diagram', 'ERD diagram', 'state machine'],
  },
  format: {
    label: 'Response Format (<format>)',
    placeholder: 'e.g. PlantUML, XMI, table',
    multiline: false,
    suggestions: ['PlantUML', 'XMI', 'Markdown table', 'list of arguments'],
  },
  desc: {
    label: 'Description (<desc>)',
    placeholder: 'Enter system requirements or description...',
    multiline: true,
  },
  elements: {
    label: 'Elements (<elements>)',
    placeholder: 'e.g. classes, attributes, relations',
    multiline: false,
    suggestions: ['classes', 'entities', 'attributes', 'operations'],
  },
  conc: {
    label: 'Concern / Revision (<conc>)',
    placeholder: 'Explain the issue or requirement to address...',
    multiline: true,
  },
  source: {
    label: 'Source (<source>)',
    placeholder: 'e.g. the list of classes generated in the previous prompt',
    multiline: false,
    suggestions: [
      'the list of classes generated in the previous prompt',
      'the previous model',
      'the requirements description',
    ],
  },
  phenomenon: {
    label: 'Phenomenon to Explain (<phenomenon>)',
    placeholder: 'e.g. why an author is a class',
    multiline: false,
  },
  setting: {
    label: 'Setting / Context (<setting>)',
    placeholder: 'e.g. a university library system',
    multiline: false,
  },
  metric: {
    label: 'Metric (<metric>)',
    placeholder: 'e.g. correctness, completeness',
    multiline: false,
    suggestions: ['correctness', 'completeness', 'comprehensibility', 'maintainability'],
  },
  variants: {
    label: 'Options / Variants (<variants>)',
    placeholder: 'e.g. option A vs. option B...',
    multiline: true,
  },
};

// Category badges for UI
const CATEGORY_MAP = {
  'create-model': 'Creation',
  'update-model': 'Revision',
  'create-list': 'Extraction',
  'update-list': 'Revision',
  'generate-model': 'Synthesis',
  'present': 'Formatting',
  'explain': 'Reasoning',
  'discuss': 'Trade-off',
  'contextualize': 'Context',
};

export default function TemplateModal({
  isOpen,
  onClose,
  onInsertPrompt,
  onExecutePrompt,
  isLoading = false,
  disabled = false,
  awaitingFeedback = false,
}) {
  const [selectedTemplateId, setSelectedTemplateId] = useState(TEMPLATES[0]?.id || 'create-model');
  const [formValues, setFormValues] = useState({});
  const [contextPrompt, setContextPrompt] = useState('');
  const [copied, setCopied] = useState(false);
  const [validationError, setValidationError] = useState('');
  const modalRef = useRef(null);

  const selectedTemplate = useMemo(
    () => TEMPLATES.find((t) => t.id === selectedTemplateId) || TEMPLATES[0],
    [selectedTemplateId]
  );

  // Reset form when template changes
  useEffect(() => {
    if (selectedTemplate) {
      setFormValues({});
      setValidationError('');
      setCopied(false);
      if (selectedTemplate.id === 'contextualize') {
        setContextPrompt(TEMPLATE_EXAMPLE_VALUES.contextualize?.customPrompt || '');
      }
    }
  }, [selectedTemplateId, selectedTemplate]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Compute live preview string
  const previewText = useMemo(() => {
    if (!selectedTemplate) return '';
    if (selectedTemplate.id === 'contextualize') {
      return contextPrompt.trim();
    }
    if (!selectedTemplate.structure) return '';

    try {
      // Build a values object where empty strings don't trigger required check for partial preview
      return fillTemplate(selectedTemplate, formValues);
    } catch {
      // If required fields are missing, build a preview with placeholders visible
      let preview = selectedTemplate.structure;
      // Replace optional segments
      preview = preview.replace(/\[([^\]]*)\]/g, (_m, content) => {
        const tokenMatch = content.match(/<([^>]+)>/);
        if (tokenMatch) {
          const val = formValues[tokenMatch[1]];
          if (val && String(val).trim()) {
            return content.replace(/<([^>]+)>/g, (_m2, k) => formValues[k] || `<${k}>`);
          }
          return ''; // omit if empty
        }
        return content;
      });

      // Replace known values
      Object.entries(formValues).forEach(([k, v]) => {
        if (v && String(v).trim()) {
          preview = preview.replace(new RegExp(`<${k}>`, 'g'), v);
        }
      });

      return preview.replace(/\s+([.,;:!?])/g, '$1').replace(/[ \t]{2,}/g, ' ').trim();
    }
  }, [selectedTemplate, formValues, contextPrompt]);

  if (!isOpen) return null;

  const handleFieldChange = (key, val) => {
    setFormValues((prev) => ({ ...prev, [key]: val }));
    setValidationError('');
  };

  const handleLoadExample = () => {
    const exampleVals = TEMPLATE_EXAMPLE_VALUES[selectedTemplate.id];
    if (exampleVals) {
      if (selectedTemplate.id === 'contextualize') {
        setContextPrompt(exampleVals.customPrompt || '');
      } else {
        setFormValues(exampleVals);
      }
      setValidationError('');
    }
  };

  const handleReset = () => {
    setFormValues({});
    if (selectedTemplate.id === 'contextualize') {
      setContextPrompt('');
    }
    setValidationError('');
  };

  const handleCopyPreview = () => {
    if (!previewText) return;
    navigator.clipboard.writeText(previewText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const validateAndBuildPrompt = () => {
    if (selectedTemplate.id === 'contextualize') {
      const trimmed = contextPrompt.trim();
      if (!trimmed) {
        setValidationError('Please enter a context prompt.');
        return null;
      }
      return trimmed;
    }

    try {
      const generated = fillTemplate(selectedTemplate, formValues);
      setValidationError('');
      return generated;
    } catch (err) {
      setValidationError(err.message || 'Please fill in all required placeholders.');
      return null;
    }
  };

  const handleInsertClick = () => {
    const prompt = validateAndBuildPrompt();
    if (prompt && onInsertPrompt) {
      onInsertPrompt(prompt);
      onClose();
    }
  };

  const handleExecuteClick = () => {
    const prompt = validateAndBuildPrompt();
    if (prompt && onExecutePrompt) {
      onExecutePrompt(prompt);
      onClose();
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        ref={modalRef}
        className="template-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="template-modal-header">
          <div className="template-modal-title-group">
            <div className="template-modal-icon-badge">
              <Sparkles size={20} />
            </div>
            <div>
              <h3 id="template-modal-title" className="template-modal-title">
                Prompt Templates
              </h3>
              <p className="template-modal-subtitle">
                Select an LLM prompt template for conceptual modeling, fill parameters, and execute or insert into chat
              </p>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close template dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body: Left Sidebar + Right Editor */}
        <div className="template-modal-body">
          {/* Template Selector Sidebar */}
          <aside className="template-list-sidebar" aria-label="Available templates">
            <div className="template-sidebar-header">
              <Layers size={14} />
              <span>Modeling Templates ({TEMPLATES.length})</span>
            </div>
            <div className="template-cards-scroll">
              {TEMPLATES.map((tmpl) => {
                const isSelected = tmpl.id === selectedTemplateId;
                const category = CATEGORY_MAP[tmpl.id] || 'General';
                return (
                  <button
                    key={tmpl.id}
                    type="button"
                    className={`template-list-item ${isSelected ? 'active' : ''}`}
                    onClick={() => setSelectedTemplateId(tmpl.id)}
                    aria-pressed={isSelected}
                  >
                    <div className="template-item-top">
                      <span className="template-item-name">{tmpl.name}</span>
                      <span className="template-item-badge">{category}</span>
                    </div>
                    <p className="template-item-desc">{tmpl.description}</p>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Right Editor Area */}
          <main className="template-editor-panel">
            {/* Template Header Info */}
            <div className="template-details-card">
              <div className="template-details-header">
                <div>
                  <h4 className="template-active-name">{selectedTemplate.name}</h4>
                  <p className="template-active-desc">{selectedTemplate.description}</p>
                </div>
                <div className="template-quick-actions">
                  <button
                    type="button"
                    className="template-load-example-btn"
                    onClick={handleLoadExample}
                    title="Load pre-configured example values"
                  >
                    <BookOpen size={14} />
                    <span>Load Example</span>
                  </button>
                  <button
                    type="button"
                    className="template-reset-btn"
                    onClick={handleReset}
                    title="Clear all fields"
                  >
                    <RotateCcw size={14} />
                    <span>Clear</span>
                  </button>
                </div>
              </div>

              {selectedTemplate.purpose && (
                <div className="template-purpose-row">
                  <span className="purpose-tag">Purpose:</span>
                  <span className="purpose-text">{selectedTemplate.purpose}</span>
                </div>
              )}

              {selectedTemplate.notes && (
                <div className="template-notes-callout">
                  <HelpCircle size={14} />
                  <span>{selectedTemplate.notes}</span>
                </div>
              )}
            </div>

            {/* Validation Error Banner */}
            {validationError && (
              <div className="template-error-banner" role="alert">
                <AlertCircle size={15} />
                <span>{validationError}</span>
              </div>
            )}

            {/* Form Fields Section */}
            <div className="template-form-section">
              {selectedTemplate.id === 'contextualize' ? (
                <div className="template-field-group">
                  <label className="template-field-label" htmlFor="field-context">
                    Context Prompt Message <span className="req-star">*</span>
                  </label>
                  <textarea
                    id="field-context"
                    className="template-textarea"
                    rows={4}
                    value={contextPrompt}
                    onChange={(e) => {
                      setContextPrompt(e.target.value);
                      setValidationError('');
                    }}
                    placeholder="Enter your system or interaction context prompt..."
                  />
                </div>
              ) : selectedTemplate.placeholders && selectedTemplate.placeholders.length > 0 ? (
                <div className="template-fields-grid">
                  {selectedTemplate.placeholders.map((ph) => {
                    const cfg = FIELD_CONFIG[ph.key] || {
                      label: `<${ph.key}>`,
                      placeholder: `Enter ${ph.key}...`,
                      multiline: false,
                    };
                    const value = formValues[ph.key] || '';

                    return (
                      <div key={ph.key} className="template-field-group">
                        <div className="field-label-row">
                          <label className="template-field-label" htmlFor={`field-${ph.key}`}>
                            {cfg.label}
                            {ph.required ? (
                              <span className="badge-required">Required</span>
                            ) : (
                              <span className="badge-optional">Optional</span>
                            )}
                          </label>

                          {/* Quick suggestion pills if available */}
                          {cfg.suggestions && (
                            <div className="field-suggestion-pills">
                              {cfg.suggestions.map((sug) => (
                                <button
                                  key={sug}
                                  type="button"
                                  className="suggestion-pill"
                                  onClick={() => handleFieldChange(ph.key, sug)}
                                  title={`Click to fill with "${sug}"`}
                                >
                                  {sug}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {cfg.multiline ? (
                          <textarea
                            id={`field-${ph.key}`}
                            className="template-textarea"
                            rows={3}
                            value={value}
                            onChange={(e) => handleFieldChange(ph.key, e.target.value)}
                            placeholder={cfg.placeholder}
                          />
                        ) : (
                          <input
                            id={`field-${ph.key}`}
                            type="text"
                            className="template-input"
                            value={value}
                            onChange={(e) => handleFieldChange(ph.key, e.target.value)}
                            placeholder={cfg.placeholder}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="template-empty-fields-note">
                  This template does not require any additional parameters.
                </div>
              )}
            </div>

            {/* Live Preview Box */}
            <div className="template-preview-card">
              <div className="preview-card-header">
                <div className="preview-title-group">
                  <Eye size={14} />
                  <span>Prompt Preview</span>
                </div>
                {previewText && (
                  <button
                    type="button"
                    className="preview-copy-btn"
                    onClick={handleCopyPreview}
                    title="Copy preview to clipboard"
                  >
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                )}
              </div>
              <div className="preview-text-box">
                {previewText ? (
                  <p className="preview-content">{previewText}</p>
                ) : (
                  <span className="preview-placeholder">
                    Fill the parameters above to see the generated prompt preview...
                  </span>
                )}
              </div>
            </div>
          </main>
        </div>

        {/* Modal Footer Actions */}
        <div className="template-modal-footer">
          <div className="footer-left-status">
            {awaitingFeedback && (
              <span className="footer-feedback-warning">
                <AlertCircle size={14} />
                Rating required for previous response before executing
              </span>
            )}
          </div>

          <div className="footer-right-buttons">
            <button
              type="button"
              className="template-cancel-btn"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </button>

            <button
              type="button"
              className="template-insert-btn"
              onClick={handleInsertClick}
              disabled={isLoading || !previewText}
              title="Insert prompt into chatbox for review or editing"
            >
              <CornerDownLeft size={16} />
              <span>Insert into Input</span>
            </button>

            <button
              type="button"
              className="template-execute-btn"
              onClick={handleExecuteClick}
              disabled={isLoading || disabled || awaitingFeedback || !previewText}
              title={
                awaitingFeedback
                  ? 'Please rate the AI response before sending new prompts'
                  : 'Send and execute prompt immediately in the chat'
              }
            >
              <Send size={16} />
              <span>Execute Prompt</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
