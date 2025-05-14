import React, { useState, useEffect } from 'react';
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

// Define user type
interface User {
  _id: string;
  name: string;
  profilePic?: string;
  level?: string;
  country?: string;
  isOnline?: boolean;
  email?: string;
}

interface UserCardProps {
  user: User;
  onPress: () => void;
}

const UserCard = ({ user, onPress }: UserCardProps) => {
  return (
    <TouchableOpacity 
      style={[
        styles.userCard,
        user.isOnline ? styles.userCardOnline : styles.userCardOffline
      ]} 
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.userCardContent}>
        <View style={styles.avatarContainer}>
          <Image 
            source={{ uri: user.profilePic || 'https://randomuser.me/api/portraits/men/32.jpg' }} 
            style={styles.avatar} 
          />
          {user.isOnline && <View style={styles.onlineIndicator} />}
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{user.name}</Text>
          <Text style={styles.userMeta}>
            {user.level || 'Beginner'} • {user.country || '🌎 Global'}
          </Text>
          {user.isOnline ? (
            <Text style={styles.onlineText}>Online Now</Text>
          ) : (
            <Text style={styles.offlineText}>Currently Offline</Text>
          )}
        </View>
        <TouchableOpacity 
          style={[
            styles.callButton,
            !user.isOnline && styles.callButtonDisabled
          ]} 
          onPress={onPress}
          disabled={!user.isOnline}
        >
          <Text style={styles.callButtonText}>Call</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

interface LobbyScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList>;
}

const LobbyScreen = ({ navigation }: LobbyScreenProps) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [permissionChecked, setPermissionChecked] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [progressMessage, setProgressMessage] = useState('');

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
      
      // Update state with fetched users
      setUsers(fetchedUsers);
      
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
      const usersWithStatus = standardUsers.map(user => ({
        ...user,
        isOnline: false // Default to offline unless socket confirms they're online
      }));
      
      setUsers(usersWithStatus);
      
      // Initialize socket to get real status updates
      await initializeSocketConnection();
    } catch (fallbackError) {
      console.error('Error in fallback user fetch:', fallbackError);
      Alert.alert('Error', 'Failed to load users. Please try again.');
    }
  };

  // Initialize socket connection
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
      
      // Listen for user status updates
      socketService.onUserStatus((data) => {
        if (data && data.userId) {
          console.log(`Updating user ${data.userId} status to ${data.status}`);
          updateUserStatus(data.userId, data.status === 'online');
        }
      });
      
    } catch (error) {
      console.error('Error initializing socket connection:', error);
    }
  };

  // Update a single user's online status
  const updateUserStatus = (userId: string, isOnline: boolean) => {
    setUsers(prevUsers => 
      prevUsers.map(user => 
        user._id === userId 
          ? { ...user, isOnline } 
          : user
      )
    );
  };

  // Handle initiating a call to a user
  const handleUserPress = async (user: User) => {
    try {
      if (!user.isOnline) {
        Alert.alert('Cannot Call', 'This user is offline. Please try again when they are online.');
        return;
      }
      
      // Request microphone permission before starting the call
      const hasPermission = await requestMicrophonePermission();
      
      if (!hasPermission) {
        showPermissionExplanation();
        return;
      }
      
      // Store the remote user ID for future ICE candidate sharing
      socketService.setRemoteUserId(user._id);
      
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
      navigation.navigate('Call', { 
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

  // Handle random call
  const handleRandomCall = async () => {
    const onlineUsers = users.filter(user => user.isOnline);
    
    if (onlineUsers.length === 0) {
      Alert.alert(
        'No Users Online', 
        'There are no users online to call right now. Please try again later or wait for users to connect.',
        [{ text: 'OK', style: 'default' }]
      );
      return;
    }
    
    // Randomly select an online user
    const randomIndex = Math.floor(Math.random() * onlineUsers.length);
    const randomUser = onlineUsers[randomIndex];
    
    // Call the randomly selected user
    handleUserPress(randomUser);
  };

  // Add this getter to determine if random calls are available
  const isRandomCallAvailable = users.some(user => user.isOnline);

  // Add this getter for online users count
  const onlineUsersCount = users.filter(user => user.isOnline).length;

  // Load users when component mounts
  useEffect(() => {
    fetchUsers();
    
    // Clean up socket listeners when component unmounts
    return () => {
      socketService.removeAllListeners();
    };
  }, []);

  // Add function to check socket connection and reconnect if needed
  const checkSocketConnection = async () => {
    const socket = socketService.getSocket();
    
    if (!socket) {
      console.log('No socket found, initializing...');
      await socketService.initialize();
      return 'Socket initialized';
    }
    
    if (!socket.connected) {
      console.log('Socket exists but not connected, reconnecting...');
      await socketService.initialize();
      return socket.connected ? 'Reconnected successfully' : 'Failed to reconnect';
    }
    
    return `Socket connected (ID: ${socket.id})`;
  };
  
  // Add a debug function to show socket status
  const showSocketStatus = async () => {
    try {
      const socketStatus = await checkSocketConnection();
      const token = await getAuthToken();
      
      // Fetch online users from debug endpoint
      const response = await fetch(`${API_URL}/auth/debug-online-users`);
      const data = await response.json();
      console.log('Debug online users response:', data);
      
      // Get current socket
      const socket = socketService.getSocket();
      
      // Format debug message
      let debugMessage = `Socket: ${socketStatus}\n`;
      debugMessage += `Socket ID: ${socket?.id || 'N/A'}\n`;
      debugMessage += `Socket connected: ${socket?.connected ? 'Yes' : 'No'}\n\n`;
      debugMessage += `Online users: ${data.onlineUsersCount}\n`;
      
      if (data.onlineUsers && data.onlineUsers.length > 0) {
        debugMessage += `Users: ${data.onlineUsers.map((u: {name: string}) => u.name).join(', ')}\n\n`;
      } else {
        debugMessage += 'No users online\n\n';
      }
      
      debugMessage += 'User IDs:\n';
      debugMessage += data.rawOnlineUserIds.join('\n');
      
      Alert.alert(
        'Connection Debug',
        debugMessage,
        [
          { 
            text: 'Refresh Users', 
            onPress: () => fetchUsers() 
          },
          { 
            text: 'Reconnect', 
            onPress: async () => {
              await socketService.initialize();
              fetchUsers();
            }
          },
          { text: 'OK' }
        ]
      );
    } catch (error) {
      console.error('Error checking socket status:', error);
      Alert.alert('Error', 'Failed to check connection status');
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A90E2" />
        <Text style={styles.loadingText}>Loading users...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>Online Users</Text>
          <TouchableOpacity 
            style={styles.refreshButton} 
            onPress={showSocketStatus}
          >
            <Icon name="refresh" size={20} color="#4A90E2" />
          </TouchableOpacity>
        </View>
        <View style={styles.onlineCountContainer}>
          <View style={styles.onlineCountBadge}>
            <Text style={styles.onlineCountText}>{onlineUsersCount}</Text>
          </View>
          <Text style={styles.subtitle}>
            {onlineUsersCount === 1 
              ? 'person ready to practice' 
              : 'people ready to practice'}
          </Text>
        </View>
      </View>
      
      <FlatList
        data={users}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <UserCard user={item} onPress={() => handleUserPress(item)} />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No users found</Text>
          </View>
        }
      />
      
      <TouchableOpacity 
        style={[
          styles.randomCallButton,
          !isRandomCallAvailable && styles.randomCallButtonDisabled
        ]}
        onPress={handleRandomCall}
        disabled={!isRandomCallAvailable}
      >
        <Icon name="call" size={20} color="white" style={styles.randomCallIcon} />
        <Text style={styles.randomCallText}>
          {isRandomCallAvailable 
            ? 'Start Random Call' 
            : 'No Online Users Available'}
        </Text>
      </TouchableOpacity>
      
      {/* Progress Dialog */}
      <ProgressDialog
        visible={showProgress}
        title="Starting Call"
        message={progressMessage}
        cancelable={true}
        onCancel={handleCancelCall}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 10,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  listContent: {
    padding: 15,
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
  userCardOnline: {
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  userCardOffline: {
    opacity: 0.7,
  },
  userCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  onlineIndicator: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'green',
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
  userMeta: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  onlineText: {
    fontSize: 12,
    color: 'green',
    marginTop: 4,
  },
  offlineText: {
    fontSize: 12,
    color: 'red',
    marginTop: 4,
  },
  callButton: {
    backgroundColor: '#4A90E2',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 50,
  },
  callButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  callButtonDisabled: {
    backgroundColor: '#ccc',
  },
  randomCallButton: {
    backgroundColor: '#4A90E2',
    margin: 20,
    padding: 16,
    borderRadius: 50,
    alignItems: 'center',
    shadowColor: '#4A90E2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  randomCallButtonDisabled: {
    backgroundColor: '#ccc',
  },
  randomCallIcon: {
    marginRight: 10,
  },
  randomCallText: {
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
  onlineCountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  onlineCountBadge: {
    backgroundColor: '#4A90E2',
    borderRadius: 12,
    padding: 4,
    marginRight: 8,
  },
  onlineCountText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  refreshButton: {
    padding: 8,
    backgroundColor: '#f0f8ff',
    borderRadius: 20,
    marginLeft: 10,
  },
});

export default LobbyScreen; 