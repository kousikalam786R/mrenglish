import React, { useState, useEffect, memo, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  FlatList,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { ChatUser } from '../types/Message';
import { useAppDispatch, useAppSelector } from '../redux/hooks';
import { fetchRecentChats, handleSocketMessage } from '../redux/thunks/messageThunks';
import { updateUserStatus } from '../redux/slices/messageSlice';
import socketService from '../utils/socketService';
import OnlineStatus from '../components/OnlineStatus';
import simpleUserStatusService from '../services/simpleUserStatusService';
import { useUserStatusService } from '../hooks/useUserStatus';
import { useTheme } from '../context/ThemeContext';

// Chat item component
interface ChatItemProps {
  chat: ChatUser;
  onPress: () => void;
}

// Use memo to prevent unnecessary re-renders
const ChatItem = memo<ChatItemProps & { theme: any }>(({ chat, onPress, theme }) => {
  // Get user status from centralized service with subscription
  const [userStatus, setUserStatus] = useState(() => simpleUserStatusService.getUserStatus(chat._id));

  // Subscribe to status updates for this user
  useEffect(() => {
    // Add user to tracking
    simpleUserStatusService.addUserToTracking(chat._id);

    // Get initial status
    const initialStatus = simpleUserStatusService.getUserStatus(chat._id);
    if (initialStatus) {
      setUserStatus(initialStatus);
    }

    // Subscribe to status updates
    const unsubscribe = simpleUserStatusService.subscribeToStatusUpdates((allStatuses) => {
      const status = allStatuses.get(chat._id);
      if (status) {
        console.log(`📊 ChatItem: Status updated for ${chat.name} (${chat._id}):`, {
          isOnline: status.isOnline,
          lastSeenAt: status.lastSeenAt
        });
        setUserStatus(status);
      } else {
        console.log(`📊 ChatItem: No status found for ${chat.name} (${chat._id}) in allStatuses map`);
        console.log(`📊 ChatItem: Available statuses:`, Array.from(allStatuses.keys()));
      }
    });

    return () => {
      unsubscribe();
    };
  }, [chat._id, chat.name]);
  
  // Format timestamp to readable time
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Return time for today's messages
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // Return 'Yesterday' for yesterday's messages
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    
    // Return date for older messages
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };
  
  // Better user name handling - check all possible name fields
  const getUserName = () => {
    if (chat.name && chat.name.trim() !== '') {
      return chat.name;
    }
    
    // Check if we have a username field
    if (chat.username && chat.username.trim() !== '') {
      return chat.username;
    }
    
    // Check for email as a fallback
    if (chat.email) {
      // Use email without domain as a name
      return chat.email.split('@')[0];
    }
    
    return 'Unknown User';
  };
  
  // Get first letter of name for avatar fallback
  const displayName = getUserName();
  const firstLetter = displayName.charAt(0).toUpperCase();
  
  // Check if we have a profile pic
  const hasProfilePic = !!chat.profilePic;
  
  // Format last message content
  const lastMessageContent = chat.lastMessage?.content || 'No messages yet';
  
  // Format last message time
  const lastMessageTime = chat.lastMessage?.createdAt || '';
  
  // Generate a unique key for the TouchableOpacity
  const itemKey = `chat-item-${chat._id}`;
  
  const dynamicStyles = {
    chatItem: { borderBottomColor: theme.divider },
    avatarCircle: { backgroundColor: theme.primary },
    onlineIndicator: { borderColor: theme.success },
    avatarText: { color: theme.background },
    chatName: { color: theme.text },
    chatTime: { color: theme.textSecondary },
    lastMessage: { color: theme.textSecondary },
    unreadMessage: { color: theme.text },
    unreadBadge: { backgroundColor: theme.primary },
  };

  return (
    <TouchableOpacity 
      style={[styles.chatItem, dynamicStyles.chatItem]} 
      onPress={onPress}
      key={itemKey}
      activeOpacity={0.7}
    >
      {hasProfilePic ? (
        <Image 
          source={{ uri: chat.profilePic }} 
          style={[styles.avatarCircle, dynamicStyles.avatarCircle, chat.isOnline && [styles.onlineIndicator, dynamicStyles.onlineIndicator]]} 
        />
      ) : (
        <View style={[styles.avatarCircle, dynamicStyles.avatarCircle, chat.isOnline && [styles.onlineIndicator, dynamicStyles.onlineIndicator]]}>
          <Text style={[styles.avatarText, dynamicStyles.avatarText]}>{firstLetter}</Text>
        </View>
      )}
      
      <View style={styles.chatContent}>
        <View style={styles.chatHeader}>
          <View style={styles.nameAndStatus}>
            <Text style={[styles.chatName, dynamicStyles.chatName]}>{displayName}</Text>
            <OnlineStatus 
              user={{
                _id: chat._id,
                name: displayName,
                email: chat.email || '',
                isOnline: userStatus?.isOnline ?? chat.isOnline,
                lastSeenAt: userStatus?.lastSeenAt ?? chat.lastSeenAt
              }}
              showLastSeen={false}
              compact={true}
            />
            {/* Debug info */}
            {/* {__DEV__ && (
              <Text style={{ fontSize: 8, color: '#999', marginLeft: 4 }}>
                {userStatus?.isOnline ? '🟢' : '🔴'} {userStatus?.isOnline ? 'Online' : 'Offline'}
              </Text>
            )} */}
          </View>
          {lastMessageTime && <Text style={[styles.chatTime, dynamicStyles.chatTime]}>{formatTime(lastMessageTime)}</Text>}
        </View>
        
        <View style={styles.chatFooter}>
          <Text 
            style={[
              styles.lastMessage, 
              dynamicStyles.lastMessage,
              chat.unreadCount > 0 ? [styles.unreadMessage, dynamicStyles.unreadMessage] : null
            ]} 
            numberOfLines={1}
          >
            {lastMessageContent}
          </Text>
          
          {chat.unreadCount > 0 && (
            <View style={[styles.unreadBadge, dynamicStyles.unreadBadge]}>
              <Text style={styles.unreadText}>{chat.unreadCount}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
});

// Ensure display name is set for debugging
ChatItem.displayName = 'ChatItem';

// Chat list empty component
const EmptyChats = memo(({ theme }: { theme: any }) => (
  <View style={styles.emptyContainer}>
    <Icon name="chat-bubble-outline" size={60} color={theme.textTertiary} />
    <Text style={[styles.emptyTitle, { color: theme.text }]}>No conversations yet</Text>
    <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
      Start chatting with language partners to begin conversations.
    </Text>
  </View>
));

EmptyChats.displayName = 'EmptyChats';

// Main screen component
const ChatsScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const dispatch = useAppDispatch();
  const { recentChats, loading } = useAppSelector(state => state.message);
  const { theme } = useTheme();
  
  // Initialize user status service
  const { isInitialized: statusServiceReady } = useUserStatusService();
  
  // Add all chat users to status tracking when chats are loaded
  useEffect(() => {
    if (statusServiceReady && recentChats.length > 0) {
      console.log('📋 ChatsScreen: Adding users to status tracking');
      recentChats.forEach(chat => {
        console.log(`📋 ChatsScreen: Adding user ${chat.name} (${chat._id}) to tracking`);
        // Add user to tracking with initial status from chat data
        simpleUserStatusService.addUserToTracking(chat._id, {
          isOnline: chat.isOnline || false,
          lastSeenAt: chat.lastSeenAt
        });
      });
      
      // Request fresh status for all users after a delay to ensure socket is ready
      setTimeout(() => {
        console.log('📋 ChatsScreen: Requesting fresh status for all users');
        recentChats.forEach(chat => {
          simpleUserStatusService.requestUserStatus(chat._id);
        });
      }, 3000);
    }
  }, [statusServiceReady, recentChats]);
  
  // Debug: Log recent chats changes
  useEffect(() => {
    if (recentChats.length > 0) {
      console.log('📋 ChatsScreen: Recent chats updated:', recentChats.map(chat => ({
        id: chat._id,
        name: chat.name,
        lastMessage: chat.lastMessage?.content?.substring(0, 20) + '...',
        unreadCount: chat.unreadCount,
        isOnline: chat.isOnline
      })));
      
      // Debug: Log user status service info
      if (__DEV__) {
        console.log('📋 ChatsScreen: User status service debug info:', simpleUserStatusService.getDebugInfo());
      }
    }
  }, [recentChats]);
  const [mounted, setMounted] = useState(true);
  
  // Fetch chats on component mount
  useEffect(() => {
    setMounted(true);
    loadChats();
    
    // Initialize socket connection
    socketService.initialize();
    
    // Debug: Test socket connectivity
    setTimeout(() => {
      const socket = socketService.getSocket();
      if (socket && socket.connected) {
        console.log('✅ ChatsScreen: Socket connected successfully');
        console.log('✅ ChatsScreen: Socket ID:', socket.id);
      } else {
        console.log('⚠️ ChatsScreen: Socket not connected');
        console.log('⚠️ ChatsScreen: Socket object:', socket);
      }
    }, 1000);
    
    // Listen for new messages to update chat list
    socketService.socketOn('new-message', (data: any) => {
      // When a new message arrives, update chat list through Redux (no API call)
      if (mounted && data && data.message) {
        console.log('📨 New message received in ChatsScreen, updating chat list silently');
        console.log('📨 Message data:', {
          id: data.message._id,
          content: data.message.content.substring(0, 30) + '...',
          sender: typeof data.message.sender === 'object' ? data.message.sender._id : data.message.sender,
          receiver: typeof data.message.receiver === 'object' ? data.message.receiver._id : data.message.receiver
        });
        // The handleSocketMessage thunk already updates recent chats, so we don't need to reload
        // This prevents the jarring reload experience
        dispatch(handleSocketMessage(data.message));
      } else {
        console.log('⚠️ ChatsScreen: Invalid message data received:', data);
      }
    });
    
    // Clean up listeners when component unmounts
    return () => {
      setMounted(false);
      // Remove socket event listeners
      socketService.socketOff('new-message');
    };
  }, [dispatch]);
  
  // Load chats from API
  const loadChats = () => {
    if (!mounted) return;
    
    dispatch(fetchRecentChats())
      .unwrap()
      .then(() => {
        console.log('Recent chats loaded successfully');
      })
      .catch(error => {
        if (mounted) {
          Alert.alert('Error', 'Could not load your conversations. Please try again.');
        }
      });
  };
  
  // Navigate to chat details
  const handleChatPress = useCallback((chat: ChatUser) => {
    navigation.navigate('ChatDetail', {
      id: chat._id,
      name: chat.name,
      avatar: chat.profilePic,
      user: chat
    });
  }, [navigation]);
  
  // Navigate to new chat screen
  const handleNewChat = useCallback(() => {
    navigation.navigate('Contacts');
  }, [navigation]);
  
  // Debug: Force refresh user statuses
  const handleRefreshStatuses = useCallback(() => {
    if (__DEV__) {
      console.log('🔄 ChatsScreen: Manually refreshing user statuses');
      simpleUserStatusService.forceRefreshAllStatuses();
    }
  }, []);
  
  // Render a chat item - memoized to prevent unnecessary rerenders
  const renderItem = useCallback(({ item }: { item: ChatUser }) => (
    <ChatItem 
      chat={item} 
      onPress={() => handleChatPress(item)}
      theme={theme}
    />
  ), [handleChatPress, theme]);
  
  // Optimize list rendering
  const keyExtractor = useCallback((item: ChatUser) => item._id, []);
  
  // Sort chats by last message time (newest first) to ensure latest chats appear at top
  const sortedChats = useMemo(() => {
    return [...recentChats].sort((a, b) => {
      const aTime = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
      const bTime = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
      return bTime - aTime; // Descending order (newest first)
    });
  }, [recentChats]);
  
  const dynamicStyles = {
    container: { backgroundColor: theme.background },
    header: { borderBottomColor: theme.border, backgroundColor: theme.background },
    headerTitle: { color: theme.text },
    debugButton: { backgroundColor: theme.inputBackground },
    newChatButton: { backgroundColor: theme.inputBackground },
    loaderContainer: { backgroundColor: theme.background },
    chatsList: { backgroundColor: theme.surface },
  };

  return (
    <SafeAreaView style={[styles.container, dynamicStyles.container]} edges={['top', 'left', 'right']}>
      <View style={[styles.header, dynamicStyles.header]}>
        <Text style={[styles.headerTitle, dynamicStyles.headerTitle]}>Chats</Text>
        <View style={styles.headerActions}>
          {__DEV__ && (
            <TouchableOpacity style={[styles.debugButton, dynamicStyles.debugButton]} onPress={handleRefreshStatuses}>
              <Icon name="refresh" size={20} color={theme.primary} />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.newChatButton, dynamicStyles.newChatButton]} onPress={handleNewChat}>
            <Icon name="edit" size={24} color={theme.primary} />
          </TouchableOpacity>
        </View>
      </View>
      
      {loading ? (
        <View style={[styles.loaderContainer, dynamicStyles.loaderContainer]}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          data={sortedChats}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={[styles.chatsList, dynamicStyles.chatsList]}
          ListEmptyComponent={<EmptyChats theme={theme} />}
          refreshing={loading}
          onRefresh={loadChats}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}
          getItemLayout={(data, index) => ({
            length: 80, // Approximate height of each item
            offset: 80 * index,
            index,
          })}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  debugButton: {
    padding: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  newChatButton: {
    padding: 8,
    borderRadius: 20,
  },
  chatsList: {
    flexGrow: 1,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatItem: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  avatarCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  onlineIndicator: {
    borderWidth: 2,
  },
  avatarText: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  chatContent: {
    flex: 1,
    justifyContent: 'center',
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  nameAndStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  chatName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
  },
  chatTime: {
    fontSize: 12,
  },
  chatFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: {
    fontSize: 14,
    flex: 1,
    marginRight: 8,
  },
  unreadMessage: {
    fontWeight: 'bold',
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  unreadText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingTop: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default ChatsScreen; 