/**
 * Test script for LATENCY_BY_PERFORMANCE query
 * 
 * This query analyzes if there's a correlation between model performance
 * (evaluator scores) and latency metrics.
 * 
 * Usage:
 *   node scripts/test-latency-by-performance.js
 */

import { query } from '../services/db.ts';
import { LATENCY_BY_PERFORMANCE } from '../services/queries.ts';

async function testLatencyByPerformance() {
  try {
    console.log('Testing LATENCY_BY_PERFORMANCE query...\n');

    // Example: Get latency comparison for a specific experiment
    const experimentTracker = 'exp_001'; // Replace with actual experiment ID
    const subject = 'math'; // or null for all subjects
    const gradeLevel = null; // or specific grade like '3'
    const questionType = null; // or specific type like 'mcq'

    console.log(`Parameters:
  - Experiment: ${experimentTracker}
  - Subject: ${subject || 'all'}
  - Grade Level: ${gradeLevel || 'all'}
  - Question Type: ${questionType || 'all'}
`);

    const { rows } = await query(
      LATENCY_BY_PERFORMANCE,
      [experimentTracker, subject, gradeLevel, questionType]
    );

    console.log('Results:\n');
    console.log('═══════════════════════════════════════════════════════════════════════════\n');

    for (const row of rows) {
      console.log(`📊 ${row.performance_segment}`);
      console.log('─'.repeat(75));
      
      console.log('\n🎯 Score Metrics:');
      console.log(`   Questions: ${row.question_count}`);
      console.log(`   Score Range: ${row.min_score} - ${row.max_score}`);
      console.log(`   Avg Score: ${row.avg_score} | Median: ${row.median_score}`);
      
      if (row.performance_segment === 'Top 10%') {
        console.log(`   ✅ Threshold: ≥ ${row.score_threshold_top_10pct}`);
      } else if (row.performance_segment === 'Bottom 10%') {
        console.log(`   ❌ Threshold: ≤ ${row.score_threshold_bottom_10pct}`);
      }

      console.log('\n⚡ TTFT (Time To First Token):');
      console.log(`   Average: ${row.avg_ttft_ms}ms | Median: ${row.median_ttft_ms}ms`);
      console.log(`   P10-P90 Range: ${row.p10_ttft_ms}ms - ${row.p90_ttft_ms}ms`);
      console.log(`   Min-Max: ${row.min_ttft_ms}ms - ${row.max_ttft_ms}ms`);

      console.log('\n⏱️  Total Generation Time:');
      console.log(`   Average: ${row.avg_total_generation_ms}ms | Median: ${row.median_total_generation_ms}ms`);
      console.log(`   P10-P90 Range: ${row.p10_total_generation_ms}ms - ${row.p90_total_generation_ms}ms`);
      console.log(`   Min-Max: ${row.min_total_generation_ms}ms - ${row.max_total_generation_ms}ms`);

      console.log('\n');
    }

    console.log('═══════════════════════════════════════════════════════════════════════════\n');

    // Calculate and display insights
    if (rows.length === 2) {
      const topPerf = rows.find(r => r.performance_segment === 'Top 10%');
      const bottomPerf = rows.find(r => r.performance_segment === 'Bottom 10%');

      if (topPerf && bottomPerf) {
        console.log('📈 Insights:');
        console.log('─'.repeat(75));

        const ttftDiff = ((bottomPerf.avg_ttft_ms - topPerf.avg_ttft_ms) / topPerf.avg_ttft_ms * 100).toFixed(1);
        const totalDiff = ((bottomPerf.avg_total_generation_ms - topPerf.avg_total_generation_ms) / topPerf.avg_total_generation_ms * 100).toFixed(1);

        console.log(`\n🔍 Bottom 10% vs Top 10%:`);
        console.log(`   TTFT Difference: ${ttftDiff > 0 ? '+' : ''}${ttftDiff}%`);
        console.log(`   Total Time Difference: ${totalDiff > 0 ? '+' : ''}${totalDiff}%`);

        if (Math.abs(ttftDiff) < 5) {
          console.log(`   💡 Minimal latency difference - quality issues likely not speed-related`);
        } else if (ttftDiff > 0) {
          console.log(`   💡 Bottom performers are SLOWER - might indicate complexity/quality tradeoff`);
        } else {
          console.log(`   💡 Bottom performers are FASTER - possible rushing/shortcuts affecting quality`);
        }

        console.log('\n');
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('Error executing query:', error);
    process.exit(1);
  }
}

testLatencyByPerformance();





