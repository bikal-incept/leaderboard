# Quick Start - Attachment Filtered Leaderboard

## TL;DR

This feature adds a dropdown to the Benchmarks page that lets you view the leaderboard with or without recipes that require multimedia attachments (149 blocked standards).

## 3-Step Setup

### Step 1: Create the Database View (5 minutes)

```bash
# Run this SQL script on your database
psql -U your_username -d your_database_name -f src/materialized_view_attachment_filtered.sql
```

**What it does:** Creates a pre-aggregated materialized view that excludes 149 standards requiring charts, diagrams, maps, or timelines.

### Step 2: Update Your Backend API (10 minutes)

Add this logic to your `/api/leaderboard` endpoint:

```typescript
import { 
  LEADERBOARD_MV_2_0_0, 
  LEADERBOARD_MV_2_0_0_ATTACHMENT_FILTERED 
} from './services/queries';

// In your /api/leaderboard endpoint:
const { view_mode } = req.query;

const query = view_mode === 'attachment_filtered' 
  ? LEADERBOARD_MV_2_0_0_ATTACHMENT_FILTERED
  : LEADERBOARD_MV_2_0_0;

const result = await db.query(query, [
  subject,
  grade_level || null,
  question_type || null,
  min_total_questions || null
]);

res.json(result.rows);
```

**What it does:** Makes your API respond to the `view_mode` parameter by selecting the appropriate materialized view.

### Step 3: Refresh the View (2 minutes)

Set up automatic refresh (choose one):

**Option A - Cron Job:**
```bash
# Add to crontab (crontab -e)
0 * * * * psql -U user -d db -c "REFRESH MATERIALIZED VIEW CONCURRENTLY mv_leaderboard_stats_2_0_0_attachment_filtered;"
```

**Option B - pg_cron:**
```sql
SELECT cron.schedule(
  'refresh-attachment-filtered-view',
  '0 * * * *',
  'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_leaderboard_stats_2_0_0_attachment_filtered'
);
```

**What it does:** Keeps the filtered view up-to-date with new evaluations.

## That's It! 🎉

The UI changes are already in place. Users will now see a dropdown at the top-right of the Benchmarks page:

```
View Mode: [All Data (2.0.0 Leaderboard) ▼]
           [Attachment Filtered (Blocked Standards Excluded)]
```

## Verify It's Working

### 1. Check the view exists:
```sql
SELECT COUNT(*) FROM mv_leaderboard_stats_2_0_0_attachment_filtered;
```
Should return a number > 0.

### 2. Test the API:
```bash
# Regular view
curl "http://localhost:3000/api/leaderboard?subject=ela&view_mode=all"

# Filtered view
curl "http://localhost:3000/api/leaderboard?subject=ela&view_mode=attachment_filtered"
```

### 3. Check the UI:
- Open the Benchmarks page
- Select "Attachment Filtered" from the dropdown
- You should see a badge: "⚠️ 149 standards excluded"
- Total question counts should be lower in filtered mode

## What Gets Filtered?

**149 blocked standards** that require:
- Charts and graphs
- Diagrams and timelines
- Maps and visual representations
- Other multimedia attachments

Full list in: `src/config/blockedStandards.ts` → `VISUAL_AIDS_STANDARDS`

## Troubleshooting

### "Relation does not exist" error
→ Run the SQL script: `psql -f src/materialized_view_attachment_filtered.sql`

### No data in filtered view
→ Refresh the view: `REFRESH MATERIALIZED VIEW mv_leaderboard_stats_2_0_0_attachment_filtered;`

### Dropdown not showing
→ Check that `src/pages/Benchmarks.tsx` has the latest changes

### Backend not returning filtered data
→ Verify your backend is checking the `view_mode` parameter and importing the new query constant

## Need More Details?

- **Complete Setup Guide**: `ATTACHMENT_FILTERED_VIEW_SETUP.md`
- **Backend Integration**: `BACKEND_INTEGRATION.md`
- **Implementation Summary**: `IMPLEMENTATION_SUMMARY.md`

## Key Files

| File | Purpose |
|------|---------|
| `src/materialized_view_attachment_filtered.sql` | Creates the filtered materialized view |
| `services/queries.ts` | Contains the new query constant |
| `src/pages/Benchmarks.tsx` | UI with dropdown selector |
| `src/config/blockedStandards.ts` | List of blocked standards |

## API Usage

### Parameters
- `view_mode`: `'all'` (default) or `'attachment_filtered'`
- All other parameters work the same (subject, grade_level, question_type, etc.)

### Examples
```bash
# ELA with all data
GET /api/leaderboard?subject=ela&view_mode=all

# ELA with blocked standards filtered out
GET /api/leaderboard?subject=ela&view_mode=attachment_filtered

# Math Grade 3 MCQ, filtered
GET /api/leaderboard?subject=math&grade_level=3&question_type=mcq&view_mode=attachment_filtered
```

## Maintenance

**Refresh Schedule:** The materialized view should refresh at the same frequency as your regular leaderboard view (typically hourly).

**Updating Blocked Standards:** If you modify the list in `blockedStandards.ts`, you'll need to drop and recreate the materialized view with the updated list.

**Monitoring:** Check the last refresh time:
```sql
SELECT matviewname, last_refresh 
FROM pg_matviews 
WHERE matviewname = 'mv_leaderboard_stats_2_0_0_attachment_filtered';
```

---

**Questions?** See the detailed documentation files or check the PostgreSQL logs for any errors.









