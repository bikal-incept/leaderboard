/**
 * Comparison Experiments Configuration
 * 
 * This file maintains lists of experiments for InceptLabs vs Field comparison across all subjects.
 * Each list contains 3 experiments representing Easy, Medium, and Hard difficulty levels.
 * 
 * Supported subjects: Language, ELA, Math
 * 
 * Separate configurations exist for:
 * - Attachment Filtered view (multimedia-free recipes only)
 * - All Data view (complete dataset including multimedia-required recipes)
 * 
 * Usage:
 *   import { 
 *     getInceptLabsExperiments, getFieldExperiments,
 *     getOverallComparisonExperimentTuples
 *   } from '@/config/comparisonExperiments';
 */

export type Subject = 'language' | 'ela' | 'math' | 'reading' | '(r+l)-ela';
export type ViewMode = 'attachment_filtered' | 'all';

interface ExperimentConfig {
  easy: string;
  medium: string;
  hard: string;
}

// ============================================================================
// LANGUAGE EXPERIMENTS
// ============================================================================

/**
 * InceptLabs experiments for LANGUAGE subject - ATTACHMENT FILTERED view
 */
export const LANGUAGE_INCEPTLABS_EXPERIMENTS_FILTERED: ExperimentConfig = {
  easy: 'Deepseek-R1-language-baseline',
  medium: 'Qwen-235b-thinking-language-baseline',
  hard: 'Qwen-235b-thinking-language-baseline',
};

/**
 * Field experiments for LANGUAGE subject - ATTACHMENT FILTERED view
 */
export const LANGUAGE_FIELD_EXPERIMENTS_FILTERED: ExperimentConfig = {
  easy: 'GPT-5.2-language',
  medium: 'Claude-Sonnet-4-5-baseline-Language',
  hard: 'GPT-5.2-language',
};

/**
 * InceptLabs experiments for LANGUAGE subject - ALL DATA view
 */
export const LANGUAGE_INCEPTLABS_EXPERIMENTS_ALL: ExperimentConfig = {
  easy: 'Deepseek-R1-language-baseline',
  medium: 'Qwen-235b-thinking-language-baseline',
  hard: 'Qwen-235b-thinking-language-baseline',
};

/**
 * Field experiments for LANGUAGE subject - ALL DATA view
 */
export const LANGUAGE_FIELD_EXPERIMENTS_ALL: ExperimentConfig = {
  easy: 'GPT-5.2-language',
  medium: 'Claude-Sonnet-4-5-baseline-Language',
  hard: 'GPT-5.2-language',
};

// ============================================================================
// ELA EXPERIMENTS
// ============================================================================

/**
 * InceptLabs experiments for ELA subject - ATTACHMENT FILTERED view
 */
export const ELA_INCEPTLABS_EXPERIMENTS_FILTERED: ExperimentConfig = {
  easy: 'g3-mcq-deepseek-r1-thinking-budgets-refiner',
  medium: 'g3-mcq-deepseek-r1-thinking-budgets-refiner',
  hard: 'g3-mcq-deepseek-r1-thinking-budgets-refiner',
};

/**
 * Field experiments for ATTACHMENT FILTERED view (47 multimedia-free recipes)
 */
export const ELA_FIELD_EXPERIMENTS_FILTERED: ExperimentConfig = {
  easy: 'claude-sonnet-4-5',
  medium: 'O3-ELA',
  hard: 'O3-ELA',
};

/**
 * InceptLabs experiments for ELA subject - ALL DATA view
 */
export const ELA_INCEPTLABS_EXPERIMENTS_ALL: ExperimentConfig = {
  easy: 'g3-mcq-deepseek-r1-thinking-budgets-refiner',
  medium: 'g3-mcq-deepseek-r1-thinking-budgets-refiner',
  hard: 'g3-mcq-deepseek-r1-thinking-budgets-refiner',
};

/**
 * Field experiments for ELA subject - ALL DATA view
 */
export const ELA_FIELD_EXPERIMENTS_ALL: ExperimentConfig = {
  easy: 'O3-ELA',
  medium: 'O3-ELA',
  hard: 'O3-ELA',
};

// ============================================================================
// MATH EXPERIMENTS
// ============================================================================

/**
 * InceptLabs experiments for MATH subject - ATTACHMENT FILTERED view
 */
export const MATH_INCEPTLABS_EXPERIMENTS_FILTERED: ExperimentConfig = {
  easy: 'math-inceptlabs-easy',
  medium: 'math-inceptlabs-medium',
  hard: 'math-inceptlabs-hard',
};

/**
 * Field experiments for MATH subject - ATTACHMENT FILTERED view
 */
export const MATH_FIELD_EXPERIMENTS_FILTERED: ExperimentConfig = {
  easy: 'math-field-easy',
  medium: 'math-field-medium',
  hard: 'math-field-hard',
};

/**
 * InceptLabs experiments for MATH subject - ALL DATA view
 */
export const MATH_INCEPTLABS_EXPERIMENTS_ALL: ExperimentConfig = {
  easy: 'math-inceptlabs-easy',
  medium: 'math-inceptlabs-medium',
  hard: 'math-inceptlabs-hard',
};

/**
 * Field experiments for MATH subject - ALL DATA view
 */
export const MATH_FIELD_EXPERIMENTS_ALL: ExperimentConfig = {
  easy: 'math-field-easy',
  medium: 'math-field-medium',
  hard: 'math-field-hard',
};

// ============================================================================
// LEGACY EXPORTS (for backward compatibility - default to ELA)
// ============================================================================

export const INCEPTLABS_EXPERIMENTS_FILTERED = ELA_INCEPTLABS_EXPERIMENTS_FILTERED;
export const FIELD_EXPERIMENTS_FILTERED = ELA_FIELD_EXPERIMENTS_FILTERED;
export const INCEPTLABS_EXPERIMENTS_ALL = ELA_INCEPTLABS_EXPERIMENTS_ALL;
export const FIELD_EXPERIMENTS_ALL = ELA_FIELD_EXPERIMENTS_ALL;

// ============================================================================
// OVERALL COMPARISON EXPERIMENTS (for multi-bar charts)
// ============================================================================

/**
 * Experiments to display in the "overall performance" multi-bar chart.
 * Intentionally a short, curated list (typically ~6).
 *
 * Format:
 *   [experiment_tracker, rename?]
 *
 * If rename is omitted, the UI will use experiment_tracker as the label.
 * Tip: Keep experiment_tracker values unique so you get one bar per tracker.
 */
export type OverallComparisonExperiment = [experimentTracker: string, rename?: string];

// LANGUAGE overall comparison experiments
export const LANGUAGE_OVERALL_COMPARISON_EXPERIMENTS_FILTERED: OverallComparisonExperiment[] = [
  ['Claude-Sonnet-4-5-baseline-Language', 'Claude-Sonnet-4-5-baseline-Language'],
  ['o3-language-high', 'o3-language-high'],
  ['Deepseek-R1-language-baseline', 'Deepseek-R1-language-baseline'],
  ['Qwen-235b-thinking-language-baseline','Qwen-235b-thinking-language-baseline'],
  ['GPT-5.2-language','GPT-5.2-language']
];

export const LANGUAGE_OVERALL_COMPARISON_EXPERIMENTS_ALL: OverallComparisonExperiment[] = [
  ['Claude-Sonnet-4-5-baseline-Language', 'Claude-Sonnet-4-5-baseline-Language'],
  ['o3-language-high', 'o3-language-high'],
  ['Deepseek-R1-language-baseline', 'Deepseek-R1-language-baseline'],
  ['Qwen-235b-thinking-language-baseline','Qwen-235b-thinking-language-baseline'],
  ['GPT-5.2-language','GPT-5.2-language']
];

// ELA overall comparison experiments
export const ELA_OVERALL_COMPARISON_EXPERIMENTS_FILTERED: OverallComparisonExperiment[] = [
  ['g3-mcq-deepseek-r1-thinking-budgets-refiner', 'InceptLabs'],
  ['O3-ELA', 'O3-high'],
  ['claude-sonnet-4-5', 'Claude-Sonnet-4-5'],
  ['ela-Kimi-K2-thinking-baseline(non-tunable)', 'Kimi-K2-baseline'],
  ['ela-gpt-5.2-baseline', 'gpt-5.2'],
  ['ela-deepseek-v3p1-terminus-baseline', 'ela-deepseek-v3p1-terminus']
];

export const ELA_OVERALL_COMPARISON_EXPERIMENTS_ALL: OverallComparisonExperiment[] = [
  ['g3-mcq-deepseek-r1-thinking-budgets-refiner', 'InceptLabs'],
  ['O3-ELA', 'O3-high'],
  ['claude-sonnet-4-5', 'Claude-Sonnet-4-5'],
  ['ela-Kimi-K2-thinking-baseline(non-tunable)', 'Kimi-K2-baseline'],
  ['ela-gpt-5.2-baseline', 'gpt-5.2'],
  ['ela-deepseek-v3p1-terminus-baseline', 'ela-deepseek-v3p1-terminus']
];

// MATH overall comparison experiments
export const MATH_OVERALL_COMPARISON_EXPERIMENTS_FILTERED: OverallComparisonExperiment[] = [
  ['math-inceptlabs-easy', 'InceptLabs-Easy'],
  ['math-field-easy', 'Field-Easy'],
  ['math-inceptlabs-medium', 'InceptLabs-Medium'],
  ['math-field-medium', 'Field-Medium'],
];

export const MATH_OVERALL_COMPARISON_EXPERIMENTS_ALL: OverallComparisonExperiment[] = [
  ['math-inceptlabs-easy', 'InceptLabs-Easy'],
  ['math-field-easy', 'Field-Easy'],
  ['math-inceptlabs-medium', 'InceptLabs-Medium'],
  ['math-field-medium', 'Field-Medium'],
];

// Legacy exports for backward compatibility (default to ELA filtered view)
export const OVERALL_COMPARISON_EXPERIMENTS_FILTERED = ELA_OVERALL_COMPARISON_EXPERIMENTS_FILTERED;
export const OVERALL_COMPARISON_EXPERIMENTS_ALL = ELA_OVERALL_COMPARISON_EXPERIMENTS_ALL;
export const INCEPTLABS_EXPERIMENTS = INCEPTLABS_EXPERIMENTS_FILTERED;
export const FIELD_EXPERIMENTS = FIELD_EXPERIMENTS_FILTERED;
export const OVERALL_COMPARISON_EXPERIMENTS = OVERALL_COMPARISON_EXPERIMENTS_FILTERED;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get InceptLabs experiments for a specific subject and view mode
 */
export function getInceptLabsExperiments(
  subject: Subject = 'ela',
  viewMode: ViewMode = 'attachment_filtered'
): ExperimentConfig {
  if (subject === 'language' || subject === 'reading') {
    return viewMode === 'all' ? LANGUAGE_INCEPTLABS_EXPERIMENTS_ALL : LANGUAGE_INCEPTLABS_EXPERIMENTS_FILTERED;
  }
  if (subject === 'math') {
    return viewMode === 'all' ? MATH_INCEPTLABS_EXPERIMENTS_ALL : MATH_INCEPTLABS_EXPERIMENTS_FILTERED;
  }
  if (subject === '(r+l)-ela') {
    // (R+L)-ELA doesn't use comparison section, return empty config
    return { easy: '', medium: '', hard: '' };
  }
  // Default to ELA
  return viewMode === 'all' ? ELA_INCEPTLABS_EXPERIMENTS_ALL : ELA_INCEPTLABS_EXPERIMENTS_FILTERED;
}

/**
 * Get Field experiments for a specific subject and view mode
 */
export function getFieldExperiments(
  subject: Subject = 'ela',
  viewMode: ViewMode = 'attachment_filtered'
): ExperimentConfig {
  if (subject === 'language' || subject === 'reading') {
    return viewMode === 'all' ? LANGUAGE_FIELD_EXPERIMENTS_ALL : LANGUAGE_FIELD_EXPERIMENTS_FILTERED;
  }
  if (subject === 'math') {
    return viewMode === 'all' ? MATH_FIELD_EXPERIMENTS_ALL : MATH_FIELD_EXPERIMENTS_FILTERED;
  }
  if (subject === '(r+l)-ela') {
    // (R+L)-ELA doesn't use comparison section, return empty config
    return { easy: '', medium: '', hard: '' };
  }
  // Default to ELA
  return viewMode === 'all' ? ELA_FIELD_EXPERIMENTS_ALL : ELA_FIELD_EXPERIMENTS_FILTERED;
}

/**
 * Get all comparison experiment names as an array for a specific subject
 */
export function getAllComparisonExperiments(
  subject: Subject = 'ela',
  viewMode: ViewMode = 'attachment_filtered'
): string[] {
  const inceptLabs = getInceptLabsExperiments(subject, viewMode);
  const field = getFieldExperiments(subject, viewMode);
  
  return [
    ...Object.values(inceptLabs),
    ...Object.values(field),
  ];
}

/**
 * Get the curated experiment list for the "overall performance" multi-bar chart
 */
export function getOverallComparisonExperiments(
  subject: Subject = 'ela',
  viewMode: ViewMode = 'attachment_filtered'
): string[] {
  return getOverallComparisonExperimentTuples(subject, viewMode).map(
    ([experimentTracker]) => experimentTracker
  );
}

/**
 * Get the curated experiments (with optional rename) for the "overall performance" multi-bar chart
 */
export function getOverallComparisonExperimentTuples(
  subject: Subject = 'ela',
  viewMode: ViewMode = 'attachment_filtered'
): OverallComparisonExperiment[] {
  if (subject === 'language' || subject === 'reading') {
    return viewMode === 'all' 
      ? LANGUAGE_OVERALL_COMPARISON_EXPERIMENTS_ALL 
      : LANGUAGE_OVERALL_COMPARISON_EXPERIMENTS_FILTERED;
  }
  if (subject === 'math') {
    return viewMode === 'all' 
      ? MATH_OVERALL_COMPARISON_EXPERIMENTS_ALL 
      : MATH_OVERALL_COMPARISON_EXPERIMENTS_FILTERED;
  }
  if (subject === '(r+l)-ela') {
    // (R+L)-ELA uses auto-discovery in evaluator 2.1.0
    return [];
  }
  // Default to ELA
  return viewMode === 'all' 
    ? ELA_OVERALL_COMPARISON_EXPERIMENTS_ALL 
    : ELA_OVERALL_COMPARISON_EXPERIMENTS_FILTERED;
}

/**
 * Check if an experiment is part of the InceptLabs comparison set for a specific subject
 */
export function isInceptLabsExperiment(
  experimentTracker: string,
  subject: Subject = 'ela',
  viewMode: ViewMode = 'attachment_filtered'
): boolean {
  const inceptLabs = getInceptLabsExperiments(subject, viewMode);
  return Object.values(inceptLabs).includes(experimentTracker);
}

/**
 * Check if an experiment is part of the Field comparison set for a specific subject
 */
export function isFieldExperiment(
  experimentTracker: string,
  subject: Subject = 'ela',
  viewMode: ViewMode = 'attachment_filtered'
): boolean {
  const field = getFieldExperiments(subject, viewMode);
  return Object.values(field).includes(experimentTracker);
}

/**
 * Get the difficulty level for a given experiment in the comparison sets
 * Returns null if the experiment is not in either comparison set
 */
export function getExperimentDifficulty(
  experimentTracker: string,
  subject: Subject = 'ela',
  viewMode: ViewMode = 'attachment_filtered'
): 'Easy' | 'Medium' | 'Hard' | null {
  const inceptLabs = getInceptLabsExperiments(subject, viewMode);
  const field = getFieldExperiments(subject, viewMode);

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



