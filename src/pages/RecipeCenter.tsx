import React, { useState, useEffect, useMemo } from 'react';
import { Search, Filter, ChevronDown, ChevronUp, BookOpen, Loader, AlertCircle } from 'lucide-react';
import { useCurriculum } from '../contexts/CurriculumContext';
import { isStandardBlocked, getBlockedReason, getBlockedReasonText, BLOCKED_STANDARDS_SET } from '../config/blockedStandards';

// Type for recipe data from the database
interface QuestionRecipe {
  recipe_id: number;
  source_sheet: string;
  grade_level: string;
  subject: string;
  domain: string;
  cluster: string;
  standard_id_l1: string;
  standard_desc_l1: string;
  standard_id_l2: string;
  standard_desc_l2: string;
  substandard_id: string;
  lesson_title: string;
  question_type: string[];
  tasks: string;
  difficulty: string;
  constraints: string;
  direct_instruction: string;
  step_by_step_explanation: string;
  misconception_1: string;
  misconception_2: string;
  misconception_3: string;
  misconception_4: string;
  created_at: string;
}

// Enriched recipe with curriculum data
interface EnrichedRecipe extends QuestionRecipe {
  curriculumName?: string;
  curriculumLabel?: string;
  curriculumDescription?: string;
  curriculumBoundaries?: string;
  curriculumSubtopics?: string;
  curriculumGuidelines?: string;
}

const RecipeCenter: React.FC = () => {
  const { curriculum, isLoading: isCurriculumLoading, error: curriculumError, getCurriculumByStandard } = useCurriculum();
  
  const [recipes, setRecipes] = useState<EnrichedRecipe[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [gradeLevel, setGradeLevel] = useState<string>('3');
  const [subject, setSubject] = useState<string>('language');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [expandedRecipe, setExpandedRecipe] = useState<number | null>(null);
  const [includeMultimedia, setIncludeMultimedia] = useState<boolean>(false);
  
  // Fetch recipes from API
  const fetchRecipes = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const params = new URLSearchParams({
        grade_level: gradeLevel,
        subject: subject,
        include_multimedia: includeMultimedia.toString(),
      });
      
      console.log('[RecipeCenter] Fetching recipes:', { gradeLevel, subject });
      const response = await fetch(`/api/recipes?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch recipes: ${response.status}`);
      }
      
      const data: QuestionRecipe[] = await response.json();
      console.log('[RecipeCenter] Fetched recipes:', data.length);
      console.log('[RecipeCenter] Sample standard_id_l1 values:', data.slice(0, 5).map(r => r.standard_id_l1));
      console.log('[RecipeCenter] includeMultimedia:', includeMultimedia);
      
      // Enrich recipes with curriculum data
      const enrichedRecipes: EnrichedRecipe[] = data.map(recipe => {
        const curriculumData = getCurriculumByStandard(recipe.standard_id_l1);
        
        if (curriculumData) {
          return {
            ...recipe,
            curriculumName: curriculumData.name,
            curriculumLabel: curriculumData.label,
            curriculumDescription: curriculumData.description,
            curriculumBoundaries: curriculumData.boundaries,
            curriculumSubtopics: curriculumData.subtopics,
            curriculumGuidelines: curriculumData.guidelines,
          };
        }
        
        return recipe;
      });
      
      setRecipes(enrichedRecipes);
      console.log('[RecipeCenter] Enriched recipes with curriculum data');
    } catch (err) {
      console.error('[RecipeCenter] Error fetching recipes:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch recipes');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Fetch recipes when filters change
  useEffect(() => {
    if (!isCurriculumLoading) {
      fetchRecipes();
    }
  }, [gradeLevel, subject, includeMultimedia, isCurriculumLoading]);
  
  // Filter recipes based on search query
  const filteredRecipes = useMemo(() => {
    if (!searchQuery.trim()) {
      return recipes;
    }
    
    const query = searchQuery.toLowerCase();
    return recipes.filter(recipe => {
      return (
        recipe.lesson_title?.toLowerCase().includes(query) ||
        recipe.standard_id_l1?.toLowerCase().includes(query) ||
        recipe.standard_desc_l1?.toLowerCase().includes(query) ||
        recipe.curriculumName?.toLowerCase().includes(query) ||
        recipe.curriculumLabel?.toLowerCase().includes(query) ||
        recipe.domain?.toLowerCase().includes(query) ||
        recipe.cluster?.toLowerCase().includes(query)
      );
    });
  }, [recipes, searchQuery]);
  
  const toggleExpanded = (recipeId: number) => {
    setExpandedRecipe(expandedRecipe === recipeId ? null : recipeId);
  };
  
  // Parse JSON fields safely
  const parseJSON = (jsonString: string) => {
    try {
      return JSON.parse(jsonString);
    } catch {
      return null;
    }
  };
  
  return (
    <div style={{ padding: '32px', maxWidth: '1600px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <BookOpen size={32} color="var(--primary)" />
          <h1 style={{ fontSize: '32px', fontWeight: '700', color: 'var(--text)', margin: 0 }}>
            Recipe Center
          </h1>
        </div>
        <p style={{ fontSize: '16px', color: 'var(--text-secondary)', margin: 0 }}>
          Browse and explore question recipes with curriculum standards
        </p>
      </div>
      
      {/* Curriculum Loading State */}
      {isCurriculumLoading && (
        <div style={{
          padding: '16px',
          background: 'var(--surface)',
          borderRadius: '12px',
          border: '1px solid var(--border)',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          <Loader size={20} className="spin" />
          <span style={{ color: 'var(--text-secondary)' }}>Loading curriculum data...</span>
        </div>
      )}
      
      {/* Curriculum Error State */}
      {curriculumError && (
        <div style={{
          padding: '16px',
          background: 'rgba(239, 68, 68, 0.1)',
          borderRadius: '12px',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          <AlertCircle size={20} color="#ef4444" />
          <span style={{ color: '#ef4444' }}>Curriculum Error: {curriculumError}</span>
        </div>
      )}
      
      {/* Filters and Search */}
      <div style={{ marginBottom: '24px' }}>
        {/* Filter Toggle Button */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 16px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            color: 'var(--text)',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            marginBottom: '16px',
          }}
        >
          <Filter size={16} />
          {showFilters ? 'Hide Filters' : 'Show Filters'}
          {showFilters ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        
        {/* Filters Panel */}
        {showFilters && (
          <div style={{
            padding: '20px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            marginBottom: '16px',
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              {/* Grade Level Filter */}
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: 'var(--text)', marginBottom: '8px' }}>
                  Grade Level
                </label>
                <select
                  value={gradeLevel}
                  onChange={(e) => setGradeLevel(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: 'var(--background)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    color: 'var(--text)',
                    fontSize: '14px',
                    cursor: 'pointer',
                  }}
                >
                  <option value="3">Grade 3</option>
                  <option value="4">Grade 4</option>
                  <option value="5">Grade 5</option>
                  <option value="6">Grade 6</option>
                  <option value="7">Grade 7</option>
                  <option value="8">Grade 8</option>
                </select>
              </div>
              
              {/* Subject Filter */}
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: 'var(--text)', marginBottom: '8px' }}>
                  Subject
                </label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: 'var(--background)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    color: 'var(--text)',
                    fontSize: '14px',
                    cursor: 'pointer',
                  }}
                >
                  <option value="language">Language</option>
                  <option value="ela">ELA</option>
                  <option value="math">Math</option>
                </select>
              </div>
            </div>
            
            {/* Multimedia Standards Toggle */}
            <div style={{ marginTop: '16px' }}>
              <label style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                cursor: 'pointer',
                padding: '12px',
                background: 'var(--background)',
                borderRadius: '8px',
                border: '1px solid var(--border)',
              }}>
                <input
                  type="checkbox"
                  checked={includeMultimedia}
                  onChange={(e) => setIncludeMultimedia(e.target.checked)}
                  style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                />
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text)' }}>
                    Include image-required recipes
                  </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        Show recipes that require image attachments (48 recipes)
                      </div>
                </div>
              </label>
            </div>
          </div>
        )}
        
        {/* Search Bar */}
        <div style={{ position: 'relative' }}>
          <Search
            size={20}
            style={{
              position: 'absolute',
              left: '16px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-secondary)',
              pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            placeholder="Search by lesson title, standard, or curriculum name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '14px 16px 14px 48px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              color: 'var(--text)',
              fontSize: '15px',
            }}
          />
        </div>
      </div>
      
      {/* Results Count */}
      <div style={{ 
        marginBottom: '16px', 
        display: 'flex', 
        alignItems: 'center', 
        gap: '16px',
        flexWrap: 'wrap' 
      }}>
        <div style={{ fontSize: '14px', color: 'var(--text)' }}>
          Showing <strong>{filteredRecipes.length}</strong> {filteredRecipes.length === 1 ? 'recipe' : 'recipes'}
        </div>
        {!includeMultimedia && recipes.length > filteredRecipes.length && (
          <div style={{ 
            padding: '4px 12px',
            background: 'rgba(251, 191, 36, 0.1)',
            color: '#f59e0b',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: '500',
          }}>
            {recipes.length - filteredRecipes.length} image-required recipes hidden
          </div>
        )}
      </div>
      
      {/* Loading State */}
      {isLoading && (
        <div style={{
          padding: '48px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
          color: 'var(--text-secondary)',
        }}>
          <Loader size={32} className="spin" />
          <p>Loading recipes...</p>
        </div>
      )}
      
      {/* Error State */}
      {error && !isLoading && (
        <div style={{
          padding: '24px',
          background: 'rgba(239, 68, 68, 0.1)',
          borderRadius: '12px',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          <AlertCircle size={24} color="#ef4444" />
          <div>
            <p style={{ fontWeight: '600', color: '#ef4444', margin: '0 0 4px 0' }}>Error Loading Recipes</p>
            <p style={{ color: '#ef4444', margin: 0, fontSize: '14px' }}>{error}</p>
          </div>
        </div>
      )}
      
      {/* Empty State */}
      {!isLoading && !error && filteredRecipes.length === 0 && (
        <div style={{
          padding: '48px',
          textAlign: 'center',
          background: 'var(--surface)',
          borderRadius: '12px',
          border: '1px solid var(--border)',
        }}>
          <BookOpen size={48} color="var(--text-secondary)" style={{ margin: '0 auto 16px' }} />
          <p style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text)', margin: '0 0 8px 0' }}>
            No Recipes Found
          </p>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            {searchQuery ? 'Try adjusting your search or filters' : 'No recipes available for the selected filters'}
          </p>
        </div>
      )}
      
      {/* Recipes Table */}
      {!isLoading && !error && filteredRecipes.length > 0 && (
        <div style={{
          background: 'var(--surface)',
          borderRadius: '12px',
          border: '1px solid var(--border)',
          overflow: 'hidden',
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--background)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '16px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Recipe ID
                  </th>
                  <th style={{ padding: '16px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Lesson Title
                  </th>
                  <th style={{ padding: '16px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Standard ID
                  </th>
                  <th style={{ padding: '16px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Curriculum
                  </th>
                  <th style={{ padding: '16px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Domain
                  </th>
                  <th style={{ padding: '16px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Difficulty
                  </th>
                  <th style={{ padding: '16px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredRecipes.map((recipe) => (
                  <React.Fragment key={recipe.recipe_id}>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '16px', fontSize: '14px', color: 'var(--text)' }}>
                        {recipe.recipe_id}
                      </td>
                      <td style={{ padding: '16px', fontSize: '14px', color: 'var(--text)', maxWidth: '300px' }}>
                        {recipe.lesson_title || '-'}
                      </td>
                      <td style={{ padding: '16px', fontSize: '14px', color: 'var(--text)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <code style={{
                            padding: '4px 8px',
                            background: 'var(--background)',
                            borderRadius: '4px',
                            fontSize: '13px',
                            fontFamily: 'monospace',
                          }}>
                            {recipe.standard_id_l1}
                          </code>
                          {isStandardBlocked(recipe.standard_id_l1) && (
                            <span style={{
                              padding: '3px 8px',
                              background: 'rgba(239, 68, 68, 0.1)',
                              color: '#ef4444',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: '600',
                              textTransform: 'uppercase',
                              letterSpacing: '0.03em',
                              border: '1px solid rgba(239, 68, 68, 0.2)',
                              whiteSpace: 'nowrap',
                            }}>
                              {getBlockedReasonText(getBlockedReason(recipe.standard_id_l1) || '')}
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '16px', fontSize: '14px', color: 'var(--text)' }}>
                        {recipe.curriculumName ? (
                          <div>
                            <div style={{ fontWeight: '500' }}>{recipe.curriculumName}</div>
                            {recipe.curriculumLabel && (
                              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                {recipe.curriculumLabel}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>No curriculum data</span>
                        )}
                      </td>
                      <td style={{ padding: '16px', fontSize: '14px', color: 'var(--text)' }}>
                        {recipe.domain || '-'}
                      </td>
                      <td style={{ padding: '16px', fontSize: '14px', color: 'var(--text)' }}>
                        {recipe.difficulty ? (
                          <span style={{
                            padding: '4px 12px',
                            background: recipe.difficulty === 'Hard' ? 'rgba(239, 68, 68, 0.1)' :
                                       recipe.difficulty === 'Medium' ? 'rgba(251, 191, 36, 0.1)' :
                                       'rgba(34, 197, 94, 0.1)',
                            color: recipe.difficulty === 'Hard' ? '#ef4444' :
                                   recipe.difficulty === 'Medium' ? '#f59e0b' :
                                   '#22c55e',
                            borderRadius: '6px',
                            fontSize: '13px',
                            fontWeight: '500',
                          }}>
                            {recipe.difficulty}
                          </span>
                        ) : '-'}
                      </td>
                      <td style={{ padding: '16px', fontSize: '14px', color: 'var(--text)' }}>
                        <button
                          onClick={() => toggleExpanded(recipe.recipe_id)}
                          style={{
                            padding: '6px 12px',
                            background: 'transparent',
                            border: '1px solid var(--border)',
                            borderRadius: '6px',
                            color: 'var(--text)',
                            cursor: 'pointer',
                            fontSize: '13px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          {expandedRecipe === recipe.recipe_id ? (
                            <>
                              <ChevronUp size={14} />
                              Hide
                            </>
                          ) : (
                            <>
                              <ChevronDown size={14} />
                              Details
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                    
                    {/* Expanded Details Row */}
                    {expandedRecipe === recipe.recipe_id && (
                      <tr style={{ background: 'var(--background)' }}>
                        <td colSpan={7} style={{ padding: '24px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                            {/* Left Column - Database Info */}
                            <div>
                              <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text)', marginBottom: '16px' }}>
                                Recipe Details
                              </h3>
                              
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <DetailField label="Standard Description" value={recipe.standard_desc_l1} />
                                <DetailField label="Cluster" value={recipe.cluster} />
                                <DetailField label="Question Types" value={Array.isArray(recipe.question_type) ? recipe.question_type.join(', ') : recipe.question_type} />
                                <DetailField label="Tasks" value={recipe.tasks} multiline />
                                <DetailField label="Constraints" value={recipe.constraints} multiline />
                                <DetailField label="Direct Instruction" value={recipe.direct_instruction} multiline />
                              </div>
                            </div>
                            
                            {/* Right Column - Curriculum Info */}
                            <div>
                              <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text)', marginBottom: '16px' }}>
                                Curriculum Standards
                              </h3>
                              
                              {recipe.curriculumName ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                  <DetailField label="Description" value={recipe.curriculumDescription} multiline json />
                                  <DetailField label="Boundaries" value={recipe.curriculumBoundaries} multiline json />
                                  <DetailField label="Subtopics" value={recipe.curriculumSubtopics} multiline json />
                                  <DetailField label="Guidelines" value={recipe.curriculumGuidelines} multiline json />
                                </div>
                              ) : (
                                <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                                  No curriculum data available for this standard.
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper component for detail fields
const DetailField: React.FC<{ label: string; value?: string; multiline?: boolean; json?: boolean }> = ({ label, value, multiline, json }) => {
  if (!value || value === 'null' || value === 'undefined') {
    return null;
  }
  
  // Try to parse JSON if flag is set
  let displayValue = value;
  if (json) {
    try {
      const parsed = JSON.parse(value);
      displayValue = JSON.stringify(parsed, null, 2);
    } catch {
      // If parsing fails, use original value
    }
  }
  
  return (
    <div>
      <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
      {multiline ? (
        <pre style={{
          fontSize: '13px',
          color: 'var(--text)',
          margin: 0,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          fontFamily: json ? 'monospace' : 'inherit',
          background: json ? 'var(--surface)' : 'transparent',
          padding: json ? '12px' : '0',
          borderRadius: json ? '8px' : '0',
          border: json ? '1px solid var(--border)' : 'none',
          maxHeight: '300px',
          overflow: 'auto',
        }}>
          {displayValue}
        </pre>
      ) : (
        <div style={{ fontSize: '14px', color: 'var(--text)' }}>
          {displayValue}
        </div>
      )}
    </div>
  );
};

export default RecipeCenter;









