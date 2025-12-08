# Compare Reports Debug Guide

## Issue: Seeing "N/A" values in comparisons

This guide will help you debug why you're seeing "N/A" values in the Compare Reports page.

## Quick Diagnosis

### Step 1: Check Browser Console

Open your browser's developer console (F12 or Right-click → Inspect → Console) and look for these log messages:

1. **When loading Compare page:**
   ```
   [CompareReports] Loaded cache: [...]
   [CompareReports] First report structure: {...}
   ```

2. **When selecting reports:**
   ```
   [CompareReports] Reports to compare: ...
   [CompareReports] Building latency comparison for X reports
   [CompareReports] Looking for difficulty "Easy" in report 0
   [CompareReports] Found data for Easy, report 0: {...}
   ```

### Step 2: Manually Check localStorage

Run this in your browser console:

```javascript
// Check cache
const cache = localStorage.getItem('experiment_reports_cache');
console.log('Raw cache:', cache);

// Parse and inspect
if (cache) {
  const parsed = JSON.parse(cache);
  console.log('Parsed cache:', parsed);
  console.log('Number of cached reports:', parsed.length);
  
  if (parsed.length > 0) {
    console.log('First report:', parsed[0]);
    console.log('Report data:', parsed[0].reportData);
    console.log('Difficulties in first report:', parsed[0].reportData?.map(r => r.difficulty));
  }
}
```

### Step 3: Verify Data Structure

The cached data should have this structure:

```javascript
{
  experiment_tracker: "some-uuid",
  subject: "Math",
  grade_level: "3",
  question_type: "MCQ",
  timestamp: 1234567890,
  reportData: [
    {
      difficulty: "Easy",  // Must match exactly (capital E)
      avg_ttft_ms: 1234.5,
      median_ttft_ms: 1200.0,
      p90_ttft_ms: 1500.0,
      avg_total_generation_ms: 2345.6,  // Note: not avg_total_gen_time_ms
      median_total_generation_ms: 2200.0,
      p90_total_generation_ms: 2800.0,
      success_percentage: 92.5,
      total_questions: 100,
      questions_above_threshold: 92,
      // ... other fields
    },
    // ... Medium, Hard
  ],
  summaryData: { /* ... */ },
  scoresData: [
    {
      question_id: 123,
      recipe_id: 456,
      evaluator_score: 8.5,
      difficulty: "Easy"
    },
    // ... more scores
  ]
}
```

## Common Issues and Fixes

### Issue 1: Empty Cache

**Symptom:** No cached reports show up on Compare page

**Fix:** 
1. Navigate to the Evaluations page
2. Select an experiment (click on a row from Benchmarks page)
3. Wait for the data to load
4. The report will be automatically cached
5. Return to Compare page

### Issue 2: Field Name Mismatch

**Symptom:** Cache has data but comparisons show "N/A"

**Fixed Issues:**
- ✅ Changed `avg_total_gen_time_ms` → `avg_total_generation_ms`
- ✅ Changed `median_total_gen_time_ms` → `median_total_generation_ms`
- ✅ Changed `p90_total_gen_time_ms` → `p90_total_generation_ms`

**To Verify:** Check console logs for "Found data for Easy, report 0:" - if this shows `null`, there's a mismatch.

### Issue 3: Difficulty Case Sensitivity

**Symptom:** Data exists but difficulty matching fails

**Check:** The code expects "Easy", "Medium", "Hard" with capital first letter.

**Debug:**
```javascript
const cache = JSON.parse(localStorage.getItem('experiment_reports_cache'));
console.log('Difficulties:', cache[0].reportData.map(r => r.difficulty));
// Should show: ["Easy", "Medium", "Hard"]
```

### Issue 4: Old Cache Format

**Symptom:** Cache exists but has old structure

**Fix:** Clear the cache and rebuild it:
```javascript
// Run in browser console
localStorage.removeItem('experiment_reports_cache');
// Then visit Evaluations page to rebuild cache
```

## Testing Steps

1. **Clear existing cache:**
   ```javascript
   localStorage.removeItem('experiment_reports_cache');
   ```

2. **Visit Evaluations page:**
   - Go to Benchmarks/Leaderboards
   - Click on an experiment row
   - Wait for data to load
   - Check console for "[Experiment Report] Loaded data:"

3. **Visit Compare page:**
   - Navigate to Compare via sidebar
   - Check console for cache loading logs
   - Select a cached report
   - Check console for comparison building logs

4. **Inspect results:**
   - If still showing "N/A", copy all console logs
   - Check what data structure is being logged

## Manual Data Verification

Run this comprehensive check in your console:

```javascript
function debugCompareReports() {
  const cache = localStorage.getItem('experiment_reports_cache');
  
  if (!cache) {
    console.error('❌ No cache found. Visit Evaluations page first.');
    return;
  }
  
  const parsed = JSON.parse(cache);
  console.log('✅ Cache found:', parsed.length, 'reports');
  
  parsed.forEach((report, idx) => {
    console.log(`\n📊 Report ${idx}:`);
    console.log('  Experiment:', report.experiment_tracker?.substring(0, 8) + '...');
    console.log('  Subject:', report.subject);
    console.log('  Report data entries:', report.reportData?.length);
    console.log('  Scores data entries:', report.scoresData?.length);
    
    if (report.reportData) {
      report.reportData.forEach(diff => {
        console.log(`  \n  ${diff.difficulty}:`);
        console.log('    - TTFT P50:', diff.median_ttft_ms || diff.avg_ttft_ms);
        console.log('    - TTFT P90:', diff.p90_ttft_ms);
        console.log('    - Gen P50:', diff.median_total_generation_ms || diff.avg_total_generation_ms);
        console.log('    - Gen P90:', diff.p90_total_generation_ms);
        console.log('    - Success %:', diff.success_percentage);
        console.log('    - Questions:', diff.questions_above_threshold, '/', diff.total_questions);
      });
    }
  });
}

debugCompareReports();
```

## What the Logs Should Show

### Successful Load:
```
[CompareReports] Loaded cache: Array(3)
[CompareReports] First report structure:
  reportDataLength: 3
  reportDataSample: {difficulty: "Easy", avg_ttft_ms: 1234.5, ...}
  scoresDataLength: 150
  summaryData: {experiment_tracker: "...", ...}
```

### Successful Comparison:
```
[CompareReports] Reports to compare: 2
[CompareReports] Building latency comparison for 2 reports
[CompareReports] Looking for difficulty "Easy" in report 0
  availableDifficulties: ["Easy", "Medium", "Hard"]
  reportDataLength: 3
[CompareReports] Found data for Easy, report 0:
  {difficulty: "Easy", avg_ttft_ms: 1234.5, p90_ttft_ms: 1500.0, ...}
```

## If Still Not Working

After running all the above checks, if you still see "N/A":

1. **Copy the console output** - All the log messages
2. **Export your cache:**
   ```javascript
   console.log(JSON.stringify(localStorage.getItem('experiment_reports_cache'), null, 2));
   ```
3. **Check if API is returning data** - Look for "[Experiment Report] Loaded data:" in console when on Evaluations page

The console logs will tell us exactly where the data flow breaks down.

