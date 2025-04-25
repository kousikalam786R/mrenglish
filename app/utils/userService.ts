import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { API_ENDPOINTS, API_URL, DIRECT_IP } from './config';
import { User } from '../types/Message';

// Helper function to get the correct API endpoint based on platform
const getApiUrl = (endpoint: string): string => {
  if (Platform.OS === 'android') {
    // Replace the base URL with the direct LAN IP for Android
    return endpoint.replace(API_URL, `http://${DIRECT_IP}:5000/api`);
  }
  return endpoint;
};

// Helper function to get auth token
async function getAuthToken(): Promise<string> {
  // Try to get token from multiple possible storage keys
  let token = await AsyncStorage.getItem('token');
  
  if (!token) {
    // Try alternate token key
    token = await AsyncStorage.getItem('auth_token');
  }
  
  if (!token) {
    throw new Error('No authentication token found');
  }
  
  return token;
}

/**
 * Fetch all users from the database except the current user
 */
export const getAllUsers = async (): Promise<User[]> => {
  try {
    const token = await getAuthToken();
    const currentUser = await AsyncStorage.getItem('user');
    let currentUserId = '';
    
    if (currentUser) {
      try {
        const userData = JSON.parse(currentUser);
        currentUserId = userData._id || '';
        console.log('Current user ID from storage:', currentUserId);
      } catch (e) {
        console.error('Error parsing current user data:', e);
      }
    }
    
    if (!currentUserId) {
      currentUserId = await AsyncStorage.getItem('userId') || '';
      console.log('Current user ID from userId key:', currentUserId);
    }
    
    // Construct URL for fetching users - IMPORTANT: Fix the URL
    // The correct endpoint might be /api/auth/users or /api/users
    const url = getApiUrl(`${API_ENDPOINTS.USER}s`); // Add 's' to make it /api/auth/users
    console.log('Fetching users from:', url);
    console.log('Using token (first 10 chars):', token.substring(0, 10) + '...');
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      // Even if response is not OK, try to get the response text for debugging
      const responseText = await response.text();
      console.log('Response status:', response.status);
      console.log('Response text preview:', responseText.substring(0, 200) + '...');
      
      if (!response.ok) {
        console.error('Failed to fetch users. Status:', response.status);
        console.error('Response:', responseText);
        
        // Try alternate endpoint as fallback
        return await fetchUsersAlternate(token, currentUserId);
      }
      
      let users = [];
      try {
        users = JSON.parse(responseText);
        console.log('Successfully parsed user data, found', users.length, 'users');
      } catch (e) {
        console.error('Error parsing users response:', e);
        return await fetchUsersAlternate(token, currentUserId);
      }
      
      // If no users are returned, try using fallback
      if (!users || users.length === 0) {
        console.log('No users returned from API, trying alternate endpoint');
        return await fetchUsersAlternate(token, currentUserId);
      }
      
      // Filter out current user and log the results
      const filteredUsers = users.filter((user: User) => user._id !== currentUserId);
      console.log('Filtered users count:', filteredUsers.length);
      
      // Make sure all user objects have required fields
      const validatedUsers = filteredUsers.map((user: User) => ({
        _id: user._id,
        name: user.name || `User ${user._id.substring(0, 4)}`,
        email: user.email || `user-${user._id.substring(0, 4)}@example.com`,
        profilePic: user.profilePic || `https://randomuser.me/api/portraits/men/${Math.floor(Math.random() * 50)}.jpg`
      }));
      
      return validatedUsers;
    } catch (fetchError) {
      console.error('Error during fetch operation:', fetchError);
      return await fetchUsersAlternate(token, currentUserId);
    }
  } catch (error) {
    console.error('Error in getAllUsers:', error);
    // Return fallback data
    return getFallbackUsers();
  }
};

// Fallback function to try different API endpoint
async function fetchUsersAlternate(token: string, currentUserId: string): Promise<User[]> {
  try {
    // Try alternate endpoint
    const alternateUrl = getApiUrl(`${API_URL}/users`);
    console.log('Trying alternate endpoint for users:', alternateUrl);
    
    const response = await fetch(alternateUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.error('Alternate endpoint also failed. Status:', response.status);
      return getFallbackUsers();
    }
    
    const users = await response.json();
    
    if (!users || users.length === 0) {
      console.log('No users from alternate endpoint either');
      return getFallbackUsers();
    }
    
    // Filter and validate
    const filteredUsers = users.filter((user: User) => user._id !== currentUserId);
    const validatedUsers = filteredUsers.map((user: User) => ({
      _id: user._id,
      name: user.name || `User ${user._id.substring(0, 4)}`,
      email: user.email || `user-${user._id.substring(0, 4)}@example.com`,
      profilePic: user.profilePic || `https://randomuser.me/api/portraits/men/${Math.floor(Math.random() * 50)}.jpg`
    }));
    
    return validatedUsers;
  } catch (error) {
    console.error('Error in alternate fetch:', error);
    return getFallbackUsers();
  }
}

// Get fallback users when all else fails
function getFallbackUsers(): User[] {
  console.log('Using fallback users');
  return [
    {
      _id: '65f2d76b1bcf0f79dc9ac01e', // Valid MongoDB ObjectId format
      name: 'John Doe (Test User)',
      email: 'john@example.com',
      profilePic: 'https://randomuser.me/api/portraits/men/1.jpg'
    },
    {
      _id: '65f2d76b1bcf0f79dc9ac01f', // Valid MongoDB ObjectId format
      name: 'Jane Smith (Test User)',
      email: 'jane@example.com',
      profilePic: 'https://randomuser.me/api/portraits/women/1.jpg'
    }
  ];
}

/**
 * Get user profile by ID
 */
export const getUserById = async (userId: string): Promise<User> => {
  try {
    if (!userId || userId === '0') {
      console.warn('Invalid userId provided:', userId);
      return createDummyUser(userId);
    }

    const token = await getAuthToken();
    
    // Construct URL for fetching user profile
    const url = getApiUrl(`${API_URL}/auth/users/${userId}`);
    console.log('Fetching user profile from:', url);
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      // Try to get response text even if request fails
      const responseText = await response.text();
      console.log('User profile response status:', response.status);
      
      if (!response.ok) {
        console.error('Error response text:', responseText);
        throw new Error('Failed to fetch user profile');
      }
      
      // Parse the response
      try {
        const userData = JSON.parse(responseText);
        return userData;
      } catch (parseError) {
        console.error('Error parsing user data:', parseError);
        throw new Error('Invalid user data format');
      }
    } catch (fetchError) {
      console.error('Fetch error in getUserById:', fetchError);
      return createDummyUser(userId);
    }
  } catch (error) {
    console.error('Error in getUserById:', error);
    return createDummyUser(userId);
  }
};

/**
 * Create a dummy user with valid ObjectID
 */
function createDummyUser(userId: string): User {
  // Use the userId if it's valid, otherwise use a fallback
  const isValidId = /^[0-9a-fA-F]{24}$/.test(userId);
  const id = isValidId ? userId : '65f2d76b1bcf0f79dc9ac01e';
  
  return {
    _id: id,
    name: `User ${id.substring(0, 4)}`,
    email: `user-${id.substring(0, 4)}@example.com`,
    profilePic: `https://randomuser.me/api/portraits/men/${Math.floor(Math.random() * 50)}.jpg`
  };
} 