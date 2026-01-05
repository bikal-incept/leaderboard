-- Materialized View: mv_leaderboard_stats_2_1_0_attachment_filtered
-- Description: Pre-aggregated leaderboard statistics for evaluator version 2.1.0
--              FILTERED to EXCLUDE recipes with image attachment requirements
-- 
-- This view EXCLUDES the 48 recipe_ids that require image attachments.
-- All other recipes are included (text-only generation, no images needed).
--
-- Recipe IDs excluded: 1117, 840, 904, 910, 934, 955, 1073, 1096, 1110, 1121,
-- 841, 1400, 1696, 1786, 1979, 1185, 842, 843, 844, 855, 856, 871, 873, 881,
-- 882, 883, 896, 898, 966, 920, 929, 939, 940, 988, 989, 990, 991, 1088, 1130,
-- 1172, 1337, 1345, 1419, 1432, 1514, 1651, 1873, 1997 (48 recipes with image requirements)
--
-- Usage: This view is queried by the leaderboard API when "attachment_filtered" mode is selected
--
-- Refresh: Run REFRESH MATERIALIZED VIEW CONCURRENTLY mv_leaderboard_stats_2_1_0_attachment_filtered;
--          after new evaluations are added to keep the data current.

-- Drop the materialized view if it exists
DROP MATERIALIZED VIEW IF EXISTS mv_leaderboard_stats_2_1_0_attachment_filtered CASCADE;

-- Create the materialized view
CREATE MATERIALIZED VIEW mv_leaderboard_stats_2_1_0_attachment_filtered AS
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
WHERE aer.evaluator_version = '2.1.0'
  -- Exclude recipes that require image attachments (48 recipes)
  AND qr.recipe_id NOT IN (
    1117, 840, 904, 910, 934, 955, 1073, 1096, 1110, 1121,
    841, 1400, 1696, 1786, 1979, 1185, 842, 843, 844, 855,
    856, 871, 873, 881, 882, 883, 896, 898, 966, 920,
    929, 939, 940, 988, 989, 990, 991, 1088, 1130, 1172,
    1337, 1345, 1419, 1432, 1514, 1651, 1873, 1997
  )
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

-- Create indexes for fast querying
CREATE INDEX idx_mv_leaderboard_2_1_0_af_subject_grade 
  ON mv_leaderboard_stats_2_1_0_attachment_filtered (subject, grade_level);

CREATE INDEX idx_mv_leaderboard_2_1_0_af_experiment 
  ON mv_leaderboard_stats_2_1_0_attachment_filtered (experiment_tracker);

CREATE INDEX idx_mv_leaderboard_2_1_0_af_difficulty 
  ON mv_leaderboard_stats_2_1_0_attachment_filtered (difficulty);

CREATE INDEX idx_mv_leaderboard_2_1_0_af_question_type 
  ON mv_leaderboard_stats_2_1_0_attachment_filtered (question_type);

-- Comments
COMMENT ON MATERIALIZED VIEW mv_leaderboard_stats_2_1_0_attachment_filtered IS 
  'Leaderboard statistics for evaluator v2.1.0 filtered to EXCLUDE 48 recipes that require image attachments. Excluded recipe IDs: 1117, 840, 904, 910, 934, 955, 1073, 1096, 1110, 1121, 841, 1400, 1696, 1786, 1979, 1185, 842, 843, 844, 855, 856, 871, 873, 881, 882, 883, 896, 898, 966, 920, 929, 939, 940, 988, 989, 990, 991, 1088, 1130, 1172, 1337, 1345, 1419, 1432, 1514, 1651, 1873, 1997. All other recipes are included (text-only generation).';

COMMENT ON COLUMN mv_leaderboard_stats_2_1_0_attachment_filtered.questions_above_threshold IS 
  'Count of questions with evaluator_score >= 0.85';

COMMENT ON COLUMN mv_leaderboard_stats_2_1_0_attachment_filtered.percentage IS 
  'Success rate: (questions_above_threshold / total_questions) * 100, rounded to 1 decimal place';

COMMENT ON COLUMN mv_leaderboard_stats_2_1_0_attachment_filtered.last_updated IS 
  'Timestamp of most recent evaluation in this group';

-- Grant permissions (adjust as needed for your setup)
-- Replace 'your_app_user' with your actual application database user
-- GRANT SELECT ON mv_leaderboard_stats_2_1_0_attachment_filtered TO your_app_user;

