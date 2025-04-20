/**
 * Utility functions for validation
 */

/**
 * Validates if a string is a valid MongoDB ObjectID
 * MongoDB ObjectIDs are 24-character hexadecimal strings
 * 
 * @param id The ID string to validate
 * @returns true if the ID is a valid MongoDB ObjectID format
 */
export function isValidObjectId(id: string): boolean {
  if (!id || typeof id !== 'string') {
    return false;
  }
  
  // MongoDB ObjectIDs are 24 character hex strings
  return /^[0-9a-fA-F]{24}$/.test(id);
} 