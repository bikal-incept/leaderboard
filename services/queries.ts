/**
 * Place to keep raw SQL snippets used by the reporting / leaderboard service.
 *
 * These are plain strings so you can tweak them freely. Backend code can
 * import them and pass into the `query` helper from `services/db`.
 */

/**
 * Leaderboard query backed by the real evaluation schema.
 *
 * This is the query to use to drive the leaderboard views. It produces one
 * row per (model, subject, question_type, difficulty) with:
 *  - questions_above_threshold: COUNT of distinct questions with evaluator_score >= 0.85
 *  - total_questions: COUNT of all distinct questions
 *  - percentage: 100 * questions_above_threshold / total_questions (rounded to 1 dp)
 *
 * NOTE: this version is parameterised by subject so it can be used exactly
 * for the Benchmarks page, which selects a single subject at a time.
 * 
 * @deprecated Use LEADERBOARD_MV_1_5_4 for much better performance
 */
export const LEADERBOARD_BY_SUBJECT = `
  SELECT
      gq.experiment_tracker AS model,
      qr.subject            AS subject,
      gq.question_type      AS question_type,
      COALESCE(
          gq.model_parsed_response->>'difficulty',
          gq.inference_params->'item_inference_params'->>'target_difficulty',
          gq.inference_params->>'difficulty_assigned',
          gq.inference_params->>'difficulty'
      )                     AS difficulty,
      COUNT(DISTINCT CASE WHEN aer.evaluator_score >= 0.85 THEN gq.id END)
                           AS questions_above_threshold,
      COUNT(DISTINCT gq.id) AS total_questions,
      ROUND(
          100.0 * COUNT(DISTINCT CASE WHEN aer.evaluator_score >= 0.85 THEN gq.id END)
          / NULLIF(COUNT(DISTINCT gq.id), 0),
          1
      ) AS percentage
  FROM public.generated_questions   AS gq
  JOIN public.ai_evaluation_results AS aer
    ON aer.question_id = gq.id
  JOIN public.question_recipes      AS qr
    ON gq.recipe_id = qr.recipe_id
  WHERE qr.subject = $1
  GROUP BY
      gq.experiment_tracker,
      qr.subject,
      gq.question_type,
      COALESCE(
          gq.model_parsed_response->>'difficulty',
          gq.inference_params->'item_inference_params'->>'target_difficulty',
          gq.inference_params->>'difficulty_assigned',
          gq.inference_params->>'difficulty'
      )
  ORDER BY
      model,
      subject,
      question_type,
      difficulty;
`;

/**
 * Leaderboard query using materialized view for evaluator version 1.5.4
 * 
 * Ultra-fast pre-aggregated results from mv_leaderboard_stats_1_5_4.
 * This view is pre-filtered to evaluator_version '1.5.4' and pre-aggregated,
 * making queries nearly instant even with millions of rows in the base tables.
 * 
 * IMPORTANT: The materialized view must extract difficulty using the same priority order:
 *   1. model_parsed_response->>'difficulty' (FIRST)
 *   2. inference_params->'item_inference_params'->>'target_difficulty'
 *   3. inference_params->>'difficulty_assigned'
 *   4. inference_params->>'difficulty'
 * 
 * Returns rows with:
 *  - model: model name from generated_questions.model
 *  - experiment_tracker: experiment tracker identifier
 *  - subject: subject from question_recipes
 *  - grade_level: grade level from question_recipes
 *  - question_type: type of question (MCQ, etc)
 *  - difficulty: Easy, Medium, Hard
 *  - questions_above_threshold: count where score >= 0.85
 *  - total_questions: total count of questions
 *  - percentage: success rate (0-100, 1 decimal place)
 *  - last_updated: timestamp of most recent evaluation
 * 
 * Parameters:
 *  $1: subject (required) - e.g., 'math', 'ela'
 *  $2: grade_level (optional) - e.g., '3', '4', pass NULL for all grades
 *  $3: question_type (optional) - e.g., 'mcq', 'fill-in', pass NULL for all types
 *  $4: min_total_questions (optional) - minimum total questions threshold, pass NULL for no filter
 */
export const LEADERBOARD_MV_1_5_4 = `
  SELECT
    model,
    experiment_tracker,
    INITCAP(subject) AS subject,
    grade_level,
    LOWER(question_type) AS question_type,
    INITCAP(difficulty) AS difficulty,
    questions_above_threshold,
    total_questions,
    percentage,
    last_updated
  FROM mv_leaderboard_stats_1_5_4
  WHERE LOWER(subject) = LOWER($1)
    AND ($2::text IS NULL OR grade_level = $2)
    AND ($3::text IS NULL OR LOWER(question_type) = LOWER($3))
    AND ($4::integer IS NULL OR total_questions >= $4)
    AND experiment_tracker IS NOT NULL
  ORDER BY
    percentage DESC,
    experiment_tracker,
    difficulty;
`;

/**
 * Leaderboard query using materialized view for evaluator version 1.5.4 (Attachment Filtered)
 * 
 * Ultra-fast pre-aggregated results from mv_leaderboard_stats_1_5_4_attachment_filtered.
 * This view is pre-filtered to evaluator_version '1.5.4', pre-aggregated, AND excludes
 * recipes with image attachment requirements.
 * 
 * This filtered view excludes 48 recipes that require image attachments.
 * 
 * IMPORTANT: The materialized view must extract difficulty using the same priority order:
 *   1. model_parsed_response->>'difficulty' (FIRST)
 *   2. inference_params->'item_inference_params'->>'target_difficulty'
 *   3. inference_params->>'difficulty_assigned'
 *   4. inference_params->>'difficulty'
 * 
 * Returns rows with:
 *  - model: model name from generated_questions.model
 *  - experiment_tracker: experiment tracker identifier
 *  - subject: subject from question_recipes
 *  - grade_level: grade level from question_recipes
 *  - question_type: type of question (MCQ, etc)
 *  - difficulty: Easy, Medium, Hard
 *  - questions_above_threshold: count where score >= 0.85
 *  - total_questions: total count of questions
 *  - percentage: success rate (0-100, 1 decimal place)
 *  - last_updated: timestamp of most recent evaluation
 * 
 * Parameters:
 *  $1: subject (required) - e.g., 'math', 'ela'
 *  $2: grade_level (optional) - e.g., '3', '4', pass NULL for all grades
 *  $3: question_type (optional) - e.g., 'mcq', 'fill-in', pass NULL for all types
 *  $4: min_total_questions (optional) - minimum total questions threshold, pass NULL for no filter
 */
export const LEADERBOARD_MV_1_5_4_ATTACHMENT_FILTERED = `
  SELECT
    model,
    experiment_tracker,
    INITCAP(subject) AS subject,
    grade_level,
    LOWER(question_type) AS question_type,
    INITCAP(difficulty) AS difficulty,
    questions_above_threshold,
    total_questions,
    percentage,
    last_updated
  FROM mv_leaderboard_stats_1_5_4_attachment_filtered
  WHERE LOWER(subject) = LOWER($1)
    AND ($2::text IS NULL OR grade_level = $2)
    AND ($3::text IS NULL OR LOWER(question_type) = LOWER($3))
    AND ($4::integer IS NULL OR total_questions >= $4)
    AND experiment_tracker IS NOT NULL
  ORDER BY
    percentage DESC,
    experiment_tracker,
    difficulty;
`;

/**
 * Leaderboard query using materialized view for evaluator version 2.0.0
 * 
 * Ultra-fast pre-aggregated results from mv_leaderboard_stats_2_0_0.
 * This view is pre-filtered to evaluator_version '2.0.0' and pre-aggregated,
 * making queries nearly instant even with millions of rows in the base tables.
 * 
 * IMPORTANT: The materialized view must extract difficulty using the same priority order:
 *   1. model_parsed_response->>'difficulty' (FIRST)
 *   2. inference_params->'item_inference_params'->>'target_difficulty'
 *   3. inference_params->>'difficulty_assigned'
 *   4. inference_params->>'difficulty'
 * 
 * Returns rows with:
 *  - model: model name from generated_questions.model
 *  - experiment_tracker: experiment tracker identifier
 *  - subject: subject from question_recipes
 *  - grade_level: grade level from question_recipes
 *  - question_type: type of question (MCQ, etc)
 *  - difficulty: Easy, Medium, Hard
 *  - questions_above_threshold: count where score >= 0.85
 *  - total_questions: total count of questions
 *  - percentage: success rate (0-100, 1 decimal place)
 *  - last_updated: timestamp of most recent evaluation
 * 
 * Parameters:
 *  $1: subject (required) - e.g., 'math', 'ela'
 *  $2: grade_level (optional) - e.g., '3', '4', pass NULL for all grades
 *  $3: question_type (optional) - e.g., 'mcq', 'fill-in', pass NULL for all types
 *  $4: min_total_questions (optional) - minimum total questions threshold, pass NULL for no filter
 */
export const LEADERBOARD_MV_2_0_0 = `
  SELECT 
    model,
    experiment_tracker,
    INITCAP(subject) AS subject,
    grade_level,
    LOWER(question_type) AS question_type,
    INITCAP(difficulty) AS difficulty,
    questions_above_threshold,
    total_questions,
    percentage,
    last_updated
  FROM mv_leaderboard_stats_2_0_0
  WHERE LOWER(subject) = LOWER($1)
    AND ($2::text IS NULL OR grade_level = $2)
    AND ($3::text IS NULL OR LOWER(question_type) = LOWER($3))
    AND ($4::integer IS NULL OR total_questions >= $4)
    AND experiment_tracker IS NOT NULL
  ORDER BY 
    percentage DESC,
    experiment_tracker,
    difficulty;
`;

/**
 * Leaderboard query using materialized view for evaluator version 2.0.0 (Attachment Filtered)
 * 
 * Ultra-fast pre-aggregated results from mv_leaderboard_stats_2_0_0_attachment_filtered.
 * This view is pre-filtered to evaluator_version '2.0.0', pre-aggregated, AND excludes
 * recipes with blocked standards (multimedia-required standards like charts, diagrams, maps).
 * 
 * This filtered view excludes 149 blocked standards across grades 3-8 that require
 * visual aids (charts, diagrams, maps, timelines) which cannot be generated via text-only.
 * 
 * IMPORTANT: The materialized view must extract difficulty using the same priority order:
 *   1. model_parsed_response->>'difficulty' (FIRST)
 *   2. inference_params->'item_inference_params'->>'target_difficulty'
 *   3. inference_params->>'difficulty_assigned'
 *   4. inference_params->>'difficulty'
 * 
 * Returns rows with:
 *  - model: model name from generated_questions.model
 *  - experiment_tracker: experiment tracker identifier
 *  - subject: subject from question_recipes
 *  - grade_level: grade level from question_recipes
 *  - question_type: type of question (MCQ, etc)
 *  - difficulty: Easy, Medium, Hard
 *  - questions_above_threshold: count where score >= 0.85
 *  - total_questions: total count of questions
 *  - percentage: success rate (0-100, 1 decimal place)
 *  - last_updated: timestamp of most recent evaluation
 * 
 * Parameters:
 *  $1: subject (required) - e.g., 'math', 'ela'
 *  $2: grade_level (optional) - e.g., '3', '4', pass NULL for all grades
 *  $3: question_type (optional) - e.g., 'mcq', 'fill-in', pass NULL for all types
 *  $4: min_total_questions (optional) - minimum total questions threshold, pass NULL for no filter
 */
export const LEADERBOARD_MV_2_0_0_ATTACHMENT_FILTERED = `
  SELECT 
    model,
    experiment_tracker,
    INITCAP(subject) AS subject,
    grade_level,
    LOWER(question_type) AS question_type,
    INITCAP(difficulty) AS difficulty,
    questions_above_threshold,
    total_questions,
    percentage,
    last_updated
  FROM mv_leaderboard_stats_2_0_0_attachment_filtered
  WHERE LOWER(subject) = LOWER($1)
    AND ($2::text IS NULL OR grade_level = $2)
    AND ($3::text IS NULL OR LOWER(question_type) = LOWER($3))
    AND ($4::integer IS NULL OR total_questions >= $4)
    AND experiment_tracker IS NOT NULL
  ORDER BY 
    percentage DESC,
    experiment_tracker,
    difficulty;
`;

/**
 * Leaderboard query using materialized view for evaluator version 2.1.0
 * 
 * Ultra-fast pre-aggregated results from mv_leaderboard_stats_2_1_0.
 * This view is pre-filtered to evaluator_version '2.1.0' and pre-aggregated,
 * making queries nearly instant even with millions of rows in the base tables.
 * 
 * IMPORTANT: The materialized view must extract difficulty using the same priority order:
 *   1. model_parsed_response->>'difficulty' (FIRST)
 *   2. inference_params->'item_inference_params'->>'target_difficulty'
 *   3. inference_params->>'difficulty_assigned'
 *   4. inference_params->>'difficulty'
 * 
 * Returns rows with:
 *  - model: model name from generated_questions.model
 *  - experiment_tracker: experiment tracker identifier
 *  - subject: subject from question_recipes
 *  - grade_level: grade level from question_recipes
 *  - question_type: type of question (MCQ, etc)
 *  - difficulty: Easy, Medium, Hard
 *  - questions_above_threshold: count where score >= 0.85
 *  - total_questions: total count of questions
 *  - percentage: success rate (0-100, 1 decimal place)
 *  - last_updated: timestamp of most recent evaluation
 * 
 * Parameters:
 *  $1: subject (required) - e.g., 'math', 'ela'
 *  $2: grade_level (optional) - e.g., '3', '4', pass NULL for all grades
 *  $3: question_type (optional) - e.g., 'mcq', 'fill-in', pass NULL for all types
 *  $4: min_total_questions (optional) - minimum total questions threshold, pass NULL for no filter
 */
export const LEADERBOARD_MV_2_1_0 = `
  SELECT 
    model,
    experiment_tracker,
    INITCAP(subject) AS subject,
    grade_level,
    LOWER(question_type) AS question_type,
    INITCAP(difficulty) AS difficulty,
    questions_above_threshold,
    total_questions,
    percentage,
    last_updated
  FROM mv_leaderboard_stats_2_1_0
  WHERE LOWER(subject) = LOWER($1)
    AND ($2::text IS NULL OR grade_level = $2)
    AND ($3::text IS NULL OR LOWER(question_type) = LOWER($3))
    AND ($4::integer IS NULL OR total_questions >= $4)
    AND experiment_tracker IS NOT NULL
  ORDER BY 
    percentage DESC,
    experiment_tracker,
    difficulty;
`;

/**
 * Leaderboard query using materialized view for evaluator version 2.1.0 (Attachment Filtered)
 * 
 * Ultra-fast pre-aggregated results from mv_leaderboard_stats_2_1_0_attachment_filtered.
 * This view is pre-filtered to evaluator_version '2.1.0', pre-aggregated, AND excludes
 * recipes with image attachment requirements (48 recipes with multimedia requirements).
 * 
 * This filtered view excludes 48 recipes that require visual aids (images, charts, diagrams, 
 * maps, timelines) which cannot be generated via text-only.
 * 
 * IMPORTANT: The materialized view must extract difficulty using the same priority order:
 *   1. model_parsed_response->>'difficulty' (FIRST)
 *   2. inference_params->'item_inference_params'->>'target_difficulty'
 *   3. inference_params->>'difficulty_assigned'
 *   4. inference_params->>'difficulty'
 * 
 * Returns rows with:
 *  - model: model name from generated_questions.model
 *  - experiment_tracker: experiment tracker identifier
 *  - subject: subject from question_recipes
 *  - grade_level: grade level from question_recipes
 *  - question_type: type of question (MCQ, etc)
 *  - difficulty: Easy, Medium, Hard
 *  - questions_above_threshold: count where score >= 0.85
 *  - total_questions: total count of questions
 *  - percentage: success rate (0-100, 1 decimal place)
 *  - last_updated: timestamp of most recent evaluation
 * 
 * Parameters:
 *  $1: subject (required) - e.g., 'math', 'ela'
 *  $2: grade_level (optional) - e.g., '3', '4', pass NULL for all grades
 *  $3: question_type (optional) - e.g., 'mcq', 'fill-in', pass NULL for all types
 *  $4: min_total_questions (optional) - minimum total questions threshold, pass NULL for no filter
 */
export const LEADERBOARD_MV_2_1_0_ATTACHMENT_FILTERED = `
  SELECT 
    model,
    experiment_tracker,
    INITCAP(subject) AS subject,
    grade_level,
    LOWER(question_type) AS question_type,
    INITCAP(difficulty) AS difficulty,
    questions_above_threshold,
    total_questions,
    percentage,
    last_updated
  FROM mv_leaderboard_stats_2_1_0_attachment_filtered
  WHERE LOWER(subject) = LOWER($1)
    AND ($2::text IS NULL OR grade_level = $2)
    AND ($3::text IS NULL OR LOWER(question_type) = LOWER($3))
    AND ($4::integer IS NULL OR total_questions >= $4)
    AND experiment_tracker IS NOT NULL
  ORDER BY 
    percentage DESC,
    experiment_tracker,
    difficulty;
`;

// Example latency summary query. Again, table/column names are placeholders.
export const LATENCY_SUMMARY_BY_DIFFICULTY = `
  SELECT
    difficulty,
    COUNT(*)                                         AS total,
    percentile_cont(0.10) WITHIN GROUP (ORDER BY ttft_ms)  AS ttft_p10,
    percentile_cont(0.10) WITHIN GROUP (ORDER BY ttfr_ms)  AS ttfr_p10,
    percentile_cont(0.10) WITHIN GROUP (ORDER BY total_ms) AS total_p10,
    percentile_cont(0.90) WITHIN GROUP (ORDER BY ttft_ms)  AS ttft_p90,
    percentile_cont(0.90) WITHIN GROUP (ORDER BY ttfr_ms)  AS ttfr_p90,
    percentile_cont(0.90) WITHIN GROUP (ORDER BY total_ms) AS total_p90
  FROM latency_events
  WHERE experiment_id = $1
  GROUP BY difficulty
  ORDER BY difficulty;
`;

/**
 * Experiment Report Query
 * 
 * Fetches detailed experiment metrics including latency statistics from inference_params.
 * Groups data by difficulty level to provide comprehensive experiment insights.
 * Extracts difficulty from model_parsed_response first, then falls back to inference_params.
 * 
 * Parameters:
 *  $1: experiment_tracker (required) - the experiment identifier
 *  $2: subject (optional) - filter by subject, pass NULL for all
 *  $3: grade_level (optional) - filter by grade level, pass NULL for all
 *  $4: question_type (optional) - filter by question type, pass NULL for all
 */
export const EXPERIMENT_REPORT = `
  SELECT
    gq.experiment_tracker,
    gq.model,
    qr.subject,
    qr.grade_level,
    gq.question_type,
    COALESCE(
      gq.model_parsed_response->>'difficulty',
      gq.inference_params->'item_inference_params'->>'target_difficulty',
      gq.inference_params->>'difficulty_assigned',
      gq.inference_params->>'difficulty'
    ) AS difficulty,
    
    -- Question counts
    COUNT(DISTINCT gq.id) AS total_questions,
    COUNT(DISTINCT CASE WHEN aer.evaluator_score >= 0.85 THEN gq.id END) AS questions_above_threshold,
    
    -- Success rate
    ROUND(
      (100.0 * COUNT(DISTINCT CASE WHEN aer.evaluator_score >= 0.85 THEN gq.id END)
      / NULLIF(COUNT(DISTINCT gq.id), 0))::numeric,
      2
    ) AS success_percentage,
    
    -- Latency metrics (in milliseconds)
    ROUND(AVG((gq.inference_params->'item_inference_params'->>'ttft_ms')::numeric)::numeric, 2) AS avg_ttft_ms,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY (gq.inference_params->'item_inference_params'->>'ttft_ms')::numeric)::numeric, 2) AS median_ttft_ms,
    ROUND(PERCENTILE_CONT(0.10) WITHIN GROUP (ORDER BY (gq.inference_params->'item_inference_params'->>'ttft_ms')::numeric)::numeric, 2) AS p10_ttft_ms,
    ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY (gq.inference_params->'item_inference_params'->>'ttft_ms')::numeric)::numeric, 2) AS p90_ttft_ms,
    ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY (gq.inference_params->'item_inference_params'->>'ttft_ms')::numeric)::numeric, 2) AS p95_ttft_ms,
    
    ROUND(AVG((gq.inference_params->'item_inference_params'->>'total_generation_time_ms')::numeric)::numeric, 2) AS avg_total_generation_ms,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY (gq.inference_params->'item_inference_params'->>'total_generation_time_ms')::numeric)::numeric, 2) AS median_total_generation_ms,
    ROUND(PERCENTILE_CONT(0.10) WITHIN GROUP (ORDER BY (gq.inference_params->'item_inference_params'->>'total_generation_time_ms')::numeric)::numeric, 2) AS p10_total_generation_ms,
    ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY (gq.inference_params->'item_inference_params'->>'total_generation_time_ms')::numeric)::numeric, 2) AS p90_total_generation_ms,
    ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY (gq.inference_params->'item_inference_params'->>'total_generation_time_ms')::numeric)::numeric, 2) AS p95_total_generation_ms,
    
    -- Quality metrics
    ROUND(AVG(aer.evaluator_score)::numeric, 3) AS avg_evaluator_score,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY aer.evaluator_score)::numeric, 3) AS median_evaluator_score,
    ROUND(MIN(aer.evaluator_score)::numeric, 3) AS min_evaluator_score,
    ROUND(MAX(aer.evaluator_score)::numeric, 3) AS max_evaluator_score,
    
    -- Additional stats for difficulty breakdown
    COUNT(DISTINCT CASE WHEN aer.evaluator_score = 0 THEN gq.id END) AS zero_scores,
    COUNT(DISTINCT CASE WHEN aer.evaluator_score < 0.85 THEN gq.id END) AS below_threshold,
    
    -- Metadata
    MIN(gq.created_at) AS first_question_created,
    MAX(gq.created_at) AS last_question_created,
    MAX(aer.evaluated_at) AS last_evaluated_at
    
  FROM public.generated_questions AS gq
  JOIN public.ai_evaluation_results AS aer
    ON aer.question_id = gq.id
  JOIN public.question_recipes AS qr
    ON gq.recipe_id = qr.recipe_id
  WHERE gq.experiment_tracker = $1
    AND ($2::text IS NULL OR LOWER(qr.subject) = LOWER($2))
    AND ($3::text IS NULL OR qr.grade_level = $3)
    AND ($4::text IS NULL OR LOWER(gq.question_type) = LOWER($4))
    AND aer.evaluator_version = $5
  GROUP BY
    gq.experiment_tracker,
    gq.model,
    qr.subject,
    qr.grade_level,
    gq.question_type,
    COALESCE(
      gq.model_parsed_response->>'difficulty',
      gq.inference_params->'item_inference_params'->>'target_difficulty',
      gq.inference_params->>'difficulty_assigned',
      gq.inference_params->>'difficulty'
    )
  ORDER BY
    difficulty,
    question_type;
`;

/**
 * Experiment Summary Query
 * 
 * Fetches high-level experiment statistics including run metadata from inference_params.
 * Returns a single row with overall experiment metrics.
 * 
 * Parameters:
 *  $1: experiment_tracker (required) - the experiment identifier
 *  $2: subject (optional) - filter by subject, pass NULL for all
 *  $3: grade_level (optional) - filter by grade level, pass NULL for all
 *  $4: question_type (optional) - filter by question type, pass NULL for all
 */
export const EXPERIMENT_SUMMARY = `
  WITH experiment_data AS (
    SELECT
      gq.experiment_tracker,
      gq.model,
      gq.id,
      gq.inference_params,
      aer.evaluator_score,
      gq.created_at,
      aer.evaluated_at,
      qr.recipe_id
    FROM public.generated_questions AS gq
    JOIN public.ai_evaluation_results AS aer
      ON aer.question_id = gq.id
    JOIN public.question_recipes AS qr
      ON gq.recipe_id = qr.recipe_id
    WHERE gq.experiment_tracker = $1
      AND ($2::text IS NULL OR LOWER(qr.subject) = LOWER($2))
      AND ($3::text IS NULL OR qr.grade_level = $3)
      AND ($4::text IS NULL OR LOWER(gq.question_type) = LOWER($4))
      AND aer.evaluator_version = $5
  )
  SELECT
    experiment_tracker,
    model,
    
    -- Overall counts
    COUNT(DISTINCT id) AS total_questions,
    COUNT(DISTINCT CASE WHEN evaluator_score >= 0.85 THEN id END) AS questions_above_threshold,
    COUNT(DISTINCT recipe_id) AS total_recipes,
    
    -- Success rate
    ROUND(
      (100.0 * COUNT(DISTINCT CASE WHEN evaluator_score >= 0.85 THEN id END)
      / NULLIF(COUNT(DISTINCT id), 0))::numeric,
      2
    ) AS success_percentage,
    
    -- Extract metadata from any question (using MAX to get a single value)
    MAX(inference_params->'item_inference_params'->>'prompt_id') AS prompt_id,
    MAX((inference_params->'item_inference_params'->>'temperature')::numeric) AS temperature,
    MAX(inference_params->'run_metadata'->>'provider') AS provider,
    MAX(inference_params->'run_metadata'->>'method') AS method,
    
    -- Overall latency metrics
    ROUND(AVG((inference_params->'item_inference_params'->>'ttft_ms')::numeric)::numeric, 2) AS avg_ttft_ms,
    ROUND(AVG((inference_params->'item_inference_params'->>'total_generation_time_ms')::numeric)::numeric, 2) AS avg_total_generation_ms,
    
    -- Quality metrics
    ROUND(AVG(evaluator_score)::numeric, 3) AS avg_evaluator_score,
    
    -- Timestamps
    MIN(created_at) AS first_question_created,
    MAX(created_at) AS last_question_created,
    MAX(evaluated_at) AS last_evaluated_at
    
  FROM experiment_data
  GROUP BY experiment_tracker, model;
`;

/**
 * Experiment Scores Query
 * 
 * Fetches individual evaluator scores for score distribution visualization.
 * Includes question_id, recipe_id, difficulty, and evaluator_parsed_response for feedback analysis.
 * Extracts difficulty from model_parsed_response first, then falls back to inference_params.
 * 
 * Parameters:
 *  $1: experiment_tracker (required) - the experiment identifier
 *  $2: subject (optional) - filter by subject, pass NULL for all
 *  $3: grade_level (optional) - filter by grade level, pass NULL for all
 *  $4: question_type (optional) - filter by question type, pass NULL for all
 */
export const EXPERIMENT_SCORES = `
  SELECT
    gq.id AS question_id,
    qr.recipe_id,
    aer.evaluator_score,
    COALESCE(
      gq.model_parsed_response->>'difficulty',
      gq.inference_params->'item_inference_params'->>'target_difficulty',
      gq.inference_params->>'difficulty_assigned',
      gq.inference_params->>'difficulty'
    ) AS difficulty
  FROM public.generated_questions AS gq
  JOIN public.ai_evaluation_results AS aer
    ON aer.question_id = gq.id
  JOIN public.question_recipes AS qr
    ON gq.recipe_id = qr.recipe_id
  WHERE gq.experiment_tracker = $1
    AND ($2::text IS NULL OR LOWER(qr.subject) = LOWER($2))
    AND ($3::text IS NULL OR qr.grade_level = $3)
    AND ($4::text IS NULL OR LOWER(gq.question_type) = LOWER($4))
    AND aer.evaluator_version = $5
  ORDER BY aer.evaluator_score;
`;

/**
 * Fetch Evaluations Query
 * 
 * Fetches evaluations with model_parsed_response, prompt_text, and evaluator_parsed_response.
 * Filters by difficulty and score threshold.
 * Extracts difficulty from model_parsed_response first, then falls back to inference_params.
 * 
 * Parameters:
 *  $1: experiment_tracker (required) - the experiment identifier
 *  $2: subject (required) - filter by subject
 *  $3: difficulty (optional) - filter by difficulty, pass NULL for all
 *  $4: max_score (optional) - maximum evaluator score threshold, pass NULL for no filter
 *  $5: grade_level (optional) - filter by grade level, pass NULL for all
 *  $6: question_type (optional) - filter by question type, pass NULL for all
 */
export const FETCH_EVALUATIONS = `
  SELECT
    gq.id AS question_id,
    qr.recipe_id,
    gq.model_parsed_response,
    gq.model_raw_response,
    gq.prompt_text,
    gq.inference_params,
    aer.evaluator_parsed_response,
    aer.evaluator_score,
    COALESCE(
      gq.model_parsed_response->>'difficulty',
      gq.inference_params->'item_inference_params'->>'target_difficulty',
      gq.inference_params->>'difficulty_assigned',
      gq.inference_params->>'difficulty'
    ) AS difficulty,
    gq.experiment_tracker,
    gq.model,
    qr.subject,
    qr.grade_level,
    gq.question_type,
    gq.created_at,
    aer.evaluated_at
  FROM public.generated_questions AS gq
  JOIN public.ai_evaluation_results AS aer
    ON aer.question_id = gq.id
  JOIN public.question_recipes AS qr
    ON gq.recipe_id = qr.recipe_id
  WHERE gq.experiment_tracker = $1
    AND LOWER(qr.subject) = LOWER($2)
    AND aer.evaluator_version = '2.0.0'
    AND ($3::text IS NULL OR LOWER(COALESCE(
      gq.model_parsed_response->>'difficulty',
      gq.inference_params->'item_inference_params'->>'target_difficulty',
      gq.inference_params->>'difficulty_assigned',
      gq.inference_params->>'difficulty'
    )) = LOWER($3))
    AND ($4::numeric IS NULL OR aer.evaluator_score <= $4)
    AND ($5::text IS NULL OR qr.grade_level = $5)
    AND ($6::text IS NULL OR LOWER(gq.question_type) = LOWER($6))
  ORDER BY aer.evaluator_score ASC, gq.created_at DESC
  LIMIT 500;
`;

/**
 * Latency by Performance Query
 * 
 * Analyzes latency metrics segmented by model performance (evaluator scores).
 * Shows timing data for top 10% performers vs bottom 10% performers to identify
 * correlations between generation speed and quality.
 * 
 * Parameters:
 *  $1: experiment_tracker (required) - the experiment identifier
 *  $2: subject (optional) - filter by subject, pass NULL for all
 *  $3: grade_level (optional) - filter by grade level, pass NULL for all
 *  $4: question_type (optional) - filter by question type, pass NULL for all
 */
export const LATENCY_BY_PERFORMANCE = `
  WITH score_percentiles AS (
    -- Calculate the score thresholds for top/bottom 10%
    SELECT
      PERCENTILE_CONT(0.10) WITHIN GROUP (ORDER BY aer.evaluator_score) AS p10_score,
      PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY aer.evaluator_score) AS p90_score
    FROM public.generated_questions AS gq
    JOIN public.ai_evaluation_results AS aer
      ON aer.question_id = gq.id
    JOIN public.question_recipes AS qr
      ON gq.recipe_id = qr.recipe_id
    WHERE gq.experiment_tracker = $1
      AND aer.evaluator_version = '2.0.0'
      AND ($2::text IS NULL OR LOWER(qr.subject) = LOWER($2))
      AND ($3::text IS NULL OR qr.grade_level = $3)
      AND ($4::text IS NULL OR LOWER(gq.question_type) = LOWER($4))
      AND (gq.inference_params->'item_inference_params'->>'ttft_ms') IS NOT NULL
      AND (gq.inference_params->'item_inference_params'->>'total_generation_time_ms') IS NOT NULL
  ),
  segmented_data AS (
    SELECT
      gq.id,
      aer.evaluator_score,
      (gq.inference_params->'item_inference_params'->>'ttft_ms')::numeric AS ttft_ms,
      (gq.inference_params->'item_inference_params'->>'total_generation_time_ms')::numeric AS total_generation_ms,
      COALESCE(
        gq.model_parsed_response->>'difficulty',
        gq.inference_params->'item_inference_params'->>'target_difficulty',
        gq.inference_params->>'difficulty_assigned',
        gq.inference_params->>'difficulty'
      ) AS difficulty,
      CASE
        WHEN aer.evaluator_score >= sp.p90_score THEN 'Top 10%'
        WHEN aer.evaluator_score <= sp.p10_score THEN 'Bottom 10%'
        ELSE 'Middle 80%'
      END AS performance_segment,
      sp.p10_score,
      sp.p90_score
    FROM public.generated_questions AS gq
    JOIN public.ai_evaluation_results AS aer
      ON aer.question_id = gq.id
    JOIN public.question_recipes AS qr
      ON gq.recipe_id = qr.recipe_id
    CROSS JOIN score_percentiles sp
    WHERE gq.experiment_tracker = $1
      AND aer.evaluator_version = '2.0.0'
      AND ($2::text IS NULL OR LOWER(qr.subject) = LOWER($2))
      AND ($3::text IS NULL OR qr.grade_level = $3)
      AND ($4::text IS NULL OR LOWER(gq.question_type) = LOWER($4))
      AND (gq.inference_params->'item_inference_params'->>'ttft_ms') IS NOT NULL
      AND (gq.inference_params->'item_inference_params'->>'total_generation_time_ms') IS NOT NULL
  )
  SELECT
    performance_segment,
    COUNT(*) AS question_count,
    
    -- Score statistics
    ROUND(MIN(evaluator_score)::numeric, 3) AS min_score,
    ROUND(MAX(evaluator_score)::numeric, 3) AS max_score,
    ROUND(AVG(evaluator_score)::numeric, 3) AS avg_score,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY evaluator_score)::numeric, 3) AS median_score,
    
    -- TTFT (Time To First Token) latency metrics
    ROUND(AVG(ttft_ms)::numeric, 2) AS avg_ttft_ms,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ttft_ms)::numeric, 2) AS median_ttft_ms,
    ROUND(PERCENTILE_CONT(0.10) WITHIN GROUP (ORDER BY ttft_ms)::numeric, 2) AS p10_ttft_ms,
    ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY ttft_ms)::numeric, 2) AS p90_ttft_ms,
    ROUND(MIN(ttft_ms)::numeric, 2) AS min_ttft_ms,
    ROUND(MAX(ttft_ms)::numeric, 2) AS max_ttft_ms,
    
    -- Total generation time latency metrics
    ROUND(AVG(total_generation_ms)::numeric, 2) AS avg_total_generation_ms,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total_generation_ms)::numeric, 2) AS median_total_generation_ms,
    ROUND(PERCENTILE_CONT(0.10) WITHIN GROUP (ORDER BY total_generation_ms)::numeric, 2) AS p10_total_generation_ms,
    ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY total_generation_ms)::numeric, 2) AS p90_total_generation_ms,
    ROUND(MIN(total_generation_ms)::numeric, 2) AS min_total_generation_ms,
    ROUND(MAX(total_generation_ms)::numeric, 2) AS max_total_generation_ms,
    
    -- Score thresholds for reference
    ROUND(MAX(p10_score)::numeric, 3) AS score_threshold_bottom_10pct,
    ROUND(MAX(p90_score)::numeric, 3) AS score_threshold_top_10pct
    
  FROM segmented_data
  WHERE performance_segment IN ('Top 10%', 'Bottom 10%')
  GROUP BY performance_segment
  ORDER BY 
    CASE performance_segment
      WHEN 'Top 10%' THEN 1
      WHEN 'Bottom 10%' THEN 2
    END;
`;

/**
 * Question Recipes Query
 * 
 * Fetches question recipes filtered by grade level and subject.
 * Only returns recipes with a valid standard_id_l1 (not null and not empty).
 * 
 * Parameters:
 *  $1: grade_level (required) - e.g., '3', '4'
 *  $2: subject (required) - e.g., 'ela', 'math'
 */
export const QUESTION_RECIPES_BY_FILTERS = `
  SELECT
    recipe_id,
    source_sheet,
    grade_level,
    subject,
    domain,
    cluster,
    standard_id_l1,
    standard_desc_l1,
    standard_id_l2,
    standard_desc_l2,
    substandard_id,
    lesson_title,
    question_type,
    tasks,
    difficulty,
    constraints,
    direct_instruction,
    step_by_step_explanation,
    misconception_1,
    misconception_2,
    misconception_3,
    misconception_4,
    created_at
  FROM public.question_recipes
  WHERE grade_level = $1
    AND LOWER(subject) = LOWER($2)
    AND standard_id_l1 IS NOT NULL
    AND standard_id_l1 != ''
  ORDER BY recipe_id;
`;

// Optional map so you can look queries up dynamically if you like.
export const SQL_QUERIES = {
  LEADERBOARD_BY_SUBJECT,
  LEADERBOARD_MV_1_5_4,
  LEADERBOARD_MV_1_5_4_ATTACHMENT_FILTERED,
  LEADERBOARD_MV_2_0_0,
  LEADERBOARD_MV_2_0_0_ATTACHMENT_FILTERED,
  LATENCY_SUMMARY_BY_DIFFICULTY,
  EXPERIMENT_REPORT,
  EXPERIMENT_SUMMARY,
  EXPERIMENT_SCORES,
  FETCH_EVALUATIONS,
  LATENCY_BY_PERFORMANCE,
  QUESTION_RECIPES_BY_FILTERS,
};

export type SqlQueryKey = keyof typeof SQL_QUERIES;


