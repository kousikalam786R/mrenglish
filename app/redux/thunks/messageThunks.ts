import { createAsyncThunk } from '@reduxjs/toolkit';
import { 
  setLoading, 
  setError, 
  addMessages, 
  addMessage, 
  setRecentChats 
} from '../slices/messageSlice';
import { getMessages, sendMessage, getRecentChats } from '../../utils/messageService';
import socketService from '../../utils/socketService';
import { Message, ChatUser } from '../../types/Message';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isValidObjectId } from '../../utils/validationUtils';

// Thunk for fetching messages for a specific chat
export const fetchMessages = createAsyncThunk(
  'message/fetchMessages',
  async (receiverId: string, { dispatch }) => {
    try {
      dispatch(setLoading(true));
      dispatch(setError(null));
      
      // Allow any non-empty ID format
      if (!receiverId) {
        console.log(`Empty receiverId, returning empty messages array`);
        return [];
      }
      
      // Fetch messages from API
      const messages = await getMessages(receiverId);
      
      // Add messages to state
      dispatch(addMessages({ chatId: receiverId, messages }));
      
      return messages;
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to fetch messages';
      console.error('Error fetching messages:', errorMessage);
      dispatch(setError(errorMessage));
      // Return empty array instead of throwing to prevent app crashes
      return [];
    } finally {
      dispatch(setLoading(false));
    }
  }
);

// Thunk for sending a new message
export const sendNewMessage = createAsyncThunk(
  'message/sendNewMessage',
  async ({ receiverId, content }: { receiverId: string, content: string }, { dispatch }) => {
    try {
      // Get current user ID
      const userId = await AsyncStorage.getItem('userId');
      if (!userId) {
        throw new Error('User ID not found. Please log in again.');
      }
      
      // Create an optimistic message with enhanced fields
      const optimisticMessage: Message = {
        _id: `local_${Date.now()}`,
        content: content.trim(),
        sender: userId,
        receiver: receiverId,
        createdAt: new Date().toISOString(),
        read: false,
        // Enhanced fields for optimistic message
        status: 'sent',
        sentAt: new Date().toISOString()
      };
      
      // Add optimistic message to state
      dispatch(addMessage({ chatId: receiverId, message: optimisticMessage }));
      
      // Send the message through socket and wait for confirmation
      try {
        const result = await socketService.sendPrivateMessage(receiverId, content.trim());
        
        // If we got a real message back from the server, replace the optimistic one
        if (result && result.message) {
          console.log('🔄 Replacing optimistic message with real message:', {
            optimisticId: optimisticMessage._id,
            realId: result.message._id,
            status: result.message.status,
            deliveredAt: result.message.deliveredAt
          });
          
          // Replace the optimistic message with the real one
          dispatch(addMessage({ chatId: receiverId, message: result.message }));
        }
        
        return result.message || optimisticMessage;
      } catch (error) {
        console.error('Error sending message via socket:', error);
        throw error;
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to send message';
      console.error('Error sending message:', errorMessage);
      dispatch(setError(errorMessage));
      throw error;
    }
  }
);

// Thunk for fetching recent chats
export const fetchRecentChats = createAsyncThunk(
  'message/fetchRecentChats',
  async (_, { dispatch }) => {
    try {
      dispatch(setLoading(true));
      
      // Call the actual API service to get recent chats
      const { getRecentChats } = await import('../../utils/messageService');
      
      try {
        console.log('Fetching recent chats from API...');
        const recentChats = await getRecentChats();
        console.log(`Successfully fetched ${recentChats.length} chats`);
        
        // Update Redux state with chats
        dispatch(setRecentChats(recentChats));
        return recentChats;
      } catch (apiError: any) {
        console.error('API error fetching chats:', apiError.message);
        
        // Check for cached chats as a fallback
        try {
          const cachedChatsJson = await AsyncStorage.getItem('recentChats');
          if (cachedChatsJson) {
            const cachedChats: ChatUser[] = JSON.parse(cachedChatsJson);
            console.log(`Using ${cachedChats.length} cached chats`);
            dispatch(setRecentChats(cachedChats));
            return cachedChats;
          }
        } catch (cacheError) {
          console.error('Error reading cached chats:', cacheError);
        }
        
        // If API call fails and no cache, return empty array
        dispatch(setRecentChats([]));
        return [];
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to fetch recent chats';
      console.error('Error fetching recent chats:', errorMessage);
      dispatch(setError(errorMessage));
      dispatch(setRecentChats([]));
      return [];
    } finally {
      dispatch(setLoading(false));
    }
  }
);

// Handle new message from socket
export const handleSocketMessage = (message: Message) => async (dispatch: any, getState: any) => {
  try {
    console.log('Received new socket message:', message);
    console.log('🔍 Enhanced message data:', {
      id: message._id,
      status: message.status || 'undefined',
      sentAt: message.sentAt || 'undefined',
      deliveredAt: message.deliveredAt || 'undefined',
      readAt: message.readAt || 'undefined',
      read: message.read
    });
    
    // Extract chat ID based on message direction
    const userId = await AsyncStorage.getItem('userId');
    if (!userId) {
      console.error('No user ID found for socket message handling');
      return;
    }
    
    // Determine if this is an incoming or outgoing message
    const senderId = typeof message.sender === 'object' ? message.sender._id : message.sender;
    const receiverId = typeof message.receiver === 'object' ? message.receiver._id : message.receiver;
    
    // For incoming messages, the chat ID is the sender's ID
    // For outgoing messages, the chat ID is the receiver's ID
    const chatId = senderId === userId ? receiverId : senderId;
    console.log(`Adding message to chat ${chatId} (current user: ${userId})`);
    
    // Add message to the appropriate chat
    dispatch(addMessage({ chatId, message }));
    
    // Get the current state to update recent chats
    const state = getState();
    const { recentChats, currentChat } = state.message;
    
    // Find if we already have a chat with this user
    const existingChatIndex = recentChats.findIndex((chat: ChatUser) => chat._id === chatId);
    
    if (existingChatIndex >= 0) {
      console.log(`🔄 Updating existing chat at index ${existingChatIndex} for user ${chatId}`);
      
      // Update existing chat with new message
      const updatedChats = [...recentChats];
      updatedChats[existingChatIndex] = {
        ...updatedChats[existingChatIndex],
        lastMessage: message,
        // Increment unread count if it's an incoming message, not from current user,
        // and not in the currently active chat
        unreadCount: (senderId !== userId && currentChat !== chatId)
          ? (updatedChats[existingChatIndex].unreadCount || 0) + 1 
          : updatedChats[existingChatIndex].unreadCount || 0
      };
      
      // Sort chats by newest message first
      updatedChats.sort((a, b) => {
        const aTime = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
        const bTime = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
        return bTime - aTime;
      });
      
      console.log(`📝 Updating recent chats with new message:`, {
        chatId,
        lastMessage: message.content,
        unreadCount: updatedChats[existingChatIndex].unreadCount
      });
      
      // Update state
      dispatch(setRecentChats(updatedChats));
      
      // Update cache
      AsyncStorage.setItem('recentChats', JSON.stringify(updatedChats))
        .catch(err => console.error('Error caching updated chats:', err));
    } else {
      console.log(`🆕 New chat detected for user ${chatId}, fetching updated chat list`);
      // If this is a new chat, fetch the updated chat list
      dispatch(fetchRecentChats());
    }
    
    // Message is already added to Redux state above, no need to fetch again
    console.log(`✅ Socket message handled successfully for chat ${chatId}`);
  } catch (error) {
    console.error('Error handling socket message:', error);
  }
}; 