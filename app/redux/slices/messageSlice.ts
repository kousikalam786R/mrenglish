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
      
      // Check if message already exists by exact ID
      const existingMessageIndex = state.messages[chatId].findIndex(msg => msg._id === message._id);
      
      if (existingMessageIndex >= 0) {
        // Update existing message (replace optimistic with real message)
        state.messages[chatId][existingMessageIndex] = message;
        console.log(`🔄 Updated existing message ${message._id} with enhanced data:`, {
          status: message.status,
          deliveredAt: message.deliveredAt,
          readAt: message.readAt
        });
      } else {
        // Check if this is a real message replacing an optimistic one
        const optimisticIndex = state.messages[chatId].findIndex(msg => 
          msg._id.startsWith('local_') && 
          msg.content === message.content &&
          Math.abs(new Date(msg.createdAt).getTime() - new Date(message.createdAt).getTime()) < 5000
        );
        
        if (optimisticIndex >= 0) {
          // Replace optimistic message with real one
          state.messages[chatId][optimisticIndex] = message;
          console.log(`🔄 Replaced optimistic message with real message ${message._id}:`, {
            status: message.status,
            deliveredAt: message.deliveredAt,
            readAt: message.readAt
          });
        } else {
          // Add new message
          state.messages[chatId].push(message);
          console.log(`➕ Added new message ${message._id}:`, {
            status: message.status,
            deliveredAt: message.deliveredAt,
            readAt: message.readAt
          });
        }
        
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
    // Update message status
    updateMessageStatus: (state, action: PayloadAction<{ 
      messageId: string, 
      status: 'sent' | 'delivered' | 'read',
      timestamp?: string 
    }>) => {
      const { messageId, status, timestamp } = action.payload;
      
      // Find the message across all chats
      Object.keys(state.messages).forEach(chatId => {
        const messageIndex = state.messages[chatId].findIndex(msg => msg._id === messageId);
        if (messageIndex >= 0) {
          state.messages[chatId][messageIndex].status = status;
          
          // Update timestamps based on status
          if (status === 'delivered' && timestamp) {
            state.messages[chatId][messageIndex].deliveredAt = timestamp;
          } else if (status === 'read' && timestamp) {
            state.messages[chatId][messageIndex].readAt = timestamp;
            state.messages[chatId][messageIndex].read = true; // For backward compatibility
          }
        }
      });
    },
    // Update user status in recent chats
    updateUserStatus: (state, action: PayloadAction<{ 
      userId: string, 
      isOnline: boolean,
      lastSeenAt?: string 
    }>) => {
      const { userId, isOnline, lastSeenAt } = action.payload;
      
      // Update user status in recent chats
      state.recentChats = state.recentChats.map(chat => {
        if (chat._id === userId) {
          return {
            ...chat,
            isOnline,
            lastSeenAt: lastSeenAt || chat.lastSeenAt
          };
        }
        return chat;
      });
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
  updateMessageStatus,
  updateUserStatus,
  clearChatData
} = messageSlice.actions;

export default messageSlice.reducer; 