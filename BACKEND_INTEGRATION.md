# Backend Integration Guide - Attachment Filtered View

## Overview

This guide explains how to update your backend API to support the attachment-filtered leaderboard view mode.

## Changes Required

The backend needs to handle the `view_mode` query parameter and select the appropriate SQL query based on the mode.

## Implementation

### Option 1: Node.js/Express Backend

```typescript
import { 
  LEADERBOARD_MV_2_0_0, 
  LEADERBOARD_MV_2_0_0_ATTACHMENT_FILTERED 
} from './services/queries';

app.get('/api/leaderboard', async (req, res) => {
  try {
    const { 
      subject, 
      evaluator_version, 
      view_mode,
      grade_level, 
      question_type, 
      min_total_questions 
    } = req.query;
    
    // Validate required parameters
    if (!subject) {
      return res.status(400).json({ error: 'Subject is required' });
    }
    
    // Select the appropriate query based on view_mode
    let query;
    if (view_mode === 'attachment_filtered') {
      query = LEADERBOARD_MV_2_0_0_ATTACHMENT_FILTERED;
      console.log('[API] Using attachment-filtered view (149 blocked standards excluded)');
    } else {
      query = LEADERBOARD_MV_2_0_0;
      console.log('[API] Using standard view (all data)');
    }
    
    // Execute query with parameters
    const result = await db.query(query, [
      subject,
      grade_level || null,
      question_type || null,
      min_total_questions ? parseInt(min_total_questions, 10) : null
    ]);
    
    console.log(`[API] Returned ${result.rows.length} leaderboard rows`);
    res.json(result.rows);
    
  } catch (error) {
    console.error('[API] Error fetching leaderboard:', error);
    res.status(500).json({ 
      error: 'Failed to fetch leaderboard data',
      message: error.message 
    });
  }
});
```

### Option 2: Python/Flask Backend

```python
from services.queries import (
    LEADERBOARD_MV_2_0_0,
    LEADERBOARD_MV_2_0_0_ATTACHMENT_FILTERED
)

@app.route('/api/leaderboard', methods=['GET'])
def get_leaderboard():
    try:
        subject = request.args.get('subject')
        evaluator_version = request.args.get('evaluator_version', '2.0.0')
        view_mode = request.args.get('view_mode', 'all')
        grade_level = request.args.get('grade_level')
        question_type = request.args.get('question_type')
        min_total_questions = request.args.get('min_total_questions')
        
        # Validate required parameters
        if not subject:
            return jsonify({'error': 'Subject is required'}), 400
        
        # Select the appropriate query based on view_mode
        if view_mode == 'attachment_filtered':
            query = LEADERBOARD_MV_2_0_0_ATTACHMENT_FILTERED
            print('[API] Using attachment-filtered view (149 blocked standards excluded)')
        else:
            query = LEADERBOARD_MV_2_0_0
            print('[API] Using standard view (all data)')
        
        # Execute query with parameters
        params = [
            subject,
            grade_level or None,
            question_type or None,
            int(min_total_questions) if min_total_questions else None
        ]
        
        cursor = db.cursor()
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        # Convert to list of dicts (adjust based on your DB library)
        columns = [desc[0] for desc in cursor.description]
        results = [dict(zip(columns, row)) for row in rows]
        
        print(f'[API] Returned {len(results)} leaderboard rows')
        return jsonify(results)
        
    except Exception as e:
        print(f'[API] Error fetching leaderboard: {str(e)}')
        return jsonify({
            'error': 'Failed to fetch leaderboard data',
            'message': str(e)
        }), 500
```

### Option 3: Generic SQL Approach

If you're using a different backend framework, here's the general approach:

1. **Import the queries** from `services/queries.ts` or `services/queries.py`

2. **Check the view_mode parameter**:
   - If `view_mode === 'attachment_filtered'`, use `LEADERBOARD_MV_2_0_0_ATTACHMENT_FILTERED`
   - Otherwise, use `LEADERBOARD_MV_2_0_0` (default)

3. **Execute the selected query** with these parameters:
   - `$1`: subject (required) - e.g., 'ela' or 'math'
   - `$2`: grade_level (optional) - e.g., '3', '4', or NULL
   - `$3`: question_type (optional) - e.g., 'mcq', 'fill-in', or NULL
   - `$4`: min_total_questions (optional) - integer or NULL

## Query Parameters

### Required
- `subject`: The subject to filter by (e.g., 'ela', 'math')

### Optional
- `view_mode`: 
  - `'all'` (default) - Uses regular view with all data
  - `'attachment_filtered'` - Uses filtered view excluding blocked standards
- `evaluator_version`: The evaluator version (should be '2.0.0')
- `grade_level`: Filter by specific grade (e.g., '3', '4')
- `question_type`: Filter by question type (e.g., 'mcq', 'fill-in')
- `min_total_questions`: Minimum number of total questions threshold

## Example API Requests

### Get All Data for ELA
```bash
GET /api/leaderboard?subject=ela&evaluator_version=2.0.0&view_mode=all
```

### Get Filtered Data for ELA (Blocked Standards Excluded)
```bash
GET /api/leaderboard?subject=ela&evaluator_version=2.0.0&view_mode=attachment_filtered
```

### Get Filtered Math Data for Grade 3, MCQ Only
```bash
GET /api/leaderboard?subject=math&evaluator_version=2.0.0&view_mode=attachment_filtered&grade_level=3&question_type=mcq
```

### Get Filtered ELA Data with Minimum 60 Questions
```bash
GET /api/leaderboard?subject=ela&evaluator_version=2.0.0&view_mode=attachment_filtered&min_total_questions=60
```

## Response Format

Both queries return the same structure:

```json
[
  {
    "model": "gpt-4",
    "experiment_tracker": "exp_2024_01_15_v1",
    "subject": "Ela",
    "grade_level": "3",
    "question_type": "mcq",
    "difficulty": "Easy",
    "questions_above_threshold": 85,
    "total_questions": 100,
    "percentage": 85.0,
    "last_updated": "2024-01-15T10:30:00Z"
  },
  ...
]
```

The only difference is the data content - the filtered view will have:
- Fewer total_questions (blocked standards excluded)
- Different percentages (calculated on remaining standards only)

## Testing

### 1. Verify Materialized View Exists

```sql
SELECT COUNT(*) FROM mv_leaderboard_stats_2_0_0_attachment_filtered;
```

If this returns an error, the materialized view hasn't been created yet. Run the SQL script:

```bash
psql -U your_username -d your_database -f src/materialized_view_attachment_filtered.sql
```

### 2. Compare Results

Test both views to see the difference:

```bash
# Regular view
curl "http://localhost:3000/api/leaderboard?subject=ela&view_mode=all"

# Filtered view
curl "http://localhost:3000/api/leaderboard?subject=ela&view_mode=attachment_filtered"
```

The filtered view should return:
- Same experiments
- Lower total_questions counts
- Different percentages

### 3. Verify Filtering is Working

Check that blocked standards are excluded:

```sql
-- This should return 0 rows (blocked standards excluded)
SELECT * FROM mv_leaderboard_stats_2_0_0_attachment_filtered AS lf
JOIN question_recipes AS qr 
  ON lf.grade_level = qr.grade_level 
  AND lf.subject = qr.subject
WHERE qr.standard_id_l1 IN ('3-AA.1', '3-AA.2', '3-AA.3');
```

## Logging

Add logging to help debug and monitor usage:

```typescript
// Log view mode selection
console.log(`[Leaderboard API] View mode: ${view_mode || 'all'}`);

// Log result counts
console.log(`[Leaderboard API] Returned ${results.length} rows`);

// Log when using filtered view
if (view_mode === 'attachment_filtered') {
  console.log('[Leaderboard API] Using filtered view - 149 blocked standards excluded');
}
```

## Error Handling

Handle common errors:

```typescript
try {
  // Query execution
} catch (error) {
  // Check for specific errors
  if (error.message.includes('does not exist')) {
    return res.status(500).json({
      error: 'Materialized view not found',
      message: 'The attachment-filtered materialized view has not been created. Please run the SQL setup script.',
      view_mode: view_mode
    });
  }
  
  // Generic error
  return res.status(500).json({
    error: 'Database query failed',
    message: error.message
  });
}
```

## Performance Considerations

1. **Materialized View Refresh**: The filtered view should be refreshed at the same schedule as the regular view
   
2. **Index Usage**: Verify indexes are being used:
   ```sql
   EXPLAIN ANALYZE
   SELECT * FROM mv_leaderboard_stats_2_0_0_attachment_filtered
   WHERE subject = 'ela';
   ```

3. **Caching**: Consider caching API responses for both view modes separately:
   ```typescript
   const cacheKey = `leaderboard:${subject}:${view_mode}:${grade_level}:${question_type}`;
   ```

## Migration Checklist

- [ ] Import new query constant `LEADERBOARD_MV_2_0_0_ATTACHMENT_FILTERED`
- [ ] Add `view_mode` parameter handling in API endpoint
- [ ] Add conditional query selection logic
- [ ] Test with `view_mode=all` (should work as before)
- [ ] Test with `view_mode=attachment_filtered` (should return filtered results)
- [ ] Add error handling for missing materialized view
- [ ] Add logging for view mode usage
- [ ] Update API documentation
- [ ] Deploy backend changes
- [ ] Verify materialized view is created in production database
- [ ] Set up refresh schedule for the new materialized view

## Rollback Plan

If issues occur:

1. **Frontend rollback**: Comment out the view mode dropdown in `Benchmarks.tsx`
2. **Backend rollback**: Default all requests to `view_mode=all`
3. **Database rollback**: The original view remains unchanged, so no rollback needed

## Support

If you encounter issues:

1. Check materialized view exists: 
   ```sql
   \d mv_leaderboard_stats_2_0_0_attachment_filtered
   ```

2. Check materialized view has data:
   ```sql
   SELECT COUNT(*) FROM mv_leaderboard_stats_2_0_0_attachment_filtered;
   ```

3. Verify blocked standards list matches your database:
   ```sql
   SELECT COUNT(DISTINCT standard_id_l1) 
   FROM question_recipes 
   WHERE standard_id_l1 IN ('3-AA.1', '3-AA.2', ...);
   ```

4. Check backend logs for query execution and errors

5. Test queries directly in database:
   ```sql
   -- Use the exact query from queries.ts with test parameters
   SELECT * FROM mv_leaderboard_stats_2_0_0_attachment_filtered
   WHERE subject = 'ela' LIMIT 10;
   ```









