import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from 'jwt-decode';

// JWT payload interface
interface JwtPayload {
  id?: string;
  userId?: string;
  sub?: string;
  exp?: number;
  // Add other fields as needed for your JWT
}

/**
 * Get authentication token from storage
 * Checks multiple possible token keys
 */
export const getAuthToken = async (): Promise<string | null> => {
  try {
    // Try primary token key
    let token = await AsyncStorage.getItem('token');
    
    // Try alternate token key if primary not found
    if (!token) {
      token = await AsyncStorage.getItem('auth_token');
    }
    
    return token;
  } catch (error) {
    console.error('Error retrieving auth token:', error);
    return null;
  }
};

/**
 * Check if the user is authenticated
 */
export const isAuthenticated = async (): Promise<boolean> => {
  const token = await getAuthToken();
  return !!token;
};

/**
 * Get the user ID from the JWT token
 */
export const getUserIdFromToken = async (): Promise<string | null> => {
  try {
    const token = await getAuthToken();
    if (!token) return null;
    
    // Decode the token
    const decoded = jwtDecode<JwtPayload>(token);
    
    // Different JWT libraries use different claim names for the user ID
    const userId = decoded.id || decoded.userId || decoded.sub;
    
    if (userId) {
      return String(userId);
    }
    
    // Fallback to stored userId
    return await AsyncStorage.getItem('userId');
  } catch (error) {
    console.error('Error getting user ID from token:', error);
    
    // Fallback to stored userId
    try {
      return await AsyncStorage.getItem('userId');
    } catch {
      return null;
    }
  }
};

/**
 * Save authentication data
 */
export const saveAuthData = async (token: string, userId?: string): Promise<void> => {
  try {
    // Store token in multiple formats for compatibility
    await AsyncStorage.setItem('token', token);
    await AsyncStorage.setItem('auth_token', token);
    
    // Try to get user ID from token if not provided
    if (!userId) {
      try {
        const decoded = jwtDecode<JwtPayload>(token);
        userId = String(decoded.id || decoded.userId || decoded.sub);
      } catch (error) {
        console.error('Error decoding token for user ID:', error);
      }
    }
    
    // Store user ID if available
    if (userId) {
      await AsyncStorage.setItem('userId', userId);
    }
  } catch (error) {
    console.error('Error saving auth data:', error);
  }
};

/**
 * Clear authentication data
 */
export const clearAuthData = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('auth_token');
    await AsyncStorage.removeItem('userId');
  } catch (error) {
    console.error('Error clearing auth data:', error);
  }
}; 