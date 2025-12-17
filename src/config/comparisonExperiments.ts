/**
 * Comparison Experiments Configuration
 * 
 * This file maintains lists of experiments for InceptLabs vs Field comparison.
 * Each list contains 3 experiments representing Easy, Medium, and Hard difficulty levels.
 * 
 * Separate configurations exist for:
 * - Attachment Filtered view (47 multimedia-free recipes only)
 * - All Data view (complete dataset including multimedia-required recipes)
 * 
 * Usage:
 *   import { 
 *     INCEPTLABS_EXPERIMENTS_FILTERED, FIELD_EXPERIMENTS_FILTERED,
 *     INCEPTLABS_EXPERIMENTS_ALL, FIELD_EXPERIMENTS_ALL 
 *   } from '@/config/comparisonExperiments';
 */

/**
 * InceptLabs experiments for ATTACHMENT FILTERED view (47 multimedia-free recipes)
 * These experiments are optimized for text-only question generation
 */
export const INCEPTLABS_EXPERIMENTS_FILTERED = {
  easy: 'qwen-235b-thinking-high-sft-104050-3s',
  medium: 'qwen-235b-thinking-high-sft-104050-3s',
  hard: 'qwen-235b-thinking-high-sft-104050-3s',
};

/**
 * Field experiments for ATTACHMENT FILTERED view (47 multimedia-free recipes)
 */
export const FIELD_EXPERIMENTS_FILTERED = {
  easy: 'claude-sonnet-4-5',
  medium: 'O3-ELA',
  hard: 'O3-ELA',
};

/**
 * InceptLabs experiments for ALL DATA view (complete dataset, 185 recipes)
 * These experiments include multimedia-required standards
 */
export const INCEPTLABS_EXPERIMENTS_ALL = {
  easy: 'qwen-235b-thinking-high-sft-104050-3s',
  medium: 'qwen-235b-thinking-high-sft-104050-3s',
  hard: 'qwen-235b-thinking-high-sft-104050-3s',
};

/**
 * Field experiments for ALL DATA view (complete dataset, 185 recipes)
 */
export const FIELD_EXPERIMENTS_ALL = {
  easy: 'O3-ELA',
  medium: 'O3-ELA',
  hard: 'O3-ELA',
};

// Legacy exports for backward compatibility (default to filtered view)
export const INCEPTLABS_EXPERIMENTS = INCEPTLABS_EXPERIMENTS_FILTERED;
export const FIELD_EXPERIMENTS = FIELD_EXPERIMENTS_FILTERED;

/**
 * Helper function to get all comparison experiment names as an array.
 * @param viewMode - 'attachment_filtered' or 'all' (defaults to 'attachment_filtered')
 */
export function getAllComparisonExperiments(viewMode: 'attachment_filtered' | 'all' = 'attachment_filtered'): string[] {
  if (viewMode === 'all') {
    return [
      ...Object.values(INCEPTLABS_EXPERIMENTS_ALL),
      ...Object.values(FIELD_EXPERIMENTS_ALL),
    ];
  }
  return [
    ...Object.values(INCEPTLABS_EXPERIMENTS_FILTERED),
    ...Object.values(FIELD_EXPERIMENTS_FILTERED),
  ];
}

/**
 * Check if an experiment is part of the InceptLabs comparison set.
 * @param viewMode - 'attachment_filtered' or 'all' (defaults to 'attachment_filtered')
 */
export function isInceptLabsExperiment(experimentTracker: string, viewMode: 'attachment_filtered' | 'all' = 'attachment_filtered'): boolean {
  if (viewMode === 'all') {
    return Object.values(INCEPTLABS_EXPERIMENTS_ALL).includes(experimentTracker);
  }
  return Object.values(INCEPTLABS_EXPERIMENTS_FILTERED).includes(experimentTracker);
}

/**
 * Check if an experiment is part of the Field comparison set.
 * @param viewMode - 'attachment_filtered' or 'all' (defaults to 'attachment_filtered')
 */
export function isFieldExperiment(experimentTracker: string, viewMode: 'attachment_filtered' | 'all' = 'attachment_filtered'): boolean {
  if (viewMode === 'all') {
    return Object.values(FIELD_EXPERIMENTS_ALL).includes(experimentTracker);
  }
  return Object.values(FIELD_EXPERIMENTS_FILTERED).includes(experimentTracker);
}

/**
 * Get the difficulty level for a given experiment in the comparison sets.
 * Returns null if the experiment is not in either comparison set.
 * @param viewMode - 'attachment_filtered' or 'all' (defaults to 'attachment_filtered')
 */
export function getExperimentDifficulty(
  experimentTracker: string, 
  viewMode: 'attachment_filtered' | 'all' = 'attachment_filtered'
): 'Easy' | 'Medium' | 'Hard' | null {
  const inceptLabs = viewMode === 'all' ? INCEPTLABS_EXPERIMENTS_ALL : INCEPTLABS_EXPERIMENTS_FILTERED;
  const field = viewMode === 'all' ? FIELD_EXPERIMENTS_ALL : FIELD_EXPERIMENTS_FILTERED;

  if (experimentTracker === inceptLabs.easy || experimentTracker === field.easy) {
    return 'Easy';
  }
  if (experimentTracker === inceptLabs.medium || experimentTracker === field.medium) {
    return 'Medium';
  }
  if (experimentTracker === inceptLabs.hard || experimentTracker === field.hard) {
    return 'Hard';
  }
  return null;
}

/**
 * Get the appropriate experiments configuration based on view mode
 */
export function getInceptLabsExperiments(viewMode: 'attachment_filtered' | 'all' = 'attachment_filtered') {
  return viewMode === 'all' ? INCEPTLABS_EXPERIMENTS_ALL : INCEPTLABS_EXPERIMENTS_FILTERED;
}

/**
 * Get the appropriate field experiments configuration based on view mode
 */
export function getFieldExperiments(viewMode: 'attachment_filtered' | 'all' = 'attachment_filtered') {
  return viewMode === 'all' ? FIELD_EXPERIMENTS_ALL : FIELD_EXPERIMENTS_FILTERED;
}



