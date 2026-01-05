-- Diagnostic queries for 1.5.4 data

-- 1. Check if the materialized view exists
SELECT EXISTS (
  SELECT FROM pg_matviews 
  WHERE schemaname = 'public' 
  AND matviewname = 'mv_leaderboard_stats_1_5_4'
) AS view_exists;

-- 2. If it exists, check row count
SELECT COUNT(*) as total_rows 
FROM mv_leaderboard_stats_1_5_4;

-- 3. Check for ELA data specifically
SELECT COUNT(*) as ela_rows 
FROM mv_leaderboard_stats_1_5_4 
WHERE LOWER(subject) = 'ela';

-- 4. Check sample data
SELECT 
  experiment_tracker,
  subject,
  grade_level,
  difficulty,
  total_questions,
  percentage
FROM mv_leaderboard_stats_1_5_4
WHERE LOWER(subject) = 'ela'
LIMIT 10;

-- 5. Check raw data - are there ANY evaluations with version 1.5.4?
SELECT 
  evaluator_version,
  COUNT(*) as evaluation_count
FROM public.ai_evaluation_results
GROUP BY evaluator_version
ORDER BY evaluator_version;

-- 6. Check if there are 1.5.4 evaluations for ELA
SELECT COUNT(*) as ela_1_5_4_count
FROM public.ai_evaluation_results aer
JOIN public.generated_questions gq ON aer.question_id = gq.id
JOIN public.question_recipes qr ON gq.recipe_id = qr.recipe_id
WHERE aer.evaluator_version = '1.5.4'
  AND LOWER(qr.subject) = 'ela';









