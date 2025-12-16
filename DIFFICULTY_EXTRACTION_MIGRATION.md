# Difficulty Extraction Priority Update

## Overview
All queries now consistently prioritize `model_parsed_response->>'difficulty'` as the primary source for difficulty values, with fallback to `inference_params` fields only when `model_parsed_response` doesn't contain difficulty.

## Changes Made

### ✅ Updated Application Queries (services/queries.ts)

The following queries have been updated to use the correct priority order:

1. **LEADERBOARD_BY_SUBJECT** (deprecated, but still in use)
2. **EXPERIMENT_REPORT** 
3. **EXPERIMENT_SCORES**
4. **FETCH_EVALUATIONS**
5. **LATENCY_BY_PERFORMANCE**

**New Priority Order:**
```sql
COALESCE(
  gq.model_parsed_response->>'difficulty',                           -- 1. FIRST: Check model output
  gq.inference_params->'item_inference_params'->>'target_difficulty', -- 2. Check inference params
  gq.inference_params->>'difficulty_assigned',                       -- 3. Check assigned difficulty
  gq.inference_params->>'difficulty'                                 -- 4. LAST: Generic difficulty field
) AS difficulty
```

### ⚠️ Database Materialized Views Need Manual Update

The following materialized views must be recreated to use the new difficulty extraction logic:

1. **mv_leaderboard_stats_1_5_4**
2. **mv_leaderboard_stats_2_0_0**

## Required Database Migration

### Step 1: Backup Current Views
```sql
-- Check current row counts
SELECT 'mv_leaderboard_stats_1_5_4' as view_name, COUNT(*) as row_count 
FROM mv_leaderboard_stats_1_5_4
UNION ALL
SELECT 'mv_leaderboard_stats_2_0_0', COUNT(*) 
FROM mv_leaderboard_stats_2_0_0;
```

### Step 2: Drop and Recreate mv_leaderboard_stats_1_5_4

```sql
-- Drop existing view
DROP MATERIALIZED VIEW IF EXISTS mv_leaderboard_stats_1_5_4;

-- Recreate with updated difficulty extraction
CREATE MATERIALIZED VIEW mv_leaderboard_stats_1_5_4 AS
SELECT
    gq.model,
    gq.experiment_tracker,
    qr.subject,
    qr.grade_level,
    gq.question_type,
    COALESCE(
        gq.model_parsed_response->>'difficulty',
        gq.inference_params->'item_inference_params'->>'target_difficulty',
        gq.inference_params->>'difficulty_assigned',
        gq.inference_params->>'difficulty'
    ) AS difficulty,
    COUNT(DISTINCT CASE WHEN aer.evaluator_score >= 0.85 THEN gq.id END) AS questions_above_threshold,
    COUNT(DISTINCT gq.id) AS total_questions,
    ROUND(
        100.0 * COUNT(DISTINCT CASE WHEN aer.evaluator_score >= 0.85 THEN gq.id END)
        / NULLIF(COUNT(DISTINCT gq.id), 0),
        1
    ) AS percentage,
    MAX(aer.evaluated_at) AS last_updated
FROM public.generated_questions AS gq
JOIN public.ai_evaluation_results AS aer
    ON aer.question_id = gq.id
JOIN public.question_recipes AS qr
    ON gq.recipe_id = qr.recipe_id
WHERE aer.evaluator_version = '1.5.4'
    AND gq.experiment_tracker IS NOT NULL
GROUP BY
    gq.model,
    gq.experiment_tracker,
    qr.subject,
    qr.grade_level,
    gq.question_type,
    COALESCE(
        gq.model_parsed_response->>'difficulty',
        gq.inference_params->'item_inference_params'->>'target_difficulty',
        gq.inference_params->>'difficulty_assigned',
        gq.inference_params->>'difficulty'
    );

-- Create indexes for better performance
CREATE INDEX idx_mv_leaderboard_stats_1_5_4_subject 
    ON mv_leaderboard_stats_1_5_4(subject);
CREATE INDEX idx_mv_leaderboard_stats_1_5_4_experiment 
    ON mv_leaderboard_stats_1_5_4(experiment_tracker);
CREATE INDEX idx_mv_leaderboard_stats_1_5_4_difficulty 
    ON mv_leaderboard_stats_1_5_4(difficulty);
```

### Step 3: Drop and Recreate mv_leaderboard_stats_2_0_0

```sql
-- Drop existing view
DROP MATERIALIZED VIEW IF EXISTS mv_leaderboard_stats_2_0_0;

-- Recreate with updated difficulty extraction
CREATE MATERIALIZED VIEW mv_leaderboard_stats_2_0_0 AS
SELECT
    gq.model,
    gq.experiment_tracker,
    qr.subject,
    qr.grade_level,
    gq.question_type,
    COALESCE(
        gq.model_parsed_response->>'difficulty',
        gq.inference_params->'item_inference_params'->>'target_difficulty',
        gq.inference_params->>'difficulty_assigned',
        gq.inference_params->>'difficulty'
    ) AS difficulty,
    COUNT(DISTINCT CASE WHEN aer.evaluator_score >= 0.85 THEN gq.id END) AS questions_above_threshold,
    COUNT(DISTINCT gq.id) AS total_questions,
    ROUND(
        100.0 * COUNT(DISTINCT CASE WHEN aer.evaluator_score >= 0.85 THEN gq.id END)
        / NULLIF(COUNT(DISTINCT gq.id), 0),
        1
    ) AS percentage,
    MAX(aer.evaluated_at) AS last_updated
FROM public.generated_questions AS gq
JOIN public.ai_evaluation_results AS aer
    ON aer.question_id = gq.id
JOIN public.question_recipes AS qr
    ON gq.recipe_id = qr.recipe_id
WHERE aer.evaluator_version = '2.0.0'
    AND gq.experiment_tracker IS NOT NULL
GROUP BY
    gq.model,
    gq.experiment_tracker,
    qr.subject,
    qr.grade_level,
    gq.question_type,
    COALESCE(
        gq.model_parsed_response->>'difficulty',
        gq.inference_params->'item_inference_params'->>'target_difficulty',
        gq.inference_params->>'difficulty_assigned',
        gq.inference_params->>'difficulty'
    );

-- Create indexes for better performance
CREATE INDEX idx_mv_leaderboard_stats_2_0_0_subject 
    ON mv_leaderboard_stats_2_0_0(subject);
CREATE INDEX idx_mv_leaderboard_stats_2_0_0_experiment 
    ON mv_leaderboard_stats_2_0_0(experiment_tracker);
CREATE INDEX idx_mv_leaderboard_stats_2_0_0_difficulty 
    ON mv_leaderboard_stats_2_0_0(difficulty);
```

### Step 4: Verify the Changes

```sql
-- Check that difficulty values have changed (if applicable)
SELECT 
    experiment_tracker,
    difficulty,
    COUNT(*) as row_count,
    SUM(total_questions) as total_questions
FROM mv_leaderboard_stats_2_0_0
GROUP BY experiment_tracker, difficulty
ORDER BY experiment_tracker, difficulty;

-- Compare row counts before and after
SELECT 'mv_leaderboard_stats_1_5_4' as view_name, COUNT(*) as row_count 
FROM mv_leaderboard_stats_1_5_4
UNION ALL
SELECT 'mv_leaderboard_stats_2_0_0', COUNT(*) 
FROM mv_leaderboard_stats_2_0_0;
```

### Step 5: Set Up Refresh Schedule (if not already configured)

```sql
-- Create a function to refresh both views
CREATE OR REPLACE FUNCTION refresh_leaderboard_stats()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_leaderboard_stats_1_5_4;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_leaderboard_stats_2_0_0;
END;
$$ LANGUAGE plpgsql;

-- Schedule refresh (adjust timing as needed for your use case)
-- Example using pg_cron extension:
-- SELECT cron.schedule('refresh-leaderboard-stats', '0 * * * *', 'SELECT refresh_leaderboard_stats()');
```

## Impact

### What Will Change
- Difficulty values will now primarily come from `model_parsed_response->>'difficulty'`
- If the model output contains difficulty, it will be used instead of inference parameters
- This ensures consistency between what the model actually generated and what's displayed

### What Won't Change
- The fallback mechanism ensures backward compatibility
- Questions without `model_parsed_response->>'difficulty'` will still use inference_params
- All existing queries and APIs continue to work

## Testing

After migration, verify:

1. **Homepage leaderboard displays correctly**
   - Check http://localhost:5173/ (or your domain)
   - Verify experiment comparisons show proper difficulty breakdowns

2. **Experiment detail pages work**
   - Click on any experiment from the homepage
   - Verify difficulty distribution matches expectations

3. **Difficulty counts are consistent**
   - Run comparison queries to ensure counts make sense
   - Check that Easy/Medium/Hard totals align with database reality

## Rollback Plan

If issues arise, you can temporarily revert the materialized views to the old definition:

```sql
-- Revert to old difficulty extraction (NOT RECOMMENDED)
-- Only use this if critical issues arise and you need immediate rollback

DROP MATERIALIZED VIEW IF EXISTS mv_leaderboard_stats_2_0_0;

CREATE MATERIALIZED VIEW mv_leaderboard_stats_2_0_0 AS
SELECT
    gq.model,
    gq.experiment_tracker,
    qr.subject,
    qr.grade_level,
    gq.question_type,
    COALESCE(
        gq.inference_params->'item_inference_params'->>'target_difficulty',
        gq.inference_params->>'difficulty_assigned',
        gq.inference_params->>'difficulty'
    ) AS difficulty,
    -- ... rest of query same as before
    [Rest of query omitted for brevity - use your backup]
```

## Notes

- **Performance**: Recreating materialized views can take several minutes on large databases
- **Downtime**: Brief queries may fail during view recreation; consider maintenance window
- **Monitoring**: Watch for any changes in reported statistics after migration
- **Data Quality**: This change surfaces the actual model outputs; any discrepancies between model output and target difficulty will now be visible



