/**
 * Blocked Standards Configuration
 * 
 * This file maintains lists of standards that require multimedia (audio, images,
 * charts, diagrams, maps) and should be filtered from text-only question generation.
 * 
 * Total: 436 standards across grades 3-8
 * 
 * Categories:
 * - Audio & Dictation (~56 standards): Require audio files for spelling dictation or pronunciation
 * - Visual Aids (~149 standards): Require maps, charts, graphs, diagrams, timelines
 * - Image-Based Interaction (~231 standards): Require students to look at pictures/illustrations
 * 
 * Usage:
 *   import { isStandardBlocked, getBlockedReason, BLOCKED_STANDARDS_SET } from '@/config/blockedStandards';
 *   
 *   const filtered = recipes.filter(recipe => !isStandardBlocked(recipe.standard_id_l1));
 */

/**
 * Standards requiring visual aids such as maps, charts, graphs, diagrams, timelines
 * ONLY these standards will be blocked - no audio or image-based standards
 */
export const VISUAL_AIDS_STANDARDS: string[] = [
  // Grade 3
  '3-AA.1', '3-AA.2', '3-AA.3',
  '3-B.3',
  '3-CCC.6',
  '3-DD.3', '3-DD.9',
  '3-EE.2', '3-EE.3',
  '3-GG.1',
  '3-HH.4',
  '3-II.1', '3-II.2', '3-II.3',
  '3-JJ.1', '3-JJ.2', '3-JJ.3',
  '3-KK.1', '3-KK.2', '3-KK.3',
  '3-LL.1',
  '3-MM.1',
  '3-NN.2', '3-NN.5', '3-NN.6', '3-NN.7',
  '3-OO.8',
  '3-PP.2', '3-PP.3', '3-PP.5', '3-PP.6', '3-PP.9', '3-PP.11',
  '3-QQ.1', '3-QQ.2', '3-QQ.3', '3-QQ.8',
  '3-RR.1', '3-RR.2',
  '3-SS.2', '3-SS.5', '3-SS.6',
  '3-TT.1', '3-TT.2', '3-TT.3', '3-TT.4', '3-TT.5',
  '3-UU.1', '3-UU.2', '3-UU.3', '3-UU.4',
  '3-VV.1', '3-VV.2', '3-VV.3', '3-VV.4', '3-VV.5',
  '3-VV.6', '3-VV.7', '3-VV.8', '3-VV.9',
  '3-WW.1', '3-WW.2', '3-WW.3', '3-WW.4',
  '3-XX.1', '3-XX.2', '3-XX.3',
  '3-YY.1', '3-YY.2', '3-YY.3',
  '3-ZZ.1', '3-ZZ.2', '3-ZZ.3', '3-ZZ.4', '3-ZZ.5',

  // Grade 4
  '4-AA.1', '4-AA.2', '4-AA.3',
  '4-CC.1', '4-CC.2', '4-CC.3',
  '4-DD.1', '4-DD.2', '4-DD.3', '4-DD.4',
  '4-EE.1', '4-EE.2', '4-EE.3',
  '4-FF.4',
  '4-GG.1', '4-GG.2', '4-GG.3',
  '4-HH.1', '4-HH.2', '4-HH.3',
  '4-II.1', '4-II.2', '4-II.3', '4-II.4', '4-II.5',
  '4-JJ.1', '4-JJ.2', '4-JJ.3',
  '4-KK.1', '4-KK.2', '4-KK.3',
  '4-LL.1', '4-LL.2', '4-LL.3',
  '4-MM.1', '4-MM.2', '4-MM.3',
  '4-NN.1', '4-NN.2', '4-NN.3',
  '4-OO.1',
  '4-PP.1', '4-PP.2', '4-PP.3',
  '4-QQ.1', '4-QQ.2', '4-QQ.3',
  '4-RR.1', '4-RR.2', '4-RR.3',
  '4-SS.1', '4-SS.2', '4-SS.3',
  '4-TT.1', '4-TT.2', '4-TT.3', '4-TT.4',
  '4-UU.1', '4-UU.2', '4-UU.3', '4-UU.4',
  '4-VV.1', '4-VV.2', '4-VV.3',
  '4-WW.1', '4-WW.2', '4-WW.3',
  '4-XX.1', '4-XX.2', '4-XX.3',

  // Grade 5
  '5-BB.2',
  '5-CC.3',
  '5-DD.2',
  '5-EE.2',
  '5-FF.1',
  '5-GG.3',
  '5-HH.3',
  '5-II.1', '5-II.2', '5-II.3', '5-II.4',
  '5-JJ.1', '5-JJ.2', '5-JJ.3',
  '5-KK.1', '5-KK.2', '5-KK.3',
  '5-LL.1', '5-LL.2', '5-LL.3',
  '5-MM.1', '5-MM.2', '5-MM.3',
  '5-NN.1', '5-NN.2', '5-NN.3',
  '5-OO.1', '5-OO.2', '5-OO.3',
  '5-PP.1', '5-PP.2', '5-PP.3',
  '5-QQ.1', '5-QQ.2', '5-QQ.3',
  '5-RR.1', '5-RR.2', '5-RR.3',
  '5-SS.1', '5-SS.2', '5-SS.3',
  '5-TT.1', '5-TT.2', '5-TT.3',

  // Grades 6–8
  '6-BB.1', '6-BB.2',
  '6-DD.1',
  '6-EE.2',
  '6-KK.1',
  '6-OO.1', '6-OO.2',
  '6-PP.1',
  '6-QQ.7',
  '6-SS.1',
  '6-TT.1', '6-TT.2',
  '6-VV.1',
  '6-WW.1', '6-WW.2', '6-WW.3',
  '6-XX.1', '6-XX.2', '6-XX.3',
  '6-YY.1', '6-YY.2',
  '7-EE.4',
  '7-GG.1',
  '7-I.1',
  '8-G.3',
  '8-H.1',
  '8-I.2', '8-I.3',
  '8-J.1',
];

/**
 * Combined object with all blocked standards organized by category
 * Currently only blocking visual aids standards
 */
export const BLOCKED_STANDARDS = {
  visual_aids: VISUAL_AIDS_STANDARDS,
};

/**
 * Flattened Set of all blocked standards for O(1) lookup performance
 * Note: These are curriculum codes (e.g., "3-AA.1"), but the database uses
 * Common Core standards (e.g., "L.3.2.f, RF.3.3"). We need to map these
 * using the CSV file's standard_code column.
 * 
 * Only visual aids standards are blocked (charts, diagrams, maps, timelines)
 */
export const BLOCKED_STANDARDS_SET = new Set([
  ...VISUAL_AIDS_STANDARDS,
]);

/**
 * Map to store Common Core standards for blocked curriculum codes
 * This will be populated by parsing the CSV file
 * Key: curriculum code (e.g., "3-A.3")
 * Value: array of Common Core standards (e.g., ["L.3.2.f", "RF.3.3"])
 */
export const BLOCKED_STANDARDS_COMMON_CORE_MAP: Record<string, string[]> = {};

/**
 * Set of all Common Core standards that should be blocked
 * This will be populated after parsing the CSV
 */
export const BLOCKED_COMMON_CORE_STANDARDS_SET = new Set<string>();

/**
 * Check if a standard code is blocked due to multimedia requirements
 * 
 * @param standardCode - The standard_id_l1 value to check (can be comma-separated Common Core standards)
 * @returns true if the standard is blocked, false otherwise
 */
export function isStandardBlocked(standardCode: string): boolean {
  if (!standardCode) {
    return false;
  }
  
  // First check if it's a curriculum code (e.g., "3-A.3")
  if (BLOCKED_STANDARDS_SET.has(standardCode)) {
    return true;
  }
  
  // Check if it's a Common Core standard or comma-separated list
  // Database format is like: "L.3.2.f, RF.3.3"
  const standards = standardCode.split(',').map(s => s.trim());
  return standards.some(std => BLOCKED_COMMON_CORE_STANDARDS_SET.has(std));
}

/**
 * Get the reason why a standard is blocked
 * 
 * @param standardCode - The standard_id_l1 value to check
 * @returns The blocked reason category ('visual-aids') or null if not blocked
 */
export function getBlockedReason(standardCode: string): string | null {
  if (!standardCode) {
    return null;
  }
  
  if (VISUAL_AIDS_STANDARDS.includes(standardCode)) {
    return 'visual-aids';
  }
  
  return null;
}

/**
 * Get friendly display text for a blocked reason
 * 
 * @param reason - The blocked reason category from getBlockedReason()
 * @returns Human-readable text describing the multimedia requirement
 */
export function getBlockedReasonText(reason: string): string {
  const reasons: Record<string, string> = {
    'visual-aids': 'Requires Charts/Diagrams',
  };
  return reasons[reason] || 'Requires Visual Aids';
}

/**
 * Filter an array of recipes to remove blocked standards
 * 
 * @param recipes - Array of recipes to filter
 * @param getStandardCode - Function to extract standard_id_l1 from a recipe object
 * @returns Filtered array with blocked standards removed
 */
export function filterBlockedStandards<T>(
  recipes: T[],
  getStandardCode: (recipe: T) => string
): T[] {
  return recipes.filter((recipe) => {
    const standardCode = getStandardCode(recipe);
    return !isStandardBlocked(standardCode);
  });
}

/**
 * Get statistics about blocked standards
 * 
 * @returns Object with counts by category and total
 */
export function getBlockedStandardsStats() {
  return {
    visual_aids: VISUAL_AIDS_STANDARDS.length,
    total: BLOCKED_STANDARDS_SET.size,
  };
}

// FOR DEBUGGING: Expose to window object in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).testBlockedStandards = {
    isStandardBlocked,
    getBlockedReason,
    getBlockedReasonText,
    BLOCKED_STANDARDS_SET,
    stats: getBlockedStandardsStats(),
    test: (standardCode: string) => {
      console.log('\n=== Testing Standard Blocking ===');
      console.log('Input:', standardCode);
      const blocked = isStandardBlocked(standardCode);
      const reason = getBlockedReason(standardCode);
      console.log('Blocked:', blocked ? '🚫 YES' : '✅ NO');
      if (reason) {
        console.log('Reason:', getBlockedReasonText(reason));
      }
      console.log('===================================\n');
      return { blocked, reason };
    }
  };
}

