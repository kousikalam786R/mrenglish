import { createAsyncThunk } from '@reduxjs/toolkit';
import { socketEmit, socketOn, socketOff } from '../../utils/socketService';
import { 
  setIsTyping, 
  setConversations, 
  setCurrentConversation, 
  addMessageToConversation, 
  setLoading, 
  setError,
  Conversation
} from '../slices/aiSlice';
import apiClient from '../../utils/apiClient';
import { RootState } from '../store';

interface MessageOptions {
  language?: string;
  level?: string;
  topic?: string;
  conversationType?: string;
}

interface SendMessagePayload {
  message: string;
  conversationId?: string;
  options?: MessageOptions;
}

/**
 * Send a message to the AI assistant via WebSocket
 */
export const sendAIMessage = createAsyncThunk<
  { conversationId: string },
  SendMessagePayload,
  { state: RootState }
>(
  'ai/sendMessage',
  async ({ message, conversationId, options }, { dispatch, rejectWithValue }) => {
    try {
      dispatch(setLoading(true));
      
      // Prepare the request data
      const requestData = {
        message,
        conversationId,
        options
      };
      
      // Send the message via API client
      const response = await apiClient.post('/ai/chat', requestData);
      
      // Set the AI as typing to show the loading indicator
      dispatch(setIsTyping(true));
      
      // Set up a listener for the AI response
      socketOn('ai:response', (data) => {
        if (data.conversationId === response.data.conversationId) {
          // Add the AI's message to the conversation
          dispatch(addMessageToConversation({
            id: data.messageId,
            text: data.content,
            isAI: true,
            timestamp: data.timestamp
          }));
          
          // Set the AI as no longer typing
          dispatch(setIsTyping(false));
          
          // Remove the listener after receiving the response
          socketOff('ai:response');
        }
      });
      
      // Set the current conversation
      dispatch(setCurrentConversation(response.data.conversation));
      
      // Add the user's message to the conversation
      dispatch(addMessageToConversation({
        id: response.data.messageId,
        text: message,
        isAI: false,
        timestamp: new Date().toISOString()
      }));
      
      dispatch(setLoading(false));
      return { conversationId: response.data.conversationId };
    } catch (error: any) {
      console.error('Error sending AI message:', error);
      dispatch(setIsTyping(false));
      dispatch(setLoading(false));
      dispatch(setError(error.response?.data?.message || 'Failed to send message'));
      return rejectWithValue(error.response?.data || { message: 'Network error' });
    }
  }
);

/**
 * Fetch a specific conversation by ID
 */
export const fetchConversation = createAsyncThunk<
  Conversation,
  string,
  { state: RootState }
>(
  'ai/fetchConversation',
  async (conversationId, { dispatch, rejectWithValue }) => {
    try {
      dispatch(setLoading(true));
      
      const response = await apiClient.get(`/ai/conversations/${conversationId}`);
      
      dispatch(setCurrentConversation(response.data));
      dispatch(setLoading(false));
      return response.data;
    } catch (error: any) {
      console.error('Error fetching conversation:', error);
      dispatch(setLoading(false));
      dispatch(setError(error.response?.data?.message || 'Failed to load conversation'));
      return rejectWithValue(error.response?.data || { message: 'Network error' });
    }
  }
);

/**
 * Fetch all conversations for the current user
 */
export const fetchConversations = createAsyncThunk<
  Conversation[],
  void,
  { state: RootState }
>(
  'ai/fetchConversations',
  async (_, { dispatch, rejectWithValue }) => {
    try {
      dispatch(setLoading(true));
      
      const response = await apiClient.get('/ai/conversations');
      
      dispatch(setConversations(response.data));
      dispatch(setLoading(false));
      return response.data;
    } catch (error: any) {
      console.error('Error fetching conversations:', error);
      dispatch(setLoading(false));
      dispatch(setError(error.response?.data?.message || 'Failed to load conversations'));
      return rejectWithValue(error.response?.data || { message: 'Network error' });
    }
  }
);

/**
 * Delete a conversation
 */
export const deleteConversation = createAsyncThunk<
  { success: boolean, conversationId: string },
  string,
  { state: RootState }
>(
  'ai/deleteConversation',
  async (conversationId, { dispatch, rejectWithValue }) => {
    try {
      dispatch(setLoading(true));
      
      await apiClient.delete(`/ai/conversations/${conversationId}`);
      
      // Refresh the conversations list
      dispatch(fetchConversations());
      
      dispatch(setLoading(false));
      return { success: true, conversationId };
    } catch (error: any) {
      console.error('Error deleting conversation:', error);
      dispatch(setLoading(false));
      dispatch(setError(error.response?.data?.message || 'Failed to delete conversation'));
      return rejectWithValue(error.response?.data || { message: 'Network error' });
    }
  }
); 