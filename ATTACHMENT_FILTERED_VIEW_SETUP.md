# Attachment Filtered Leaderboard View

## Overview

This feature adds a materialized view that filters out recipes with blocked standards (multimedia-required standards) from the leaderboard reporting. This allows you to view leaderboard statistics for only the standards that can be generated via text-only prompts, excluding those requiring visual aids like charts, diagrams, maps, or timelines.

## What's Blocked?

The attachment-filtered view excludes **149 blocked standards** across grades 3-8 that require:
- Charts and graphs
- Diagrams and timelines
- Maps and visual representations
- Other multimedia attachments

These standards are defined in `src/config/blockedStandards.ts` under `VISUAL_AIDS_STANDARDS`.

## Database Setup

### 1. Create the Materialized View

Run the SQL script to create the materialized view:

```bash
psql -U your_username -d your_database -f src/materialized_view_attachment_filtered.sql
```

Or manually execute the SQL from the file:

```sql
-- See src/materialized_view_attachment_filtered.sql for the full script
CREATE MATERIALIZED VIEW mv_leaderboard_stats_2_0_0_attachment_filtered AS
SELECT
  gq.model,
  gq.experiment_tracker,
  qr.subject,
  qr.grade_level,
  gq.question_type,
  COALESCE(...) AS difficulty,
  COUNT(DISTINCT CASE WHEN aer.evaluator_score >= 0.85 THEN gq.id END) AS questions_above_threshold,
  COUNT(DISTINCT gq.id) AS total_questions,
  ROUND(...) AS percentage,
  MAX(aer.evaluated_at) AS last_updated
FROM public.generated_questions AS gq
JOIN public.ai_evaluation_results AS aer ON aer.question_id = gq.id
JOIN public.question_recipes AS qr ON gq.recipe_id = qr.recipe_id
WHERE aer.evaluator_version = '2.0.0'
  AND qr.standard_id_l1 NOT IN (
    -- List of 149 blocked standards
    ...
  )
GROUP BY ...;
```

### 2. Create Indexes

The script automatically creates indexes for optimal query performance:

```sql
CREATE INDEX idx_mv_leaderboard_2_0_0_af_subject_grade 
  ON mv_leaderboard_stats_2_0_0_attachment_filtered (subject, grade_level);

CREATE INDEX idx_mv_leaderboard_2_0_0_af_experiment 
  ON mv_leaderboard_stats_2_0_0_attachment_filtered (experiment_tracker);

CREATE INDEX idx_mv_leaderboard_2_0_0_af_difficulty 
  ON mv_leaderboard_stats_2_0_0_attachment_filtered (difficulty);

CREATE INDEX idx_mv_leaderboard_2_0_0_af_question_type 
  ON mv_leaderboard_stats_2_0_0_attachment_filtered (question_type);
```

### 3. Grant Permissions (if needed)

Grant SELECT permissions to your application user:

```sql
GRANT SELECT ON mv_leaderboard_stats_2_0_0_attachment_filtered TO your_app_user;
```

## Refreshing the Materialized View

The materialized view needs to be refreshed periodically to include new evaluation data:

### Manual Refresh

```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_leaderboard_stats_2_0_0_attachment_filtered;
```

**Note:** The `CONCURRENTLY` option allows reads to continue during the refresh, but requires unique indexes to be present (which are automatically created by the script).

### Automated Refresh with Cron

Set up a cron job to refresh the view periodically. For example, to refresh every hour:

```bash
# Add to crontab (crontab -e)
0 * * * * psql -U your_username -d your_database -c "REFRESH MATERIALIZED VIEW CONCURRENTLY mv_leaderboard_stats_2_0_0_attachment_filtered;"
```

Or create a PostgreSQL function with pg_cron:

```sql
-- Install pg_cron extension if not already installed
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule refresh every hour
SELECT cron.schedule(
  'refresh-attachment-filtered-view',
  '0 * * * *',
  'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_leaderboard_stats_2_0_0_attachment_filtered'
);
```

## Backend API Updates

The backend API needs to handle the `view_mode` parameter to switch between queries:

```typescript
// Example backend endpoint (adjust to your actual implementation)
app.get('/api/leaderboard', async (req, res) => {
  const { subject, evaluator_version, view_mode, grade_level, question_type, min_total_questions } = req.query;
  
  // Select the appropriate query based on view_mode
  let query;
  if (view_mode === 'attachment_filtered') {
    query = LEADERBOARD_MV_2_0_0_ATTACHMENT_FILTERED;
  } else {
    query = LEADERBOARD_MV_2_0_0;
  }
  
  // Execute query with parameters
  const result = await db.query(query, [
    subject,
    grade_level || null,
    question_type || null,
    min_total_questions ? parseInt(min_total_questions) : null
  ]);
  
  res.json(result.rows);
});
```

## Using the Feature

### In the UI

1. Navigate to the **Leaderboard** page
2. In the top-right corner, you'll see a **View Mode** dropdown
3. Select between:
   - **All Data (2.0.0 Leaderboard)** - Shows all standards including multimedia-required ones
   - **Attachment Filtered (Blocked Standards Excluded)** - Excludes the 149 blocked standards

When the filtered mode is active, you'll see a badge indicating "149 standards excluded".

### Query Parameters

The API accepts a `view_mode` parameter:

```
GET /api/leaderboard?subject=ela&evaluator_version=2.0.0&view_mode=attachment_filtered
```

Options:
- `view_mode=all` (default) - Uses `mv_leaderboard_stats_2_0_0`
- `view_mode=attachment_filtered` - Uses `mv_leaderboard_stats_2_0_0_attachment_filtered`

## Data Comparison

### Regular View (`mv_leaderboard_stats_2_0_0`)
- Includes all recipes and standards
- Shows complete evaluation coverage
- Higher total question counts

### Filtered View (`mv_leaderboard_stats_2_0_0_attachment_filtered`)
- Excludes 149 multimedia-required standards
- Shows only text-generatable questions
- More accurate representation of text-only capabilities
- Lower total question counts (blocked standards removed)

## Troubleshooting

### View doesn't exist

**Error:** `relation "mv_leaderboard_stats_2_0_0_attachment_filtered" does not exist`

**Solution:** Run the SQL script to create the materialized view:
```bash
psql -U your_username -d your_database -f src/materialized_view_attachment_filtered.sql
```

### No data in filtered view

**Issue:** The filtered view returns no rows or very few rows.

**Possible causes:**
1. The materialized view hasn't been populated yet. Try refreshing it:
   ```sql
   REFRESH MATERIALIZED VIEW mv_leaderboard_stats_2_0_0_attachment_filtered;
   ```

2. The blocked standards list doesn't match the actual `standard_id_l1` values in your database. Check:
   ```sql
   SELECT DISTINCT standard_id_l1 
   FROM question_recipes 
   WHERE standard_id_l1 IN ('3-AA.1', '3-AA.2', ...);
   ```

### Performance issues

If queries are slow:

1. Verify indexes are created:
   ```sql
   SELECT indexname, indexdef 
   FROM pg_indexes 
   WHERE tablename = 'mv_leaderboard_stats_2_0_0_attachment_filtered';
   ```

2. Check materialized view statistics:
   ```sql
   ANALYZE mv_leaderboard_stats_2_0_0_attachment_filtered;
   ```

3. Consider refreshing less frequently if the view is very large

## Maintenance

### Checking View Status

```sql
-- Check last refresh time
SELECT schemaname, matviewname, last_refresh 
FROM pg_matviews 
WHERE matviewname = 'mv_leaderboard_stats_2_0_0_attachment_filtered';

-- Check view size
SELECT pg_size_pretty(pg_total_relation_size('mv_leaderboard_stats_2_0_0_attachment_filtered'));

-- Check row count
SELECT COUNT(*) FROM mv_leaderboard_stats_2_0_0_attachment_filtered;
```

### Updating Blocked Standards

If you need to update the list of blocked standards:

1. Update `src/config/blockedStandards.ts` with the new list
2. Drop and recreate the materialized view:
   ```sql
   DROP MATERIALIZED VIEW IF EXISTS mv_leaderboard_stats_2_0_0_attachment_filtered CASCADE;
   ```
3. Re-run the SQL script to create it with the updated list
4. Refresh the view

## Files Modified/Created

1. **New Files:**
   - `src/materialized_view_attachment_filtered.sql` - SQL script to create the materialized view
   - `ATTACHMENT_FILTERED_VIEW_SETUP.md` - This documentation file

2. **Modified Files:**
   - `services/queries.ts` - Added `LEADERBOARD_MV_2_0_0_ATTACHMENT_FILTERED` query
   - `src/pages/Benchmarks.tsx` - Added view mode dropdown and state management

3. **Existing Files (referenced):**
   - `src/config/blockedStandards.ts` - Contains the list of blocked standards

## Future Enhancements

- Add ability to customize which standards to block via UI
- Show statistics comparing filtered vs unfiltered results
- Add more granular filtering options (e.g., by standard category)
- Create separate views for different types of multimedia requirements

