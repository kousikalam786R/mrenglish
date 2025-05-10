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

// Screens
import LobbyScreen from '../screens/LobbyScreen';
import ChatsScreen from '../screens/ChatsScreen';
import RankingScreen from '../screens/RankingScreen';
import ContactsScreen from '../screens/ContactsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import ChatDetailScreen from '../screens/ChatDetailScreen';
import CallScreen from '../screens/CallScreen';

// Auth Screens
import HomeScreen from '../screens/HomeScreen';
import SignInScreen from '../screens/SignInScreen';
import SignUpScreen from '../screens/SignUpScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';

// Types
import { 
  AuthStackParamList, 
  AppStackParamList, 
  RootStackParamList,
  ChatsStackParamList,
  ContactsStackParamList
} from './types';

// Custom navigation theme
const NavigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#FFFFFF',
    card: '#FFFFFF',
    primary: '#4A90E2',
  },
};

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
  return (
    <ChatsStack.Navigator screenOptions={screenOptions}>
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
    </ChatsStack.Navigator>
  );
};

const ContactsStackNavigator = () => {
  return (
    <ContactsStack.Navigator screenOptions={screenOptions}>
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
    </ContactsStack.Navigator>
  );
};

// Main tab navigator
const MainNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          // Define icon names based on route name and focus state
          const getIconName = () => {
            switch (route.name) {
              case 'Lobby':
                return focused ? 'home' : 'home-outline';
              case 'Chats':
                return focused ? 'chatbubbles' : 'chatbubbles-outline';
              case 'Ranking':
                return focused ? 'trophy' : 'trophy-outline';
              case 'Contacts':
                return focused ? 'people' : 'people-outline';
              case 'Profile':
                return focused ? 'person' : 'person-outline';
              default:
                return 'circle';
            }
          };
          
          const iconName = getIconName();
          
          // Try-catch to handle potential icon loading issues
          try {
            return <Ionicons name={iconName} size={size} color={color} />;
          } catch (error) {
            console.error('Icon error:', error);
            return <View style={{ width: size, height: size, backgroundColor: color, borderRadius: size/2 }} />;
          }
        },
        tabBarActiveTintColor: '#4A90E2',
        tabBarInactiveTintColor: 'gray',
        tabBarStyle: { elevation: 5 }
      })}
    >
      <Tab.Screen name="Lobby" component={LobbyScreen} />
      <Tab.Screen name="Chats" component={ChatStackNavigator} />
      <Tab.Screen name="Ranking" component={RankingScreen} />
      <Tab.Screen name="Contacts" component={ContactsStackNavigator} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

// Auth navigator
const AuthNavigator = () => {
  return (
    <AuthStack.Navigator screenOptions={screenOptions}>
      <AuthStack.Screen name="Home" component={HomeScreen} />
      <AuthStack.Screen name="SignIn" component={SignInScreen} />
      <AuthStack.Screen name="SignUp" component={SignUpScreen} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </AuthStack.Navigator>
  );
};

// Root navigator
const RootNavigator = () => {
  // Use Redux auth state instead of context
  const { isSignedIn } = useAppSelector((state: any) => state.auth);

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      {isSignedIn ? (
        <>
          <Stack.Screen name="Main" component={MainNavigator} />
          <Stack.Screen name="EditProfile" component={EditProfileScreen} />
        </>
      ) : (
        <Stack.Screen name="Auth" component={AuthNavigator} />
      )}
    </Stack.Navigator>
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
  // State to track if user is signed in
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [isNavigationReady, setIsNavigationReady] = useState(false);
  const dispatch = useAppDispatch();
  
  // Handle user state changes
  function onAuthStateChanged(user: FirebaseAuthTypes.User | null) {
    setIsSignedIn(!!user);
    if (initializing) setInitializing(false);
  }

  useEffect(() => {
    // Subscribe to auth state changes
    const subscriber = auth().onAuthStateChanged(onAuthStateChanged);
    
    // Check auth state from Redux
    dispatch(checkAuthState());
    
    // Check for manual authentication token
    const checkManualAuth = async () => {
      try {
        const token = await AsyncStorage.getItem('authToken');
        // If token exists, set isSignedIn to true for manual auth
        if (token) {
          console.log('Found manual auth token, setting signed in state');
          setIsSignedIn(true);
        }
      } catch (error) {
        console.error('Error checking manual auth token:', error);
      }
    };
    
    // Run manual auth check
    checkManualAuth();
    
    // Initialize navigation after a short delay
    const timer = setTimeout(() => {
      setIsNavigationReady(true);
    }, 200);
    
    // Clean up subscription and timer
    return () => {
      subscriber();
      clearTimeout(timer);
    };
  }, []);
  
  // Auth functions
  const authContext = useMemo(() => ({
    isSignedIn,
    signIn: async () => {
      console.log("Signing in");
      // Set isSignedIn to true for manual login flows
      setIsSignedIn(true);
    },
    signOut: async () => {
      console.log("Signing out");
      try {
        // Check if a Firebase user exists before attempting to sign out
        const currentUser = auth().currentUser;
        if (currentUser) {
          // Sign out from Firebase if a user exists
          await auth().signOut();
          console.log("Successfully signed out from Firebase");
        } else {
          console.log("No Firebase user to sign out");
        }
        
        // Try to sign out from Google regardless of sign-in state
        try {
          await GoogleSignin.signOut();
          console.log("Successfully signed out from Google");
        } catch (googleError) {
          // This is expected if user wasn't signed in with Google
          console.log("Google sign out not needed or failed:", googleError);
        }
        
        // Always set isSignedIn to false for manual login flows
        setIsSignedIn(false);
      } catch (error) {
        console.error('Error during sign out process:', error);
        // Even if there's an error, still set isSignedIn to false to ensure the user can log out
        setIsSignedIn(false);
      }
    },
  }), [isSignedIn]);

  if (!isNavigationReady || initializing) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <AuthContext.Provider value={authContext}>
      <ErrorBoundary
        onError={(error) => {
          console.error('Navigation error caught:', error);
        }}
      >
        <NavigationContainer theme={NavigationTheme}>
          <RootNavigator />
        </NavigationContainer>
      </ErrorBoundary>
    </AuthContext.Provider>
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