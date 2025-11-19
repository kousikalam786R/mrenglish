import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_ENDPOINTS, API_URL, DIRECT_IP, USING_NGROK } from './config';
import { Message, ChatUser } from '../types/Message';
import { Platform } from 'react-native';
import { isValidObjectId } from './validationUtils';

// Helper function to get the correct API endpoint based on platform
const getApiUrl = (endpoint: string): string => {
  if (USING_NGROK) {
    return endpoint;
  }

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
    console.log(`Fetching messages for receiver ID: ${receiverId}`);
    
    // Only check if ID is non-empty
    if (!receiverId) {
      console.warn(`Empty receiver ID. Returning empty message list.`);
      return []; // Return empty array instead of throwing error
    }
  
    const token = await getAuthToken();
    if (!token) {
      console.error('No auth token available for fetching messages');
      return [];
    }
    
    const url = getApiUrl(`${API_ENDPOINTS.MESSAGES}/conversations/${receiverId}`);
    console.log('Fetching messages from:', url);
    
    // Create abort controller with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache' // Prevent caching
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
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
        
        console.error(`Error fetching messages: ${errorMessage}`);
        
        // Try to load from cache as fallback
        const cachedMessages = await AsyncStorage.getItem(`messages_${receiverId}`);
        if (cachedMessages) {
          console.log(`Found cached messages for ${receiverId}, using those`);
          const messages = JSON.parse(cachedMessages);
          return messages;
        }
        
        throw new Error(errorMessage);
      }
      
      const messages = await response.json();
      console.log(`Successfully fetched ${messages.length} messages for chat ${receiverId}`);
      
      // Cache messages for offline use
      AsyncStorage.setItem(`messages_${receiverId}`, JSON.stringify(messages))
        .catch(err => console.error('Error caching messages:', err));
      
      return messages;
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        console.error('Request timed out when fetching messages');
      } else {
        console.error('Fetch error:', fetchError);
      }
      
      // Try to load from cache as fallback
      const cachedMessages = await AsyncStorage.getItem(`messages_${receiverId}`);
      if (cachedMessages) {
        console.log(`Found cached messages for ${receiverId} after fetch error, using those`);
        const messages = JSON.parse(cachedMessages);
        return messages;
      }
      
      throw fetchError;
    }
  } catch (error) {
    console.error('Error fetching messages:', error);
    return []; // Return empty array instead of throwing to avoid app crashes
  }
};

export const sendMessage = async (receiverId: string, content: string): Promise<Message> => {
  try {
    // Check for empty content
    if (!content || !content.trim()) {
      throw new Error('Message content cannot be empty');
    }
    
    // For any ID format - we'll let the server handle validation
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
    const userId = await AsyncStorage.getItem('userId');
    
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
    
    // Parse the response
    const rawData = await response.json();
    console.log('Recent chats raw data:', rawData);
    
    // Transform the server response format to match the expected ChatUser format
    const chats: ChatUser[] = rawData.map((item: any) => {
      // If the response follows the format with a user object 
      if (item.user && typeof item.user === 'object') {
        return {
          _id: item.user._id,
          name: item.user.name || 'Unknown User',
          email: item.user.email || '',
          profilePic: item.user.profilePic,
          unreadCount: item.unreadCount || 0,
          lastMessage: item.lastMessage,
          isOnline: false // Default to false, will be updated by socket events
        };
      } 
      // If the item itself is the user object
      else if (item._id) {
        return {
          ...item,
          unreadCount: item.unreadCount || 0,
          isOnline: false
        };
      }
      // Fallback for unexpected formats
      else {
        console.warn('Unexpected chat item format:', item);
        return {
          _id: item._id || 'unknown-id',
          name: 'Unknown User',
          email: '',
          unreadCount: 0,
          isOnline: false
        };
      }
    });
    
    // Filter out any chats where the user ID matches the current user
    const filteredChats = chats.filter(chat => chat._id !== userId);
    console.log(`Filtered out ${chats.length - filteredChats.length} self-chats`);
    
    // Sort chats by last message time (newest first)
    const sortedChats = filteredChats.sort((a, b) => {
      const aTime = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
      const bTime = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
      return bTime - aTime; // Descending order (newest first)
    });
    
    console.log(`Sorted ${sortedChats.length} chats by last message time`);
    
    // Cache the transformed chats
    AsyncStorage.setItem('recentChats', JSON.stringify(sortedChats))
      .catch(err => console.error('Error caching chats:', err));
    
    return sortedChats;
  } catch (error) {
    console.error('Error fetching recent chats:', error);
    throw error;
  }
}; 