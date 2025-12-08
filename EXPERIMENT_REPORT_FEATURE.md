# Experiment Report Feature Implementation

## Overview
This document describes the implementation of the experiment report feature that displays detailed metrics and latency data when clicking on an experiment from the leaderboard page.

## Changes Made

### 1. Database Queries (`services/queries.ts`)

Added two new SQL queries to fetch experiment-specific data:

#### `EXPERIMENT_REPORT`
- **Purpose**: Fetches detailed experiment metrics grouped by difficulty level
- **Parameters**:
  - `$1`: experiment_tracker (required) - the experiment identifier
  - `$2`: subject (optional) - filter by subject
  - `$3`: grade_level (optional) - filter by grade level
  - `$4`: question_type (optional) - filter by question type
- **Returns**: Rows grouped by difficulty with:
  - Question counts (total, above threshold, success percentage)
  - Latency metrics (TTFT and Total Generation Time with P10, P50, P90, P95 percentiles)
  - Quality metrics (avg, median, min, max evaluator scores)
  - Metadata (timestamps)

#### `EXPERIMENT_SUMMARY`
- **Purpose**: Fetches high-level experiment statistics (aggregated, not grouped by difficulty)
- **Parameters**: Same as EXPERIMENT_REPORT
- **Returns**: Single row with:
  - Overall counts (total questions, recipes, success rate)
  - Experiment metadata (prompt_id, temperature, provider, method)
  - Overall latency metrics (averages)
  - Quality metrics

### 2. Leaderboard Integration (`src/pages/Benchmarks.tsx`)

Updated the experiment row click handler to pass filters as URL parameters:

```typescript
onClick={() => {
  const params = new URLSearchParams({
    model: encodeURIComponent(row.model),
    subject: selectedSubject,
    ...(gradeLevel && { grade_level: gradeLevel }),
    ...(questionType && { question_type: questionType }),
  });
  navigate(`/evaluations?${params.toString()}`);
}}
```

When clicking an experiment, the user is navigated to `/evaluations` with pre-filled filters.

### 3. Evaluations Page Updates (`src/pages/Evaluations.tsx`)

Major updates to support experiment reports:

#### A. New TypeScript Interfaces
- `ExperimentReportRow`: Type definition for detailed experiment data by difficulty
- `ExperimentSummary`: Type definition for overall experiment statistics

#### B. State Management
- Read experiment and filters from URL params (`model`, `subject`, `grade_level`, `question_type`)
- Added API data states (`experimentReport`, `experimentSummary`, `isLoading`, `error`)
- Automatic data fetching when experiment or filters change

#### C. Data Fetching
- Fetches from `/api/experiment-report` and `/api/experiment-summary` endpoints
- Falls back to mock data if API is not available (for development)
- Displays loading states and error messages

#### D. UI Enhancements

**Applied Filters Display**:
- Visual chips showing active filters (Experiment, Subject, Grade, Question Type)
- Color-coded for easy identification

**Statistics Calculation**:
- Uses real data from API when available
- Falls back to mock data calculations
- Shows overall stats and breakdown by difficulty

**Latency Report (`CompactLatencyTable`)**:
- Updated to accept real data from experiment report
- Displays P10, Median (if available), and P90 percentiles
- Shows TTFT (Time To First Token) and Total Generation Time
- Converts milliseconds to seconds for readability
- Falls back to mock data if no real data available

**Loading & Error States**:
- Shows loading spinner while fetching data
- Displays error messages if fetch fails
- Hides content sections during loading

## Data Flow

```
Leaderboard (Benchmarks.tsx)
    ↓ (User clicks experiment row)
    ↓ (Passes: model, subject, grade_level, question_type as URL params)
    ↓
Evaluations Page
    ↓ (Reads URL params)
    ↓ (Calls API endpoints)
    ↓
Backend (needs implementation)
    ↓ (Executes EXPERIMENT_REPORT and EXPERIMENT_SUMMARY queries)
    ↓ (Returns JSON data)
    ↓
Evaluations Page
    ↓ (Displays experiment statistics)
    ↓ (Shows latency metrics by difficulty)
    └ (Renders performance breakdown)
```

## Backend Requirements

To complete this feature, the backend needs to implement two endpoints:

### 1. `/api/experiment-report`
**Query Parameters**:
- `experiment_tracker` (required)
- `subject` (optional)
- `grade_level` (optional)
- `question_type` (optional)

**Implementation**:
```typescript
// Example pseudo-code
app.get('/api/experiment-report', async (req, res) => {
  const { experiment_tracker, subject, grade_level, question_type } = req.query;
  
  const result = await db.query(EXPERIMENT_REPORT, [
    experiment_tracker,
    subject || null,
    grade_level || null,
    question_type || null,
  ]);
  
  res.json(result.rows);
});
```

### 2. `/api/experiment-summary`
**Query Parameters**: Same as above

**Implementation**: Similar pattern, executes `EXPERIMENT_SUMMARY` query

## Latency Metrics Extraction

The queries extract latency metrics from the `inference_params` JSONB field:

```sql
-- TTFT (Time To First Token)
gq.inference_params->'item_inference_params'->>'ttft_ms'

-- Total Generation Time
gq.inference_params->'item_inference_params'->>'total_generation_time_ms'
```

Example `inference_params` structure:
```json
{
  "item_inference_params": {
    "ttft_ms": 8915.702104568481,
    "total_generation_time_ms": 10562.530994415283,
    "temperature": 0.7,
    "prompt_id": "gen_mcq_math_blueprint_v1_cot_reasoning_rag"
  },
  "run_metadata": {
    "provider": "fireworks",
    "method": "blitz_forge_rag",
    "model": "accounts/fireworks/models/gpt-oss-120b"
  }
}
```

## Performance Considerations

With 1-2k records per experiment:
- **EXPERIMENT_REPORT query**: Expected ~50-200ms
- **EXPERIMENT_SUMMARY query**: Expected ~30-100ms

Both queries are optimized with:
- Indexed `experiment_tracker` column
- Efficient JSON extraction
- Single pass aggregations with percentile calculations

## Testing

1. Navigate to the Benchmarks page
2. Apply filters (subject, grade level, question type)
3. Click on any experiment row
4. Verify:
   - URL contains correct query params
   - Filters are displayed as chips at the top
   - Loading state appears briefly
   - Statistics are displayed correctly
   - Latency report shows data by difficulty (Easy, Medium, Hard)
   - Mock data is shown if API is not available

## Future Enhancements

1. **Individual Question Scores**: Fetch detailed question-level data for score distribution plot
2. **Drill-down**: Click on difficulty level to see individual questions
3. **Export**: Download experiment report as CSV/PDF
4. ~~**Comparison**: Compare up to 4 experiments side-by-side~~ ✅ **IMPLEMENTED** (See Compare Reports Feature below)
5. ~~**Caching**: Cache up to 4 recent experiment reports for faster loading~~ ✅ **IMPLEMENTED**
6. **Materialized View**: Create pre-aggregated experiment stats for even faster queries

---

## Compare Reports Feature

### Overview
A new comparison feature has been added that allows users to compare up to 3 cached experiment reports side-by-side. The comparison includes:
- Latency metrics (TTFT and Total Generation Time)
- Performance across difficulties
- Evaluator scores distribution plots

### Implementation Details

#### New Page: `/compare`
- **Route**: `src/pages/CompareReports.tsx`
- **Navigation**: Added to sidebar with GitCompare icon
- **Cache Management**: Uses localStorage with a maximum of 4 cached reports

#### Features

1. **Cache Selection Interface**
   - Displays all cached experiment reports (max 4)
   - Shows experiment metadata: tracker ID, subject, grade level, question type, and timestamp
   - Visual selection indicator with colored borders
   - Delete button for removing unwanted cached reports

2. **Latency Comparison**
   - Side-by-side comparison of Time to First Token (TTFT)
   - Side-by-side comparison of Total Generation Time
   - Shows P50 (median) and P90 percentiles for each difficulty level
   - All times converted from milliseconds to seconds for readability

3. **Performance Across Difficulties**
   - Success rate percentage for each report at Easy, Medium, and Hard levels
   - Color-coded success rates (green ≥90%, yellow ≥70%, red <70%)
   - Question counts (above threshold / total)

4. **Evaluator Scores Distribution**
   - Bar charts showing score distribution (0-10) for each report
   - Separate visualizations for Easy, Medium, and Hard difficulties
   - Average score displayed for each report and difficulty
   - Interactive hover tooltips showing exact counts

### User Flow

1. User visits Evaluations page and views experiment reports
2. Reports are automatically cached (up to 3 most recent)
3. User navigates to Compare page via sidebar
4. User selects 2-3 reports to compare
5. Comparison tables and charts are displayed
6. User can delete unwanted cached reports

### Technical Details

- **Cache Storage**: localStorage with key `experiment_reports_cache`
- **Max Cached Items**: 4 reports (configurable via `MAX_CACHE_ITEMS`)
- **Max Compare Items**: 4 reports (configurable via `MAX_COMPARE_ITEMS`)
- **Cache Data Structure**: Includes `reportData`, `summaryData`, and `scoresData`
- **Automatic Cleanup**: Old/invalid cache entries are filtered on load

### UI/UX Enhancements

- Modern gradient-based selection highlighting
- Responsive layout with overflow handling
- Color-coded performance indicators
- Hover effects and tooltips
- Empty states with helpful guidance
- Delete confirmation via hover state change






