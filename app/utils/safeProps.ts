/**
 * Utility functions to help prevent null reference errors
 */

/**
 * Safely get a nested property from an object without causing null/undefined errors
 * @param obj The object to get the property from
 * @param path The path to the property (e.g. 'user.profile.name')
 * @param defaultValue The default value to return if the property doesn't exist
 */
export function safeGet<T>(obj: any, path: string, defaultValue: T | null = null): T | null {
  if (!obj || !path) return defaultValue;
  
  const keys = path.split('.');
  let result = obj;
  
  for (const key of keys) {
    if (result === null || result === undefined || typeof result !== 'object') {
      return defaultValue;
    }
    result = result[key];
  }
  
  return (result === undefined || result === null) ? defaultValue : result;
}

/**
 * Safely call a function without causing errors if the function is null or undefined
 * @param fn The function to call
 * @param args The arguments to pass to the function
 */
export function safeCall<T>(fn: ((...args: any[]) => T) | null | undefined, ...args: any[]): T | null {
  if (typeof fn === 'function') {
    try {
      return fn(...args);
    } catch (error) {
      console.error('Error calling function:', error);
    }
  }
  return null;
}

/**
 * Creates a safe version of a component props object
 * @param props The props object
 */
export function safeProps<T extends object>(props: T | null | undefined): Partial<T> {
  if (!props) return {};
  return props;
}

/**
 * Safely access React Navigation parameters
 * @param route The route object from React Navigation
 * @param paramName The name of the parameter to get
 * @param defaultValue The default value to return if the parameter doesn't exist
 */
export function safeParam<T>(route: any, paramName: string, defaultValue: T): T {
  if (!route || !route.params) return defaultValue;
  const value = route.params[paramName];
  return (value === undefined || value === null) ? defaultValue : value;
}

export default {
  safeGet,
  safeCall,
  safeProps,
  safeParam
}; 