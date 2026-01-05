# Comparison Experiments Configuration

This document explains the structure and usage of the comparison experiments configuration system for InceptLabs vs Field comparisons across all subjects.

## Overview

The `comparisonExperiments.ts` file now supports three subjects:
- **Language** - Language learning experiments
- **ELA** - English Language Arts experiments
- **Math** - Mathematics experiments

Each subject has its own set of InceptLabs and Field experiments, configured for both:
- **Attachment Filtered** view (multimedia-free recipes only)
- **All Data** view (complete dataset including multimedia-required recipes)

## Structure

### Experiment Configurations

Each subject has 4 configuration objects:

```typescript
// Language
LANGUAGE_INCEPTLABS_EXPERIMENTS_FILTERED  // InceptLabs experiments (filtered)
LANGUAGE_FIELD_EXPERIMENTS_FILTERED       // Field experiments (filtered)
LANGUAGE_INCEPTLABS_EXPERIMENTS_ALL       // InceptLabs experiments (all data)
LANGUAGE_FIELD_EXPERIMENTS_ALL            // Field experiments (all data)

// ELA
ELA_INCEPTLABS_EXPERIMENTS_FILTERED
ELA_FIELD_EXPERIMENTS_FILTERED
ELA_INCEPTLABS_EXPERIMENTS_ALL
ELA_FIELD_EXPERIMENTS_ALL

// Math
MATH_INCEPTLABS_EXPERIMENTS_FILTERED
MATH_FIELD_EXPERIMENTS_FILTERED
MATH_INCEPTLABS_EXPERIMENTS_ALL
MATH_FIELD_EXPERIMENTS_ALL
```

Each configuration object has three difficulty levels:

```typescript
{
  easy: 'experiment-tracker-id',
  medium: 'experiment-tracker-id',
  hard: 'experiment-tracker-id'
}
```

### Overall Comparison Experiments

For the multi-bar chart visualization, each subject has curated lists:

```typescript
LANGUAGE_OVERALL_COMPARISON_EXPERIMENTS_FILTERED
LANGUAGE_OVERALL_COMPARISON_EXPERIMENTS_ALL

ELA_OVERALL_COMPARISON_EXPERIMENTS_FILTERED
ELA_OVERALL_COMPARISON_EXPERIMENTS_ALL

MATH_OVERALL_COMPARISON_EXPERIMENTS_FILTERED
MATH_OVERALL_COMPARISON_EXPERIMENTS_ALL
```

Format: `[experimentTracker: string, rename?: string]`

## Usage

### Getting Experiment Configurations

```typescript
import { getInceptLabsExperiments, getFieldExperiments } from '@/config/comparisonExperiments';

// Get InceptLabs experiments for a specific subject
const languageExperiments = getInceptLabsExperiments('language', 'attachment_filtered');
// Returns: { easy: '...', medium: '...', hard: '...' }

// Get Field experiments for math
const mathFieldExperiments = getFieldExperiments('math', 'all');
```

### Getting Overall Comparison Experiments

```typescript
import { getOverallComparisonExperimentTuples } from '@/config/comparisonExperiments';

// For the multi-bar chart
const experiments = getOverallComparisonExperimentTuples('ela', 'attachment_filtered');
// Returns: [['tracker-id', 'Display Name'], ...]
```

### Checking Experiment Membership

```typescript
import { isInceptLabsExperiment, isFieldExperiment } from '@/config/comparisonExperiments';

// Check if an experiment belongs to InceptLabs
if (isInceptLabsExperiment('some-tracker-id', 'language', 'attachment_filtered')) {
  // This is an InceptLabs experiment
}

// Check if an experiment belongs to Field
if (isFieldExperiment('some-tracker-id', 'math', 'all')) {
  // This is a Field experiment
}
```

### Getting Difficulty Level

```typescript
import { getExperimentDifficulty } from '@/config/comparisonExperiments';

const difficulty = getExperimentDifficulty('tracker-id', 'ela', 'attachment_filtered');
// Returns: 'Easy' | 'Medium' | 'Hard' | null
```

## Function Signatures

```typescript
type Subject = 'language' | 'ela' | 'math';
type ViewMode = 'attachment_filtered' | 'all';

getInceptLabsExperiments(subject?: Subject, viewMode?: ViewMode): ExperimentConfig
getFieldExperiments(subject?: Subject, viewMode?: ViewMode): ExperimentConfig
getAllComparisonExperiments(subject?: Subject, viewMode?: ViewMode): string[]
getOverallComparisonExperiments(subject?: Subject, viewMode?: ViewMode): string[]
getOverallComparisonExperimentTuples(subject?: Subject, viewMode?: ViewMode): OverallComparisonExperiment[]
isInceptLabsExperiment(experimentTracker: string, subject?: Subject, viewMode?: ViewMode): boolean
isFieldExperiment(experimentTracker: string, subject?: Subject, viewMode?: ViewMode): boolean
getExperimentDifficulty(experimentTracker: string, subject?: Subject, viewMode?: ViewMode): 'Easy' | 'Medium' | 'Hard' | null
```

All parameters have defaults (`subject='ela'`, `viewMode='attachment_filtered'`) for backward compatibility.

## Updating Experiment Trackers

### For Language

Edit the constants in `comparisonExperiments.ts`:

```typescript
export const LANGUAGE_INCEPTLABS_EXPERIMENTS_FILTERED: ExperimentConfig = {
  easy: 'your-experiment-tracker-id',
  medium: 'your-experiment-tracker-id',
  hard: 'your-experiment-tracker-id',
};

export const LANGUAGE_FIELD_EXPERIMENTS_FILTERED: ExperimentConfig = {
  easy: 'field-experiment-tracker-id',
  medium: 'field-experiment-tracker-id',
  hard: 'field-experiment-tracker-id',
};
```

### For Math

```typescript
export const MATH_INCEPTLABS_EXPERIMENTS_FILTERED: ExperimentConfig = {
  easy: 'math-inceptlabs-experiment-id',
  medium: 'math-inceptlabs-experiment-id',
  hard: 'math-inceptlabs-experiment-id',
};

export const MATH_FIELD_EXPERIMENTS_FILTERED: ExperimentConfig = {
  easy: 'math-field-experiment-id',
  medium: 'math-field-experiment-id',
  hard: 'math-field-experiment-id',
};
```

### For Overall Comparison Charts

Update the curated lists to show specific experiments in the multi-bar charts:

```typescript
export const LANGUAGE_OVERALL_COMPARISON_EXPERIMENTS_FILTERED: OverallComparisonExperiment[] = [
  ['experiment-tracker-1', 'Display Name 1'],
  ['experiment-tracker-2', 'Display Name 2'],
  ['experiment-tracker-3', 'Display Name 3'],
  // Add more experiments as needed
];
```

## Example: Benchmarks.tsx Usage

```typescript
import { getInceptLabsExperiments, getFieldExperiments, getOverallComparisonExperimentTuples } from '../config/comparisonExperiments';

// Inside your component
const selectedSubject: 'language' | 'ela' | 'math' = 'language';
const viewMode: 'attachment_filtered' | 'all' = 'attachment_filtered';

// Get experiment configurations
const inceptLabsExperiments = getInceptLabsExperiments(selectedSubject, viewMode);
const fieldExperiments = getFieldExperiments(selectedSubject, viewMode);

// Use in charts
<OverallMultiBarChart
  title="Overall performance"
  experiments={getOverallComparisonExperimentTuples(selectedSubject, viewMode)}
/>
```

## Backward Compatibility

Legacy exports are maintained for backward compatibility (defaults to ELA):

```typescript
INCEPTLABS_EXPERIMENTS_FILTERED  // = ELA_INCEPTLABS_EXPERIMENTS_FILTERED
FIELD_EXPERIMENTS_FILTERED       // = ELA_FIELD_EXPERIMENTS_FILTERED
OVERALL_COMPARISON_EXPERIMENTS   // = ELA_OVERALL_COMPARISON_EXPERIMENTS_FILTERED
```

## Next Steps

1. **Update Language Experiment IDs**: Replace placeholder IDs in `LANGUAGE_*` constants with actual experiment tracker IDs from your database
2. **Update Math Experiment IDs**: Replace placeholder IDs in `MATH_*` constants with actual experiment tracker IDs
3. **Curate Overall Experiments**: Update the `*_OVERALL_COMPARISON_EXPERIMENTS_*` arrays with the specific experiments you want to highlight in the comparison charts
4. **Test All Subjects**: Verify that all three subjects (Language, ELA, Math) work correctly in the Benchmarks page

## Architecture Benefits

- ✅ **Subject-Specific**: Each subject has its own experiment configurations
- ✅ **View-Mode Aware**: Separate configs for filtered and all-data views
- ✅ **Type-Safe**: Full TypeScript type checking
- ✅ **Backward Compatible**: Legacy exports maintained for existing code
- ✅ **Extensible**: Easy to add new subjects in the future
- ✅ **Centralized**: Single source of truth for all comparison experiments




