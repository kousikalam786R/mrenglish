import React, { useEffect, useState, useCallback } from 'react';
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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  // Get current user ID for message formatting
  useEffect(() => {
    const getUserId = async () => {
      try {
        const userId = await AsyncStorage.getItem('userId');
        setCurrentUserId(userId);
      } catch (error) {
        console.error('Error getting user ID:', error);
      }
    };
    getUserId();
  }, []);
  
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
  
  // Format the last message with sender info
  const getFormattedLastMessage = () => {
    if (!chat.lastMessage) return 'No messages yet';
    
    // Check if the last message was sent by current user
    const isMyMessage = chat.lastMessage.sender === currentUserId ||
                       (typeof chat.lastMessage.sender === 'object' && 
                        chat.lastMessage.sender?._id === currentUserId);
    
    // Format based on who sent it
    const prefix = isMyMessage ? 'You: ' : '';
    return `${prefix}${chat.lastMessage.content}`;
  };
  
  // Dynamic last message content
  const lastMessageContent = getFormattedLastMessage();

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
            style={[
              styles.lastMessage, 
              chat.unreadCount > 0 ? styles.unreadMessage : null
            ]} 
            numberOfLines={1}
          >
            {lastMessageContent}
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
          console.log(`User ${index}: ID=${user._id}, name=${user.name}`);
        });
        
        // Convert users to ChatUser format with necessary defaults
        const chatUsers: ChatUser[] = users.map(user => ({
          _id: user._id,
          name: user.name || 'Unknown User',
          email: user.email || '',
          profilePic: user.profilePic || 'https://randomuser.me/api/portraits/men/32.jpg',
          unreadCount: 0,
          isOnline: false,
          // Add dummy last message to make the UI look better
          lastMessage: {
            _id: `dummy_${user._id}`,
            content: 'Start a conversation',
            sender: user._id,
            receiver: 'you',
            createdAt: new Date().toISOString(),
            read: true
          }
        }));
        
        setChats(chatUsers);
        console.log('Loaded real users:', chatUsers.length);
        return true;
      } else {
        console.log('No real users found');
        
        // Show message to user
        Alert.alert(
          'No Users Found',
          'Could not find any users to chat with. Please try again later.',
          [{ text: 'OK' }]
        );
        
        return false;
      }
    } catch (error: any) {
      console.error('Error loading real users:', error.message);
      
      // Show error to user
      Alert.alert(
        'Error',
        'Could not load users. ' + (error.message || 'Please try again later.'),
        [{ text: 'OK' }]
      );
      
      return false;
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  const fetchChats = async () => {
    try {
      setAuthError(false);
      setLoading(true);
      
      // First try to get real chats
      const recentChats = await getRecentChats();
      
      if (recentChats && recentChats.length > 0) {
        console.log('Found real chats:', recentChats.length);
        
        // Ensure each chat has required information
        const validatedChats = recentChats.map(chat => {
          // Create a fully validated chat object with default values for missing fields
          return {
            ...chat,
            name: chat.name || 'Unknown User',
            email: chat.email || '',
            profilePic: chat.profilePic || 'https://randomuser.me/api/portraits/men/32.jpg'
          };
        });
        
        setChats(validatedChats);
        console.log('Set validated chats:', validatedChats.length);
      } else {
        console.log('No real chats found, loading real users instead');
        
        // If no real chats, load real users
        await loadRealUsers();
      }
    } catch (error: any) {
      console.error('Error fetching chats:', error);
      
      if (error.message && error.message.includes('authentication')) {
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
        // If server connection fails, try to load real users
        console.log('Server connection error, trying to load real users');
        await loadRealUsers();
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
    console.log('Chat pressed:', chat);
    
    // Create a properly structured chat object that works with both formats
    // (flat structure or nested user object)
    const finalChat: ChatUser = {
      _id: chat._id || (chat.user?._id || ''),
      name: chat.name || (chat.user?.name || 'Unknown User'),
      email: chat.email || (chat.user?.email || ''),
      profilePic: chat.profilePic || (chat.user?.profilePic || 'https://randomuser.me/api/portraits/men/32.jpg'),
      unreadCount: chat.unreadCount || 0,
      isOnline: chat.isOnline || false,
      lastMessage: chat.lastMessage
    };
    
    // Make sure we have a chat ID
    if (!finalChat._id) {
      console.error('Missing chat ID:', chat);
      Alert.alert(
        'Invalid Chat',
        'This chat is missing required information.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    console.log('Navigating with fixed chat object:', finalChat);
    
    // Check MongoDB ID format for consistency
    const isValidMongoId = /^[0-9a-fA-F]{24}$/.test(finalChat._id);
    if (!isValidMongoId) {
      console.warn('Invalid chat ID format:', finalChat._id);
      
      // Show warning but allow conversation
      Alert.alert(
        'Warning',
        'This contact has an unusual ID format. Some features might not work correctly.',
        [{ text: 'Continue Anyway' }]
      );
    }
    
    navigation.navigate('ChatDetail', { 
      id: finalChat._id,
      name: finalChat.name,
      user: finalChat
    });
  };
  
  const handleRefresh = () => {
    setRefreshing(true);
    fetchChats();
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
        
        <TouchableOpacity 
          style={styles.refreshButton} 
          onPress={() => loadRealUsers()}
        >
          <Text style={styles.refreshButtonText}>Find Users</Text>
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
              No messages or contacts found. Pull down to refresh or tap the button below to find users.
            </Text>
            <TouchableOpacity 
              style={styles.refreshButton}
              onPress={() => loadRealUsers()}
            >
              <Text style={styles.refreshButtonText}>Find Users</Text>
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
  unreadMessage: {
    fontWeight: 'bold',
    color: '#333333',
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