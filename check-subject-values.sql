-- Check what subject values exist in the 1.5.4 view

-- 1. Show all unique subjects (case-sensitive)
SELECT DISTINCT subject, COUNT(*) as row_count
FROM mv_leaderboard_stats_1_5_4
GROUP BY subject
ORDER BY subject;

-- 2. Show subjects with various case checks
SELECT 
  subject,
  LOWER(subject) as lowercase_subject,
  UPPER(subject) as uppercase_subject,
  COUNT(*) as row_count
FROM mv_leaderboard_stats_1_5_4
GROUP BY subject
ORDER BY subject;

-- 3. Check if there are any rows with 'ELA' (uppercase)
SELECT COUNT(*) as ela_uppercase_count
FROM mv_leaderboard_stats_1_5_4
WHERE subject = 'ELA';

-- 4. Check with case-insensitive comparison
SELECT COUNT(*) as ela_case_insensitive_count
FROM mv_leaderboard_stats_1_5_4
WHERE LOWER(subject) = LOWER('ela');

-- 5. Show sample rows to see actual data
SELECT 
  subject,
  experiment_tracker,
  grade_level,
  question_type,
  difficulty,
  total_questions,
  percentage
FROM mv_leaderboard_stats_1_5_4
LIMIT 20;

