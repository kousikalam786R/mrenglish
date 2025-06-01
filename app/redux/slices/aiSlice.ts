import { createSlice, PayloadAction } from '@reduxjs/toolkit';

// Define interfaces for type safety
export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string | Date;
}

export interface Conversation {
  _id?: string;
  title?: string;
  messages: Message[];
  createdAt?: string;
  updatedAt?: string;
}

export interface AIState {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  isTyping: boolean;
  loading: boolean;
  error: string | null;
}

// Define the initial state
const initialState: AIState = {
  conversations: [],
  currentConversation: null,
  isTyping: false,
  loading: false,
  error: null
};

// Create the AI slice
const aiSlice = createSlice({
  name: 'ai',
  initialState,
  reducers: {
    setConversations: (state, action: PayloadAction<Conversation[]>) => {
      state.conversations = action.payload;
    },
    setCurrentConversation: (state, action: PayloadAction<Conversation>) => {
      state.currentConversation = action.payload;
    },
    addMessageToConversation: (state, action: PayloadAction<{
      id?: string; 
      text: string; 
      isAI: boolean; 
      timestamp: string | Date;
    }>) => {
      // If we have a current conversation
      if (state.currentConversation) {
        // Add the new message to the messages array
        if (!state.currentConversation.messages) {
          state.currentConversation.messages = [];
        }
        
        state.currentConversation.messages.push({
          role: action.payload.isAI ? 'assistant' : 'user',
          content: action.payload.text,
          timestamp: action.payload.timestamp
        });
      }
    },
    setIsTyping: (state, action: PayloadAction<boolean>) => {
      state.isTyping = action.payload;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    }
  }
});

// Export actions and reducer
export const {
  setConversations,
  setCurrentConversation,
  addMessageToConversation,
  setIsTyping,
  setLoading,
  setError,
  clearError
} = aiSlice.actions;

export default aiSlice.reducer; 