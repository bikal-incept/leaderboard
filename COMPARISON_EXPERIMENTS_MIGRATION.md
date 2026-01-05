# Comparison Experiments Migration - Multi-Subject Support

## Summary

The comparison experiments configuration has been restructured to support **InceptLabs vs Field** comparisons across all three subjects: **Language**, **ELA**, and **Math**.

## Changes Made

### 1. **comparisonExperiments.ts** - Complete Restructure

#### Before:
- Only supported ELA experiments
- Single set of InceptLabs and Field configurations
- No subject-specific organization

#### After:
- **Subject-specific configurations** for Language, ELA, and Math
- Each subject has 4 configurations:
  - `{SUBJECT}_INCEPTLABS_EXPERIMENTS_FILTERED`
  - `{SUBJECT}_FIELD_EXPERIMENTS_FILTERED`
  - `{SUBJECT}_INCEPTLABS_EXPERIMENTS_ALL`
  - `{SUBJECT}_FIELD_EXPERIMENTS_ALL`
- Each subject has its own overall comparison experiment lists
- All helper functions now accept `subject` parameter

### 2. **Updated Helper Functions**

All functions now support subject-specific queries:

```typescript
// OLD (ELA-only)
getInceptLabsExperiments(viewMode)
getFieldExperiments(viewMode)

// NEW (Multi-subject)
getInceptLabsExperiments(subject, viewMode)
getFieldExperiments(subject, viewMode)
```

Functions updated:
- ✅ `getInceptLabsExperiments(subject?, viewMode?)`
- ✅ `getFieldExperiments(subject?, viewMode?)`
- ✅ `getAllComparisonExperiments(subject?, viewMode?)`
- ✅ `getOverallComparisonExperiments(subject?, viewMode?)`
- ✅ `getOverallComparisonExperimentTuples(subject?, viewMode?)`
- ✅ `isInceptLabsExperiment(experimentTracker, subject?, viewMode?)`
- ✅ `isFieldExperiment(experimentTracker, subject?, viewMode?)`
- ✅ `getExperimentDifficulty(experimentTracker, subject?, viewMode?)`

### 3. **Benchmarks.tsx** - Updated Function Calls

Updated to pass the current subject to comparison functions:

```typescript
// Line 350-351
const inceptLabsExperiments = getInceptLabsExperiments(selectedSubject, viewMode);
const fieldExperiments = getFieldExperiments(selectedSubject, viewMode);

// Line 955
experiments={getOverallComparisonExperimentTuples(selectedSubject, viewMode)}
```

### 4. **Backward Compatibility**

Legacy exports maintained for existing code:
```typescript
INCEPTLABS_EXPERIMENTS_FILTERED  // defaults to ELA
FIELD_EXPERIMENTS_FILTERED       // defaults to ELA
OVERALL_COMPARISON_EXPERIMENTS   // defaults to ELA
```

All functions default to `subject='ela'` if not specified.

## New Experiment Configurations

### Language Experiments
```typescript
LANGUAGE_INCEPTLABS_EXPERIMENTS_FILTERED
LANGUAGE_FIELD_EXPERIMENTS_FILTERED
LANGUAGE_INCEPTLABS_EXPERIMENTS_ALL
LANGUAGE_FIELD_EXPERIMENTS_ALL
LANGUAGE_OVERALL_COMPARISON_EXPERIMENTS_FILTERED
LANGUAGE_OVERALL_COMPARISON_EXPERIMENTS_ALL
```

### Math Experiments
```typescript
MATH_INCEPTLABS_EXPERIMENTS_FILTERED
MATH_FIELD_EXPERIMENTS_FILTERED
MATH_INCEPTLABS_EXPERIMENTS_ALL
MATH_FIELD_EXPERIMENTS_ALL
MATH_OVERALL_COMPARISON_EXPERIMENTS_FILTERED
MATH_OVERALL_COMPARISON_EXPERIMENTS_ALL
```

### ELA Experiments (renamed from generic)
```typescript
ELA_INCEPTLABS_EXPERIMENTS_FILTERED
ELA_FIELD_EXPERIMENTS_FILTERED
ELA_INCEPTLABS_EXPERIMENTS_ALL
ELA_FIELD_EXPERIMENTS_ALL
ELA_OVERALL_COMPARISON_EXPERIMENTS_FILTERED
ELA_OVERALL_COMPARISON_EXPERIMENTS_ALL
```

## Required Next Steps

### 1. Update Language Experiment Tracker IDs

Edit `/src/config/comparisonExperiments.ts` and replace the placeholder values:

```typescript
export const LANGUAGE_INCEPTLABS_EXPERIMENTS_FILTERED: ExperimentConfig = {
  easy: 'your-actual-experiment-tracker-id',    // ⚠️ UPDATE THIS
  medium: 'your-actual-experiment-tracker-id',  // ⚠️ UPDATE THIS
  hard: 'your-actual-experiment-tracker-id',    // ⚠️ UPDATE THIS
};

export const LANGUAGE_FIELD_EXPERIMENTS_FILTERED: ExperimentConfig = {
  easy: 'field-experiment-tracker-id',    // ⚠️ UPDATE THIS
  medium: 'field-experiment-tracker-id',  // ⚠️ UPDATE THIS
  hard: 'field-experiment-tracker-id',    // ⚠️ UPDATE THIS
};
```

Also update the `_ALL` versions for the full dataset view.

### 2. Update Math Experiment Tracker IDs

Similarly, update the Math experiment configurations:

```typescript
export const MATH_INCEPTLABS_EXPERIMENTS_FILTERED: ExperimentConfig = {
  easy: 'math-inceptlabs-experiment-id',    // ⚠️ UPDATE THIS
  medium: 'math-inceptlabs-experiment-id',  // ⚠️ UPDATE THIS
  hard: 'math-inceptlabs-experiment-id',    // ⚠️ UPDATE THIS
};

export const MATH_FIELD_EXPERIMENTS_FILTERED: ExperimentConfig = {
  easy: 'math-field-experiment-id',    // ⚠️ UPDATE THIS
  medium: 'math-field-experiment-id',  // ⚠️ UPDATE THIS
  hard: 'math-field-experiment-id',    // ⚠️ UPDATE THIS
};
```

### 3. Curate Overall Comparison Lists

Update the overall comparison experiment arrays to show your preferred experiments in the multi-bar charts:

```typescript
export const LANGUAGE_OVERALL_COMPARISON_EXPERIMENTS_FILTERED: OverallComparisonExperiment[] = [
  ['actual-experiment-1', 'InceptLabs-Easy'],
  ['actual-experiment-2', 'Field-Easy'],
  // Add 4-6 key experiments you want to highlight
];
```

## How to Find Experiment Tracker IDs

1. **Check the database**: Query the `generated_questions` table:
   ```sql
   SELECT DISTINCT experiment_tracker, subject
   FROM generated_questions gq
   JOIN question_recipes qr ON gq.recipe_id = qr.recipe_id
   WHERE qr.subject = 'language'  -- or 'math'
   ORDER BY experiment_tracker;
   ```

2. **Check existing data**: Look at the Evaluations page dropdown to see available experiment trackers

3. **Coordinate with your team**: Ask which experiments should be designated as "InceptLabs" vs "Field" for each subject

## Testing

After updating the experiment IDs:

1. ✅ Navigate to Benchmarks page
2. ✅ Switch to **Language** tab - verify InceptLabs vs Field comparison appears
3. ✅ Switch to **Math** tab - verify InceptLabs vs Field comparison appears
4. ✅ Switch to **ELA** tab - verify it still works (should be unchanged)
5. ✅ Toggle between "Attachment Filtered" and "All Data" views
6. ✅ Verify the "Overall Performance" chart shows correct experiments for each subject

## Files Modified

- ✅ `/src/config/comparisonExperiments.ts` - Complete restructure with multi-subject support
- ✅ `/src/pages/Benchmarks.tsx` - Updated function calls to pass subject parameter
- 📄 `/src/config/COMPARISON_EXPERIMENTS_README.md` - New documentation
- 📄 `/COMPARISON_EXPERIMENTS_MIGRATION.md` - This migration guide

## Breaking Changes

**None** - All changes are backward compatible. Existing code that doesn't specify a subject will default to ELA.

## Benefits

✅ **Per-Subject Comparisons**: Each subject has its own InceptLabs vs Field configurations  
✅ **Cleaner Organization**: Subject-specific constants are clearly labeled  
✅ **Type Safety**: Full TypeScript support with Subject and ViewMode types  
✅ **Maintainability**: Easy to update experiments for each subject independently  
✅ **Extensibility**: Simple to add new subjects in the future  
✅ **Backward Compatible**: Existing code continues to work without changes

## Questions?

See `/src/config/COMPARISON_EXPERIMENTS_README.md` for detailed usage examples and API documentation.




