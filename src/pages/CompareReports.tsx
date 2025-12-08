// src/pages/CompareReports.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { GitCompare, Trash2, Clock, TrendingUp, BarChart3, Activity } from 'lucide-react';

// Types matching the Evaluations.tsx file
type ExperimentScoreRow = {
  question_id: number;
  recipe_id: number;
  evaluator_score: number;
  difficulty: string;
};

interface ExperimentReportRow {
  experiment_tracker: string;
  model: string;
  subject: string;
  grade_level: string;
  question_type: string;
  difficulty: string;
  total_questions: number | string;
  questions_above_threshold: number | string;
  success_percentage: number;
  avg_ttft_ms: number;
  median_ttft_ms: number;
  p10_ttft_ms: number;
  p90_ttft_ms: number;
  p95_ttft_ms: number;
  avg_total_generation_ms: number;
  median_total_generation_ms: number;
  p10_total_generation_ms: number;
  p90_total_generation_ms: number;
  p95_total_generation_ms: number;
  avg_evaluator_score: number;
  median_evaluator_score: number;
  min_evaluator_score: number;
  max_evaluator_score: number;
  zero_scores: number | string;
  below_threshold: number | string;
}

interface ExperimentSummary {
  experiment_tracker: string;
  model: string;
  total_questions: number | string;
  questions_above_threshold: number | string;
  total_recipes: number | string;
  success_percentage: number;
  prompt_id: string;
  temperature: number;
  provider: string;
  method: string;
  avg_ttft_ms: number;
  avg_total_generation_ms: number;
  avg_evaluator_score: number;
}

type CachedExperimentReport = {
  experiment_tracker: string;
  subject: string;
  grade_level: string;
  question_type: string;
  timestamp: number;
  reportData: ExperimentReportRow[];
  summaryData: ExperimentSummary | null;
  scoresData: ExperimentScoreRow[];
};

// Cache management
const CACHE_KEY = 'experiment_reports_cache';
const MAX_CACHE_ITEMS = 4;
const MAX_COMPARE_ITEMS = 4;

const loadCache = (): CachedExperimentReport[] => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) {
      console.log('[CompareReports Cache] No cache found');
      return [];
    }
    
    const parsed = JSON.parse(cached);
    console.log('[CompareReports Cache] Raw cache loaded:', parsed.length, 'items');
    
    const cleaned: CachedExperimentReport[] = parsed
      .filter((item: any, index: number) => {
        // Must have essential data; allow empty reportData array
        const isValid = item.experiment_tracker && item.reportData !== undefined;
        
        if (!isValid) {
          console.warn('[CompareReports Cache] Filtering out invalid item at index', index, {
            hasReportData: Array.isArray(item.reportData),
            reportDataLength: item.reportData?.length,
            hasExperimentTracker: !!item.experiment_tracker,
          });
        }
        
        return isValid;
      })
      .map((item: any) => {
        const safeScores: ExperimentScoreRow[] = Array.isArray(item.scoresData)
          ? item.scoresData.map((s: any) => ({
              question_id: Number(s.question_id),
              recipe_id: Number(s.recipe_id),
              evaluator_score: Number(s.evaluator_score),
              difficulty: String(s.difficulty ?? ''),
            }))
          : [];

        return {
          ...item,
          scoresData: safeScores,
        } as CachedExperimentReport;
      });

    console.log('[CompareReports Cache] After filtering:', cleaned.length, 'valid items');

    // Sort by most recent first
    cleaned.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
    
    // Keep only the most recent items
    const result = cleaned.slice(0, MAX_CACHE_ITEMS);
    
    console.log('[CompareReports Cache] Returning', result.length, 'items');
    
    // If we filtered out invalid entries (not just sliced), save cleaned cache back
    const removedInvalid = parsed.length - cleaned.length;
    if (removedInvalid > 0) {
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(result));
        console.log('[CompareReports Cache] Cleaned and saved cache, removed', removedInvalid, 'invalid entries');
      } catch (err) {
        console.warn('[CompareReports Cache] Failed to save cleaned cache', err);
      }
    }
    
    return result;
  } catch (err) {
    console.error('[CompareReports Cache] Failed to load cache', err);
    return [];
  }
};

const getCacheKey = (report: CachedExperimentReport) => {
  return `${report.experiment_tracker}|${report.subject}|${report.grade_level}|${report.question_type}`;
};

const deleteFromCache = (cacheKey: string) => {
  try {
    const cache = loadCache();
    const filteredCache = cache.filter(item => getCacheKey(item) !== cacheKey);
    localStorage.setItem(CACHE_KEY, JSON.stringify(filteredCache));
  } catch (err) {
    console.error('Failed to delete from cache', err);
  }
};

const CompareReports: React.FC = () => {
  const [cachedReports, setCachedReports] = useState<CachedExperimentReport[]>([]);
  const [selectedReports, setSelectedReports] = useState<Set<string>>(new Set());

  useEffect(() => {
    const reports = loadCache();
    console.log('[CompareReports] Loaded cache:', reports);
    if (reports.length > 0) {
      console.log('[CompareReports] First report structure:', {
        reportDataLength: reports[0].reportData?.length,
        reportDataSample: reports[0].reportData?.[0],
        scoresDataLength: reports[0].scoresData?.length,
        summaryData: reports[0].summaryData,
      });
      console.log('[CompareReports] All difficulties in first report:', 
        reports[0].reportData?.map(r => `"${r.difficulty}"`)
      );
    }
    setCachedReports(reports);
    if (reports.length > 0) {
      // Preselect newest reports so comparison renders immediately
      const initialSelection = new Set(
        reports.slice(0, MAX_COMPARE_ITEMS).map(getCacheKey)
      );
      setSelectedReports(initialSelection);
    }
  }, []);

  const toggleReportSelection = (cacheKey: string) => {
    setSelectedReports(prev => {
      const next = new Set(prev);
      if (next.has(cacheKey)) {
        next.delete(cacheKey);
      } else if (next.size < MAX_COMPARE_ITEMS) {
        next.add(cacheKey);
      }
      return next;
    });
  };

  const handleDeleteReport = (cacheKey: string) => {
    deleteFromCache(cacheKey);
    const reports = loadCache();
    setCachedReports(reports);
    setSelectedReports(prev => {
      const next = new Set(prev);
      next.delete(cacheKey);
      return next;
    });
  };

  const reportsToCompare = useMemo(() => {
    const filtered = cachedReports.filter(report => selectedReports.has(getCacheKey(report)));
    console.log('[CompareReports] Reports to compare:', filtered.length, filtered);
    return filtered;
  }, [cachedReports, selectedReports]);

  const getReportLabel = (report: CachedExperimentReport) => {
    return `${report.experiment_tracker} | ${report.subject} | ${report.grade_level || 'All'} | ${report.question_type || 'All'}`;
  };

  const getReportName = (report: CachedExperimentReport) => {
    // Return full experiment tracker name
    return report.experiment_tracker;
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // Calculate latency comparison data
  const latencyComparisonData = useMemo(() => {
    const difficulties = ['Easy', 'Medium', 'Hard'];
    console.log('[CompareReports] Building latency comparison for', reportsToCompare.length, 'reports');
    
    if (reportsToCompare.length > 0 && reportsToCompare[0].reportData) {
      console.log('[CompareReports] Sample reportData from first report:', 
        reportsToCompare[0].reportData.map(r => ({
          difficulty: r.difficulty,
          difficultyLower: r.difficulty?.toLowerCase(),
          hasLatency: !!(r.avg_ttft_ms || r.median_ttft_ms),
        }))
      );
    }
    
    return difficulties.map(difficulty => {
      const row: any = { difficulty };
      reportsToCompare.forEach((report, idx) => {
        const availableDiffs = report.reportData?.map(r => `"${r.difficulty}"`) || [];
        console.log(`[CompareReports] Looking for difficulty "${difficulty}" in report ${idx}`, {
          availableDifficulties: availableDiffs,
          reportDataLength: report.reportData?.length,
        });
        
        // Try case-insensitive matching
        const diffData = report.reportData?.find(r => 
          r.difficulty && r.difficulty.toLowerCase() === difficulty.toLowerCase()
        );
        console.log(`[CompareReports] Found data for ${difficulty}, report ${idx}:`, diffData ? 'YES' : 'NO', diffData);
        
        if (diffData) {
          row[`report${idx}_ttft_p50`] = diffData.median_ttft_ms || diffData.avg_ttft_ms;
          row[`report${idx}_ttft_p90`] = diffData.p90_ttft_ms;
          row[`report${idx}_gen_p50`] = diffData.median_total_generation_ms || diffData.avg_total_generation_ms;
          row[`report${idx}_gen_p90`] = diffData.p90_total_generation_ms;
        } else {
          row[`report${idx}_ttft_p50`] = null;
          row[`report${idx}_ttft_p90`] = null;
          row[`report${idx}_gen_p50`] = null;
          row[`report${idx}_gen_p90`] = null;
        }
      });
      console.log(`[CompareReports] Row for ${difficulty}:`, row);
      return row;
    });
  }, [reportsToCompare]);

  // Calculate performance comparison data
  const performanceComparisonData = useMemo(() => {
    const difficulties = ['Easy', 'Medium', 'Hard'];
    return difficulties.map(difficulty => {
      const row: any = { difficulty };
      reportsToCompare.forEach((report, idx) => {
        // Case-insensitive matching
        const diffData = report.reportData?.find(r => 
          r.difficulty && r.difficulty.toLowerCase() === difficulty.toLowerCase()
        );
        if (diffData) {
          row[`report${idx}_success_rate`] = diffData.success_percentage;
          row[`report${idx}_total_questions`] = Number(diffData.total_questions);
          row[`report${idx}_above_threshold`] = Number(diffData.questions_above_threshold);
        } else {
          row[`report${idx}_success_rate`] = null;
          row[`report${idx}_total_questions`] = null;
          row[`report${idx}_above_threshold`] = null;
        }
      });
      return row;
    });
  }, [reportsToCompare]);

  // Calculate evaluator scores distribution
  const scoresDistributionData = useMemo(() => {
    const bins = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const difficulties = ['Easy', 'Medium', 'Hard'];
    
    return difficulties.map(difficulty => {
      const row: any = { difficulty };
      
      reportsToCompare.forEach((report, idx) => {
        // Case-insensitive matching
        const scoresForDiff = (report.scoresData || []).filter(s => 
          s.difficulty && s.difficulty.toLowerCase() === difficulty.toLowerCase()
        );
        const distribution = bins.map(bin => {
          if (bin === 10) {
            return scoresForDiff.filter(s => s.evaluator_score === 10).length;
          }
          return scoresForDiff.filter(s => s.evaluator_score >= bin && s.evaluator_score < bin + 1).length;
        });
        row[`report${idx}_dist`] = distribution;
        row[`report${idx}_avg`] = scoresForDiff.length > 0
          ? (scoresForDiff.reduce((sum, s) => sum + s.evaluator_score, 0) / scoresForDiff.length).toFixed(2)
          : 'N/A';
      });
      
      return row;
    });
  }, [reportsToCompare]);

  return (
    <div style={{ padding: '48px', maxWidth: '1800px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <GitCompare size={32} style={{ color: 'var(--accent)' }} />
          <h1 style={{ 
            fontSize: '32px', 
            fontWeight: '700', 
            color: 'var(--text)',
            margin: 0 
          }}>
            Compare Experiment Reports
          </h1>
        </div>
        <p style={{ 
          fontSize: '16px', 
          color: 'var(--text-secondary)', 
          margin: 0 
        }}>
          Select up to 4 cached reports to compare latency, performance, and evaluator scores
        </p>
      </div>

      {/* Cache Selection */}
      <div style={{
        background: 'var(--surface)',
        borderRadius: '16px',
        padding: '24px',
        marginBottom: '32px',
        border: '1px solid var(--border)',
      }}>
        <h2 style={{ 
          fontSize: '20px', 
          fontWeight: '600', 
          color: 'var(--text)',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <Clock size={20} />
          Cached Reports ({cachedReports.length}/4)
        </h2>

        {cachedReports.length === 0 ? (
          <div style={{
            padding: '32px',
            textAlign: 'center',
            color: 'var(--text-secondary)',
          }}>
            <p>No cached reports available. Visit the Evaluations page to view and cache experiment reports.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {cachedReports.map(report => {
              const cacheKey = getCacheKey(report);
              const isSelected = selectedReports.has(cacheKey);
              
              return (
                <div
                  key={cacheKey}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px',
                    background: isSelected 
                      ? 'linear-gradient(135deg, rgba(158, 127, 255, 0.1) 0%, rgba(56, 189, 248, 0.1) 100%)'
                      : 'var(--background)',
                    border: isSelected 
                      ? '2px solid rgba(158, 127, 255, 0.5)' 
                      : '1px solid var(--border)',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  onClick={() => toggleReportSelection(cacheKey)}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = 'var(--surface)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = 'var(--background)';
                    }
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ 
                      fontSize: '14px', 
                      fontWeight: '600', 
                      color: 'var(--text)',
                      marginBottom: '4px',
                      wordBreak: 'break-word',
                      lineHeight: '1.4',
                    }}>
                      {getReportLabel(report)}
                    </div>
                    <div style={{ 
                      fontSize: '12px', 
                      color: 'var(--text-secondary)',
                    }}>
                      Cached: {formatTimestamp(report.timestamp)}
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {isSelected && (
                      <span style={{
                        padding: '4px 12px',
                        background: 'rgba(34, 197, 94, 0.2)',
                        color: 'rgb(34, 197, 94)',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '600',
                      }}>
                        Selected
                      </span>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteReport(cacheKey);
                      }}
                      style={{
                        padding: '8px',
                        background: 'transparent',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        color: 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        transition: 'all 0.2s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                        e.currentTarget.style.color = 'rgb(239, 68, 68)';
                        e.currentTarget.style.borderColor = 'rgb(239, 68, 68)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = 'var(--text-secondary)';
                        e.currentTarget.style.borderColor = 'var(--border)';
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {selectedReports.size > 0 && (
          <div style={{
            marginTop: '16px',
            padding: '12px',
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '8px',
            fontSize: '14px',
            color: 'var(--text)',
          }}>
            {selectedReports.size} of {MAX_COMPARE_ITEMS} report{MAX_COMPARE_ITEMS > 1 ? 's' : ''} selected for comparison
          </div>
        )}
      </div>

      {/* Comparison Results */}
      {selectedReports.size > 0 && (
        <>
          {/* Latency Comparison */}
          <div style={{
            background: 'var(--surface)',
            borderRadius: '16px',
            padding: '24px',
            marginBottom: '32px',
            border: '1px solid var(--border)',
          }}>
            <h2 style={{ 
              fontSize: '20px', 
              fontWeight: '600', 
              color: 'var(--text)',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <Activity size={20} />
              Latency Comparison
            </h2>

            {/* TTFT Comparison */}
            <h3 style={{ 
              fontSize: '16px', 
              fontWeight: '600', 
              color: 'var(--text)',
              marginTop: '20px',
              marginBottom: '12px',
            }}>
              Time to First Token (TTFT)
            </h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
              }}>
                <thead>
                  <tr style={{ background: 'var(--background)' }}>
                    <th style={{
                      padding: '12px',
                      textAlign: 'left',
                      fontWeight: '600',
                      fontSize: '14px',
                      color: 'var(--text-secondary)',
                      borderBottom: '2px solid var(--border)',
                      minWidth: '100px',
                    }}>
                      Difficulty
                    </th>
                    {reportsToCompare.map((report, idx) => (
                      <React.Fragment key={idx}>
                        <th style={{
                          padding: '12px',
                          textAlign: 'center',
                          fontWeight: '600',
                          fontSize: '12px',
                          color: 'var(--text-secondary)',
                          borderBottom: '2px solid var(--border)',
                          maxWidth: '150px',
                        }}>
                          <div style={{ 
                            overflow: 'hidden', 
                            textOverflow: 'ellipsis', 
                            whiteSpace: 'nowrap',
                            marginBottom: '4px',
                          }} title={report.experiment_tracker}>
                            {getReportName(report)}
                          </div>
                          <div style={{ fontSize: '11px', fontWeight: '400' }}>P50 (s)</div>
                        </th>
                        <th style={{
                          padding: '12px',
                          textAlign: 'center',
                          fontWeight: '600',
                          fontSize: '12px',
                          color: 'var(--text-secondary)',
                          borderBottom: '2px solid var(--border)',
                          maxWidth: '150px',
                        }}>
                          <div style={{ 
                            overflow: 'hidden', 
                            textOverflow: 'ellipsis', 
                            whiteSpace: 'nowrap',
                            marginBottom: '4px',
                          }} title={report.experiment_tracker}>
                            {getReportName(report)}
                          </div>
                          <div style={{ fontSize: '11px', fontWeight: '400' }}>P90 (s)</div>
                        </th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {latencyComparisonData.map((row, rowIdx) => (
                    <tr key={rowIdx} style={{
                      background: rowIdx % 2 === 0 ? 'var(--background)' : 'transparent',
                    }}>
                      <td style={{
                        padding: '12px',
                        fontWeight: '600',
                        fontSize: '14px',
                        color: 'var(--text)',
                        borderBottom: '1px solid var(--border)',
                      }}>
                        {row.difficulty}
                      </td>
                      {reportsToCompare.map((_, idx) => (
                        <React.Fragment key={idx}>
                          <td style={{
                            padding: '12px',
                            textAlign: 'center',
                            fontSize: '14px',
                            color: 'var(--text)',
                            borderBottom: '1px solid var(--border)',
                          }}>
                            {row[`report${idx}_ttft_p50`] != null && !isNaN(row[`report${idx}_ttft_p50`])
                              ? (Number(row[`report${idx}_ttft_p50`]) / 1000).toFixed(2)
                              : 'N/A'}
                          </td>
                          <td style={{
                            padding: '12px',
                            textAlign: 'center',
                            fontSize: '14px',
                            color: 'var(--text)',
                            borderBottom: '1px solid var(--border)',
                          }}>
                            {row[`report${idx}_ttft_p90`] != null && !isNaN(row[`report${idx}_ttft_p90`])
                              ? (Number(row[`report${idx}_ttft_p90`]) / 1000).toFixed(2)
                              : 'N/A'}
                          </td>
                        </React.Fragment>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Total Generation Time Comparison */}
            <h3 style={{ 
              fontSize: '16px', 
              fontWeight: '600', 
              color: 'var(--text)',
              marginTop: '24px',
              marginBottom: '12px',
            }}>
              Total Generation Time
            </h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
              }}>
                <thead>
                  <tr style={{ background: 'var(--background)' }}>
                    <th style={{
                      padding: '12px',
                      textAlign: 'left',
                      fontWeight: '600',
                      fontSize: '14px',
                      color: 'var(--text-secondary)',
                      borderBottom: '2px solid var(--border)',
                      minWidth: '100px',
                    }}>
                      Difficulty
                    </th>
                    {reportsToCompare.map((report, idx) => (
                      <React.Fragment key={idx}>
                        <th style={{
                          padding: '12px',
                          textAlign: 'center',
                          fontWeight: '600',
                          fontSize: '12px',
                          color: 'var(--text-secondary)',
                          borderBottom: '2px solid var(--border)',
                          maxWidth: '150px',
                        }}>
                          <div style={{ 
                            overflow: 'hidden', 
                            textOverflow: 'ellipsis', 
                            whiteSpace: 'nowrap',
                            marginBottom: '4px',
                          }} title={report.experiment_tracker}>
                            {getReportName(report)}
                          </div>
                          <div style={{ fontSize: '11px', fontWeight: '400' }}>P50 (s)</div>
                        </th>
                        <th style={{
                          padding: '12px',
                          textAlign: 'center',
                          fontWeight: '600',
                          fontSize: '12px',
                          color: 'var(--text-secondary)',
                          borderBottom: '2px solid var(--border)',
                          maxWidth: '150px',
                        }}>
                          <div style={{ 
                            overflow: 'hidden', 
                            textOverflow: 'ellipsis', 
                            whiteSpace: 'nowrap',
                            marginBottom: '4px',
                          }} title={report.experiment_tracker}>
                            {getReportName(report)}
                          </div>
                          <div style={{ fontSize: '11px', fontWeight: '400' }}>P90 (s)</div>
                        </th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {latencyComparisonData.map((row, rowIdx) => (
                    <tr key={rowIdx} style={{
                      background: rowIdx % 2 === 0 ? 'var(--background)' : 'transparent',
                    }}>
                      <td style={{
                        padding: '12px',
                        fontWeight: '600',
                        fontSize: '14px',
                        color: 'var(--text)',
                        borderBottom: '1px solid var(--border)',
                      }}>
                        {row.difficulty}
                      </td>
                      {reportsToCompare.map((_, idx) => (
                        <React.Fragment key={idx}>
                          <td style={{
                            padding: '12px',
                            textAlign: 'center',
                            fontSize: '14px',
                            color: 'var(--text)',
                            borderBottom: '1px solid var(--border)',
                          }}>
                            {row[`report${idx}_gen_p50`] != null && !isNaN(row[`report${idx}_gen_p50`])
                              ? (Number(row[`report${idx}_gen_p50`]) / 1000).toFixed(2)
                              : 'N/A'}
                          </td>
                          <td style={{
                            padding: '12px',
                            textAlign: 'center',
                            fontSize: '14px',
                            color: 'var(--text)',
                            borderBottom: '1px solid var(--border)',
                          }}>
                            {row[`report${idx}_gen_p90`] != null && !isNaN(row[`report${idx}_gen_p90`])
                              ? (Number(row[`report${idx}_gen_p90`]) / 1000).toFixed(2)
                              : 'N/A'}
                          </td>
                        </React.Fragment>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Performance Comparison - Horizontal Bar Chart */}
          <div style={{
            background: 'var(--surface)',
            borderRadius: '16px',
            padding: '24px',
            marginBottom: '32px',
            border: '1px solid var(--border)',
          }}>
            <h2 style={{ 
              fontSize: '20px', 
              fontWeight: '600', 
              color: 'var(--text)',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <TrendingUp size={20} />
              Performance Across Difficulties
            </h2>

            {performanceComparisonData.map((difficultyData, diffIdx) => {
              // Get difficulty color
              // Sort reports by success rate for this difficulty (highest to lowest)
              const sortedReports = reportsToCompare
                .map((report, idx) => ({
                  report,
                  originalIdx: idx,
                  successRate: difficultyData[`report${idx}_success_rate`],
                  totalQuestions: difficultyData[`report${idx}_total_questions`],
                  aboveThreshold: difficultyData[`report${idx}_above_threshold`],
                }))
                .sort((a, b) => {
                  const rateA = a.successRate != null && !isNaN(a.successRate) ? Number(a.successRate) : -1;
                  const rateB = b.successRate != null && !isNaN(b.successRate) ? Number(b.successRate) : -1;
                  return rateB - rateA; // Descending order
                });

              return (
                <div key={diffIdx} style={{ 
                  width: '100%',
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: '12px',
                  padding: '20px',
                  border: '1px solid var(--border)',
                  marginBottom: diffIdx < performanceComparisonData.length - 1 ? '20px' : '0',
                }}>
                  <h3 style={{
                    fontSize: '15px',
                    fontWeight: '600',
                    color: 'var(--text)',
                    margin: '0 0 16px 0',
                    letterSpacing: '0.3px',
                  }}>
                    {difficultyData.difficulty}
                  </h3>

                  {/* Grid layout: experiment info left, bars right */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1.5fr 1fr',
                    gap: '24px',
                    alignItems: 'flex-start',
                  }}>
                    {/* Left: Experiment info table */}
                    <div style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      overflow: 'hidden',
                    }}>
                      {/* Table Header */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '40px 2fr 120px',
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
                        <div>Experiment</div>
                        <div style={{ textAlign: 'center' }}>Questions</div>
                      </div>
                      
                      {/* Table Rows - Sorted by performance */}
                      {sortedReports.map(({ report, originalIdx, totalQuestions, aboveThreshold }, sortedIdx) => {
                        return (
                          <div
                            key={originalIdx}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '40px 2fr 120px',
                              padding: '10px 12px',
                              borderBottom: sortedIdx < sortedReports.length - 1 ? '1px solid var(--border)' : 'none',
                              background: 'transparent',
                              transition: 'background 0.2s ease',
                              alignItems: 'center',
                            }}
                          >
                            {/* Rank badge - based on sorted position */}
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}>
                              <div style={{
                                width: '24px',
                                height: '24px',
                                borderRadius: '50%',
                                background: sortedIdx === 0 
                                  ? 'linear-gradient(135deg, #10b981, #059669)'
                                  : sortedIdx === 1 
                                    ? 'linear-gradient(135deg, #3b82f6, #2563eb)'
                                    : sortedIdx === 2
                                      ? 'linear-gradient(135deg, #14b8a6, #0d9488)'
                                      : 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                fontSize: '11px',
                                fontWeight: '700',
                              }}>
                                {sortedIdx + 1}
                              </div>
                            </div>
                            
                            {/* Experiment name */}
                            <div style={{
                              fontSize: '13px',
                              fontWeight: '500',
                              color: 'var(--text)',
                              wordBreak: 'break-word',
                              lineHeight: '1.4',
                            }}>
                              {getReportName(report)}
                            </div>
                            
                            {/* Questions */}
                            <div style={{
                              fontSize: '12px',
                              fontWeight: '600',
                              color: 'var(--text-secondary)',
                              textAlign: 'center',
                              fontFamily: 'monospace',
                            }}>
                              {totalQuestions !== null ? `${aboveThreshold}/${totalQuestions}` : 'N/A'}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Right: Horizontal bars - Sorted by performance */}
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                    }}>
                      {sortedReports.map(({ successRate }, sortedIdx) => {
                        const successRateNum = successRate != null && !isNaN(successRate) ? Number(successRate) : 0;
                        const barWidthPercent = Math.min(successRateNum, 100);
                        
                        const barColor = sortedIdx === 0 
                          ? 'linear-gradient(90deg, #10b981 0%, #059669 100%)'
                          : sortedIdx === 1 
                            ? 'linear-gradient(90deg, #3b82f6 0%, #2563eb 100%)'
                            : sortedIdx === 2
                              ? 'linear-gradient(90deg, #14b8a6 0%, #0d9488 100%)'
                              : 'linear-gradient(90deg, #8b5cf6 0%, #7c3aed 100%)';
                        
                        return (
                          <div key={sortedIdx} style={{ position: 'relative' }}>
                            {/* Bar background with grid lines */}
                            <div style={{
                              position: 'relative',
                              height: '32px',
                              background: 'rgba(255, 255, 255, 0.05)',
                              borderRadius: '6px',
                              overflow: 'visible',
                            }}>
                              {/* Vertical grid lines */}
                              {[25, 50, 75].map((val: number) => (
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
                              <div style={{
                                position: 'absolute',
                                left: 0,
                                top: 0,
                                bottom: 0,
                                width: `${barWidthPercent}%`,
                                background: barColor,
                                borderRadius: '6px',
                                transition: 'all 0.3s ease',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}>
                                {/* Percentage inside bar */}
                                <div style={{
                                  fontSize: '13px',
                                  color: 'white',
                                  fontWeight: '700',
                                  fontFamily: 'monospace',
                                  textShadow: '0 1px 3px rgba(0, 0, 0, 0.5)',
                                }}>
                                  {successRate != null && !isNaN(successRate) ? `${successRateNum.toFixed(1)}%` : 'N/A'}
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
            })}
          </div>

          {/* Evaluator Scores Distribution */}
          <div style={{
            background: 'var(--surface)',
            borderRadius: '16px',
            padding: '24px',
            marginBottom: '32px',
            border: '1px solid var(--border)',
          }}>
            <h2 style={{ 
              fontSize: '20px', 
              fontWeight: '600', 
              color: 'var(--text)',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <BarChart3 size={20} />
              Evaluator Scores Distribution
            </h2>

            {scoresDistributionData.map((diffData, diffIdx) => (
              <div key={diffIdx} style={{ marginBottom: diffIdx < scoresDistributionData.length - 1 ? '32px' : '0' }}>
                <h3 style={{ 
                  fontSize: '16px', 
                  fontWeight: '600', 
                  color: 'var(--text)',
                  marginBottom: '16px',
                }}>
                  {diffData.difficulty}
                </h3>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${reportsToCompare.length}, 1fr)`,
                  gap: '16px',
                }}>
                  {reportsToCompare.map((report, idx) => {
                    const distribution = diffData[`report${idx}_dist`] || [];
                    const maxCount = Math.max(...distribution, 1);
                    const avgScore = diffData[`report${idx}_avg`];

                    return (
                      <div key={idx} style={{
                        background: 'var(--background)',
                        borderRadius: '12px',
                        padding: '16px',
                        border: '1px solid var(--border)',
                      }}>
                        <div style={{
                          fontSize: '13px',
                          fontWeight: '600',
                          color: 'var(--text)',
                          marginBottom: '8px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }} title={report.experiment_tracker}>
                          {getReportName(report)}
                        </div>
                        <div style={{
                          fontSize: '12px',
                          color: 'var(--text-secondary)',
                          marginBottom: '16px',
                        }}>
                          Avg Score: <span style={{ fontWeight: '600', color: 'var(--text)' }}>{avgScore}</span>
                        </div>

                        {/* Simple bar chart */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'flex-end',
                          height: '120px',
                          gap: '4px',
                        }}>
                          {distribution.map((count: number, binIdx: number) => {
                            const height = maxCount > 0 ? (count / maxCount) * 100 : 0;
                            return (
                              <div key={binIdx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <div style={{
                                  width: '100%',
                                  height: `${height}%`,
                                  background: `linear-gradient(180deg, rgba(158, 127, 255, 0.8) 0%, rgba(56, 189, 248, 0.6) 100%)`,
                                  borderRadius: '4px 4px 0 0',
                                  minHeight: count > 0 ? '2px' : '0',
                                  position: 'relative',
                                  transition: 'all 0.3s ease',
                                }} title={`Score ${binIdx}: ${count} questions`}>
                                  {count > 0 && (
                                    <div style={{
                                      position: 'absolute',
                                      top: '-20px',
                                      left: '50%',
                                      transform: 'translateX(-50%)',
                                      fontSize: '10px',
                                      fontWeight: '600',
                                      color: 'var(--text-secondary)',
                                      whiteSpace: 'nowrap',
                                    }}>
                                      {count}
                                    </div>
                                  )}
                                </div>
                                <div style={{
                                  fontSize: '10px',
                                  color: 'var(--text-secondary)',
                                  marginTop: '4px',
                                }}>
                                  {binIdx}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {selectedReports.size === 0 && cachedReports.length > 0 && (
        <div style={{
          padding: '64px 32px',
          textAlign: 'center',
          color: 'var(--text-secondary)',
        }}>
          <GitCompare size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
          <p style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>
            Select reports to compare
          </p>
          <p style={{ fontSize: '14px' }}>
            Choose up to {MAX_COMPARE_ITEMS} cached report{MAX_COMPARE_ITEMS > 1 ? 's' : ''} from above to view detailed comparisons
          </p>
        </div>
      )}
    </div>
  );
};

export default CompareReports;

