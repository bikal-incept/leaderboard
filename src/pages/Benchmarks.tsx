import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpDown, FileText, Copy, Check, ChevronDown, ChevronUp, Filter, Eye, X, TrendingUp, Download } from 'lucide-react';
import { leaderboardData, type LeaderboardRow } from '../data/leaderboardData';

const SUBJECTS = ['ela', 'math'] as const;
type Subject = (typeof SUBJECTS)[number];

type SortConfig = {
  key: 'rank' | 'model' | 'score' | 'votes';
  direction: 'asc' | 'desc';
};

const Benchmarks: React.FC = () => {
  const navigate = useNavigate();
  const [selectedSubject, setSelectedSubject] = useState<Subject>('ela');

  // Applied filter states (actually used for fetching data)
  // Default to 60 questions for ELA
  const [appliedGradeLevel, setAppliedGradeLevel] = useState<string>('');
  const [appliedQuestionType, setAppliedQuestionType] = useState<string>('');
  const [appliedMinTotalQuestions, setAppliedMinTotalQuestions] = useState<number>(60);

  // Pending filter states (user selection before applying)
  const [gradeLevel, setGradeLevel] = useState<string>('');
  const [questionType, setQuestionType] = useState<string>('');
  const [minTotalQuestions, setMinTotalQuestions] = useState<number>(60);

  const [leaderboardRows, setLeaderboardRows] = useState<LeaderboardRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedExperiment, setCopiedExperiment] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [addedToCache, setAddedToCache] = useState<string | null>(null);
  const [isCaching, setIsCaching] = useState<string | null>(null);
  
  // Modal states
  const [difficultyModalOpen, setDifficultyModalOpen] = useState(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null);
  const [topPerformersModalOpen, setTopPerformersModalOpen] = useState(false);

  // Cache helpers (match Evaluations/CompareReports)
  const CACHE_KEY = 'experiment_reports_cache';
  const MAX_CACHE_ITEMS = 4;

  const getCacheKey = (filters: { experiment_tracker: string; subject: string; grade_level: string; question_type: string }) => {
    return `${filters.experiment_tracker}|${filters.subject}|${filters.grade_level}|${filters.question_type}`;
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
    filters: { experiment_tracker: string; subject: string; grade_level: string; question_type: string },
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

  // Check if there are unapplied filter changes
  const hasUnappliedChanges = 
    gradeLevel !== appliedGradeLevel ||
    questionType !== appliedQuestionType ||
    minTotalQuestions !== appliedMinTotalQuestions;

  const applyFilters = () => {
    setAppliedGradeLevel(gradeLevel);
    setAppliedQuestionType(questionType);
    setAppliedMinTotalQuestions(minTotalQuestions);
  };

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
        const apiSubject = selectedSubject;

        const params = new URLSearchParams({
          subject: apiSubject,
          evaluator_version: '2.0.0', // Use 2.0.0 evaluator version
          ...(appliedGradeLevel && { grade_level: appliedGradeLevel }),
          ...(appliedQuestionType && { question_type: appliedQuestionType }),
          ...(appliedMinTotalQuestions > 0 && { min_total_questions: appliedMinTotalQuestions.toString() }),
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
  }, [selectedSubject, appliedGradeLevel, appliedQuestionType, appliedMinTotalQuestions]);

  const subjectData = leaderboardRows.filter(
    row => (row.subject || '').toLowerCase() === selectedSubject
  );
  console.log(
    `[Leaderboard] Filtered ${subjectData.length} rows for "${selectedSubject}" from ${leaderboardRows.length} total rows`
  );
  
  const groupedByDifficulty = subjectData.reduce((acc, row) => {
    if (!acc[row.difficulty]) {
      acc[row.difficulty] = [];
    }
    acc[row.difficulty].push(row);
    return acc;
  }, {} as Record<string, LeaderboardRow[]>);

  const getPercentageColor = (percentage: number) => {
    if (percentage >= 90) return 'var(--success)';
    if (percentage >= 85) return 'var(--warning)';
    return 'var(--error)';
  };

  const openDifficultyModal = (difficulty: string) => {
    setSelectedDifficulty(difficulty);
    setDifficultyModalOpen(true);
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
            const isIncept = row.model.toLowerCase() === 'incept';
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
                    model: encodeURIComponent(row.model),
                    subject: selectedSubject,
                    ...(appliedGradeLevel && { grade_level: appliedGradeLevel }),
                    ...(appliedQuestionType && { question_type: appliedQuestionType }),
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
        <h1 style={{
          fontSize: '28px',
          fontWeight: '700',
          color: 'var(--text)',
          marginBottom: '8px',
        }}>
          Leaderboard
        </h1>
       

        {/* Subject Tabs */}
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)' }}>
          <button
            onClick={() => {
              setSelectedSubject('ela');
              // Reset to ELA defaults (60 questions minimum)
              setGradeLevel('');
              setQuestionType('');
              setMinTotalQuestions(60);
              setAppliedGradeLevel('');
              setAppliedQuestionType('');
              setAppliedMinTotalQuestions(60);
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
              setAppliedGradeLevel('3');
              setAppliedQuestionType('mcq');
              setAppliedMinTotalQuestions(120);
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

        {/* Filters Section */}
        <div style={{
          marginTop: '24px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          overflow: 'hidden',
        }}>
          {/* Filters Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <button
              onClick={() => setShowFilters(!showFilters)}
              style={{
                flex: 1,
                padding: '16px 20px',
                background: 'transparent',
                border: 'none',
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
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}>
                <span style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: 'var(--text)',
                }}>
                  Filters
                </span>
                <span style={{
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                }}>
                  {appliedGradeLevel && `Grade ${appliedGradeLevel}`}
                  {appliedGradeLevel && (appliedQuestionType || appliedMinTotalQuestions) && ' • '}
                  {appliedQuestionType && appliedQuestionType.toUpperCase()}
                  {appliedQuestionType && appliedMinTotalQuestions && ' • '}
                  {appliedMinTotalQuestions && `Min ${appliedMinTotalQuestions} questions`}
                </span>
              </div>
              <div style={{ color: 'var(--text-secondary)' }}>
                {showFilters ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </div>
            </button>
            
            {/* Top Performers Button */}
            <button
              onClick={() => setTopPerformersModalOpen(true)}
              style={{
                padding: '8px 20px',
                marginRight: '16px',
                background: 'linear-gradient(135deg, var(--primary) 0%, #8b5cf6 100%)',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 8px rgba(158, 127, 255, 0.3)',
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
              <TrendingUp size={16} />
              Top Performers
            </button>
          </div>

          {/* Filters Content */}
          {showFilters && (
            <div style={{
              padding: '0 20px 20px 20px',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              gap: '16px',
              alignItems: 'flex-end',
              flexWrap: 'wrap',
            }}>
              <div style={{ height: '16px', width: '100%' }}></div>
              {/* Grade Level Filter */}
          <div style={{ minWidth: '150px' }}>
            <label style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: '600',
              color: 'var(--text-secondary)',
              marginBottom: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
              Grade Level
            </label>
            <input
              type="text"
              value={gradeLevel}
              onChange={(e) => setGradeLevel(e.target.value)}
              placeholder="e.g., 3"
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

          {/* Question Type Filter */}
          <div style={{ minWidth: '150px' }}>
            <label style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: '600',
              color: 'var(--text-secondary)',
              marginBottom: '8px',
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

          {/* Minimum Total Questions Filter */}
          <div style={{ minWidth: '180px' }}>
            <label style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: '600',
              color: 'var(--text-secondary)',
              marginBottom: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
              Min Total Questions
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
              if (selectedSubject === 'ela') {
                setGradeLevel('');
                setQuestionType('');
                setMinTotalQuestions(60);
                setAppliedGradeLevel('');
                setAppliedQuestionType('');
                setAppliedMinTotalQuestions(60);
              } else {
                setGradeLevel('3');
                setQuestionType('mcq');
                setMinTotalQuestions(120);
                setAppliedGradeLevel('3');
                setAppliedQuestionType('mcq');
                setAppliedMinTotalQuestions(120);
              }
            }}
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              fontWeight: '500',
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
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
            Reset Filters
          </button>

          {/* Apply Filters Button */}
          <button
            onClick={applyFilters}
            disabled={!hasUnappliedChanges}
            style={{
              padding: '8px 24px',
              fontSize: '14px',
              fontWeight: '600',
              background: hasUnappliedChanges
                ? 'linear-gradient(135deg, var(--success) 0%, #059669 100%)'
                : 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              color: hasUnappliedChanges ? '#ffffff' : 'var(--text-secondary)',
              cursor: hasUnappliedChanges ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              opacity: hasUnappliedChanges ? 1 : 0.5,
            }}
            onMouseEnter={(e) => {
              if (hasUnappliedChanges) {
                e.currentTarget.style.transform = 'scale(1.05)';
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(16, 185, 129, 0.3)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <Filter size={16} />
            Apply Filters
          </button>
            </div>
          )}
        </div>
      </div>

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
                  const isIncept = row.model.toLowerCase() === 'incept';
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
                          model: encodeURIComponent(row.model),
                          subject: selectedSubject,
                          ...(appliedGradeLevel && { grade_level: appliedGradeLevel }),
                          ...(appliedQuestionType && { question_type: appliedQuestionType }),
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
                    const isIncept = row.model.toLowerCase().includes('incept');
                    
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
                    const isIncept = row.model.toLowerCase().includes('incept');
                    
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
