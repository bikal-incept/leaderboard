import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { LEADERBOARD_MV_1_5_4, LEADERBOARD_MV_2_0_0, EXPERIMENT_REPORT, EXPERIMENT_SUMMARY, EXPERIMENT_SCORES, FETCH_EVALUATIONS } from './services/queries';
import { query } from './services/db';

/**
 * Lightweight dev-time API for `/api/leaderboard`, `/api/experiment-report`, and `/api/experiment-summary`.
 *
 * Vite runs this plugin in a Node environment, so we can safely talk to
 * Postgres using the shared `services/db` helper and the SQL defined in
 * `services/queries`.
 */
const apiPlugin = (): Plugin => ({
  name: 'api-plugin',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      // Only handle API routes
      if (!req.url?.startsWith('/api/')) {
        return next();
      }

      if (req.method !== 'GET') {
        res.statusCode = 405;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
      }

      try {
        const url = new URL(req.url, 'http://localhost');

        // Handle /api/leaderboard
        if (req.url.startsWith('/api/leaderboard')) {
          try {
            const subject = (url.searchParams.get('subject') ?? 'ela').toLowerCase();
            const gradeLevel = url.searchParams.get('grade_level') || null;
            const questionType = url.searchParams.get('question_type') || null;
            const minTotalQuestions = url.searchParams.get('min_total_questions');
            const minTotalQuestionsInt = minTotalQuestions ? parseInt(minTotalQuestions, 10) : null;
            const evaluatorVersion = url.searchParams.get('evaluator_version') || '2.0.0';

            console.log('[API] /api/leaderboard request:', {
              subject,
              gradeLevel,
              questionType,
              minTotalQuestions: minTotalQuestionsInt,
              evaluatorVersion
            });

            // Use the appropriate materialized view based on evaluator version
            // Default to 2.0.0 for new leaderboard
            const queryToUse = evaluatorVersion === '1.5.4' ? LEADERBOARD_MV_1_5_4 : LEADERBOARD_MV_2_0_0;
            
            console.log('[API] Using query:', evaluatorVersion === '1.5.4' ? 'LEADERBOARD_MV_1_5_4' : 'LEADERBOARD_MV_2_0_0');
            
            // Parameters: subject, grade_level, question_type, min_total_questions
            // Convert empty strings to null for SQL query
            const { rows } = await query(queryToUse, [
              subject,
              gradeLevel && gradeLevel.trim() !== '' ? gradeLevel : null,
              questionType && questionType.trim() !== '' ? questionType : null,
              minTotalQuestionsInt && minTotalQuestionsInt > 0 ? minTotalQuestionsInt : null
            ]);

            console.log('[API] Query returned', rows?.length || 0, 'rows');

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(rows || []));
            return;
          } catch (err: any) {
            console.error('[API] Error in /api/leaderboard:', err);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              error: 'Failed to load leaderboard data',
              message: err.message,
              stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
            }));
            return;
          }
        }

        // Handle /api/experiment-report
        if (req.url.startsWith('/api/experiment-report')) {
          const experimentTracker = url.searchParams.get('experiment_tracker');
          
          if (!experimentTracker) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'experiment_tracker parameter is required' }));
            return;
          }

          const subject = url.searchParams.get('subject') || null;
          const gradeLevel = url.searchParams.get('grade_level') || null;
          const questionType = url.searchParams.get('question_type') || null;

          // Execute EXPERIMENT_REPORT query
          // Parameters: experiment_tracker, subject, grade_level, question_type
          const { rows } = await query(EXPERIMENT_REPORT, [
            experimentTracker,
            subject,
            gradeLevel,
            questionType
          ]);

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(rows));
          return;
        }

        // Handle /api/experiment-summary
        if (req.url.startsWith('/api/experiment-summary')) {
          const experimentTracker = url.searchParams.get('experiment_tracker');
          
          if (!experimentTracker) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'experiment_tracker parameter is required' }));
            return;
          }

          const subject = url.searchParams.get('subject') || null;
          const gradeLevel = url.searchParams.get('grade_level') || null;
          const questionType = url.searchParams.get('question_type') || null;

          // Execute EXPERIMENT_SUMMARY query
          // Parameters: experiment_tracker, subject, grade_level, question_type
          const { rows } = await query(EXPERIMENT_SUMMARY, [
            experimentTracker,
            subject,
            gradeLevel,
            questionType
          ]);

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(rows.length > 0 ? rows[0] : null));
          return;
        }

        // Handle /api/experiment-scores
        if (req.url.startsWith('/api/experiment-scores')) {
          const experimentTracker = url.searchParams.get('experiment_tracker');
          
          if (!experimentTracker) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'experiment_tracker parameter is required' }));
            return;
          }

          const subject = url.searchParams.get('subject') || null;
          const gradeLevel = url.searchParams.get('grade_level') || null;
          const questionType = url.searchParams.get('question_type') || null;

          // Execute EXPERIMENT_SCORES query
          // Parameters: experiment_tracker, subject, grade_level, question_type
          const { rows } = await query(EXPERIMENT_SCORES, [
            experimentTracker,
            subject,
            gradeLevel,
            questionType
          ]);

          // Return full score objects with metadata
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(rows));
          return;
        }

        // Handle /api/evaluations
        if (req.url.startsWith('/api/evaluations')) {
          const experimentTracker = url.searchParams.get('experiment_tracker');
          const subject = url.searchParams.get('subject');
          
          if (!experimentTracker || !subject) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'experiment_tracker and subject parameters are required' }));
            return;
          }

          const difficulty = url.searchParams.get('difficulty') || null;
          const maxScore = url.searchParams.get('max_score');
          const maxScoreNum = maxScore ? parseFloat(maxScore) : null;
          const gradeLevel = url.searchParams.get('grade_level') || null;
          const questionType = url.searchParams.get('question_type') || null;

          // Execute FETCH_EVALUATIONS query
          // Parameters: experiment_tracker, subject, difficulty, max_score, grade_level, question_type
          const { rows } = await query(FETCH_EVALUATIONS, [
            experimentTracker,
            subject,
            difficulty,
            maxScoreNum,
            gradeLevel,
            questionType
          ]);

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(rows));
          return;
        }

        // Unknown API endpoint
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'API endpoint not found' }));

      } catch (err: any) {
        console.error('Error in API handler', err);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify({
            error: 'Failed to load data',
            message: err.message,
          }),
        );
      }
    });
  },
});

export default defineConfig({
  plugins: [react(), apiPlugin()],
  server: {
    port: 5173,
    host: true,
    allowedHosts: [
      'ec2-100-22-145-138.us-west-2.compute.amazonaws.com',
    ],
  },
});
