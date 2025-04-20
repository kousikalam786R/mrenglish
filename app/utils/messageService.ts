import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_ENDPOINTS, API_URL, DIRECT_IP } from './config';
import { Message, ChatUser } from '../types/Message';
import { Platform } from 'react-native';
import { isValidObjectId } from './validationUtils';

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

export const getMessages = async (receiverId: string): Promise<Message[]> => {
  try {
    // Check if ID is valid MongoDB format
    if (!isValidObjectId(receiverId)) {
      console.warn(`Non-standard ID format: ${receiverId}. Returning empty message list.`);
      return []; // Return empty array instead of throwing error
    }
  
    const token = await getAuthToken();
    
    const url = getApiUrl(`${API_ENDPOINTS.MESSAGES}/conversations/${receiverId}`);
    console.log('Fetching messages from:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Server response:', response.status, errorText);
      let errorMessage = 'Failed to fetch messages';
      
      try {
        // Try to parse error as JSON
        const errorData = JSON.parse(errorText);
        if (errorData.message) {
          errorMessage = errorData.message;
        }
      } catch (parseError) {
        // If not valid JSON, use the text directly
        if (errorText) {
          errorMessage = errorText;
        }
      }
      
      throw new Error(errorMessage);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching messages:', error);
    throw error;
  }
};

export const sendMessage = async (receiverId: string, content: string): Promise<Message> => {
  try {
    // Check for empty content
    if (!content || !content.trim()) {
      throw new Error('Message content cannot be empty');
    }
    
    // For non-standard IDs, return a mock success response
    if (!isValidObjectId(receiverId)) {
      console.warn(`Cannot send message via API to non-standard ID: ${receiverId}`);
      console.log('Message will be handled via socket only');
      
      // Return a mock message object
      const mockMessage: Message = {
        _id: `local_${Date.now()}`,
        content: content.trim(),
        sender: await AsyncStorage.getItem('userId') || 'current-user',
        receiver: receiverId,
        createdAt: new Date().toISOString(),
        read: false
      };
      
      return mockMessage;
    }
    
    const token = await getAuthToken();
    
    const url = getApiUrl(`${API_ENDPOINTS.MESSAGES}/send`);
    console.log('Sending message to:', url);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ receiverId, content })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to send message');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
};

export const getRecentChats = async (): Promise<ChatUser[]> => {
  try {
    const token = await getAuthToken();
    
    const url = getApiUrl(`${API_ENDPOINTS.MESSAGES}/recent`);
    console.log('Fetching recent chats from:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to fetch recent chats');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching recent chats:', error);
    throw error;
  }
}; 