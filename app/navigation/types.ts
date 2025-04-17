import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

// Auth stack parameter list
export type AuthStackParamList = {
  Home: undefined;
  SignIn: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
};

// Main app navigation parameter list
export type AppStackParamList = {
  Lobby: undefined;
  Chats: undefined;
  Ranking: undefined;
  Contacts: undefined;
  Profile: undefined;
};

// Stack parameter lists for nested navigators
export type ChatsStackParamList = {
  ChatsMain: undefined;
  ChatDetail: { id: string; name: string };
  Call: { id: string; name: string; isVideoCall?: boolean };
};

export type ContactsStackParamList = {
  ContactsMain: undefined;
  ChatDetail: { id: string; name: string };
  Call: { id: string; name: string; isVideoCall?: boolean };
};

// Combined parameter list for root navigation
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
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