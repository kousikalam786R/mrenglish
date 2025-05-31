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
import IconMaterial from 'react-native-vector-icons/MaterialIcons';
import PartnerSearchScreen from '../components/PartnerSearchScreen';
import { mediaDevices } from 'react-native-webrtc';

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
}

interface UserCardProps {
  user: User;
  onCallPress: () => void;
  onMessagePress: () => void;
  onPress: () => void;
}

const UserCard = ({ user, onCallPress, onMessagePress, onPress }: UserCardProps) => {
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
    <View style={styles.userCard}>
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
          {user.isOnline && <View style={styles.onlineIndicator} />}
        </View>
        
        <View style={styles.userInfo}>
          <Text style={styles.userName}>
            {user.name} {user.gender === 'Female' ? '🌸' : user.gender === 'Male' ? '👨' : ''}
          </Text>
          <View style={styles.ratingContainer}>
            <Text style={styles.thumbsUp}>👍 {user.rating || 95}%</Text>
            <Text style={styles.userGender}> • {user.gender || 'Not specified'}</Text>
        </View>
          <Text style={styles.userCountry}>
            {user.country || '🌎 Global'} • {user.talks || 0} talks
          </Text>
          <Text style={user.isOnline ? styles.onlineText : styles.offlineText}>
            {user.isOnline ? 'online' : 'offline'}
          </Text>
        </View>
        
        {user.isOnline ? (
          <View style={styles.buttonsContainer}>
            <TouchableOpacity 
              style={[styles.callButton, styles.callButtonFullWidth]} 
              onPress={(e) => {
                e.stopPropagation(); // Prevent triggering the parent's onPress
                onCallPress();
              }}
            >
              <IconMaterial name="call" size={24} color="white" />
            </TouchableOpacity>
      </View>
        ) : (
          <TouchableOpacity 
            style={styles.messageButton} 
            onPress={(e) => {
              e.stopPropagation(); // Prevent triggering the parent's onPress
              onMessagePress();
            }}
          >
            <IconMaterial name="chat" size={24} color="white" />
          </TouchableOpacity>
        )}
    </TouchableOpacity>
    </View>
  );
};

interface LobbyScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList>;
}

const LobbyScreen = ({ navigation }: LobbyScreenProps) => {
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
      
      // Set up initial ready status
      setCurrentUserReady(socketService.isUserReady());
      
      // Listen for user status updates
      socketService.onUserStatus((data) => {
        if (data && data.userId) {
          console.log(`Updating user ${data.userId} status to ${data.status}`);
          updateUserStatus(data.userId, data.status === 'online');
        }
      });
      
      // Listen for user ready-to-talk status updates
      socketService.onUserReadyStatus((data) => {
        if (data && data.userId) {
          console.log(`Updating user ${data.userId} ready status to ${data.isReady}`);
          updateUserReadyStatus(data.userId, data.isReady, data.userData);
        }
      });
      
      // Listen for ready status updates for current user
      socketService.onReadyStatusUpdated((data) => {
        console.log('Ready status updated:', data);
        if (data.success) {
          setCurrentUserReady(data.isReady);
        }
      });
      
      // Listen for ready users list updates
      socketService.onReadyUsersList((data) => {
        if (data.users && Array.isArray(data.users)) {
          console.log(`Received ${data.users.length} ready users`);
          updateReadyUsersList(data.users);
        }
      });
      
      // Listen for partner found notifications
      socketService.onPartnerFound((data) => {
        if (data.partner) {
          // Close the partner search screen if it's open
          setShowPartnerSearch(false);
          setFindingPartner(false);
          
          console.log('You were matched with:', data.partner.name);
          Alert.alert(
            'Partner Found',
            `${data.partner.name} is looking for a partner and matched with you!`,
            [
              { 
                text: 'Decline', 
                style: 'cancel',
                onPress: () => console.log('Partner match declined')
              },
              { 
                text: 'Call Now', 
                style: 'default',
                onPress: () => handleCallPress(data.partner)
              },
            ]
          );
        }
      });
      
      // Request a list of ready users
      socketService.getReadyToTalkUsers();
      
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
      
      // Update ready users list
      setReadyUsers(updatedUsers.filter((user: User) => user.isOnline && user.readyToTalk));
      
      return updatedUsers;
    });
  };
  
  // Update the list of ready users
  const updateReadyUsersList = (readyUsersList: any[]) => {
    console.log('Updating ready users list with', readyUsersList.length, 'users');
    
    // Mark users as ready in our local state based on the list
    setUsers(prevUsers => {
      const userMap = new Map();
      prevUsers.forEach(user => userMap.set(user._id, user));
      
      // Update or add users from the ready list
      readyUsersList.forEach(readyUser => {
        const userId = readyUser.userId;
        const existingUser = userMap.get(userId);
        
        if (existingUser) {
          // Update existing user
          userMap.set(userId, {
            ...existingUser,
            readyToTalk: true,
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
            readyToTalk: true
          });
        }
      });
      
      const updatedUsers = Array.from(userMap.values());
      
      // Also update the ready users list
      setReadyUsers(updatedUsers.filter((user: User) => user.isOnline && user.readyToTalk));
      
      return updatedUsers;
    });
  };

  // Handle initiating a call to a user
  const handleCallPress = async (user: User) => {
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

  // Handle video call to a user
  const handleVideoCallPress = async (user: User) => {
    try {
      if (!user.isOnline) {
        Alert.alert('Cannot Call', 'This user is offline. Please try again when they are online.');
        return;
      }
      
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
      
      console.log(`Initiating video call to ${user.name} (${user._id})`);
      
      // Update progress dialog
      setProgressMessage(`Starting video call with ${user.name}...`);
      setShowProgress(true);
      
      // Initialize call service
      callService.initialize();
      
      // Navigate to call screen first so UI is ready
      console.log('Navigating to call screen');
      navigation.navigate('Call', { 
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

  // Handle random call with the new functionality
  const handleRandomCall = async () => {
    try {
      // If not ready, set status to ready
      if (!currentUserReady) {
        socketService.setReadyToTalk(true);
      }
      
      // Pick a random emoji for the search screen
      const emojis = ['👨‍🍳', '🧑‍🎓', '👩‍🏫', '🧑‍💼', '👨‍💻', '🧑‍🔬', '👩‍🚀', '🧑‍🎨'];
      setSearchEmoji(emojis[Math.floor(Math.random() * emojis.length)]);
      
      // Show the partner search screen
      setShowPartnerSearch(true);
      setFindingPartner(true);
      
      // Request a random partner
      socketService.findRandomPartner();
      
      // Set a timeout to avoid waiting too long
    setTimeout(() => {
        if (findingPartner) {
          setFindingPartner(false);
          setShowPartnerSearch(false);
          Alert.alert(
            'Taking Too Long',
            'Finding a partner is taking longer than expected. Please try again later.',
            [{ text: 'OK', style: 'default' }]
          );
        }
      }, 60000); // 60 second timeout (increased from 15 seconds)
    } catch (error) {
      console.error('Error finding random partner:', error);
      setFindingPartner(false);
      setShowPartnerSearch(false);
      Alert.alert(
        'Error',
        'Failed to find a partner. Please try again later.',
        [{ text: 'OK', style: 'default' }]
      );
    }
  };

  // Cancel partner search
  const handleCancelSearch = () => {
    setFindingPartner(false);
    setShowPartnerSearch(false);
    // If the user cancels, set them as not ready to talk
    socketService.setReadyToTalk(false);
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

  // Add this getter to determine if random calls are available
  const isRandomCallAvailable = true; // Always allow finding a partner

  // Handle pressing a user card to view their profile
  const handleUserPress = (user: User) => {
    navigation.navigate('UserProfile', {
      userId: user._id,
      userName: user.name
    });
  };

  // Load users when component mounts
  useEffect(() => {
    fetchUsers();
    
    // Clean up socket listeners when component unmounts
    return () => {
      socketService.removeAllListeners();
    };
  }, []);

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
        <Text style={styles.title}>Lobby</Text>
        <TouchableOpacity 
          style={styles.settingsButton}
          onPress={() => {
            // Toggle ready status when settings button is pressed
            const newStatus = !currentUserReady;
            socketService.setReadyToTalk(newStatus);
            setCurrentUserReady(newStatus);
            Alert.alert(
              'Status Updated',
              newStatus 
                ? 'You are now set as available for calls!' 
                : 'You are no longer set as available for calls.',
              [{ text: 'OK', style: 'default' }]
            );
          }}
        >
          <IconMaterial 
            name={currentUserReady ? "settings-power" : "settings"} 
            size={24} 
            color={currentUserReady ? "#4CAF50" : "#333"} 
          />
        </TouchableOpacity>
      </View>
      
      {readyUsers.length === 0 ? (
        <View style={styles.emptyStateContainer}>
          <View style={styles.emptyIconContainer}>
            <IconMaterial name="person" size={50} color="#ccc" />
          </View>
          <Text style={styles.emptyStateTitle}>There's no one here yet</Text>
        </View>
      ) : null}
      
      <View style={styles.inviteSection}>
        <Text style={styles.inviteTitle}>
          {currentUserReady 
            ? 'You are ready to talk!' 
            : 'Invite online partners'}
        </Text>
        <TouchableOpacity 
          style={styles.refreshButton}
          onPress={handleRefresh}
        >
          <Icon name="refresh" size={22} color="white" />
          <Text style={styles.refreshText}>Refresh</Text>
        </TouchableOpacity>
      </View>
      
      <FlatList
        data={readyUsers.length > 0 
          ? readyUsers // Show ready users first if available
          : users.filter((user: User) => user.isOnline) // Otherwise show all online users
        }
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
});

export default LobbyScreen; 