import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Eye, Code, MessageSquare, X, ChevronDown, Trash2, Clock } from 'lucide-react';

// Type for evaluation data
type EvaluationData = {
  question_id: number;
  recipe_id: number;
  model_parsed_response: any;
  prompt_text: string;
  evaluator_parsed_response: any;
  evaluator_score: number;
  difficulty: string;
  experiment_tracker: string;
  model: string;
  subject: string;
  grade_level: string;
  question_type: string;
  created_at: string;
  evaluated_at: string;
};

// Type for cached evaluations
type CachedEvaluations = {
  experiment_tracker: string;
  subject: string;
  grade_level: string;
  question_type: string;
  difficulty: string;
  max_score: string;
  timestamp: number;
  // Cached data
  evaluationsData: EvaluationData[];
};

// Cache management functions
const EVAL_CACHE_KEY = 'evaluations_cache';
const MAX_EVAL_CACHE_ITEMS = 10;

const getEvalCacheKey = (filters: { 
  experiment_tracker: string; 
  subject: string; 
  grade_level: string; 
  question_type: string;
  difficulty: string;
  max_score: string;
}) => {
  return `${filters.experiment_tracker}|${filters.subject}|${filters.grade_level}|${filters.question_type}|${filters.difficulty}|${filters.max_score}`;
};

const loadEvalCache = (): CachedEvaluations[] => {
  try {
    const cached = localStorage.getItem(EVAL_CACHE_KEY);
    if (!cached) return [];
    
    const parsed = JSON.parse(cached);
    
    // Validate and filter out invalid cache entries
    return parsed.filter((item: any) => {
      return item.evaluationsData !== undefined && 
             item.experiment_tracker;
    });
  } catch (err) {
    console.error('Failed to load evaluations cache', err);
    return [];
  }
};

const saveToEvalCache = (
  filters: { 
    experiment_tracker: string; 
    subject: string; 
    grade_level: string; 
    question_type: string;
    difficulty: string;
    max_score: string;
  },
  evaluationsData: EvaluationData[]
) => {
  try {
    const cache = loadEvalCache();
    const cacheKey = getEvalCacheKey(filters);
    
    // Remove existing entry with same key
    const filteredCache = cache.filter(item => getEvalCacheKey(item) !== cacheKey);
    
    // Add new entry at the beginning with all data
    const newCache = [
      { 
        ...filters, 
        timestamp: Date.now(),
        evaluationsData,
      },
      ...filteredCache
    ].slice(0, MAX_EVAL_CACHE_ITEMS);
    
    localStorage.setItem(EVAL_CACHE_KEY, JSON.stringify(newCache));
  } catch (err) {
    console.error('Failed to save to evaluations cache', err);
  }
};

const deleteFromEvalCache = (cacheKey: string) => {
  try {
    const cache = loadEvalCache();
    const filteredCache = cache.filter(item => getEvalCacheKey(item) !== cacheKey);
    localStorage.setItem(EVAL_CACHE_KEY, JSON.stringify(filteredCache));
  } catch (err) {
    console.error('Failed to delete from evaluations cache', err);
  }
};

// Component to render evaluation table
const EvaluationTable: React.FC<{ 
  data: EvaluationData[]; 
  setModalContent: (content: { type: 'response' | 'prompt' | 'feedback'; data: any } | null) => void;
}> = ({ data, setModalContent }) => {
  return (
    <div 
      className="custom-scrollbar"
      style={{ 
        maxHeight: '280px', // Approximately 3 rows + header
        overflowY: 'auto',
        overflowX: 'auto',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        background: 'var(--surface)',
      }}>
      <table style={{ 
        width: '100%', 
        borderCollapse: 'collapse',
      }}>
        <thead style={{ 
          position: 'sticky', 
          top: 0, 
          background: 'var(--surface)',
          zIndex: 10,
          boxShadow: '0 1px 0 var(--border)',
        }}>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Recipe ID
            </th>
            <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Question ID
            </th>
            <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Score
            </th>
            <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Difficulty
            </th>
            <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Answer
            </th>
            <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Failed Metrics
            </th>
            <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((item, index) => {
            // Extract answer verification
            const evaluations = item.evaluator_parsed_response?.evaluations || {};
            const questionId = Object.keys(evaluations)[0];
            const evalData = evaluations[questionId] || {};
            const answerVerification = evalData.answer_verification;
            const isCorrect = answerVerification?.is_correct;
            
            // Extract failed quality scores (< 0.85)
            const qualityScores = evalData.ti_question_qa?.scores || {};
            const failedMetrics = Object.entries(qualityScores)
              .filter(([_, score]) => (score as number) < 0.85)
              .map(([key, _]) => key.replace(/_/g, ' '));
            
            // Extract failed image quality scores (< 0.85)
            const imageQualityScores = evalData.image_quality?.scores || {};
            const failedImageMetrics = Object.entries(imageQualityScores)
              .filter(([_, score]) => (score as number) < 0.85)
              .map(([key, _]) => `img: ${key.replace(/_/g, ' ')}`);
            
            // Combine all failed metrics
            const allFailedMetrics = [...failedMetrics, ...failedImageMetrics];

            return (
              <tr
                key={index}
                style={{
                  borderBottom: '1px solid var(--border)',
                  transition: 'background 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--hover-bg)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <td style={{ padding: '12px', fontSize: '13px' }}>{item.recipe_id}</td>
                <td style={{ padding: '12px', fontSize: '13px' }}>{item.question_id}</td>
                <td style={{ padding: '12px', textAlign: 'center', fontSize: '13px', fontWeight: '600', color: item.evaluator_score >= 0.85 ? 'var(--success)' : item.evaluator_score === 0 ? 'var(--error)' : 'var(--warning)' }}>
                  {(item.evaluator_score * 100).toFixed(0)}%
                </td>
                <td style={{ padding: '12px', textAlign: 'center', fontSize: '13px' }}>
                  <span
                    style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      background: item.difficulty === 'Easy' ? 'rgba(16, 185, 129, 0.1)' : item.difficulty === 'Medium' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      color: item.difficulty === 'Easy' ? 'var(--success)' : item.difficulty === 'Medium' ? 'var(--warning)' : 'var(--error)',
                      fontSize: '12px',
                    }}
                  >
                    {item.difficulty}
                  </span>
                </td>
                {/* Answer Verification Column */}
                <td style={{ padding: '12px', textAlign: 'center', fontSize: '13px' }}>
                  {isCorrect !== undefined ? (
                    <span
                      style={{
                        padding: '4px 12px',
                        borderRadius: '4px',
                        background: isCorrect ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        border: `1px solid ${isCorrect ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                        color: isCorrect ? 'var(--success)' : 'var(--error)',
                        fontSize: '11px',
                        fontWeight: '600',
                        textTransform: 'uppercase',
                      }}
                    >
                      {isCorrect ? 'Correct' : 'Incorrect'}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>N/A</span>
                  )}
                </td>
                {/* Failed Metrics Column */}
                <td style={{ padding: '12px', fontSize: '13px' }}>
                  {allFailedMetrics.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {allFailedMetrics.map((metric, idx) => (
                        <span
                          key={idx}
                          style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            color: 'var(--error)',
                            fontSize: '10px',
                            fontWeight: '500',
                            textTransform: 'capitalize',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {metric}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>—</span>
                  )}
                </td>
                {/* Actions */}
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                    <button
                      onClick={() => setModalContent({ type: 'response', data: item.model_parsed_response })}
                      style={{
                        padding: '6px 10px',
                        fontSize: '11px',
                        background: 'var(--primary)',
                        border: 'none',
                        borderRadius: '4px',
                        color: 'white',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.opacity = '0.8';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.opacity = '1';
                      }}
                    >
                      <Code size={12} />
                      Response
                    </button>
                    <button
                      onClick={() => setModalContent({ type: 'prompt', data: item.prompt_text })}
                      style={{
                        padding: '6px 10px',
                        fontSize: '11px',
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: '4px',
                        color: 'var(--text)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--hover-bg)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'var(--surface)';
                      }}
                    >
                      <Eye size={12} />
                      Prompt
                    </button>
                    <button
                      onClick={() => setModalContent({ type: 'feedback', data: item.evaluator_parsed_response })}
                      style={{
                        padding: '6px 10px',
                        fontSize: '11px',
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: '4px',
                        color: 'var(--text)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--hover-bg)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'var(--surface)';
                      }}
                    >
                      <MessageSquare size={12} />
                      Feedback
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// Component to render feedback in a beautiful structured way
const FeedbackRenderer: React.FC<{ data: any }> = ({ data }) => {
  if (!data || typeof data !== 'object') {
    return <div style={{ color: 'var(--text-secondary)' }}>No feedback data available</div>;
  }

  const evaluations = data.evaluations || {};
  const questionId = Object.keys(evaluations)[0];
  const evalData = evaluations[questionId] || {};

  const ScoreCard: React.FC<{ label: string; value: number | string; color?: string }> = ({ label, value, color }) => (
    <div style={{
      padding: '12px 16px',
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: '8px',
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
    }}>
      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}
      </div>
      <div style={{ fontSize: '18px', fontWeight: '700', color: color || 'var(--text)' }}>
        {typeof value === 'number' ? (value * 100).toFixed(1) + '%' : value}
      </div>
    </div>
  );

  const Section: React.FC<{ title: string; children: React.ReactNode; icon?: string }> = ({ title, children, icon }) => (
    <div style={{
      marginBottom: '24px',
      padding: '16px',
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: '12px',
    }}>
      <h3 style={{
        fontSize: '14px',
        fontWeight: '600',
        marginBottom: '12px',
        color: 'var(--text)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        {icon && <span>{icon}</span>}
        {title}
      </h3>
      {children}
    </div>
  );

  const Badge: React.FC<{ text: string; type: 'success' | 'error' | 'warning' | 'info' }> = ({ text, type }) => {
    const colors = {
      success: { bg: 'rgba(16, 185, 129, 0.1)', border: 'rgba(16, 185, 129, 0.3)', text: 'var(--success)' },
      error: { bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.3)', text: 'var(--error)' },
      warning: { bg: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.3)', text: 'var(--warning)' },
      info: { bg: 'rgba(56, 189, 248, 0.1)', border: 'rgba(56, 189, 248, 0.3)', text: 'var(--secondary)' },
    };
    const style = colors[type];
    return (
      <span style={{
        padding: '4px 12px',
        borderRadius: '6px',
        background: style.bg,
        border: `1px solid ${style.border}`,
        color: style.text,
        fontSize: '12px',
        fontWeight: '600',
        textTransform: 'uppercase',
      }}>
        {text}
      </span>
    );
  };

  const ListItem: React.FC<{ text: string; type?: 'success' | 'error' | 'warning' }> = ({ text, type }) => {
    const icon = type === 'success' ? '✓' : type === 'error' ? '✗' : '•';
    const color = type === 'success' ? 'var(--success)' : type === 'error' ? 'var(--error)' : 'var(--warning)';
    return (
      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', fontSize: '13px' }}>
        <span style={{ color, fontWeight: '700', flexShrink: 0 }}>{icon}</span>
        <span style={{ color: 'var(--text)', lineHeight: '1.6' }}>{text}</span>
      </div>
    );
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.9) return 'var(--success)';
    if (score >= 0.8) return 'var(--warning)';
    return 'var(--error)';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Overall Summary */}
      <Section title="📊 Overall Evaluation" icon="">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '16px' }}>
          <ScoreCard label="Overall Score" value={evalData.score || 0} color={getScoreColor(evalData.score || 0)} />
          <ScoreCard label="Recommendation" value={evalData.ti_question_qa?.recommendation?.toUpperCase() || 'N/A'} />
          {evalData.ti_question_qa?.overall && (
            <ScoreCard label="QA Overall" value={evalData.ti_question_qa.overall} color={getScoreColor(evalData.ti_question_qa.overall)} />
          )}
        </div>
        
        {evalData.ti_question_qa?.recommendation && (
          <div style={{ marginTop: '12px' }}>
            <Badge 
              text={evalData.ti_question_qa.recommendation} 
              type={evalData.ti_question_qa.recommendation === 'accept' ? 'success' : 'error'} 
            />
          </div>
        )}
      </Section>

      {/* Scores Breakdown */}
      {evalData.ti_question_qa?.scores && (
        <Section title="📈 Quality Scores" icon="">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            {Object.entries(evalData.ti_question_qa.scores).map(([key, value]: [string, any]) => (
              <div key={key} style={{
                padding: '8px 12px',
                background: 'var(--background)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
              }}>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'capitalize' }}>
                  {key.replace(/_/g, ' ')}
                </div>
                <div style={{ fontSize: '16px', fontWeight: '600', color: getScoreColor(value) }}>
                  {(value * 100).toFixed(0)}%
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Strengths */}
      {evalData.ti_question_qa?.strengths && evalData.ti_question_qa.strengths.length > 0 && (
        <Section title="✅ Strengths" icon="">
          {evalData.ti_question_qa.strengths.map((strength: string, idx: number) => (
            <ListItem key={idx} text={strength} type="success" />
          ))}
        </Section>
      )}

      {/* Issues */}
      {evalData.ti_question_qa?.issues && evalData.ti_question_qa.issues.length > 0 && (
        <Section title="⚠️ Issues" icon="">
          {evalData.ti_question_qa.issues.map((issue: string, idx: number) => (
            <ListItem key={idx} text={issue} type="error" />
          ))}
        </Section>
      )}

      {/* Suggested Improvements */}
      {evalData.ti_question_qa?.suggested_improvements && evalData.ti_question_qa.suggested_improvements.length > 0 && (
        <Section title="💡 Suggested Improvements" icon="">
          {evalData.ti_question_qa.suggested_improvements.map((improvement: string, idx: number) => (
            <ListItem key={idx} text={improvement} type="warning" />
          ))}
        </Section>
      )}

      {/* Answer Verification */}
      {evalData.answer_verification && (
        <Section title="✓ Answer Verification" icon="">
          <div style={{ display: 'grid', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Badge text={evalData.answer_verification.is_correct ? 'CORRECT' : 'INCORRECT'} type={evalData.answer_verification.is_correct ? 'success' : 'error'} />
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                Confidence: {evalData.answer_verification.confidence}/10
              </span>
            </div>
            {evalData.answer_verification.reasoning && (
              <div style={{ padding: '12px', background: 'var(--background)', borderRadius: '6px', fontSize: '13px', lineHeight: '1.6' }}>
                <strong>Reasoning:</strong> {evalData.answer_verification.reasoning}
              </div>
            )}
            {evalData.answer_verification.correct_answer && (
              <div style={{ fontSize: '13px' }}>
                <strong>Correct Answer:</strong> <code style={{ padding: '2px 6px', background: 'var(--surface)', borderRadius: '4px' }}>{evalData.answer_verification.correct_answer}</code>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* Reading Question QC */}
      {evalData.reading_question_qc && (
        <Section title="📝 Reading Question QC" icon="">
          <div style={{ marginBottom: '16px' }}>
            <Badge text={evalData.reading_question_qc.passed ? 'PASSED' : 'FAILED'} type={evalData.reading_question_qc.passed ? 'success' : 'error'} />
            <span style={{ marginLeft: '12px', fontSize: '13px', color: 'var(--text-secondary)' }}>
              Score: {(evalData.reading_question_qc.overall_score * 100).toFixed(0)}%
            </span>
          </div>

          {/* Question Checks */}
          {evalData.reading_question_qc.question_checks && (
            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ fontSize: '12px', fontWeight: '600', marginBottom: '8px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Question Checks</h4>
              {Object.entries(evalData.reading_question_qc.question_checks).map(([key, check]: [string, any]) => (
                <div key={key} style={{ marginBottom: '12px', padding: '12px', background: 'var(--background)', borderRadius: '6px', borderLeft: `3px solid ${check.score === 1 ? 'var(--success)' : 'var(--error)'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <strong style={{ fontSize: '12px', textTransform: 'capitalize' }}>{key.replace(/_/g, ' ')}</strong>
                    <Badge text={check.score === 1 ? 'PASS' : 'FAIL'} type={check.score === 1 ? 'success' : 'error'} />
                  </div>
                  <p style={{ fontSize: '12px', lineHeight: '1.6', color: 'var(--text-secondary)', margin: 0 }}>{check.response}</p>
                </div>
              ))}
            </div>
          )}

          {/* Distractor Checks */}
          {evalData.reading_question_qc.distractor_checks && (
            <div>
              <h4 style={{ fontSize: '12px', fontWeight: '600', marginBottom: '8px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Distractor Checks</h4>
              {Object.entries(evalData.reading_question_qc.distractor_checks).map(([key, check]: [string, any]) => (
                <div key={key} style={{ marginBottom: '12px', padding: '12px', background: 'var(--background)', borderRadius: '6px', borderLeft: `3px solid ${check.score === 1 ? 'var(--success)' : 'var(--error)'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <strong style={{ fontSize: '12px', textTransform: 'capitalize' }}>{key.replace(/_/g, ' ')}</strong>
                    <Badge text={check.score === 1 ? 'PASS' : 'FAIL'} type={check.score === 1 ? 'success' : 'error'} />
                  </div>
                  <p style={{ fontSize: '12px', lineHeight: '1.6', color: 'var(--text-secondary)', margin: 0 }}>{check.response}</p>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* Math Content Evaluator */}
      {evalData.math_content_evaluator && (
        <Section title="🔢 Math Content Evaluation" icon="">
          <div style={{ display: 'grid', gap: '12px', marginBottom: '16px' }}>
            <ScoreCard label="Overall Rating" value={evalData.math_content_evaluator.overall_rating || 'N/A'} />
            <ScoreCard label="Overall Score" value={evalData.math_content_evaluator.overall_score || 0} color={getScoreColor(evalData.math_content_evaluator.overall_score || 0)} />
            <div style={{ padding: '12px', background: 'var(--background)', borderRadius: '6px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Pass/Fail</div>
              <div style={{ fontSize: '16px' }}>
                <span style={{ color: 'var(--success)', fontWeight: '600' }}>{evalData.math_content_evaluator.pass_count || 0} Pass</span>
                {' / '}
                <span style={{ color: 'var(--error)', fontWeight: '600' }}>{evalData.math_content_evaluator.fail_count || 0} Fail</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
            {Object.entries(evalData.math_content_evaluator)
              .filter(([key]) => !['overall_score', 'overall_rating', 'pass_count', 'fail_count'].includes(key))
              .map(([key, value]: [string, any]) => (
                <div key={key} style={{
                  padding: '8px 12px',
                  background: value === 'PASS' ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)',
                  border: `1px solid ${value === 'PASS' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                  borderRadius: '6px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <span style={{ fontSize: '11px', textTransform: 'capitalize' }}>{key.replace(/_/g, ' ')}</span>
                  <Badge text={value as string} type={value === 'PASS' ? 'success' : 'error'} />
                </div>
              ))}
          </div>
        </Section>
      )}

      {/* Localization Evaluator */}
      {evalData.localization_evaluator && (
        <Section title="🌍 Localization Evaluation" icon="">
          <div style={{ marginBottom: '16px' }}>
            <Badge text={evalData.localization_evaluator.recommendation?.toUpperCase() || 'N/A'} type={evalData.localization_evaluator.recommendation === 'accept' ? 'success' : 'error'} />
            <span style={{ marginLeft: '12px', fontSize: '13px', color: 'var(--text-secondary)' }}>
              Score: {(evalData.localization_evaluator.overall_score * 100).toFixed(0)}%
            </span>
          </div>

          {/* Risk Notes */}
          {evalData.localization_evaluator.risk_notes && (
            <div style={{
              marginBottom: '16px',
              padding: '12px',
              background: 'rgba(239, 68, 68, 0.05)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '6px',
            }}>
              <h4 style={{ fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: 'var(--error)' }}>⚠️ Risk Notes</h4>
              <p style={{ fontSize: '12px', lineHeight: '1.6', color: 'var(--text-secondary)', margin: 0 }}>
                {evalData.localization_evaluator.risk_notes}
              </p>
            </div>
          )}

          {/* Issues */}
          {evalData.localization_evaluator.issues && evalData.localization_evaluator.issues.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ fontSize: '12px', fontWeight: '600', marginBottom: '8px', color: 'var(--error)' }}>Issues ({evalData.localization_evaluator.issues.length})</h4>
              {evalData.localization_evaluator.issues.map((issue: string, idx: number) => (
                <ListItem key={idx} text={issue} type="error" />
              ))}
            </div>
          )}

          {/* Strengths */}
          {evalData.localization_evaluator.strengths && evalData.localization_evaluator.strengths.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ fontSize: '12px', fontWeight: '600', marginBottom: '8px', color: 'var(--success)' }}>Strengths ({evalData.localization_evaluator.strengths.length})</h4>
              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {evalData.localization_evaluator.strengths.slice(0, 5).map((strength: string, idx: number) => (
                  <ListItem key={idx} text={strength} type="success" />
                ))}
                {evalData.localization_evaluator.strengths.length > 5 && (
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '8px', paddingLeft: '24px' }}>
                    ... and {evalData.localization_evaluator.strengths.length - 5} more
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Category Breakdown */}
          {(evalData.localization_evaluator.neutral_scenario || 
            evalData.localization_evaluator.sensitivity_guardrails ||
            evalData.localization_evaluator.guardrail_coverage ||
            evalData.localization_evaluator.regionalization_rules) && (
            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ fontSize: '12px', fontWeight: '600', marginBottom: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Category Breakdown</h4>
              <div style={{ display: 'grid', gap: '8px' }}>
                {evalData.localization_evaluator.neutral_scenario && (
                  <div style={{
                    padding: '10px 12px',
                    background: 'var(--background)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <strong style={{ fontSize: '12px' }}>Neutral Scenario</strong>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Score: {evalData.localization_evaluator.neutral_scenario.score}</span>
                        <Badge text={evalData.localization_evaluator.neutral_scenario.pass_fail} type={evalData.localization_evaluator.neutral_scenario.pass_fail === 'PASS' ? 'success' : 'error'} />
                      </div>
                    </div>
                    {evalData.localization_evaluator.neutral_scenario.reasoning && (
                      <p style={{ fontSize: '11px', lineHeight: '1.5', color: 'var(--text-secondary)', margin: 0 }}>
                        {evalData.localization_evaluator.neutral_scenario.reasoning}
                      </p>
                    )}
                  </div>
                )}

                {evalData.localization_evaluator.sensitivity_guardrails && (
                  <div style={{
                    padding: '10px 12px',
                    background: 'var(--background)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <strong style={{ fontSize: '12px' }}>Sensitivity Guardrails</strong>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Score: {evalData.localization_evaluator.sensitivity_guardrails.score}</span>
                        <Badge text={evalData.localization_evaluator.sensitivity_guardrails.pass_fail} type={evalData.localization_evaluator.sensitivity_guardrails.pass_fail === 'PASS' ? 'success' : 'error'} />
                      </div>
                    </div>
                    {evalData.localization_evaluator.sensitivity_guardrails.reasoning && (
                      <p style={{ fontSize: '11px', lineHeight: '1.5', color: 'var(--text-secondary)', margin: 0 }}>
                        {evalData.localization_evaluator.sensitivity_guardrails.reasoning}
                      </p>
                    )}
                  </div>
                )}

                {evalData.localization_evaluator.guardrail_coverage && (
                  <div style={{
                    padding: '10px 12px',
                    background: 'var(--background)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <strong style={{ fontSize: '12px' }}>Guardrail Coverage</strong>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Score: {evalData.localization_evaluator.guardrail_coverage.score}</span>
                        <Badge text={evalData.localization_evaluator.guardrail_coverage.pass_fail} type={evalData.localization_evaluator.guardrail_coverage.pass_fail === 'PASS' ? 'success' : 'error'} />
                      </div>
                    </div>
                    {evalData.localization_evaluator.guardrail_coverage.reasoning && (
                      <p style={{ fontSize: '11px', lineHeight: '1.5', color: 'var(--text-secondary)', margin: 0 }}>
                        {evalData.localization_evaluator.guardrail_coverage.reasoning}
                      </p>
                    )}
                  </div>
                )}

                {evalData.localization_evaluator.regionalization_rules && (
                  <div style={{
                    padding: '10px 12px',
                    background: 'var(--background)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <strong style={{ fontSize: '12px' }}>Regionalization Rules</strong>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Score: {evalData.localization_evaluator.regionalization_rules.score}</span>
                        <Badge text={evalData.localization_evaluator.regionalization_rules.pass_fail} type={evalData.localization_evaluator.regionalization_rules.pass_fail === 'PASS' ? 'success' : 'error'} />
                      </div>
                    </div>
                    {evalData.localization_evaluator.regionalization_rules.reasoning && (
                      <p style={{ fontSize: '11px', lineHeight: '1.5', color: 'var(--text-secondary)', margin: 0 }}>
                        {evalData.localization_evaluator.regionalization_rules.reasoning}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Rule Breakdown Table */}
          {evalData.localization_evaluator.rule_breakdown && evalData.localization_evaluator.rule_breakdown.length > 0 && (
            <div>
              <h4 style={{ fontSize: '12px', fontWeight: '600', marginBottom: '8px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Detailed Rule Breakdown ({evalData.localization_evaluator.rule_breakdown.length} rules)
              </h4>
              <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '6px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                  <thead style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '8px', fontWeight: 600 }}>Rule</th>
                      <th style={{ padding: '8px', fontWeight: 600 }}>Section</th>
                      <th style={{ padding: '8px', fontWeight: 600, textAlign: 'center' }}>Status</th>
                      <th style={{ padding: '8px', fontWeight: 600, textAlign: 'center' }}>Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evalData.localization_evaluator.rule_breakdown.map((rule: any, idx: number) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px', fontSize: '10px', color: 'var(--text-secondary)' }}>
                          {rule.rule}
                        </td>
                        <td style={{ padding: '8px', fontSize: '10px', color: 'var(--text-secondary)' }}>
                          {rule.section}
                        </td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>
                          <span style={{
                            fontSize: '9px',
                            padding: '3px 8px',
                            borderRadius: '999px',
                            background: rule.passed ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                            color: rule.passed ? 'var(--success)' : 'var(--error)',
                            fontWeight: 600,
                          }}>
                            {rule.passed ? 'PASS' : 'FAIL'}
                          </span>
                        </td>
                        <td style={{ padding: '8px', textAlign: 'center', fontWeight: 700, color: rule.score === 1 ? 'var(--success)' : 'var(--error)' }}>
                          {rule.score}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Section>
      )}

      {/* Metadata */}
      <div style={{
        padding: '12px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        fontSize: '11px',
        color: 'var(--text-secondary)',
        display: 'flex',
        gap: '16px',
        flexWrap: 'wrap',
      }}>
        {data.request_id && <div><strong>Request ID:</strong> {data.request_id}</div>}
        {data.inceptbench_version && <div><strong>Version:</strong> {data.inceptbench_version}</div>}
        {data.evaluation_time_seconds && <div><strong>Evaluation Time:</strong> {data.evaluation_time_seconds.toFixed(2)}s</div>}
      </div>
    </div>
  );
};

const LookAtData: React.FC = () => {
  const [searchParams] = useSearchParams();
  
  // Evaluations section state
  const [evaluations, setEvaluations] = useState<EvaluationData[]>([]);
  const [evaluationsLoading, setEvaluationsLoading] = useState(false);
  const [evaluationsError, setEvaluationsError] = useState<string | null>(null);
  const [evalExperimentTracker, setEvalExperimentTracker] = useState<string>('');
  const [evalDifficulty, setEvalDifficulty] = useState<string>('');
  const [evalMaxScore, setEvalMaxScore] = useState<string>('0.85');
  const [showEvaluations, setShowEvaluations] = useState(false);
  const [selectedEvaluation, setSelectedEvaluation] = useState<EvaluationData | null>(null);

  // Three section view state
  const [selectedSection, setSelectedSection] = useState<'zero' | 'below' | 'passed'>('zero');
  
  // Modal state
  const [modalContent, setModalContent] = useState<{ type: 'response' | 'prompt' | 'feedback'; data: any } | null>(null);

  // Get current filters from URL/context - simplified for standalone page
  const [selectedSubject, setSelectedSubject] = useState<string>('math');
  const [gradeLevel, setGradeLevel] = useState<string>('');
  const [questionType, setQuestionType] = useState<string>('');

  // Cache state
  const [cachedEvaluations, setCachedEvaluations] = useState<CachedEvaluations[]>([]);
  const [showCacheDropdown, setShowCacheDropdown] = useState(false);
  const cacheDropdownRef = useRef<HTMLDivElement>(null);
  const loadingFromCacheRef = useRef(false);

  // Load cache on mount
  useEffect(() => {
    const cachedData = loadEvalCache();
    console.log('[Eval Cache] Loaded cache on mount:', cachedData.length, 'entries');
    setCachedEvaluations(cachedData);
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
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showCacheDropdown]);

  // Load URL parameters on mount
  useEffect(() => {
    const experimentTracker = searchParams.get('experiment_tracker');
    const subject = searchParams.get('subject');
    
    if (experimentTracker) {
      setEvalExperimentTracker(experimentTracker);
    }
    
    if (subject) {
      setSelectedSubject(subject);
    }
  }, [searchParams]);

  const fetchEvaluations = async () => {
    if (!evalExperimentTracker) {
      setEvaluationsError('Please enter an experiment tracker');
      return;
    }

    setEvaluationsLoading(true);
    setEvaluationsError(null);
    setShowEvaluations(false);

    try {
      const params = new URLSearchParams({
        experiment_tracker: evalExperimentTracker,
        subject: selectedSubject,
        ...(evalDifficulty && { difficulty: evalDifficulty }),
        ...(evalMaxScore && { max_score: evalMaxScore }),
        ...(gradeLevel && { grade_level: gradeLevel }),
        ...(questionType && { question_type: questionType }),
      });

      const response = await fetch(`/api/evaluations?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || '';

      if (!contentType.includes('application/json')) {
        throw new Error('Expected JSON response from API');
      }

      const data = await response.json();
      console.log('[Evaluations] Fetched data:', data);
      
      setEvaluations(data ?? []);
      setShowEvaluations(true);

      // Save to cache
      if (!loadingFromCacheRef.current) {
        const filters = {
          experiment_tracker: evalExperimentTracker,
          subject: selectedSubject,
          grade_level: gradeLevel || '',
          question_type: questionType || '',
          difficulty: evalDifficulty || '',
          max_score: evalMaxScore || '0.85',
        };
        saveToEvalCache(filters, data ?? []);
        setCachedEvaluations(loadEvalCache());
      }
    } catch (err: any) {
      console.error('Failed to fetch evaluations', err);
      setEvaluationsError('Failed to fetch evaluations. Please try again later.');
      setEvaluations([]);
    } finally {
      setEvaluationsLoading(false);
      loadingFromCacheRef.current = false;
    }
  };

  const loadFromCache = (cached: CachedEvaluations) => {
    console.log('[Eval Cache] Loading from cache:', cached);
    loadingFromCacheRef.current = true;
    
    setEvalExperimentTracker(cached.experiment_tracker);
    setSelectedSubject(cached.subject);
    setGradeLevel(cached.grade_level);
    setQuestionType(cached.question_type);
    setEvalDifficulty(cached.difficulty);
    setEvalMaxScore(cached.max_score);
    
    setEvaluations(cached.evaluationsData);
    setShowEvaluations(true);
    setShowCacheDropdown(false);
    loadingFromCacheRef.current = false;
  };

  const handleDeleteCache = (cacheKey: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteFromEvalCache(cacheKey);
    setCachedEvaluations(loadEvalCache());
  };

  return (
    <div style={{ 
      padding: '32px',
      maxWidth: '1800px',
      margin: '0 auto',
    }}>
      {/* Page Header */}
      <div className="animate-fade-in" style={{ marginBottom: '32px' }}>
        <h1 style={{
          fontSize: '28px',
          fontWeight: '700',
          color: 'var(--text)',
          marginBottom: '8px',
        }}>
          Data
        </h1>
        <p style={{
          fontSize: '14px',
          color: 'var(--text-secondary)',
          marginBottom: '16px',
        }}>
          Study failed evaluations for a specific experiment. Analyze questions that didn't meet the threshold, track 0-score data points, and understand why samples failed.
        </p>
        <div style={{
          fontSize: '13px',
          color: 'var(--warning)',
          background: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: '8px',
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}>
          <div><strong>Focus on Failures:</strong> This section helps you dig into questions that scored below the threshold (≤0.85) to identify patterns and improve quality.</div>
          <div style={{ fontSize: '12px', opacity: 0.9 }}>
            • Click any evaluation to see the full prompt, question, and evaluator feedback
          </div>
          <div style={{ fontSize: '12px', opacity: 0.9 }}>
            • Zero-score questions are highlighted in red to help identify critical failures
          </div>
        </div>
      </div>

      {/* Evaluation Filters */}
      <div style={{
        padding: '20px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        display: 'flex',
        gap: '16px',
        alignItems: 'flex-end',
        flexWrap: 'wrap',
        marginBottom: '24px',
      }}>
        {/* Experiment Tracker */}
        <div style={{ minWidth: '200px', flex: 1 }}>
          <label style={{
            display: 'block',
            fontSize: '12px',
            fontWeight: '600',
            color: 'var(--text-secondary)',
            marginBottom: '8px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            Experiment Tracker*
          </label>
          <input
            type="text"
            value={evalExperimentTracker}
            onChange={(e) => setEvalExperimentTracker(e.target.value)}
            placeholder="e.g., gpt-oss-120b-ft-1-5-k-fair-rag"
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

        {/* Subject Filter */}
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
            Subject
          </label>
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
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
            <option value="math">Math</option>
            <option value="ela">ELA</option>
          </select>
        </div>

        {/* Grade Level Filter */}
        <div style={{ minWidth: '120px' }}>
          <label style={{
            display: 'block',
            fontSize: '12px',
            fontWeight: '600',
            color: 'var(--text-secondary)',
            marginBottom: '8px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            Grade
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
            Type
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

        {/* Difficulty Filter */}
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
            Difficulty
          </label>
          <select
            value={evalDifficulty}
            onChange={(e) => setEvalDifficulty(e.target.value)}
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
            <option value="">All Difficulties</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>

        {/* Max Score Threshold */}
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
            Max Score Threshold
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            max="1"
            value={evalMaxScore}
            onChange={(e) => setEvalMaxScore(e.target.value)}
            placeholder="e.g., 0.85"
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

        {/* Fetch Button */}
        <button
          onClick={fetchEvaluations}
          disabled={evaluationsLoading}
          style={{
            padding: '8px 24px',
            fontSize: '14px',
            fontWeight: '600',
            background: 'var(--primary)',
            border: 'none',
            borderRadius: '6px',
            color: 'white',
            cursor: evaluationsLoading ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
            opacity: evaluationsLoading ? 0.6 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
          onMouseEnter={(e) => {
            if (!evaluationsLoading) {
              e.currentTarget.style.opacity = '0.9';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '1';
          }}
        >
          <Search size={16} />
          {evaluationsLoading ? 'Fetching...' : 'Fetch Evaluations'}
        </button>
      </div>

      {/* Cache Dropdown - Always Visible */}
      {cachedEvaluations.length > 0 && (
        <div ref={cacheDropdownRef} style={{ position: 'relative', marginBottom: '24px' }}>
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
              Load from {cachedEvaluations.length} cached evaluation{cachedEvaluations.length !== 1 ? 's' : ''}
            </span>
            <ChevronDown size={16} style={{
              transform: showCacheDropdown ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
              color: 'var(--primary)',
            }} />
          </button>

          {showCacheDropdown && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              marginTop: '4px',
              zIndex: 1000,
              maxHeight: '400px',
              overflowY: 'auto',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                  Recent Evaluations
                </div>
              </div>
              {cachedEvaluations.map((cached, index) => {
                const cacheKey = getEvalCacheKey(cached);
                const timeDiff = Date.now() - cached.timestamp;
                const minutesAgo = Math.floor(timeDiff / 60000);
                const hoursAgo = Math.floor(timeDiff / 3600000);
                const timeAgo = hoursAgo > 0 
                  ? `${hoursAgo}h ago` 
                  : minutesAgo > 0 
                    ? `${minutesAgo}m ago` 
                    : 'Just now';
                
                return (
                  <div
                    key={index}
                    onClick={() => loadFromCache(cached)}
                    style={{
                      padding: '12px 16px',
                      borderBottom: index < cachedEvaluations.length - 1 ? '1px solid var(--border)' : 'none',
                      cursor: 'pointer',
                      transition: 'background 0.2s ease',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: '12px',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--hover-bg)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ 
                        fontSize: '13px', 
                        fontWeight: '600', 
                        marginBottom: '4px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {cached.experiment_tracker}
                      </div>
                      <div style={{ 
                        fontSize: '11px', 
                        color: 'var(--text-secondary)',
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '8px',
                      }}>
                        <span>{cached.subject}</span>
                        {cached.grade_level && <span>• {cached.grade_level}</span>}
                        {cached.question_type && <span>• {cached.question_type}</span>}
                        {cached.difficulty && <span>• {cached.difficulty}</span>}
                        <span>• {cached.evaluationsData.length} results</span>
                        <span>• {timeAgo}</span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleDeleteCache(cacheKey, e)}
                      style={{
                        padding: '4px',
                        background: 'transparent',
                        border: '1px solid var(--border)',
                        borderRadius: '4px',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        flexShrink: 0,
                      }}
                      onMouseEnter={(e) => {
                        e.stopPropagation();
                        e.currentTarget.style.background = 'var(--error)';
                        e.currentTarget.style.borderColor = 'var(--error)';
                        e.currentTarget.style.color = 'white';
                      }}
                      onMouseLeave={(e) => {
                        e.stopPropagation();
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.borderColor = 'var(--border)';
                        e.currentTarget.style.color = 'var(--text-secondary)';
                      }}
                      title="Delete from cache"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Loading State */}
      {evaluationsLoading && (
        <div style={{
          textAlign: 'center',
          padding: '48px',
          color: 'var(--text-secondary)',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
        }}>
          Loading evaluations...
        </div>
      )}

      {/* Error State */}
      {evaluationsError && (
        <div style={{
          padding: '16px',
          marginBottom: '24px',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '8px',
          color: 'var(--error)',
        }}>
          {evaluationsError}
        </div>
      )}

      {/* Evaluations Display with Three Sections */}
      {showEvaluations && !evaluationsLoading && (
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '20px',
        }}>
          {evaluations.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '48px',
              color: 'var(--text-secondary)',
            }}>
              No evaluations found matching the criteria.
            </div>
          ) : !evalDifficulty ? (
            // Split by difficulty when no difficulty filter is selected
            <>
              <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>
                Evaluation Results (Grouped by Difficulty)
              </h2>
              {['easy', 'medium', 'hard'].map((difficulty) => {
                const difficultyData = evaluations.filter(e => 
                  e.difficulty?.toLowerCase() === difficulty
                );

                if (difficultyData.length === 0) return null;

                return (
                  <div key={difficulty} style={{
                    marginBottom: '32px',
                    padding: '16px',
                    background: 'var(--background)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <h3 style={{
                        fontSize: '14px',
                        fontWeight: '600',
                        textTransform: 'capitalize',
                        color: difficulty === 'easy' ? 'var(--success)' : difficulty === 'medium' ? 'var(--warning)' : 'var(--error)',
                      }}>
                        {difficulty} ({difficultyData.length} evaluations)
                      </h3>
                    </div>

                    {/* Section Tabs for this difficulty */}
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', borderBottom: '1px solid var(--border)' }}>
                      {[
                        { 
                          id: 'zero' as const, 
                          label: 'Zero', 
                          color: 'var(--error)', 
                          count: difficultyData.filter(e => e.evaluator_score === 0).length 
                        },
                        { 
                          id: 'below' as const, 
                          label: 'Below', 
                          color: 'var(--warning)', 
                          count: difficultyData.filter(e => e.evaluator_score > 0 && e.evaluator_score < 0.85).length 
                        },
                        { 
                          id: 'passed' as const, 
                          label: 'Passed', 
                          color: 'var(--success)', 
                          count: difficultyData.filter(e => e.evaluator_score >= 0.85).length 
                        },
                      ].map((section) => (
                        <button
                          key={`${difficulty}-${section.id}`}
                          onClick={() => setSelectedSection(section.id)}
                          style={{
                            padding: '8px 16px',
                            background: 'transparent',
                            border: 'none',
                            borderBottom: selectedSection === section.id ? `2px solid ${section.color}` : '2px solid transparent',
                            color: selectedSection === section.id ? section.color : 'var(--text-secondary)',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                          }}
                          onMouseEnter={(e) => {
                            if (selectedSection !== section.id) {
                              e.currentTarget.style.color = 'var(--text)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (selectedSection !== section.id) {
                              e.currentTarget.style.color = 'var(--text-secondary)';
                            }
                          }}
                        >
                          {section.label} ({section.count})
                        </button>
                      ))}
                    </div>

                    {/* Data Table for this difficulty and section */}
                    {(() => {
                      const filteredData = difficultyData
                        .filter((item) => {
                          if (selectedSection === 'zero') return item.evaluator_score === 0;
                          if (selectedSection === 'below') return item.evaluator_score > 0 && item.evaluator_score < 0.85;
                          return item.evaluator_score >= 0.85;
                        })
                        .sort((a, b) => a.question_id - b.question_id);

                      if (filteredData.length === 0) {
                        return (
                          <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-secondary)', fontSize: '12px' }}>
                            No evaluations in this section
                          </div>
                        );
                      }

                      // Calculate tag aggregations for this specific section
                      const tagCounts: Record<string, number> = {};
                      filteredData.forEach(item => {
                        if (item.evaluator_score < 0.85) {
                          const evaluationData = item.evaluator_parsed_response?.evaluations || {};
                          const questionId = Object.keys(evaluationData)[0];
                          const evalData = evaluationData[questionId] || {};
                          const qualityScores = evalData.ti_question_qa?.scores || {};
                          
                          // Add ti_question_qa scores
                          Object.entries(qualityScores).forEach(([key, score]) => {
                            if ((score as number) < 0.85) {
                              const metricName = key.replace(/_/g, ' ');
                              tagCounts[metricName] = (tagCounts[metricName] || 0) + 1;
                            }
                          });
                          
                          // Add image quality scores
                          const imageQualityScores = evalData.image_quality?.scores || {};
                          Object.entries(imageQualityScores).forEach(([key, score]) => {
                            if ((score as number) < 0.85) {
                              const metricName = `img: ${key.replace(/_/g, ' ')}`;
                              tagCounts[metricName] = (tagCounts[metricName] || 0) + 1;
                            }
                          });
                        }
                      });

                      const sortedTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);

                      return (
                        <>
                          {/* Tag Aggregation for this section */}
                          {sortedTags.length > 0 && (
                            <div style={{ 
                              marginBottom: '16px', 
                              padding: '12px', 
                              background: 'rgba(239, 68, 68, 0.05)',
                              border: '1px solid rgba(239, 68, 68, 0.2)',
                              borderRadius: '8px',
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: '8px',
                              alignItems: 'center',
                            }}>
                              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase' }}>
                                Failed Metrics in {selectedSection === 'zero' ? 'Zero Scores' : selectedSection === 'below' ? 'Below Threshold' : 'Passed'}:
                              </span>
                              {sortedTags.slice(0, 8).map(([metric, count], idx) => (
                                <span
                                  key={idx}
                                  style={{
                                    padding: '4px 12px',
                                    borderRadius: '12px',
                                    background: 'rgba(239, 68, 68, 0.15)',
                                    border: '1px solid rgba(239, 68, 68, 0.4)',
                                    color: 'var(--error)',
                                    fontSize: '11px',
                                    fontWeight: '600',
                                    textTransform: 'capitalize',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {metric} ({count})
                                </span>
                              ))}
                              {sortedTags.length > 8 && (
                                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>
                                  +{sortedTags.length - 8} more
                                </span>
                              )}
                            </div>
                          )}
                          <EvaluationTable data={filteredData} setModalContent={setModalContent} />
                        </>
                      );
                    })()}
                  </div>
                );
              })}
            </>
          ) : (
            // Original view when difficulty filter is selected
            <>
              <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>
                Evaluation Results
              </h2>

              {/* Section Tabs */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid var(--border)' }}>
                {[
                  { 
                    id: 'zero' as const, 
                    label: 'Zero Scores', 
                    color: 'var(--error)', 
                    count: evaluations.filter(e => e.evaluator_score === 0).length 
                  },
                  { 
                    id: 'below' as const, 
                    label: 'Below Threshold', 
                    color: 'var(--warning)', 
                    count: evaluations.filter(e => e.evaluator_score > 0 && e.evaluator_score < 0.85).length 
                  },
                  { 
                    id: 'passed' as const, 
                    label: 'Passed', 
                    color: 'var(--success)', 
                    count: evaluations.filter(e => e.evaluator_score >= 0.85).length 
                  },
                ].map((section) => (
                  <button
                    key={section.id}
                    onClick={() => setSelectedSection(section.id)}
                    style={{
                      padding: '12px 24px',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: selectedSection === section.id ? `2px solid ${section.color}` : '2px solid transparent',
                      color: selectedSection === section.id ? section.color : 'var(--text-secondary)',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (selectedSection !== section.id) {
                        e.currentTarget.style.color = 'var(--text)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedSection !== section.id) {
                        e.currentTarget.style.color = 'var(--text-secondary)';
                      }
                    }}
                  >
                    {section.label} ({section.count})
                  </button>
                ))}
              </div>

              {/* Data Table */}
              {(() => {
                const filteredData = evaluations
                  .filter((item) => {
                    if (selectedSection === 'zero') return item.evaluator_score === 0;
                    if (selectedSection === 'below') return item.evaluator_score > 0 && item.evaluator_score < 0.85;
                    return item.evaluator_score >= 0.85;
                  })
                  .sort((a, b) => a.question_id - b.question_id); // Sort by question_id ascending

                if (filteredData.length === 0) {
                  return (
                    <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
                      No evaluations in this section
                    </div>
                  );
                }

                // Calculate tag aggregations for this specific section
                const tagCounts: Record<string, number> = {};
                filteredData.forEach(item => {
                  if (item.evaluator_score < 0.85) {
                    const evaluationData = item.evaluator_parsed_response?.evaluations || {};
                    const questionId = Object.keys(evaluationData)[0];
                    const evalData = evaluationData[questionId] || {};
                    const qualityScores = evalData.ti_question_qa?.scores || {};
                    
                    // Add ti_question_qa scores
                    Object.entries(qualityScores).forEach(([key, score]) => {
                      if ((score as number) < 0.85) {
                        const metricName = key.replace(/_/g, ' ');
                        tagCounts[metricName] = (tagCounts[metricName] || 0) + 1;
                      }
                    });
                    
                    // Add image quality scores
                    const imageQualityScores = evalData.image_quality?.scores || {};
                    Object.entries(imageQualityScores).forEach(([key, score]) => {
                      if ((score as number) < 0.85) {
                        const metricName = `img: ${key.replace(/_/g, ' ')}`;
                        tagCounts[metricName] = (tagCounts[metricName] || 0) + 1;
                      }
                    });
                  }
                });

                const sortedTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);

                return (
                  <>
                    {/* Tag Aggregation for this section */}
                    {sortedTags.length > 0 && (
                      <div style={{ 
                        marginBottom: '16px', 
                        padding: '12px', 
                        background: 'rgba(239, 68, 68, 0.05)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        borderRadius: '8px',
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '8px',
                        alignItems: 'center',
                      }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase' }}>
                          Failed Metrics in {selectedSection === 'zero' ? 'Zero Scores' : selectedSection === 'below' ? 'Below Threshold' : 'Passed'}:
                        </span>
                        {sortedTags.slice(0, 8).map(([metric, count], idx) => (
                          <span
                            key={idx}
                            style={{
                              padding: '4px 12px',
                              borderRadius: '12px',
                              background: 'rgba(239, 68, 68, 0.15)',
                              border: '1px solid rgba(239, 68, 68, 0.4)',
                              color: 'var(--error)',
                              fontSize: '11px',
                              fontWeight: '600',
                              textTransform: 'capitalize',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {metric} ({count})
                          </span>
                        ))}
                        {sortedTags.length > 8 && (
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>
                            +{sortedTags.length - 8} more
                          </span>
                        )}
                      </div>
                    )}
                    <EvaluationTable data={filteredData} setModalContent={setModalContent} />
                    <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center' }}>
                      Showing {filteredData.length} evaluation{filteredData.length !== 1 ? 's' : ''}
                    </div>
                  </>
                );
              })()}
            </>
          )}
        </div>
      )}

      {/* Modal for Detailed View */}
      {modalContent && (
        <div
          onClick={() => setModalContent(null)}
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
              maxWidth: '900px',
              width: '100%',
              maxHeight: '90vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '20px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h3 style={{ fontSize: '18px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                {modalContent.type === 'response' && (
                  <>
                    <Eye size={20} color="var(--primary)" />
                    Model Parsed Response
                  </>
                )}
                {modalContent.type === 'prompt' && (
                  <>
                    <Code size={20} color="var(--secondary)" />
                    Prompt Text
                  </>
                )}
                {modalContent.type === 'feedback' && (
                  <>
                    <MessageSquare size={20} color="var(--success)" />
                    Evaluator Feedback
                  </>
                )}
              </h3>
              <button
                onClick={() => setModalContent(null)}
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

            {/* Modal Content */}
            <div
              style={{
                padding: '20px',
                overflow: 'auto',
                flex: 1,
              }}
            >
              {modalContent.type === 'feedback' ? (
                <FeedbackRenderer data={modalContent.data} />
              ) : (
                <pre
                  style={{
                    background: 'var(--background)',
                    padding: '16px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    lineHeight: '1.6',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    color: 'var(--text)',
                    border: '1px solid var(--border)',
                  }}
                >
                  {typeof modalContent.data === 'string' 
                    ? modalContent.data 
                    : JSON.stringify(modalContent.data, null, 2)}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Evaluation Detail Modal */}
      {selectedEvaluation && (
        <EvaluationModal 
          evaluation={selectedEvaluation}
          onClose={() => setSelectedEvaluation(null)}
        />
      )}
    </div>
  );
};

// Modal component for detailed evaluation view
const EvaluationModal: React.FC<{ evaluation: EvaluationData; onClose: () => void }> = ({ evaluation, onClose }) => {
  // Parse the JSON responses
  const question = evaluation.model_parsed_response || {};
  const evalData = evaluation.evaluator_parsed_response?.evaluations || {};
  const questionId = question.id || evaluation.question_id;
  const evalDetails = evalData[questionId] || evalData[Object.keys(evalData)[0]] || {};

  // Extract question details
  const questionText = question.question || 'N/A';
  const questionType = question.type || evaluation.question_type || 'N/A';
  const difficulty = question.difficulty || evaluation.difficulty || 'N/A';
  const answer = question.answer || 'N/A';
  const answerOptions = question.answer_options || {};
  const answerExplanation = question.answer_explanation || '';
  const promptText = evaluation.prompt_text || '';

  // Extract evaluation details
  const overallScore = evaluation.evaluator_score;
  const recommendation = evalDetails.ti_question_qa?.recommendation || 'N/A';
  const strengths = evalDetails.ti_question_qa?.strengths || [];
  const issues = evalDetails.ti_question_qa?.issues || [];
  const suggestedImprovements = evalDetails.ti_question_qa?.suggested_improvements || [];

  const getScoreColor = (score: number) => {
    if (score === 0) return 'var(--error)';
    if (score >= 0.9) return 'var(--success)';
    if (score >= 0.85) return 'var(--warning)';
    return 'var(--error)';
  };

  return (
    <div
      onClick={onClose}
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
        overflowY: 'auto',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          borderRadius: '16px',
          border: '1px solid var(--border)',
          maxWidth: '1200px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* Modal Header */}
        <div style={{
          position: 'sticky',
          top: 0,
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          padding: '20px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 10,
        }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '4px' }}>
              Question Analysis
            </h3>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              {questionType.toUpperCase()} • {difficulty} • Score: {(overallScore * 100).toFixed(1)}%
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              color: 'var(--text)',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--hover-bg)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            Close
          </button>
        </div>

        {/* Modal Content */}
        <div style={{ padding: '24px' }}>
          {/* Score Banner */}
          <div style={{
            padding: '16px',
            background: `${getScoreColor(overallScore)}15`,
            border: `1px solid ${getScoreColor(overallScore)}`,
            borderRadius: '8px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>
                Evaluation Score
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Recommendation: {recommendation}
              </div>
            </div>
            <div style={{
              fontSize: '32px',
              fontWeight: '700',
              color: getScoreColor(overallScore),
            }}>
              {(overallScore * 100).toFixed(1)}%
            </div>
          </div>

          {/* Prompt Text */}
          {promptText && (
            <div style={{ marginBottom: '24px' }}>
              <h4 style={{
                fontSize: '14px',
                fontWeight: '600',
                color: 'var(--text)',
                marginBottom: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}>
                Prompt
              </h4>
              <div style={{
                fontSize: '13px',
                lineHeight: '1.6',
                color: 'var(--text-secondary)',
                padding: '16px',
                background: 'var(--background)',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                fontFamily: 'monospace',
                whiteSpace: 'pre-wrap',
                maxHeight: '200px',
                overflow: 'auto',
              }}>
                {promptText}
              </div>
            </div>
          )}

          {/* Question */}
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{
              fontSize: '14px',
              fontWeight: '600',
              color: 'var(--text)',
              marginBottom: '12px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
              Generated Question
            </h4>
            <div style={{
              fontSize: '15px',
              lineHeight: '1.6',
              color: 'var(--text)',
              marginBottom: '16px',
              padding: '16px',
              background: 'rgba(255, 255, 255, 0.02)',
              borderRadius: '8px',
              border: '1px solid var(--border)',
            }}>
              {questionText}
            </div>

            {/* Answer Options */}
            {Object.keys(answerOptions).length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{
                  fontSize: '12px',
                  fontWeight: '600',
                  color: 'var(--text-secondary)',
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}>
                  Options
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                  gap: '8px',
                }}>
                  {Object.entries(answerOptions).map(([key, value]) => (
                    <div
                      key={key}
                      style={{
                        padding: '12px',
                        background: key === answer ? 'rgba(46, 213, 115, 0.1)' : 'rgba(255, 255, 255, 0.02)',
                        border: `1px solid ${key === answer ? 'var(--success)' : 'var(--border)'}`,
                        borderRadius: '6px',
                        fontSize: '13px',
                        color: 'var(--text)',
                      }}
                    >
                      <span style={{ fontWeight: '600', marginRight: '8px' }}>{key}.</span>
                      {String(value)}
                    </div>
                  ))}
                </div>
                <div style={{
                  marginTop: '8px',
                  fontSize: '12px',
                  color: 'var(--success)',
                  fontWeight: '600',
                }}>
                  Correct Answer: {answer}
                </div>
              </div>
            )}

            {/* Answer Explanation */}
            {answerExplanation && (
              <div style={{ marginTop: '16px' }}>
                <div style={{
                  fontSize: '12px',
                  fontWeight: '600',
                  color: 'var(--text-secondary)',
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}>
                  Explanation
                </div>
                <div style={{
                  fontSize: '14px',
                  lineHeight: '1.6',
                  color: 'var(--text-secondary)',
                  padding: '16px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                }}>
                  {answerExplanation}
                </div>
              </div>
            )}
          </div>

          {/* Evaluation Feedback */}
          <div>
            <h4 style={{
              fontSize: '14px',
              fontWeight: '600',
              color: 'var(--text)',
              marginBottom: '16px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
              Evaluator Feedback
            </h4>

            {/* Issues */}
            {issues.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{
                  fontSize: '13px',
                  fontWeight: '600',
                  color: 'var(--error)',
                  marginBottom: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}>
                  <span>✗</span> Issues Found ({issues.length})
                </div>
                <ul style={{
                  margin: 0,
                  paddingLeft: '20px',
                  fontSize: '13px',
                  lineHeight: '1.8',
                  color: 'var(--text)',
                }}>
                  {issues.map((issue: string, idx: number) => (
                    <li key={idx} style={{ marginBottom: '6px' }}>{issue}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Suggested Improvements */}
            {suggestedImprovements.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{
                  fontSize: '13px',
                  fontWeight: '600',
                  color: 'var(--warning)',
                  marginBottom: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}>
                  <span>→</span> Suggested Improvements ({suggestedImprovements.length})
                </div>
                <ul style={{
                  margin: 0,
                  paddingLeft: '20px',
                  fontSize: '13px',
                  lineHeight: '1.8',
                  color: 'var(--text)',
                }}>
                  {suggestedImprovements.map((improvement: string, idx: number) => (
                    <li key={idx} style={{ marginBottom: '6px' }}>{improvement}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Strengths */}
            {strengths.length > 0 && (
              <div>
                <div style={{
                  fontSize: '13px',
                  fontWeight: '600',
                  color: 'var(--success)',
                  marginBottom: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}>
                  <span>✓</span> Strengths ({strengths.length})
                </div>
                <ul style={{
                  margin: 0,
                  paddingLeft: '20px',
                  fontSize: '13px',
                  lineHeight: '1.8',
                  color: 'var(--text)',
                }}>
                  {strengths.map((strength: string, idx: number) => (
                    <li key={idx} style={{ marginBottom: '6px' }}>{strength}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Component to display individual evaluation (collapsed)
export default LookAtData;

