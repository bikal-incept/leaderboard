# Evaluations Feature

## Overview
Added a new "Evaluations" section to the Benchmarks page focused on studying failed evaluations. This tool helps you analyze questions that didn't meet the quality threshold, track zero-score data points, and understand why samples failed.

## Browser Cache for Experiment Reports

### Overview
The Experiments page (Evaluations.tsx) now includes a browser cache feature that stores recently viewed experiment reports for quick access. This is separate from the evaluations feature on the Benchmarks page.

## Changes Made

### 1. Database Query (`services/queries.ts`)
- Added `FETCH_EVALUATIONS` query that:
  - Joins `generated_questions`, `ai_evaluation_results`, and `question_recipes` tables
  - Fetches `model_parsed_response`, `prompt_text`, and `evaluator_parsed_response`
  - Filters by:
    - `experiment_tracker` (required)
    - `subject` (required)
    - `difficulty` (optional: Easy/Medium/Hard)
    - `max_score` (optional: maximum evaluator score threshold, default 0.85)
    - `grade_level` (optional)
    - `question_type` (optional)
  - Orders by evaluator score (ascending) and creation date (descending)
  - Limits results to 100 items (increased from 50 for better analysis)

### 2. Backend API Endpoint (`vite.config.ts`)
- Added `/api/evaluations` endpoint that:
  - Accepts GET requests with query parameters
  - Validates required parameters (experiment_tracker, subject)
  - Executes the FETCH_EVALUATIONS query
  - Returns JSON array of evaluation data

### 3. Frontend UI (`src/pages/Benchmarks.tsx`)

#### State Management
- Added evaluation-specific state variables:
  - `evaluations`: Array of fetched evaluation data
  - `evaluationsLoading`: Loading state
  - `evaluationsError`: Error messages
  - `evalExperimentTracker`: Experiment tracker filter
  - `evalDifficulty`: Difficulty filter
  - `evalMaxScore`: Maximum score threshold filter
  - `showEvaluations`: Toggle to show/hide results

#### Filters Section
- **Experiment Tracker** (required): Text input for experiment identifier
- **Difficulty**: Dropdown with options (All/Easy/Medium/Hard)
- **Max Score Threshold**: Number input for score filtering (default: 0.85)
- Inherits existing page filters: Grade Level and Question Type

#### Fetch Button
- "Fetch Evaluations" button with Search icon
- Triggers API call when clicked
- Shows loading state during fetch
- Validates that experiment tracker is provided

#### Evaluation Display
- Shows count of fetched evaluations
- Displays evaluations as expandable cards

### 4. EvaluationCard Component (Collapsed List View)
Displays evaluations in a compact, scannable format:

#### Collapsed View (Default)
- **Question Preview**: One-line preview of the question text
- **Metadata**: Type, difficulty, and question ID
- **Score**: Large, color-coded score display
  - Red for 0 scores and <0.85
  - Yellow for 0.85-0.89
  - Green for ≥0.9
- **Recommendation Badge**: Accept/Revise/Reject
- **Issue Count**: Shows number of issues found
- **Zero Score Highlight**: Questions with 0 scores have red background and "⚠️ ZERO SCORE" warning
- **Click to expand**: "View →" indicator

#### Summary Statistics
Above the list, shows:
- Total evaluations found
- Number of zero scores (red)
- Number below threshold (yellow)

### 5. EvaluationModal Component (Detail View)
Opens when clicking an evaluation card:

#### Modal Header
- Question title and metadata
- Current score
- Close button

#### Score Banner
- Large score display with color coding
- Recommendation status

#### Prompt Section
- Full prompt text that was sent to the model
- Monospace font for readability
- Scrollable if long
- Shows exactly what the model received

#### Generated Question Section
- Complete question text
- Answer options grid (for MCQ)
- Correct answer highlighted in green
- Answer explanation

#### Evaluator Feedback Section
- **Issues Found**: Listed with red ✗ indicator and count
- **Suggested Improvements**: Listed with yellow → indicator and count
- **Strengths**: Listed with green ✓ indicator and count

#### Styling Features
- Full-screen overlay with backdrop
- Scrollable content
- Sticky header
- Click outside to close
- Keyboard-friendly (ESC to close would be a nice addition)

## Data Structure

### model_parsed_response
Contains the generated question details:
```json
{
  "id": "question_id",
  "type": "mcq",
  "question": "Question text",
  "answer": "A",
  "answer_options": {
    "A": "Option A text",
    "B": "Option B text",
    ...
  },
  "difficulty": "hard",
  "answer_explanation": "Explanation text",
  "reasoning_steps": "Step-by-step reasoning"
}
```

### evaluator_parsed_response
Contains the evaluation results:
```json
{
  "evaluations": {
    "question_id": {
      "score": 0.911,
      "ti_question_qa": {
        "overall": 0.911,
        "recommendation": "accept",
        "strengths": ["Strength 1", "Strength 2"],
        "issues": ["Issue 1"],
        "suggested_improvements": ["Improvement 1"]
      }
    }
  }
}
```

### What Gets Cached
Each cached report stores the **complete data**, not just filters:
- **Filter Values**: experiment_tracker, subject, grade_level, question_type
- **Report Data**: All experiment report rows (by difficulty)
- **Summary Data**: Overall statistics and metadata
- **Scores Data**: Individual scores for distribution plot
- **Timestamp**: When the report was fetched

### Instant Loading ⚡
- Clicking a cached report loads **instantly** from localStorage
- **No API request** is made - data is already stored
- Loading state is completely skipped
- Much faster than re-fetching from database

### Technical Implementation
- Uses `useRef` for synchronous loading flag (not state)
- Prevents race conditions with URL sync and data-fetching effects
- Sets flag before any state updates to block API calls
- Both URL sync and data fetch check the flag and skip if loading from cache

### Cache Key Format
Each cached report is identified by:
- **EXPERIMENT**: experiment_tracker value
- **SUBJECT**: subject (math/ela)  
- **GRADE**: grade_level
- **TYPE**: question_type (MCQ/fill-in)

### Location
The cache dropdown appears at the top of the Experiments page, just below the page header and above the experiment selector.

### UI Components

#### Recent Reports Dropdown
- Appears above filters when cache has items
- Shows count of cached reports
- Click to expand/collapse
- Dropdown closes when clicking outside

#### Cached Report Items
Each cached report displays:
- **EXPERIMENT**: The experiment tracker
- **SUBJECT, GRADE, TYPE, DIFFICULTY**: All filter values (shows "All" if not set)
- **Timestamp**: When the report was fetched
- **Delete button**: Red trash icon to remove from cache

#### Actions
- **Load from cache**: Click any cached item to **instantly** load the report with all data (no API call)
- **Delete**: Click the trash icon to remove a specific cached report
- **Auto-save**: Successfully fetched reports are automatically saved to cache with all their data

### Cache Management Functions
- `loadCache()`: Loads all cached reports from localStorage
- `saveToCache()`: Saves a new report to cache (max 10 items)
- `deleteFromCache()`: Removes a specific report by cache key
- `getCacheKey()`: Generates unique key from filter values

## Usage

### Basic Workflow
1. Navigate to the Benchmarks page
2. Scroll down to the "Evaluations" section
3. Enter an experiment tracker (e.g., "gpt-oss-120b-ft-1-5-k-fair-rag")
4. Optionally set:
   - Difficulty filter (Easy/Medium/Hard/All)
   - Max score threshold (default: 0.85 to show failed questions)
5. Click "Fetch Evaluations"
6. Review the summary statistics:
   - Total evaluations
   - Zero scores (critical failures)
   - Below threshold count
7. Browse the collapsed list:
   - Zero-score questions highlighted in red
   - Preview question text and metadata
   - See issue count at a glance
8. Click any evaluation to open detailed modal with:
   - Full prompt text
   - Complete question and options
   - All evaluator feedback
   - Issues and improvement suggestions

### Using Cache
1. After fetching a report, it's automatically saved to cache
2. On subsequent visits, see "Recent Reports" dropdown
3. Click the dropdown to view cached reports
4. Click any cached report to auto-fill all filters
5. Click the trash icon to delete unwanted cached reports
6. Maximum 10 reports are cached (oldest are removed automatically)

## Benefits

- **Failure Analysis**: Specifically designed to study failed questions (below threshold)
- **Zero Score Tracking**: Instantly identify and analyze questions that scored 0
- **Prompt Visibility**: See the exact prompt that was sent to the model
- **Collapsed by Default**: Start with a scannable list, expand for details
- **Quick Scanning**: See issue counts and scores at a glance
- **Modal Deep Dive**: Click to see complete question, prompt, and evaluation in one view
- **Color-Coded Severity**: Red for zero scores, yellow for below threshold, green for passed
- **Pattern Recognition**: View multiple failed questions to identify common issues
- **Efficient Workflow**: Quickly move through many evaluations without page clutter
- **Flexible Filtering**: Combine multiple filters to narrow down to specific problem areas
- **Smart Caching**: Automatically saves complete report data (not just filters) for instant access
- **Instant Loading**: Cached reports load immediately without any API calls
- **One-Click Restore**: Load previous reports with all their data in a single click
- **Cache Management**: Easy deletion of unwanted cached reports
- **Persistent Storage**: Cache survives browser refreshes and returns later (stores up to 10 reports)
- **Clean Data Display**: Only shows numbers when data exists, no default/null values rendered
- **Graceful Error Handling**: Missing latency data is handled appropriately with "No latency data available" message

## Data Display Improvements

### Null/Missing Data Handling
- **Latency Tables**: Now check if latency data exists before rendering. Shows "No latency data available" if missing.
- **Overview Stats**: Components that don't have valid data are not rendered (returns null instead of showing "null" or undefined)
- **Safe Number Conversion**: All numeric values are safely converted with null checks to prevent NaN or undefined displays
- **Median Values**: Only shown when available, otherwise hidden completely

### Example Improvements
- **Before**: Would show "NaN s" or "null" for missing latency values
- **After**: Shows "No latency data available" message or hides the stat completely
- **Before**: Would attempt to display default JSON values
- **After**: Only renders components when they have meaningful data to show

## Key Features of the Evaluations Tool

### 1. **Failure-Focused Design**
- Default max score of 0.85 shows only failed questions
- Zero scores prominently highlighted with red background and warning icon
- Summary shows breakdown: total, zero scores, below threshold

### 2. **Collapsed List View**
- All evaluations start collapsed for easy scanning
- See key info at a glance: score, issues count, question preview
- Click any item to open full modal

### 3. **Complete Context in Modal**
- **Prompt Text**: See exactly what was sent to the model
- **Generated Question**: Full question with all options
- **Evaluator Feedback**: Issues, improvements, strengths
- Organized in logical sections for easy reading

### 4. **Visual Indicators**
- Red background for zero-score questions
- Color-coded scores (red/yellow/green)
- Issue counts displayed upfront
- Recommendation badges

### 5. **Increased Limit**
- Fetches up to 100 evaluations (vs 50 previously)
- Better for analyzing patterns across failures
- Still performant due to database indexing

### 6. **Smart Default Threshold**
- Default max_score = 0.85
- Automatically shows failed questions
- Can be adjusted to any threshold (0.0 to 1.0)

