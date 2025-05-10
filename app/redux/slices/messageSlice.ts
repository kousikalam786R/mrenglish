import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Message, ChatUser } from '../../types/Message';

// Define the messages state interface
interface MessageState {
  messages: Record<string, Message[]>; // Map of receiver ID to messages
  currentChat: string | null; // Current active chat ID
  recentChats: ChatUser[]; // List of recent chats
  loading: boolean;
  error: string | null;
  typingUsers: Record<string, boolean>; // Map of user IDs to typing status
}

// Define initial state
const initialState: MessageState = {
  messages: {},
  currentChat: null,
  recentChats: [],
  loading: false,
  error: null,
  typingUsers: {}
};

// Create the message slice
const messageSlice = createSlice({
  name: 'message',
  initialState,
  reducers: {
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    setCurrentChat: (state, action: PayloadAction<string>) => {
      state.currentChat = action.payload;
    },
    // For adding messages to a specific chat
    addMessages: (state, action: PayloadAction<{ chatId: string, messages: Message[] }>) => {
      const { chatId, messages } = action.payload;
      if (!state.messages[chatId]) {
        state.messages[chatId] = [];
      }
      // Add messages only if they don't already exist
      const existingIds = new Set(state.messages[chatId].map(msg => msg._id));
      messages.forEach(message => {
        if (!existingIds.has(message._id)) {
          state.messages[chatId].push(message);
        }
      });
      
      // Sort by createdAt date
      state.messages[chatId].sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    },
    // For adding a single message to a specific chat
    addMessage: (state, action: PayloadAction<{ chatId: string, message: Message }>) => {
      const { chatId, message } = action.payload;
      
      if (!state.messages[chatId]) {
        state.messages[chatId] = [];
      }
      
      // Check if message already exists
      const messageExists = state.messages[chatId].some(msg => msg._id === message._id);
      if (!messageExists) {
        state.messages[chatId].push(message);
        
        // Sort by createdAt date
        state.messages[chatId].sort((a, b) => 
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      }
    },
    // For updating recent chats list
    setRecentChats: (state, action: PayloadAction<ChatUser[]>) => {
      state.recentChats = action.payload;
    },
    // For updating a user's typing status
    setTypingStatus: (state, action: PayloadAction<{ userId: string, isTyping: boolean }>) => {
      const { userId, isTyping } = action.payload;
      state.typingUsers[userId] = isTyping;
    },
    // Mark messages as read
    markAsRead: (state, action: PayloadAction<{ chatId: string, messageIds: string[] }>) => {
      const { chatId, messageIds } = action.payload;
      if (state.messages[chatId]) {
        state.messages[chatId].forEach(message => {
          if (messageIds.includes(message._id)) {
            message.read = true;
          }
        });
      }
    },
    // Clear all chat data
    clearChatData: (state) => {
      state.messages = {};
      state.currentChat = null;
      state.recentChats = [];
      state.typingUsers = {};
    }
  }
});

// Export actions and reducer
export const { 
  setLoading, 
  setError, 
  setCurrentChat, 
  addMessages, 
  addMessage, 
  setRecentChats,
  setTypingStatus,
  markAsRead,
  clearChatData
} = messageSlice.actions;

export default messageSlice.reducer; 