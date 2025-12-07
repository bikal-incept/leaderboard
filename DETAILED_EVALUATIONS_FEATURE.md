# Detailed Evaluations Feature

## Overview
Added a three-section view to the **Fetch Evaluations page (LookAtData.tsx)** that displays fetched evaluations split into three categories: Zero Scores, Below Threshold, and Passed. Each entry shows Recipe ID and Question ID with buttons to view detailed information in modals.

## Changes Made

### 1. Updated `src/pages/LookAtData.tsx`

#### Added Icons
- `Eye` - for viewing model responses
- `Code` - for viewing prompts
- `MessageSquare` - for viewing evaluator feedback
- `X` - for closing modal

#### Updated Type
```typescript
type EvaluationData = {
  question_id: number;
  recipe_id: number; // ADDED
  model_parsed_response: any;
  prompt_text: string;
  evaluator_parsed_response: any;
  evaluator_score: number;
  difficulty: string;
  experiment_tracker: string;
  model: string;
  subject: string;
  grade_level: string;
  question_type: string;
  created_at: string;
  evaluated_at: string;
}
```

#### Added State Variables
- `selectedSection` - currently selected tab ('zero' | 'below' | 'passed')
- `modalContent` - stores modal data and type for the new modal system

#### Replaced Display Logic
The old card-based display has been replaced with a three-section tabbed view. When evaluations are fetched and displayed (`showEvaluations && !evaluationsLoading`), the data is now organized into three tabs.

#### Added UI Components

##### Three-Section Tabs
- **Zero Scores**: Shows evaluations with score = 0
- **Below Threshold**: Shows evaluations with 0 < score < 0.85
- **Passed**: Shows evaluations with score >= 0.85

##### Data Table
Displays for each evaluation:
- Recipe ID
- Question ID
- Score (colored based on value)
- Difficulty (with colored badge)
- Action buttons:
  - **Response**: View model parsed response
  - **Prompt**: View prompt text
  - **Feedback**: View evaluator parsed response

##### New Modal Component
Replaces the old `EvaluationModal`:
- Simpler, focused on showing raw data (response/prompt/feedback)
- Dynamic title and icon based on content type
- Displays JSON or text content formatted with syntax highlighting
- Close button with hover effects
- Click outside to close

### 2. Removed from `src/pages/Evaluations.tsx`

The detailed evaluations section was initially added to the Experiment Report page by mistake. It has been removed from there since it belongs in the Fetch Evaluations page (LookAtData.tsx).

### 3. Updated `services/queries.ts`

#### Modified FETCH_EVALUATIONS Query
- Added `recipe_id` to SELECT clause
- Increased LIMIT from 100 to 500 to show more results

## API Endpoint

The feature uses the existing `/api/evaluations` endpoint in the Fetch Evaluations page that:

### Parameters (Query String)
- `experiment_tracker` (required)
- `subject` (required)
- `grade_level` (optional)
- `question_type` (optional)
- `difficulty` (optional)
- `max_score` (optional)

### Returns
Array of objects with fields:
```typescript
{
  question_id: number;
  recipe_id: number;
  model_parsed_response: any;
  prompt_text: string;
  evaluator_parsed_response: any;
  evaluator_score: number;
  difficulty: string;
}
```

### Example API Implementation
```typescript
import { FETCH_EVALUATIONS } from '../services/queries';
import { query } from '../services/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  
  const experiment_tracker = searchParams.get('experiment_tracker');
  const subject = searchParams.get('subject');
  const grade_level = searchParams.get('grade_level');
  const question_type = searchParams.get('question_type');
  
  if (!experiment_tracker || !subject) {
    return new Response('Missing required parameters', { status: 400 });
  }
  
  const result = await query(FETCH_EVALUATIONS, [
    experiment_tracker,
    subject,
    null, // difficulty
    null, // max_score
    grade_level || null,
    question_type || null,
  ]);
  
  return new Response(JSON.stringify(result.rows), {
    headers: { 'Content-Type': 'application/json' },
  });
}
```

## UI Features

### Visual Design
- Color-coded scores:
  - Green: Passed (≥0.85)
  - Orange: Below threshold (>0 and <0.85)
  - Red: Zero scores (=0)
- Difficulty badges with appropriate colors
- Smooth hover effects on table rows and buttons
- Responsive button styling with icon + text

### User Interaction
1. User selects an experiment and applies filters
2. Three tabs appear showing count of evaluations in each category
3. Clicking a tab shows a table of evaluations for that category
4. Clicking any action button opens a modal with formatted content
5. Modal can be closed by clicking the X button or clicking outside

### Performance Optimizations
- Separate loading state for detailed evaluations
- Data filtered on client side for instant tab switching
- Limit of 500 evaluations to prevent performance issues
- Lazy evaluation with useEffect dependencies

## Testing

To test this feature:

1. Navigate to the **Fetch Evaluations page** (LookAtData.tsx / "Data" in nav)
2. Enter an experiment tracker
3. Select subject, grade, type, difficulty, and max score filters
4. Click "Fetch Evaluations"
5. After data loads, you'll see three tabs:
   - **Zero Scores** (red) - evaluations with score = 0
   - **Below Threshold** (orange) - evaluations with 0 < score < 0.85
   - **Passed** (green) - evaluations with score >= 0.85
6. Click on each tab to see different score categories
7. Click action buttons to view:
   - **Response** - Model Response (JSON formatted)
   - **Prompt** - Prompt Text (plain text or JSON)
   - **Feedback** - Evaluator Feedback (JSON formatted)
8. Verify modal opens/closes correctly
9. Check that scores and difficulties are color-coded properly
10. Verify tab counts match the data

## Future Enhancements

- Add pagination for large datasets (>500 items)
- Add sorting by recipe_id, question_id, or score
- Add search/filter within each section
- Add export to CSV functionality
- Add comparison view between different evaluations
- Cache detailed evaluations similar to experiment reports

