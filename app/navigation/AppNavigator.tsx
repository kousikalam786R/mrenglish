import React, { useState, useContext, useEffect, useMemo } from 'react';
import { NavigationContainer, DefaultTheme, Theme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NativeStackNavigationOptions, NativeStackNavigationEventMap } from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Text, View, StyleSheet, Platform } from 'react-native';
import ErrorBoundary from '../components/ErrorBoundary';
import { AuthContext, AuthContextType, useAuth } from './index';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppSelector, useAppDispatch } from '../redux/hooks';
import { checkAuthState } from '../redux/thunks/authThunks';
import { useSelector } from 'react-redux';
import { RootState } from '../redux/store';
import { CallStatus } from '../utils/callService';
import SplashScreen from '../screens/SplashScreen';
import { navigationRef, processQueuedActions } from './NavigationService';
import { useTheme } from '../context/ThemeContext';

// Screens
import LobbyScreen from '../screens/LobbyScreen';
import ChatsScreen from '../screens/ChatsScreen';
import RankingScreen from '../screens/RankingScreen';
import ContactsScreen from '../screens/ContactsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ChangePasswordScreen from '../screens/ChangePasswordScreen';
import DeleteAccountScreen from '../screens/DeleteAccountScreen';
import TermsOfServiceScreen from '../screens/TermsOfServiceScreen';
import PrivacyPolicyScreen from '../screens/PrivacyPolicyScreen';
import AboutScreen from '../screens/AboutScreen';
import PostCallFeedbackScreen from '../screens/PostCallFeedbackScreen';
import PostCallFlowScreen from '../screens/PostCallFlowScreen';
import ChatDetailScreen from '../screens/ChatDetailScreen';
import CallScreen from '../screens/CallScreen';
import AICallScreen from '../screens/AICallScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import AIChatScreen from '../screens/AIChatScreen';
import NetworkDebugScreen from '../screens/NetworkDebugScreen';

// Auth Screens
import HomeScreen from '../screens/HomeScreen';
import WelcomeScreen from '../screens/WelcomeScreen';
import SignInScreen from '../screens/SignInScreen';
import SignUpScreen from '../screens/SignUpScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import OnboardingScreen from '../screens/OnboardingScreen';

// Types
import { 
  AuthStackParamList, 
  AppStackParamList, 
  RootStackParamList,
  ChatsStackParamList,
  ContactsStackParamList
} from './types';

// Navigation theme will be created dynamically based on app theme

// Disable animations for Android to prevent UI frame errors
const screenOptions: NativeStackNavigationOptions = {
  headerShown: false,
  animation: Platform.OS === 'ios' ? 'default' : 'none',
  animationTypeForReplace: 'push',
};

const Tab = createBottomTabNavigator<AppStackParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const ChatsStack = createNativeStackNavigator<ChatsStackParamList>();
const ContactsStack = createNativeStackNavigator<ContactsStackParamList>();

// Wrap the tab screens with ErrorBoundary to prevent crashes
const TabScreen = ({ children }: { children: React.ReactNode }) => (
  <ErrorBoundary>
    {children}
  </ErrorBoundary>
);

// Simple stack navigators without animations
const ChatStackNavigator = () => {
  // Use platform-specific screen options to prevent UI frame errors on Android
  const chatScreenOptions: NativeStackNavigationOptions = {
    ...screenOptions,
    animation: Platform.OS === 'ios' ? 'default' : 'none',
    headerShown: false,
  };

  return (
    <ChatsStack.Navigator screenOptions={chatScreenOptions}>
      <ChatsStack.Screen 
        name="ChatsMain" 
        component={ChatsScreen}
      />
      <ChatsStack.Screen 
        name="ChatDetail" 
        component={ChatDetailScreen} 
        options={({ route }) => {
          // Safe access to params with fallback
          const name = route.params?.name || 'Chat';
          return { 
            title: name,
            headerBackTitle: 'Back',
          };
        }}
      />
      <ChatsStack.Screen 
        name="Call" 
        component={CallScreen} 
        options={({ route }) => {
          // Safe access to params with fallback
          const name = route.params?.name || 'Call';
          return { 
            title: name,
            headerBackTitle: 'Back',
          };
        }}
      />
      <ChatsStack.Screen 
        name="AICallScreen" 
        component={AICallScreen} 
        options={({ route }) => {
          // Safe access to params with fallback
          const name = route.params?.name || 'AI Call';
          return { 
            title: name,
            headerBackTitle: 'Back',
          };
        }}
      />
      <ChatsStack.Screen 
        name="CallScreen" 
        component={CallScreen} 
        options={({ route }) => {
          // Safe access to params with fallback
          const name = route.params?.name || 'Call';
          return { 
            title: name,
            headerBackTitle: 'Back',
          };
        }}
      />
    </ChatsStack.Navigator>
  );
};

const ContactsStackNavigator = () => {
  // Use platform-specific screen options to prevent UI frame errors on Android
  const contactsScreenOptions: NativeStackNavigationOptions = {
    ...screenOptions,
    animation: Platform.OS === 'ios' ? 'default' : 'none',
    headerShown: false,
  };

  return (
    <ContactsStack.Navigator screenOptions={contactsScreenOptions}>
      <ContactsStack.Screen 
        name="ContactsMain" 
        component={ContactsScreen}
      />
      <ContactsStack.Screen 
        name="ChatDetail" 
        component={ChatDetailScreen}
        options={({ route }) => {
          // Safe access to params with fallback
          const name = route.params?.name || 'Chat';
          return { 
            title: name,
            headerBackTitle: 'Back',
          };
        }}
      />
      <ContactsStack.Screen 
        name="Call" 
        component={CallScreen} 
        options={({ route }) => {
          // Safe access to params with fallback
          const name = route.params?.name || 'Call';
          return { 
            title: name,
            headerBackTitle: 'Back',
          };
        }}
      />
      <ContactsStack.Screen 
        name="AICallScreen" 
        component={AICallScreen} 
        options={({ route }) => {
          // Safe access to params with fallback
          const name = route.params?.name || 'AI Call';
          return { 
            title: name,
            headerBackTitle: 'Back',
          };
        }}
      />
      <ContactsStack.Screen 
        name="CallScreen" 
        component={CallScreen} 
        options={({ route }) => {
          // Safe access to params with fallback
          const name = route.params?.name || 'Call';
          return { 
            title: name,
            headerBackTitle: 'Back',
          };
        }}
      />
    </ContactsStack.Navigator>
  );
};

// Main tab navigator
const MainNavigator = () => {
  const { theme } = useTheme();
  // Get recent chats from Redux to calculate unread count
  const recentChats = useAppSelector((state: RootState) => state.message.recentChats);
  
  // Calculate total unread count from all chats
  const totalUnreadCount = useMemo(() => {
    return recentChats.reduce((total, chat) => total + (chat.unreadCount || 0), 0);
  }, [recentChats]);
  
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          // Define icon names based on route name and focus state
          let iconName = '';
          
          switch (route.name) {
            case 'Home':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'Lobby':
              iconName = focused ? 'people' : 'people-outline';
              break;
            case 'Chats':
              iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
              break;
            case 'Ranking':
              iconName = focused ? 'trophy' : 'trophy-outline';
              break;
            case 'Contacts':
              iconName = focused ? 'person-add' : 'person-add-outline';
              break;
            default:
              iconName = 'circle';
              break;
          }
          
          // Create a unique key for each icon to prevent reuse issues
          const key = `${route.name}-${focused ? 'focused' : 'unfocused'}`;
          
          // Try-catch to handle potential icon loading issues
          try {
            return <Ionicons key={key} name={iconName} size={size} color={color} />;
          } catch (error) {
            console.error('Icon error:', error);
            return <View style={{ width: size, height: size, backgroundColor: color, borderRadius: size/2 }} />;
          }
        },
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textTertiary,
        tabBarStyle: { 
          backgroundColor: theme.card,
          borderTopColor: theme.border,
          elevation: 5,
        },
        // Disable animations on Android to prevent UI frame errors
        tabBarItemStyle: Platform.OS === 'android' ? { marginTop: 0, paddingTop: 0 } : undefined,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Lobby" component={LobbyScreen} />
      <Tab.Screen 
        name="Chats" 
        component={ChatStackNavigator} 
        options={{
          unmountOnBlur: Platform.OS === 'android', // Unmount component on tab switch on Android
          tabBarBadge: totalUnreadCount > 0 ? totalUnreadCount : undefined,
        }}
      />
      <Tab.Screen name="Ranking" component={RankingScreen} />
      <Tab.Screen 
        name="Contacts" 
        component={ContactsStackNavigator}
        options={{
          unmountOnBlur: Platform.OS === 'android', // Unmount component on tab switch on Android
        }}
      />
    </Tab.Navigator>
  );
};

// Auth navigator
const AuthNavigator = () => {
  return (
    <AuthStack.Navigator 
      screenOptions={screenOptions}
      initialRouteName="Welcome"
    >
      <AuthStack.Screen name="Welcome" component={WelcomeScreen} />
      <AuthStack.Screen name="SignIn" component={SignInScreen} />
      <AuthStack.Screen name="SignUp" component={SignUpScreen} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <AuthStack.Screen name="Onboarding" component={OnboardingScreen} />
    </AuthStack.Navigator>
  );
};

// Root navigator
const RootNavigator = () => {
  // Use Redux auth state instead of context
  const { isSignedIn, status } = useSelector((state: any) => state.auth);
  // IncomingCallModal reads callState directly from Redux - no local state needed

  return (
    <>
      <Stack.Navigator screenOptions={screenOptions}>
        {status === 'loading' ? (
          // Only show splash while loading
          <Stack.Screen name="Splash" component={SplashScreen} options={{ headerShown: false }} />
        ) : isSignedIn ? (
          // Authenticated flow
          <>
            <Stack.Screen name="Main" component={MainNavigator} />
            <Stack.Screen 
              name="Call" 
              component={AICallScreen} 
              options={{
                headerShown: false,
                presentation: 'fullScreenModal',
                animation: 'slide_from_bottom'
              }}
            />
            <Stack.Screen 
              name="AICallScreen" 
              component={AICallScreen} 
              options={{
                headerShown: false,
                presentation: 'fullScreenModal',
                animation: 'slide_from_bottom'
              }}
            />
            <Stack.Screen 
              name="CallScreen" 
              component={CallScreen} 
              options={{
                headerShown: false,
                presentation: 'fullScreenModal',
                animation: 'slide_from_bottom'
              }}
            />
            <Stack.Screen 
              name="Profile" 
              component={ProfileScreen} 
              options={{
                headerShown: false,
                presentation: 'card',
                animation: 'slide_from_right'
              }}
            />
            <Stack.Screen 
              name="Settings" 
              component={SettingsScreen} 
              options={{
                headerShown: false,
                presentation: 'card',
                animation: 'slide_from_right'
              }}
            />
            <Stack.Screen 
              name="ChangePassword" 
              component={ChangePasswordScreen} 
              options={{
                headerShown: false,
                presentation: 'card',
                animation: 'slide_from_right'
              }}
            />
            <Stack.Screen 
              name="TermsOfService"
              component={TermsOfServiceScreen}
              options={{
                headerShown: false,
                presentation: 'card',
                animation: 'slide_from_right'
              }}
            />
            <Stack.Screen 
              name="PrivacyPolicy"
              component={PrivacyPolicyScreen}
              options={{
                headerShown: false,
                presentation: 'card',
                animation: 'slide_from_right'
              }}
            />
            <Stack.Screen 
              name="About"
              component={AboutScreen}
              options={{
                headerShown: false,
                presentation: 'card',
                animation: 'slide_from_right'
              }}
            />
            <Stack.Screen 
              name="DeleteAccount" 
              component={DeleteAccountScreen} 
              options={{
                headerShown: false,
                presentation: 'card',
                animation: 'slide_from_right'
              }}
            />
            <Stack.Screen 
              name="EditProfile" 
              component={EditProfileScreen} 
              options={{
                headerShown: false,
                presentation: 'modal',
                animation: 'slide_from_bottom'
              }}
            />
            <Stack.Screen 
              name="PostCallFeedback" 
              component={PostCallFeedbackScreen} 
              options={{
                headerShown: false,
                presentation: 'modal',
                animation: 'slide_from_bottom'
              }}
            />
            <Stack.Screen 
              name="PostCallFlow" 
              component={PostCallFlowScreen} 
              options={{
                headerShown: false,
                presentation: 'modal',
                animation: 'slide_from_bottom'
              }}
            />
            <Stack.Screen 
              name="UserProfile" 
              component={UserProfileScreen} 
              options={{
                headerShown: false,
                presentation: 'card',
                animation: 'slide_from_right'
              }}
            />
            <Stack.Screen 
              name="ChatDetail" 
              component={ChatDetailScreen} 
              options={{
                headerShown: false,
                presentation: 'card',
                animation: 'slide_from_right'
              }}
            />
            <Stack.Screen 
              name="AIChat" 
              component={AIChatScreen} 
              options={{
                headerShown: false,
                presentation: 'card',
                animation: 'slide_from_right'
              }}
            />
            <Stack.Screen 
              name="NetworkDebug" 
              component={NetworkDebugScreen} 
              options={{
                headerShown: false,
                presentation: 'card',
                animation: 'slide_from_right'
              }}
            />
          </>
        ) : (
          // Auth flow
          <Stack.Screen name="Auth" component={AuthNavigator} />
        )}
      </Stack.Navigator>
    </>
  );
};

// Configure Google Sign In
GoogleSignin.configure({
  // Web Client ID from Firebase console
  webClientId: '515525112654-hm8r60obc7l4epm3vcikq77vqr2ju9ur.apps.googleusercontent.com',
  offlineAccess: true,
  forceCodeForRefreshToken: true,
});

// App navigator with auth context
const AppNavigator = () => {
  const { isSignedIn, status } = useSelector((state: any) => state.auth);
  const dispatch = useAppDispatch();
  const { theme, isDark } = useTheme();
  
  // Create navigation theme dynamically based on app theme
  const navigationTheme = useMemo(() => ({
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: theme.background,
      card: theme.card,
      text: theme.text,
      border: theme.border,
      primary: theme.primary,
      notification: theme.primary,
    },
    dark: isDark,
  }), [theme, isDark]);
  
  // Show loading screen while authentication status is being determined
  if (status === 'loading') {
    return <SplashScreen />;
  }
  
  return (
    <NavigationContainer 
      ref={navigationRef} 
      theme={navigationTheme} 
      onReady={() => {
        // Process any queued navigation actions once the container is ready
        processQueuedActions();
      }}
    >
      <RootNavigator />
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    fontSize: 18,
    color: '#4A90E2',
  },
});

export default AppNavigator; 