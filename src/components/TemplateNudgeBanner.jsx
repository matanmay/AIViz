import React from 'react';
import { Lightbulb, Sparkles, X, ArrowRight } from 'lucide-react';

export default function TemplateNudgeBanner({
  teamName,
  consecutiveCount = 3,
  onOpenTemplates,
  onDismiss,
}) {
  return (
    <div className="template-nudge-banner" role="alert">
      <div className="template-nudge-glow" />
      <div className="template-nudge-content">
        <div className="template-nudge-icon-wrap">
          <Lightbulb size={18} className="template-nudge-icon" />
        </div>

        <div className="template-nudge-text-group">
          <div className="template-nudge-headline">
            <span className="nudge-tag">💡 Modeling Suggestion</span>
            <span className="nudge-streak-info">
              {consecutiveCount} prompts without templates
            </span>
          </div>
          <p className="template-nudge-body">
            Using structured prompt templates guides the AI to produce cleaner UML diagrams,
            extract precise lists, and evaluate design trade-offs.
          </p>
        </div>
      </div>

      <div className="template-nudge-actions">
        <button
          type="button"
          className="template-nudge-cta-btn"
          onClick={onOpenTemplates}
          title="Open prompt templates library"
        >
          <Sparkles size={14} />
          <span>Explore Templates</span>
          <ArrowRight size={13} />
        </button>

        <button
          type="button"
          className="template-nudge-dismiss-btn"
          onClick={onDismiss}
          title="Dismiss suggestion"
          aria-label="Dismiss suggestion"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
