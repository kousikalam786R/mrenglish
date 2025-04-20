export interface User {
  _id: string;
  name: string;
  email: string;
  profilePic?: string;
}

export interface Message {
  _id: string;
  sender: User | string;
  receiver: User | string;
  content: string;
  read: boolean;
  createdAt: string;
}

export interface ChatUser extends User {
  unreadCount: number;
  lastMessage?: Message;
  isOnline?: boolean;
}

export interface MessageState {
  messages: Message[];
  loading: boolean;
  error: string | null;
  selectedChat: ChatUser | null;
  recentChats: ChatUser[];
  typingUsers: Record<string, boolean>;
} 