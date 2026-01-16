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
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/types';
import { getAllUsers } from '../utils/userService';
import socketService from '../utils/socketService';
//import callService from '../utils/callService';
import callFlowService, { CallType } from '../utils/callFlowService';
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
//import { mediaDevices } from 'react-native-webrtc';
import simpleUserStatusService from '../services/simpleUserStatusService';
import { useUserStatusService } from '../hooks/useUserStatus';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { RootState, store } from '../redux/store';
import type { UserStatusType } from '../redux/slices/userStatusSlice';

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
  
  // UNIFIED USER STATUS SYSTEM - Get status from Redux store
  const userStatusData = useSelector((state: RootState) => 
    state.userStatus.statuses[user._id] || { status: 'offline' as const, lastUpdated: new Date().toISOString() }
  );

  // Request status update when component mounts
  useEffect(() => {
    // Import and request status for this user
    import('../services/userStatusService').then(({ default: userStatusService }) => {
      userStatusService.requestUserStatus(user._id);
    });
  }, [user._id]);
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
          {/* UNIFIED USER STATUS SYSTEM - Show online indicator based on status */}
          {userStatusData.status === 'online' && <View style={styles.onlineIndicator} />}
          {userStatusData.status === 'on_call' && (
            <View style={[styles.onlineIndicator, { backgroundColor: '#FF9800' }]} />
          )}
          {userStatusData.status === 'searching' && (
            <View style={[styles.onlineIndicator, { backgroundColor: '#9C27B0' }]} />
          )}
        </View>
        
        <View style={styles.userInfo}>
          <Text style={[styles.userName, { color: theme.text }]}>
            {user.name}
          </Text>
          <View style={styles.ratingContainer}>
            {user.rating && (
              <Text style={[styles.thumbsUp, { color: theme.textSecondary }]}>👍 {user.rating}%</Text>
            )}
            {user.gender && (
              <Text style={[styles.userGender, { color: theme.textSecondary }]}>
                {user.rating ? ' • ' : ''}{user.gender}
              </Text>
            )}
        </View>
          <Text style={[styles.userCountry, { color: theme.textSecondary }]}>
            {user.country || '🌎 Global'}{user.talks && user.talks > 0 ? ` • ${user.talks} talks` : ''}
          </Text>
          {/* UNIFIED USER STATUS SYSTEM - Display status text */}
          <Text style={[
            userStatusData.status === 'offline' ? styles.offlineText : styles.onlineText,
            { 
              color: userStatusData.status === 'offline' 
                ? theme.textTertiary 
                : userStatusData.status === 'on_call'
                ? '#FF9800'
                : userStatusData.status === 'searching'
                ? '#9C27B0'
                : theme.success
            }
          ]}>
            {userStatusData.status === 'offline' 
              ? t('lobby.offline')
              : userStatusData.status === 'on_call'
              ? t('lobby.onCall')
              : userStatusData.status === 'searching'
              ? 'Searching...'
              : t('lobby.online')
            }
          </Text>
          {/* Debug info */}
          {/* {__DEV__ && (
            <Text style={{ fontSize: 8, color: '#999', marginTop: 2 }}>
              {userStatus?.isOnline ? '🟢' : '🔴'} {userStatus?.isOnline ? 'Online' : 'Offline'}
            </Text>
          )} */}
        </View>
        
        <View style={styles.buttonsContainer}>
          {/* UNIFIED USER STATUS SYSTEM - Render UI based on status */}
          {userStatusData.status === 'offline' ? (
            // OFFLINE: Show message icon ONLY
            <TouchableOpacity 
              style={[
                styles.callButton, 
                styles.callButtonFullWidth,
                styles.messageButton,
                { backgroundColor: theme.primary },
              ]} 
              onPress={(e) => {
                e.stopPropagation();
                onMessagePress();
              }}
            >
              <IconMaterial 
                name="message" 
                size={24} 
                color="white" 
              />
            </TouchableOpacity>
          ) : userStatusData.status === 'on_call' ? (
            // ON_CALL: Show disabled call icon with badge
            <TouchableOpacity 
              style={[
                styles.callButton, 
                styles.callButtonFullWidth,
                { backgroundColor: theme.inputBackground },
              ]} 
              disabled={true}
            >
              <IconMaterial 
                name="call-end" 
                size={24} 
                color={theme.textTertiary} 
              />
              <Text style={[styles.onCallText, { color: theme.textTertiary }]}>{t('lobby.onCall')}</Text>
            </TouchableOpacity>
          ) : userStatusData.status === 'searching' ? (
            // SEARCHING: Show "Talk Now" button (lightning/match icon)
            <TouchableOpacity 
              style={[
                styles.callButton, 
                styles.callButtonFullWidth,
                { backgroundColor: '#9C27B0' },
              ]} 
              onPress={(e) => {
                e.stopPropagation();
                onCallPress();
              }}
            >
              <Icon name="flash" size={24} color="white" />
              <Text style={[styles.onCallText, { color: 'white' }]}>Talk Now</Text>
            </TouchableOpacity>
          ) : (
            // ONLINE: Show call icon ENABLED
            <TouchableOpacity 
              style={[
                styles.callButton, 
                styles.callButtonFullWidth,
                { backgroundColor: theme.primary },
              ]} 
              onPress={(e) => {
                e.stopPropagation();
                onCallPress();
              }}
            >
              <IconMaterial 
                name="call" 
                size={24} 
                color="white" 
              />
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

  // Track which users have been added to status tracking to prevent infinite loops
  const trackedUserIdsRef = React.useRef<Set<string>>(new Set());

  // Memoize sorted users list to avoid re-rendering issues
  const sortedUsers = useMemo(() => {
    console.log('🔍 sortedUsers memo recalculating with:', {
      totalUsers: users.length,
      readyUsers: readyUsers.length,
      filterSettings
    });
    
    // Apply filters to users
    const filteredUsers = users.filter((user: User) => {
      // Gender filter
      if (filterSettings.gender !== 'all') {
        const userGender = (user.gender || '').toLowerCase();
        if (userGender !== filterSettings.gender.toLowerCase()) {
          if (__DEV__) console.log(`🔍 User ${user.name} filtered out by gender: ${userGender} !== ${filterSettings.gender}`);
          return false;
        }
      }
      
      // Rating filter
      if (user.rating) {
        if (user.rating < filterSettings.ratingMin || user.rating > filterSettings.ratingMax) {
          if (__DEV__) console.log(`🔍 User ${user.name} filtered out by rating: ${user.rating} not in [${filterSettings.ratingMin}, ${filterSettings.ratingMax}]`);
          return false;
        }
      }
      
      // Level filter
      if (user.level) {
        const englishLevels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
        const userLevelIndex = englishLevels.indexOf(user.level);
        
        // If user has a non-standard level (like "Intermediate"), allow them through
        // Only filter if they have a standard level that's outside the range
        if (userLevelIndex !== -1 && (userLevelIndex < filterSettings.levelMin || userLevelIndex > filterSettings.levelMax)) {
          if (__DEV__) console.log(`🔍 User ${user.name} filtered out by level: ${user.level} (index ${userLevelIndex}) not in [${filterSettings.levelMin}, ${filterSettings.levelMax}]`);
          return false;
        }
        // If userLevelIndex is -1 (non-standard level), allow them through
      }
      
      return true;
    });
    
    console.log('🔍 After filter application:', {
      filteredUsersCount: filteredUsers.length,
      filteredUserIds: filteredUsers.map(u => u._id),
      allUserIds: users.map(u => u._id),
      allUserNames: users.map(u => u.name)
    });
    
    // First, get ready-to-talk users (sorted by rating descending)
    // Log readyUsers before filtering
    console.log('🔍 [SORTED_USERS] Current readyUsers:', readyUsers.map(u => ({
      id: u._id,
      name: u.name,
      readyToTalk: u.readyToTalk
    })));
    
    // Get Redux statuses for all users to check for searching
    const reduxStatuses = store.getState().userStatus.statuses;
    const readyUsersWithSearching = [...readyUsers];
    
    // Also add users from main list that are searching but not in readyUsers
    users.forEach(user => {
      const reduxStatus = reduxStatuses[user._id];
      const isSearching = reduxStatus?.status === 'searching';
      const isInReadyUsers = readyUsers.some(ru => ru._id === user._id);
      
      if (isSearching && !isInReadyUsers) {
        console.log(`🔍 [SORTED_USERS] Adding searching user ${user.name} (${user._id}) to readyUsers`);
        readyUsersWithSearching.push(user);
      }
    });
    
    const readyUsersSorted = readyUsersWithSearching
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
          
          // If user has a non-standard level (like "Intermediate"), allow them through
          // Only filter if they have a standard level that's outside the range
          if (userLevelIndex !== -1 && (userLevelIndex < filterSettings.levelMin || userLevelIndex > filterSettings.levelMax)) {
            return false;
          }
          // If userLevelIndex is -1 (non-standard level), allow them through
        }
        return true;
      })
      .sort((a, b) => (b.rating || 0) - (a.rating || 0));
    
    // Get ready user IDs to exclude them from otherOnlineUsers
    const readyUserIds = new Set(readyUsersWithSearching.map(u => u._id));
    
    // Then get other online users (not ready to talk, sorted by rating descending)
    // Check status service as fallback for online status
    const otherOnlineUsers = filteredUsers
      .filter((user: User) => {
        // Exclude users that are in readyUsers list
        if (readyUserIds.has(user._id)) {
          return false;
        }
        
        // Exclude users with status "searching" (they're in readyUsers)
        const reduxStatusForUser = reduxStatuses[user._id];
        if (reduxStatusForUser?.status === 'searching') {
          return false;
        }
        
        const status = simpleUserStatusService.getUserStatus(user._id);
        const isOnline = status?.isOnline ?? user.isOnline;
        const isOnCall = status?.isOnCall ?? user.isOnCall;
        const shouldShow = isOnline && !user.readyToTalk && !isOnCall;
        
        // Debug logging for all users
        console.log(`🔍 Filtering user ${user.name} (${user._id}):`, {
          userId: user._id,
          userIsOnline: user.isOnline,
          statusIsOnline: status?.isOnline,
          statusExists: !!status,
          finalIsOnline: isOnline,
          readyToTalk: user.readyToTalk,
          isOnCall,
          shouldShow,
          userObject: {
            _id: user._id,
            name: user.name,
            isOnline: user.isOnline,
            readyToTalk: user.readyToTalk,
            isOnCall: user.isOnCall
          }
        });
        
        return shouldShow;
      })
      .sort((a: User, b: User) => (b.rating || 0) - (a.rating || 0));
    
    // Debug: Log final sorted users
    if (__DEV__) {
      console.log('📊 Final sortedUsers:', {
        readyUsers: readyUsersSorted.length,
        otherOnlineUsers: otherOnlineUsers.length,
        total: readyUsersSorted.length + otherOnlineUsers.length,
        readyUserIds: readyUsersSorted.map(u => u._id),
        otherOnlineUserIds: otherOnlineUsers.map(u => u._id)
      });
    }
    
    // Return ready users first, then other online users
    return [...readyUsersSorted, ...otherOnlineUsers];
  }, [readyUsers, users, filterSettings]);

  // Add users to status tracking when users list changes with initial status
  // Only add new users that haven't been tracked yet to prevent infinite loops
  useEffect(() => {
    if (statusServiceReady && users.length > 0) {
      console.log('🔧 Adding users to status tracking:', users.length);
      users.forEach(user => {
        // Only add if not already tracked
        if (!trackedUserIdsRef.current.has(user._id)) {
          trackedUserIdsRef.current.add(user._id);
          const initialStatus = {
            isOnline: user.isOnline ?? true, // Default to true for users from API
            lastSeenAt: undefined
          };
          console.log(`🔧 Adding user ${user.name} (${user._id}) to tracking with initial status:`, initialStatus);
          // Pass initial status from API to status service
          simpleUserStatusService.addUserToTracking(user._id, initialStatus);
          
          // Verify status was set correctly
          const setStatus = simpleUserStatusService.getUserStatus(user._id);
          console.log(`🔧 User ${user.name} status after adding:`, setStatus);
        } else {
          console.log(`🔧 User ${user.name} (${user._id}) already tracked, updating status if needed`);
          // Update existing status if user data changed
          simpleUserStatusService.addUserToTracking(user._id, {
            isOnline: user.isOnline ?? true,
            lastSeenAt: undefined
          });
        }
      });
    }
  }, [statusServiceReady, users]);

  // Subscribe to status updates and sync to local users state
  // Use useCallback to prevent recreating the subscription on every render
  useEffect(() => {
    if (!statusServiceReady) return;

    const unsubscribe = simpleUserStatusService.subscribeToStatusUpdates((allStatuses) => {
      console.log('📊 LobbyScreen: Status update received, syncing to local state');
      
      // Log status changes, especially for 'searching'
      const currentReduxStatuses = store.getState().userStatus.statuses;
      console.log('📊 LobbyScreen: Current Redux statuses:', Object.keys(currentReduxStatuses).map(userId => ({
        userId,
        status: currentReduxStatuses[userId]?.status,
        lastUpdated: currentReduxStatuses[userId]?.lastUpdated
      })));
      
      // Check for searching users
      const searchingUsers = Object.keys(currentReduxStatuses).filter(userId => currentReduxStatuses[userId]?.status === 'searching');
      if (searchingUsers.length > 0) {
        console.log('🔍 LobbyScreen: Found searching users:', searchingUsers);
      }
      
      setUsers(prevUsers => {
        let hasChanges = false;
        const updatedUsers = prevUsers.map((user: User) => {
          const status = allStatuses.get(user._id);
          if (status) {
            // Check if status actually changed before updating
            const isOnlineChanged = user.isOnline !== status.isOnline;
            const isOnCallChanged = (user.isOnCall ?? false) !== (status.isOnCall ?? false);
            
            if (isOnlineChanged || isOnCallChanged) {
              hasChanges = true;
              // Update user's online status from the service
              return {
                ...user,
                isOnline: status.isOnline,
                isOnCall: status.isOnCall ?? false
              };
            }
          }
          return user;
        });
        
        // Only update state if there were actual changes
        if (hasChanges) {
          // Also update ready users list based on updated status
          // Include users with readyToTalk OR status === 'searching'
          const filteredReadyUsers = updatedUsers.filter((user: User) => {
            const status = allStatuses.get(user._id);
            const isOnline = status?.isOnline ?? user.isOnline;
            const isOnCall = status?.isOnCall ?? user.isOnCall;
            
            // Get Redux status to check for 'searching'
            const reduxStatus = store.getState().userStatus.statuses[user._id];
            const isSearching = reduxStatus?.status === 'searching';
            
            // Log for searching users
            if (isSearching) {
              console.log(`🔍 [READY_USERS] Checking searching user ${user.name} (${user._id}):`, {
                isOnline,
                isOnCall,
                readyToTalk: user.readyToTalk,
                reduxStatus: reduxStatus?.status,
                willInclude: isOnline && !isOnCall
              });
            }
            
            // Include if: online AND (readyToTalk OR searching) AND not on_call
            const shouldInclude = isOnline && (user.readyToTalk || isSearching) && !isOnCall;
            return shouldInclude;
          });
          
          console.log(`📊 [READY_USERS] Updated ready users list:`, {
            total: filteredReadyUsers.length,
            userIds: filteredReadyUsers.map(u => ({ id: u._id, name: u.name })),
            searchingCount: filteredReadyUsers.filter(u => {
              const reduxStatus = store.getState().userStatus.statuses[u._id];
              return reduxStatus?.status === 'searching';
            }).length
          });
          
          setReadyUsers(filteredReadyUsers);
        }
        
        return hasChanges ? updatedUsers : prevUsers;
      });
    });

    return () => {
      unsubscribe();
    };
  }, [statusServiceReady]);

  // Get all user statuses from Redux store
  const allReduxStatuses = useSelector((state: RootState) => state.userStatus.statuses);

  // Watch Redux status changes and update readyUsers when users become 'searching'
  useEffect(() => {
    console.log('🔍 [REDUX_WATCH] useEffect triggered, checking readyUsers');
    console.log('🔍 [REDUX_WATCH] Current users count:', users.length);
    console.log('🔍 [REDUX_WATCH] Redux statuses:', Object.keys(allReduxStatuses).map(userId => ({
      userId,
      status: allReduxStatuses[userId]?.status
    })));
    
    // Filter users to include those with readyToTalk OR status === 'searching'
    const filteredReadyUsers = users.filter((user: User) => {
      const status = simpleUserStatusService.getUserStatus(user._id);
      const isOnline = status?.isOnline ?? user.isOnline;
      const isOnCall = status?.isOnCall ?? user.isOnCall;
      
      // Get Redux status to check for 'searching'
      const reduxStatus = allReduxStatuses[user._id];
      const isSearching = reduxStatus?.status === 'searching';
      
      // Log searching users
      if (isSearching) {
        console.log(`🔍 [REDUX_WATCH] User ${user.name} (${user._id}) is searching:`, {
          isOnline,
          isOnCall,
          readyToTalk: user.readyToTalk,
          reduxStatus: reduxStatus?.status,
          willInclude: isOnline && (user.readyToTalk || isSearching) && !isOnCall
        });
      }
      
      // Include if: online AND (readyToTalk OR searching) AND not on_call
      return isOnline && (user.readyToTalk || isSearching) && !isOnCall;
    });
    
    // Only update if the list actually changed
    const currentReadyIds = new Set(readyUsers.map(u => u._id));
    const newReadyIds = new Set(filteredReadyUsers.map(u => u._id));
    const hasChanged = currentReadyIds.size !== newReadyIds.size ||
      [...currentReadyIds].some(id => !newReadyIds.has(id));
    
    if (hasChanged) {
      console.log(`📊 [REDUX_WATCH] Updating readyUsers:`, {
        previousCount: readyUsers.length,
        newCount: filteredReadyUsers.length,
        previousIds: [...currentReadyIds],
        newIds: [...newReadyIds],
        searchingUsers: filteredReadyUsers.filter(u => {
          const reduxStatus = allReduxStatuses[u._id];
          return reduxStatus?.status === 'searching';
        }).map(u => ({ id: u._id, name: u.name }))
      });
      setReadyUsers(filteredReadyUsers);
    } else {
      console.log(`📊 [REDUX_WATCH] No changes detected, keeping readyUsers as is`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users, allReduxStatuses]); // Note: Intentionally exclude readyUsers from deps to avoid loop

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
      console.log('📥 Fetched online users:', fetchedUsers.length);
      console.log('📥 Fetched users data:', fetchedUsers.map((u: User) => ({ 
        id: u._id, 
        name: u.name, 
        isOnline: u.isOnline, 
        readyToTalk: u.readyToTalk,
        gender: u.gender,
        rating: u.rating,
        level: u.level
      })));
      
      // Ensure all users have isOnline property set correctly
      const usersWithStatus = fetchedUsers.map((user: User) => ({
        ...user,
        isOnline: user.isOnline ?? true // Default to true for users from online-users endpoint
      }));
      
      console.log('📥 Users with status:', usersWithStatus.map((u: User) => ({ 
        id: u._id, 
        name: u.name, 
        isOnline: u.isOnline 
      })));
      
      // Clear tracked users ref when fetching new users to allow re-tracking
      trackedUserIdsRef.current.clear();
      
      // Use real data only - no mock data
      // Update state with fetched users
      setUsers(usersWithStatus);
      
      // Filter users who are ready to talk
      const usersReadyToTalk = usersWithStatus.filter((user: User) => user.isOnline && user.readyToTalk);
      console.log('📥 Ready to talk users:', usersReadyToTalk.length);
      setReadyUsers(usersReadyToTalk);
      
      // UNIFIED USER STATUS SYSTEM - Request status updates for all displayed users
      import('../services/userStatusService').then(({ default: userStatusService }) => {
        const userIds = usersWithStatus.map((u: User) => u._id);
        if (userIds.length > 0) {
          console.log(`📊 Requesting status updates for ${userIds.length} users`);
          userStatusService.requestMultipleUserStatuses(userIds);
        }
      });
      
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
      // Use real data only - no mock data
      const usersWithStatus = standardUsers.map((user: User) => ({
        ...user,
        isOnline: false // Default to offline unless socket confirms they're online
      }));
      
      // Clear tracked users ref when fetching new users to allow re-tracking
      trackedUserIdsRef.current.clear();
      
      setUsers(usersWithStatus);
      
      // UNIFIED USER STATUS SYSTEM - Request status updates for all displayed users
      import('../services/userStatusService').then(({ default: userStatusService }) => {
        const userIds = usersWithStatus.map((u: User) => u._id);
        if (userIds.length > 0) {
          console.log(`📊 Requesting status updates for ${userIds.length} users (fallback)`);
          userStatusService.requestMultipleUserStatuses(userIds);
        }
      });
      
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

      // DELETED: partner-call-auto-accepted listener - navigation happens when CONNECTED
      // (handled by callFlowService 'call:navigate-to-callscreen' event)
      // callService.addEventListener('call-state-changed', handleCallStateChange);
      // callService.addEventListener('partner-call-auto-accepted', handlePartnerCallAutoAccepted);
      
      // Add call status tracking listeners
        // callService.addEventListener('call-started', handleCallStarted);
        // callService.addEventListener('call-ended', handleCallEnded);
      
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
      // Include users with readyToTalk OR status === 'searching'
      setReadyUsers(updatedUsers.filter((user: User) => {
        if (!user.isOnline) return false;
        if (user.isOnCall) return false;
        
        // Check Redux status for 'searching'
        const reduxStatus = store.getState().userStatus.statuses[user._id];
        const isSearching = reduxStatus?.status === 'searching';
        
        return user.readyToTalk || isSearching;
      }));
      
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
      
      // Filter ready users: must be online AND (readyToTalk OR searching) AND not on call
      // Check status service as fallback for online/call status
      const filteredReadyUsers = updatedUsers.filter((user: User) => {
        const status = simpleUserStatusService.getUserStatus(user._id);
        const isOnline = status?.isOnline ?? user.isOnline;
        const isOnCall = status?.isOnCall ?? user.isOnCall;
        
        // Get Redux status to check for 'searching'
        const reduxStatus = store.getState().userStatus.statuses[user._id];
        const isSearching = reduxStatus?.status === 'searching';
        
        // Include if: online AND (readyToTalk OR searching) AND not on_call
        const isReadyUser = isOnline && (user.readyToTalk || isSearching) && !isOnCall;
        if (isReadyUser) {
          console.log(`✅ User ${user.name} is ready to talk ${isSearching ? '(searching)' : ''}`);
        } else if (isOnline && (user.readyToTalk || isSearching) && isOnCall) {
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
      
      // Filter to only show users who are online AND (readyToTalk OR searching) AND not on call
      // Check status service as fallback for online/call status
      const filteredReadyUsers = updatedUsers.filter((user: User) => {
        const status = simpleUserStatusService.getUserStatus(user._id);
        const isOnline = status?.isOnline ?? user.isOnline;
        const isOnCall = status?.isOnCall ?? user.isOnCall;
        
        // Get Redux status to check for 'searching'
        const reduxStatus = store.getState().userStatus.statuses[user._id];
        const isSearching = reduxStatus?.status === 'searching';
        
        // Include if: online AND (readyToTalk OR searching) AND not on_call
        return isOnline && (user.readyToTalk || isSearching) && !isOnCall;
      });
      
      console.log(`📊 Total ready users after list update: ${filteredReadyUsers.length}`);
      setReadyUsers(filteredReadyUsers);
      
      return updatedUsers;
    });
  };

  // Get user status from Redux store (used in handleCallPress)
  const getUserStatusFromStore = (userId: string) => {
    const state = store.getState();
    return state.userStatus.statuses[userId] || { status: 'offline' as const };
  };

  // Handle initiating a call to a user
  const handleCallPress = async (user: User) => {
    try {
      // Get current user status from Redux
      const userStatusData = getUserStatusFromStore(user._id);

      // Check if user is searching - show Talk Now
      if (userStatusData.status === 'searching') {
        await handleTalkNow(user);
        return;
      }

      // Get current user status from the service
      const userStatus = simpleUserStatusService.getUserStatus(user._id);
      
      // Check if user is on call
      if (userStatus?.isOnCall || userStatusData.status === 'on_call') {
        Alert.alert(
          'User Busy', 
          'This user is currently on a call. Please try calling them later.',
          [{ text: 'OK', style: 'default' }]
        );
        return;
      }
      
      // Check if user is online, but still allow calling with a warning
      if (!user.isOnline && userStatusData.status !== 'online') {
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

  // Handle Talk Now - Instant connect to searching user
  const handleTalkNow = async (user: User) => {
    try {
      console.log(`⚡ [TALK NOW] Initiating instant connection to ${user.name} (${user._id})`);

      // Request microphone permission
      const hasPermission = await requestMicrophonePermission();
      if (!hasPermission) {
        showPermissionExplanation();
        return;
      }

      setShowProgress(true);
      setProgressMessage('Connecting...');

      // Call Talk Now API endpoint
      const token = await getAuthToken();
      const response = await fetch(`${API_URL}/calls/talk-now`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          targetUserId: user._id
        })
      });

      // Check if response is ok and content type is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('❌ Server returned non-JSON response:', text.substring(0, 200));
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to connect');
      }

      setShowProgress(false);

      // Show ConnectingModal immediately
      setShowConnecting(true);
      setConnectingPartner(user);

      // call:start will be emitted by server, which will trigger WebRTC
      console.log('✅ [TALK NOW] API call successful, waiting for call:start event');
    } catch (error: any) {
      console.error('❌ [TALK NOW] Error:', error);
      setShowProgress(false);
      Alert.alert(
        'Connection Failed',
        error.message || 'Failed to connect. The user may have been matched with someone else.',
        [{ text: 'OK' }]
      );
    }
  };

  // Proceed with the actual call logic - FIXED: Uses callFlowService for proper signaling flow
  const proceedWithCall = async (user: User) => {
    try {
      // Request microphone permission before starting the call
      const hasPermission = await requestMicrophonePermission();
      
      if (!hasPermission) {
        showPermissionExplanation();
        return;
      }
      
      // Ensure socket is connected
      const socket = socketService.getSocket();
      if (!socket || !socket.connected) {
        console.log('Socket not connected, initializing...');
        setProgressMessage('Connecting to server...');
        setShowProgress(true);
        await socketService.initialize();
        if (!socketService.getSocket()?.connected) {
          setShowProgress(false);
          throw new Error('Failed to connect to signaling server. Please check your internet connection.');
        }
      }
      
      console.log(`📞 [DIRECT CALL] Initiating call to ${user.name} (${user._id})`);
      
      // Initialize call flow service
      callFlowService.initialize();
      
      // Initialize call service (for WebRTC, will be used after acceptance)
      //callService.initialize();
      
      // Close any progress/connecting dialogs
      setShowConnecting(false);
      setConnectingPartner(null);
      setShowProgress(false);
      
      // INVITATION-FIRST ARCHITECTURE:
      // Send invitation (NOT call) - OutgoingInvitationModal will show at app root level
      // Call starts ONLY after invitation acceptance via call:start event
      // DO NOT initialize WebRTC here - it will start after call:start event
      await callFlowService.sendInvitation(
        user._id,
        CallType.DIRECT_CALL,
        { isVideo: false },
        user.name // Pass receiver name for UI
      );
      
      console.log('✅ [DIRECT CALL] call:invite sent, waiting for acceptance...');
      console.log('📱 OutgoingInvitationModal should now be visible (invitation status: inviting)');
      
      // ✅ REQUIREMENT 4: WebRTC initiation moved to callService
      // No WebRTC logic here - callService handles it automatically via setupWebRTCAutoInit()
      // Ensure callService is initialized (will setup auto-init listener)
      //callService.initialize();
      console.log('✅ [DIRECT CALL] Invitation sent, WebRTC will start automatically via callService');
      
      // Note: For invitation declined/cancelled/expired, we rely on Redux state changes
      // The invitation state will be reset automatically, and the UI will update accordingly
      
    } catch (error: any) {
      console.error('❌ [DIRECT CALL] Error initiating call:', error);
      setShowProgress(false);
      Alert.alert(
        'Call Failed', 
        `Failed to start call: ${error.message || 'Please try again later.'}`
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
  
  // DELETED: Direct navigation - navigation happens automatically when CONNECTED
  // (handled by callFlowService 'call:navigate-to-callscreen' event in IncomingCallCard)
  // const handlePartnerCallAutoAccepted = (data: any) => {
  //   // Navigation to CallScreen happens automatically when CONNECTED
  //   // (handled by callFlowService events in IncomingCallCard)
  // };
  
  // Handle random call with the new functionality
  const handleRandomCall = async () => {
    try {
      console.log('🔍 Starting partner search...');
      
      // Clear any existing timeout
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = null;
      }
      
      // Request microphone permission
      const hasPermission = await requestMicrophonePermission();
      if (!hasPermission) {
        showPermissionExplanation();
        return;
      }

      // Pick a random emoji for the search screen
      const emojis = ['👨‍🍳', '🧑‍🎓', '👩‍🏫', '🧑‍💼', '👨‍💻', '🧑‍🔬', '👩‍🚀', '🧑‍🎨'];
      setSearchEmoji(emojis[Math.floor(Math.random() * emojis.length)]);
      
      // Show the partner search screen
      setShowPartnerSearch(true);
      setFindingPartner(true);
      
      // Call Find Perfect Partner API endpoint
      const token = await getAuthToken();
      const response = await fetch(`${API_URL}/calls/find-partner`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      // Check if response is ok and content type is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('❌ Server returned non-JSON response:', text.substring(0, 200));
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to start search');
      }

      if (data.matched) {
        // Match found immediately - call:start will be emitted by server
        console.log('✅ [AUTO-MATCH] Match found immediately:', data.callSession);
        setShowPartnerSearch(false);
        setShowConnecting(true);
        // Partner info will come from call:start event
      } else {
        // No match yet - user is in queue, waiting for match
        console.log('⏳ [AUTO-MATCH] No match yet, user added to queue');
        // Show searching UI - call:start will be emitted when match is found
      }
      
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
  const handleCancelSearch = async () => {
    console.log('❌ Canceling partner search');
    
    // Clear timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }
    
    try {
      // Call cancel search API endpoint
      const token = await getAuthToken();
      await fetch(`${API_URL}/calls/cancel-search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
    } catch (error) {
      console.error('Error canceling search:', error);
    }
    
    // Reset UI state
    setFindingPartner(false);
    setShowPartnerSearch(false);
    
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

  // DELETED: Test manual navigation - navigation happens automatically when CONNECTED
  // const testManualNavigation = () => {
  //   // Navigation to CallScreen happens automatically when CONNECTED
  //   // (handled by callFlowService events)
  // };

  // Make functions available globally for debugging (React Native)
  if (typeof global !== 'undefined') {
    (global as any).testSocketConnection = testSocketConnection;
    (global as any).testForceCloseSearch = testForceCloseSearch;
    // DELETED: testManualNavigation - navigation happens automatically when CONNECTED
    // (global as any).testManualNavigation = testManualNavigation;
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
      //socketService.socketEmit('set_remote_user', { userId: partner._id });
      
      // Initialize call service
      //callService.initialize();
      
      // Close all search screens
      setShowConnecting(false);
      setConnectingPartner(null);
      setShowPartnerSearch(false);
      setFindingPartner(false);
      
      // Send invitation via callFlowService (handles Redux state and WebRTC)
      callFlowService.sendInvitation(
        partner._id,
        CallType.MATCH_CALL,
        { isVideo: false },
        partner.name
      );
      
      // Navigation to CallScreen happens automatically when CONNECTED
      // (handled by callFlowService events)
      
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

  // Ensure PartnerSearchScreen is closed when screen comes into focus (e.g., returning from CallScreen)
  useFocusEffect(
    React.useCallback(() => {
      console.log('🔄 LobbyScreen focused - ensuring PartnerSearchScreen is closed');
      // Close partner search screen when returning to lobby (e.g., after call ends)
      setShowPartnerSearch(false);
      setFindingPartner(false);
      setShowConnecting(false);
      setConnectingPartner(null);
    }, [])
  );

  // Handle call:start for match_call type (auto-matching and talk now)
  useEffect(() => {
    const handleCallStart = (data: any) => {
      console.log('🎬 [LOBBY] call:start received:', data);
      
      // Only handle match_call type (auto-matching and talk now)
      if (data.callType === 'match_call') {
        console.log('✅ [LOBBY] Match call detected, showing ConnectingModal');
        
        // Close partner search screen if open
        setShowPartnerSearch(false);
        setFindingPartner(false);
        
        // Show ConnectingModal
        setShowConnecting(true);
        
        // Try to get partner info from users list
        const authState = store.getState().auth;
        const currentUserId = (authState as any).user?._id || (authState as any).userId;
        const partnerId = data.callerId === currentUserId ? data.receiverId : data.callerId;
        const partner = users.find(u => u._id === partnerId);
        
        if (partner) {
          setConnectingPartner(partner);
        } else {
          // Partner not in list, create a minimal partner object
          setConnectingPartner({
            _id: partnerId,
            name: 'Partner',
            profilePic: undefined
          });
        }
      }
    };

    socketService.socketOn('call:start', handleCallStart);
    
    return () => {
      socketService.socketOff('call:start', handleCallStart);
    };
  }, [users]);

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
      
      // // Remove call service event listener
      // callService.removeEventListener('call-state-changed', handleCallStateChange);
      // // DELETED: partner-call-auto-accepted listener cleanup
      // // callService.removeEventListener('partner-call-auto-accepted', handlePartnerCallAutoAccepted);
      // callService.removeEventListener('call-started', handleCallStarted);
      // callService.removeEventListener('call-ended', handleCallEnded);
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
        <View style={[styles.readySection, { backgroundColor: theme.surface }]}>
          <Text style={[styles.readyTitle, { color: theme.text }]}>{t('lobby.readyToTalk')}</Text>
          <FlatList
            data={readyUsers}
            horizontal
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={[
                  styles.readyCard, 
                  { 
                    backgroundColor: theme.card,
                    shadowColor: theme.shadow,
                  }
                ]}
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
            {__DEV__ && (
              <Text style={[styles.emptySubtext, { marginTop: 10, fontSize: 12 }]}>
                Debug: Total users: {users.length}, Sorted: {sortedUsers.length}, Ready: {readyUsers.length}
              </Text>
            )}
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
  },
  readyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  readyListContent: {
    paddingHorizontal: 15,
  },
  readyCard: {
    borderRadius: 12,
    padding: 12,
    marginRight: 12,
    width: 120,
    alignItems: 'center',
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