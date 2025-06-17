import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChatUser } from '../types/Message';

// Auth stack parameter list
export type AuthStackParamList = {
  Welcome: undefined;
  SignIn: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
};

// Main app navigation parameter list
export type AppStackParamList = {
  Home: undefined;
  Lobby: undefined;
  Chats: undefined;
  Ranking: undefined;
  Contacts: undefined;
  Profile: undefined;
  EditProfile: { userData: any };
  UserProfile: { userId: string; userName: string };
  AIChat: { conversationId?: string; topic?: string; level?: string; isVoiceChat?: boolean };
  VoiceChat: { conversationId?: string; topic?: string; level?: string };
  AIConversations: undefined;
  NetworkDebug: undefined;
};

// Stack parameter lists for nested navigators
export type ChatsStackParamList = {
  ChatsMain: undefined;
  ChatDetail: { id: string; name: string; avatar?: string; user?: ChatUser };
  Call: { id: string; name: string; isVideoCall?: boolean; topic?: string; level?: string };
  AICallScreen: { id: string; name: string; isVideoCall?: boolean; topic?: string; level?: string };
  CallScreen: { id: string; name: string; isVideoCall?: boolean; avatar?: string };
};

export type ContactsStackParamList = {
  ContactsMain: undefined;
  ChatDetail: { id: string; name: string; avatar?: string; user?: ChatUser };
  Call: { id: string; name: string; isVideoCall?: boolean; topic?: string; level?: string };
  AICallScreen: { id: string; name: string; isVideoCall?: boolean; topic?: string; level?: string };
  CallScreen: { id: string; name: string; isVideoCall?: boolean; avatar?: string };
};

// Combined parameter list for root navigation
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Splash: undefined;
} & AuthStackParamList & AppStackParamList & ChatsStackParamList & ContactsStackParamList;

// Navigation prop types
export type AuthScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList>;
export type AppScreenNavigationProp = NativeStackNavigationProp<AppStackParamList>;
export type ChatsStackNavigationProp = NativeStackNavigationProp<ChatsStackParamList>;
export type ContactsStackNavigationProp = NativeStackNavigationProp<ContactsStackParamList>;
export type RootScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Route prop types
export type ChatDetailRouteProp = RouteProp<RootStackParamList, 'ChatDetail'>;
export type CallRouteProp = RouteProp<RootStackParamList, 'Call'>;
export type AICallScreenRouteProp = RouteProp<RootStackParamList, 'AICallScreen'>;
export type CallScreenRouteProp = RouteProp<RootStackParamList, 'CallScreen'>;
export type UserProfileRouteProp = RouteProp<RootStackParamList, 'UserProfile'>;
export type VoiceChatRouteProp = RouteProp<RootStackParamList, 'VoiceChat'>; 