export interface User {
  _id: string;
  name: string;
  email: string;
  username?: string;
  profilePic?: string;
  // Enhanced presence tracking
  isOnline?: boolean;
  lastSeenAt?: string;
  isTyping?: boolean;
  typingInChat?: string;
}

export interface Message {
  _id: string;
  sender: User | string;
  receiver: User | string;
  content: string;
  read: boolean;
  createdAt: string;
  // Enhanced status tracking
  status?: 'sent' | 'delivered' | 'read';
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
}

export interface ChatUser extends User {
  unreadCount: number;
  lastMessage?: Message;
  isOnline?: boolean;
  user?: User;
  // Enhanced presence
  lastSeenAt?: string;
}

export interface MessageState {
  messages: Message[];
  loading: boolean;
  error: string | null;
  selectedChat: ChatUser | null;
  recentChats: ChatUser[];
  typingUsers: Record<string, boolean>;
} 