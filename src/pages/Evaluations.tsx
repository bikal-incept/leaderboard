// src/pages/Evaluations.tsx
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Clock,
  Gauge,
  FileText,
  ListChecks,
  Sigma,
  Filter,
  X,
  Trash2,
  Globe,
} from 'lucide-react';
import { mockEvaluations } from '../data/mockEvaluations';

// Lightweight per-question score row for experiment score distributions
type ExperimentScoreRow = {
  question_id: number;
  recipe_id: number;
  evaluator_score: number;
  difficulty: string;
};

// Type for cached experiment report with data
type CachedExperimentReport = {
  experiment_tracker: string;
  subject: string;
  grade_level: string;
  question_type: string;
  timestamp: number;
  // Cached data
  reportData: ExperimentReportRow[];
  summaryData: ExperimentSummary | null;
  scoresData: ExperimentScoreRow[];
};

// Cache management functions
const CACHE_KEY = 'experiment_reports_cache';
const MAX_CACHE_ITEMS = 4;

const getCacheKey = (filters: { experiment_tracker: string; subject: string; grade_level: string; question_type: string }) => {
  return `${filters.experiment_tracker}|${filters.subject}|${filters.grade_level}|${filters.question_type}`;
};

const loadCache = (): CachedExperimentReport[] => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return [];
    
    const parsed = JSON.parse(cached);
    
    // Validate, filter out invalid entries, and strip any heavy fields
    const cleaned: CachedExperimentReport[] = parsed
      .filter((item: any) => {
        // Must have an experiment id and reportData array (can be empty)
        return item.experiment_tracker && item.reportData !== undefined;
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

    // Sort by most recent first and keep only the most recent N items
    cleaned.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
    return cleaned.slice(0, MAX_CACHE_ITEMS);
  } catch (err) {
    console.error('Failed to load cache', err);
    return [];
  }
};

const saveToCache = (
  filters: { experiment_tracker: string; subject: string; grade_level: string; question_type: string },
  reportData: ExperimentReportRow[],
  summaryData: ExperimentSummary | null,
  scoresData: ExperimentScoreRow[]
) => {
  // Validate that we have essential data before caching
  if (!reportData || reportData.length === 0) {
    console.warn('[Cache] Skipping cache - no report data available');
    return;
  }

  try {
    const cache = loadCache();
    const cacheKey = getCacheKey(filters);
    
    // Remove existing entry with same key
    const filteredCache = cache.filter(item => getCacheKey(item) !== cacheKey);
    
    // Add new entry at the beginning with all data
    const newEntry = { 
      ...filters, 
      timestamp: Date.now(),
      reportData,
      summaryData,
      scoresData,
    };
    
    const newCache = [newEntry, ...filteredCache].slice(0, MAX_CACHE_ITEMS);
    
    // Try to save to localStorage
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(newCache));
      console.log('[Evaluations Cache] Successfully saved report to cache');
      console.log('[Evaluations Cache] Cache now contains', newCache.length, 'items');
      console.log('[Evaluations Cache] New entry:', {
        experiment_tracker: newEntry.experiment_tracker,
        subject: newEntry.subject,
        grade_level: newEntry.grade_level,
        question_type: newEntry.question_type,
        reportDataLength: newEntry.reportData?.length,
        scoresDataLength: newEntry.scoresData?.length,
      });
    } catch (quotaError: any) {
      if (quotaError.name === 'QuotaExceededError') {
        console.warn('[Cache] Quota exceeded, attempting LRU eviction...');
        
        // LRU eviction: Remove oldest item and try again
        if (filteredCache.length > 0) {
          // Remove the oldest (last) item
          const reducedCache = [newEntry, ...filteredCache.slice(0, -1)];
          
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(reducedCache));
            console.log('[Cache] Successfully saved after removing oldest item');
          } catch (secondError: any) {
            // If still failing, try with even fewer items
            if (reducedCache.length > 1) {
              const minimalCache = [newEntry];
              try {
                localStorage.setItem(CACHE_KEY, JSON.stringify(minimalCache));
                console.log('[Cache] Saved with minimal cache (1 item)');
              } catch (finalError) {
                console.error('[Cache] Failed to save even with minimal cache. Data may be too large.', finalError);
              }
            } else {
              console.error('[Cache] Single item too large for localStorage', secondError);
            }
          }
        } else {
          console.error('[Cache] Cannot save - single report exceeds localStorage quota');
        }
      } else {
        throw quotaError;
      }
    }
  } catch (err) {
    console.error('[Cache] Failed to save to cache', err);
  }
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

type Recommendation = 'accept' | 'reject' | string;

// Types for experiment data
// Note: PostgreSQL bigint types are serialized as strings in JSON
interface ExperimentReportRow {
  experiment_tracker: string;
  model: string;
  subject: string;
  grade_level: string;
  question_type: string;
  difficulty: string;
  total_questions: number | string; // bigint from COUNT() may be string
  questions_above_threshold: number | string; // bigint from COUNT() may be string
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
  total_questions: number | string; // bigint from COUNT() may be string
  questions_above_threshold: number | string; // bigint from COUNT() may be string
  total_recipes: number | string; // bigint from COUNT() may be string
  success_percentage: number;
  prompt_id: string;
  temperature: number;
  provider: string;
  method: string;
  avg_ttft_ms: number;
  avg_total_generation_ms: number;
  avg_evaluator_score: number;
}

const Evaluations: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Experiment selection state - read from URL params
  const [selectedExperiment, setSelectedExperiment] = useState<string>(() => {
    return searchParams.get('model') || '';
  });
  
  // Filter state - read from URL params
  const [appliedFilters, setAppliedFilters] = useState({
    subject: searchParams.get('subject') || '',
    gradeLevel: searchParams.get('grade_level') || '',
    questionType: searchParams.get('question_type') || '',
  });
  
  // API data states
  const [experimentReport, setExperimentReport] = useState<ExperimentReportRow[]>([]);
  const [experimentSummary, setExperimentSummary] = useState<ExperimentSummary | null>(null);
  const [experimentScores, setExperimentScores] = useState<ExperimentScoreRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Cache state
  const [cachedReports, setCachedReports] = useState<CachedExperimentReport[]>([]);
  const [showCacheDropdown, setShowCacheDropdown] = useState(false);
  const cacheDropdownRef = useRef<HTMLDivElement>(null);
  const loadingFromCacheRef = useRef(false); // Use ref instead of state for synchronous access

  // Load cache on mount and clean up invalid entries
  useEffect(() => {
    const cachedData = loadCache();
    console.log('[Cache] Loaded cache on mount:', cachedData.length, 'entries');
    
    // If cache is empty or has invalid entries, it was already filtered by loadCache
    setCachedReports(cachedData);
    
    // Save cleaned cache back (removes old format entries)
    if (cachedData.length > 0) {
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(cachedData));
      } catch (err) {
        console.error('[Cache] Failed to save cleaned cache', err);
      }
    }
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (cacheDropdownRef.current && !cacheDropdownRef.current.contains(event.target as Node)) {
        setShowCacheDropdown(false);
      }
    };

    if (showCacheDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showCacheDropdown]);
  
  // Mapping of experiment IDs to friendly names (should come from API in production)
  const experimentNames: Record<string, string> = {
    '10837201-7f10-40b2-bae0-5d3ac0642ff6': 'Incept',
    '20837201-7f10-40b2-bae0-5d3ac0642ff7': 'GPT-OSS 20B Fine-tuned + RAG',
    '30837201-7f10-40b2-bae0-5d3ac0642ff8': 'Kimi K2',
    '40837201-7f10-40b2-bae0-5d3ac0642ff9': 'GPT-OSS 20B Vanilla',
    '50837201-7f10-40b2-bae0-5d3ac0642ffa': 'GPT-OSS 20B Vanilla + RAG',
    '60837201-7f10-40b2-bae0-5d3ac0642ffb': 'GPT-OSS 120B Vanilla',
    '70837201-7f10-40b2-bae0-5d3ac0642ffc': 'GPT-OSS 120B Vanilla + RAG',
  };
  
  // Modal state (for per-sample drill-down, not aggregated feedback)
  const [selectedSample, setSelectedSample] = useState<{
    experimentId: string;
    evalKey: string;
    evalData: any;
  } | null>(null);
  
  // Filter state for samples view
  const [filters, setFilters] = useState({
    difficulty: 'all' as 'all' | 'Easy' | 'Medium' | 'Hard',
    scoreRange: 'all' as 'all' | 'high' | 'medium' | 'low',
    recommendation: 'all' as 'all' | 'accept' | 'reject',
  });
  
  // Fetch experiment data when filters change
  useEffect(() => {
    let isCancelled = false;

    async function loadExperimentData() {
      // Skip if loading from cache (use ref for synchronous check)
      if (loadingFromCacheRef.current) {
        console.log('[Experiment Report] Skipping API call - loading from cache');
        return;
      }

      // Only fetch if an experiment is selected
      if (!selectedExperiment) {
        setExperimentReport([]);
        setExperimentSummary(null);
        setExperimentScores([]);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          experiment_tracker: selectedExperiment,
          ...(appliedFilters.subject && { subject: appliedFilters.subject }),
          ...(appliedFilters.gradeLevel && { grade_level: appliedFilters.gradeLevel }),
          ...(appliedFilters.questionType && { question_type: appliedFilters.questionType }),
        });

        // Fetch report, summary, and scores in parallel
        const [reportResponse, summaryResponse, scoresResponse] = await Promise.all([
          fetch(`/api/experiment-report?${params.toString()}`),
          fetch(`/api/experiment-summary?${params.toString()}`),
          fetch(`/api/experiment-scores?${params.toString()}`),
        ]);

        if (!reportResponse.ok || !summaryResponse.ok || !scoresResponse.ok) {
          throw new Error('Failed to fetch experiment data');
        }

        const contentType = reportResponse.headers.get('content-type') || '';
        
        // Fall back to mock data if not receiving JSON
        if (!contentType.includes('application/json')) {
          console.warn('Expected JSON from API but received', contentType, '- using mock data');
          if (!isCancelled) {
            setExperimentReport([]);
            setExperimentSummary(null);
            setExperimentScores([]);
          }
          return;
        }

        const reportData = await reportResponse.json();
        const summaryData = await summaryResponse.json();
        const scoresData = await scoresResponse.json();

        if (isCancelled) return;

        console.log('[Experiment Report] Loaded data:', { reportData, summaryData, scoresCount: scoresData.length });
        setExperimentReport(reportData || []);
        setExperimentSummary(summaryData || null);
        setExperimentScores(scoresData || []);

        // Save to cache with the actual data
        if (reportData && reportData.length > 0) {
          saveToCache(
            {
              experiment_tracker: selectedExperiment,
              subject: appliedFilters.subject || '',
              grade_level: appliedFilters.gradeLevel || '',
              question_type: appliedFilters.questionType || '',
            },
            reportData || [],
            summaryData || null,
            scoresData || []
          );
          setCachedReports(loadCache());
        }
      } catch (err: any) {
        if (isCancelled) return;
        console.error('Failed to load experiment data', err);
        setError('Failed to load experiment data. Using mock data.');
        setExperimentReport([]);
        setExperimentSummary(null);
        setExperimentScores([]);
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    loadExperimentData();

    return () => {
      isCancelled = true;
    };
  }, [selectedExperiment, appliedFilters]); // loadingFromCacheRef doesn't need to be in deps
  
  // Sync URL params with state (skip if loading from cache)
  useEffect(() => {
    // Skip URL sync when loading from cache (use ref for synchronous check)
    if (loadingFromCacheRef.current) {
      console.log('[URL Sync] Skipping - loading from cache');
      return;
    }

    const model = searchParams.get('model');
    const subject = searchParams.get('subject');
    const gradeLevel = searchParams.get('grade_level');
    const questionType = searchParams.get('question_type');
    
    if (model && model !== selectedExperiment) {
      setSelectedExperiment(model);
    }
    
    setAppliedFilters({
      subject: subject || '',
      gradeLevel: gradeLevel || '',
      questionType: questionType || '',
    });
  }, [searchParams]); // loadingFromCacheRef doesn't need to be in deps

  const getScoreBandColor = (score: number) => {
    if (score >= 0.9) return 'var(--success)';
    if (score >= 0.7) return 'var(--warning)';
    return 'var(--error)';
  };

  const getRecommendationIcon = (rec: Recommendation) => {
    switch (rec) {
      case 'accept':
        return <CheckCircle2 size={18} color="var(--success)" />;
      case 'reject':
        return <XCircle size={18} color="var(--error)" />;
      default:
        return <AlertTriangle size={18} color="var(--warning)" />;
    }
  };

  const getRecommendationLabel = (rec: Recommendation) => {
    switch (rec) {
      case 'accept':
        return 'Accept';
      case 'reject':
        return 'Reject';
      default:
        return 'Needs Review';
    }
  };

  const humanizeKey = (key: string) => key.replace(/_/g, ' · ');

  const loadFromCache = (cached: CachedExperimentReport) => {
    console.log('[Cache] Loading from cache:', cached);
    
    // Validate cached data before using
    if (!cached || !cached.reportData) {
      console.error('[Cache] Invalid cached data, skipping');
      return;
    }
    
    // Set ref flag FIRST (synchronous, immediate)
    loadingFromCacheRef.current = true;
    console.log('[Cache] Set loadingFromCacheRef to true');
    
    // Set the data directly from cache with fallbacks for safety
    setExperimentReport(Array.isArray(cached.reportData) ? cached.reportData : []);
    setExperimentSummary(cached.summaryData || null);
    setExperimentScores(Array.isArray(cached.scoresData) ? cached.scoresData : []);
    
    // Set filters (this will update URL but won't trigger API call due to loadingFromCache flag)
    setSelectedExperiment(cached.experiment_tracker);
    setAppliedFilters({
      subject: cached.subject || '',
      gradeLevel: cached.grade_level || '',
      questionType: cached.question_type || '',
    });
    
    // Update URL params
    const params = new URLSearchParams();
    params.set('model', cached.experiment_tracker);
    if (cached.subject) params.set('subject', cached.subject);
    if (cached.grade_level) params.set('grade_level', cached.grade_level);
    if (cached.question_type) params.set('question_type', cached.question_type);
    setSearchParams(params);
    
    setShowCacheDropdown(false);
    
    // Reset the flag after all updates have settled
    setTimeout(() => {
      console.log('[Cache] Resetting loadingFromCacheRef to false');
      loadingFromCacheRef.current = false;
    }, 500);
  };

  const deleteCachedReport = (cached: CachedExperimentReport, e: React.MouseEvent) => {
    e.stopPropagation();
    const cacheKey = getCacheKey(cached);
    deleteFromCache(cacheKey);
    setCachedReports(loadCache());
  };

  // In future, parse these from real metadata.
  const deriveTagsFromKey = (key: string) => {
    const lower = key.toLowerCase();
    const tags: string[] = [];
    if (lower.includes('math')) tags.push('Math');
    if (lower.includes('mcq')) tags.push('MCQ');
    if (lower.includes('easy')) tags.push('Easy');
    if (lower.match(/_([0-9])_oa/i)) {
      const grade = lower.match(/_([0-9])_oa/i)?.[1];
      if (grade) tags.push(`Grade ${grade}`);
    }
    return tags;
  };

  const allExperiments = useMemo(() => mockEvaluations, []);
  
  // Filter experiments based on selection (for mock data fallback)
  const experiments = useMemo(() => {
    if (selectedExperiment === 'all') {
      return allExperiments;
    }
    return allExperiments.filter(exp => exp.request_id === selectedExperiment);
  }, [allExperiments, selectedExperiment]);
  
  // Calculate overall statistics from real data or fall back to mock
  const stats = useMemo(() => {
    if (experimentReport && experimentReport.length > 0) {
      // Use real data from API - explicitly convert to numbers as PostgreSQL bigint comes as string
      const totalQuestions = experimentReport.reduce((sum, row) => sum + Number(row.total_questions), 0);
      const questionsAbove = experimentReport.reduce((sum, row) => sum + Number(row.questions_above_threshold), 0);
      const avgScore = experimentReport.reduce((sum, row) => sum + (Number(row.avg_evaluator_score) * Number(row.total_questions)), 0) / totalQuestions;
      const passPercent = (questionsAbove / totalQuestions) * 100;
      
      // Estimate below/above thresholds (can be refined with more detailed data)
      const above085 = questionsAbove;
      const below085 = totalQuestions - above085;
      const zeroScores = 0; // Would need individual question data for this
      
      return {
        avgScore,
        totalQuestions,
        passPercent,
        zeroScores,
        below085,
        above085,
      };
    } else {
      // Fall back to mock data
      const scores: number[] = [];
      experiments.forEach(exp => {
        Object.values(exp.evaluations).forEach(evalData => {
          scores.push(evalData.score);
        });
      });
      
      const totalQuestions = scores.length;
      const avgScore = totalQuestions > 0 ? scores.reduce((sum, s) => sum + s, 0) / totalQuestions : 0;
      const zeroScores = scores.filter(s => s === 0).length;
      const below085 = scores.filter(s => s < 0.85).length;
      const above085 = scores.filter(s => s >= 0.85).length;
      const passPercent = totalQuestions > 0 ? (above085 / totalQuestions) * 100 : 0;
      
      return {
        avgScore,
        totalQuestions,
        passPercent,
        zeroScores,
        below085,
        above085,
      };
    }
  }, [experimentReport, experiments]);
  
  // Calculate stats by difficulty from real data or fall back to mock
  const statsByDifficulty = useMemo(() => {
    const byDiff: Record<string, { 
      total: number; 
      passed: number; 
      scores: number[];
      zeroScores: number;
      avgScore: number;
      belowThreshold: number;
    }> = {
      Easy: { total: 0, passed: 0, scores: [], zeroScores: 0, avgScore: 0, belowThreshold: 0 },
      Medium: { total: 0, passed: 0, scores: [], zeroScores: 0, avgScore: 0, belowThreshold: 0 },
      Hard: { total: 0, passed: 0, scores: [], zeroScores: 0, avgScore: 0, belowThreshold: 0 },
    };
    
    if (experimentReport && experimentReport.length > 0) {
      // Use real data from API - explicitly convert to numbers
      experimentReport.forEach(row => {
        const difficulty = row.difficulty || 'Medium';
        const diffKey = difficulty.charAt(0).toUpperCase() + difficulty.slice(1).toLowerCase();
        
        if (byDiff[diffKey]) {
          byDiff[diffKey].total += Number(row.total_questions);
          byDiff[diffKey].passed += Number(row.questions_above_threshold);
          byDiff[diffKey].zeroScores += Number(row.zero_scores);
          byDiff[diffKey].belowThreshold += Number(row.below_threshold);
          byDiff[diffKey].avgScore = Number(row.avg_evaluator_score);
        }
      });
    } else {
      // Fall back to mock data
      experiments.forEach(exp => {
        Object.entries(exp.evaluations).forEach(([evalKey, evalData]) => {
          const tags = deriveTagsFromKey(evalKey);
          let difficulty = 'Medium'; // default
          
          if (tags.some(tag => tag.toLowerCase().includes('easy'))) {
            difficulty = 'Easy';
          } else if (tags.some(tag => tag.toLowerCase().includes('hard'))) {
            difficulty = 'Hard';
          }
          
          byDiff[difficulty].total++;
          byDiff[difficulty].scores.push(evalData.score);
          if (evalData.score >= 0.85) {
            byDiff[difficulty].passed++;
          }
        });
      });
    }
    
    return byDiff;
  }, [experimentReport, experiments]);
  
  // Calculate all scores for distribution plot
  const allScoresData = useMemo(() => {
    if (experimentScores && experimentScores.length > 0) {
      // Use real data from API - return full score objects
      return experimentScores;
    } else if (!experimentReport || experimentReport.length === 0) {
      // Fall back to mock data - convert to compatible format
      const scores: ExperimentScoreRow[] = [];
      experiments.forEach((exp, expIdx) => {
        Object.entries(exp.evaluations).forEach(([evalKey, evalData], idx) => {
          const tags = deriveTagsFromKey(evalKey);
          let difficulty = 'Medium';
          if (tags.some(tag => tag.toLowerCase().includes('easy'))) difficulty = 'Easy';
          else if (tags.some(tag => tag.toLowerCase().includes('hard'))) difficulty = 'Hard';
          
          scores.push({
            question_id: expIdx * 1000 + idx,
            recipe_id: idx,
            evaluator_score: evalData.score,
            difficulty,
          });
        });
      });
      return scores;
    }
    // No data available
    return [];
  }, [experimentScores, experimentReport, experiments]);
  
  // Filter samples
  const filteredSamples = useMemo(() => {
    const samples: Array<{ experimentId: string; evalKey: string; evalData: any }> = [];
    
    experiments.forEach(exp => {
      Object.entries(exp.evaluations).forEach(([evalKey, evalData]) => {
        // Apply filters
        if (filters.difficulty !== 'all') {
          const tags = deriveTagsFromKey(evalKey);
          if (!tags.some(tag => tag.toLowerCase().includes(filters.difficulty.toLowerCase()))) {
            return;
          }
        }
        
        if (filters.scoreRange !== 'all') {
          if (filters.scoreRange === 'high' && evalData.score < 0.9) return;
          if (filters.scoreRange === 'medium' && (evalData.score < 0.7 || evalData.score >= 0.9)) return;
          if (filters.scoreRange === 'low' && evalData.score >= 0.7) return;
        }
        
        if (filters.recommendation !== 'all') {
          if (evalData.ti_question_qa.recommendation !== filters.recommendation) return;
        }
        
        samples.push({ experimentId: exp.request_id, evalKey, evalData });
      });
    });
    
    return samples;
  }, [experiments, filters]);

  return (
    <div
      style={{
        padding: '24px',
        maxWidth: '1600px',
        margin: '0 auto',
        color: 'var(--text)',
      }}
    >
      {/* Page Header */}
      <div style={{ marginBottom: '20px' }}>
        <h1
          style={{
            fontSize: '20px',
            fontWeight: '600',
            color: 'var(--text)',
            marginBottom: '12px',
          }}
        >
          Experiment Report
        </h1>
        
        {/* Applied Filters Display */}
        {selectedExperiment && (
          <div style={{
            padding: '12px 16px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            marginBottom: '12px',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              fontSize: '12px',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                background: 'rgba(158, 127, 255, 0.1)',
                border: '1px solid rgba(158, 127, 255, 0.3)',
                borderRadius: '6px',
                color: 'var(--primary)',
                fontWeight: 500,
              }}>
                <span style={{ fontSize: '10px', opacity: 0.7 }}>EXPERIMENT</span>
                <span>{selectedExperiment}</span>
              </div>
              
              {appliedFilters.subject && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  background: 'rgba(56, 189, 248, 0.1)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  borderRadius: '6px',
                  color: 'var(--info)',
                  fontWeight: 500,
                }}>
                  <span style={{ fontSize: '10px', opacity: 0.7 }}>SUBJECT</span>
                  <span>{appliedFilters.subject}</span>
                </div>
              )}
              
              {appliedFilters.gradeLevel && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  background: 'rgba(34, 197, 94, 0.1)',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                  borderRadius: '6px',
                  color: 'var(--success)',
                  fontWeight: 500,
                }}>
                  <span style={{ fontSize: '10px', opacity: 0.7 }}>GRADE</span>
                  <span>{appliedFilters.gradeLevel}</span>
                </div>
              )}
              
              {appliedFilters.questionType && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  background: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  borderRadius: '6px',
                  color: 'var(--warning)',
                  fontWeight: 500,
                }}>
                  <span style={{ fontSize: '10px', opacity: 0.7 }}>TYPE</span>
                  <span>{appliedFilters.questionType.toUpperCase()}</span>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Cache Dropdown */}
        {cachedReports.length > 0 && (
          <div style={{ marginBottom: '12px', position: 'relative' }} ref={cacheDropdownRef}>
            <button
              onClick={() => setShowCacheDropdown(!showCacheDropdown)}
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '13px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                color: 'var(--text)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--primary)';
                e.currentTarget.style.background = 'rgba(158, 127, 255, 0.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.background = 'var(--surface)';
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                <Clock size={14} />
                Load from {cachedReports.length} cached report{cachedReports.length !== 1 ? 's' : ''}
              </span>
              <ChevronDown size={16} style={{
                transform: showCacheDropdown ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease',
                color: 'var(--primary)',
              }} />
            </button>

            {/* Dropdown Menu */}
            {showCacheDropdown && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: '4px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                zIndex: 1000,
                maxHeight: '400px',
                overflowY: 'auto',
              }}>
                {cachedReports.map((cached, index) => (
                  <div
                    key={index}
                    style={{
                      padding: '12px 16px',
                      borderBottom: index < cachedReports.length - 1 ? '1px solid var(--border)' : 'none',
                      cursor: 'pointer',
                      transition: 'background 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                    }}
                    onClick={() => loadFromCache(cached)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--hover-bg)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: '13px',
                        fontWeight: '600',
                        color: 'var(--text)',
                        marginBottom: '6px',
                      }}>
                        EXPERIMENT: {cached.experiment_tracker}
                      </div>
                      <div style={{
                        fontSize: '11px',
                        color: 'var(--text-secondary)',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, 1fr)',
                        gap: '4px',
                      }}>
                        <div>SUBJECT: {cached.subject ? cached.subject.toUpperCase() : 'All'}</div>
                        <div>GRADE: {cached.grade_level || 'All'}</div>
                        <div>TYPE: {cached.question_type ? cached.question_type.toUpperCase() : 'All'}</div>
                      </div>
                      <div style={{
                        fontSize: '10px',
                        color: 'var(--text-secondary)',
                        marginTop: '4px',
                        opacity: 0.7,
                      }}>
                        {new Date(cached.timestamp).toLocaleString()}
                      </div>
                    </div>
                    <button
                      onClick={(e) => deleteCachedReport(cached, e)}
                      style={{
                        padding: '6px',
                        background: 'transparent',
                        border: '1px solid var(--border)',
                        borderRadius: '4px',
                        color: 'var(--error)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s ease',
                        flexShrink: 0,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                        e.currentTarget.style.borderColor = 'var(--error)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.borderColor = 'var(--border)';
                      }}
                      title="Delete from cache"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        
        {/* Experiment Selector Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label
            htmlFor="experiment-select"
            style={{
              fontSize: '12px',
              color: 'var(--text-secondary)',
              fontWeight: 500,
            }}
          >
            Select Experiment:
          </label>
          <select
            id="experiment-select"
            value={selectedExperiment}
            onChange={(e) => {
              const newExperiment = e.target.value;
              setSelectedExperiment(newExperiment);
              
              // Update URL params
              const params = new URLSearchParams();
              if (newExperiment) {
                params.set('model', newExperiment);
                // Keep existing filters
                if (appliedFilters.subject) params.set('subject', appliedFilters.subject);
                if (appliedFilters.gradeLevel) params.set('grade_level', appliedFilters.gradeLevel);
                if (appliedFilters.questionType) params.set('question_type', appliedFilters.questionType);
              }
              setSearchParams(params);
            }}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)',
              fontSize: '12px',
              cursor: 'pointer',
              minWidth: '300px',
            }}
          >
            <option value="">Select an experiment...</option>
            {allExperiments
              .filter((exp) => {
                const name = experimentNames[exp.request_id] || '';
                // Filter out experiments named "Incept"
                return !name.toLowerCase().includes('incept');
              })
              .map((exp, index) => (
                <option key={exp.request_id} value={exp.request_id}>
                  {experimentNames[exp.request_id] || `Experiment #${index + 1}`} - {exp.request_id.substring(0, 8)}...
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* No Experiment Selected State */}
      {!selectedExperiment && !isLoading && (
        <div style={{
          textAlign: 'center',
          padding: '80px 48px',
          color: 'var(--text-secondary)',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
        }}>
          <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px', color: 'var(--text)' }}>
            No Experiment Selected
          </div>
          <div style={{ fontSize: '14px' }}>
            Please select an experiment from the dropdown above to view the report.
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div style={{
          textAlign: 'center',
          padding: '48px',
          color: 'var(--text-secondary)',
        }}>
          Loading experiment data...
        </div>
      )}

      {/* Error State */}
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

      {/* Overall Statistics - Single Card */}
      {!isLoading && selectedExperiment && experimentReport && experimentReport.length > 0 && (
        <div
          style={{
            marginBottom: '24px',
            borderRadius: '12px',
            border: '1px solid var(--border)',
            background: 'linear-gradient(135deg, rgba(158,127,255,0.08), rgba(56,189,248,0.05))',
            padding: '16px 20px',
          }}
        >
        <div
          style={{
            display: 'flex',
            gap: '24px',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '24px', fontWeight: 700, color: 'var(--primary)' }}>
              {(stats.avgScore * 100).toFixed(1)}%
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Avg Score</span>
          </div>
          
          <div style={{ width: '1px', height: '30px', background: 'var(--border)' }} />
          
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text)' }}>
              {stats.totalQuestions}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Total Questions</span>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--primary)' }}>
              {stats.passPercent.toFixed(1)}%
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Pass %</span>
          </div>
        </div>
        </div>
      )}

      {/* Latency Report + Performance by Difficulty (same row) */}
      {!isLoading && selectedExperiment && experimentReport && experimentReport.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.4fr)',
            gap: '24px',
            marginBottom: '24px',
          }}
        >
        {/* Latency Report - Vertical Stack (LEFT) */}
        <section
          style={{
            borderRadius: '12px',
            border: '1px solid var(--border)',
            background: 'var(--card-bg)',
            padding: '16px',
          }}
        >
          <h2
            style={{
              fontSize: '16px',
              fontWeight: 600,
              marginBottom: '12px',
            }}
          >
            Latency Report
          </h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {['Easy', 'Medium', 'Hard'].map((difficulty) => (
              <CompactLatencyTable 
                key={difficulty} 
                difficulty={difficulty}
                data={experimentReport.find(row => row.difficulty?.toLowerCase() === difficulty.toLowerCase())}
              />
            ))}
          </div>
        </section>

        {/* Performance by Difficulty (RIGHT) */}
        <div
          style={{
            borderRadius: '12px',
            border: '1px solid var(--border)',
            background: 'var(--card-bg)',
            padding: '20px',
          }}
        >
          <div
            style={{
              fontFamily: 'monospace',
              fontSize: '12px',
            }}
          >
            {/* Header Row */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1.2fr 1fr 1fr 1fr',
                gap: '12px',
                padding: '8px 12px',
                borderBottom: '2px solid var(--border)',
                fontWeight: 600,
                color: 'var(--text-secondary)',
              }}
            >
              <div>Difficulty</div>
              <div style={{ textAlign: 'right' }}>Total (a)</div>
              <div style={{ textAlign: 'right' }}>≥85% (b)</div>
              <div style={{ textAlign: 'right' }}>% Passed</div>
            </div>

            {/* Easy Row */}
            <div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1.2fr 1fr 1fr 1fr',
                gap: '12px',
                padding: '10px 12px',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                color: 'var(--text)',
              }}
            >
                <div style={{ color: 'var(--success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  Easy ({statsByDifficulty.Easy.total} Evaluations)
                </div>
                <div style={{ textAlign: 'right' }}>{statsByDifficulty.Easy.total}</div>
                <div style={{ textAlign: 'right' }}>{statsByDifficulty.Easy.passed}</div>
                <div style={{ textAlign: 'right', fontWeight: 600 }}>
                  {statsByDifficulty.Easy.total > 0 
                    ? ((statsByDifficulty.Easy.passed / statsByDifficulty.Easy.total) * 100).toFixed(1)
                    : '0.0'}%
                </div>
              </div>
              {/* Easy sub-row */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.2fr 1fr 1fr 1fr',
                  gap: '12px',
                  padding: '6px 12px 10px 24px',
                  fontSize: '11px',
                  color: 'var(--text-secondary)',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <div>└ Details</div>
                <div style={{ textAlign: 'right' }}>0s: {statsByDifficulty.Easy.zeroScores}</div>
                <div style={{ textAlign: 'right' }}>&lt;0.85: {statsByDifficulty.Easy.belowThreshold}</div>
                <div style={{ textAlign: 'right' }}>Avg: {(statsByDifficulty.Easy.avgScore * 100).toFixed(1)}%</div>
              </div>
            </div>

            {/* Medium Row */}
            <div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.2fr 1fr 1fr 1fr',
                  gap: '12px',
                  padding: '10px 12px',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  color: 'var(--text)',
                }}
              >
                <div style={{ color: 'var(--warning)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  Medium ({statsByDifficulty.Medium.total} Evaluations)
                </div>
                <div style={{ textAlign: 'right' }}>{statsByDifficulty.Medium.total}</div>
                <div style={{ textAlign: 'right' }}>{statsByDifficulty.Medium.passed}</div>
                <div style={{ textAlign: 'right', fontWeight: 600 }}>
                  {statsByDifficulty.Medium.total > 0 
                    ? ((statsByDifficulty.Medium.passed / statsByDifficulty.Medium.total) * 100).toFixed(1)
                    : '0.0'}%
                </div>
              </div>
              {/* Medium sub-row */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.2fr 1fr 1fr 1fr',
                  gap: '12px',
                  padding: '6px 12px 10px 24px',
                  fontSize: '11px',
                  color: 'var(--text-secondary)',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <div>└ Details</div>
                <div style={{ textAlign: 'right' }}>0s: {statsByDifficulty.Medium.zeroScores}</div>
                <div style={{ textAlign: 'right' }}>&lt;0.85: {statsByDifficulty.Medium.belowThreshold}</div>
                <div style={{ textAlign: 'right' }}>Avg: {(statsByDifficulty.Medium.avgScore * 100).toFixed(1)}%</div>
              </div>
            </div>

            {/* Hard Row */}
            <div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.2fr 1fr 1fr 1fr',
                  gap: '12px',
                  padding: '10px 12px',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  color: 'var(--text)',
                }}
              >
                <div style={{ color: 'var(--error)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  Hard ({statsByDifficulty.Hard.total} Evaluations)
                </div>
                <div style={{ textAlign: 'right' }}>{statsByDifficulty.Hard.total}</div>
                <div style={{ textAlign: 'right' }}>{statsByDifficulty.Hard.passed}</div>
                <div style={{ textAlign: 'right', fontWeight: 600 }}>
                  {statsByDifficulty.Hard.total > 0 
                    ? ((statsByDifficulty.Hard.passed / statsByDifficulty.Hard.total) * 100).toFixed(1)
                    : '0.0'}%
                </div>
              </div>
              {/* Hard sub-row */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.2fr 1fr 1fr 1fr',
                  gap: '12px',
                  padding: '6px 12px 10px 24px',
                  fontSize: '11px',
                  color: 'var(--text-secondary)',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <div>└ Details</div>
                <div style={{ textAlign: 'right' }}>0s: {statsByDifficulty.Hard.zeroScores}</div>
                <div style={{ textAlign: 'right' }}>&lt;0.85: {statsByDifficulty.Hard.belowThreshold}</div>
                <div style={{ textAlign: 'right' }}>Avg: {(statsByDifficulty.Hard.avgScore * 100).toFixed(1)}%</div>
              </div>
            </div>

            {/* Total Row */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1.2fr 1fr 1fr 1fr',
                gap: '12px',
                padding: '10px 12px',
                fontWeight: 700,
                color: 'var(--text)',
                background: 'rgba(158,127,255,0.05)',
                borderRadius: '0 0 8px 8px',
              }}
            >
              <div>TOTAL</div>
              <div style={{ textAlign: 'right' }}>{stats.totalQuestions}</div>
              <div style={{ textAlign: 'right' }}>{stats.above085}</div>
              <div style={{ textAlign: 'right', color: 'var(--primary)' }}>
                {stats.passPercent.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
        </div>
      )}

      {/* Score Distribution Plot */}
      {!isLoading && selectedExperiment && experimentReport && experimentReport.length > 0 && (
        <section
        style={{
          marginBottom: '24px',
          borderRadius: '12px',
          border: '1px solid var(--border)',
          background: 'var(--card-bg)',
          padding: '20px',
        }}
      >
        <h2
          style={{
            fontSize: '16px',
            fontWeight: 600,
            marginBottom: '16px',
          }}
        >
          Score Distribution
        </h2>
        <ScoreDistributionPlot scoresData={allScoresData} />
        </section>
      )}

      {/* Modal for detailed view removed - Sample Quality Scores section removed */}
      {false && selectedSample && (
        <div
          onClick={() => setSelectedSample(null)}
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
              background: 'var(--card-bg)',
              borderRadius: '16px',
              border: '1px solid var(--border)',
              maxWidth: '1200px',
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto',
              position: 'relative',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                position: 'sticky',
                top: 0,
                background: 'var(--card-bg)',
                borderBottom: '1px solid var(--border)',
                padding: '16px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                zIndex: 10,
              }}
            >
              <h3 style={{ fontSize: '16px', fontWeight: 600 }}>
                {humanizeKey(selectedSample.evalKey)}
              </h3>
              <button
                onClick={() => setSelectedSample(null)}
                style={{
                  all: 'unset',
                  cursor: 'pointer',
                  padding: '8px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-secondary)',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
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

            {/* Modal Content - Reuse existing expanded content */}
            <div style={{ padding: '20px' }}>
              {(() => {
                const ev = selectedSample.evalData;
                const qa = ev.ti_question_qa;
                const math = ev.math_content_evaluator;
                const answerVerif = ev.answer_verification;
                const readingQC = ev.reading_question_qc;
                const scoreColor = getScoreBandColor(ev.score);

                return (
                  <div>
                    {/* 1. Overview Strip */}
                    <div
                            style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: '16px',
                              marginBottom: '16px',
                              padding: '12px',
                              borderRadius: '12px',
                              background: 'var(--card-bg-light)',
                              border: '1px solid var(--border)',
                            }}
                          >
                            {/* Score dial */}
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                              }}
                            >
                              <div
                                style={{
                                  width: 56,
                                  height: 56,
                                  borderRadius: '50%',
                                  border: `3px solid ${scoreColor}`,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  boxShadow: `0 0 0 4px ${scoreColor}22`,
                                  fontSize: '14px',
                                  fontWeight: 700,
                                }}
                              >
                                {(ev.score * 100).toFixed(0)}%
                              </div>
                              <div>
                                <div
                                  style={{
                                    fontSize: '13px',
                                    fontWeight: 500,
                                  }}
                                >
                                  Overall Evaluation Score
                                </div>
                                <div
                                  style={{
                                    fontSize: '12px',
                                    color: 'var(--text-secondary)',
                                  }}
                                >
                                  Aggregated across QA, reading checks, distractors
                                  and math content.
                                </div>
                              </div>
                            </div>

                            {/* Meta stats */}
                            <div
                              style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: '16px',
                                flex: 1,
                                minWidth: '240px',
                                justifyContent: 'flex-end',
                              }}
                            >
                              <OverviewStat
                                label="QA Overall"
                                value={qa?.overall ? qa.overall.toFixed(2) : null}
                              />
                              <OverviewStat
                                label="Math Content"
                                value={math?.overall_score != null ? `${(math.overall_score * 100).toFixed(0)}%` : null}
                              />
                              <OverviewStat
                                label="Answer Confidence"
                                value={answerVerif?.confidence != null ? `${answerVerif.confidence}/10` : null}
                              />
                              <OverviewStat
                                label="Math Rating"
                                value={math?.overall_rating || null}
                              />
                            </div>
                          </div>

                          {/* 2. Question QA (bars + strengths/improvements) */}
                          <SectionContainer
                            icon={<FileText size={16} />}
                            title="Question Quality (TI Question QA)"
                            subtitle="Form-level assessment of correctness, alignment, and pedagogy."
                          >
                            <div
                              style={{
                                display: 'grid',
                                gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1.4fr)',
                                gap: '16px',
                                alignItems: 'flex-start',
                              }}
                            >
                              {/* Scores grid */}
                              <div>
                                <div
                                  style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                                    gap: '12px',
                                  }}
                                >
                                  {Object.entries(qa.scores).map(([k, v]) => {
                                    const s = v as number;
                                    const c = getScoreBandColor(s);
                                    return (
                                      <div key={k}>
                                        <div
                                          style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            marginBottom: 4,
                                            fontSize: 11,
                                            color: 'var(--text-secondary)',
                                          }}
                                        >
                                          <span
                                            style={{ textTransform: 'capitalize' }}
                                          >
                                            {k.replace(/_/g, ' ')}
                                          </span>
                                          <span
                                            style={{
                                              fontWeight: 600,
                                              color: c,
                                            }}
                                          >
                                            {(s * 100).toFixed(0)}%
                                          </span>
                                        </div>
                                        <div
                                          style={{
                                            height: 5,
                                            borderRadius: 999,
                                            background: 'var(--bar-bg)',
                                            overflow: 'hidden',
                                          }}
                                        >
                                          <div
                                            style={{
                                              width: `${s * 100}%`,
                                              height: '100%',
                                              borderRadius: 999,
                                              background: `linear-gradient(90deg, ${c}, ${c}99)`,
                                              transition: 'width 0.4s ease',
                                            }}
                                          />
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Strengths & improvements as chips */}
                              <div
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                                  gap: '12px',
                                }}
                              >
                                <div>
                                  <SectionSubHeader
                                    icon={<CheckCircle2 size={14} color="var(--success)" />}
                                    label="Strengths"
                                  />
                                  <div
                                    style={{
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: 6,
                                    }}
                                  >
                                    {qa.strengths.map((s: string, idx: number) => (
                                      <BadgeLine
                                        key={idx}
                                        color="var(--success)"
                                        background="rgba(16,185,129,0.1)"
                                      >
                                        {s}
                                      </BadgeLine>
                                    ))}
                                  </div>
                                </div>
                                <div>
                                  <SectionSubHeader
                                    icon={<AlertTriangle size={14} color="var(--warning)" />}
                                    label="Suggested Improvements"
                                  />
                                  <div
                                    style={{
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: 6,
                                    }}
                                  >
                                    {qa.suggested_improvements.map((s: string, idx: number) => (
                                      <BadgeLine
                                        key={idx}
                                        color="var(--warning)"
                                        background="rgba(245,158,11,0.1)"
                                      >
                                        {s}
                                      </BadgeLine>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </SectionContainer>

                          {/* 3. Answer Verification – step view */}
                          <SectionContainer
                            icon={<ListChecks size={16} />}
                            title="Answer Verification"
                            subtitle="Consistency of the model's answer and reasoning."
                          >
                            <div
                              style={{
                                display: 'grid',
                                gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)',
                                gap: '16px',
                              }}
                            >
                              <div
                                style={{
                                  background: 'var(--card-bg-medium)',
                                  borderRadius: '10px',
                                  border: '1px solid var(--border)',
                                  padding: '10px 12px',
                                }}
                              >
                                <div
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    marginBottom: 8,
                                  }}
                                >
                                  <span
                                    style={{
                                      fontSize: 12,
                                      color: 'var(--text-secondary)',
                                    }}
                                  >
                                    Model Reasoning
                                  </span>
                                  <span
                                    style={{
                                      fontSize: 11,
                                      padding: '2px 8px',
                                      borderRadius: '999px',
                                      background: answerVerif.is_correct
                                        ? 'rgba(16,185,129,0.12)'
                                        : 'rgba(239,68,68,0.12)',
                                      color: answerVerif.is_correct
                                        ? 'var(--success)'
                                        : 'var(--error)',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 4,
                                    }}
                                  >
                                    {answerVerif.is_correct ? (
                                      <CheckCircle2 size={12} />
                                    ) : (
                                      <XCircle size={12} />
                                    )}
                                    {answerVerif.is_correct ? 'Correct' : 'Incorrect'}
                                  </span>
                                </div>
                                <p
                                  style={{
                                    fontSize: 13,
                                    lineHeight: 1.5,
                                    color: 'var(--text-secondary)',
                                  }}
                                >
                                  {answerVerif.reasoning}
                                </p>
                              </div>

                              <div
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 8,
                                  fontSize: 13,
                                }}
                              >
                                <div
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '8px 10px',
                                    borderRadius: '10px',
                                    border: '1px solid var(--border)',
                                    background: 'var(--card-bg-light)',
                                  }}
                                >
                                  <span
                                    style={{ color: 'var(--text-secondary)' }}
                                  >
                                    Model Answer
                                  </span>
                                  <span
                                    style={{
                                      fontWeight: 600,
                                      fontFamily: 'monospace',
                                    }}
                                  >
                                    {answerVerif.correct_answer}
                                  </span>
                                </div>
                                <div
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '8px 10px',
                                    borderRadius: '10px',
                                    border: '1px solid var(--border)',
                                    background: 'var(--card-bg-light)',
                                  }}
                                >
                                  <span
                                    style={{ color: 'var(--text-secondary)' }}
                                  >
                                    Confidence
                                  </span>
                                  <span
                                    style={{
                                      fontWeight: 600,
                                      color: getScoreBandColor(
                                        answerVerif.confidence / 10,
                                      ),
                                    }}
                                  >
                                    {answerVerif.confidence}/10
                                  </span>
                                </div>
                              </div>
                            </div>
                          </SectionContainer>

                          {/* 4. Reading Question QC – Tables */}
                          <SectionContainer
                            icon={<Info size={16} />}
                            title="Reading & Question Checks"
                            subtitle="Clarity, standard alignment, and distractor quality."
                          >
                            <div
                              style={{
                                display: 'grid',
                                gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1.4fr)',
                                gap: '16px',
                              }}
                            >
                              <CategoryTable
                                title="Question Checks"
                                checks={readingQC.question_checks}
                              />
                              <CategoryTable
                                title="Distractor Checks"
                                checks={readingQC.distractor_checks}
                              />
                            </div>
                          </SectionContainer>

                    {/* 5. Math Content Evaluation – matrix */}
                    <SectionContainer
                      icon={<Sigma size={16} />}
                      title="Math Content Evaluation"
                      subtitle="Image quality, rigor, curriculum alignment, and support."
                    >
                      <MathMatrix math={math} />
                    </SectionContainer>

                    {/* 6. Localization Evaluation */}
                    {ev.localization_evaluator && (
                      <SectionContainer
                        icon={<Globe size={16} />}
                        title="Localization Evaluation"
                        subtitle="Cultural sensitivity, gender balance, and regional appropriateness."
                      >
                        <LocalizationSection localization={ev.localization_evaluator} />
                      </SectionContainer>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ---------- Small subcomponents for clarity & reusability ---------- */

const ScoreDistributionPlot: React.FC<{ 
  scoresData: Array<{
    question_id: number;
    recipe_id: number;
    evaluator_score: number;
    difficulty: string;
  }>;
}> = ({ scoresData }) => {
  const [difficultyFilter, setDifficultyFilter] = useState<'all' | 'Easy' | 'Medium' | 'Hard'>('all');
  const [hoveredPoint, setHoveredPoint] = useState<{
    question_id: number;
    recipe_id: number;
    score: number;
    difficulty: string;
    x: number;
    y: number;
  } | null>(null);

  // Filter scores by difficulty
  const filteredScores = useMemo(() => {
    if (difficultyFilter === 'all') {
      return scoresData;
    }
    return scoresData.filter(item => 
      item.difficulty?.toLowerCase() === difficultyFilter.toLowerCase()
    );
  }, [scoresData, difficultyFilter]);

  const getDifficultyColor = (difficulty: string) => {
    const diff = difficulty?.toLowerCase();
    if (diff === 'easy') return 'var(--success)';
    if (diff === 'hard') return 'var(--error)';
    return 'var(--warning)';
  };

  return (
    <div>
      {/* Filter Buttons */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '12px',
        flexWrap: 'wrap',
      }}>
        {['all', 'Easy', 'Medium', 'Hard'].map((filter) => (
          <button
            key={filter}
            onClick={() => setDifficultyFilter(filter as any)}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 500,
              borderRadius: '6px',
              border: difficultyFilter === filter ? '1px solid var(--primary)' : '1px solid var(--border)',
              background: difficultyFilter === filter ? 'rgba(158, 127, 255, 0.1)' : 'transparent',
              color: difficultyFilter === filter ? 'var(--primary)' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              if (difficultyFilter !== filter) {
                e.currentTarget.style.background = 'var(--hover-bg)';
                e.currentTarget.style.color = 'var(--text)';
              }
            }}
            onMouseLeave={(e) => {
              if (difficultyFilter !== filter) {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }
            }}
          >
            {filter === 'all' ? 'All' : filter} ({
              filter === 'all' 
                ? scoresData.length 
                : scoresData.filter(s => s.difficulty?.toLowerCase() === filter.toLowerCase()).length
            })
          </button>
        ))}
      </div>

      <div
        style={{
          position: 'relative',
          height: '180px',
          background: 'var(--card-bg-dark)',
          borderRadius: '8px',
          padding: '16px 16px 30px 16px',
          border: '1px solid var(--border)',
        }}
      >
        {/* X-axis labels (horizontal) */}
        <div
          style={{
            position: 'absolute',
            left: '16px',
            right: '16px',
            bottom: '10px',
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '10px',
            color: 'var(--text-secondary)',
          }}
        >
          <div>0</div>
          <div>0.25</div>
          <div>0.5</div>
          <div>0.75</div>
          <div>0.85</div>
          <div>1.0</div>
        </div>

        {/* Plot area */}
        <div
          style={{
            position: 'relative',
            height: 'calc(100% - 30px)',
            borderLeft: '1px solid var(--border)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          {/* Threshold line at 0.85 (vertical) */}
          <div
            style={{
              position: 'absolute',
              left: '85%',
              top: 0,
              bottom: 0,
              borderLeft: '2px solid rgba(245, 158, 11, 0.6)',
              zIndex: 1,
            }}
          >
            <span
              style={{
                position: 'absolute',
                left: '4px',
                top: '4px',
                fontSize: '9px',
                color: 'var(--warning)',
                background: 'var(--card-bg-dark)',
                padding: '0 4px',
                fontWeight: 600,
                whiteSpace: 'nowrap',
              }}
            >
              0.85 threshold
            </span>
          </div>
          
          {/* Points plotted horizontally */}
          {filteredScores.map((item, index) => {
            // Distribute points vertically across the available height
            const y = (index / filteredScores.length) * 100;
            const x = item.evaluator_score * 100;
            const color = getDifficultyColor(item.difficulty);
            
            return (
              <div
                key={`${item.question_id}-${index}`}
                style={{
                  position: 'absolute',
                  left: `${x}%`,
                  top: `${y}%`,
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: color,
                  transform: 'translate(-50%, -50%)',
                  boxShadow: hoveredPoint?.question_id === item.question_id 
                    ? `0 0 8px ${color}` 
                    : `0 0 4px ${color}`,
                  opacity: hoveredPoint?.question_id === item.question_id ? 1 : 0.7,
                  cursor: 'pointer',
                  zIndex: hoveredPoint?.question_id === item.question_id ? 10 : 2,
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setHoveredPoint({
                    question_id: item.question_id,
                    recipe_id: item.recipe_id,
                    score: item.evaluator_score,
                    difficulty: item.difficulty,
                    x: rect.left,
                    y: rect.top,
                  });
                }}
                onMouseLeave={() => setHoveredPoint(null)}
              />
            );
          })}
        </div>

        {/* X-axis label */}
        <div
          style={{
            position: 'absolute',
            bottom: '-6px',
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: '10px',
            color: 'var(--text-secondary)',
            fontWeight: 500,
          }}
        >
          Score →
        </div>

        {/* Tooltip */}
        {hoveredPoint && (
          <div
            style={{
              position: 'fixed',
              left: `${hoveredPoint.x + 15}px`,
              top: `${hoveredPoint.y - 10}px`,
              background: 'rgba(0, 0, 0, 0.9)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              padding: '8px 12px',
              fontSize: '11px',
              color: 'var(--text)',
              zIndex: 1000,
              pointerEvents: 'none',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: '4px', color: getDifficultyColor(hoveredPoint.difficulty) }}>
              {hoveredPoint.difficulty}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
              Score: <span style={{ color: 'var(--text)', fontWeight: 600 }}>{(hoveredPoint.score * 100).toFixed(1)}%</span>
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
              Question ID: <span style={{ color: 'var(--text)', fontFamily: 'monospace' }}>{hoveredPoint.question_id}</span>
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
              Recipe ID: <span style={{ color: 'var(--text)', fontFamily: 'monospace' }}>{hoveredPoint.recipe_id}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const CompactLatencyTable: React.FC<{ 
  difficulty: string; 
  data?: ExperimentReportRow;
}> = ({ difficulty, data }) => {
  // Check if data exists and has valid latency numbers
  const hasLatencyData = data && 
    data.p10_ttft_ms != null && 
    data.p10_total_generation_ms != null &&
    !isNaN(Number(data.p10_ttft_ms)) &&
    !isNaN(Number(data.p10_total_generation_ms));

  if (!data) {
    return (
      <div
        style={{
          border: '1px solid var(--border)',
          borderRadius: '8px',
          overflow: 'hidden',
          background: 'var(--card-bg-dark)',
          padding: '20px',
          textAlign: 'center',
          color: 'var(--text-secondary)',
          fontSize: '11px',
        }}
      >
        No data for {difficulty}
      </div>
    );
  }

  if (!hasLatencyData) {
    return (
      <div
        style={{
          border: '1px solid var(--border)',
          borderRadius: '8px',
          overflow: 'hidden',
          background: 'var(--card-bg-dark)',
        }}
      >
        <div
          style={{
            padding: '8px 10px',
            background: 'rgba(255, 255, 255, 0.02)',
            borderBottom: '1px solid var(--border)',
            fontSize: '11px',
            fontWeight: 600,
          }}
        >
          {difficulty} (n={data.total_questions})
        </div>
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '11px' }}>
          No latency data available
        </div>
      </div>
    );
  }

  const displayData = {
    total: data.total_questions,
    p10_ttft: Number(data.p10_ttft_ms) / 1000, // Convert ms to seconds
    p10_total: Number(data.p10_total_generation_ms) / 1000,
    p90_ttft: Number(data.p90_ttft_ms) / 1000,
    p90_total: Number(data.p90_total_generation_ms) / 1000,
    median_ttft: data.median_ttft_ms != null && !isNaN(Number(data.median_ttft_ms)) ? Number(data.median_ttft_ms) / 1000 : null,
    median_total: data.median_total_generation_ms != null && !isNaN(Number(data.median_total_generation_ms)) ? Number(data.median_total_generation_ms) / 1000 : null,
  };

  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: '8px',
        overflow: 'hidden',
        background: 'var(--card-bg-dark)',
      }}
    >
      <div
        style={{
          padding: '8px 10px',
          background: 'rgba(255, 255, 255, 0.02)',
          borderBottom: '1px solid var(--border)',
          fontSize: '11px',
          fontWeight: 600,
        }}
      >
        {difficulty} (n={displayData.total})
      </div>
      
      <div style={{ padding: '8px 10px', fontSize: '10px', fontFamily: 'monospace' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginBottom: '6px', color: 'var(--text-secondary)' }}>
          <div></div>
          <div style={{ textAlign: 'right' }}>TTFT (s)</div>
          <div style={{ textAlign: 'right' }}>Total (s)</div>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginBottom: '4px' }}>
          <div>P10</div>
          <div style={{ textAlign: 'right' }}>{displayData.p10_ttft.toFixed(2)}</div>
          <div style={{ textAlign: 'right' }}>{displayData.p10_total.toFixed(2)}</div>
        </div>
        
        {(displayData.median_ttft != null && displayData.median_total != null) && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginBottom: '4px' }}>
            <div>Median</div>
            <div style={{ textAlign: 'right' }}>{displayData.median_ttft.toFixed(2)}</div>
            <div style={{ textAlign: 'right' }}>{displayData.median_total.toFixed(2)}</div>
          </div>
        )}
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
          <div>P90</div>
          <div style={{ textAlign: 'right' }}>{displayData.p90_ttft.toFixed(2)}</div>
          <div style={{ textAlign: 'right' }}>{displayData.p90_total.toFixed(2)}</div>
        </div>
      </div>
    </div>
  );
};

const OverviewStat: React.FC<{ label: string; value: string | number | null | undefined }> = ({
  label,
  value,
}) => {
  // Don't render if value is null, undefined, or 'null' string
  if (value == null || value === 'null' || value === '') {
    return null;
  }

  return (
    <div
      style={{
        minWidth: 90,
        padding: '6px 10px',
        borderRadius: '10px',
        border: '1px solid var(--border)',
        background: 'var(--card-bg-darker)',
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: 'var(--text-secondary)',
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600 }}>{value}</div>
    </div>
  );
};

const SectionContainer: React.FC<{
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}> = ({ icon, title, subtitle, children }) => (
  <section
    style={{
      marginTop: '18px',
      padding: '14px 14px 16px',
      borderRadius: '12px',
      border: '1px solid var(--border)',
      background: 'var(--card-bg-dark)',
    }}
  >
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '10px',
        gap: '12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: 999,
            background:
              'radial-gradient(circle at 30% 0%, rgba(148,163,184,0.5), transparent 60%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {icon}
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{title}</div>
          {subtitle && (
            <div
              style={{
                fontSize: 11,
                color: 'var(--text-secondary)',
              }}
            >
              {subtitle}
            </div>
          )}
        </div>
      </div>
    </header>
    {children}
  </section>
);

const SectionSubHeader: React.FC<{ icon: React.ReactNode; label: string }> = ({
  icon,
  label,
}) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      marginBottom: 6,
      fontSize: 12,
      fontWeight: 500,
    }}
  >
    {icon}
    <span>{label}</span>
  </div>
);

const BadgeLine: React.FC<{
  color: string;
  background: string;
  children: React.ReactNode;
}> = ({ color, background, children }) => (
  <div
    style={{
      fontSize: 12,
      borderRadius: 8,
      padding: '6px 8px',
      background,
      borderLeft: `3px solid ${color}`,
      color: 'var(--text-secondary)',
    }}
  >
    {children}
  </div>
);

type ChecksRecord = Record<
  string,
  {
    score: number;
    category: string;
    response: string;
  }
>;

const CategoryTable: React.FC<{ title: string; checks: ChecksRecord }> = ({
  title,
  checks,
}) => (
  <div
    style={{
      borderRadius: 10,
      border: '1px solid var(--border)',
      background: 'var(--card-bg-darker)',
      padding: '8px 10px 10px',
    }}
  >
    <div
      style={{
        fontSize: 12,
        fontWeight: 500,
        marginBottom: 6,
      }}
    >
      {title}
    </div>
    <div
      style={{
        maxHeight: 220,
        overflow: 'auto',
      }}
    >
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 11,
        }}
      >
        <thead>
          <tr
            style={{
              textAlign: 'left',
              color: 'var(--text-secondary)',
            }}
          >
            <th
              style={{
                padding: '4px 4px',
                fontWeight: 500,
              }}
            >
              Check
            </th>
            <th
              style={{
                padding: '4px 4px',
                fontWeight: 500,
                width: 48,
              }}
            >
              Score
            </th>
            <th
              style={{
                padding: '4px 4px',
                fontWeight: 500,
                width: '60%',
              }}
            >
              Notes
            </th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(checks).map(([key, obj]) => (
            <tr key={key}>
              <td
                style={{
                  padding: '4px 4px',
                  verticalAlign: 'top',
                  textTransform: 'capitalize',
                }}
              >
                {key.replace(/_/g, ' ')}
              </td>
              <td
                style={{
                  padding: '4px 4px',
                  verticalAlign: 'top',
                }}
              >
                <span
                  style={{
                    padding: '2px 6px',
                    borderRadius: 999,
                    border: '1px solid var(--border)',
                  }}
                >
                  {obj.score}
                </span>
              </td>
              <td
                style={{
                  padding: '4px 4px',
                  verticalAlign: 'top',
                  color: 'var(--text-secondary)',
                }}
              >
                {obj.response}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const MathMatrix: React.FC<{
  math: (typeof mockEvaluations)[number]['evaluations'][string]['math_content_evaluator'];
}> = ({ math }) => {
  const fields: Array<keyof typeof math> = [
    'image_quality',
    'cognitive_demand',
    'accuracy_and_rigor',
    'curriculum_alignment',
    'instructional_support',
    'reveals_misconceptions',
    'engagement_and_relevance',
    'clarity_and_accessibility',
    'question_type_appropriateness',
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 2fr)',
        gap: '16px',
      }}
    >
      <div
        style={{
          borderRadius: 10,
          border: '1px solid var(--border)',
          background: 'var(--card-bg-darker)',
          padding: '10px 12px',
        }}
      >
        <div
          style={{
            fontSize: 12,
            marginBottom: 6,
            color: 'var(--text-secondary)',
          }}
        >
          Overall
        </div>
        <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
          {(math.overall_score * 100).toFixed(0)}%
        </div>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            borderRadius: 999,
            border: '1px solid rgba(16,185,129,0.5)',
            background: 'rgba(16,185,129,0.08)',
            fontSize: 12,
            color: 'var(--success)',
          }}
        >
          <CheckCircle2 size={14} />
          {math.overall_rating}
        </div>
        <div
          style={{
            fontSize: 11,
            color: 'var(--text-secondary)',
            marginTop: 8,
          }}
        >
          Passed {math.pass_count} out of {math.pass_count + math.fail_count} checks.
        </div>
      </div>

      <div
        style={{
          borderRadius: 10,
          border: '1px solid var(--border)',
          background: 'var(--card-bg-darker)',
          padding: '10px 12px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 8,
        }}
      >
        {fields.map((fieldKey) => {
          const value = String(math[fieldKey]);
          const isPass = value.toUpperCase() === 'PASS' || value === 'ACCEPTABLE';
          return (
            <div
              key={String(fieldKey)}
              style={{
                borderRadius: 8,
                padding: '6px 8px',
                background: 'var(--card-bg-medium)',
                border: '1px solid var(--border)',
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--text-secondary)',
                  marginBottom: 4,
                }}
              >
                {String(fieldKey).replace(/_/g, ' ')}
              </div>
              <span
                style={{
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: isPass
                    ? 'rgba(16,185,129,0.1)'
                    : 'rgba(239,68,68,0.12)',
                  color: isPass ? 'var(--success)' : 'var(--error)',
                  border: `1px solid ${
                    isPass ? 'rgba(16,185,129,0.6)' : 'rgba(239,68,68,0.6)'
                  }`,
                }}
              >
                {value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const DifficultyFeedbackContent: React.FC<{
  scoresData: Array<{
    question_id: number;
    recipe_id: number;
    evaluator_score: number;
    difficulty: string;
    evaluator_parsed_response?: any;
  }>;
  difficulty: string;
}> = ({ scoresData, difficulty }) => {
  // Aggregate only suggested improvements and failures
  const aggregatedData = useMemo(() => {
    const suggestedImprovements: Array<{ text: string; count: number; questionIds: number[] }> = [];
    const readingFailures: Array<{ check: string; reason: string; count: number; questionIds: number[] }> = [];
    const mathFailures: Array<{ check: string; count: number; questionIds: number[] }> = [];
    const localizationIssues: Array<{ text: string; count: number; questionIds: number[] }> = [];

    scoresData.forEach((item) => {
      const evalResponse = item.evaluator_parsed_response;
      if (!evalResponse || !evalResponse.evaluations) return;

      const evalData = Object.values(evalResponse.evaluations)[0] as any;
      if (!evalData) return;

      // Suggested Improvements
      if (evalData.ti_question_qa?.suggested_improvements) {
        evalData.ti_question_qa.suggested_improvements.forEach((improvement: string) => {
          const existing = suggestedImprovements.find(i => i.text === improvement);
          if (existing) {
            existing.count++;
            existing.questionIds.push(item.question_id);
          } else {
            suggestedImprovements.push({ text: improvement, count: 1, questionIds: [item.question_id] });
          }
        });
      }

      // Reading Question Failures (only failures, score === 0)
      if (evalData.reading_question_qc?.question_checks) {
        Object.entries(evalData.reading_question_qc.question_checks).forEach(([key, check]: [string, any]) => {
          if (check.score === 0) {
            const checkName = key.replace(/_/g, ' ');
            const existing = readingFailures.find(f => f.check === checkName);
            if (existing) {
              existing.count++;
              existing.questionIds.push(item.question_id);
            } else {
              readingFailures.push({ check: checkName, reason: check.response, count: 1, questionIds: [item.question_id] });
            }
          }
        });
      }

      if (evalData.reading_question_qc?.distractor_checks) {
        Object.entries(evalData.reading_question_qc.distractor_checks).forEach(([key, check]: [string, any]) => {
          if (check.score === 0) {
            const checkName = `Distractor: ${key.replace(/_/g, ' ')}`;
            const existing = readingFailures.find(f => f.check === checkName);
            if (existing) {
              existing.count++;
              existing.questionIds.push(item.question_id);
            } else {
              readingFailures.push({ check: checkName, reason: check.response, count: 1, questionIds: [item.question_id] });
            }
          }
        });
      }

      // Math Content Failures (only FAIL values)
      if (evalData.math_content_evaluator) {
        Object.entries(evalData.math_content_evaluator)
          .filter(([key, value]) => !['overall_score', 'overall_rating', 'pass_count', 'fail_count'].includes(key) && value === 'FAIL')
          .forEach(([key]) => {
            const checkName = key.replace(/_/g, ' ');
            const existing = mathFailures.find(f => f.check === checkName);
            if (existing) {
              existing.count++;
              existing.questionIds.push(item.question_id);
            } else {
              mathFailures.push({ check: checkName, count: 1, questionIds: [item.question_id] });
            }
          });
      }

      // Localization Issues (only issues from failed evaluations)
      if (evalData.localization_evaluator?.issues) {
        evalData.localization_evaluator.issues.forEach((issue: string) => {
          const existing = localizationIssues.find(i => i.text === issue);
          if (existing) {
            existing.count++;
            existing.questionIds.push(item.question_id);
          } else {
            localizationIssues.push({ text: issue, count: 1, questionIds: [item.question_id] });
          }
        });
      }
    });

    // Sort by count (most common first)
    suggestedImprovements.sort((a, b) => b.count - a.count);
    readingFailures.sort((a, b) => b.count - a.count);
    mathFailures.sort((a, b) => b.count - a.count);
    localizationIssues.sort((a, b) => b.count - a.count);

    return {
      suggestedImprovements,
      readingFailures,
      mathFailures,
      localizationIssues,
    };
  }, [scoresData]);

  const totalItems = aggregatedData.suggestedImprovements.length + 
                     aggregatedData.readingFailures.length + 
                     aggregatedData.mathFailures.length + 
                     aggregatedData.localizationIssues.length;

  return (
    <div>
      {/* Summary */}
      <div style={{ 
        marginBottom: '24px', 
        padding: '16px', 
        background: 'rgba(245, 158, 11, 0.1)', 
        border: '1px solid rgba(245, 158, 11, 0.3)',
        borderRadius: '8px'
      }}>
        <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
          Summary for {difficulty} Difficulty
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
          <div>📝 Suggested Improvements: <strong>{aggregatedData.suggestedImprovements.length}</strong></div>
          <div>❌ Reading Failures: <strong>{aggregatedData.readingFailures.length}</strong></div>
          <div>🔢 Math Failures: <strong>{aggregatedData.mathFailures.length}</strong></div>
          <div>🌍 Localization Issues: <strong>{aggregatedData.localizationIssues.length}</strong></div>
        </div>
      </div>

      {/* Suggested Improvements */}
      {aggregatedData.suggestedImprovements.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={20} />
            Suggested Improvements ({aggregatedData.suggestedImprovements.length})
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {aggregatedData.suggestedImprovements.map((improvement, idx) => (
              <div
                key={idx}
                style={{
                  padding: '12px 16px',
                  background: 'rgba(245, 158, 11, 0.08)',
                  border: '1px solid rgba(245, 158, 11, 0.2)',
                  borderLeft: '4px solid var(--warning)',
                  borderRadius: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'start',
                  gap: '12px',
                }}
              >
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '13px', lineHeight: '1.6', color: 'var(--text)', margin: 0 }}>{improvement.text}</p>
                </div>
                <div
                  style={{
                    padding: '4px 12px',
                    borderRadius: '999px',
                    background: 'rgba(245, 158, 11, 0.2)',
                    color: 'var(--warning)',
                    fontSize: '12px',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {improvement.count}x
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reading Failures */}
      {aggregatedData.readingFailures.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: 'var(--error)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <XCircle size={20} />
            Reading Question Failures ({aggregatedData.readingFailures.length})
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {aggregatedData.readingFailures.map((failure, idx) => (
              <div
                key={idx}
                style={{
                  padding: '12px 16px',
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderLeft: '4px solid var(--error)',
                  borderRadius: '8px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                  <strong style={{ fontSize: '13px', textTransform: 'capitalize', color: 'var(--text)' }}>{failure.check}</strong>
                  <div
                    style={{
                      padding: '4px 12px',
                      borderRadius: '999px',
                      background: 'rgba(239, 68, 68, 0.2)',
                      color: 'var(--error)',
                      fontSize: '12px',
                      fontWeight: 700,
                    }}
                  >
                    {failure.count}x
                  </div>
                </div>
                <p style={{ fontSize: '12px', lineHeight: '1.5', color: 'var(--text-secondary)', margin: 0 }}>{failure.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Math Failures */}
      {aggregatedData.mathFailures.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: 'var(--error)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <XCircle size={20} />
            Math Content Failures ({aggregatedData.mathFailures.length})
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {aggregatedData.mathFailures.map((failure, idx) => (
              <div
                key={idx}
                style={{
                  padding: '12px 16px',
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderLeft: '4px solid var(--error)',
                  borderRadius: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <strong style={{ fontSize: '13px', textTransform: 'capitalize', color: 'var(--text)', flex: 1 }}>{failure.check}</strong>
                <div
                  style={{
                    padding: '4px 12px',
                    borderRadius: '999px',
                    background: 'rgba(239, 68, 68, 0.2)',
                    color: 'var(--error)',
                    fontSize: '12px',
                    fontWeight: 700,
                  }}
                >
                  {failure.count}x
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Localization Issues */}
      {aggregatedData.localizationIssues.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: 'var(--error)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <XCircle size={20} />
            Localization Issues ({aggregatedData.localizationIssues.length})
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {aggregatedData.localizationIssues.map((issue, idx) => (
              <div
                key={idx}
                style={{
                  padding: '12px 16px',
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderLeft: '4px solid var(--error)',
                  borderRadius: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'start',
                  gap: '12px',
                }}
              >
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '13px', lineHeight: '1.6', color: 'var(--text)', margin: 0 }}>{issue.text}</p>
                </div>
                <div
                  style={{
                    padding: '4px 12px',
                    borderRadius: '999px',
                    background: 'rgba(239, 68, 68, 0.2)',
                    color: 'var(--error)',
                    fontSize: '12px',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {issue.count}x
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {totalItems === 0 && (
        <div style={{
          padding: '48px',
          textAlign: 'center',
          color: 'var(--text-secondary)',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
        }}>
          <CheckCircle2 size={48} style={{ marginBottom: '12px', opacity: 0.5 }} />
          <p style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>No issues found</p>
          <p style={{ fontSize: '13px' }}>No failures or suggested improvements for {difficulty} difficulty</p>
        </div>
      )}
    </div>
  );
};

const AggregatedFeedbackContent: React.FC<{
  scoresData: Array<{
    question_id: number;
    recipe_id: number;
    evaluator_score: number;
    difficulty: string;
    evaluator_parsed_response?: any;
  }>;
}> = ({ scoresData }) => {
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'qa_issues' | 'improvements' | 'reading_failures' | 'math_failures' | 'localization_issues'>('all');

  // Aggregate all feedback
  const aggregatedData = useMemo(() => {
    const qaIssues: Array<{ text: string; count: number; questionIds: number[] }> = [];
    const suggestedImprovements: Array<{ text: string; count: number; questionIds: number[] }> = [];
    const readingFailures: Array<{ check: string; reason: string; count: number; questionIds: number[] }> = [];
    const mathFailures: Array<{ check: string; count: number; questionIds: number[] }> = [];
    const localizationIssues: Array<{ text: string; count: number; questionIds: number[] }> = [];

    scoresData.forEach((item) => {
      const evalResponse = item.evaluator_parsed_response;
      if (!evalResponse || !evalResponse.evaluations) return;

      const evalData = Object.values(evalResponse.evaluations)[0] as any;
      if (!evalData) return;

      // QA Issues
      if (evalData.ti_question_qa?.issues) {
        evalData.ti_question_qa.issues.forEach((issue: string) => {
          const existing = qaIssues.find(i => i.text === issue);
          if (existing) {
            existing.count++;
            existing.questionIds.push(item.question_id);
          } else {
            qaIssues.push({ text: issue, count: 1, questionIds: [item.question_id] });
          }
        });
      }

      // Suggested Improvements
      if (evalData.ti_question_qa?.suggested_improvements) {
        evalData.ti_question_qa.suggested_improvements.forEach((improvement: string) => {
          const existing = suggestedImprovements.find(i => i.text === improvement);
          if (existing) {
            existing.count++;
            existing.questionIds.push(item.question_id);
          } else {
            suggestedImprovements.push({ text: improvement, count: 1, questionIds: [item.question_id] });
          }
        });
      }

      // Reading Question Failures
      if (evalData.reading_question_qc?.question_checks) {
        Object.entries(evalData.reading_question_qc.question_checks).forEach(([key, check]: [string, any]) => {
          if (check.score === 0) {
            const checkName = key.replace(/_/g, ' ');
            const existing = readingFailures.find(f => f.check === checkName);
            if (existing) {
              existing.count++;
              existing.questionIds.push(item.question_id);
            } else {
              readingFailures.push({ check: checkName, reason: check.response, count: 1, questionIds: [item.question_id] });
            }
          }
        });
      }

      if (evalData.reading_question_qc?.distractor_checks) {
        Object.entries(evalData.reading_question_qc.distractor_checks).forEach(([key, check]: [string, any]) => {
          if (check.score === 0) {
            const checkName = `Distractor: ${key.replace(/_/g, ' ')}`;
            const existing = readingFailures.find(f => f.check === checkName);
            if (existing) {
              existing.count++;
              existing.questionIds.push(item.question_id);
            } else {
              readingFailures.push({ check: checkName, reason: check.response, count: 1, questionIds: [item.question_id] });
            }
          }
        });
      }

      // Math Content Failures
      if (evalData.math_content_evaluator) {
        Object.entries(evalData.math_content_evaluator)
          .filter(([key, value]) => !['overall_score', 'overall_rating', 'pass_count', 'fail_count'].includes(key) && value === 'FAIL')
          .forEach(([key]) => {
            const checkName = key.replace(/_/g, ' ');
            const existing = mathFailures.find(f => f.check === checkName);
            if (existing) {
              existing.count++;
              existing.questionIds.push(item.question_id);
            } else {
              mathFailures.push({ check: checkName, count: 1, questionIds: [item.question_id] });
            }
          });
      }

      // Localization Issues
      if (evalData.localization_evaluator?.issues) {
        evalData.localization_evaluator.issues.forEach((issue: string) => {
          const existing = localizationIssues.find(i => i.text === issue);
          if (existing) {
            existing.count++;
            existing.questionIds.push(item.question_id);
          } else {
            localizationIssues.push({ text: issue, count: 1, questionIds: [item.question_id] });
          }
        });
      }
    });

    // Sort by count (most common first)
    qaIssues.sort((a, b) => b.count - a.count);
    suggestedImprovements.sort((a, b) => b.count - a.count);
    readingFailures.sort((a, b) => b.count - a.count);
    mathFailures.sort((a, b) => b.count - a.count);
    localizationIssues.sort((a, b) => b.count - a.count);

    return {
      qaIssues,
      suggestedImprovements,
      readingFailures,
      mathFailures,
      localizationIssues,
    };
  }, [scoresData]);

  const categories = [
    { id: 'all' as const, label: 'All', count: aggregatedData.qaIssues.length + aggregatedData.suggestedImprovements.length + aggregatedData.readingFailures.length + aggregatedData.mathFailures.length + aggregatedData.localizationIssues.length },
    { id: 'qa_issues' as const, label: 'QA Issues', count: aggregatedData.qaIssues.length },
    { id: 'improvements' as const, label: 'Suggested Improvements', count: aggregatedData.suggestedImprovements.length },
    { id: 'reading_failures' as const, label: 'Reading Failures', count: aggregatedData.readingFailures.length },
    { id: 'math_failures' as const, label: 'Math Failures', count: aggregatedData.mathFailures.length },
    { id: 'localization_issues' as const, label: 'Localization Issues', count: aggregatedData.localizationIssues.length },
  ];

  return (
    <div>
      {/* Category Filters */}
      <div style={{ marginBottom: '24px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            style={{
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 600,
              borderRadius: '8px',
              border: selectedCategory === cat.id ? '1px solid var(--primary)' : '1px solid var(--border)',
              background: selectedCategory === cat.id ? 'rgba(158, 127, 255, 0.15)' : 'var(--surface)',
              color: selectedCategory === cat.id ? 'var(--primary)' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              if (selectedCategory !== cat.id) {
                e.currentTarget.style.background = 'var(--hover-bg)';
                e.currentTarget.style.color = 'var(--text)';
              }
            }}
            onMouseLeave={(e) => {
              if (selectedCategory !== cat.id) {
                e.currentTarget.style.background = 'var(--surface)';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }
            }}
          >
            {cat.label} <span style={{ opacity: 0.6 }}>({cat.count})</span>
          </button>
        ))}
      </div>

      {/* QA Issues */}
      {(selectedCategory === 'all' || selectedCategory === 'qa_issues') && aggregatedData.qaIssues.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: 'var(--error)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <XCircle size={20} />
            QA Issues ({aggregatedData.qaIssues.length})
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {aggregatedData.qaIssues.map((issue, idx) => (
              <div
                key={idx}
                style={{
                  padding: '12px 16px',
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderLeft: '4px solid var(--error)',
                  borderRadius: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'start',
                  gap: '12px',
                }}
              >
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '13px', lineHeight: '1.6', color: 'var(--text)', margin: 0 }}>{issue.text}</p>
                </div>
                <div
                  style={{
                    padding: '4px 12px',
                    borderRadius: '999px',
                    background: 'rgba(239, 68, 68, 0.2)',
                    color: 'var(--error)',
                    fontSize: '12px',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {issue.count}x
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggested Improvements */}
      {(selectedCategory === 'all' || selectedCategory === 'improvements') && aggregatedData.suggestedImprovements.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={20} />
            Suggested Improvements ({aggregatedData.suggestedImprovements.length})
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {aggregatedData.suggestedImprovements.map((improvement, idx) => (
              <div
                key={idx}
                style={{
                  padding: '12px 16px',
                  background: 'rgba(245, 158, 11, 0.08)',
                  border: '1px solid rgba(245, 158, 11, 0.2)',
                  borderLeft: '4px solid var(--warning)',
                  borderRadius: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'start',
                  gap: '12px',
                }}
              >
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '13px', lineHeight: '1.6', color: 'var(--text)', margin: 0 }}>{improvement.text}</p>
                </div>
                <div
                  style={{
                    padding: '4px 12px',
                    borderRadius: '999px',
                    background: 'rgba(245, 158, 11, 0.2)',
                    color: 'var(--warning)',
                    fontSize: '12px',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {improvement.count}x
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reading Failures */}
      {(selectedCategory === 'all' || selectedCategory === 'reading_failures') && aggregatedData.readingFailures.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: 'var(--error)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <XCircle size={20} />
            Reading Question Failures ({aggregatedData.readingFailures.length})
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {aggregatedData.readingFailures.map((failure, idx) => (
              <div
                key={idx}
                style={{
                  padding: '12px 16px',
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderLeft: '4px solid var(--error)',
                  borderRadius: '8px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                  <strong style={{ fontSize: '13px', textTransform: 'capitalize', color: 'var(--text)' }}>{failure.check}</strong>
                  <div
                    style={{
                      padding: '4px 12px',
                      borderRadius: '999px',
                      background: 'rgba(239, 68, 68, 0.2)',
                      color: 'var(--error)',
                      fontSize: '12px',
                      fontWeight: 700,
                    }}
                  >
                    {failure.count}x
                  </div>
                </div>
                <p style={{ fontSize: '12px', lineHeight: '1.5', color: 'var(--text-secondary)', margin: 0 }}>{failure.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Math Failures */}
      {(selectedCategory === 'all' || selectedCategory === 'math_failures') && aggregatedData.mathFailures.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: 'var(--error)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <XCircle size={20} />
            Math Content Failures ({aggregatedData.mathFailures.length})
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {aggregatedData.mathFailures.map((failure, idx) => (
              <div
                key={idx}
                style={{
                  padding: '12px 16px',
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderLeft: '4px solid var(--error)',
                  borderRadius: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <strong style={{ fontSize: '13px', textTransform: 'capitalize', color: 'var(--text)', flex: 1 }}>{failure.check}</strong>
                <div
                  style={{
                    padding: '4px 12px',
                    borderRadius: '999px',
                    background: 'rgba(239, 68, 68, 0.2)',
                    color: 'var(--error)',
                    fontSize: '12px',
                    fontWeight: 700,
                  }}
                >
                  {failure.count}x
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Localization Issues */}
      {(selectedCategory === 'all' || selectedCategory === 'localization_issues') && aggregatedData.localizationIssues.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: 'var(--error)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <XCircle size={20} />
            Localization Issues ({aggregatedData.localizationIssues.length})
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {aggregatedData.localizationIssues.map((issue, idx) => (
              <div
                key={idx}
                style={{
                  padding: '12px 16px',
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderLeft: '4px solid var(--error)',
                  borderRadius: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'start',
                  gap: '12px',
                }}
              >
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '13px', lineHeight: '1.6', color: 'var(--text)', margin: 0 }}>{issue.text}</p>
                </div>
                <div
                  style={{
                    padding: '4px 12px',
                    borderRadius: '999px',
                    background: 'rgba(239, 68, 68, 0.2)',
                    color: 'var(--error)',
                    fontSize: '12px',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {issue.count}x
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {selectedCategory !== 'all' && 
       ((selectedCategory === 'qa_issues' && aggregatedData.qaIssues.length === 0) ||
        (selectedCategory === 'improvements' && aggregatedData.suggestedImprovements.length === 0) ||
        (selectedCategory === 'reading_failures' && aggregatedData.readingFailures.length === 0) ||
        (selectedCategory === 'math_failures' && aggregatedData.mathFailures.length === 0) ||
        (selectedCategory === 'localization_issues' && aggregatedData.localizationIssues.length === 0)) && (
        <div style={{
          padding: '48px',
          textAlign: 'center',
          color: 'var(--text-secondary)',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
        }}>
          <CheckCircle2 size={48} style={{ marginBottom: '12px', opacity: 0.5 }} />
          <p style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>No issues found</p>
          <p style={{ fontSize: '13px' }}>No failures or issues in this category</p>
        </div>
      )}
    </div>
  );
};

const LocalizationSection: React.FC<{
  localization: (typeof mockEvaluations)[number]['evaluations'][string]['localization_evaluator'];
}> = ({ localization }) => {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  // Get category scores
  const categoryScores = [
    { 
      key: 'neutral_scenario', 
      label: 'Neutral Scenario', 
      data: localization.neutral_scenario 
    },
    { 
      key: 'sensitivity_guardrails', 
      label: 'Sensitivity Guardrails', 
      data: localization.sensitivity_guardrails 
    },
    { 
      key: 'guardrail_coverage', 
      label: 'Guardrail Coverage', 
      data: localization.guardrail_coverage 
    },
    { 
      key: 'regionalization_rules', 
      label: 'Regionalization Rules', 
      data: localization.regionalization_rules 
    },
  ];

  const getRecommendationColor = (rec: string) => {
    if (rec === 'accept') return 'var(--success)';
    if (rec === 'reject') return 'var(--error)';
    return 'var(--warning)';
  };

  const getPassFailColor = (status: string) => {
    return status === 'PASS' ? 'var(--success)' : 'var(--error)';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Overview */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 2fr)',
          gap: '16px',
        }}
      >
        {/* Left: Overall Score & Recommendation */}
        <div
          style={{
            borderRadius: 10,
            border: '1px solid var(--border)',
            background: 'var(--card-bg-darker)',
            padding: '12px 14px',
          }}
        >
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
            Overall Score
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
            {(localization.overall_score * 100).toFixed(1)}%
          </div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 12px',
              borderRadius: 999,
              background: `${getRecommendationColor(localization.recommendation)}22`,
              border: `1px solid ${getRecommendationColor(localization.recommendation)}`,
              fontSize: 12,
              fontWeight: 600,
              color: getRecommendationColor(localization.recommendation),
              textTransform: 'uppercase',
            }}
          >
            {localization.recommendation === 'accept' ? (
              <CheckCircle2 size={14} />
            ) : (
              <XCircle size={14} />
            )}
            {localization.recommendation}
          </div>
          {localization.risk_notes && (
            <div
              style={{
                marginTop: 12,
                padding: '8px 10px',
                borderRadius: 8,
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'start',
                  gap: 6,
                  fontSize: 11,
                  color: 'var(--error)',
                }}
              >
                <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>{localization.risk_notes}</span>
              </div>
            </div>
          )}
        </div>

        {/* Right: Issues & Strengths summary */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
          }}
        >
          {/* Issues */}
          <div
            style={{
              borderRadius: 10,
              border: '1px solid var(--border)',
              background: 'var(--card-bg-darker)',
              padding: '10px 12px',
            }}
          >
            <SectionSubHeader
              icon={<XCircle size={14} color="var(--error)" />}
              label={`Issues (${localization.issues?.length || 0})`}
            />
            <div
              style={{
                maxHeight: 140,
                overflow: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              {localization.issues && localization.issues.length > 0 ? (
                localization.issues.map((issue: string, idx: number) => (
                  <BadgeLine
                    key={idx}
                    color="var(--error)"
                    background="rgba(239,68,68,0.1)"
                  >
                    {issue}
                  </BadgeLine>
                ))
              ) : (
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                  No issues found
                </div>
              )}
            </div>
          </div>

          {/* Strengths */}
          <div
            style={{
              borderRadius: 10,
              border: '1px solid var(--border)',
              background: 'var(--card-bg-darker)',
              padding: '10px 12px',
            }}
          >
            <SectionSubHeader
              icon={<CheckCircle2 size={14} color="var(--success)" />}
              label={`Strengths (${localization.strengths?.length || 0})`}
            />
            <div
              style={{
                maxHeight: 140,
                overflow: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              {localization.strengths && localization.strengths.length > 0 ? (
                localization.strengths.slice(0, 3).map((strength: string, idx: number) => (
                  <BadgeLine
                    key={idx}
                    color="var(--success)"
                    background="rgba(16,185,129,0.1)"
                  >
                    {strength}
                  </BadgeLine>
                ))
              ) : (
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                  No strengths listed
                </div>
              )}
              {localization.strengths && localization.strengths.length > 3 && (
                <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 4 }}>
                  + {localization.strengths.length - 3} more...
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Category Breakdown */}
      <div
        style={{
          borderRadius: 10,
          border: '1px solid var(--border)',
          background: 'var(--card-bg-darker)',
          padding: '12px',
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10 }}>
          Category Breakdown
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {categoryScores.map(({ key, label, data }) => {
            if (!data) return null;
            const isExpanded = expandedCategories.has(key);
            const passFailColor = getPassFailColor(data.pass_fail);

            return (
              <div
                key={key}
                style={{
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--card-bg-medium)',
                  overflow: 'hidden',
                }}
              >
                {/* Category Header */}
                <div
                  onClick={() => toggleCategory(key)}
                  style={{
                    padding: '10px 12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    transition: 'background 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--card-bg-light)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      Score: <span style={{ fontWeight: 700 }}>{data.score}</span>
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        padding: '3px 10px',
                        borderRadius: 999,
                        background: `${passFailColor}22`,
                        border: `1px solid ${passFailColor}`,
                        color: passFailColor,
                        fontWeight: 600,
                      }}
                    >
                      {data.pass_fail}
                    </span>
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div
                    style={{
                      padding: '12px',
                      borderTop: '1px solid var(--border)',
                      background: 'var(--card-bg-dark)',
                    }}
                  >
                    {/* Reasoning */}
                    {data.reasoning && (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
                          Reasoning
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: 'var(--text-secondary)',
                            lineHeight: 1.5,
                          }}
                        >
                          {data.reasoning}
                        </div>
                      </div>
                    )}

                    {/* Issues */}
                    {data.issues && data.issues.length > 0 && (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4, color: 'var(--error)' }}>
                          Issues ({data.issues.length})
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {data.issues.map((issue: string, idx: number) => (
                            <div
                              key={idx}
                              style={{
                                fontSize: 11,
                                padding: '6px 8px',
                                borderRadius: 6,
                                background: 'rgba(239,68,68,0.1)',
                                borderLeft: '2px solid var(--error)',
                                color: 'var(--text-secondary)',
                              }}
                            >
                              {issue}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Strengths */}
                    {data.strengths && data.strengths.length > 0 && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4, color: 'var(--success)' }}>
                          Strengths ({data.strengths.length})
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {data.strengths.map((strength: string, idx: number) => (
                            <div
                              key={idx}
                              style={{
                                fontSize: 11,
                                padding: '6px 8px',
                                borderRadius: 6,
                                background: 'rgba(16,185,129,0.1)',
                                borderLeft: '2px solid var(--success)',
                                color: 'var(--text-secondary)',
                              }}
                            >
                              {strength}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Rule Breakdown Table */}
      {localization.rule_breakdown && localization.rule_breakdown.length > 0 && (
        <div
          style={{
            borderRadius: 10,
            border: '1px solid var(--border)',
            background: 'var(--card-bg-darker)',
            padding: '12px',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10 }}>
            Detailed Rule Breakdown ({localization.rule_breakdown.length} rules)
          </div>
          <div style={{ maxHeight: 300, overflow: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 11,
              }}
            >
              <thead
                style={{
                  position: 'sticky',
                  top: 0,
                  background: 'var(--card-bg-darker)',
                  zIndex: 1,
                }}
              >
                <tr style={{ textAlign: 'left', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '6px 8px', fontWeight: 600, width: '25%' }}>Rule</th>
                  <th style={{ padding: '6px 8px', fontWeight: 600, width: '15%' }}>Section</th>
                  <th style={{ padding: '6px 8px', fontWeight: 600, width: '10%', textAlign: 'center' }}>
                    Status
                  </th>
                  <th style={{ padding: '6px 8px', fontWeight: 600, width: '8%', textAlign: 'center' }}>
                    Score
                  </th>
                  <th style={{ padding: '6px 8px', fontWeight: 600, width: '42%' }}>Reasoning</th>
                </tr>
              </thead>
              <tbody>
                {localization.rule_breakdown.map((rule: any, idx: number) => (
                  <tr
                    key={idx}
                    style={{
                      borderTop: '1px solid var(--border)',
                    }}
                  >
                    <td
                      style={{
                        padding: '8px',
                        verticalAlign: 'top',
                        fontSize: 10,
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {rule.rule}
                    </td>
                    <td
                      style={{
                        padding: '8px',
                        verticalAlign: 'top',
                        fontSize: 10,
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {rule.section}
                    </td>
                    <td
                      style={{
                        padding: '8px',
                        verticalAlign: 'top',
                        textAlign: 'center',
                      }}
                    >
                      <span
                        style={{
                          fontSize: 10,
                          padding: '3px 8px',
                          borderRadius: 999,
                          background: rule.passed
                            ? 'rgba(16,185,129,0.1)'
                            : 'rgba(239,68,68,0.1)',
                          color: rule.passed ? 'var(--success)' : 'var(--error)',
                          fontWeight: 600,
                        }}
                      >
                        {rule.passed ? 'PASS' : 'FAIL'}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: '8px',
                        verticalAlign: 'top',
                        textAlign: 'center',
                        fontWeight: 700,
                        color: rule.score === 1 ? 'var(--success)' : 'var(--error)',
                      }}
                    >
                      {rule.score}
                    </td>
                    <td
                      style={{
                        padding: '8px',
                        verticalAlign: 'top',
                        fontSize: 10,
                        color: 'var(--text-secondary)',
                        lineHeight: 1.4,
                      }}
                    >
                      {rule.reasoning}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Evaluations;
