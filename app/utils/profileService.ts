import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { API_ENDPOINTS, API_URL, DIRECT_IP } from './config';
import { getAuthToken } from './authUtils';
import axios from 'axios';

// Declare the global property for TypeScript
declare global {
  // eslint-disable-next-line no-var
  var _successfulApiBaseUrl: string | undefined;
}

/**
 * Returns the appropriate API URL based on environment and connectivity tests
 */
const getApiUrl = (endpoint: string): string => {
  try {
    // If we have a successful API URL from connectivity test, use it
    if (global._successfulApiBaseUrl) {
      // Extract the path from the endpoint
      let path = endpoint;
      
      // If the endpoint includes /api/ already, extract just the path portion
      if (endpoint.includes('/api/')) {
        path = endpoint.split('/api/')[1];
      } else if (endpoint.startsWith('/')) {
        // If it's a relative path starting with /, remove the leading /
        path = endpoint.substring(1);
      }
      
      // Build the new URL using the successful base URL
      const finalUrl = `${global._successfulApiBaseUrl}/api/${path}`;
      console.log(`Using successful API URL: ${finalUrl}`);
      return finalUrl;
    }
    
    // Fallback for Android emulators
    if (Platform.OS === 'android') {
      // Try the direct IP that has been working
      const directIpUrl = `http://192.168.29.151:5000/api/${endpoint.replace(/^\/+/, '')}`;
      console.log(`Falling back to direct IP URL: ${directIpUrl}`);
      return directIpUrl;
    }
    
    // Default fallback to the configured API URL
    console.log(`Falling back to default API URL: ${API_URL}${endpoint}`);
    return API_URL + endpoint;
  } catch (error) {
    console.error('Error in getApiUrl:', error);
    return API_URL + endpoint;
  }
};

/**
 * Get authentication headers for API requests
 */
const getHeaders = async () => {
  const token = await getAuthToken();
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
};

// Interface for user profile data
export interface UserProfile {
  _id?: string;
  name?: string;
  email?: string;
  profilePic?: string;
  level?: string;
  points?: number;
  streak?: number;
  calls?: number;
  minutes?: number;
  interests?: string[];
  bio?: string;
  country?: string;
  recentActivity?: Array<{
    text: string;
    time: string;
  }>;
}

/**
 * Get current user profile
 */
export const getUserProfile = async (): Promise<UserProfile | null> => {
  try {
    const token = await getAuthToken();
    if (!token) {
      console.error('No token found for profile fetch');
      return null;
    }
    
    // The endpoint should just be USER not USER/me
    const url = getApiUrl(`${API_ENDPOINTS.USER}`);
    console.log('Fetching user profile from:', url);
    
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error fetching profile:', errorText);
        return null;
      }
      
      const data = await response.json();
      return data.user || data;
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      // Check if it's a timeout/network error
      if (fetchError.name === 'AbortError') {
        console.error('Request timed out when fetching profile');
      } else {
        console.error('Fetch error:', fetchError);
      }
      
      // Try alternate endpoint as fallback
      return await getUserProfileAlternate();
    }
  } catch (error) {
    console.error('Error getting user profile:', error);
    return null;
  }
};

/**
 * Alternative profile fetch method using /me endpoint
 */
export const getUserProfileAlternate = async () => {
  try {
    // Use empty string instead of /me since the endpoint already includes it
    const response = await axios.get(getApiUrl('/api/users/me'), {
      headers: await getHeaders(),
    });
    return response.data;
  } catch (error) {
    console.error('Error in getUserProfileAlternate:', error);
    return null;
  }
};

/**
 * Update user profile
 */
export const updateUserProfile = async (profileData: Partial<UserProfile>): Promise<UserProfile | null> => {
  try {
    const token = await getAuthToken();
    if (!token) {
      console.error('No token found for profile update');
      return null;
    }
    
    // Use the correct API endpoint
    const url = getApiUrl(`${API_ENDPOINTS.USER}`);
    console.log('Updating user profile at:', url);
    
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout for updates
    
    try {
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(profileData),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error updating profile:', errorText);
        return null;
      }
      
      const data = await response.json();
      
      // Update local storage with new profile data
      try {
        const userJson = await AsyncStorage.getItem('user');
        if (userJson) {
          const user = JSON.parse(userJson);
          const updatedUser = { ...user, ...profileData };
          await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
        }
      } catch (storageError) {
        console.error('Error updating local profile data:', storageError);
      }
      
      return data.user || data;
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      // Check if it's a timeout/network error
      if (fetchError.name === 'AbortError') {
        console.error('Request timed out when updating profile');
      } else {
        console.error('Fetch error during profile update:', fetchError);
      }
      
      return null;
    }
  } catch (error) {
    console.error('Error updating user profile:', error);
    return null;
  }
};

/**
 * Update user profile picture
 */
export const updateProfilePicture = async (imageUri: string): Promise<UserProfile | null> => {
  try {
    const token = await getAuthToken();
    if (!token) {
      console.error('No token found for profile picture update');
      return null;
    }
    
    // Create form data for image upload
    const formData = new FormData();
    formData.append('profilePic', {
      uri: imageUri,
      type: 'image/jpeg',
      name: 'profile.jpg'
    } as any);
    
    // Use the correct API endpoint with /profile-picture suffix
    const url = getApiUrl(`${API_ENDPOINTS.USER}/profile-picture`);
    console.log('Updating profile picture at:', url);
    
    // Add timeout to prevent hanging requests - longer timeout for image upload
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout for image uploads
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        },
        body: formData,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error updating profile picture:', errorText);
        return null;
      }
      
      const data = await response.json();
      
      // Update local storage with new profile picture
      try {
        const userJson = await AsyncStorage.getItem('user');
        if (userJson) {
          const user = JSON.parse(userJson);
          const updatedUser = { ...user, profilePic: data.profilePic || data.user?.profilePic };
          await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
        }
      } catch (storageError) {
        console.error('Error updating local profile picture:', storageError);
      }
      
      return data.user || data;
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      // Check if it's a timeout/network error
      if (fetchError.name === 'AbortError') {
        console.error('Request timed out when uploading profile picture');
      } else {
        console.error('Fetch error during profile picture upload:', fetchError);
      }
      
      return null;
    }
  } catch (error) {
    console.error('Error updating profile picture:', error);
    return null;
  }
};

/**
 * Tests connectivity to various possible API endpoints and returns the successful one
 */
const testApiConnection = async (): Promise<string | null> => {
  try {
    // Set up URLs to try, prioritize direct IP for Android
    const urlsToTry: string[] = [];
    const DIRECT_IP = '192.168.29.151'; // Direct IP that seems to work

    // Add the direct IP first for Android
    if (Platform.OS === 'android') {
      urlsToTry.push(`http://${DIRECT_IP}:5000`);
    }
    
    // Then add the standard emulator URLs
    urlsToTry.push(
      'http://10.0.2.2:5000',  // Standard Android emulator
      'http://10.0.3.2:5000',  // Genymotion
      API_URL
    );

    // Add the direct IP as a fallback for iOS as well
    if (Platform.OS === 'ios' && !urlsToTry.includes(`http://${DIRECT_IP}:5000`)) {
      urlsToTry.push(`http://${DIRECT_IP}:5000`);
    }

    console.log('Testing connectivity to API URLs:', urlsToTry);

    // Test each URL with a 3-second timeout
    for (const url of urlsToTry) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        console.log(`Testing connectivity to ${url}/health...`);
        const response = await fetch(`${url}/health`, { 
          method: 'GET',
          signal: controller.signal 
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          console.log(`Successfully connected to ${url}`);
          // Store the successful base URL globally for future API calls
          global._successfulApiBaseUrl = url;
          console.log(`Stored successful API base URL: ${url}`);
          return url;
        } else {
          console.log(`Got response from ${url} but status was ${response.status}`);
        }
      } catch (error) {
        console.log(`Failed to connect to ${url}:`, error);
      }
    }

    console.log('All connectivity tests failed');
    return null;
  } catch (error) {
    console.error('Error testing API connectivity:', error);
    return null;
  }
}; 