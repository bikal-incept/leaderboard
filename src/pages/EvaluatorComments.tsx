import React, { useState } from 'react';
import { MessageSquare, ThumbsUp, ThumbsDown, Filter, Search } from 'lucide-react';
import { mockEvaluations } from '../data/mockEvaluations';

const EvaluatorComments: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [pendingCategory, setPendingCategory] = useState<string>('all');

  const categories = [
    { id: 'all', label: 'All Comments' },
    { id: 'question', label: 'Question Quality' },
    { id: 'distractor', label: 'Distractor Analysis' },
    { id: 'alignment', label: 'Standard Alignment' },
  ];

  // Extract all comments from evaluations
  const extractComments = () => {
    const comments: Array<{
      category: string;
      type: string;
      content: string;
      score: number;
    }> = [];

    mockEvaluations.forEach((evaluation) => {
      const evalKey = Object.keys(evaluation.evaluations)[0];
      const evalData = evaluation.evaluations[evalKey];

      // Question checks
      Object.entries(evalData.reading_question_qc.question_checks).forEach(([key, check]) => {
        comments.push({
          category: 'question',
          type: key.replace(/_/g, ' '),
          content: check.response,
          score: check.score,
        });
      });

      // Distractor checks
      Object.entries(evalData.reading_question_qc.distractor_checks).forEach(([key, check]) => {
        comments.push({
          category: 'distractor',
          type: key.replace(/_/g, ' '),
          content: check.response,
          score: check.score,
        });
      });
    });

    return comments;
  };

  const comments = extractComments();
  const filteredComments = selectedCategory === 'all'
    ? comments
    : comments.filter((c) => c.category === selectedCategory);

  const hasUnappliedChanges = pendingCategory !== selectedCategory;

  const applyFilters = () => {
    setSelectedCategory(pendingCategory);
  };

  return (
    <div style={{ padding: '32px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: '700', marginBottom: '8px' }}>
          Evaluator Insights
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '16px' }}>
          Detailed feedback and reasoning from LLM evaluators on question quality
        </p>
      </div>

      {/* Category Filter */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          marginBottom: '24px',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => setPendingCategory(category.id)}
            style={{
              padding: '12px 24px',
              background: pendingCategory === category.id
                ? 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)'
                : 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              color: 'var(--text)',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              if (pendingCategory !== category.id) {
                e.currentTarget.style.background = 'var(--hover-bg)';
              }
            }}
            onMouseLeave={(e) => {
              if (pendingCategory !== category.id) {
                e.currentTarget.style.background = 'var(--surface)';
              }
            }}
          >
            {category.label}
          </button>
        ))}
        
        {/* Apply Filters Button */}
        <button
          onClick={applyFilters}
          disabled={!hasUnappliedChanges}
          style={{
            padding: '12px 32px',
            background: hasUnappliedChanges
              ? 'linear-gradient(135deg, var(--success) 0%, #059669 100%)'
              : 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            color: hasUnappliedChanges ? '#ffffff' : 'var(--text-secondary)',
            fontSize: '14px',
            fontWeight: '600',
            cursor: hasUnappliedChanges ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            opacity: hasUnappliedChanges ? 1 : 0.5,
            marginLeft: 'auto',
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

      {/* Comments Grid */}
      <div style={{ display: 'grid', gap: '20px' }}>
        {filteredComments.map((comment, index) => (
          <div
            key={index}
            style={{
              padding: '24px',
              background: 'var(--surface)',
              borderRadius: '16px',
              border: '1px solid var(--border)',
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateX(4px)';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(158, 127, 255, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateX(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    background: comment.score === 1
                      ? 'rgba(16, 185, 129, 0.2)'
                      : 'rgba(245, 158, 11, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {comment.score === 1 ? (
                    <ThumbsUp size={20} color="var(--success)" />
                  ) : (
                    <ThumbsDown size={20} color="var(--warning)" />
                  )}
                </div>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '600', textTransform: 'capitalize', marginBottom: '4px' }}>
                    {comment.type}
                  </h3>
                  <span
                    style={{
                      padding: '4px 12px',
                      borderRadius: '6px',
                      background: comment.category === 'question'
                        ? 'rgba(158, 127, 255, 0.2)'
                        : 'rgba(56, 189, 248, 0.2)',
                      color: comment.category === 'question' ? 'var(--primary)' : 'var(--secondary)',
                      fontSize: '12px',
                      fontWeight: '500',
                      textTransform: 'capitalize',
                    }}
                  >
                    {comment.category}
                  </span>
                </div>
              </div>
              <div
                style={{
                  padding: '6px 16px',
                  borderRadius: '8px',
                  background: comment.score === 1
                    ? 'rgba(16, 185, 129, 0.2)'
                    : 'rgba(245, 158, 11, 0.2)',
                  color: comment.score === 1 ? 'var(--success)' : 'var(--warning)',
                  fontSize: '14px',
                  fontWeight: '700',
                }}
              >
                Score: {comment.score}
              </div>
            </div>

            {/* Content */}
            <div
              style={{
                padding: '16px',
                background: 'var(--background)',
                borderRadius: '12px',
                borderLeft: `3px solid ${comment.score === 1 ? 'var(--success)' : 'var(--warning)'}`,
              }}
            >
              <p style={{ fontSize: '14px', lineHeight: '1.7', color: 'var(--text-secondary)' }}>
                {comment.content}
              </p>
            </div>
          </div>
        ))}
      </div>

      {filteredComments.length === 0 && (
        <div
          style={{
            padding: '64px',
            textAlign: 'center',
            background: 'var(--surface)',
            borderRadius: '16px',
            border: '1px solid var(--border)',
          }}
        >
          <MessageSquare size={48} color="var(--text-secondary)" style={{ marginBottom: '16px' }} />
          <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>
            No comments found
          </h3>
          <p style={{ color: 'var(--text-secondary)' }}>
            Try selecting a different category
          </p>
        </div>
      )}
    </div>
  );
};

export default EvaluatorComments;
