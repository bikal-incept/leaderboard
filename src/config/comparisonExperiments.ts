/**
 * Comparison Experiments Configuration
 * 
 * This file maintains lists of experiments for InceptLabs vs Field comparison.
 * Each list contains 3 experiments representing Easy, Medium, and Hard difficulty levels.
 * 
 * Usage:
 *   import { INCEPTLABS_EXPERIMENTS, FIELD_EXPERIMENTS } from '@/config/comparisonExperiments';
 */

/**
 * InceptLabs experiments for comparison across difficulty levels.
 * Replace these placeholders with actual experiment tracker names.
 */
export const INCEPTLABS_EXPERIMENTS = {
  easy: 'qwen-235b-thinking-sft-cot-hard-med-saturation',
  medium: 'qwen-235b-thinking-sft-cot-hard-med-saturation',
  hard: 'qwen-235b-thinking-baseline',
};

/**
 * Field experiments for comparison across difficulty levels.
 * Replace these placeholders with actual experiment tracker names.
 */
export const FIELD_EXPERIMENTS = {
  easy: 'O3-ELA',
  medium: 'O3-ELA',
  hard: 'O3-ELA',
};

/**
 * Helper function to get all comparison experiment names as an array.
 */
export function getAllComparisonExperiments(): string[] {
  return [
    ...Object.values(INCEPTLABS_EXPERIMENTS),
    ...Object.values(FIELD_EXPERIMENTS),
  ];
}

/**
 * Check if an experiment is part of the InceptLabs comparison set.
 */
export function isInceptLabsExperiment(experimentTracker: string): boolean {
  return Object.values(INCEPTLABS_EXPERIMENTS).includes(experimentTracker);
}

/**
 * Check if an experiment is part of the Field comparison set.
 */
export function isFieldExperiment(experimentTracker: string): boolean {
  return Object.values(FIELD_EXPERIMENTS).includes(experimentTracker);
}

/**
 * Get the difficulty level for a given experiment in the comparison sets.
 * Returns null if the experiment is not in either comparison set.
 */
export function getExperimentDifficulty(experimentTracker: string): 'Easy' | 'Medium' | 'Hard' | null {
  if (
    experimentTracker === INCEPTLABS_EXPERIMENTS.easy ||
    experimentTracker === FIELD_EXPERIMENTS.easy
  ) {
    return 'Easy';
  }
  if (
    experimentTracker === INCEPTLABS_EXPERIMENTS.medium ||
    experimentTracker === FIELD_EXPERIMENTS.medium
  ) {
    return 'Medium';
  }
  if (
    experimentTracker === INCEPTLABS_EXPERIMENTS.hard ||
    experimentTracker === FIELD_EXPERIMENTS.hard
  ) {
    return 'Hard';
  }
  return null;
}


