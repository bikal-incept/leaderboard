# Evaluator Version 2.1.0 Setup Guide

## Overview

This guide documents the implementation of evaluator version 2.1.0 support in the leaderboard application. Version 2.1.0 is now the default for the **language** subject.

## Changes Made

### 1. Frontend Changes

#### Benchmarks.tsx
- Updated evaluator version type to include `'2.1.0'`: `'1.5.4' | '2.0.0' | '2.1.0'`
- Modified default version logic: language defaults to `2.1.0`, other subjects default to `2.0.0`
- Added `v2.1.0` option to the evaluator version dropdown
- Extended view mode selector to show for both `2.0.0` and `2.1.0`

### 2. Backend Changes

#### services/queries.ts
Added two new query constants:
- `LEADERBOARD_MV_2_1_0`: Queries the full materialized view with all recipes
- `LEADERBOARD_MV_2_1_0_ATTACHMENT_FILTERED`: Queries the filtered view excluding 48 image-required recipes

Both queries follow the same structure as 2.0.0 queries with:
- Subject, grade level, question type, and minimum questions filters
- Difficulty extraction priority: model_parsed_response > item_inference_params > difficulty_assigned > difficulty
- Pre-aggregated statistics for fast performance

#### vite.config.ts
- Imported new query constants: `LEADERBOARD_MV_2_1_0` and `LEADERBOARD_MV_2_1_0_ATTACHMENT_FILTERED`
- Updated API routing logic to handle version 2.1.0:
  - `evaluator_version=2.1.0&view_mode=all` → Uses `LEADERBOARD_MV_2_1_0`
  - `evaluator_version=2.1.0&view_mode=attachment_filtered` → Uses `LEADERBOARD_MV_2_1_0_ATTACHMENT_FILTERED`

### 3. Database Scripts

Created two new materialized view SQL files in `src/`:

#### src/materialized_view_2_1_0.sql
Creates `mv_leaderboard_stats_2_1_0` with:
- All recipes included (no filtering)
- Pre-aggregated statistics by model, subject, grade level, question type, and difficulty
- Indexes on subject/grade, experiment_tracker, difficulty, and question_type
- Comments documenting the view purpose

#### src/materialized_view_2_1_0_attachment_filtered.sql
Creates `mv_leaderboard_stats_2_1_0_attachment_filtered` with:
- Excludes 48 recipes that require image attachments
- Same aggregation structure as the full view
- Same indexes for optimal query performance
- Detailed comments listing excluded recipe IDs

## Database Setup

### Step 1: Create the Materialized Views

Run these SQL scripts on your database:

```bash
# Create the full view (all recipes)
psql -U your_username -d your_database -f src/materialized_view_2_1_0.sql

# Create the filtered view (48 recipes excluded)
psql -U your_username -d your_database -f src/materialized_view_2_1_0_attachment_filtered.sql
```

### Step 2: Grant Permissions

After creating the views, grant SELECT permissions to your application database user:

```sql
-- Replace 'your_app_user' with your actual application user
GRANT SELECT ON mv_leaderboard_stats_2_1_0 TO your_app_user;
GRANT SELECT ON mv_leaderboard_stats_2_1_0_attachment_filtered TO your_app_user;
```

### Step 3: Refresh Views (After Data Updates)

When new evaluations with version 2.1.0 are added to the database, refresh the materialized views:

```sql
-- Refresh concurrently allows queries to continue during the refresh
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_leaderboard_stats_2_1_0;
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_leaderboard_stats_2_1_0_attachment_filtered;
```

## API Usage

### Get Language Leaderboard (Default: 2.1.0, Attachment Filtered)

```bash
GET /api/leaderboard?subject=language
```

This will use:
- `evaluator_version=2.1.0` (default for language)
- `view_mode=attachment_filtered` (default, excludes 48 recipes)

### Get Language Leaderboard with All Recipes

```bash
GET /api/leaderboard?subject=language&evaluator_version=2.1.0&view_mode=all
```

### Get Math/ELA with 2.1.0

```bash
GET /api/leaderboard?subject=math&evaluator_version=2.1.0&view_mode=attachment_filtered
GET /api/leaderboard?subject=ela&evaluator_version=2.1.0&view_mode=attachment_filtered
```

### Optional Filters

All endpoints support these optional query parameters:
- `grade_level`: Filter by grade (e.g., '3', '4', '5')
- `question_type`: Filter by question type (e.g., 'mcq', 'fill-in')
- `min_total_questions`: Minimum questions threshold (e.g., 60, 120)

Example:
```bash
GET /api/leaderboard?subject=language&evaluator_version=2.1.0&grade_level=4&question_type=mcq&min_total_questions=60
```

## Evaluator Version Defaults

| Subject  | Default Version |
|----------|----------------|
| language | 2.1.0          |
| math     | 2.0.0          |
| ela      | 2.0.0          |

Users can override these defaults using the evaluator version dropdown in the UI or by specifying `evaluator_version` in the API request.

## Excluded Recipes (Attachment Filtered Mode)

When using `view_mode=attachment_filtered`, the following 48 recipe IDs are excluded:

```
1117, 840, 904, 910, 934, 955, 1073, 1096, 1110, 1121,
841, 1400, 1696, 1786, 1979, 1185, 842, 843, 844, 855,
856, 871, 873, 881, 882, 883, 896, 898, 966, 920,
929, 939, 940, 988, 989, 990, 991, 1088, 1130, 1172,
1337, 1345, 1419, 1432, 1514, 1651, 1873, 1997
```

These recipes require image attachments (charts, diagrams, maps, etc.) that cannot be generated via text-only prompts.

## Testing

After deployment, verify the implementation:

1. **Frontend**: Visit the Benchmarks page
   - Select "language" subject
   - Verify "v2.1.0" is selected by default in the evaluator dropdown
   - Verify the view mode selector is visible
   - Switch between evaluator versions and view modes to ensure data loads correctly

2. **API**: Test the API endpoints
   ```bash
   # Should return 2.1.0 filtered data
   curl "http://localhost:5173/api/leaderboard?subject=language"
   
   # Should return 2.1.0 all data
   curl "http://localhost:5173/api/leaderboard?subject=language&view_mode=all"
   ```

3. **Database**: Verify materialized views exist
   ```sql
   SELECT COUNT(*) FROM mv_leaderboard_stats_2_1_0;
   SELECT COUNT(*) FROM mv_leaderboard_stats_2_1_0_attachment_filtered;
   ```

## Maintenance

### Refreshing Views

Set up a cron job or scheduled task to refresh the views regularly:

```bash
# Example: Refresh every hour
0 * * * * psql -U app_user -d leaderboard_db -c "REFRESH MATERIALIZED VIEW CONCURRENTLY mv_leaderboard_stats_2_1_0; REFRESH MATERIALIZED VIEW CONCURRENTLY mv_leaderboard_stats_2_1_0_attachment_filtered;"
```

### Monitoring

Monitor view sizes and query performance:

```sql
-- Check view sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE tablename LIKE 'mv_leaderboard_stats_2_1_0%';

-- Check row counts
SELECT 'mv_leaderboard_stats_2_1_0' AS view_name, COUNT(*) AS row_count 
FROM mv_leaderboard_stats_2_1_0
UNION ALL
SELECT 'mv_leaderboard_stats_2_1_0_attachment_filtered', COUNT(*) 
FROM mv_leaderboard_stats_2_1_0_attachment_filtered;
```

## Files Modified/Created

### Modified Files
- `src/pages/Benchmarks.tsx`
- `services/queries.ts`
- `vite.config.ts`

### Created Files
- `src/materialized_view_2_1_0.sql`
- `src/materialized_view_2_1_0_attachment_filtered.sql`
- `EVALUATOR_2_1_0_SETUP.md` (this file)

## Troubleshooting

### Issue: No data showing for version 2.1.0

**Solution**: Ensure the materialized views have been created and contain data:
```sql
SELECT COUNT(*) FROM mv_leaderboard_stats_2_1_0;
```
If the count is 0, verify that evaluations with `evaluator_version = '2.1.0'` exist in the database.

### Issue: Views not updating with new data

**Solution**: Run the REFRESH command:
```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_leaderboard_stats_2_1_0;
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_leaderboard_stats_2_1_0_attachment_filtered;
```

### Issue: Permission denied errors

**Solution**: Grant SELECT permissions to your application user:
```sql
GRANT SELECT ON mv_leaderboard_stats_2_1_0 TO your_app_user;
GRANT SELECT ON mv_leaderboard_stats_2_1_0_attachment_filtered TO your_app_user;
```

