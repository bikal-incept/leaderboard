/**
 * Blocked Experiments Configuration
 * 
 * This file maintains a list of experiment names or patterns that should be
 * filtered out from the leaderboard and experiment selectors.
 * 
 * Usage:
 *   import { isExperimentBlocked, BLOCKED_EXPERIMENT_NAMES } from '@/config/blockedExperiments';
 *   
 *   const filtered = experiments.filter(exp => !isExperimentBlocked(exp.experiment_tracker));
 */

/**
 * List of exact experiment tracker IDs or names that should be blocked.
 * These will be matched case-insensitively.
 */
export const BLOCKED_EXPERIMENT_IDS: string[] = [
  // 'ela-Kimi-K2-thinking-baseline', // Incept experiment
  // Add more specific experiment IDs here
];

/**
 * List of experiment name patterns (substrings) that should be blocked.
 * If an experiment name contains any of these strings (case-insensitive), it will be blocked.
 */
export const BLOCKED_EXPERIMENT_PATTERNS: string[] = [
  // 'ela-Kimi-K2-thinking-baseline',
  // Add more patterns here, e.g.:
  // 'test',
  // 'demo',
  // 'sandbox',
];

/**
 * Check if an experiment should be blocked based on its tracker ID or name.
 * 
 * @param experimentTracker - The experiment_tracker value to check
 * @param experimentName - Optional experiment name to check against patterns
 * @returns true if the experiment should be blocked, false otherwise
 */
export function isExperimentBlocked(
  experimentTracker: string,
  experimentName?: string
): boolean {
  if (!experimentTracker) {
    return false;
  }

  const trackerLower = experimentTracker.toLowerCase();
  const nameLower = experimentName?.toLowerCase() || '';

  // Check if experiment ID is in the blocked list
  const isIdBlocked = BLOCKED_EXPERIMENT_IDS.some(
    (id) => id.toLowerCase() === trackerLower
  );

  // Check if experiment tracker contains any blocked patterns
  const isTrackerPatternBlocked = BLOCKED_EXPERIMENT_PATTERNS.some((pattern) =>
    trackerLower.includes(pattern.toLowerCase())
  );

  // Check if experiment name contains any blocked patterns
  const isNamePatternBlocked = experimentName
    ? BLOCKED_EXPERIMENT_PATTERNS.some((pattern) =>
        nameLower.includes(pattern.toLowerCase())
      )
    : false;

  // DEBUG: Log the check details
  if (isIdBlocked || isTrackerPatternBlocked || isNamePatternBlocked) {
    console.log('[isExperimentBlocked] BLOCKING:', {
      experimentTracker,
      experimentName,
      trackerLower,
      nameLower,
      isIdBlocked,
      isTrackerPatternBlocked,
      isNamePatternBlocked,
      BLOCKED_EXPERIMENT_IDS,
      BLOCKED_EXPERIMENT_PATTERNS,
    });
  }

  return isIdBlocked || isTrackerPatternBlocked || isNamePatternBlocked;
}

/**
 * Filter an array of experiments to remove blocked ones.
 * 
 * @param experiments - Array of experiments to filter
 * @param getTracker - Function to extract experiment_tracker from an experiment object
 * @param getName - Optional function to extract experiment name from an experiment object
 * @returns Filtered array with blocked experiments removed
 */
export function filterBlockedExperiments<T>(
  experiments: T[],
  getTracker: (exp: T) => string,
  getName?: (exp: T) => string | undefined
): T[] {
  return experiments.filter((exp) => {
    const tracker = getTracker(exp);
    const name = getName ? getName(exp) : undefined;
    return !isExperimentBlocked(tracker, name);
  });
}

/**
 * Check if an experiment name/tracker matches specific patterns for special highlighting.
 * This is separate from blocking - useful for UI highlighting purposes.
 * 
 * @param experimentTracker - The experiment_tracker value to check
 * @param experimentName - Optional experiment name to check
 * @returns true if the experiment should be highlighted (e.g., "Incept" experiments)
 */
export function shouldHighlightExperiment(
  experimentTracker: string,
  experimentName?: string
): boolean {
  if (!experimentTracker && !experimentName) {
    return false;
  }

  const trackerLower = experimentTracker?.toLowerCase() || '';
  const nameLower = experimentName?.toLowerCase() || '';

  // Check if it matches "incept" pattern
  const isInceptExperiment =
    trackerLower === 'incept' ||
    nameLower === 'incept' ||
    trackerLower.includes('incept') ||
    nameLower.includes('incept');

  return isInceptExperiment;
}

// FOR DEBUGGING: Expose to window object in development
if (typeof window !== 'undefined') {
  (window as any).testBlockedExperiments = {
    isExperimentBlocked,
    BLOCKED_EXPERIMENT_IDS,
    BLOCKED_EXPERIMENT_PATTERNS,
    test: (tracker: string, name?: string) => {
      console.log('\n=== Testing Experiment Blocking ===');
      console.log('Input:', { tracker, name });
      console.log('Blocked IDs:', BLOCKED_EXPERIMENT_IDS);
      console.log('Blocked Patterns:', BLOCKED_EXPERIMENT_PATTERNS);
      const result = isExperimentBlocked(tracker, name);
      console.log('Result:', result ? '🚫 BLOCKED' : '✅ ALLOWED');
      console.log('=====================================\n');
      return result;
    }
  };
}
