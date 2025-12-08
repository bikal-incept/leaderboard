import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpDown, FileText, Copy, Check, ChevronDown, ChevronUp, Filter, Eye, X, BarChart3, TrendingUp } from 'lucide-react';
import { leaderboardData, type LeaderboardRow } from '../data/leaderboardData';

const SUBJECTS = ['ela', 'math'] as const;
type Subject = (typeof SUBJECTS)[number];

type SortConfig = {
  key: 'rank' | 'model' | 'score' | 'votes';
  direction: 'asc' | 'desc';
};

const Benchmarks: React.FC = () => {
  const navigate = useNavigate();
  const [selectedSubject, setSelectedSubject] = useState<Subject>('math');

  // Applied filter states (actually used for fetching data)
  const [appliedGradeLevel, setAppliedGradeLevel] = useState<string>('3');
  const [appliedQuestionType, setAppliedQuestionType] = useState<string>('mcq');
  const [appliedMinTotalQuestions, setAppliedMinTotalQuestions] = useState<number>(120);

  // Pending filter states (user selection before applying)
  const [gradeLevel, setGradeLevel] = useState<string>('3');
  const [questionType, setQuestionType] = useState<string>('mcq');
  const [minTotalQuestions, setMinTotalQuestions] = useState<number>(120);

  const [leaderboardRows, setLeaderboardRows] = useState<LeaderboardRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedExperiment, setCopiedExperiment] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  
  // Modal states
  const [difficultyModalOpen, setDifficultyModalOpen] = useState(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null);
  const [topPerformersModalOpen, setTopPerformersModalOpen] = useState(false);

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
          ...(appliedGradeLevel && { grade_level: appliedGradeLevel }),
          ...(appliedQuestionType && { question_type: appliedQuestionType }),
          ...(appliedMinTotalQuestions && { min_total_questions: appliedMinTotalQuestions.toString() }),
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
        setError('Failed to load leaderboard data. Please try again later.');
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
              // Keep current filters when switching subjects
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
              setGradeLevel('3');
              setQuestionType('mcq');
              setMinTotalQuestions(120);
              setAppliedGradeLevel('3');
              setAppliedQuestionType('mcq');
              setAppliedMinTotalQuestions(120);
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
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {row.model}
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

      {/* Top Performers Modal - Matplotlib Style */}
      {topPerformersModalOpen && (() => {
        // Helper to render a matplotlib-style chart
        const MatplotlibChart = ({ 
          title, 
          data, 
          color,
          icon 
        }: { 
          title: string; 
          data: LeaderboardRow[]; 
          color: string;
          icon: React.ReactNode;
        }) => {
          const topData = data
            .sort((a, b) => b.percentage - a.percentage)
            .slice(0, 5);
          
          const maxPercentage = 100; // Use 100 as max for consistent scale
          const chartHeight = 380;
          const barHeight = 50;
          const chartPadding = { top: 40, right: 120, bottom: 50, left: 280 };
          
          return (
            <div style={{
              background: 'var(--background)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '24px',
              marginBottom: '24px',
            }}>
              {/* Chart Title */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '24px',
              }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: `${color}15`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: color,
                }}>
                  {icon}
                </div>
                <h3 style={{
                  fontSize: '18px',
                  fontWeight: '600',
                  color: 'var(--text)',
                  margin: 0,
                  fontFamily: 'monospace',
                }}>
                  {title} Difficulty Performance
                </h3>
              </div>

              {/* SVG Chart Container */}
              <div style={{
                position: 'relative',
                width: '100%',
                height: `${chartHeight}px`,
                background: 'var(--surface)',
                borderRadius: '8px',
                border: '1px solid var(--border)',
              }}>
                <svg
                  width="100%"
                  height={chartHeight}
                  style={{
                    display: 'block',
                  }}
                >
                  <defs>
                    {/* Grid pattern */}
                    <pattern id={`grid-${title}`} width="10%" height="20" patternUnits="userSpaceOnUse">
                      <line x1="0" y1="0" x2="0" y2={chartHeight} stroke="var(--border)" strokeWidth="0.5" opacity="0.3" />
                    </pattern>
                    
                    {/* Bar gradient */}
                    <linearGradient id={`bar-gradient-${title}`} x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor={color} stopOpacity="0.9" />
                      <stop offset="100%" stopColor={color} stopOpacity="0.6" />
                    </linearGradient>
                  </defs>
                  
                  {/* Background grid */}
                  <rect width="100%" height="100%" fill={`url(#grid-${title})`} />
                  
                  {/* Vertical grid lines */}
                  {[0, 20, 40, 60, 80, 100].map(val => {
                    const x = chartPadding.left + ((val / maxPercentage) * (100 - chartPadding.left - chartPadding.right) * 10);
                    return (
                      <g key={val}>
                        <line
                          x1={`${x}%`}
                          y1={chartPadding.top}
                          x2={`${x}%`}
                          y2={chartHeight - chartPadding.bottom}
                          stroke="var(--border)"
                          strokeWidth="1"
                          opacity="0.5"
                          strokeDasharray={val === 0 ? "0" : "2,2"}
                        />
                        {/* X-axis labels */}
                        <text
                          x={`${x}%`}
                          y={chartHeight - chartPadding.bottom + 25}
                          textAnchor="middle"
                          fill="var(--text-secondary)"
                          fontSize="11"
                          fontFamily="monospace"
                        >
                          {val}%
                        </text>
                      </g>
                    );
                  })}
                  
                  {/* Bars and labels */}
                  {topData.map((row, index) => {
                    const y = chartPadding.top + (index * (barHeight + 10));
                    const barWidthPercent = (row.percentage / maxPercentage) * (100 - chartPadding.left - chartPadding.right);
                    
                    return (
                      <g key={index}>
                        {/* Model name (Y-axis label) */}
                        <text
                          x={chartPadding.left - 10}
                          y={y + (barHeight / 2) + 4}
                          textAnchor="end"
                          fill="var(--text)"
                          fontSize="12"
                          fontWeight="500"
                          style={{
                            fontFamily: 'system-ui, -apple-system, sans-serif',
                          }}
                        >
                          {row.model.length > 30 ? row.model.substring(0, 30) + '...' : row.model}
                        </text>
                        
                        {/* Rank badge */}
                        <circle
                          cx={chartPadding.left - 265}
                          cy={y + (barHeight / 2)}
                          r="12"
                          fill={index < 3 ? 'var(--primary)' : 'var(--border)'}
                          opacity="0.2"
                        />
                        <text
                          x={chartPadding.left - 265}
                          y={y + (barHeight / 2) + 4}
                          textAnchor="middle"
                          fill={index < 3 ? 'var(--primary)' : 'var(--text-secondary)'}
                          fontSize="11"
                          fontWeight="700"
                          fontFamily="monospace"
                        >
                          {index + 1}
                        </text>
                        
                        {/* Bar background */}
                        <rect
                          x={`${chartPadding.left}%`}
                          y={y}
                          width={`${100 - chartPadding.left - chartPadding.right}%`}
                          height={barHeight}
                          fill="rgba(255, 255, 255, 0.02)"
                          rx="4"
                        />
                        
                        {/* Animated bar */}
                        <rect
                          x={`${chartPadding.left}%`}
                          y={y}
                          width={`${barWidthPercent}%`}
                          height={barHeight}
                          fill={`url(#bar-gradient-${title})`}
                          rx="4"
                          style={{
                            transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                          }}
                        />
                        
                        {/* Bar border */}
                        <rect
                          x={`${chartPadding.left}%`}
                          y={y}
                          width={`${barWidthPercent}%`}
                          height={barHeight}
                          fill="none"
                          stroke={color}
                          strokeWidth="1.5"
                          rx="4"
                          opacity="0.4"
                        />
                        
                        {/* Percentage label inside bar */}
                        {row.percentage > 10 && (
                          <text
                            x={`${chartPadding.left + (barWidthPercent) - 2}%`}
                            y={y + (barHeight / 2) + 4}
                            textAnchor="end"
                            fill="white"
                            fontSize="13"
                            fontWeight="700"
                            fontFamily="monospace"
                            style={{
                              textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                            }}
                          >
                            {row.percentage.toFixed(1)}%
                          </text>
                        )}
                        
                        {/* Percentage label outside bar if too small */}
                        {row.percentage <= 10 && (
                          <text
                            x={`${chartPadding.left + (barWidthPercent) + 2}%`}
                            y={y + (barHeight / 2) + 4}
                            textAnchor="start"
                            fill="var(--text)"
                            fontSize="13"
                            fontWeight="700"
                            fontFamily="monospace"
                          >
                            {row.percentage.toFixed(1)}%
                          </text>
                        )}
                        
                        {/* Questions info */}
                        <text
                          x={`${100 - chartPadding.right + 5}%`}
                          y={y + (barHeight / 2) - 6}
                          textAnchor="start"
                          fill="var(--text-secondary)"
                          fontSize="10"
                          fontFamily="monospace"
                        >
                          Q≥0.85: {row.questionsAboveThreshold}
                        </text>
                        <text
                          x={`${100 - chartPadding.right + 5}%`}
                          y={y + (barHeight / 2) + 10}
                          textAnchor="start"
                          fill="var(--text-secondary)"
                          fontSize="10"
                          fontFamily="monospace"
                        >
                          Total: {row.totalQuestions}
                        </text>
                      </g>
                    );
                  })}
                  
                  {/* Chart border */}
                  <rect
                    x={`${chartPadding.left}%`}
                    y={chartPadding.top}
                    width={`${100 - chartPadding.left - chartPadding.right}%`}
                    height={chartHeight - chartPadding.top - chartPadding.bottom}
                    fill="none"
                    stroke="var(--border)"
                    strokeWidth="2"
                  />
                  
                  {/* X-axis label */}
                  <text
                    x="50%"
                    y={chartHeight - 10}
                    textAnchor="middle"
                    fill="var(--text)"
                    fontSize="12"
                    fontWeight="600"
                    fontFamily="monospace"
                  >
                    Success Rate (%)
                  </text>
                  
                  {/* Y-axis label */}
                  <text
                    x={chartPadding.left - 150}
                    y={20}
                    textAnchor="middle"
                    fill="var(--text)"
                    fontSize="12"
                    fontWeight="600"
                    fontFamily="monospace"
                  >
                    Model
                  </text>
                </svg>
              </div>
              
              {/* Stats summary */}
              <div style={{
                marginTop: '16px',
                padding: '12px 16px',
                background: 'var(--surface)',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                display: 'flex',
                gap: '24px',
                fontSize: '12px',
                fontFamily: 'monospace',
              }}>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>Avg: </span>
                  <span style={{ color: 'var(--text)', fontWeight: '600' }}>
                    {(topData.reduce((sum, d) => sum + d.percentage, 0) / topData.length).toFixed(1)}%
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>Max: </span>
                  <span style={{ color: color, fontWeight: '600' }}>
                    {Math.max(...topData.map(d => d.percentage)).toFixed(1)}%
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>Min: </span>
                  <span style={{ color: 'var(--text)', fontWeight: '600' }}>
                    {Math.min(...topData.map(d => d.percentage)).toFixed(1)}%
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>Total Models: </span>
                  <span style={{ color: 'var(--text)', fontWeight: '600' }}>
                    {data.length}
                  </span>
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
              background: 'rgba(0, 0, 0, 0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: '20px',
              backdropFilter: 'blur(4px)',
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'var(--surface)',
                borderRadius: '16px',
                maxWidth: '1600px',
                width: '100%',
                maxHeight: '90vh',
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
                background: 'linear-gradient(135deg, rgba(158, 127, 255, 0.05), transparent)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, var(--primary), #8b5cf6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    boxShadow: '0 4px 12px rgba(158, 127, 255, 0.3)',
                  }}>
                    <BarChart3 size={24} />
                  </div>
                  <div>
                    <h2 style={{
                      fontSize: '22px',
                      fontWeight: '700',
                      color: 'var(--text)',
                      margin: 0,
                      fontFamily: 'system-ui, -apple-system, sans-serif',
                    }}>
                      Model Performance Analysis
                    </h2>
                    <p style={{
                      fontSize: '13px',
                      color: 'var(--text-secondary)',
                      margin: '4px 0 0 0',
                      fontFamily: 'monospace',
                    }}>
                      Top 5 performers across difficulty levels • {selectedSubject.toUpperCase()} Subject
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setTopPerformersModalOpen(false)}
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
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
                  <X size={20} />
                </button>
              </div>

              {/* Modal Body - Scrollable */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                overflowX: 'hidden',
                padding: '32px',
              }}
              className="custom-scrollbar"
              >
                {groupedByDifficulty['Easy'] && groupedByDifficulty['Easy'].length > 0 && (
                  <MatplotlibChart
                    title="Easy"
                    data={groupedByDifficulty['Easy']}
                    color="#10b981"
                    icon={<TrendingUp size={16} />}
                  />
                )}

                {groupedByDifficulty['Medium'] && groupedByDifficulty['Medium'].length > 0 && (
                  <MatplotlibChart
                    title="Medium"
                    data={groupedByDifficulty['Medium']}
                    color="#f59e0b"
                    icon={<BarChart3 size={16} />}
                  />
                )}

                {groupedByDifficulty['Hard'] && groupedByDifficulty['Hard'].length > 0 && (
                  <MatplotlibChart
                    title="Hard"
                    data={groupedByDifficulty['Hard']}
                    color="#ef4444"
                    icon={<TrendingUp size={16} />}
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
