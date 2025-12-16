# Configuration Directory

## Blocked Experiments Configuration

The `blockedExperiments.ts` file provides centralized management of experiments that should be filtered out or highlighted in the leaderboard UI.

### Usage

#### 1. Blocking Experiments from Selection

To block experiments from appearing in dropdowns and selectors:

```typescript
import { isExperimentBlocked } from '../config/blockedExperiments';

// Filter experiments
const filtered = allExperiments.filter((exp) => {
  return !isExperimentBlocked(exp.experiment_tracker, exp.name);
});
```

#### 2. Highlighting Special Experiments

To apply special styling to certain experiments (like "Incept"):

```typescript
import { shouldHighlightExperiment } from '../config/blockedExperiments';

// Check if experiment should be highlighted
const isSpecial = shouldHighlightExperiment(row.model);
```

#### 3. Batch Filtering with Helper Function

```typescript
import { filterBlockedExperiments } from '../config/blockedExperiments';

// Filter an array of experiments
const filtered = filterBlockedExperiments(
  experiments,
  (exp) => exp.experiment_tracker,
  (exp) => exp.name  // optional
);
```

### Configuration

Edit `blockedExperiments.ts` to add or remove blocked experiments:

#### Block by Exact ID

```typescript
export const BLOCKED_EXPERIMENT_IDS: string[] = [
  '10837201-7f10-40b2-bae0-5d3ac0642ff6', // Incept experiment
  'your-experiment-id-here',              // Add more IDs
];
```

#### Block by Name Pattern

```typescript
export const BLOCKED_EXPERIMENT_PATTERNS: string[] = [
  'incept',
  'test',     // Block all experiments with "test" in the name
  'demo',     // Block all experiments with "demo" in the name
  'sandbox',  // Block all experiments with "sandbox" in the name
];
```

### Implementation Details

- **Case-insensitive matching**: All comparisons are done in lowercase
- **Partial matching**: Patterns match if they appear anywhere in the experiment name or tracker
- **Multiple criteria**: An experiment is blocked if it matches ANY pattern or ID
- **Separate highlighting logic**: The `shouldHighlightExperiment` function is independent from blocking, allowing experiments to be highlighted without being filtered out

### Current Usage

- **Evaluations page** (`src/pages/Evaluations.tsx`): Uses `isExperimentBlocked()` to filter experiments from the dropdown
- **Benchmarks page** (`src/pages/Benchmarks.tsx`): Uses `shouldHighlightExperiment()` to apply special styling to certain experiments (they are NOT filtered out)

### Adding New Configuration Options

To add new configuration options, extend the `blockedExperiments.ts` file with:

1. New constants for your configuration
2. Helper functions to check against your configuration
3. Update this README with usage examples

