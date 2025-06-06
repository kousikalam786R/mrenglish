import React, { useState, useEffect, memo, useCallback } from 'react';
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
import { fetchRecentChats } from '../redux/thunks/messageThunks';
import socketService from '../utils/socketService';

// Chat item component
interface ChatItemProps {
  chat: ChatUser;
  onPress: () => void;
}

// Use memo to prevent unnecessary re-renders
const ChatItem = memo<ChatItemProps>(({ chat, onPress }) => {
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
  
  return (
    <TouchableOpacity 
      style={styles.chatItem} 
      onPress={onPress}
      key={itemKey}
      activeOpacity={0.7}
    >
      {hasProfilePic ? (
        <Image 
          source={{ uri: chat.profilePic }} 
          style={[styles.avatarCircle, chat.isOnline && styles.onlineIndicator]} 
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
});

// Ensure display name is set for debugging
ChatItem.displayName = 'ChatItem';

// Chat list empty component
const EmptyChats = memo(() => (
  <View style={styles.emptyContainer}>
    <Icon name="chat-bubble-outline" size={60} color="#D1D1D1" />
    <Text style={styles.emptyTitle}>No conversations yet</Text>
    <Text style={styles.emptyText}>
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
  const [mounted, setMounted] = useState(true);
  
  // Fetch chats on component mount
  useEffect(() => {
    setMounted(true);
    loadChats();
    
    // Initialize socket connection
    socketService.initialize();
    
    // Add socket event listeners for user status updates
    socketService.socketOn('user_status', (data: any) => {
      if (data && data.userId && data.status && mounted) {
        // Update user status in chats list through Redux
        // This would need to be implemented in the messageSlice
      }
    });
    
    // Listen for new messages to update chat list
    socketService.socketOn('new_message', (data: any) => {
      // When a new message arrives, refresh chats list
      if (mounted) {
        loadChats();
      }
    });
    
    // Clean up listeners when component unmounts
    return () => {
      setMounted(false);
      // Remove socket event listeners
      socketService.socketOff('user_status');
      socketService.socketOff('new_message');
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
  
  // Render a chat item - memoized to prevent unnecessary rerenders
  const renderItem = useCallback(({ item }: { item: ChatUser }) => (
    <ChatItem 
      chat={item} 
      onPress={() => handleChatPress(item)} 
    />
  ), [handleChatPress]);
  
  // Optimize list rendering
  const keyExtractor = useCallback((item: ChatUser) => item._id, []);
  
  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Chats</Text>
        <TouchableOpacity style={styles.newChatButton} onPress={handleNewChat}>
          <Icon name="edit" size={24} color="#6A3DE8" />
        </TouchableOpacity>
      </View>
      
      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#6A3DE8" />
        </View>
      ) : (
        <FlatList
          data={recentChats}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={styles.chatsList}
          ListEmptyComponent={<EmptyChats />}
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
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
  },
  newChatButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
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
    borderBottomColor: '#F0F0F0',
  },
  avatarCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#6A3DE8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  onlineIndicator: {
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  avatarText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
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
  chatName: {
    fontSize: 16,
    fontWeight: 'bold',
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
    fontSize: 14,
    color: '#666666',
    flex: 1,
    marginRight: 8,
  },
  unreadMessage: {
    fontWeight: 'bold',
    color: '#333333',
  },
  unreadBadge: {
    backgroundColor: '#6A3DE8',
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
    color: '#333333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default ChatsScreen; 