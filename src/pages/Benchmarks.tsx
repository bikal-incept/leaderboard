import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowUpDown, FileText, Copy, Check, ChevronDown, ChevronUp, Filter, Eye, X, TrendingUp, Download, AlertCircle } from 'lucide-react';
import { leaderboardData, type LeaderboardRow } from '../data/leaderboardData';
import { shouldHighlightExperiment, isExperimentBlocked } from '../config/blockedExperiments';
import { getInceptLabsExperiments, getFieldExperiments, getOverallComparisonExperimentTuples } from '../config/comparisonExperiments';

const SUBJECTS = ['language', 'reading', '(r+l)-ela', 'ela', 'math'] as const;
type Subject = (typeof SUBJECTS)[number];

type SortConfig = {
  key: 'rank' | 'model' | 'score' | 'votes';
  direction: 'asc' | 'desc';
};

// Comparison data types
interface ComparisonStats {
  overallPercentage: number;
  totalQuestionsAboveThreshold: number;
  totalQuestions: number;
  p10: number;
  p90: number;
  byDifficulty: {
    Easy: { percentage: number; questionsAboveThreshold: number; totalQuestions: number } | null;
    Medium: { percentage: number; questionsAboveThreshold: number; totalQuestions: number } | null;
    Hard: { percentage: number; questionsAboveThreshold: number; totalQuestions: number } | null;
  };
}

// Helper function to calculate percentile
function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (percentile / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index % 1;
  
  if (lower === upper) {
    return sorted[lower];
  }
  
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

// Helper function to calculate comparison stats for a group of experiments
type ExperimentConfig = { easy: string; medium: string; hard: string };

function calculateComparisonStats(rows: LeaderboardRow[], experimentConfig: ExperimentConfig): ComparisonStats {
  const easyRow = rows.find(r => r.model === experimentConfig.easy && r.difficulty === 'Easy');
  const mediumRow = rows.find(r => r.model === experimentConfig.medium && r.difficulty === 'Medium');
  const hardRow = rows.find(r => r.model === experimentConfig.hard && r.difficulty === 'Hard');
  
  const allRows = [easyRow, mediumRow, hardRow].filter((r): r is LeaderboardRow => r !== undefined);
  
  // Calculate overall stats
  const totalQuestionsAboveThreshold = allRows.reduce((sum, r) => sum + r.questionsAboveThreshold, 0);
  const totalQuestions = allRows.reduce((sum, r) => sum + r.totalQuestions, 0);
  const overallPercentage = totalQuestions > 0 ? (totalQuestionsAboveThreshold / totalQuestions) * 100 : 0;
  
  // Calculate percentiles from the percentages of available experiments
  const percentages = allRows.map(r => r.percentage);
  const p10 = calculatePercentile(percentages, 10);
  const p90 = calculatePercentile(percentages, 90);
  
  // By difficulty stats
  const byDifficulty = {
    Easy: easyRow ? {
      percentage: easyRow.percentage,
      questionsAboveThreshold: easyRow.questionsAboveThreshold,
      totalQuestions: easyRow.totalQuestions
    } : null,
    Medium: mediumRow ? {
      percentage: mediumRow.percentage,
      questionsAboveThreshold: mediumRow.questionsAboveThreshold,
      totalQuestions: mediumRow.totalQuestions
    } : null,
    Hard: hardRow ? {
      percentage: hardRow.percentage,
      questionsAboveThreshold: hardRow.questionsAboveThreshold,
      totalQuestions: hardRow.totalQuestions
    } : null,
  };
  
  return {
    overallPercentage,
    totalQuestionsAboveThreshold,
    totalQuestions,
    p10,
    p90,
    byDifficulty,
  };
}

const Benchmarks: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Helper to get subject-specific defaults
  const getDefaultMinQuestions = (subject: Subject): number => {
    if (subject === 'math') return 120;
    if (subject === 'ela') return 60;
    if (subject === 'reading') return 50;
    if (subject === '(r+l)-ela') return 50;
    return 50; // language
  };

  // Initialize state from URL params (or use defaults)
  const [selectedSubject, setSelectedSubject] = useState<Subject>(() => {
    const urlSubject = searchParams.get('subject') as Subject | null;
    return (urlSubject && SUBJECTS.includes(urlSubject)) ? urlSubject : 'language';
  });

  // Evaluator version: '1.5.4', '2.0.0', or '2.1.0'
  const [evaluatorVersion, setEvaluatorVersion] = useState<'1.5.4' | '2.0.0' | '2.1.0'>(() => {
    const urlVersion = searchParams.get('evaluator_version');
    if (urlVersion === '1.5.4' || urlVersion === '2.0.0' || urlVersion === '2.1.0') {
      return urlVersion;
    }
    // Default to 2.1.0 for language, 2.0.0 for others
    const urlSubject = searchParams.get('subject') as Subject | null;
    const subject = (urlSubject && SUBJECTS.includes(urlSubject)) ? urlSubject : 'language';
    return subject === 'language' ? '2.1.0' : '2.0.0';
  });

  // View mode: 'all' for all data, 'attachment_filtered' for blocked standards excluded
  // For version 2.1.0, always use 'all' (no attachment filtering available)
  const [viewMode, setViewMode] = useState<'all' | 'attachment_filtered'>(() => {
    // If evaluator is 2.1.0, force 'all' mode
    const urlVersion = searchParams.get('evaluator_version');
    if (urlVersion === '2.1.0') {
      return 'all';
    }
    const urlViewMode = searchParams.get('view_mode');
    return (urlViewMode === 'all' || urlViewMode === 'attachment_filtered') ? urlViewMode : 'attachment_filtered';
  });

  // Filter states - single source of truth (no pending/applied split)
  const [gradeLevel, setGradeLevel] = useState<string>(() => {
    return searchParams.get('grade_level') || '';
  });
  
  const [questionType, setQuestionType] = useState<string>(() => {
    return searchParams.get('question_type') || 'mcq';
  });
  
  const [minTotalQuestions, setMinTotalQuestions] = useState<number>(() => {
    const urlMin = searchParams.get('min_total_questions');
    if (urlMin) return parseInt(urlMin, 10);
    return getDefaultMinQuestions(selectedSubject);
  });

  const [leaderboardRows, setLeaderboardRows] = useState<LeaderboardRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedExperiment, setCopiedExperiment] = useState<string | null>(null);
  const [addedToCache, setAddedToCache] = useState<string | null>(null);
  const [isCaching, setIsCaching] = useState<string | null>(null);
  
  // Modal states
  const [difficultyModalOpen, setDifficultyModalOpen] = useState(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null);
  const [topPerformersModalOpen, setTopPerformersModalOpen] = useState(false);

  // Cache helpers (match Evaluations/CompareReports)
  const CACHE_KEY = 'experiment_reports_cache';
  const MAX_CACHE_ITEMS = 4;

  const getCacheKey = (filters: { experiment_tracker: string; subject: string; grade_level: string; question_type: string; evaluator_version: string }) => {
    return `${filters.experiment_tracker}|${filters.subject}|${filters.grade_level}|${filters.question_type}|${filters.evaluator_version}`;
  };

  const loadCache = () => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (!cached) return [];
    const parsed = JSON.parse(cached);
    const cleaned = parsed.filter((item: any) => item.experiment_tracker && item.reportData !== undefined);
      cleaned.sort((a: any, b: any) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
      return cleaned.slice(0, MAX_CACHE_ITEMS);
    } catch (err) {
      console.error('[Benchmarks Cache] Failed to load cache', err);
      return [];
    }
  };

  const saveToCache = (
    filters: { experiment_tracker: string; subject: string; grade_level: string; question_type: string; evaluator_version: string },
    reportData: any[],
    summaryData: any,
    scoresData: any[]
  ) => {
    if (!reportData || reportData.length === 0) {
      console.warn('[Benchmarks Cache] Skipping cache - no report data');
      return;
    }
    try {
      const cache = loadCache();
      const cacheKey = getCacheKey(filters);
      const filteredCache = cache.filter((item: any) => getCacheKey(item) !== cacheKey);
      const newEntry = {
        ...filters,
        timestamp: Date.now(),
        reportData,
        summaryData,
        scoresData,
      };
      const newCache = [newEntry, ...filteredCache].slice(0, MAX_CACHE_ITEMS);

      const persistCache = (data: any[]) => localStorage.setItem(CACHE_KEY, JSON.stringify(data));

      try {
        persistCache(newCache);
        console.log('[Benchmarks Cache] Cached experiment', filters.experiment_tracker);
      } catch (quotaError: any) {
        if (quotaError?.name === 'QuotaExceededError') {
          console.warn('[Benchmarks Cache] Quota exceeded, attempting LRU eviction');

          if (filteredCache.length > 0) {
            const reducedCache = [newEntry, ...filteredCache.slice(0, -1)];
            try {
              persistCache(reducedCache);
              console.log('[Benchmarks Cache] Saved after evicting oldest item');
            } catch (secondError: any) {
              if (reducedCache.length > 1) {
                const minimalCache = [newEntry];
                try {
                  persistCache(minimalCache);
                  console.log('[Benchmarks Cache] Saved with minimal cache (1 item)');
                } catch (finalError) {
                  console.error('[Benchmarks Cache] Failed even with minimal cache. Data may be too large.', finalError);
                }
              } else {
                console.error('[Benchmarks Cache] Single item too large for localStorage', secondError);
              }
            }
          } else {
            console.error('[Benchmarks Cache] Cannot save - single report exceeds localStorage quota');
          }
        } else {
          throw quotaError;
        }
      }
    } catch (err) {
      console.error('[Benchmarks Cache] Failed to save cache', err);
    }
  };

  // Force viewMode to 'all' when evaluator version is 2.1.0
  useEffect(() => {
    if (evaluatorVersion === '2.1.0' && viewMode !== 'all') {
      setViewMode('all');
    }
  }, [evaluatorVersion, viewMode]);

  // Sync filter state to URL params
  useEffect(() => {
    const params = new URLSearchParams();
    
    // Always include subject
    params.set('subject', selectedSubject);
    
    // Include optional filters only if set
    if (gradeLevel) params.set('grade_level', gradeLevel);
    if (questionType) params.set('question_type', questionType);
    if (minTotalQuestions > 0) params.set('min_total_questions', minTotalQuestions.toString());
    
    // Include evaluator version and view mode
    params.set('evaluator_version', evaluatorVersion);
    params.set('view_mode', viewMode);
    
    setSearchParams(params, { replace: true });
  }, [selectedSubject, gradeLevel, questionType, minTotalQuestions, evaluatorVersion, viewMode, setSearchParams]);

  useEffect(() => {
    let isCancelled = false;

    async function loadLeaderboard() {
      setIsLoading(true);
      setError(null);

      try {
        // Backend endpoint is expected to execute the LEADERBOARD_BY_SUBJECT SQL
        // query and return rows matching the LeaderboardRow shape (or with
        // snake_case column names from the SQL, which we normalize below).
        // Subject is stored lowercase to match backend expectations (DB stores subject in lowercase).
        
        // Special handling for (R+L)-ELA: fetch both reading and language, then combine
        if (selectedSubject === '(r+l)-ela') {
          console.log('[Leaderboard] Fetching combined Reading + Language data for (R+L)-ELA...');
          
          const params = new URLSearchParams({
            evaluator_version: evaluatorVersion,
            view_mode: viewMode,
            ...(gradeLevel && { grade_level: gradeLevel }),
            ...(questionType && { question_type: questionType }),
            ...(minTotalQuestions > 0 && { min_total_questions: minTotalQuestions.toString() }),
          });

          // Fetch both reading and language in parallel
          const [readingResponse, languageResponse] = await Promise.all([
            fetch(`/api/leaderboard?subject=reading&${params.toString()}`),
            fetch(`/api/leaderboard?subject=language&${params.toString()}`),
          ]);

          if (!readingResponse.ok || !languageResponse.ok) {
            throw new Error('Failed to fetch reading or language data');
          }

          const [readingData, languageData] = await Promise.all([
            readingResponse.json(),
            languageResponse.json(),
          ]);

          if (isCancelled) return;

          // Find experiments that exist in BOTH reading and language (intersection)
          const readingExperiments = new Set(
            (readingData ?? []).map((row: any) => row.experiment_tracker ?? row.model)
          );
          const languageExperiments = new Set(
            (languageData ?? []).map((row: any) => row.experiment_tracker ?? row.model)
          );
          
          // Intersection: experiments in both reading AND language
          const commonExperiments = new Set(
            Array.from(readingExperiments).filter(exp => languageExperiments.has(exp))
          );
          
          console.log(`[Leaderboard] Reading experiments: ${readingExperiments.size}, Language experiments: ${languageExperiments.size}, Common: ${commonExperiments.size}`);

          // Combine both datasets and filter to only common experiments
          const combinedRaw = [...(readingData ?? []), ...(languageData ?? [])].filter((row: any) => {
            const expTracker = row.experiment_tracker ?? row.model;
            return commonExperiments.has(expTracker);
          });
          
          console.log(`[Leaderboard] Filtered to ${combinedRaw.length} rows from common experiments`);

          const normalized: LeaderboardRow[] = combinedRaw.map((row: any) => ({
            model: row.experiment_tracker ?? row.model,
            actualModel: row.model,
            subject: '(R+L)-ELA', // Override subject for display
            questionType: row.questionType ?? row.question_type,
            difficulty: row.difficulty,
            questionsAboveThreshold:
              typeof row.questionsAboveThreshold === 'number'
                ? row.questionsAboveThreshold
                : Number(row.questions_above_threshold ?? 0),
            totalQuestions:
              typeof row.totalQuestions === 'number'
                ? row.totalQuestions
                : Number(row.total_questions ?? 0),
            percentage:
              typeof row.percentage === 'number'
                ? row.percentage
                : Number(row.percentage ?? 0),
          }));

          console.log(`[Leaderboard] Loaded ${normalized.length} combined rows for (R+L)-ELA`, normalized);
          setLeaderboardRows(normalized);
        } else {
          // Normal single-subject fetch
          const apiSubject = selectedSubject;

          const params = new URLSearchParams({
            subject: apiSubject,
            evaluator_version: evaluatorVersion,
            view_mode: viewMode,
            ...(gradeLevel && { grade_level: gradeLevel }),
            ...(questionType && { question_type: questionType }),
            ...(minTotalQuestions > 0 && { min_total_questions: minTotalQuestions.toString() }),
          });

          const response = await fetch(`/api/leaderboard?${params.toString()}`);

          if (!response.ok) {
            throw new Error(`Request failed with status ${response.status}`);
          }

          const contentType = response.headers.get('content-type') || '';

          // If we didn't actually hit a JSON API (e.g. dev server returned HTML),
          // avoid JSON parse errors and fall back to the bundled mock data so the
          // UI still works.
          if (!contentType.includes('application/json')) {
            if (!isCancelled) {
              console.warn(
                'Expected JSON from /api/leaderboard but received',
                contentType,
                '- falling back to static leaderboard data.',
              );
              setLeaderboardRows(leaderboardData);
            }
            return;
          }

          const rawData = await response.json();
          console.log(`[Leaderboard] Raw API response for "${apiSubject}":`, rawData);

          if (isCancelled) return;

          // Check if the response contains an error
          if (rawData && typeof rawData === 'object' && 'error' in rawData) {
            throw new Error(rawData.message || rawData.error || 'Unknown error from API');
          }

          const normalized: LeaderboardRow[] = (rawData ?? []).map((row: any) => ({
            // Use experiment_tracker as the display name (what was previously called "model" in the UI)
            model: row.experiment_tracker ?? row.model,
            // Store the actual model name if available
            actualModel: row.model,
            subject: row.subject,
            // Handle both `question_type` from SQL and `questionType` if already mapped.
            questionType: row.questionType ?? row.question_type,
            difficulty: row.difficulty,
            questionsAboveThreshold:
              typeof row.questionsAboveThreshold === 'number'
                ? row.questionsAboveThreshold
                : Number(row.questions_above_threshold ?? 0),
            totalQuestions:
              typeof row.totalQuestions === 'number'
                ? row.totalQuestions
                : Number(row.total_questions ?? 0),
            percentage:
              typeof row.percentage === 'number'
                ? row.percentage
                : Number(row.percentage ?? 0),
          }));

          console.log(`[Leaderboard] Loaded ${normalized.length} rows for subject "${selectedSubject}"`, normalized);
          setLeaderboardRows(normalized);
        }
      } catch (err: any) {
        if (isCancelled) return;
        console.error('Failed to load leaderboard data', err);
        const errorMessage = err.message || 'Unknown error';
        setError(`Failed to load leaderboard data: ${errorMessage}. Please check the console for details.`);
        setLeaderboardRows([]);
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    loadLeaderboard();

    return () => {
      isCancelled = true;
    };
  }, [selectedSubject, evaluatorVersion, viewMode, gradeLevel, questionType, minTotalQuestions]);

  const subjectData = leaderboardRows
    .filter(row => {
      const rowSubject = (row.subject || '').toLowerCase();
      const targetSubject = selectedSubject.toLowerCase();
      return rowSubject === targetSubject;
    })
    .filter(row => {
      // Filter out blocked experiments
      const isBlocked = isExperimentBlocked(row.model, row.actualModel);
      if (isBlocked) {
        console.log('[Benchmarks] Blocking experiment:', row.model);
      }
      return !isBlocked;
    });
  console.log(
    `[Leaderboard] Filtered ${subjectData.length} rows for "${selectedSubject}" from ${leaderboardRows.length} total rows`
  );
  
  // CONSOLIDATE data when All Grades is selected (gradeLevel is empty)
  const consolidatedData = !gradeLevel ? (() => {
    console.log('[Leaderboard] Consolidating data across all grades...');
    // Group by experiment_tracker (model), difficulty
    // When questionType filter is set, include it in grouping key to keep them separate
    // When questionType is empty (all types), exclude it to combine MCQ + fill-in
    const grouped = subjectData.reduce((acc, row) => {
      const key = questionType 
        ? `${row.model}|${row.difficulty}|${row.questionType}`
        : `${row.model}|${row.difficulty}`;
      if (!acc[key]) {
        acc[key] = {
          model: row.model,
          actualModel: row.actualModel,
          subject: row.subject,
          difficulty: row.difficulty,
          questionType: row.questionType,
          questionsAboveThreshold: 0,
          totalQuestions: 0,
        };
      }
      acc[key].questionsAboveThreshold += row.questionsAboveThreshold;
      acc[key].totalQuestions += row.totalQuestions;
      return acc;
    }, {} as Record<string, Omit<LeaderboardRow, 'percentage'>>);

    // Calculate percentage for each consolidated row
    const consolidated = Object.values(grouped).map(row => ({
      ...row,
      percentage: row.totalQuestions > 0 
        ? Number((100 * row.questionsAboveThreshold / row.totalQuestions).toFixed(1))
        : 0,
    }));
    
    console.log(`[Leaderboard] Consolidated ${subjectData.length} rows into ${consolidated.length} unique experiments`);
    return consolidated;
  })() : subjectData;

  const groupedByDifficulty = consolidatedData.reduce((acc, row) => {
    if (!acc[row.difficulty]) {
      acc[row.difficulty] = [];
    }
    acc[row.difficulty].push(row);
    return acc;
  }, {} as Record<string, LeaderboardRow[]>);

  // Calculate comparison stats for InceptLabs vs Field
  // Use subject-aware and view-mode-aware experiment configurations
  const inceptLabsExperiments = getInceptLabsExperiments(selectedSubject, viewMode);
  const fieldExperiments = getFieldExperiments(selectedSubject, viewMode);
  const inceptLabsStats = calculateComparisonStats(consolidatedData, inceptLabsExperiments);
  const fieldStats = calculateComparisonStats(consolidatedData, fieldExperiments);

  const getPercentageColor = (percentage: number) => {
    if (percentage >= 90) return 'var(--success)';
    if (percentage >= 85) return 'var(--warning)';
    return 'var(--error)';
  };

  const openDifficultyModal = (difficulty: string) => {
    setSelectedDifficulty(difficulty);
    setDifficultyModalOpen(true);
  };

  // Comparison Section Component
  const ComparisonSection: React.FC = () => {
    const hasInceptData = inceptLabsStats.totalQuestions > 0;
    const hasFieldData = fieldStats.totalQuestions > 0;
    
    if (!hasInceptData && !hasFieldData) {
      return (
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '32px',
          textAlign: 'center',
        }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            No comparison data available. Please configure experiment names in comparisonExperiments.ts
          </div>
        </div>
      );
    }

    // Helper to render horizontal bar chart
    const HorizontalBarChart: React.FC<{
      label: string;
      inceptValue: number;
      fieldValue: number;
      maxValue?: number;
      inceptLabel?: string;
      fieldLabel?: string;
    }> = ({ label, inceptValue, fieldValue, maxValue = 100, inceptLabel = 'InceptLabs', fieldLabel = 'The Field' }) => {
      return (
        <div style={{ marginBottom: '24px' }}>
          <div style={{
            fontSize: '13px',
            fontWeight: '600',
            color: 'var(--text)',
            marginBottom: '12px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            {label}
          </div>
          
          {/* InceptLabs Bar */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '6px',
            }}>
              <div style={{
                fontSize: '12px',
                fontWeight: '600',
                color: 'var(--primary)',
                minWidth: '100px',
              }}>
                {inceptLabel}
              </div>
              <div style={{
                flex: 1,
                height: '32px',
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '6px',
                position: 'relative',
                overflow: 'hidden',
              }}>
                <div style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${(inceptValue / maxValue) * 100}%`,
                  background: 'linear-gradient(90deg, #9e7fff 0%, #8b5cf6 100%)',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  paddingRight: '12px',
                  transition: 'width 0.3s ease',
                }}>
                  <span style={{
                    fontSize: '13px',
                    fontWeight: '700',
                    color: 'white',
                    textShadow: '0 1px 3px rgba(0, 0, 0, 0.5)',
                  }}>
                    {inceptValue.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Field Bar */}
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '6px',
            }}>
              <div style={{
                fontSize: '12px',
                fontWeight: '600',
                color: 'rgb(34, 197, 94)',
                minWidth: '100px',
              }}>
                {fieldLabel}
              </div>
              <div style={{
                flex: 1,
                height: '32px',
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '6px',
                position: 'relative',
                overflow: 'hidden',
              }}>
                <div style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${(fieldValue / maxValue) * 100}%`,
                  background: 'linear-gradient(90deg, #22c55e 0%, #16a34a 100%)',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  paddingRight: '12px',
                  transition: 'width 0.3s ease',
                }}>
                  <span style={{
                    fontSize: '13px',
                    fontWeight: '700',
                    color: 'white',
                    textShadow: '0 1px 3px rgba(0, 0, 0, 0.5)',
                  }}>
                    {fieldValue.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    };

    const getOverallForTracker = (experimentTracker: string) => {
      const rows = subjectData.filter(r => r.model === experimentTracker);
      const totalQuestionsAboveThreshold = rows.reduce((sum, r) => sum + r.questionsAboveThreshold, 0);
      const totalQuestions = rows.reduce((sum, r) => sum + r.totalQuestions, 0);
      const overallPercentage = totalQuestions > 0 ? (totalQuestionsAboveThreshold / totalQuestions) * 100 : 0;
      return { overallPercentage, totalQuestionsAboveThreshold, totalQuestions };
    };

    const OverallMultiBarChart: React.FC<{
      title: string;
      experiments: Array<[string, string?]>;
      maxValue?: number;
    }> = ({ title, experiments, maxValue = 100 }) => {
      const inceptSet = new Set(Object.values(inceptLabsExperiments));
      const fieldSet = new Set(Object.values(fieldExperiments));

      // Drop duplicates/empties and only show experiments that have data
      const seen = new Set<string>();
      const items = experiments
        .filter(([tracker]) => typeof tracker === 'string' && tracker.trim().length > 0)
        .filter(([tracker]) => (seen.has(tracker) ? false : (seen.add(tracker), true)))
        .map(([tracker, rename]) => {
          const label = (rename ?? '').trim() || tracker;
          return { tracker, label, ...getOverallForTracker(tracker) };
        })
        .filter((x) => x.totalQuestions > 0)
        .sort((a, b) => {
          // Descending by overall % (then stable-ish by label)
          if (b.overallPercentage !== a.overallPercentage) return b.overallPercentage - a.overallPercentage;
          return a.label.localeCompare(b.label);
        });

      if (items.length === 0) {
        return (
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '18px 20px',
            marginTop: '24px',
            color: 'var(--text-secondary)',
            fontSize: '14px',
            textAlign: 'center',
          }}>
            No data available for configured overall experiments.
          </div>
        );
      }

      return (
        <div style={{
          marginTop: '24px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
            background: 'rgba(255, 255, 255, 0.02)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
          }}>
            <div style={{
              fontSize: '14px',
              fontWeight: '700',
              color: 'var(--text)',
            }}>
              {title}
            </div>
            <div style={{
              fontSize: '12px',
              color: 'var(--text-secondary)',
              fontFamily: 'monospace',
            }}>
              {items.length} experiments
            </div>
          </div>

          <div style={{ padding: '18px 20px' }}>
            {items.map((item) => {
              const isIncept = inceptSet.has(item.tracker);
              const isField = fieldSet.has(item.tracker);
              const barColor = isIncept
                ? 'linear-gradient(90deg, #9e7fff 0%, #8b5cf6 100%)'
                : isField
                  ? 'linear-gradient(90deg, #22c55e 0%, #16a34a 100%)'
                  : 'linear-gradient(90deg, #64748b 0%, #475569 100%)';

              return (
                <div key={item.tracker} style={{ marginBottom: '14px' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    gap: '12px',
                    marginBottom: '6px',
                  }}>
                    <div style={{
                      fontSize: '12px',
                      fontWeight: '600',
                      color: 'var(--text)',
                      wordBreak: 'break-word',
                      lineHeight: 1.3,
                    }}>
                      {item.label}
                      {item.label !== item.tracker && (
                        <span style={{
                          marginLeft: '8px',
                          fontSize: '11px',
                          fontWeight: '500',
                          color: 'var(--text-secondary)',
                          fontFamily: 'monospace',
                        }}>
                          ({item.tracker})
                        </span>
                      )}
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: 'var(--text-secondary)',
                      fontFamily: 'monospace',
                      whiteSpace: 'nowrap',
                    }}>
                      {item.overallPercentage.toFixed(1)}% ({item.totalQuestionsAboveThreshold}/{item.totalQuestions})
                    </div>
                  </div>

                  <div style={{
                    height: '30px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '8px',
                    position: 'relative',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: `${Math.min(100, (item.overallPercentage / maxValue) * 100)}%`,
                      background: barColor,
                      borderRadius: '8px',
                      transition: 'width 0.3s ease',
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    };

    return (
      <div style={{ marginBottom: '32px' }}>
        {/* Overall Comparison Card */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(158, 127, 255, 0.08) 0%, rgba(34, 197, 94, 0.08) 100%)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          overflow: 'hidden',
          marginBottom: '24px',
        }}>
          

          {/* Overall Metrics Row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '1px',
            background: 'var(--border)',
            borderBottom: '1px solid var(--border)',
          }}>
            {/* InceptLabs Overall */}
            <div style={{
              padding: '24px 32px',
              background: 'rgba(158, 127, 255, 0.05)',
            }}>
              <div style={{
                fontSize: '12px',
                fontWeight: '600',
                color: 'var(--primary)',
                marginBottom: '8px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}>
                InceptLabs - Overall
              </div>
              {hasInceptData ? (
                <>
                  <div style={{
                    fontSize: '32px',
                    fontWeight: '700',
                    color: 'var(--text)',
                    marginBottom: '4px',
                  }}>
                    {inceptLabsStats.overallPercentage.toFixed(1)}%
                  </div>
                  <div style={{
                    fontSize: '13px',
                    color: 'var(--text-secondary)',
                    fontFamily: 'monospace',
                  }}>
                    {inceptLabsStats.totalQuestionsAboveThreshold}/{inceptLabsStats.totalQuestions} questions
                  </div>
                </>
              ) : (
                <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>No data</div>
              )}
            </div>

            {/* Field Overall */}
            <div style={{
              padding: '24px 32px',
              background: 'rgba(34, 197, 94, 0.05)',
            }}>
              <div style={{
                fontSize: '12px',
                fontWeight: '600',
                color: 'rgb(34, 197, 94)',
                marginBottom: '8px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}>
                The Field - Overall
              </div>
              {hasFieldData ? (
                <>
                  <div style={{
                    fontSize: '32px',
                    fontWeight: '700',
                    color: 'var(--text)',
                    marginBottom: '4px',
                  }}>
                    {fieldStats.overallPercentage.toFixed(1)}%
                  </div>
                  <div style={{
                    fontSize: '13px',
                    color: 'var(--text-secondary)',
                    fontFamily: 'monospace',
                  }}>
                    {fieldStats.totalQuestionsAboveThreshold}/{fieldStats.totalQuestions} questions
                  </div>
                </>
              ) : (
                <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>No data</div>
              )}
            </div>
          </div>

          {/* Horizontal Bar Charts for P10 and P90 */}
          <div style={{
            padding: '32px',
            background: 'var(--surface)',
          }}>
            {hasInceptData && hasFieldData ? (
              <>
                <HorizontalBarChart
                  label="P10 (10th Percentile)"
                  inceptValue={inceptLabsStats.p10}
                  fieldValue={fieldStats.p10}
                />
                <HorizontalBarChart
                  label="P90 (90th Percentile)"
                  inceptValue={inceptLabsStats.p90}
                  fieldValue={fieldStats.p90}
                />
              </>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>
                Insufficient data for percentile comparison
              </div>
            )}
          </div>
        </div>

        {/* Per-Difficulty Breakdown */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '16px',
        }}>
          {(['Easy', 'Medium', 'Hard'] as const).map((difficulty) => {
            const inceptData = inceptLabsStats.byDifficulty[difficulty];
            const fieldData = fieldStats.byDifficulty[difficulty];
            
            // Get experiment names for this difficulty
            const difficultyKey = difficulty.toLowerCase() as 'easy' | 'medium' | 'hard';
            const inceptExperimentName = inceptLabsExperiments[difficultyKey];
            const fieldExperimentName = fieldExperiments[difficultyKey];
            
            return (
              <div
                key={difficulty}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  overflow: 'hidden',
                }}
              >
                {/* Difficulty Header */}
                <div style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid var(--border)',
                  background: 'rgba(255, 255, 255, 0.02)',
                }}>
                  <h3 style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: 'var(--text)',
                    margin: 0,
                  }}>
                    {difficulty}
                  </h3>
                </div>

                {/* Comparison Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '1px',
                  background: 'var(--border)',
                }}>
                  {/* InceptLabs */}
                  <div style={{
                    padding: '20px 16px',
                    background: 'rgba(158, 127, 255, 0.03)',
                  }}>
                    <div style={{
                      fontSize: '11px',
                      color: 'var(--primary)',
                      marginBottom: '8px',
                      fontWeight: '600',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}>
                      InceptLabs
                    </div>
                    <div style={{
                      fontSize: '11px',
                      color: 'var(--text-secondary)',
                      marginBottom: '12px',
                      wordBreak: 'break-word',
                      lineHeight: '1.4',
                    }}>
                      {inceptExperimentName}
                    </div>
                    {inceptData ? (
                      <>
                        <div style={{
                          fontSize: '24px',
                          fontWeight: '700',
                          color: 'var(--text)',
                          marginBottom: '4px',
                        }}>
                          {inceptData.percentage.toFixed(1)}%
                        </div>
                        <div style={{
                          fontSize: '12px',
                          color: 'var(--text-secondary)',
                          fontFamily: 'monospace',
                        }}>
                          {inceptData.questionsAboveThreshold}/{inceptData.totalQuestions}
                        </div>
                      </>
                    ) : (
                      <div style={{
                        fontSize: '12px',
                        color: 'var(--text-secondary)',
                      }}>
                        N/A
                      </div>
                    )}
                  </div>

                  {/* Field */}
                  <div style={{
                    padding: '20px 16px',
                    background: 'rgba(34, 197, 94, 0.03)',
                  }}>
                    <div style={{
                      fontSize: '11px',
                      color: 'rgb(34, 197, 94)',
                      marginBottom: '8px',
                      fontWeight: '600',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}>
                      Field
                    </div>
                    <div style={{
                      fontSize: '11px',
                      color: 'var(--text-secondary)',
                      marginBottom: '12px',
                      wordBreak: 'break-word',
                      lineHeight: '1.4',
                    }}>
                      {fieldExperimentName}
                    </div>
                    {fieldData ? (
                      <>
                        <div style={{
                          fontSize: '24px',
                          fontWeight: '700',
                          color: 'var(--text)',
                          marginBottom: '4px',
                        }}>
                          {fieldData.percentage.toFixed(1)}%
                        </div>
                        <div style={{
                          fontSize: '12px',
                          color: 'var(--text-secondary)',
                          fontFamily: 'monospace',
                        }}>
                          {fieldData.questionsAboveThreshold}/{fieldData.totalQuestions}
                        </div>
                      </>
                    ) : (
                      <div style={{
                        fontSize: '12px',
                        color: 'var(--text-secondary)',
                      }}>
                        N/A
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <OverallMultiBarChart
          title="Overall performance"
          experiments={
            evaluatorVersion === '2.1.0'
              ? // Auto-discover all experiments from loaded data (2.1.0+)
                Array.from(new Set(consolidatedData.map(row => row.model)))
                  .map(tracker => [tracker, tracker] as [string, string])
              : // Use manually configured experiments (pre-2.1.0)
                getOverallComparisonExperimentTuples(selectedSubject, viewMode)
          }
        />
      </div>
    );
  };

  const LeaderboardCard: React.FC<{
    title: string;
    difficulty: string;
    icon: React.ReactNode;
  }> = ({ title, difficulty, icon }) => {
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'rank', direction: 'desc' });
    
    const experiments = groupedByDifficulty[difficulty] || [];
    const showLoadingState = isLoading && experiments.length === 0;

    // Sort experiments based on sortConfig (default: by percentage descending)
    let sortedExperiments = [...experiments].sort((a, b) => {
      let comparison = 0;
      
      switch (sortConfig.key) {
        case 'score':
          // Sort by questions above threshold
          comparison = a.questionsAboveThreshold - b.questionsAboveThreshold;
          break;
        case 'votes':
          // Sort by total questions
          comparison = a.totalQuestions - b.totalQuestions;
          break;
        case 'model':
          comparison = a.model.localeCompare(b.model);
          break;
        case 'rank':
          // Rank is based on percentage
          comparison = a.percentage - b.percentage;
          break;
        default:
          comparison = 0;
      }
      
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });

    const handleSort = (key: SortConfig['key']) => {
      setSortConfig(prev => ({
        key,
        direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
      }));
    };

    const SortableHeader: React.FC<{ label: string; sortKey: SortConfig['key']; align?: string }> = ({ label, sortKey, align = 'left' }) => (
      <div
        onClick={() => handleSort(sortKey)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start',
          gap: '4px',
          cursor: 'pointer',
          userSelect: 'none',
          transition: 'color 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--text)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--text-secondary)';
        }}
      >
        <span>{label}</span>
        <ArrowUpDown size={12} style={{ 
          opacity: sortConfig.key === sortKey ? 1 : 0.3,
          transform: sortConfig.key === sortKey && sortConfig.direction === 'asc' ? 'rotate(180deg)' : 'none',
          transition: 'all 0.2s ease'
        }} />
      </div>
    );

    return (
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div 
          onClick={() => openDifficultyModal(difficulty)}
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            transition: 'background 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--hover-bg)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'rgba(158, 127, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary)',
            }}>
              {icon}
            </div>
            <h2 style={{
              fontSize: '16px',
              fontWeight: '600',
              color: 'var(--text)',
              margin: 0,
            }}>
              {title}
            </h2>
          </div>
          <div style={{
            fontSize: '12px',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}>
            Click to view all
            <ChevronDown size={14} />
          </div>
        </div>

        {/* Table */}
        <div>
          {showLoadingState ? (
            /* Loading Skeleton State */
            <>
              {/* Table Header */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '50px 1fr 1fr 100px 100px 90px',
                gap: '16px',
                padding: '12px 24px',
                background: 'rgba(255, 255, 255, 0.02)',
                borderBottom: '1px solid var(--border)',
                fontSize: '11px',
                fontWeight: '600',
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}>
                <div>Rank</div>
                <div>Experiment</div>
                <div>Model</div>
                <div style={{ textAlign: 'center' }}>Q ≥ 0.85</div>
                <div style={{ textAlign: 'center' }}>Total Q</div>
                <div style={{ textAlign: 'center' }}>%</div>
              </div>

              {/* Loading Skeleton Rows */}
              <div style={{ maxHeight: '265px', minHeight: '265px', overflowY: 'auto', overflowX: 'hidden' }} className="custom-scrollbar">
                {[...Array(5)].map((_, index) => (
                  <div
                    key={`skeleton-${index}`}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '50px 1fr 1fr 100px 100px 90px',
                      gap: '16px',
                      padding: '14px 24px',
                      borderBottom: '1px solid var(--border)',
                      background: 'transparent',
                    }}
                  >
                    {[...Array(6)].map((_, colIndex) => (
                      <div
                        key={`skeleton-col-${colIndex}`}
                        style={{
                          height: '20px',
                          background: 'linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 75%)',
                          backgroundSize: '200% 100%',
                          borderRadius: '4px',
                          animation: 'shimmer 1.5s infinite',
                        }}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </>
          ) : experiments.length === 0 ? (
            /* Empty State */
            <>
              {/* Table Header - to maintain consistent structure */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '50px 1fr 1fr 100px 100px 90px',
                gap: '16px',
                padding: '12px 24px',
                background: 'rgba(255, 255, 255, 0.02)',
                borderBottom: '1px solid var(--border)',
                fontSize: '11px',
                fontWeight: '600',
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}>
                <div>Rank</div>
                <div>Experiment</div>
                <div>Model</div>
                <div style={{ textAlign: 'center' }}>Q ≥ 0.85</div>
                <div style={{ textAlign: 'center' }}>Total Q</div>
                <div style={{ textAlign: 'center' }}>%</div>
              </div>
              <div style={{
                minHeight: '265px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '48px 24px',
                textAlign: 'center',
                color: 'var(--text-secondary)',
              }}>
                <div>
                  <div style={{ fontSize: '14px', marginBottom: '8px' }}>No data available</div>
                  <div style={{ fontSize: '12px', opacity: 0.7 }}>Data for this difficulty level will appear here when available</div>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Table Header */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '50px 1fr 1fr 100px 100px 90px',
                gap: '16px',
                padding: '12px 24px',
                background: 'rgba(255, 255, 255, 0.02)',
                borderBottom: '1px solid var(--border)',
                fontSize: '11px',
                fontWeight: '600',
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}>
                <SortableHeader label="Rank" sortKey="rank" />
                <SortableHeader label="Experiment" sortKey="model" />
                <div>Model</div>
                <SortableHeader label="Q ≥ 0.85" sortKey="score" align="center" />
                <SortableHeader label="Total Q" sortKey="votes" align="center" />
                <div style={{ textAlign: 'center' }}>%</div>
              </div>

              {/* Table Rows - Scrollable (shows 5 rows) */}
              <div style={{
                maxHeight: '265px',
                minHeight: '265px',
                overflowY: 'auto',
                overflowX: 'hidden',
              }}
              className="custom-scrollbar"
              >
              {sortedExperiments.map((row, index) => {
            const isIncept = shouldHighlightExperiment(row.model);
            const rank = index + 1;
            
            return (
              <div
                key={`${row.model}-${index}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '50px 1fr 1fr 100px 100px 90px',
                  gap: '16px',
                  padding: '14px 24px',
                  borderBottom: '1px solid var(--border)',
                  background: isIncept ? 'rgba(158, 127, 255, 0.03)' : 'transparent',
                  transition: 'background 0.2s ease',
                  cursor: 'pointer',
                }}
                onClick={() => {
                  // Navigate to evaluations page with filters pre-filled
                  const params = new URLSearchParams({
                    model: row.model, // URLSearchParams handles encoding
                    subject: selectedSubject,
                    evaluator_version: evaluatorVersion,
                    ...(gradeLevel && { grade_level: gradeLevel }),
                    ...(questionType && { question_type: questionType }),
                  });
                  navigate(`/evaluations?${params.toString()}`);
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = isIncept ? 'rgba(158, 127, 255, 0.06)' : 'var(--hover-bg)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = isIncept ? 'rgba(158, 127, 255, 0.03)' : 'transparent';
                }}
              >
                {/* Rank */}
                <div style={{
                  fontSize: '13px',
                  fontWeight: '600',
                  color: rank <= 3 ? 'var(--primary)' : 'var(--text-secondary)',
                }}>
                  {rank}
                </div>

                {/* Experiment Tracker */}
                <div style={{
                  fontSize: '13px',
                  fontWeight: '500',
                  color: isIncept ? 'var(--primary)' : 'var(--text)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}>
                  <span
                    title={row.model}
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      display: 'block',
                      flex: 1,
                    }}
                  >
                    {row.model}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(row.model);
                      setCopiedExperiment(row.model);
                      setTimeout(() => setCopiedExperiment(null), 2000);
                    }}
                    style={{
                      padding: '4px',
                      fontSize: '11px',
                      background: copiedExperiment === row.model ? 'var(--success)' : 'transparent',
                      border: '1px solid var(--border)',
                      borderRadius: '4px',
                      color: copiedExperiment === row.model ? 'white' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                    onMouseEnter={(e) => {
                      if (copiedExperiment !== row.model) {
                        e.currentTarget.style.background = 'var(--hover-bg)';
                        e.currentTarget.style.color = 'var(--text)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (copiedExperiment !== row.model) {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = 'var(--text-secondary)';
                      }
                    }}
                    title="Copy experiment tracker"
                  >
                    {copiedExperiment === row.model ? (
                      <Check size={12} />
                    ) : (
                      <Copy size={12} />
                    )}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const params = new URLSearchParams({
                        experiment_tracker: row.model,
                        subject: selectedSubject,
                        evaluator_version: evaluatorVersion,
                      });
                      navigate(`/look-at-data?${params.toString()}`);
                    }}
                    style={{
                      padding: '4px',
                      fontSize: '11px',
                      background: 'transparent',
                      border: '1px solid var(--border)',
                      borderRadius: '4px',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--hover-bg)';
                      e.currentTarget.style.color = 'var(--primary)';
                      e.currentTarget.style.borderColor = 'var(--primary)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                      e.currentTarget.style.borderColor = 'var(--border)';
                    }}
                    title="View data for this experiment"
                  >
                    <Eye size={12} />
                  </button>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      const params = new URLSearchParams({
                        experiment_tracker: row.model,
                        subject: selectedSubject,
                        evaluator_version: evaluatorVersion,
                        ...(appliedGradeLevel && { grade_level: appliedGradeLevel }),
                        ...(appliedQuestionType && { question_type: appliedQuestionType }),
                      });
                      try {
                        setIsCaching(row.model);
                        const [reportRes, summaryRes, scoresRes] = await Promise.all([
                          fetch(`/api/experiment-report?${params.toString()}`),
                          fetch(`/api/experiment-summary?${params.toString()}`),
                          fetch(`/api/experiment-scores?${params.toString()}`),
                        ]);
                        if (reportRes.ok && summaryRes.ok && scoresRes.ok) {
                          const reportData = await reportRes.json();
                          const summaryData = await summaryRes.json();
                          const scoresData = await scoresRes.json();
                          saveToCache(
                            {
                              experiment_tracker: row.model,
                              subject: selectedSubject,
                              grade_level: appliedGradeLevel || '',
                              question_type: appliedQuestionType || '',
                              evaluator_version: evaluatorVersion,
                            },
                            reportData || [],
                            summaryData || null,
                            scoresData || []
                          );
                          setAddedToCache(row.model);
                          setTimeout(() => setAddedToCache(null), 3000);
                        } else {
                          console.warn('[Benchmarks Cache] Failed to fetch report/summary/scores');
                        }
                      } catch (err) {
                        console.error('[Benchmarks Cache] Failed to add to cache', err);
                      } finally {
                        setIsCaching(null);
                      }
                    }}
                    style={{
                      padding: '4px 8px',
                      fontSize: '11px',
                      background: addedToCache === row.model ? 'rgba(34, 197, 94, 0.2)' : 'transparent',
                      border: `1px solid ${addedToCache === row.model ? 'rgb(34, 197, 94)' : 'var(--border)'}`,
                      borderRadius: '4px',
                      color: addedToCache === row.model ? 'rgb(34, 197, 94)' : 'var(--text-secondary)',
                      cursor: isCaching === row.model ? 'wait' : 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      flexShrink: 0,
                      fontWeight: '500',
                      minWidth: '64px',
                    }}
                    onMouseEnter={(e) => {
                      if (addedToCache !== row.model && isCaching !== row.model) {
                        e.currentTarget.style.background = 'rgba(158, 127, 255, 0.1)';
                        e.currentTarget.style.color = 'var(--primary)';
                        e.currentTarget.style.borderColor = 'var(--primary)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (addedToCache !== row.model && isCaching !== row.model) {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = 'var(--text-secondary)';
                        e.currentTarget.style.borderColor = 'var(--border)';
                      }
                    }}
                    title="Add to cache (silent)"
                    disabled={isCaching === row.model}
                  >
                    {addedToCache === row.model ? (
                      <>
                        <Check size={12} />
                        <span>Added</span>
                      </>
                    ) : isCaching === row.model ? (
                      <span>...</span>
                    ) : (
                      <>
                        <Download size={12} />
                        <span>Cache</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Model (actual model name) */}
                <div style={{
                  fontSize: '13px',
                  fontWeight: '400',
                  color: 'var(--text-secondary)',
                }}>
                  <span
                    title={row.actualModel || 'N/A'}
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      display: 'block',
                    }}
                  >
                    {row.actualModel || 'N/A'}
                  </span>
                </div>

                {/* Questions >= 0.85 */}
                <div style={{
                  textAlign: 'center',
                  fontSize: '13px',
                  fontWeight: '500',
                  color: 'var(--text)',
                }}>
                  {row.questionsAboveThreshold}
                </div>

                {/* Total Questions */}
                <div style={{
                  textAlign: 'center',
                  fontSize: '13px',
                  fontWeight: '500',
                  color: 'var(--text)',
                }}>
                  {row.totalQuestions}
                </div>

                {/* Percentage */}
                <div style={{
                  textAlign: 'center',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: getPercentageColor(row.percentage),
                }}>
                  {row.percentage.toFixed(1)}%
                </div>
              </div>
            );
          })}
              </div>
              
              {/* Show count if more than 5 */}
              {sortedExperiments.length > 5 && (
                <div style={{
                  padding: '8px 24px',
                  textAlign: 'center',
                  fontSize: '11px',
                  color: 'var(--text-secondary)',
                  borderTop: '1px solid var(--border)',
                  background: 'rgba(255, 255, 255, 0.02)',
                }}>
                  Showing {sortedExperiments.length} experiments
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ 
      padding: '32px',
      maxWidth: '1800px',
      margin: '0 auto',
      minHeight: '100vh',
    }}>
      {/* Page Header */}
      <div style={{ marginBottom: '32px' }}>
        {/* Error State - Fixed position at top */}
        {error && (
          <div style={{
            padding: '16px',
            marginBottom: '24px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            color: 'var(--error)',
          }}>
            {error}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h1 style={{
            fontSize: '28px',
            fontWeight: '700',
            color: 'var(--text)',
            margin: 0,
          }}>
            Leaderboard
          </h1>
          
          {/* Evaluator Version and View Mode Selectors */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
            {/* Evaluator Version Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{
                fontSize: '14px',
                fontWeight: '500',
                color: 'var(--text-secondary)',
              }}>
                Evaluator:
              </label>
              <select
                value={evaluatorVersion}
                onChange={(e) => setEvaluatorVersion(e.target.value as '1.5.4' | '2.0.0')}
                style={{
                  padding: '8px 16px',
                  fontSize: '14px',
                  fontWeight: '500',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  color: 'var(--text)',
                  cursor: 'pointer',
                  outline: 'none',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--primary)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                }}
              >
                <option value="2.1.0">v2.1.0</option>
                <option value="2.0.0">v2.0.0</option>
                <option value="1.5.4">v1.5.4</option>
              </select>
            </div>

            {/* View Mode Selector - Only show for 2.0.0 (2.1.0 always uses 'all') */}
            {evaluatorVersion === '2.0.0' && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{
                    fontSize: '14px',
                    fontWeight: '500',
                    color: 'var(--text-secondary)',
                  }}>
                    View Mode:
                  </label>
                  <select
                    value={viewMode}
                    onChange={(e) => setViewMode(e.target.value as 'all' | 'attachment_filtered')}
                    style={{
                      padding: '8px 16px',
                      fontSize: '14px',
                      fontWeight: '500',
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      color: 'var(--text)',
                      cursor: 'pointer',
                      outline: 'none',
                      minWidth: '200px',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'var(--primary)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border)';
                    }}
                  >
                    <option value="attachment_filtered">Attachment Filtered</option>
                    <option value="all">All Data</option>
                  </select>
                </div>
                
                {/* Info indicator for filtered mode */}
                {viewMode === 'attachment_filtered' && (
                  <div style={{
                    padding: '6px 12px',
                    background: 'rgba(251, 191, 36, 0.1)',
                    border: '1px solid rgba(251, 191, 36, 0.3)',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '500',
                    color: '#f59e0b',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}>
                    <AlertCircle size={14} />
                    48 recipes excluded
                  </div>
                )}
              </>
            )}
            
            {/* Info for 2.1.0: Always shows all data */}
            {evaluatorVersion === '2.1.0' && (
              <div style={{
                padding: '6px 12px',
                background: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '500',
                color: '#3b82f6',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}>
                <AlertCircle size={14} />
                All Data
              </div>
            )}
          </div>
        </div>

        {/* Subject Tabs */}
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)' }}>
          <button
            onClick={() => {
              setSelectedSubject('language');
              // Reset to Language defaults
              setGradeLevel('');
              setQuestionType('mcq');
              setMinTotalQuestions(50);
            }}
            style={{
              padding: '12px 24px',
              background: 'transparent',
              border: 'none',
              borderBottom: selectedSubject === 'language' ? '2px solid var(--primary)' : '2px solid transparent',
              color: selectedSubject === 'language' ? 'var(--primary)' : 'var(--text-secondary)',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              if (selectedSubject !== 'language') {
                e.currentTarget.style.color = 'var(--text)';
              }
            }}
            onMouseLeave={(e) => {
              if (selectedSubject !== 'language') {
                e.currentTarget.style.color = 'var(--text-secondary)';
              }
            }}
          >
            Language
          </button>
          <button
            onClick={() => {
              setSelectedSubject('reading');
              // Reset to Reading defaults
              setGradeLevel('');
              setQuestionType('mcq');
              setMinTotalQuestions(50);
            }}
            style={{
              padding: '12px 24px',
              background: 'transparent',
              border: 'none',
              borderBottom: selectedSubject === 'reading' ? '2px solid var(--primary)' : '2px solid transparent',
              color: selectedSubject === 'reading' ? 'var(--primary)' : 'var(--text-secondary)',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              if (selectedSubject !== 'reading') {
                e.currentTarget.style.color = 'var(--text)';
              }
            }}
            onMouseLeave={(e) => {
              if (selectedSubject !== 'reading') {
                e.currentTarget.style.color = 'var(--text-secondary)';
              }
            }}
          >
            Reading
          </button>
          {/* (R+L)-ELA Tab - Only visible for evaluator 2.1.0 */}
          {evaluatorVersion === '2.1.0' && (
            <button
              onClick={() => {
                setSelectedSubject('(r+l)-ela');
                // Reset to defaults
                setGradeLevel('');
                setQuestionType('mcq');
                setMinTotalQuestions(50);
              }}
              style={{
                padding: '12px 24px',
                background: 'transparent',
                border: 'none',
                borderBottom: selectedSubject === '(r+l)-ela' ? '2px solid var(--primary)' : '2px solid transparent',
                color: selectedSubject === '(r+l)-ela' ? 'var(--primary)' : 'var(--text-secondary)',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                if (selectedSubject !== '(r+l)-ela') {
                  e.currentTarget.style.color = 'var(--text)';
                }
              }}
              onMouseLeave={(e) => {
                if (selectedSubject !== '(r+l)-ela') {
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }
              }}
            >
              (R+L)-ELA
            </button>
          )}
          <button
            onClick={() => {
              setSelectedSubject('ela');
              // Reset to ELA defaults (60 questions minimum)
              setGradeLevel('');
              setQuestionType('mcq');
              setMinTotalQuestions(60);
            }}
            style={{
              padding: '12px 24px',
              background: 'transparent',
              border: 'none',
              borderBottom: selectedSubject === 'ela' ? '2px solid var(--primary)' : '2px solid transparent',
              color: selectedSubject === 'ela' ? 'var(--primary)' : 'var(--text-secondary)',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              if (selectedSubject !== 'ela') {
                e.currentTarget.style.color = 'var(--text)';
              }
            }}
            onMouseLeave={(e) => {
              if (selectedSubject !== 'ela') {
                e.currentTarget.style.color = 'var(--text-secondary)';
              }
            }}
          >
            ELA
          </button>
          <button
            onClick={() => {
              setSelectedSubject('math');
              // Reset to Math defaults
              setGradeLevel('3');
              setQuestionType('mcq');
              setMinTotalQuestions(120);
            }}
            style={{
              padding: '12px 24px',
              background: 'transparent',
              border: 'none',
              borderBottom: selectedSubject === 'math' ? '2px solid var(--primary)' : '2px solid transparent',
              color: selectedSubject === 'math' ? 'var(--primary)' : 'var(--text-secondary)',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              if (selectedSubject !== 'math') {
                e.currentTarget.style.color = 'var(--text)';
              }
            }}
            onMouseLeave={(e) => {
              if (selectedSubject !== 'math') {
                e.currentTarget.style.color = 'var(--text-secondary)';
              }
            }}
          >
            Math
          </button>
        </div>

        {/* Filters Section - All in One Line */}
        <div style={{
          marginTop: '24px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '16px 20px',
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}>
          {/* Grade Level Dropdown */}
          <div style={{ minWidth: '140px', flex: '0 0 auto' }}>
            <label style={{
              display: 'block',
              fontSize: '11px',
              fontWeight: '600',
              color: 'var(--text-secondary)',
              marginBottom: '6px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
              Grade Level
            </label>
            <select
              value={gradeLevel}
              onChange={(e) => setGradeLevel(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: '14px',
                background: 'var(--background)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                color: 'var(--text)',
                outline: 'none',
                cursor: 'pointer',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--primary)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
              }}
            >
              <option value="">All Grades</option>
              <option value="3">Grade 3</option>
              <option value="4">Grade 4</option>
              <option value="5">Grade 5</option>
              <option value="6">Grade 6</option>
              <option value="7">Grade 7</option>
              <option value="8">Grade 8</option>
            </select>
          </div>

          {/* Question Type Dropdown */}
          <div style={{ minWidth: '140px', flex: '0 0 auto' }}>
            <label style={{
              display: 'block',
              fontSize: '11px',
              fontWeight: '600',
              color: 'var(--text-secondary)',
              marginBottom: '6px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
              Question Type
            </label>
            <select
              value={questionType}
              onChange={(e) => setQuestionType(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: '14px',
                background: 'var(--background)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                color: 'var(--text)',
                outline: 'none',
                cursor: 'pointer',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--primary)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
              }}
            >
              <option value="">All Types</option>
              <option value="mcq">MCQ</option>
              <option value="fill-in">Fill-in</option>
            </select>
          </div>

          {/* Minimum Total Questions Input */}
          <div style={{ minWidth: '160px', flex: '0 0 auto' }}>
            <label style={{
              display: 'block',
              fontSize: '11px',
              fontWeight: '600',
              color: 'var(--text-secondary)',
              marginBottom: '6px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
              Min Questions
            </label>
            <input
              type="number"
              value={minTotalQuestions}
              onChange={(e) => setMinTotalQuestions(Number(e.target.value))}
              placeholder="e.g., 120"
              min="0"
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: '14px',
                background: 'var(--background)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                color: 'var(--text)',
                outline: 'none',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--primary)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
              }}
            />
          </div>

          {/* Reset Filters Button */}
          <button
            onClick={() => {
              // Reset based on selected subject
              if (selectedSubject === 'language') {
                setGradeLevel('');
                setQuestionType('');
                setMinTotalQuestions(50);
              } else if (selectedSubject === 'ela') {
                setGradeLevel('');
                setQuestionType('');
                setMinTotalQuestions(60);
              } else {
                setGradeLevel('3');
                setQuestionType('mcq');
                setMinTotalQuestions(120);
              }
            }}
            style={{
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: '500',
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              alignSelf: 'flex-end',
              marginBottom: '2px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--hover-bg)';
              e.currentTarget.style.color = 'var(--text)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            Reset
          </button>

          {/* Spacer to push Top Performers to the right */}
          <div style={{ flex: '1 1 auto' }}></div>

          {/* Top Performers Button */}
          <button
            onClick={() => setTopPerformersModalOpen(true)}
            style={{
              padding: '8px 16px',
              background: 'linear-gradient(135deg, var(--primary) 0%, #8b5cf6 100%)',
              border: 'none',
              borderRadius: '6px',
              color: 'white',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 8px rgba(158, 127, 255, 0.3)',
              alignSelf: 'flex-end',
              marginBottom: '2px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(158, 127, 255, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(158, 127, 255, 0.3)';
            }}
          >
            <TrendingUp size={14} />
            Top Performers
          </button>
        </div>
      </div>

      {/* InceptLabs vs Field Comparison (hidden for (r+l)-ela) */}
      {selectedSubject !== '(r+l)-ela' && <ComparisonSection />}

      {/* Leaderboard - Vertical Stack */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        width: '100%',
      }}>
        <LeaderboardCard
          title="Easy"
          difficulty="Easy"
          icon={<FileText size={18} />}
        />
        <LeaderboardCard
          title="Medium"
          difficulty="Medium"
          icon={<FileText size={18} />}
        />
        <LeaderboardCard
          title="Hard"
          difficulty="Hard"
          icon={<FileText size={18} />}
        />
      </div>

      {/* Difficulty Detail Modal */}
      {difficultyModalOpen && selectedDifficulty && (
        <div
          onClick={() => setDifficultyModalOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--surface)',
              borderRadius: '16px',
              maxWidth: '1200px',
              width: '100%',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
              border: '1px solid var(--border)',
            }}
          >
            {/* Modal Header */}
            <div style={{
              padding: '24px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'rgba(158, 127, 255, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--primary)',
                }}>
                  <FileText size={20} />
                </div>
                <div>
                  <h2 style={{
                    fontSize: '20px',
                    fontWeight: '700',
                    color: 'var(--text)',
                    margin: 0,
                  }}>
                    {selectedDifficulty} Difficulty - All Experiments
                  </h2>
                  <p style={{
                    fontSize: '13px',
                    color: 'var(--text-secondary)',
                    margin: '4px 0 0 0',
                  }}>
                    {(groupedByDifficulty[selectedDifficulty] || []).length} experiments
                  </p>
                </div>
              </div>
              
              {/* Action buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={() => setTopPerformersModalOpen(true)}
                  style={{
                    padding: '8px 16px',
                    fontSize: '13px',
                    background: 'transparent',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    color: 'var(--text)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontWeight: '500',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(34, 197, 94, 0.1)';
                    e.currentTarget.style.borderColor = 'rgb(34, 197, 94)';
                    e.currentTarget.style.color = 'rgb(34, 197, 94)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.color = 'var(--text)';
                  }}
                  title="View top performers"
                >
                  <TrendingUp size={16} />
                  Top Performers
                </button>
                <button
                  onClick={() => setDifficultyModalOpen(false)}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    background: 'transparent',
                    border: '1px solid var(--border)',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--hover-bg)';
                    e.currentTarget.style.color = 'var(--text)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Body - Scrollable */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              overflowX: 'hidden',
            }}
            className="custom-scrollbar"
            >
              <div style={{
                display: 'grid',
                gridTemplateColumns: '50px 1fr 1fr 100px 100px 90px',
                gap: '16px',
                padding: '12px 24px',
                background: 'rgba(255, 255, 255, 0.02)',
                borderBottom: '1px solid var(--border)',
                fontSize: '11px',
                fontWeight: '600',
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                position: 'sticky',
                top: 0,
                zIndex: 1,
              }}>
                <div>Rank</div>
                <div>Experiment</div>
                <div>Model</div>
                <div style={{ textAlign: 'center' }}>Q ≥ 0.85</div>
                <div style={{ textAlign: 'center' }}>Total Q</div>
                <div style={{ textAlign: 'center' }}>%</div>
              </div>

              {(groupedByDifficulty[selectedDifficulty] || [])
                .sort((a, b) => b.percentage - a.percentage)
                .map((row, index) => {
                  const isIncept = shouldHighlightExperiment(row.model);
                  const rank = index + 1;
                  
                  return (
                    <div
                      key={`${row.model}-${index}`}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '50px 1fr 1fr 100px 100px 90px',
                        gap: '16px',
                        padding: '14px 24px',
                        borderBottom: '1px solid var(--border)',
                        background: isIncept ? 'rgba(158, 127, 255, 0.03)' : 'transparent',
                        transition: 'background 0.2s ease',
                        cursor: 'pointer',
                      }}
                      onClick={() => {
                        setDifficultyModalOpen(false);
                        const params = new URLSearchParams({
                          model: row.model, // URLSearchParams handles encoding
                          subject: selectedSubject,
                          ...(gradeLevel && { grade_level: gradeLevel }),
                          ...(questionType && { question_type: questionType }),
                        });
                        navigate(`/evaluations?${params.toString()}`);
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = isIncept ? 'rgba(158, 127, 255, 0.06)' : 'var(--hover-bg)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = isIncept ? 'rgba(158, 127, 255, 0.03)' : 'transparent';
                      }}
                    >
                      <div style={{
                        fontSize: '13px',
                        fontWeight: '600',
                        color: rank <= 3 ? 'var(--primary)' : 'var(--text-secondary)',
                      }}>
                        {rank}
                      </div>
                      <div style={{
                        fontSize: '13px',
                        fontWeight: '500',
                        color: isIncept ? 'var(--primary)' : 'var(--text)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}>
                        <span style={{
                          flex: 1,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {row.model}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(row.model);
                            setCopiedExperiment(row.model);
                            setTimeout(() => setCopiedExperiment(null), 2000);
                          }}
                          style={{
                            padding: '4px',
                            fontSize: '11px',
                            background: copiedExperiment === row.model ? 'var(--success)' : 'transparent',
                            border: '1px solid var(--border)',
                            borderRadius: '4px',
                            color: copiedExperiment === row.model ? 'white' : 'var(--text-secondary)',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                          onMouseEnter={(e) => {
                            if (copiedExperiment !== row.model) {
                              e.currentTarget.style.background = 'var(--hover-bg)';
                              e.currentTarget.style.color = 'var(--text)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (copiedExperiment !== row.model) {
                              e.currentTarget.style.background = 'transparent';
                              e.currentTarget.style.color = 'var(--text-secondary)';
                            }
                          }}
                          title="Copy experiment tracker"
                        >
                          {copiedExperiment === row.model ? (
                            <Check size={12} />
                          ) : (
                            <Copy size={12} />
                          )}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const params = new URLSearchParams({
                              experiment_tracker: row.model,
                              subject: selectedSubject,
                            });
                            navigate(`/look-at-data?${params.toString()}`);
                          }}
                          style={{
                            padding: '4px',
                            fontSize: '11px',
                            background: 'transparent',
                            border: '1px solid var(--border)',
                            borderRadius: '4px',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'var(--hover-bg)';
                            e.currentTarget.style.color = 'var(--primary)';
                            e.currentTarget.style.borderColor = 'var(--primary)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = 'var(--text-secondary)';
                            e.currentTarget.style.borderColor = 'var(--border)';
                          }}
                          title="View data for this experiment"
                        >
                          <Eye size={12} />
                        </button>
                      </div>
                      <div style={{
                        fontSize: '13px',
                        fontWeight: '400',
                        color: 'var(--text-secondary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {row.actualModel || 'N/A'}
                      </div>
                      <div style={{
                        textAlign: 'center',
                        fontSize: '13px',
                        fontWeight: '500',
                        color: 'var(--text)',
                      }}>
                        {row.questionsAboveThreshold}
                      </div>
                      <div style={{
                        textAlign: 'center',
                        fontSize: '13px',
                        fontWeight: '500',
                        color: 'var(--text)',
                      }}>
                        {row.totalQuestions}
                      </div>
                      <div style={{
                        textAlign: 'center',
                        fontSize: '13px',
                        fontWeight: '600',
                        color: getPercentageColor(row.percentage),
                      }}>
                        {row.percentage.toFixed(1)}%
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* Top Performers Modal - Compact with Table + Graph */}
      {topPerformersModalOpen && (() => {
        // Helper to render a compact chart with table on left, graph on right
        const CompactChart = ({ 
          title, 
          data, 
          color,
        }: { 
          title: string; 
          data: LeaderboardRow[]; 
          color: string;
        }) => {
          const topData = data
            .sort((a, b) => b.percentage - a.percentage)
            .slice(0, 5);
          
          const maxPercentage = 100;
          
          return (
            <div style={{
              width: '100%',
              background: 'rgba(255, 255, 255, 0.02)',
              borderRadius: '12px',
              padding: '20px',
              border: '1px solid var(--border)',
              marginBottom: '20px',
            }}>
              {/* Chart Title */}
              <h3 style={{
                fontSize: '15px',
                fontWeight: '600',
                color: 'var(--text)',
                margin: '0 0 16px 0',
                letterSpacing: '0.3px',
              }}>
                {title}
              </h3>

              {/* Two column layout: Table left, Graph right */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1.3fr 1fr',
                gap: '24px',
                alignItems: 'center',
              }}>
                {/* Left: Table */}
                <div style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  overflow: 'hidden',
                }}>
                  {/* Table Header */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '40px 1fr 90px 100px',
                    padding: '10px 12px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderBottom: '1px solid var(--border)',
                    fontSize: '11px',
                    fontWeight: '600',
                    color: 'var(--text-secondary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}>
                    <div>Rank</div>
                    <div>Model</div>
                    <div style={{ textAlign: 'center' }}>Questions</div>
                    <div style={{ textAlign: 'center' }}>Prompt Ver</div>
                  </div>
                  
                  {/* Table Rows */}
                  {topData.map((row, index) => {
                    const isIncept = shouldHighlightExperiment(row.model);
                    
                    return (
                      <div
                        key={index}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '40px 1fr 90px 100px',
                          padding: '10px 12px',
                          borderBottom: index < topData.length - 1 ? '1px solid var(--border)' : 'none',
                          background: isIncept ? 'rgba(99, 102, 241, 0.05)' : 'transparent',
                          transition: 'background 0.2s ease',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = isIncept ? 'rgba(99, 102, 241, 0.1)' : 'var(--hover-bg)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = isIncept ? 'rgba(99, 102, 241, 0.05)' : 'transparent';
                        }}
                      >
                        {/* Rank */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          <div style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            background: isIncept 
                              ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' 
                              : index === 0 ? 'linear-gradient(135deg, #10b981, #059669)'
                              : index === 1 ? 'linear-gradient(135deg, #3b82f6, #2563eb)'
                              : index === 2 ? 'linear-gradient(135deg, #14b8a6, #0d9488)'
                              : 'rgba(100, 100, 100, 0.6)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontSize: '11px',
                            fontWeight: '700',
                          }}>
                            {index + 1}
                          </div>
                        </div>
                        
                        {/* Model name */}
                        <div style={{
                          fontSize: '13px',
                          fontWeight: '500',
                          color: 'var(--text)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {row.model}
                        </div>
                        
                        {/* Questions (x/y format) */}
                        <div style={{
                          fontSize: '12px',
                          fontWeight: '600',
                          color: 'var(--text-secondary)',
                          textAlign: 'center',
                          fontFamily: 'monospace',
                        }}>
                          {row.questionsAboveThreshold}/{row.totalQuestions}
                        </div>
                        
                        {/* Prompt Version */}
                        <div 
                          onClick={(e) => {
                            e.stopPropagation();
                            // TODO: Add prompt version action
                          }}
                          style={{
                            fontSize: '12px',
                            fontWeight: '500',
                            color: 'var(--primary)',
                            textAlign: 'center',
                            fontFamily: 'monospace',
                            cursor: 'pointer',
                            transition: 'opacity 0.2s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.opacity = '0.7';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.opacity = '1';
                          }}
                        >
                          -
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Right: Horizontal Bar Graph */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}>
                  {topData.map((row, index) => {
                    const barWidthPercent = (row.percentage / maxPercentage) * 100;
                    const isIncept = shouldHighlightExperiment(row.model);
                    
                    return (
                      <div
                        key={index}
                        style={{
                          position: 'relative',
                        }}
                      >
                        {/* Bar background */}
                        <div style={{
                          position: 'relative',
                          height: '32px',
                          background: 'rgba(255, 255, 255, 0.05)',
                          borderRadius: '6px',
                          overflow: 'visible',
                        }}>
                          {/* Vertical grid lines */}
                          {[25, 50, 75].map(val => (
                            <div
                              key={val}
                              style={{
                                position: 'absolute',
                                left: `${val}%`,
                                top: 0,
                                bottom: 0,
                                width: '1px',
                                background: 'var(--border)',
                                opacity: 0.2,
                              }}
                            />
                          ))}
                          
                          {/* Bar fill */}
                          <div
                            style={{
                              position: 'absolute',
                              left: 0,
                              top: 0,
                              bottom: 0,
                              width: `${barWidthPercent}%`,
                              background: isIncept
                                ? 'linear-gradient(90deg, #6366f1 0%, #8b5cf6 100%)'
                                : index === 0
                                ? 'linear-gradient(90deg, #10b981 0%, #059669 100%)'
                                : index === 1
                                ? 'linear-gradient(90deg, #3b82f6 0%, #2563eb 100%)'
                                : index === 2
                                ? 'linear-gradient(90deg, #14b8a6 0%, #0d9488 100%)'
                                : `linear-gradient(90deg, ${color} 0%, ${color}cc 100%)`,
                              borderRadius: '6px',
                              transition: 'all 0.3s ease',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {/* Percentage inside bar */}
                            <div style={{
                              fontSize: '13px',
                              color: 'white',
                              fontWeight: '700',
                              fontFamily: 'monospace',
                              textShadow: '0 1px 3px rgba(0, 0, 0, 0.5)',
                            }}>
                              {row.percentage.toFixed(1)}%
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        };

        return (
          <div
            onClick={() => setTopPerformersModalOpen(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.85)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: '20px',
              backdropFilter: 'blur(8px)',
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'var(--surface)',
                borderRadius: '16px',
                maxWidth: '1400px',
                width: '100%',
                maxHeight: '85vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 25px 80px rgba(0, 0, 0, 0.6)',
                border: '1px solid var(--border)',
                overflow: 'hidden',
              }}
            >
              {/* Modal Header */}
              <div style={{
                padding: '20px 24px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'linear-gradient(135deg, rgba(158, 127, 255, 0.08), transparent)',
              }}>
                <div>
                  <h2 style={{
                    fontSize: '20px',
                    fontWeight: '700',
                    color: 'var(--text)',
                    margin: 0,
                    letterSpacing: '-0.3px',
                  }}>
                    Top 5
                  </h2>
                  <p style={{
                    fontSize: '12px',
                    color: 'var(--text-secondary)',
                    margin: '4px 0 0 0',
                  }}>
                    {selectedSubject.toUpperCase()} benchmarks
                  </p>
                </div>
                <button
                  onClick={() => setTopPerformersModalOpen(false)}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    background: 'transparent',
                    border: '1px solid var(--border)',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                    e.currentTarget.style.color = 'var(--error)';
                    e.currentTarget.style.borderColor = 'var(--error)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                    e.currentTarget.style.borderColor = 'var(--border)';
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body - Charts Stacked Vertically */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                overflowX: 'hidden',
                padding: '24px',
              }}
              className="custom-scrollbar"
              >
                {groupedByDifficulty['Easy'] && groupedByDifficulty['Easy'].length > 0 && (
                  <CompactChart
                    title="Easy"
                    data={groupedByDifficulty['Easy']}
                    color="#10b981"
                  />
                )}

                {groupedByDifficulty['Medium'] && groupedByDifficulty['Medium'].length > 0 && (
                  <CompactChart
                    title="Medium"
                    data={groupedByDifficulty['Medium']}
                    color="#f59e0b"
                  />
                )}

                {groupedByDifficulty['Hard'] && groupedByDifficulty['Hard'].length > 0 && (
                  <CompactChart
                    title="Hard"
                    data={groupedByDifficulty['Hard']}
                    color="#ef4444"
                  />
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default Benchmarks;
