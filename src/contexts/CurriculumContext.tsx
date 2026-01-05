import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { BLOCKED_STANDARDS_SET, BLOCKED_COMMON_CORE_STANDARDS_SET } from '../config/blockedStandards';

// Type definition for a curriculum record from the CSV
export interface CurriculumRecord {
  name: string;
  label: string;
  standard_code: string; // "standard_code - use as standard for content generation"
  standard: string;
  question_type: string;
  question_planning: string;
  skill_code: string;
  id: string;
  general_info: string;
  boundaries: string;
  description: string;
  subtopics: string;
  guidelines: string;
  subtopic_instruction_focus: string;
}

interface CurriculumContextType {
  curriculum: Record<string, CurriculumRecord>;
  isLoading: boolean;
  error: string | null;
  getCurriculumByStandard: (standardCode: string) => CurriculumRecord | undefined;
}

const CurriculumContext = createContext<CurriculumContextType | undefined>(undefined);

/**
 * Simple CSV parser that handles quoted fields and newlines within quotes
 */
function parseCSV(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let insideQuotes = false;
  
  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];
    
    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        // Escaped quote
        currentField += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      // End of field
      currentRow.push(currentField);
      currentField = '';
    } else if (char === '\n' && !insideQuotes) {
      // End of row
      if (currentField || currentRow.length > 0) {
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      }
    } else if (char === '\r' && nextChar === '\n' && !insideQuotes) {
      // Windows line ending
      if (currentField || currentRow.length > 0) {
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      }
      i++; // Skip \n
    } else {
      currentField += char;
    }
  }
  
  // Add last field and row if not empty
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.some(field => field.trim())) {
      rows.push(currentRow);
    }
  }
  
  return rows;
}

/**
 * Populate the blocked Common Core standards set based on blocked curriculum codes
 */
function populateBlockedCommonCoreStandards(rows: string[][]) {
  if (rows.length === 0) {
    return;
  }
  
  const headers = rows[0];
  const nameIndex = headers.findIndex(h => h.toLowerCase() === 'name');
  const standardCodeIndex = headers.findIndex(h => 
    h.toLowerCase().includes('standard_code') || 
    h === 'standard_code - use as standard for content generation'
  );
  
  if (nameIndex === -1 || standardCodeIndex === -1) {
    console.warn('[CurriculumContext] Could not find name or standard_code columns for blocked standards mapping');
    return;
  }
  
  let blockedCount = 0;
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < Math.max(nameIndex, standardCodeIndex) + 1) {
      continue;
    }
    
    const curriculumCode = row[nameIndex]?.trim();
    const commonCoreStandards = row[standardCodeIndex]?.trim();
    
    // If this curriculum code is blocked and has Common Core standards
    if (curriculumCode && BLOCKED_STANDARDS_SET.has(curriculumCode) && commonCoreStandards) {
      const standards = commonCoreStandards.split(',').map(s => s.trim()).filter(s => s);
      standards.forEach(std => {
        BLOCKED_COMMON_CORE_STANDARDS_SET.add(std);
        blockedCount++;
      });
    }
  }
  
  console.log(`[CurriculumContext] Populated ${BLOCKED_COMMON_CORE_STANDARDS_SET.size} Common Core standards to block (from ${BLOCKED_STANDARDS_SET.size} curriculum codes)`);
  console.log('[CurriculumContext] Sample blocked Common Core standards:', Array.from(BLOCKED_COMMON_CORE_STANDARDS_SET).slice(0, 5));
}

/**
 * Parse curriculum records from CSV rows
 */
function parseCurriculumRecords(rows: string[][]): Record<string, CurriculumRecord> {
  if (rows.length === 0) {
    return {};
  }
  
  // First row is headers
  const headers = rows[0];
  const standardCodeIndex = headers.findIndex(h => 
    h.toLowerCase().includes('standard_code') || 
    h === 'standard_code - use as standard for content generation'
  );
  
  if (standardCodeIndex === -1) {
    console.error('Could not find standard_code column in CSV');
    return {};
  }
  
  // Build a map of header name to index
  const headerMap: Record<string, number> = {};
  headers.forEach((header, index) => {
    headerMap[header] = index;
  });
  
  // Parse data rows and index by standard_code
  const curriculum: Record<string, CurriculumRecord> = {};
  
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < headers.length) {
      continue; // Skip incomplete rows
    }
    
    const standardCode = row[standardCodeIndex]?.trim();
    if (!standardCode) {
      continue; // Skip rows without standard code
    }
    
    const record: CurriculumRecord = {
      name: row[headerMap['name']] || '',
      label: row[headerMap['label']] || '',
      standard_code: standardCode,
      standard: row[headerMap['standard (description where available)']] || row[headerMap['standard']] || '',
      question_type: row[headerMap['question_type']] || '',
      question_planning: row[headerMap['question_planning']] || '',
      skill_code: row[headerMap['skill_code']] || '',
      id: row[headerMap['id']] || '',
      general_info: row[headerMap['general_info']] || '',
      boundaries: row[headerMap['boundaries']] || '',
      description: row[headerMap['description']] || '',
      subtopics: row[headerMap['subtopics']] || '',
      guidelines: row[headerMap['guidelines']] || '',
      subtopic_instruction_focus: row[headerMap['subtopic_instruction_focus']] || '',
    };
    
    curriculum[standardCode] = record;
  }
  
  console.log(`[CurriculumContext] Loaded ${Object.keys(curriculum).length} curriculum records`);
  return curriculum;
}

interface CurriculumProviderProps {
  children: ReactNode;
}

export const CurriculumProvider: React.FC<CurriculumProviderProps> = ({ children }) => {
  const [curriculum, setCurriculum] = useState<Record<string, CurriculumRecord>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    let isMounted = true;
    
    const loadCurriculum = async () => {
      try {
        console.log('[CurriculumContext] Loading Reading_Curriculum.csv...');
        setIsLoading(true);
        
        // Fetch the CSV file from the public assets
        const response = await fetch('/src/data/Reading_Curriculum.csv');
        
        if (!response.ok) {
          throw new Error(`Failed to load CSV: ${response.status} ${response.statusText}`);
        }
        
        const csvText = await response.text();
        console.log('[CurriculumContext] CSV loaded, parsing...');
        
        // Parse CSV
        const rows = parseCSV(csvText);
        console.log(`[CurriculumContext] Parsed ${rows.length} rows`);
        
        // Convert to indexed records
        const records = parseCurriculumRecords(rows);
        
        // Populate blocked Common Core standards
        populateBlockedCommonCoreStandards(rows);
        
        if (isMounted) {
          setCurriculum(records);
          setIsLoading(false);
          console.log('[CurriculumContext] Curriculum loaded successfully');
        }
      } catch (err) {
        console.error('[CurriculumContext] Error loading curriculum:', err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load curriculum data');
          setIsLoading(false);
        }
      }
    };
    
    loadCurriculum();
    
    return () => {
      isMounted = false;
    };
  }, []);
  
  const getCurriculumByStandard = (standardCode: string): CurriculumRecord | undefined => {
    return curriculum[standardCode];
  };
  
  const value: CurriculumContextType = {
    curriculum,
    isLoading,
    error,
    getCurriculumByStandard,
  };
  
  return (
    <CurriculumContext.Provider value={value}>
      {children}
    </CurriculumContext.Provider>
  );
};

/**
 * Hook to access curriculum data
 */
export const useCurriculum = (): CurriculumContextType => {
  const context = useContext(CurriculumContext);
  if (context === undefined) {
    throw new Error('useCurriculum must be used within a CurriculumProvider');
  }
  return context;
};









