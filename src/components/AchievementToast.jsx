import React, { useEffect } from 'react';
import { X, Sparkles } from 'lucide-react';

export default function AchievementToast({ achievement, onClose }) {
  useEffect(() => {
    if (!achievement) return;
    const timer = setTimeout(() => {
      onClose();
    }, 5000);
    return () => clearTimeout(timer);
  }, [achievement, onClose]);

  if (!achievement) return null;

  return (
    <div className="achievement-toast-container" role="status" aria-live="polite">
      <div className="achievement-toast-card">
        <div className="achievement-toast-icon-wrap">
          <span className="achievement-emoji-icon">{achievement.icon || '🏆'}</span>
          <span className="achievement-sparkle-mini">
            <Sparkles size={12} />
          </span>
        </div>

        <div className="achievement-toast-content">
          <div className="achievement-toast-badge-row">
            <span className="achievement-badge-pill">New Achievement!</span>
            <span className="achievement-badge-pill-he">הישג חדש!</span>
          </div>
          <h4 className="achievement-toast-title">
            {achievement.name}
            {achievement.nameHe && <span className="achievement-title-he"> ({achievement.nameHe})</span>}
          </h4>
          <p className="achievement-toast-desc">
            {achievement.descriptionHe || achievement.description}
          </p>
        </div>

        <button
          type="button"
          className="achievement-toast-close"
          onClick={onClose}
          aria-label="Close notification"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
