// Run this in your browser console to check the cache directly

console.log('=== CACHE CHECK ===');

// Check if cache exists
const cache = localStorage.getItem('experiment_reports_cache');

if (!cache) {
  console.log('❌ No cache found in localStorage');
} else {
  console.log('✅ Cache found in localStorage');
  console.log('Cache size (bytes):', cache.length);
  
  try {
    const parsed = JSON.parse(cache);
    console.log('✅ Cache parsed successfully');
    console.log('Number of items:', parsed.length);
    
    if (parsed.length > 0) {
      console.log('\nFirst cached item:');
      console.log('- Experiment:', parsed[0].experiment_tracker);
      console.log('- Subject:', parsed[0].subject);
      console.log('- Grade:', parsed[0].grade_level);
      console.log('- Type:', parsed[0].question_type);
      console.log('- Timestamp:', new Date(parsed[0].timestamp).toLocaleString());
      console.log('- Has reportData:', !!parsed[0].reportData);
      console.log('- reportData length:', parsed[0].reportData?.length);
      
      if (parsed[0].reportData && parsed[0].reportData.length > 0) {
        console.log('\nDifficulties in reportData:');
        parsed[0].reportData.forEach((r, i) => {
          console.log(`  ${i}: "${r.difficulty}"`);
        });
      }
    }
    
    console.log('\n=== ALL CACHED ITEMS ===');
    parsed.forEach((item, i) => {
      console.log(`\nItem ${i}:`);
      console.log('  Experiment:', item.experiment_tracker?.substring(0, 30) + '...');
      console.log('  Subject:', item.subject);
      console.log('  Has reportData:', !!item.reportData, '(' + (item.reportData?.length || 0) + ' entries)');
      console.log('  Has scoresData:', !!item.scoresData, '(' + (item.scoresData?.length || 0) + ' entries)');
    });
    
  } catch (err) {
    console.error('❌ Error parsing cache:', err);
  }
}

console.log('\n=== END CACHE CHECK ===');

