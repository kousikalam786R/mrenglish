import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Button,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ChatsStackNavigationProp } from '../navigation/types';
import { getRecentChats } from '../utils/messageService';
import { ChatUser, User } from '../types/Message';
import socketService from '../utils/socketService';
import { useAuth } from '../navigation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAllUsers } from '../utils/userService';

// Chat Item Component
const ChatItem = ({ 
  chat, 
  onPress 
}: { 
  chat: ChatUser; 
  onPress: () => void 
}) => {
  const lastMessageTime = chat.lastMessage ? new Date(chat.lastMessage.createdAt) : null;
  
  // Format time
  const formatTime = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const diffDays = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];
    } else {
      return date.toLocaleDateString();
    }
  };

  // Display name or a fallback to prevent errors
  const displayName = chat.name || 'User';
  const firstLetter = displayName.charAt(0);
  
  // Whether to show profile pic or avatar circle with initial
  const hasProfilePic = chat.profilePic && chat.profilePic !== '';

  return (
    <TouchableOpacity 
      style={styles.chatItem} 
      onPress={onPress}
    >
      {hasProfilePic ? (
        <Image 
          source={{ uri: chat.profilePic }} 
          style={[styles.avatarCircle, chat.isOnline && styles.onlineIndicator]} 
          onError={() => console.log('Failed to load profile image for:', chat.name)}
        />
      ) : (
        <View style={[styles.avatarCircle, chat.isOnline && styles.onlineIndicator]}>
          <Text style={styles.avatarText}>{firstLetter}</Text>
        </View>
      )}
      
      <View style={styles.chatContent}>
        <View style={styles.chatHeader}>
          <Text style={styles.chatName}>{displayName}</Text>
          {lastMessageTime && <Text style={styles.chatTime}>{formatTime(lastMessageTime)}</Text>}
        </View>
        
        <View style={styles.chatFooter}>
          <Text 
            style={styles.lastMessage} 
            numberOfLines={1}
          >
            {chat.lastMessage ? chat.lastMessage.content : 'No messages yet'}
          </Text>
          
          {chat.unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{chat.unreadCount}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

// Main component
const ChatsScreen = () => {
  const navigation = useNavigation<ChatsStackNavigationProp>();
  const { signOut } = useAuth();
  const [chats, setChats] = useState<ChatUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [authError, setAuthError] = useState<boolean>(false);
  const [showReal, setShowReal] = useState<boolean>(true);
  
  // Load dummy data for testing when no chats are available
  const loadDummyChats = () => {
    const dummyChats: ChatUser[] = [
      {
        _id: 'dummy1',
        name: 'John Doe',
        email: 'john@example.com',
        profilePic: '',
        isOnline: true,
        lastMessage: {
          _id: 'msg1',
          content: 'Hey, how are you doing?',
          sender: 'dummy1',
          receiver: 'currentUser',
          createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(), // 5 minutes ago
          read: false
        },
        unreadCount: 1
      },
      {
        _id: 'dummy2',
        name: 'Jane Smith',
        email: 'jane@example.com',
        profilePic: '',
        isOnline: false,
        lastMessage: {
          _id: 'msg2',
          content: 'Let me know when you are free to talk',
          sender: 'currentUser',
          receiver: 'dummy2',
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
          read: true
        },
        unreadCount: 0
      },
      {
        _id: 'dummy3',
        name: 'Alex Johnson',
        email: 'alex@example.com',
        profilePic: '',
        isOnline: true,
        lastMessage: {
          _id: 'msg3',
          content: 'The meeting is scheduled for tomorrow at 10am',
          sender: 'dummy3',
          receiver: 'currentUser',
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
          read: true
        },
        unreadCount: 0
      }
    ];
    
    return dummyChats;
  };
  
  // New function to load real users
  const loadRealUsers = async () => {
    try {
      console.log('Loading real users...');
      setLoading(true);
      
      // Use the getAllUsers function from userService
      const users = await getAllUsers();
      console.log('Fetched users:', users?.length || 0);
      
      if (users && users.length > 0) {
        // Log all users' IDs and info for debugging
        users.forEach((user, index) => {
          console.log(`User ${index}: ID=${user._id}, name=${user.name}, isValid=${/^[0-9a-fA-F]{24}$/.test(user._id)}`);
        });
        
        // Convert users to ChatUser format
        const chatUsers: ChatUser[] = users.map(user => ({
          _id: user._id,
          name: user.name || 'Unknown User',
          email: user.email || '',
          profilePic: user.profilePic || 'https://randomuser.me/api/portraits/men/32.jpg',
          unreadCount: 0,
          isOnline: false
        }));
        
        setChats(chatUsers);
        console.log('Loaded real users:', chatUsers.length);
        return true;
      } else {
        console.log('No real users found');
        return false;
      }
    } catch (error: any) {
      console.error('Error loading real users:', error.message);
      return false;
    } finally {
      setLoading(false);
    }
  };
  
  const fetchChats = async () => {
    try {
      setAuthError(false);
      
      // First try to get real chats
      const recentChats = await getRecentChats();
      
      if (recentChats && recentChats.length > 0) {
        console.log('Found real chats:', recentChats.length);
        setChats(recentChats);
        setShowReal(true);
      } else {
        console.log('No real chats found, trying to load real users instead');
        
        // If no real chats, try to load real users
        const hasRealUsers = await loadRealUsers();
        
        if (!hasRealUsers) {
          console.log('No real users found, loading dummy data for testing');
          setChats(loadDummyChats());
          setShowReal(false);
        }
      }
    } catch (error: any) {
      console.error('Error fetching chats:', error);
      
      if (error.message === 'No authentication token found') {
        setAuthError(true);
        // Alert with login again option
        Alert.alert(
          'Authentication Error',
          'Your session has expired. Please log in again.',
          [
            {
              text: 'Log Out',
              onPress: () => signOut()
            }
          ]
        );
      } else {
        // If server connection fails, try to load real users first
        console.log('Server connection error, trying to load real users');
        const hasRealUsers = await loadRealUsers();
        
        if (!hasRealUsers) {
          // If that fails too, load dummy data
          console.log('Loading dummy data as fallback');
          setChats(loadDummyChats());
          setShowReal(false);
          
          // Show an alert about the error
          Alert.alert('Connection Error', 'Could not connect to the server. Showing sample data for testing.');
        }
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  useEffect(() => {
    // Initialize socket connection
    const initializeSocket = async () => {
      try {
        await socketService.initialize();
        
        // Listen for new messages to update chat list
        socketService.onNewMessage(() => {
          fetchChats();
        });
        
        // Listen for user status changes
        socketService.onUserStatus((data) => {
          if (data && data.userId) {
            setChats(prevChats => 
              prevChats.map(chat => 
                chat._id === data.userId 
                  ? { ...chat, isOnline: data.status === 'online' } 
                  : chat
              )
            );
          }
        });
      } catch (error) {
        console.error('Error initializing socket:', error);
      }
    };
    
    // Check if we have a valid token
    const checkToken = async () => {
      try {
        // Try to get token
        let token = await AsyncStorage.getItem('token');
        if (!token) token = await AsyncStorage.getItem('auth_token');
        
        if (!token) {
          setAuthError(true);
          setLoading(false);
          return;
        }
        
        initializeSocket();
        fetchChats();
      } catch (error) {
        console.error('Error checking token:', error);
        setLoading(false);
        setAuthError(true);
      }
    };
    
    checkToken();
    
    // Cleanup socket listeners
    return () => {
      socketService.removeAllListeners();
    };
  }, []);
  
  // Simple navigation to chat detail
  const handleChatPress = (chat: ChatUser) => {
    // Make sure we have a chat ID
    if (!chat || !chat._id) {
      Alert.alert(
        'Invalid Chat',
        'This chat is missing required information.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    // Debug chat info
    console.log('Navigating to chat:', {
      id: chat._id,
      name: chat.name,
      valid: /^[0-9a-fA-F]{24}$/.test(chat._id),
      isDummy: chat._id.startsWith('dummy')
    });
    
    // For dummy chats or test chats, allow any ID format
    // For real users, we expect MongoDB ObjectIDs (24-char hex strings)
    const isDummyChat = chat._id.startsWith('dummy');
    const isValidMongoId = /^[0-9a-fA-F]{24}$/.test(chat._id);
    
    // Only check MongoDB ID format for non-dummy IDs
    if (!isDummyChat && !isValidMongoId) {
      console.log('Invalid chat ID format:', chat._id);
      
      // Instead of blocking navigation, treat it as a new conversation
      Alert.alert(
        'New Conversation',
        'Starting a new conversation with this user.',
        [{ text: 'OK' }]
      );
    }
    
    // Make sure user object is properly formatted
    const userForNavigation = {
      ...chat,
      _id: chat._id, // Ensure ID is passed
      name: chat.name || 'Unknown User',
      email: chat.email || '',
      profilePic: chat.profilePic || 'https://randomuser.me/api/portraits/men/32.jpg'
    };
    
    navigation.navigate('ChatDetail', { 
      id: chat._id,
      name: chat.name || 'Unknown User',
      user: userForNavigation
    });
  };
  
  const handleRefresh = () => {
    setRefreshing(true);
    fetchChats();
  };

  // Toggle between real and dummy users/chats
  const toggleDataSource = () => {
    if (showReal) {
      setChats(loadDummyChats());
      setShowReal(false);
    } else {
      loadRealUsers().then(success => {
        if (!success) {
          Alert.alert('No Real Users', 'Could not load real users. Check your connection and try again.');
        }
      });
      setShowReal(true);
    }
  };

  if (authError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Authentication error</Text>
        <Text style={styles.errorSubText}>Please log in again to continue</Text>
        <TouchableOpacity 
          style={styles.logoutButton} 
          onPress={() => signOut()}
        >
          <Text style={styles.logoutButtonText}>Log Out</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A90E2" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
        
        {/* Toggle Data Source Button */}
        <TouchableOpacity 
          style={styles.toggleButton}
          onPress={toggleDataSource}
        >
          <Text style={styles.toggleButtonText}>
            {showReal ? 'Show Dummy Data' : 'Show Real Users'}
          </Text>
        </TouchableOpacity>
      </View>
      
      <FlatList
        data={chats}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <ChatItem
            chat={item}
            onPress={() => handleChatPress(item)}
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#4A90E2']}
          />
        }
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        removeClippedSubviews={true}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              No messages yet. Start a conversation with someone from your contacts.
            </Text>
            <TouchableOpacity 
              style={styles.refreshButton}
              onPress={() => loadRealUsers()}
            >
              <Text style={styles.refreshButtonText}>Load Users</Text>
            </TouchableOpacity>
          </View>
        }
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
  errorContainer: {
    flex: 1, 
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 20,
  },
  errorText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FF3B30',
    marginBottom: 10,
  },
  errorSubText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 30,
  },
  logoutButton: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
  },
  logoutButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F2',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
  },
  toggleButton: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  toggleButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  refreshButton: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 15,
  },
  refreshButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  chatItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F2',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  onlineIndicator: {
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4A90E2',
  },
  chatContent: {
    flex: 1,
    marginLeft: 12,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  chatName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
  },
  chatTime: {
    fontSize: 12,
    color: '#999999',
  },
  chatFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: {
    flex: 1,
    fontSize: 14,
    color: '#666666',
  },
  unreadBadge: {
    backgroundColor: '#4A90E2',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  unreadText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 50,
  },
  emptyText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
  },
});

export default ChatsScreen; 