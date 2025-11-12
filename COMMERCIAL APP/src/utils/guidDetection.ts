import { NRMElementData } from '../services/geminiService';

/**
 * GUID patterns:
 * - UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (8-4-4-4-12 hex digits)
 * - IFC GUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (similar to UUID)
 * - Short GUID: 22 characters base64-like
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IFC_GUID_PATTERN = /^[0-9a-zA-Z_$]{22}$/;
const GUID_LIKE_PATTERN = /^[0-9a-f-]{20,}$/i; // More lenient pattern

/**
 * Check if a value looks like a GUID
 */
const isGUIDLike = (value: string): boolean => {
  if (!value || typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed.length < 10) return false; // Too short to be a GUID
  
  // Check UUID pattern
  if (UUID_PATTERN.test(trimmed)) return true;
  
  // Check IFC GUID pattern (22 chars)
  if (IFC_GUID_PATTERN.test(trimmed)) return true;
  
  // Check GUID-like pattern (contains hyphens and hex-like chars)
  if (GUID_LIKE_PATTERN.test(trimmed) && trimmed.includes('-')) return true;
  
  return false;
};

/**
 * Calculate GUID score for a column (percentage of values that look like GUIDs)
 */
const calculateGUIDScore = (values: string[]): number => {
  if (values.length === 0) return 0;
  
  let guidCount = 0;
  for (const value of values) {
    if (isGUIDLike(String(value))) {
      guidCount++;
    }
  }
  
  return guidCount / values.length;
};

/**
 * Auto-detect column containing GUID-like values
 * Returns the column name with highest GUID score, or null if none found
 */
export const detectGUIDColumn = (data: NRMElementData[]): string | null => {
  if (!data || data.length === 0) return null;
  
  const columns = Object.keys(data[0]);
  if (columns.length === 0) return null;
  
  let bestColumn: string | null = null;
  let bestScore = 0;
  
  // Check each column
  for (const column of columns) {
    const values = data
      .map(row => row[column])
      .filter(val => val !== undefined && val !== null && val !== '');
    
    if (values.length === 0) continue;
    
    const score = calculateGUIDScore(values);
    
    // Prefer columns with at least 50% GUID-like values
    if (score >= 0.5 && score > bestScore) {
      bestScore = score;
      bestColumn = column;
    }
  }
  
  return bestColumn;
};

