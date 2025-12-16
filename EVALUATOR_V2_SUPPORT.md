# Evaluator Version 2.0.0 Support

## Overview
Updated the leaderboard UI to support the new evaluator version 2.0.0 response format, which uses the `inceptbench_new_evaluation` structure with dimension-based evaluations.

## Version 2.0.0 Structure

The new format includes:
```json
{
  "request_id": "...",
  "evaluations": {
    "<question_id>": {
      "score": 0.95,
      "inceptbench_new_evaluation": {
        "overall": {
          "score": 0.95,
          "reasoning": "...",
          "suggested_improvements": "..."
        },
        "content_type": "mcq",
        "weighted_score": 1.0,
        "factual_accuracy": {
          "score": 1.0,
          "reasoning": "...",
          "suggested_improvements": null
        },
        "stimulus_quality": { ... },
        "clarity_precision": { ... },
        "passage_reference": { ... },
        "distractor_quality": { ... },
        "curriculum_alignment": { ... },
        "difficulty_alignment": { ... },
        "educational_accuracy": { ... },
        "localization_quality": { ... },
        "reveals_misconceptions": { ... },
        "subcontent_evaluations": null,
        "mastery_learning_alignment": { ... }
      }
    }
  },
  "inceptbench_version": "2.0.0",
  "evaluation_time_seconds": 40.99
}
```

## Changes Made

### 1. `src/pages/LookAtData.tsx`
- **FeedbackRenderer Component**: 
  - Added version detection logic to check for `inceptbench_new_evaluation`
  - Created new UI rendering for version 2.0.0 that displays:
    - Overall evaluation with reasoning and suggested improvements
    - Dimension scores grid view
    - Detailed dimension breakdowns with reasoning and suggestions
    - Subcontent evaluations (if present)
  - Maintained backward compatibility with version 1.x format

- **Evaluation Data Extraction**:
  - Updated quality score extraction (lines ~189-222) to handle version 2.0.0 dimensions
  - Updated tag aggregation sections (lines ~1932-1977, ~2111-2146) to include version 2.0.0 dimension scores
  - Updated suggested improvements aggregation (lines ~2327-2378) to collect from both overall and dimension-level

### 2. `src/pages/Evaluations.tsx`
- **Aggregated Feedback Processing**:
  - Updated two aggregation functions (lines ~2688-2900, ~3076-3220) to:
    - Detect version 2.0.0 format
    - Extract suggested improvements from overall and dimension levels
    - Track low-scoring dimensions (< 0.9) as failures
  - Maintained backward compatibility with version 1.x data

- **Filter Logic**:
  - Updated recommendation filter (line ~752) to only apply to version 1.x data

### 3. `src/data/mockEvaluations.ts`
- Added a complete example of version 2.0.0 evaluator response
- Includes an ELA Grade 3 question evaluation with all dimension scores
- Helps with testing and demonstrating the new UI

## Key Features

### Version Detection
All updated sections check for the presence of `inceptbench_new_evaluation` to determine the version:
```typescript
const isVersion2 = evalData.inceptbench_new_evaluation !== undefined;
```

### Dimension Processing
For version 2.0.0, the code:
1. Extracts all dimension keys (excluding `overall`, `content_type`, `weighted_score`, `subcontent_evaluations`)
2. Displays scores in a grid layout
3. Shows detailed reasoning and suggestions for each dimension
4. Tracks low-scoring dimensions as potential issues

### Backward Compatibility
All changes maintain full backward compatibility with version 1.x evaluator responses:
- `ti_question_qa`
- `reading_question_qc`
- `math_content_evaluator`
- `localization_evaluator`
- `answer_verification`

## UI Enhancements

### Feedback Modal (Version 2.0.0)
1. **Overall Evaluation Section**: Shows overall score, weighted score, content type, and overall reasoning
2. **Dimension Scores Grid**: Displays all dimension scores in a responsive grid
3. **Detailed Dimensions**: Expandable sections for each dimension with:
   - Score badge (color-coded by performance)
   - Reasoning explanation
   - Suggested improvements (if any)
4. **Subcontent Evaluations**: JSON view of nested evaluations (if present)
5. **Metadata**: Request ID, version, and evaluation time

### Aggregation Views
- Suggested improvements from all dimensions are now aggregated
- Low-scoring dimensions (< 0.9) are tracked as "failures" for easy identification
- Tag clouds and metrics include version 2.0.0 dimension names

## Testing

To test the new version 2.0.0 support:
1. The mock data includes a version 2.0.0 example
2. Navigate to the Evaluations or Look at Data pages
3. The UI will automatically detect and display version 2.0.0 data appropriately
4. All aggregations and visualizations work with both version formats

## Future Considerations

- Consider adding dimension-specific filtering in the Evaluations page
- Add visualization for comparing dimension scores across questions
- Create dimension-level reports and analytics
- Support for future evaluator versions can follow the same pattern


