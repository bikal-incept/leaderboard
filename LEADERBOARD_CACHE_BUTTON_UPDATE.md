# Leaderboard Cache Button Update

## Summary of Changes

Updated the Benchmarks/Leaderboard page to reorganize action buttons:
- **Added "Add to Cache" button** to leaderboard rows
- **Moved Copy and Eye buttons** to the difficulty detail modal
- **Moved Top Performers button** to the difficulty detail modal header

## Changes Made

### 1. Main Leaderboard Rows
**Before:**
- Copy button (copied experiment tracker)
- Eye button (navigated to Look At Data page)

**After:**
- **"Cache" button** (with Download icon)
  - Navigates to Evaluations page with pre-filled filters
  - Auto-caches the experiment report
  - Shows "Added" confirmation for 3 seconds
  - Green highlight when successfully added

### 2. Difficulty Detail Modal
**Before:**
- Only close button in header
- No action buttons on experiment rows

**After:**
- **Top Performers button** in modal header (green hover effect)
- **Copy button** on each experiment row
- **Eye button** on each experiment row
- Close button retained

## User Flow

### Adding to Cache
1. User clicks **"Cache"** button on any leaderboard row
2. Navigates to Evaluations page with experiment selected
3. Experiment report loads and is automatically cached
4. Button shows "Added" confirmation briefly
5. User can return to Compare page to use cached report

### Using Modal Buttons
1. Click difficulty card to open modal
2. Click **"Top Performers"** in header to view rankings
3. Click **Copy icon** on any row to copy experiment tracker
4. Click **Eye icon** on any row to view raw data

## Technical Details

### New State
```typescript
const [addedToCache, setAddedToCache] = useState<string | null>(null);
```

### Button Behavior
- **Cache Button**:
  - Primary action: Navigate to `/evaluations?model=X&subject=Y&grade_level=Z&question_type=W`
  - Visual feedback: Green border + "Added" text for 3 seconds
  - Hover: Purple highlight
  - Icon: Download (before) → Check (after)

### Styling
- Cache button: Compact with icon + text
- Modal buttons: Icon-only, hover effects
- Top Performers: Full button with icon + text
- Consistent with existing design system

## Benefits

1. **Clearer Workflow**: "Cache" button makes it obvious how to add experiments to comparison
2. **Less Clutter**: Main leaderboard rows are cleaner with one button instead of two
3. **Better Organization**: Modal groups related actions together
4. **Improved UX**: Visual confirmation when adding to cache

## Files Modified
- `src/pages/Benchmarks.tsx`
  - Added `Download` icon import
  - Added `addedToCache` state
  - Replaced Copy/Eye buttons with Cache button in main rows
  - Added Copy/Eye buttons to modal rows
  - Added Top Performers button to modal header

## Testing Checklist
- [ ] Click "Cache" button on leaderboard row
- [ ] Verify navigation to Evaluations page
- [ ] Verify experiment loads and caches
- [ ] Verify "Added" confirmation shows
- [ ] Open difficulty modal
- [ ] Click "Top Performers" button
- [ ] Click Copy button on modal row
- [ ] Click Eye button on modal row
- [ ] Verify all buttons have proper hover effects

## Notes
- Cache button navigates to Evaluations, which handles the actual caching
- The "Added" state is cosmetic - actual caching happens on Evaluations page
- Top Performers modal can be opened from difficulty modal
- All modal buttons stop event propagation to prevent row click

