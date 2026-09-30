/**
 * @file gamification.js
 * Gamification service for tracking template achievements, badges, and usage streaks.
 * Designed without arbitrary points - focused on visual mastery, badges, and progress milestones.
 */

export const BADGES = [
  {
    id: 'first-step',
    name: 'First Step',
    icon: '🎯',
    description: 'Used your first prompt template',
    check: (usedIds) => usedIds.length >= 1,
  },
  {
    id: 'model-architect',
    name: 'Model Architect',
    icon: '🏛️',
    description: 'Created or synthesized a domain model using templates',
    check: (usedIds) => usedIds.includes('create-model') || usedIds.includes('generate-model'),
  },
  {
    id: 'list-extractor',
    name: 'Element Curator',
    icon: '📋',
    description: 'Extracted or refined model element lists',
    check: (usedIds) => usedIds.includes('create-list') || usedIds.includes('update-list'),
  },
  {
    id: 'critical-thinker',
    name: 'Critical Thinker',
    icon: '💡',
    description: 'Used Explain or Discuss to analyze modeling trade-offs',
    check: (usedIds) => usedIds.includes('explain') || usedIds.includes('discuss'),
  },
  {
    id: 'visualizer',
    name: 'Format Visualizer',
    icon: '🎨',
    description: 'Formatted responses with the Present template',
    check: (usedIds) => usedIds.includes('present'),
  },
  {
    id: 'template-explorer',
    name: 'Template Explorer',
    icon: '🌟',
    description: 'Discovered and used 5 different templates',
    check: (usedIds) => usedIds.length >= 5,
  },
  {
    id: 'modeling-maestro',
    name: 'Modeling Maestro',
    icon: '👑',
    description: 'Mastered all 9 conceptual modeling templates!',
    check: (usedIds) => usedIds.length >= 9,
  },
];

const STORAGE_PREFIX = 'aiviz_gamification_';

/**
 * Get gamification state for a given team
 */
export function getGamificationState(teamName = 'default') {
  try {
    const key = `${STORAGE_PREFIX}${teamName}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        usedTemplateIds: parsed.usedTemplateIds || [],
        totalTemplateUses: parsed.totalTemplateUses || 0,
        unlockedBadges: parsed.unlockedBadges || [],
        consecutiveNonTemplateCount: parsed.consecutiveNonTemplateCount || 0,
        isNudgeDismissed: Boolean(parsed.isNudgeDismissed),
      };
    }
  } catch (err) {
    console.warn('Failed to parse gamification state:', err);
  }

  return {
    usedTemplateIds: [],
    totalTemplateUses: 0,
    unlockedBadges: [],
    consecutiveNonTemplateCount: 0,
    isNudgeDismissed: false,
  };
}

/**
 * Save gamification state for a given team
 */
export function saveGamificationState(teamName = 'default', state) {
  try {
    const key = `${STORAGE_PREFIX}${teamName}`;
    localStorage.setItem(key, JSON.stringify(state));
  } catch (err) {
    console.warn('Failed to save gamification state:', err);
  }
}

/**
 * Record a template usage event.
 * Returns the updated state and any newly unlocked badges.
 */
export function recordTemplateUsed(teamName = 'default', templateId) {
  const state = getGamificationState(teamName);

  const prevUsed = new Set(state.usedTemplateIds);
  if (templateId) {
    prevUsed.add(templateId);
  }
  const updatedUsedIds = Array.from(prevUsed);

  // Check for new badges
  const prevBadgeIds = new Set(state.unlockedBadges);
  const newlyUnlocked = [];

  for (const badge of BADGES) {
    if (!prevBadgeIds.has(badge.id) && badge.check(updatedUsedIds)) {
      prevBadgeIds.add(badge.id);
      newlyUnlocked.push(badge);
    }
  }

  const nextState = {
    usedTemplateIds: updatedUsedIds,
    totalTemplateUses: (state.totalTemplateUses || 0) + 1,
    unlockedBadges: Array.from(prevBadgeIds),
    consecutiveNonTemplateCount: 0, // Reset non-template streak!
    isNudgeDismissed: false,
  };

  saveGamificationState(teamName, nextState);

  return {
    state: nextState,
    newlyUnlocked,
  };
}

/**
 * Record a regular (non-template) prompt event.
 * Increments the non-template streak.
 */
export function recordRegularPrompt(teamName = 'default') {
  const state = getGamificationState(teamName);
  const nextCount = (state.consecutiveNonTemplateCount || 0) + 1;

  const nextState = {
    ...state,
    consecutiveNonTemplateCount: nextCount,
  };

  saveGamificationState(teamName, nextState);

  return {
    state: nextState,
    shouldNudge: nextCount >= 3 && !state.isNudgeDismissed,
  };
}

/**
 * Dismiss the current nudge banner
 */
export function dismissNudge(teamName = 'default') {
  const state = getGamificationState(teamName);
  const nextState = {
    ...state,
    isNudgeDismissed: true,
  };
  saveGamificationState(teamName, nextState);
  return nextState;
}
