import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  Image, 
  StatusBar,
  ActivityIndicator,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { getAllUsers } from '../utils/userService';
import socketService from '../utils/socketService';
import callService from '../utils/callService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../utils/config';
import { getAuthToken } from '../utils/authUtils';
import { requestMicrophonePermission, showPermissionExplanation, checkMicrophonePermission } from '../utils/permissionUtils';
import ProgressDialog from '../components/ProgressDialog';
import Icon from 'react-native-vector-icons/Ionicons';
import IconMaterial from 'react-native-vector-icons/MaterialIcons';
import ConnectingScreen from '../components/ConnectingScreen';
import PartnerSearchScreen from '../components/PartnerSearchScreen';
import FilterModal, { FilterSettings } from '../components/FilterModal';
import { mediaDevices } from 'react-native-webrtc';
import simpleUserStatusService from '../services/simpleUserStatusService';
import { useUserStatusService } from '../hooks/useUserStatus';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';

// Define user type
interface User {
  _id: string;
  name: string;
  profilePic?: string;
  level?: string;
  country?: string;
  isOnline?: boolean;
  email?: string;
  gender?: string;
  rating?: number;
  talks?: number;
  readyToTalk?: boolean;
  isOnCall?: boolean;
}

interface UserCardProps {
  user: User;
  onCallPress: () => void;
  onMessagePress: () => void;
  onPress: () => void;
}

const UserCard = ({ user, onCallPress, onMessagePress, onPress }: UserCardProps) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  // Get user status from centralized service with subscription
  const [userStatus, setUserStatus] = useState(() => simpleUserStatusService.getUserStatus(user._id));

  // Subscribe to status updates for this user
  useEffect(() => {
    // Add user to tracking
    simpleUserStatusService.addUserToTracking(user._id);

    // Get initial status
    const initialStatus = simpleUserStatusService.getUserStatus(user._id);
    if (initialStatus) {
      setUserStatus(initialStatus);
    }

    // Subscribe to status updates
    const unsubscribe = simpleUserStatusService.subscribeToStatusUpdates((allStatuses) => {
      const status = allStatuses.get(user._id);
      if (status) {
        console.log(`📊 UserCard: Status updated for ${user.name} (${user._id}):`, {
          isOnline: status.isOnline,
          lastSeenAt: status.lastSeenAt
        });
        setUserStatus(status);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [user._id, user.name]);
  // Level indicator background colors
  const getLevelBgColor = (level?: string) => {
    if (!level) return '#e0e0e0';
    const firstChar = level.charAt(0).toUpperCase();
    switch (firstChar) {
      case 'A': return '#4CAF50'; // Green
      case 'B': return '#2196F3'; // Blue
      case 'C': return '#FFC107'; // Yellow
      default: return '#e0e0e0'; // Grey
    }
  };

  return (
    <View style={[styles.userCard, { backgroundColor: theme.card }]}>
    <TouchableOpacity 
        style={styles.userCardContent}
      onPress={onPress}
        activeOpacity={0.7}
      >
        <View style={styles.avatarContainer}>
          <Image 
            source={{ uri: user.profilePic || 'https://randomuser.me/api/portraits/men/32.jpg' }} 
            style={styles.avatar} 
          />
          <View style={[styles.levelIndicator, { backgroundColor: getLevelBgColor(user.level) }]}>
            <Text style={styles.levelText}>{user.level || 'A1'}</Text>
          </View>
          {(userStatus?.isOnline ?? user.isOnline) && <View style={styles.onlineIndicator} />}
        </View>
        
        <View style={styles.userInfo}>
          <Text style={[styles.userName, { color: theme.text }]}>
            {user.name} {user.gender === 'Female' ? '🌸' : user.gender === 'Male' ? '👨' : ''}
          </Text>
          <View style={styles.ratingContainer}>
            <Text style={[styles.thumbsUp, { color: theme.textSecondary }]}>👍 {user.rating || 95}%</Text>
            <Text style={[styles.userGender, { color: theme.textSecondary }]}> • {user.gender || 'Not specified'}</Text>
        </View>
          <Text style={[styles.userCountry, { color: theme.textSecondary }]}>
            {user.country || '🌎 Global'} • {user.talks || 0} talks
          </Text>
          <Text style={[
            (userStatus?.isOnline ?? user.isOnline) ? styles.onlineText : styles.offlineText,
            { color: (userStatus?.isOnline ?? user.isOnline) ? theme.success : theme.textTertiary }
          ]}>
            {(userStatus?.isOnline ?? user.isOnline) ? t('lobby.online') : t('lobby.offline')}
          </Text>
          {/* Debug info */}
          {/* {__DEV__ && (
            <Text style={{ fontSize: 8, color: '#999', marginTop: 2 }}>
              {userStatus?.isOnline ? '🟢' : '🔴'} {userStatus?.isOnline ? 'Online' : 'Offline'}
            </Text>
          )} */}
        </View>
        
        <View style={styles.buttonsContainer}>
          {!(userStatus?.isOnline ?? user.isOnline) ? (
            // Show message icon for offline users
            <TouchableOpacity 
              style={[
                styles.callButton, 
                styles.callButtonFullWidth,
                styles.messageButton,
                { backgroundColor: theme.primary },
              ]} 
              onPress={(e) => {
                e.stopPropagation(); // Prevent triggering the parent's onPress
                onMessagePress();
              }}
            >
              <IconMaterial 
                name="message" 
                size={24} 
                color="white" 
              />
            </TouchableOpacity>
          ) : (
            // Show call icon for online users
            <TouchableOpacity 
              style={[
                styles.callButton, 
                styles.callButtonFullWidth,
                { backgroundColor: userStatus?.isOnCall ? theme.inputBackground : theme.primary },
              ]} 
              onPress={(e) => {
                e.stopPropagation(); // Prevent triggering the parent's onPress
                onCallPress();
              }}
              disabled={userStatus?.isOnCall}
            >
              <IconMaterial 
                name={userStatus?.isOnCall ? "call-end" : "call"} 
                size={24} 
                color={userStatus?.isOnCall ? theme.textTertiary : "white"} 
              />
              {userStatus?.isOnCall && (
                <Text style={[styles.onCallText, { color: theme.textTertiary }]}>{t('lobby.onCall')}</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
    </TouchableOpacity>
    </View>
  );
};

interface LobbyScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList>;
}

const LobbyScreen = ({ navigation }: LobbyScreenProps) => {
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();
  const [users, setUsers] = useState<User[]>([]);
  const [readyUsers, setReadyUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [permissionChecked, setPermissionChecked] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [progressMessage, setProgressMessage] = useState('');
  const [currentUserReady, setCurrentUserReady] = useState(false);
  const [findingPartner, setFindingPartner] = useState(false);
  const [showPartnerSearch, setShowPartnerSearch] = useState(false);
  const [searchEmoji, setSearchEmoji] = useState('👨‍🍳');
  const [showConnecting, setShowConnecting] = useState(false);
  const [connectingPartner, setConnectingPartner] = useState<User | null>(null);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filterSettings, setFilterSettings] = useState<FilterSettings>({
    gender: 'all',
    ratingMin: 0,
    ratingMax: 100,
    levelMin: 0,
    levelMax: 5,
    levels: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
  });

  // Initialize user status service
  const { isInitialized: statusServiceReady } = useUserStatusService();

  // Memoize sorted users list to avoid re-rendering issues
  const sortedUsers = useMemo(() => {
    // Apply filters to users
    const filteredUsers = users.filter((user: User) => {
      // Gender filter
      if (filterSettings.gender !== 'all') {
        const userGender = (user.gender || '').toLowerCase();
        if (userGender !== filterSettings.gender.toLowerCase()) {
          return false;
        }
      }
      
      // Rating filter
      if (user.rating) {
        if (user.rating < filterSettings.ratingMin || user.rating > filterSettings.ratingMax) {
          return false;
        }
      }
      
      // Level filter
      if (user.level) {
        const englishLevels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
        const userLevelIndex = englishLevels.indexOf(user.level);
        if (userLevelIndex === -1 || userLevelIndex < filterSettings.levelMin || userLevelIndex > filterSettings.levelMax) {
          return false;
        }
      }
      
      return true;
    });
    
    // First, get ready-to-talk users (sorted by rating descending)
    const readyUsersSorted = [...readyUsers]
      .filter((user: User) => {
        // Apply same filters to ready users
        if (filterSettings.gender !== 'all') {
          const userGender = (user.gender || '').toLowerCase();
          if (userGender !== filterSettings.gender.toLowerCase()) {
            return false;
          }
        }
        if (user.rating) {
          if (user.rating < filterSettings.ratingMin || user.rating > filterSettings.ratingMax) {
            return false;
          }
        }
        if (user.level) {
          const englishLevels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
          const userLevelIndex = englishLevels.indexOf(user.level);
          if (userLevelIndex === -1 || userLevelIndex < filterSettings.levelMin || userLevelIndex > filterSettings.levelMax) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => (b.rating || 0) - (a.rating || 0));
    
    // Then get other online users (not ready to talk, sorted by rating descending)
    const otherOnlineUsers = filteredUsers
      .filter((user: User) => user.isOnline && !user.readyToTalk && !user.isOnCall)
      .sort((a: User, b: User) => (b.rating || 0) - (a.rating || 0));
    
    // Return ready users first, then other online users
    return [...readyUsersSorted, ...otherOnlineUsers];
  }, [readyUsers, users, filterSettings]);

  // Add users to status tracking when users list changes
  useEffect(() => {
    if (statusServiceReady && users.length > 0) {
      users.forEach(user => {
        simpleUserStatusService.addUserToTracking(user._id);
      });
    }
  }, [statusServiceReady, users]);

  // Check microphone permission on component mount
  useEffect(() => {
    const checkPermission = async () => {
      const hasPermission = await checkMicrophonePermission();
      setPermissionChecked(true);
      
      if (!hasPermission) {
        // Show a notification that permissions will be needed for calls
        Alert.alert(
          'Microphone Permission',
          'You will need to grant microphone permission to make calls. You can do this when you start a call.',
          [{ text: 'OK', style: 'default' }]
        );
      }
    };
    
    checkPermission();
  }, []);

  // Fetch all users from the database with test data
  const fetchUsers = async () => {
    try {
      setLoading(true);
      
      // Get token for API requests
      const token = await getAuthToken();
      
      // Get online users instead of test users
      console.log('Fetching online users...');
      const response = await fetch(`${API_URL}/auth/online-users`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        console.log('Failed to fetch online users, falling back to all users');
        return fetchAllUsersAsFallback();
      }
      
      const fetchedUsers = await response.json();
      console.log('Fetched online users:', fetchedUsers.length);
      
      // Add mock data for demo
      const enhancedUsers = fetchedUsers.map((user: User) => ({
        ...user,
        gender: Math.random() > 0.5 ? 'Male' : 'Female',
        rating: Math.floor(Math.random() * 20) + 80, // 80-100
        talks: Math.floor(Math.random() * 1000) + 1,
        level: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'][Math.floor(Math.random() * 6)],
        readyToTalk: Math.random() > 0.3 // 70% ready to talk
      }));
      
      // Update state with fetched users
      setUsers(enhancedUsers);
      
      // Filter users who are ready to talk
      const usersReadyToTalk = enhancedUsers.filter((user: User) => user.isOnline && user.readyToTalk);
      setReadyUsers(usersReadyToTalk);
      
      // Initialize socket service to receive user status updates
      await initializeSocketConnection();
    } catch (error) {
      console.error('Error fetching online users:', error);
      
      // Fallback to standard user fetch
      await fetchAllUsersAsFallback();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Fallback function to fetch all users
  const fetchAllUsersAsFallback = async () => {
    try {
      const standardUsers = await getAllUsers();
      
      // Make sure we have the online status property for each user, but default to false
      const usersWithStatus = standardUsers.map((user: User) => ({
        ...user,
        isOnline: false, // Default to offline unless socket confirms they're online
        gender: Math.random() > 0.5 ? 'Male' : 'Female',
        rating: Math.floor(Math.random() * 20) + 80, // 80-100
        talks: Math.floor(Math.random() * 1000) + 1,
        level: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'][Math.floor(Math.random() * 6)],
        readyToTalk: Math.random() > 0.3 // 70% ready to talk
      }));
      
      setUsers(usersWithStatus);
      
      // Initialize socket to get real status updates
      await initializeSocketConnection();
    } catch (fallbackError) {
      console.error('Error in fallback user fetch:', fallbackError);
      Alert.alert('Error', 'Failed to load users. Please try again.');
    }
  };

  // Initialize socket connection and listen for events
  const initializeSocketConnection = async () => {
    try {
      // Initialize socket connection if not already connected
      if (!socketService.getSocket()?.connected) {
        console.log('Socket not connected, initializing...');
        await socketService.initialize();
        
        // Check if initialization was successful
        const socket = socketService.getSocket();
        if (socket && socket.connected) {
          console.log('Socket connected successfully:', socket.id);
        } else {
          console.warn('Socket initialization completed but socket is not connected');
        }
      } else {
        console.log('Socket already connected:', socketService.getSocket()?.id);
      }
      
      // Set current user ready status to false by default
      setCurrentUserReady(false);
      
      // User status updates are now handled by SimpleUserStatusService
      // No need for duplicate listeners here
      
      // Listen for user ready-to-talk status updates
      socketService.socketOn('user-ready-status', (data: any) => {
        if (data && data.userId) {
          console.log(`✅ Ready status update for user ${data.userId}:`, data);
          updateUserReadyStatus(data.userId, data.isReady, data.userData);
        }
      });
      
      // Listen for ready status updates for current user
      socketService.socketOn('ready_status_updated', (data: any) => {
        console.log('Ready status updated:', data);
        if (data.success) {
          setCurrentUserReady(data.isReady);
        }
      });
      
      // Listen for ready users list updates
      socketService.socketOn('ready-users-list', (data: any) => {
        if (data.users && Array.isArray(data.users)) {
          console.log(`📋 Received ${data.users.length} ready users from server`);
          updateReadyUsersList(data.users);
        }
      });
      
      // Partner found events are now handled by the global handler
      // This prevents duplicate event listeners

      // Additional mechanism: Listen for force close command
      socketService.socketOn('force-close-search', () => {
        console.log('🚨 BACKUP EVENT: force-close-search received');
        console.log('🚨 BACKUP: Current showPartnerSearch:', showPartnerSearch);
        console.log('🚨 BACKUP: Current findingPartner:', findingPartner);
        setShowPartnerSearch(false);
        setFindingPartner(false);
        console.log('🚨 BACKUP: Search screen force closed');
      });

      // Listen for partner search screen close command (backup mechanism)
      socketService.socketOn('close-partner-search', () => {
        console.log('🔄 BACKUP EVENT: close-partner-search received');
        console.log('🔄 BACKUP: Current findingPartner state:', findingPartner);
        console.log('🔄 BACKUP: Current showPartnerSearch state:', showPartnerSearch);
        setShowPartnerSearch(false);
        setFindingPartner(false);
        console.log('🔄 BACKUP: Search screen closed via backup');
      });

      // Additional robust mechanism - force close on any partner event
      socketService.socketOn('partner-search-force-close', () => {
        console.log('🚨 ULTIMATE BACKUP: partner-search-force-close received');
        console.log('🚨 ULTIMATE: Current showPartnerSearch:', showPartnerSearch);
        console.log('🚨 ULTIMATE: Current findingPartner:', findingPartner);
        setShowPartnerSearch(false);
        setFindingPartner(false);
        console.log('🚨 ULTIMATE: Search screen force closed');
      });

      // Debug: Listen for all socket events to see what's happening
      socketService.socketOn('debug-socket-events', (data: any) => {
        console.log('🔍 Debug socket event:', data);
      });

      // Listen for partner search errors
      socketService.socketOn('partner-search-error', (data: any) => {
        console.log('❌ Partner search error:', data);
        setFindingPartner(false);
        setShowPartnerSearch(false);
        Alert.alert('Partner Search Error', data.error || 'Failed to search for partner');
      });

      // Listen for random partner result (first user gets this event)
      socketService.socketOn('random-partner-result', (data: any) => {
        console.log('🎯 Random partner result received:', JSON.stringify(data, null, 2));
        if (data.success && data.partner) {
          // Treat this the same as partner-found
          globalPartnerFoundHandler({ partner: data.partner });
        } else {
          console.log('❌ No partner found:', data.error);
          setFindingPartner(false);
          setShowPartnerSearch(false);
          if (data.error) {
            Alert.alert('No Partner Found', data.error);
          }
        }
      });

      // Test event listener (for debugging)
      socketService.socketOn('test-event-response', (data: any) => {
        console.log('🔍 Test event response received:', data);
      });

      // Add call service event listeners
      console.log('🔧 SETUP: Adding call service event listeners');
      console.log('🔧 SETUP: handlePartnerCallAutoAccepted function exists:', typeof handlePartnerCallAutoAccepted);
      callService.addEventListener('call-state-changed', handleCallStateChange);
      callService.addEventListener('partner-call-auto-accepted', handlePartnerCallAutoAccepted);
      console.log('🔧 SETUP: Event listeners added - call-state-changed & partner-call-auto-accepted');
      
      // Add call status tracking listeners
      callService.addEventListener('call-started', handleCallStarted);
      callService.addEventListener('call-ended', handleCallEnded);
      
      // Request a list of ready users - emit the event instead of calling a non-existent method
      socketService.socketEmit('get-ready-users', {});
      
      // Partner matching calls now use regular call service
      // No need for separate partner call event listeners
      
    } catch (error) {
      console.error('Error initializing socket connection:', error);
    }
  };

  // Update a single user's online status
  const updateUserStatus = (userId: string, isOnline: boolean) => {
    setUsers(prevUsers => {
      const updatedUsers = prevUsers.map((user: User) => 
        user._id === userId 
          ? { ...user, isOnline } 
          : user
      );
      
      // Also update ready users list
      setReadyUsers(updatedUsers.filter((user: User) => user.isOnline && user.readyToTalk));
      
      return updatedUsers;
    });
  };
  
  // Update a single user's ready-to-talk status
  const updateUserReadyStatus = (userId: string, isReady: boolean, userData: any = {}) => {
    console.log(`🔄 Updating ready status for user ${userId}: ${isReady}`);
    setUsers(prevUsers => {
      const updatedUsers = prevUsers.map((user: User) => {
        if (user._id === userId) {
          // Update user with new ready status and any additional data
          return { 
            ...user, 
            readyToTalk: isReady,
            level: userData.level || user.level,
            name: userData.name || user.name,
            profilePic: userData.profilePic || user.profilePic
          };
        }
        return user;
      });
      
      // Filter ready users: must be online AND ready to talk AND not on call
      const filteredReadyUsers = updatedUsers.filter((user: User) => {
        const isReadyUser = user.isOnline && user.readyToTalk && !user.isOnCall;
        if (isReadyUser) {
          console.log(`✅ User ${user.name} is ready to talk`);
        } else if (user.isOnline && user.readyToTalk && user.isOnCall) {
          console.log(`📞 User ${user.name} is ready to talk but currently on call`);
        }
        return isReadyUser;
      });
      
      console.log(`📊 Total ready users after update: ${filteredReadyUsers.length}`);
      setReadyUsers(filteredReadyUsers);
      
      return updatedUsers;
    });
  };
  
  // Update the list of ready users
  const updateReadyUsersList = (readyUsersList: any[]) => {
    console.log('🔄 Updating ready users list with', readyUsersList.length, 'users');
    
    // Mark users as ready in our local state based on the list
    setUsers(prevUsers => {
      const userMap = new Map();
      prevUsers.forEach(user => userMap.set(user._id, user));
      
      // Get all user IDs from the ready list
      const readyUserIds = new Set(readyUsersList.map(ru => ru.userId));
      
      // Update or add users from the ready list
      readyUsersList.forEach(readyUser => {
        const userId = readyUser.userId;
        const existingUser = userMap.get(userId);
        
        if (existingUser) {
          // Update existing user - mark as ready
          userMap.set(userId, {
            ...existingUser,
            readyToTalk: true, // This user is in the ready list
            isOnline: true, // Must be online to be in ready list
            level: readyUser.level || existingUser.level,
            name: readyUser.name || existingUser.name,
            profilePic: readyUser.profilePic || existingUser.profilePic
          });
        } else if (userId) {
          // Add new user if we have a minimum of information
          userMap.set(userId, {
            _id: userId,
            name: readyUser.name || 'Unknown User',
            profilePic: readyUser.profilePic,
            level: readyUser.level || 'Intermediate',
            isOnline: true,
            readyToTalk: true // This user is in the ready list
          });
        }
      });
      
      // Remove ready status from users NOT in the ready list
      userMap.forEach((user, userId) => {
        if (!readyUserIds.has(userId)) {
          userMap.set(userId, {
            ...user,
            readyToTalk: false // Not in ready list anymore
          });
        }
      });
      
      const updatedUsers = Array.from(userMap.values());
      
      // Filter to only show users who are online AND ready to talk AND not on call
      const filteredReadyUsers = updatedUsers.filter((user: User) => {
        return user.isOnline && user.readyToTalk && !user.isOnCall;
      });
      
      console.log(`📊 Total ready users after list update: ${filteredReadyUsers.length}`);
      setReadyUsers(filteredReadyUsers);
      
      return updatedUsers;
    });
  };

  // Handle initiating a call to a user
  const handleCallPress = async (user: User) => {
    try {
      // Get current user status from the service
      const userStatus = simpleUserStatusService.getUserStatus(user._id);
      
      // Check if user is on call
      if (userStatus?.isOnCall) {
        Alert.alert(
          'User Busy', 
          'This user is currently on a call. Please try calling them later.',
          [{ text: 'OK', style: 'default' }]
        );
        return;
      }
      
      // Check if user is online, but still allow calling with a warning
      if (!user.isOnline) {
        Alert.alert(
          'User Offline', 
          'This user is currently offline. You can still try to call them, but they may not answer immediately.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Call Anyway', onPress: () => proceedWithCall(user) }
          ]
        );
        return;
      }
      
      // Proceed with call for online users
      await proceedWithCall(user);
    } catch (error: any) {
      console.error('Error starting call:', error);
      
      // Hide progress dialog
      setShowProgress(false);
      
      Alert.alert(
        'Call Failed', 
        `Failed to start call: ${error.message || 'Please try again later.'}`
      );
    }
  };

  // Proceed with the actual call logic
  const proceedWithCall = async (user: User) => {
    try {
      // Request microphone permission before starting the call
      const hasPermission = await requestMicrophonePermission();
      
      if (!hasPermission) {
        showPermissionExplanation();
        return;
      }
      
      // Instead, store the ID in the local service
      socketService.socketEmit('set_remote_user', { userId: user._id });
      
      // Check if socket is connected
      const socket = socketService.getSocket();
      if (!socket || !socket.connected) {
        console.log('Socket not connected, initializing...');
        
        // Show connecting dialog
        setProgressMessage('Connecting to server...');
        setShowProgress(true);
        
        await socketService.initialize();
        
        // Check again after initialization
        if (!socketService.getSocket()?.connected) {
          setShowProgress(false);
          throw new Error('Failed to connect to signaling server. Please check your internet connection.');
        }
      }
      
      console.log(`Initiating call to ${user.name} (${user._id})`);
      
      // Update progress dialog
      setProgressMessage(`Connecting to ${user.name}...`);
      setShowProgress(true);
      
      // Initialize call service if needed
      callService.initialize();
      
      // Navigate to call screen first so UI is ready
      console.log('Navigating to call screen');
      // Hide connecting screen if it's showing
      setShowConnecting(false);
      setConnectingPartner(null);
      
      navigation.navigate('CallScreen', { 
        id: user._id, 
        name: user.name, 
        isVideoCall: false 
      });
      
      // Add a longer delay to ensure navigation is complete
      setTimeout(async () => {
        try {
          // Start the call with audio only (no video)
          console.log('Starting call with user:', user._id);
          await callService.startCall(user._id, user.name, { audio: true, video: false });
          console.log('Call initiated successfully');
          
          // Update call status for both users
          const currentUserId = await getCurrentUserId();
          simpleUserStatusService.setUserCallStatus(currentUserId, true);
          simpleUserStatusService.setUserCallStatus(user._id, true);
          
          // Clear ready-to-talk status when call starts
          setCurrentUserReady(false);
          socketService.socketEmit('set-ready-to-talk', { status: false });
          
          // Hide progress dialog
          setShowProgress(false);
        } catch (callStartError: any) {
          console.error('Error in delayed call start:', callStartError);
          
          // Hide progress dialog
          setShowProgress(false);
          
          Alert.alert(
            'Call Failed', 
            `Could not start call: ${callStartError.message || 'Please check microphone permissions and try again.'}`
          );
          
          // Navigate back if there was an error
          navigation.goBack();
        }
      }, 1000); // Increased delay to ensure navigation completes
      
    } catch (error: any) {
      console.error('Error starting call:', error);
      
      // Hide progress dialog
      setShowProgress(false);
      
      Alert.alert(
        'Call Failed', 
        `Failed to start call: ${error.message || 'Please try again later.'}`
      );
    }
  };

  // Handle video call to a user
  const handleVideoCallPress = async (user: User) => {
    try {
      // Get current user status from the service
      const userStatus = simpleUserStatusService.getUserStatus(user._id);
      
      // Check if user is on call
      if (userStatus?.isOnCall) {
        Alert.alert(
          'User Busy', 
          'This user is currently on a call. Please try video calling them later.',
          [{ text: 'OK', style: 'default' }]
        );
        return;
      }
      
      // Check if user is online, but still allow calling with a warning
      if (!user.isOnline) {
        Alert.alert(
          'User Offline', 
          'This user is currently offline. You can still try to video call them, but they may not answer immediately.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Call Anyway', onPress: () => proceedWithVideoCall(user) }
          ]
        );
        return;
      }
      
      // Proceed with video call for online users
      await proceedWithVideoCall(user);
    } catch (error) {
      console.error('Error starting video call:', error);
      
      // Hide progress dialog
      setShowProgress(false);
      
      Alert.alert(
        'Video Call Failed', 
        `Failed to start video call: ${error instanceof Error ? error.message : 'Please try again later'}`
      );
    }
  };

  // Proceed with the actual video call logic
  const proceedWithVideoCall = async (user: User) => {
    try {
      // Request microphone and camera permissions before starting the call
      const hasMicPermission = await requestMicrophonePermission();
      
      if (!hasMicPermission) {
        showPermissionExplanation();
        return;
      }
      
      // Request camera permission
      let hasCameraPermission = false;
      try {
        const cameraStream = await mediaDevices.getUserMedia({
          audio: false,
          video: true
        });
        
        // Stop all tracks to avoid keeping the camera on
        cameraStream.getTracks().forEach(track => track.stop());
        hasCameraPermission = true;
      } catch (err) {
        console.error('Camera permission error:', err);
        hasCameraPermission = false;
      }
      
      if (!hasCameraPermission) {
        Alert.alert(
          'Camera Permission Required',
          'Video calls require camera access. Please grant camera permission in settings.',
          [{ text: 'OK', style: 'default' }]
        );
        return;
      }
      
      // Instead, store the ID in the local service
      socketService.socketEmit('set_remote_user', { userId: user._id });
      
      // Check if socket is connected
      const socket = socketService.getSocket();
      if (!socket || !socket.connected) {
        console.log('Socket not connected, initializing...');
        
        // Show connecting dialog
        setProgressMessage('Connecting to server...');
        setShowProgress(true);
        
        await socketService.initialize();
        
        // Check again after initialization
        if (!socketService.getSocket()?.connected) {
          setShowProgress(false);
          throw new Error('Failed to connect to signaling server. Please check your internet connection.');
        }
      }
      
      console.log(`Initiating video call to ${user.name} (${user._id})`);
      
      // Update progress dialog
      setProgressMessage(`Starting video call with ${user.name}...`);
      setShowProgress(true);
      
      // Initialize call service
      callService.initialize();
      
      // Navigate to call screen first so UI is ready
      console.log('Navigating to call screen');
      // Hide connecting screen if it's showing
      setShowConnecting(false);
      setConnectingPartner(null);
      
      navigation.navigate('CallScreen', { 
        id: user._id, 
        name: user.name, 
        isVideoCall: true 
      });
      
      // Add a longer delay to ensure navigation is complete
      setTimeout(async () => {
        try {
          // Start the video call with both audio and video enabled
          console.log('Starting video call with user:', user._id);
          await callService.startCall(user._id, user.name, { audio: true, video: true });
          console.log('Video call initiated successfully');
          
          // Update call status for both users
          const currentUserId = await getCurrentUserId();
          simpleUserStatusService.setUserCallStatus(currentUserId, true);
          simpleUserStatusService.setUserCallStatus(user._id, true);
          
          // Clear ready-to-talk status when video call starts
          setCurrentUserReady(false);
          socketService.socketEmit('set-ready-to-talk', { status: false });
          
          // Hide progress dialog
          setShowProgress(false);
        } catch (callStartError) {
          console.error('Error in delayed video call start:', callStartError);
          
          // Hide progress dialog
          setShowProgress(false);
          
          Alert.alert(
            'Video Call Failed', 
            `Could not start video call: ${callStartError instanceof Error ? callStartError.message : 'Please check camera and microphone permissions'}`
          );
          
          // Navigate back if there was an error
          navigation.goBack();
        }
      }, 1000); // Increased delay to ensure navigation completes
      
    } catch (error) {
      console.error('Error starting video call:', error);
      
      // Hide progress dialog
      setShowProgress(false);
      
      Alert.alert(
        'Video Call Failed', 
        `Failed to start video call: ${error instanceof Error ? error.message : 'Please try again later'}`
      );
    }
  };

  // Handle message to a user
  const handleMessagePress = (user: User) => {
    navigation.navigate('ChatDetail', { 
      id: user._id, 
      name: user.name,
      avatar: user.profilePic
    });
  };

  // Handle call cancellation
  const handleCancelCall = () => {
    setShowProgress(false);
    // Maybe add some cleanup code here
  };

  // Handle pull-to-refresh
  const handleRefresh = () => {
    setRefreshing(true);
    fetchUsers();
  };

  // Store timeout reference
  const searchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  
  // Handle partner call auto-accepted (navigate receiving user to CallScreen)
  const handlePartnerCallAutoAccepted = (data: any) => {
    console.log('🤝 NAVIGATION EVENT: Partner call auto-accepted - navigating to CallScreen');
    console.log('🤝 NAVIGATION DATA:', JSON.stringify(data, null, 2));
    console.log('🤝 CURRENT SCREEN STATE:', {
      showConnecting,
      connectingPartner: connectingPartner?.name,
      showPartnerSearch,
      findingPartner
    });
    
    // Close connecting screen
    setShowConnecting(false);
    setConnectingPartner(null);
    
    // Navigate to CallScreen
    console.log('🤝 NAVIGATING TO CALLSCREEN with params:', {
      id: data.callerId,
      name: data.callerName,
      isVideoCall: data.isVideo || false,
      avatar: "https://randomuser.me/api/portraits/men/32.jpg"
    });
    
    navigation.navigate('CallScreen', {
      id: data.callerId,
      name: data.callerName,
      isVideoCall: data.isVideo || false,
      avatar: "https://randomuser.me/api/portraits/men/32.jpg" // Default avatar
    });
    
    console.log('🤝 NAVIGATION COMPLETED');
  };
  
  // Handle random call with the new functionality
  const handleRandomCall = async () => {
    try {
      console.log('🔍 Starting partner search...');
      
      // Clear any existing timeout
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = null;
      }
      
      // Set user as ready to talk when they click "Find a perfect partner"
      console.log('✅ Setting user as ready to talk');
      socketService.socketEmit('set-ready-to-talk', { status: true });
      setCurrentUserReady(true);
      
      // Pick a random emoji for the search screen
      const emojis = ['👨‍🍳', '🧑‍🎓', '👩‍🏫', '🧑‍💼', '👨‍💻', '🧑‍🔬', '👩‍🚀', '🧑‍🎨'];
      setSearchEmoji(emojis[Math.floor(Math.random() * emojis.length)]);
      
      // Show the partner search screen
      setShowPartnerSearch(true);
      setFindingPartner(true);
      
      // Ensure socket connection is active
      const socket = socketService.getSocket();
      if (!socket || !socket.connected) {
        console.log('Socket not connected, reconnecting...');
        await socketService.initialize();
      }
      
      // Request a random partner with saved preferences
      console.log('📡 Emitting find-random-partner event with preferences:', filterSettings);
      socketService.socketEmit('find-random-partner', {
        preferences: {
          gender: filterSettings.gender,
          ratingMin: filterSettings.ratingMin,
          ratingMax: filterSettings.ratingMax,
          levelMin: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'][filterSettings.levelMin],
          levelMax: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'][filterSettings.levelMax]
        }
      });
      
      // Set a timeout to avoid waiting too long
      searchTimeoutRef.current = setTimeout(() => {
        console.log('⏰ Search timeout reached');
        if (findingPartner) {
          handleCancelSearch();
          Alert.alert(
            'No Partners Found',
            'No partners available right now. Please try again later.',
            [{ text: 'OK', style: 'default' }]
          );
        }
      }, 60000); // 60 second timeout
    } catch (error) {
      console.error('Error finding random partner:', error);
      handleCancelSearch();
      Alert.alert(
        'Error',
        'Failed to find a partner. Please try again later.',
        [{ text: 'OK', style: 'default' }]
      );
    }
  };

  // Cancel partner search
  const handleCancelSearch = () => {
    console.log('❌ Canceling partner search');
    
    // Clear timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }
    
    // Notify server to remove from queue
    socketService.socketEmit('cancel-partner-search', {});
    
    // Reset UI state
    setFindingPartner(false);
    setShowPartnerSearch(false);
    
    // Set as not ready to talk
    socketService.socketEmit('set-ready-to-talk', { status: false });
    setCurrentUserReady(false);
    
    console.log('✅ Partner search cancelled successfully');
  };

  // Handle search settings
  const handleSearchSettings = () => {
    setShowPartnerSearch(false);
    // Navigate to settings or show a settings modal
    Alert.alert(
      'Search Settings',
      'You can set your preferences for finding partners.',
      [
        { 
          text: 'Cancel', 
          style: 'cancel',
          onPress: () => setShowPartnerSearch(true)
        },
        { 
          text: 'Confirm', 
          onPress: () => {
            // Apply settings and restart search
            setShowPartnerSearch(true);
          }
        }
      ]
    );
  };

  // Handle cancel connecting
  const handleCancelConnecting = () => {
    console.log('❌ Canceling connection');
    setShowConnecting(false);
    setConnectingPartner(null);
    // Set as not ready
    socketService.socketEmit('set-ready-to-talk', { status: false });
    setCurrentUserReady(false);
  };

  // Force close search screen (for debugging)
  const forceCloseSearchScreen = () => {
    console.log('🔄 Force closing search screen');
    setShowPartnerSearch(false);
    setFindingPartner(false);
  };

  // Get current user ID from AsyncStorage
  const getCurrentUserId = async () => {
    try {
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        const user = JSON.parse(userData);
        return user._id || user.id || '';
      }
      return '';
    } catch (error) {
      console.error('Error getting current user ID:', error);
      return '';
    }
  };

  // Handle call state changes to close connecting screen
  const handleCallStateChange = (callState: any) => {
    console.log('📞 Call state changed:', callState.status);
    if (callState.status === 'connected' || callState.status === 'ringing') {
      // Close connecting screen when call starts
      console.log('📞 Call started - closing connecting screen');
      setShowConnecting(false);
      setConnectingPartner(null);
    }
  };

  // Handle call started event
  const handleCallStarted = async (data: any) => {
    console.log('📞 Call started event:', data);
    if (data.userId) {
      // Update call status for BOTH users (caller and receiver)
      simpleUserStatusService.setUserCallStatus(data.userId, true, data.callStartTime);
      
      // Get current user ID and mark both users as on call
      const currentUserId = await getCurrentUserId();
      
      // Update call status for both users
      if (currentUserId) {
        simpleUserStatusService.setUserCallStatus(currentUserId, true, data.callStartTime);
      }
      
      // Clear ready-to-talk status when call starts
      setCurrentUserReady(false);
      socketService.socketEmit('set-ready-to-talk', { status: false });
      
      // Update user status in the list - mark both users as on call
      setUsers(prevUsers => prevUsers.map((user: User) => {
        if (user._id === data.userId || user._id === currentUserId) {
          return { ...user, isOnCall: true };
        }
        return user;
      }));
    }
  };

  // Handle call ended event
  const handleCallEnded = async (data: any) => {
    console.log('📞 Call ended event:', data);
    if (data.userId) {
      // Update call status for BOTH users (caller and receiver)
      simpleUserStatusService.setUserCallStatus(data.userId, false);
      
      // Get current user ID and mark both users as not on call
      const currentUserId = await getCurrentUserId();
      
      // Update call status for both users
      if (currentUserId) {
        simpleUserStatusService.setUserCallStatus(currentUserId, false);
      }
      
      // Update user status in the list - mark both users as not on call
      setUsers(prevUsers => prevUsers.map((user: User) => {
        if (user._id === data.userId || user._id === currentUserId) {
          return { ...user, isOnCall: false };
        }
        return user;
      }));
    }
  };


  // Global partner found handler (always active)
  const globalPartnerFoundHandler = (data: any) => {
    console.log('🌍 GLOBAL: Partner found event received:', JSON.stringify(data, null, 2));
    console.log('🌍 GLOBAL: Current showPartnerSearch state:', showPartnerSearch);
    console.log('🌍 GLOBAL: Current findingPartner state:', findingPartner);
    console.log('🌍 GLOBAL: Component mounted and ready');
    
    if (data.partner || data.success) {
      const partner = data.partner;

      // Clear timeout
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = null;
      }

      console.log('🌍 GLOBAL: Forcing search screen close');
      setShowPartnerSearch(false);
      setFindingPartner(false);
      
      // Clear ready-to-talk status when partner is found
      console.log('🔴 Clearing ready-to-talk status - partner found');
      setCurrentUserReady(false);
      socketService.socketEmit('set-ready-to-talk', { status: false });
      
      console.log('🤝 Matched with:', partner.name);

      // Show connecting screen for BOTH users
      setConnectingPartner(partner);
      setShowConnecting(true);

      // Both users should see the connecting screen, but only one should initiate the call
      const initializeCall = async () => {
        try {
          const currentUserId = await getCurrentUserId();
          const shouldInitiateCall = currentUserId < partner._id; // Consistent ordering
          
          console.log(`🎯 Should initiate call: ${shouldInitiateCall} (current: ${currentUserId}, partner: ${partner._id})`);

          if (shouldInitiateCall) {
            console.log('🚀 This user will initiate the call');
            await handleAutomaticCall(partner);
          } else {
            console.log('⏳ This user will wait for incoming call');
            // Clear ready-to-talk status for both users when accepting
            console.log('🔴 Clearing ready-to-talk status - accepting incoming call');
            setCurrentUserReady(false);
            socketService.socketEmit('set-ready-to-talk', { status: false });
            // Just wait for the incoming call - the other user will initiate
            // The connecting screen will stay until the call starts
          }
        } catch (error) {
          console.error('Error in automatic call:', error);
          setShowConnecting(false);
          setConnectingPartner(null);
        }
      };

      // Start the call after a short delay to show connecting screen
      setTimeout(initializeCall, 2000); // 2 second delay to show connecting screen
    }
  };

  // Test socket connection (for debugging)
  const testSocketConnection = () => {
    console.log('🔍 Testing socket connection...');
    console.log('Socket connected:', socketService.getSocket()?.connected);
    
    // Test emit
    socketService.socketEmit('test-event', { message: 'Hello from client' });
    console.log('✅ Test event sent');
  };

  // Test force close search screen (for debugging)
  const testForceCloseSearch = () => {
    console.log('🧪 TEST: Manually forcing search screen close');
    console.log('🧪 TEST: Current showPartnerSearch:', showPartnerSearch);
    console.log('🧪 TEST: Current findingPartner:', findingPartner);
    setShowPartnerSearch(false);
    setFindingPartner(false);
    console.log('🧪 TEST: Search screen manually closed');
  };

  // Test manual navigation (for debugging)
  const testManualNavigation = () => {
    console.log('🧪 TEST: Manually triggering navigation to CallScreen');
    handlePartnerCallAutoAccepted({
      callerId: 'test-caller-id',
      callerName: 'Test Caller',
      isVideo: false,
      callHistoryId: 'test-call-history'
    });
  };

  // Make functions available globally for debugging (React Native)
  if (typeof global !== 'undefined') {
    (global as any).testSocketConnection = testSocketConnection;
    (global as any).testForceCloseSearch = testForceCloseSearch;
    (global as any).testManualNavigation = testManualNavigation;
  }

  // Handle automatic call for partner matching (bypasses incoming call modal)
  const handleAutomaticCall = async (partner: User) => {
    try {
      console.log('🚀 Starting automatic partner call with:', partner.name);
      console.log('Partner ID:', partner._id);
      
      // Request microphone permission
      const hasPermission = await requestMicrophonePermission();
      if (!hasPermission) {
        showPermissionExplanation();
        setShowConnecting(false);
        setConnectingPartner(null);
        return;
      }
      
      // Set the remote user for the call service
      socketService.socketEmit('set_remote_user', { userId: partner._id });
      
      // Initialize call service
      callService.initialize();
      
      // Navigate to call screen first
      setShowConnecting(false);
      setConnectingPartner(null);
      
      navigation.navigate('CallScreen', { 
        id: partner._id, 
        name: partner.name, 
        isVideoCall: false 
      });
      
      // Start the call using regular call service after navigation
      setTimeout(async () => {
        try {
          console.log('📞 Starting partner matching call using regular call service...');
          console.log('Socket connected:', socketService.getSocket()?.connected);
          
          // Use regular call service to start the call with partner matching flag
          await callService.startCall(partner._id, partner.name, { audio: true, video: false, isPartnerMatching: true } as any);
          console.log('✅ Partner matching call started successfully');
        } catch (callError) {
          console.error('❌ Error starting partner matching call:', callError);
          // Navigate back to lobby if call fails
          navigation.navigate('Lobby');
        }
      }, 1000);
      
    } catch (error) {
      console.error('❌ Error in handleAutomaticCall:', error);
      setShowConnecting(false);
      setConnectingPartner(null);
    }
  };

  // Add this getter to determine if random calls are available
  const isRandomCallAvailable = true; // Always allow finding a partner

  // Handle pressing a user card to view their profile
  const handleUserPress = (user: User) => {
    navigation.navigate('UserProfile', {
      userId: user._id,
      userName: user.name
    });
  };

  // Set up global event listeners immediately when component mounts
  useEffect(() => {
    // Set up global partner found handler immediately
    console.log('🌍 SETUP: Setting up global partner found handler');
    console.log('🌍 SETUP: Socket service available:', !!socketService);
    console.log('🌍 SETUP: Socket connected:', socketService.getSocket()?.connected);
    
    socketService.socketOn('partner-found', globalPartnerFoundHandler);
    console.log('🌍 SETUP: Global partner found handler registered');
    
    return () => {
      console.log('🌍 CLEANUP: Removing global partner found handler');
      socketService.socketOff('partner-found', globalPartnerFoundHandler);
    };
  }, []); // No dependencies - always active

  // Load users when component mounts
  useEffect(() => {
    fetchUsers();
    
    // Clean up socket listeners when component unmounts
    return () => {
      // Clear timeout if exists
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = null;
      }
      
      // Cancel any ongoing search
      if (findingPartner) {
        socketService.socketEmit('cancel-partner-search', {});
      }
      
      // Remove each event listener individually
      socketService.socketOff('user-status');
      socketService.socketOff('user-ready-status');
      socketService.socketOff('ready-status-updated');
      socketService.socketOff('ready-users-list');
      socketService.socketOff('close-partner-search');
      socketService.socketOff('force-close-search');
      socketService.socketOff('partner-search-force-close');
      socketService.socketOff('debug-socket-events');
      socketService.socketOff('test-event-response');
      socketService.socketOff('partner-search-error');
      socketService.socketOff('random-partner-result');
      
      // Remove call service event listener
      callService.removeEventListener('call-state-changed', handleCallStateChange);
      callService.removeEventListener('partner-call-auto-accepted', handlePartnerCallAutoAccepted);
      callService.removeEventListener('call-started', handleCallStarted);
      callService.removeEventListener('call-ended', handleCallEnded);
    };
  }, []); // Remove findingPartner dependency to ensure listeners are always active

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A90E2" />
        <Text style={styles.loadingText}>Loading users...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.surface }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={theme.background} />
      
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <Text style={[styles.title, { color: theme.text }]}>{t('lobby.title')}</Text>
        <TouchableOpacity 
          style={styles.settingsButton}
          onPress={() => setShowFilterModal(true)}
        >
          <IconMaterial 
            name="tune" 
            size={24} 
            color={theme.text} 
          />
        </TouchableOpacity>
      </View>
      
      {readyUsers.length === 0 ? (
        <View style={[styles.emptyStateContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={[styles.emptyIconContainer, { backgroundColor: theme.inputBackground }]}>
            <IconMaterial name="person" size={50} color={theme.textTertiary} />
          </View>
          <Text style={[styles.emptyStateTitle, { color: theme.textSecondary }]}>{t('lobby.noOneHere')}</Text>
        </View>
      ) : null}
      
      {/* Ready to talk now horizontal section */}
      {readyUsers.length > 0 && (
        <View style={styles.readySection}>
          <Text style={[styles.readyTitle, { color: theme.text }]}>{t('lobby.readyToTalk')}</Text>
          <FlatList
            data={readyUsers}
            horizontal
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={[styles.readyCard, { backgroundColor: theme.card }]}
                onPress={() => handleCallPress(item)}
              >
                <Image 
                  source={{ uri: item.profilePic || 'https://randomuser.me/api/portraits/men/32.jpg' }} 
                  style={styles.readyAvatar} 
                />
                <Text style={[styles.readyName, { color: theme.text }]} numberOfLines={1}>{item.name}</Text>
                <TouchableOpacity 
                  style={[styles.readyTalkButton, { backgroundColor: theme.primary }]}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleCallPress(item);
                  }}
                >
                  <Text style={styles.readyTalkText}>{t('lobby.talkNow')}</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.readyListContent}
            showsHorizontalScrollIndicator={false}
          />
        </View>
      )}
      
      <View style={styles.inviteSection}>
        <Text style={[styles.inviteTitle, { color: theme.text }]}>{t('lobby.invitePartners')}</Text>
        <TouchableOpacity 
          style={[styles.refreshButton, { backgroundColor: theme.primary }]}
          onPress={handleRefresh}
        >
          <Icon name="refresh" size={22} color="white" />
          <Text style={styles.refreshText}>{t('lobby.refresh')}</Text>
        </TouchableOpacity>
      </View>
      
      <FlatList
        data={sortedUsers}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <UserCard 
            user={item} 
            onCallPress={() => handleCallPress(item)}
            onMessagePress={() => handleMessagePress(item)}
            onPress={() => handleUserPress(item)}
          />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No users available</Text>
            <Text style={styles.emptySubtext}>
              Try using "Find a perfect partner" to get matched with someone!
            </Text>
          </View>
        }
      />
      
      <TouchableOpacity 
        style={[
          styles.perfectPartnerButton,
          findingPartner && styles.buttonActive
        ]}
        onPress={handleRandomCall}
        disabled={findingPartner}
      >
        <Icon name="sparkles" size={20} color="white" style={styles.buttonIcon} />
        <Text style={styles.perfectPartnerText}>
          {findingPartner 
            ? 'Finding a partner...' 
            : 'Find a perfect partner'}
        </Text>
      </TouchableOpacity>
      
      {/* Partner Search Screen */}
      <PartnerSearchScreen
        visible={showPartnerSearch}
        onCancel={handleCancelSearch}
        onSettings={handleSearchSettings}
        emoji={searchEmoji}
      />
      
      {/* Connecting Screen */}
      <ConnectingScreen
        visible={showConnecting}
        partnerName={connectingPartner?.name}
        onCancel={handleCancelConnecting}
      />
      
      {/* Progress Dialog */}
      <ProgressDialog
        visible={showProgress}
        title={findingPartner ? "Finding Partner" : "Starting Call"}
        message={progressMessage}
        cancelable={true}
        onCancel={() => {
          setShowProgress(false);
          setFindingPartner(false);
          handleCancelCall();
        }}
      />
      
      {/* Filter Modal */}
      <FilterModal
        visible={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        onApply={(filters) => {
          setFilterSettings(filters);
          console.log('✅ Applied filters:', filters);
          // Filters will be used when searching for partners
        }}
        initialFilters={filterSettings}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor will be set dynamically with theme
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 10,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
    position: 'relative',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  settingsButton: {
    position: 'absolute',
    right: 20,
    padding: 5,
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 15,
    margin: 20,
    backgroundColor: '#F9F9F9',
  },
  emptyIconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#E5E5E5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyStateTitle: {
    fontSize: 18,
    color: '#888',
    textAlign: 'center',
  },
  inviteSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  inviteTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  refreshButton: {
    backgroundColor: '#673AB7',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 25,
  },
  refreshText: {
    color: 'white',
    marginLeft: 5,
    fontWeight: 'bold',
  },
  listContent: {
    padding: 15,
    paddingBottom: 100, // Extra padding for the bottom button
  },
  userCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  userCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  levelIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  levelText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  onlineIndicator: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4CAF50',
    borderWidth: 1,
    borderColor: 'white',
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  thumbsUp: {
    fontSize: 13,
    color: '#666',
  },
  userGender: {
    fontSize: 13,
    color: '#666',
  },
  userCountry: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  onlineText: {
    fontSize: 12,
    color: '#4CAF50',
    marginTop: 4,
  },
  offlineText: {
    fontSize: 12,
    color: '#F44336',
    marginTop: 4,
  },
  buttonsContainer: {
    flexDirection: 'column',
    justifyContent: 'space-between',
    height: 110,
  },
  callButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 30,
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  callButtonFullWidth: {
    width: '100%',
    borderRadius: 25,
    overflow: 'hidden',
  },
  callButtonDisabled: {
    backgroundColor: '#CCCCCC',
    opacity: 0.6,
  },
  offlineCallText: {
    color: '#666',
    fontSize: 10,
    marginTop: 2,
    fontWeight: '500',
  },
  onCallText: {
    color: '#FF6B6B',
    fontSize: 10,
    marginTop: 2,
    fontWeight: '600',
  },
  messageButton: {
    backgroundColor: '#673AB7',
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  perfectPartnerButton: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: '#673AB7',
    padding: 16,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#673AB7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
    shadowOpacity: 0.1,
  },
  buttonIcon: {
    marginRight: 10,
  },
  perfectPartnerText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#888',
    marginTop: 8,
    textAlign: 'center',
  },
  buttonActive: {
    backgroundColor: '#4A148C', // Darker purple when active
  },
  readySection: {
    paddingVertical: 15,
    backgroundColor: '#FFFFFF',
  },
  readyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  readyListContent: {
    paddingHorizontal: 15,
  },
  readyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginRight: 12,
    width: 120,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  readyAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 8,
  },
  readyName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  readyTalkButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    width: '100%',
  },
  readyTalkText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default LobbyScreen; 