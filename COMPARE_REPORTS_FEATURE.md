# Compare Reports Feature

## Overview
The Compare Reports feature allows users to compare up to 4 cached experiment reports side-by-side. This feature provides comprehensive comparisons of latency metrics, performance across difficulties, and evaluator score distributions.

## Features

### 1. Cache Management
- **Automatic Caching**: Experiment reports are automatically cached when viewed in the Evaluations page
- **Maximum Cache Size**: 4 most recent reports
- **Cache Storage**: Uses localStorage with key `experiment_reports_cache`
- **Cache Contents**: Each cached report includes:
  - Experiment metadata (tracker ID, subject, grade level, question type)
  - Report data (performance by difficulty)
  - Summary data (overall statistics)
  - Scores data (individual question scores for distribution plots)
  - Timestamp (for sorting and display)

### 2. Report Selection Interface
- **Visual Selection**: Click to select/deselect reports for comparison
- **Selection Limit**: Up to 4 reports can be compared simultaneously
- **Selection Indicator**: Selected reports are highlighted with gradient borders and "Selected" badge
- **Report Display**: Shows truncated experiment tracker ID with full filter context
- **Timestamp Display**: Shows when the report was cached
- **Delete Functionality**: Remove unwanted reports from cache with trash icon button

### 3. Latency Comparison

#### Time to First Token (TTFT)
- Compares TTFT across all selected reports
- Shows P50 (median) and P90 percentiles
- Broken down by difficulty (Easy, Medium, Hard)
- Values displayed in seconds for readability

#### Total Generation Time
- Compares total generation time across all selected reports
- Shows P50 (median) and P90 percentiles
- Broken down by difficulty (Easy, Medium, Hard)
- Values displayed in seconds for readability

### 4. Performance Across Difficulties

#### Success Rate Comparison
- Shows success rate percentage for each report
- Color-coded indicators:
  - **Green** (≥90%): Excellent performance
  - **Yellow** (≥70%): Good performance
  - **Red** (<70%): Needs improvement
- Broken down by difficulty level

#### Question Counts
- Displays questions above threshold / total questions
- Helps understand the sample size for each comparison

### 5. Evaluator Scores Distribution

#### Visual Bar Charts
- Distribution of scores from 0-10 for each report
- Separate visualizations for Easy, Medium, and Hard difficulties
- Gradient-colored bars for visual appeal
- Height proportional to question count

#### Score Statistics
- Average score displayed for each report and difficulty
- Count labels on top of each bar
- X-axis labels for score ranges

## User Flow

1. **View Reports**: User navigates to Evaluations page and views experiment reports
2. **Automatic Caching**: Reports are automatically cached (up to 4 most recent)
3. **Navigate to Compare**: User clicks the "Compare" icon in the sidebar
4. **Select Reports**: User selects 2-4 reports by clicking on them
5. **View Comparisons**: Comparison tables and charts are instantly displayed
6. **Manage Cache**: User can delete unwanted reports using trash icon

## Technical Implementation

### File Structure
```
src/
├── pages/
│   └── CompareReports.tsx     # Main comparison page component
├── components/
│   └── Layout.tsx             # Updated with GitCompare icon
└── App.tsx                    # Updated with /compare route
```

### Key Components

#### CompareReports Component
- **Location**: `src/pages/CompareReports.tsx`
- **Dependencies**: 
  - `lucide-react` icons (GitCompare, X, Trash2, Clock, TrendingUp, BarChart3, Activity)
  - React hooks (useState, useEffect, useMemo)
- **State Management**:
  - `cachedReports`: Array of cached experiment reports
  - `selectedReports`: Set of selected report cache keys

#### Cache Functions
- `loadCache()`: Loads and validates cached reports from localStorage
- `deleteFromCache()`: Removes a specific report from cache
- `getCacheKey()`: Generates unique key for each report based on filters

### Data Processing

#### Latency Comparison Data
- Iterates through difficulties (Easy, Medium, Hard)
- Extracts TTFT and generation time metrics for each report
- Handles missing data gracefully (shows "N/A")

#### Performance Comparison Data
- Extracts success rate and question counts
- Color-codes success rates based on thresholds
- Formats as percentages and ratios

#### Scores Distribution Data
- Bins scores from 0-10
- Creates histograms for each report and difficulty
- Calculates average scores
- Normalizes bar heights for visualization

### Styling

#### Color Scheme
- Uses CSS variables for theme consistency
- Gradient highlights for selected items
- Color-coded performance indicators
- Smooth transitions and hover effects

#### Layout
- Responsive grid for score distributions
- Scrollable tables for comparisons
- Card-based design with rounded corners
- Proper spacing and padding

## Navigation

### Sidebar Integration
- **Icon**: GitCompare (branching/comparison symbol)
- **Label**: "Compare"
- **Position**: Third item in navigation (after Evaluations, before Data)
- **Route**: `/compare`

## Empty States

### No Cached Reports
- Message: "No cached reports available. Visit the Evaluations page to view and cache experiment reports."
- Icon: Empty state indicator

### No Reports Selected
- Message: "Select reports to compare"
- Subtext: "Choose up to 3 cached reports from above to view detailed comparisons"
- Icon: GitCompare icon with reduced opacity

## Future Enhancements

1. **Export Comparison**: Download comparison as PDF or CSV
2. **Share Comparison**: Generate shareable links for comparisons
3. **Custom Metrics**: Allow users to select which metrics to compare
4. **More Reports**: Increase cache limit or add pagination
5. **Comparison History**: Save and revisit past comparisons
6. **Visual Improvements**: Add more chart types (line charts, radar charts)
7. **Statistical Analysis**: Add significance testing between reports
8. **Annotations**: Allow users to add notes to comparisons

## Performance Considerations

### Cache Size Management
- Limited to 4 reports to keep localStorage size manageable
- Automatic cleanup of old/invalid entries
- Sorted by timestamp (most recent first)

### Render Optimization
- Uses `useMemo` for expensive calculations
- Only recalculates when dependencies change
- Efficient data structures (Sets for O(1) lookups)

### Data Validation
- Type checking for cached data
- Fallbacks for missing/invalid data
- Error handling for localStorage operations

## Browser Compatibility

- **Storage**: Uses localStorage (supported in all modern browsers)
- **Icons**: Uses lucide-react (SVG-based, universally supported)
- **Styling**: Uses CSS variables (supported in all modern browsers)
- **JavaScript**: Uses ES6+ features (transpiled by Vite)

## Accessibility

- Semantic HTML structure
- Keyboard navigation support
- High contrast color schemes
- Screen reader friendly labels
- Focus indicators on interactive elements

## Testing Recommendations

1. **Cache Management**
   - Test with 0, 1, 2, and 3 cached reports
   - Test cache persistence across sessions
   - Test cache cleanup and validation

2. **Selection Interface**
   - Test selecting/deselecting reports
   - Test selection limit (max 3)
   - Test delete functionality

3. **Data Display**
   - Test with various data combinations
   - Test with missing/null data
   - Test edge cases (all same, all different)

4. **Responsive Design**
   - Test on different screen sizes
   - Test table overflow behavior
   - Test chart scaling

5. **Browser Testing**
   - Test localStorage behavior across browsers
   - Test with localStorage disabled
   - Test with quota exceeded scenarios

## Known Limitations

1. **Cache Limit**: Maximum 4 cached reports
2. **localStorage**: Subject to browser storage limits (typically 5-10MB)
3. **Static Comparison**: No dynamic filtering within comparison view
4. **No Persistence**: Comparisons are not saved between sessions (only cache)

## Integration Points

### With Evaluations Page
- Reports cached automatically when viewed
- Cache updated when new reports are viewed
- Shared cache key generation logic

### With Layout/Navigation
- New navigation item added
- Consistent icon styling
- Theme-aware design

### With Backend (Future)
- Could add API endpoint for saving comparisons
- Could fetch additional data on-demand
- Could implement server-side caching

## Configuration

### Constants (can be modified in CompareReports.tsx)
```typescript
const MAX_CACHE_ITEMS = 4;      // Maximum number of cached reports
const MAX_COMPARE_ITEMS = 4;     // Maximum number of reports to compare
const CACHE_KEY = 'experiment_reports_cache';  // localStorage key
```

## Conclusion

The Compare Reports feature provides a powerful way to analyze and compare experiment performance across multiple runs. It leverages client-side caching for fast access and provides comprehensive visualizations for latency, performance, and quality metrics.

