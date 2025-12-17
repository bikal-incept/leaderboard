import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'fs';
import { join } from 'path';
import { LEADERBOARD_MV_1_5_4, LEADERBOARD_MV_1_5_4_ATTACHMENT_FILTERED, LEADERBOARD_MV_2_0_0, LEADERBOARD_MV_2_0_0_ATTACHMENT_FILTERED, EXPERIMENT_REPORT, EXPERIMENT_SUMMARY, EXPERIMENT_SCORES, FETCH_EVALUATIONS, QUESTION_RECIPES_BY_FILTERS } from './services/queries';
import { query } from './services/db';
import { BLOCKED_STANDARDS_SET, BLOCKED_COMMON_CORE_STANDARDS_SET } from './src/config/blockedStandards';

// Load and parse CSV to get Common Core standards for blocked curriculum codes
function loadBlockedCommonCoreStandards() {
  try {
    const csvPath = './src/data/Reading_Curriculum.csv';
    const csvContent = readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n');
    
    if (lines.length < 2) {
      console.error('[Vite Config] CSV file is empty or invalid');
      return;
    }
    
    // Parse CSV headers - be more lenient with parsing
    const headerLine = lines[0];
    const headers: string[] = [];
    let currentHeader = '';
    let inQuotes = false;
    
    for (let i = 0; i < headerLine.length; i++) {
      const char = headerLine[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        headers.push(currentHeader.trim().replace(/^"|"$/g, ''));
        currentHeader = '';
      } else {
        currentHeader += char;
      }
    }
    headers.push(currentHeader.trim().replace(/^"|"$/g, ''));
    
    const nameIndex = headers.findIndex(h => h.toLowerCase() === 'name');
    const standardCodeIndex = headers.findIndex(h => h.toLowerCase().includes('standard_code'));
    
    console.log('[Vite Config] Loading blocked Common Core standards from CSV...');
    console.log('[Vite Config] Headers found:', headers.slice(0, 5));
    console.log('[Vite Config] Name column index:', nameIndex, 'Standard code index:', standardCodeIndex);
    
    if (nameIndex === -1 || standardCodeIndex === -1) {
      console.error('[Vite Config] Could not find required columns');
      return;
    }
    
    let processedCount = 0;
    let blockedCount = 0;
    
    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // CSV parsing handling quoted fields
      const fields: string[] = [];
      let currentField = '';
      let inQuotes = false;
      
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"' && (j === 0 || line[j-1] !== '\\')) {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          fields.push(currentField.trim().replace(/^"|"$/g, ''));
          currentField = '';
        } else {
          currentField += char;
        }
      }
      fields.push(currentField.trim().replace(/^"|"$/g, ''));
      
      if (fields.length < Math.max(nameIndex, standardCodeIndex) + 1) {
        continue;
      }
      
      const curriculumCode = fields[nameIndex]?.trim();
      const commonCoreStandards = fields[standardCodeIndex]?.trim();
      
      processedCount++;
      
      // If this curriculum code is in our blocked list, add its Common Core standards
      if (curriculumCode && BLOCKED_STANDARDS_SET.has(curriculumCode) && commonCoreStandards) {
        const standards = commonCoreStandards.split(',').map(s => s.trim()).filter(s => s && s.length > 0);
        if (standards.length > 0) {
          blockedCount++;
          standards.forEach(std => {
            BLOCKED_COMMON_CORE_STANDARDS_SET.add(std);
          });
        }
      }
    }
    
    console.log('[Vite Config] Processed', processedCount, 'CSV rows');
    console.log('[Vite Config] Found', blockedCount, 'blocked curriculum codes with Common Core standards');
    console.log('[Vite Config] Loaded', BLOCKED_COMMON_CORE_STANDARDS_SET.size, 'unique Common Core standards to block');
    console.log('[Vite Config] Sample blocked Common Core standards:', Array.from(BLOCKED_COMMON_CORE_STANDARDS_SET).slice(0, 10));
  } catch (err: any) {
    console.error('[Vite Config] Error loading blocked Common Core standards:', err.message);
    console.error('[Vite Config] Stack:', err.stack);
  }
}

// Execute the loading
loadBlockedCommonCoreStandards();

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
            const viewMode = url.searchParams.get('view_mode') || 'attachment_filtered';

            console.log('[API] /api/leaderboard request:', {
              subject,
              gradeLevel,
              questionType,
              minTotalQuestions: minTotalQuestionsInt,
              evaluatorVersion,
              viewMode
            });

            // Use the appropriate materialized view based on evaluator version and view mode
            let queryToUse;
            let queryName;
            
            if (evaluatorVersion === '1.5.4') {
              // For 1.5.4, always use the base view (no filtering)
              queryToUse = LEADERBOARD_MV_1_5_4;
              queryName = 'LEADERBOARD_MV_1_5_4';
            } else if (viewMode === 'all') {
              // 2.0.0: Explicitly show ALL recipes including multimedia-required ones
              queryToUse = LEADERBOARD_MV_2_0_0;
              queryName = 'LEADERBOARD_MV_2_0_0 (all recipes including multimedia)';
            } else {
              // 2.0.0 Default: exclude 48 image-required recipes
              queryToUse = LEADERBOARD_MV_2_0_0_ATTACHMENT_FILTERED;
              queryName = 'LEADERBOARD_MV_2_0_0_ATTACHMENT_FILTERED (48 recipes excluded)';
            }
            
            console.log('[API] Using query:', queryName);
            
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

        // Handle /api/recipes
        if (req.url.startsWith('/api/recipes')) {
          const gradeLevel = url.searchParams.get('grade_level') || '3';
          const subject = url.searchParams.get('subject') || 'ela';
          const includeMultimedia = url.searchParams.get('include_multimedia') === 'true';

          // Recipe IDs that require image attachments (48 recipes)
          const IMAGE_REQUIRED_RECIPE_IDS = new Set([
            1117, 840, 904, 910, 934, 955, 1073, 1096, 1110, 1121,
            841, 1400, 1696, 1786, 1979, 1185, 842, 843, 844, 855,
            856, 871, 873, 881, 882, 883, 896, 898, 966, 920,
            929, 939, 940, 988, 989, 990, 991, 1088, 1130, 1172,
            1337, 1345, 1419, 1432, 1514, 1651, 1873, 1997
          ]);

          console.log('[API] /api/recipes request:', {
            gradeLevel,
            subject,
            includeMultimedia,
            imageRequiredRecipesCount: IMAGE_REQUIRED_RECIPE_IDS.size
          });

          // Execute QUESTION_RECIPES_BY_FILTERS query
          // Parameters: grade_level, subject
          const { rows } = await query(QUESTION_RECIPES_BY_FILTERS, [
            gradeLevel,
            subject
          ]);

          // Filter out image-required recipes unless explicitly requested
          let filteredRows = rows;
          if (!includeMultimedia) {
            filteredRows = rows.filter(row => {
              const recipeId = row.recipe_id;
              return !IMAGE_REQUIRED_RECIPE_IDS.has(recipeId);
            });
          }

          console.log(`[API] Query returned ${rows?.length || 0} rows, filtered to ${filteredRows.length} (excluded ${(rows?.length || 0) - filteredRows.length} image-required recipes)`);
          
          if ((rows?.length || 0) - filteredRows.length > 0) {
            // Log some examples of what was filtered
            const blocked = rows.filter(r => !filteredRows.includes(r)).slice(0, 3);
            console.log('[API] Sample image-required recipes excluded:', blocked.map(r => ({ id: r.recipe_id, standard: r.standard_id_l1 })));
          }

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(filteredRows));
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
