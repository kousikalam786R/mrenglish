import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ChatDetailRouteProp } from '../navigation/types';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { safeParam } from '../utils/safeProps';
import { getUserById } from '../utils/userService';
import { Message as MessageType, User, ChatUser } from '../types/Message';
import socketService from '../utils/socketService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { isValidObjectId } from '../utils/validationUtils';
import { useAppDispatch, useAppSelector } from '../redux/hooks';
import { fetchMessages, sendNewMessage, handleSocketMessage } from '../redux/thunks/messageThunks';
import { setCurrentChat, setTypingStatus, updateMessageStatus, addMessage } from '../redux/slices/messageSlice';
import MessageBubble from '../components/MessageBubble';
import DateSeparator from '../components/DateSeparator';
import TypingIndicator from '../components/TypingIndicator';
import OnlineStatus from '../components/OnlineStatus';
import DebugPanel from '../components/DebugPanel';
import MessageDebugger from '../components/MessageDebugger';
import simpleUserStatusService from '../services/simpleUserStatusService';
import { useUserStatus } from '../hooks/useUserStatus';
import { useTheme } from '../context/ThemeContext';

// Define the Extended user interface
interface ExtendedUser extends User {
  isOnline?: boolean;
}

// Chat partner details type
interface ChatPartnerDetails {
  name: string;
  avatar?: string;
  isOnline: boolean;
  lastSeenAt?: string;
}

// Group messages by date
interface GroupedMessages {
  date: string;
  messages: MessageType[];
}

// Interface for message item with date separator
interface MessageListItem extends MessageType {
  isDateSeparator?: boolean;
  date?: string;
}

const ChatDetailScreen = () => {
  const [message, setMessage] = useState('');
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null);
  const [partnerDetails, setPartnerDetails] = useState<ChatPartnerDetails>({
    name: 'User',
    avatar: undefined,
    isOnline: false,
    lastSeenAt: undefined
  });
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  
  // References
  const flatListRef = useRef<FlatList>(null);
  const currentUserId = useRef<string>('');
  
  // Get dispatch and Redux state
  const dispatch = useAppDispatch();
  const { messages, loading, error, typingUsers } = useAppSelector(state => state.message);
  const { theme } = useTheme();
  
  // Get navigation and route
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<ChatDetailRouteProp>();
  
  // Extract chat partner details from route params with proper typing
  const id = route.params?.id as string || '0';

  // Get user status from centralized service
  const userStatus = useUserStatus(id);
  const name = route.params?.name as string || '';
  const avatar = route.params?.avatar;
  const user = route.params?.user as ChatUser | undefined;
  
  // Check if partner is typing
  const isPartnerTyping = typingUsers[id] || false;
  
  // Get messages for this chat
  const chatMessages = messages[id] || [];
  
  // Smooth auto-scroll for new messages (optimized)
  const prevMessageCountRef = useRef(0);
  const isUserScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialLoadRef = useRef(true);
  
  useEffect(() => {
    // Always scroll to bottom on initial load
    if (isInitialLoadRef.current && chatMessages.length > 0) {
      console.log(`📜 Initial load: Scrolling to bottom with ${chatMessages.length} messages`);
      setTimeout(() => {
        if (flatListRef.current) {
          flatListRef.current.scrollToEnd({ animated: false });
        }
        isInitialLoadRef.current = false;
      }, 100);
      return;
    }
    
    // Auto-scroll for new messages
    if (chatMessages.length > prevMessageCountRef.current && chatMessages.length > 0) {
      console.log(`📜 New message detected (${prevMessageCountRef.current} -> ${chatMessages.length})`);
      
      // Only auto-scroll if user isn't actively scrolling
      if (!isUserScrollingRef.current) {
        // Use multiple attempts to ensure scroll works
        const scrollToBottom = () => {
          if (flatListRef.current) {
            flatListRef.current.scrollToEnd({ animated: true });
          }
        };
        
        // Immediate scroll
        requestAnimationFrame(scrollToBottom);
        
        // Backup scroll after a short delay
        setTimeout(scrollToBottom, 100);
      } else {
        console.log('📜 User is scrolling, skipping auto-scroll');
      }
    }
    
    prevMessageCountRef.current = chatMessages.length;
  }, [chatMessages.length]); // Only depend on length, not entire chatMessages array
  
  // Format time string for messages
  const formatTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (error) {
      console.error('Error formatting time:', error);
      return '';
    }
  };
  
  // Group messages by date
  const groupMessagesByDate = (): GroupedMessages[] => {
    const groupedMessages: Record<string, MessageType[]> = {};
    
    chatMessages.forEach((msg: MessageType) => {
      const date = new Date(msg.createdAt).toDateString();
      if (!groupedMessages[date]) {
        groupedMessages[date] = [];
      }
      groupedMessages[date].push(msg);
    });
    
    return Object.keys(groupedMessages).map(date => ({
      date,
      messages: groupedMessages[date]
    }));
  };
  
  // Check chat partner details
  useEffect(() => {
    const validateChatPartner = async () => {
      console.log('Validating chat partner with ID:', id);
      console.log('Received params:', { id, name, avatar });
      console.log('Full user object:', user);
      
      // Check if we have minimal required info - only show error for completely invalid IDs
      if (!id || id === '0' || id === 'undefined') {
        console.warn('Chat ID is missing or invalid');
        Alert.alert(
          'Error',
          'This chat is missing a valid ID. Please select a user from the chat list.',
          [{ 
            text: 'Go Back', 
            onPress: () => navigation.goBack()
          }]
        );
        return;
      }
      
      // Check for user property in route params
      if (!user) {
        console.warn('No user object found in route params');
        
        // Try to fetch user details using the ID
        try {
          const userInfo = await getUserById(id);
          if (userInfo) {
            console.log('Successfully fetched user info:', userInfo);
            setPartnerDetails({
              name: userInfo.name || name || 'User',
              avatar: userInfo.profilePic || avatar,
              isOnline: false,
              lastSeenAt: userInfo.lastSeenAt
            });
          } else {
            console.warn('Could not fetch user info, using default values');
            // Use defaults from route params
            setPartnerDetails({
              name: name || 'User',
              avatar: avatar,
              isOnline: false,
              lastSeenAt: undefined
            });
          }
        } catch (error) {
          console.error('Error fetching user info:', error);
          // Use defaults
          setPartnerDetails({
            name: name || 'User',
            avatar: avatar,
            isOnline: false,
            lastSeenAt: undefined
          });
        }
      } else {
        // Use user data from route params
        console.log('Setting partner details from user object:', user);
        setPartnerDetails({
          name: user.name || name || 'User',
          avatar: user.profilePic || avatar,
          isOnline: user.isOnline || false,
          lastSeenAt: user.lastSeenAt
        });
      }
    };
    
    validateChatPartner();
  }, [id, name, avatar, navigation, route.params, user]);

  // Mark all messages as read when chat is viewed
  useEffect(() => {
    if (chatMessages.length > 0) {
      // Small delay to ensure messages are fully loaded
      const timer = setTimeout(() => {
        markAllMessagesAsRead();
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [chatMessages.length]);
  
  // Fetch user ID on component mount
  useEffect(() => {
    const getUserId = async () => {
      try {
        const userId = await AsyncStorage.getItem('userId');
        console.log('Current user ID from AsyncStorage:', userId);
        
        if (userId) {
          currentUserId.current = userId;
        } else {
          // Try to get the complete user from storage as a fallback
          const userJson = await AsyncStorage.getItem('user');
          if (userJson) {
            try {
              const user = JSON.parse(userJson);
              if (user && user._id) {
                currentUserId.current = user._id;
              }
            } catch (parseError) {
              console.error('Error parsing user JSON:', parseError);
            }
          }
        }
      } catch (error) {
        console.error('Error getting user ID:', error);
      }
    };

    getUserId();
  }, []);

  // Force fetch messages when screen mounts
  useEffect(() => {
    loadMessages();
  }, []);
  
  // Set current chat and fetch messages when ID changes
  useEffect(() => {
    if (id && id !== '0') {
      console.log(`💾 Loading messages for chat: ${id}`);
      dispatch(setCurrentChat(id));
      loadMessages();
      
      // If this is a fresh navigation (like from notification), 
      // scroll to bottom after a short delay to show latest messages
      setTimeout(() => {
        if (flatListRef.current && chatMessages.length > 0) {
          flatListRef.current.scrollToEnd({ animated: true });
        }
      }, 500);
    }
  }, [id, dispatch]);
  
  // Load messages function for better readability and reuse
  const loadMessages = () => {
    if (id && id !== '0') {
      console.log('Fetching messages for chat:', id);
      dispatch(fetchMessages(id))
        .unwrap()
        .then((result) => {
          console.log(`Loaded ${result.length} messages for chat ${id}`);
          // Reset scroll state and scroll to bottom after loading messages
          isUserScrollingRef.current = false;
          isInitialLoadRef.current = true;
          
          // Multiple attempts to ensure scroll works
          setTimeout(() => {
            if (flatListRef.current) {
              flatListRef.current.scrollToEnd({ animated: false });
            }
          }, 100);
          
          setTimeout(() => {
            if (flatListRef.current) {
              flatListRef.current.scrollToEnd({ animated: false });
            }
          }, 500);
        })
        .catch(error => {
          console.error('Error loading messages:', error);
        });
    }
  }
  
  // Set up socket listeners
  useEffect(() => {
    console.log(`🔗 Setting up socket listeners for chat ${id}`);
    
    // Initialize socket connection
    socketService.initialize();
    
    // Quick connectivity check and request user status
    setTimeout(() => {
      const socket = socketService.getSocket();
      if (socket && socket.connected) {
        console.log(`✅ Socket connected for chat ${id}`);
        
        // Request current user status for this chat partner
        socket.emit('get-user-status', { userId: id });
        console.log(`📡 Requested user status for ${id}`);
      } else {
        console.log(`⚠️  Socket not connected, will retry...`);
      }
    }, 1000);
    
    // User status updates are now handled by SimpleUserStatusService
    // The useUserStatus hook will automatically update the status
    
    // Note: message-sent event is handled by socketService.sendPrivateMessage
    // The real message will come back through the new-message event
    
    // Listen for message delivery confirmations
    socketService.socketOn('message-delivered', (data) => {
      console.log('✅ Message delivered:', data);
      if (data && data.messageId && data.deliveredAt) {
        dispatch(updateMessageStatus({
          messageId: data.messageId,
          status: 'delivered',
          timestamp: data.deliveredAt
        }));
      }
    });
    
    // Listen for message read confirmations
    socketService.socketOn('message-read', (data) => {
      console.log('👁️  Message read:', data);
      if (data && data.messageId && data.readAt) {
        dispatch(updateMessageStatus({
          messageId: data.messageId,
          status: 'read',
          timestamp: data.readAt
        }));
      }
    });
    
    // Listen for typing indicators
    socketService.socketOn('user-typing', (data) => {
      console.log('⌨️  TYPING EVENT in ChatDetailScreen:', data);
      if (data && data.userId === id) {
        dispatch(setTypingStatus({ userId: id, isTyping: true }));
      }
    });
    
    socketService.socketOn('typing-stopped', (data) => {
      console.log('⌨️  TYPING STOPPED EVENT in ChatDetailScreen:', data);
      if (data && data.userId === id) {
        dispatch(setTypingStatus({ userId: id, isTyping: false }));
      }
    });
    
    // Listen for new messages (clean, production-ready)
    socketService.socketOn('new-message', (data) => {
      console.log('📨 New message received for chat', id);
      
      // Check if this message is for this chat
      if (data && data.message) {
        const message = data.message;
        const senderId = typeof message.sender === 'object' ? message.sender._id : message.sender;
        const receiverId = typeof message.receiver === 'object' ? message.receiver._id : message.receiver;
        const currentUserIdValue = currentUserId.current;
        
        // Check if this is an incoming message for this chat
        const isIncomingMessage = senderId === id && receiverId === currentUserIdValue;
        
        if (isIncomingMessage) {
          // Check for duplicates
          const existingMessage = chatMessages.find(msg => 
            msg._id === message._id || 
            (msg.content === message.content && 
             Math.abs(new Date(msg.createdAt).getTime() - new Date(message.createdAt).getTime()) < 5000)
          );
          
          if (!existingMessage) {
            console.log('✅ Adding new message to chat');
            dispatch(handleSocketMessage(message));
            
            // Mark message as read since user is viewing the chat
            setTimeout(() => {
              markMessageAsRead(message._id, senderId);
            }, 1000); // Small delay to ensure message is displayed
          } else {
            console.log('⚠️  Duplicate message, skipping');
          }
        } else {
          console.log('⚠️  Message not for this chat');
        }
      }
    });
    
    // Periodic socket health check and user activity tracking
    const heartbeatInterval = setInterval(() => {
      const socket = socketService.getSocket();
      if (!socket || !socket.connected) {
        console.log('🔌 Socket disconnected, attempting reconnection...');
        socketService.initialize();
      } else {
        // Send user activity to update last seen
        socket.emit('user-activity');
      }
    }, 30000); // Every 30 seconds
    
    // Clean up listeners when component unmounts
    return () => {
      clearInterval(heartbeatInterval);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      console.log(`🧹 ChatDetailScreen: Cleaning up socket listeners for chat ${id}`);
      socketService.socketOff('user-status');
      socketService.socketOff('user-typing');
      socketService.socketOff('typing-stopped');
      socketService.socketOff('new-message');
      socketService.socketOff('message-delivered');
      socketService.socketOff('message-read');
    };
  }, [id, dispatch]);
  
  // Handle sending a message (optimized for smooth UX)
  const handleSend = async () => {
    if (message.trim().length === 0) return;
    
    const messageContent = message.trim();
    
    // Clear input immediately for better UX
    setMessage('');
    
    // Reset user scrolling state so auto-scroll works for sent message
    isUserScrollingRef.current = false;
    
    // Send message via Redux thunk (it handles optimistic updates)
    try {
      await dispatch(sendNewMessage({ receiverId: id, content: messageContent }));
      console.log('✅ Message sent successfully via optimistic update');
      
      // Force scroll to bottom after sending message
      setTimeout(() => {
        if (flatListRef.current) {
          flatListRef.current.scrollToEnd({ animated: true });
        }
      }, 100);
    } catch (error) {
      console.error('❌ Failed to send message:', error);
      // TODO: Show error to user and handle optimistic update rollback
    }
  };
  
  // Handle typing indicators
  const handleInputChange = (text: string) => {
    setMessage(text);
    
    // Handle typing indicator
    if (text.length > 0 && !typingTimeout) {
      console.log(`⌨️  Starting typing to ${id}`);
      socketService.socketEmit('typing', { receiverId: id });
      
      // Set a timeout to stop the typing indicator after 2 seconds of inactivity
      const timeout = setTimeout(() => {
        console.log(`⌨️  Stopping typing to ${id}`);
        socketService.socketEmit('typing-stopped', { receiverId: id });
        setTypingTimeout(null);
      }, 2000);
      
      setTypingTimeout(timeout as unknown as NodeJS.Timeout);
    } else if (text.length === 0 && typingTimeout) {
      clearTimeout(typingTimeout);
      setTypingTimeout(null);
      console.log(`⌨️  Stopping typing to ${id} (text cleared)`);
      socketService.socketEmit('typing-stopped', { receiverId: id });
    }
  };
  
  // Mark message as read
  const markMessageAsRead = (messageId: string, senderId: string) => {
    const socket = socketService.getSocket();
    if (socket && socket.connected) {
      socket.emit('mark-message-read', {
        messageId,
        senderId
      });
      console.log(`📖 Marked message ${messageId} as read`);
    }
  };

  // Mark all unread messages as read when chat is viewed
  const markAllMessagesAsRead = () => {
    const currentUserIdValue = currentUserId.current;
    if (!currentUserIdValue) return;

    // Find all unread messages from the other user
    const unreadMessages = chatMessages.filter(msg => {
      const senderId = typeof msg.sender === 'object' ? msg.sender._id : msg.sender;
      return senderId !== currentUserIdValue && !msg.read;
    });

    // Mark each unread message as read
    unreadMessages.forEach(msg => {
      const senderId = typeof msg.sender === 'object' ? msg.sender._id : msg.sender;
      markMessageAsRead(msg._id, senderId);
    });

    if (unreadMessages.length > 0) {
      console.log(`📖 Marking ${unreadMessages.length} messages as read`);
    }
  };

  // Handle call button press
  const handleCall = () => {
    navigation.navigate('CallScreen', {
      id: id,
      name: partnerDetails.name,
      isVideoCall: false
    });
  };
  
  // Handle back button press
  const handleBackPress = () => {
    navigation.goBack();
  };
  
  // Handle scroll to bottom button
  const handleScrollToBottom = () => {
    if (flatListRef.current) {
      flatListRef.current.scrollToEnd({ animated: true });
      setShowScrollToBottom(false);
    }
  };
  
  // Render header with user info and actions
  const renderHeader = () => {
    const dynamicStyles = {
      header: { backgroundColor: theme.background, borderBottomColor: theme.border },
      headerUserName: { color: theme.text },
      headerAction: { color: theme.primary },
    };

    return (
      <View style={[styles.header, dynamicStyles.header]}>
        <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
          <Icon name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        
        <View style={styles.headerUserInfo}>
          <Text style={[styles.headerUserName, dynamicStyles.headerUserName]}>{partnerDetails.name}</Text>
          <OnlineStatus 
            user={{
              _id: id,
              name: partnerDetails.name,
              email: '',
              isOnline: userStatus?.isOnline ?? partnerDetails.isOnline,
              lastSeenAt: userStatus?.lastSeenAt ?? partnerDetails.lastSeenAt,
              isTyping: isPartnerTyping
            }}
            showLastSeen={true}
            compact={false}
          />
          {/* Debug info */}
          {__DEV__ && (
            <Text style={{ fontSize: 10, color: theme.textTertiary }}>
              Debug: Online={userStatus?.isOnline ? 'Yes' : 'No'}, 
              LastSeen={userStatus?.lastSeenAt ? 'Yes' : 'No'}
            </Text>
          )}
        </View>
        
        <TouchableOpacity style={styles.headerAction} onPress={handleCall}>
          <Icon name="call" size={24} color={theme.primary} />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.headerAction} onPress={() => {
          navigation.navigate('CallScreen', {
            id: id,
            name: partnerDetails.name,
            isVideoCall: true
          });
        }}>
          <Icon name="videocam" size={24} color={theme.primary} />
        </TouchableOpacity>
      </View>
    );
  };
  
  // Render a message item
  const renderMessageItem = ({ item }: { item: MessageListItem }) => {
    // Get current user's ID
    const currentUserIdValue = currentUserId.current;
    if (!currentUserIdValue) {
      return null;
    }
    
    // Extract the sender ID
    const senderId = typeof item.sender === 'object' ? item.sender._id : item.sender;
    
    // Determine if this is a date separator or a message
    if (item.isDateSeparator) {
      return <DateSeparator date={item.date || new Date()} />;
    }
    
    // Check if the current user is the sender (improved logic)
    const isSender: boolean = Boolean(
      item._id.startsWith('local_') || // Local optimistic messages
      senderId === currentUserIdValue || // Direct ID match
      (senderId && currentUserIdValue && senderId.toString() === currentUserIdValue.toString()) // String comparison
    );
    
    // Create a stable key that handles both local and server IDs
    const messageKey = item._id.startsWith('local_') 
      ? item._id 
      : `server-${item._id}`;
    
    return (
      <View key={messageKey}>
        <MessageBubble
          content={item.content}
          time={formatTime(item.createdAt)}
          isSender={isSender}
          read={item.read}
          username={partnerDetails.name}
          avatar={partnerDetails.avatar}
          showAvatar={false} // Disable avatar to prevent UI hierarchy issues
        />
        {/* Debug info for each message */}
        {/* {__DEV__ && (
          <Text style={{ fontSize: 8, color: '#999', marginLeft: 10 }}>
            Status: {item.status || 'none'} | 
            Delivered: {item.deliveredAt ? 'yes' : 'no'} | 
            Read: {item.readAt ? 'yes' : 'no'}
          </Text>
        )} */}
      </View>
    );
  };
  
  // Prepare flat list data with date separators
  const prepareFlatListData = (): MessageListItem[] => {
    const groupedMessages = groupMessagesByDate();
    const flatListData: MessageListItem[] = [];
    
    groupedMessages.forEach(group => {
      // Add date separator
      flatListData.push({
        _id: `date-${group.date}`,
        content: '',
        sender: '',
        receiver: '',
        createdAt: '',
        read: false,
        isDateSeparator: true,
        date: group.date
      });
      
      // Add messages
      group.messages.forEach(message => {
        flatListData.push(message);
      });
    });
    
    return flatListData;
  };
  
  const dynamicStyles = {
    safeArea: { backgroundColor: theme.background },
    loadingContainer: { backgroundColor: theme.background },
    messagesContainer: { backgroundColor: theme.surface },
    emptyContainer: { backgroundColor: theme.surface },
    emptyText: { color: theme.textSecondary },
    inputContainer: { backgroundColor: theme.background, borderTopColor: theme.border },
    input: { backgroundColor: theme.inputBackground, color: theme.text },
    sendButton: { backgroundColor: theme.primary },
    scrollToBottomButton: { backgroundColor: theme.primary },
  };

  return (
    <SafeAreaView style={[styles.safeArea, dynamicStyles.safeArea]} edges={['top', 'left', 'right']}>
      {renderHeader()}
      
      {/* Debug Panels - Remove in production */}
     
      
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
      >
        {loading ? (
          <View style={[styles.loadingContainer, dynamicStyles.loadingContainer]}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={prepareFlatListData()}
            keyExtractor={(item) => item._id || `message-${Date.now()}-${Math.random()}`}
            renderItem={renderMessageItem}
            contentContainerStyle={[styles.messagesContainer, dynamicStyles.messagesContainer]}
            onContentSizeChange={() => {
              // Only scroll on initial load, not for new messages (useEffect handles those)
              if (flatListRef.current && chatMessages.length > 0 && prevMessageCountRef.current === 0) {
                flatListRef.current.scrollToEnd({ animated: false });
              }
            }}
            onLayout={() => {
              // Only scroll on initial load
              if (flatListRef.current && chatMessages.length > 0 && prevMessageCountRef.current === 0) {
                flatListRef.current.scrollToEnd({ animated: false });
              }
            }}
            onScroll={(event) => {
              // Check if user is near the bottom
              const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
              const isNearBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - 100;
              setShowScrollToBottom(!isNearBottom);
            }}
            onScrollBeginDrag={() => {
              // User started scrolling manually
              isUserScrollingRef.current = true;
              console.log('👆 User started manual scrolling');
              
              // Clear any existing timeout
              if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
              }
            }}
            onScrollEndDrag={() => {
              // User stopped scrolling, reset after a shorter delay
              if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
              }
              scrollTimeoutRef.current = setTimeout(() => {
                isUserScrollingRef.current = false;
                console.log('👆 User manual scrolling ended - auto-scroll enabled');
              }, 1000); // Allow auto-scroll again after 1 second
            }}
            onMomentumScrollEnd={() => {
              // Scroll animation finished
              if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
              }
              scrollTimeoutRef.current = setTimeout(() => {
                isUserScrollingRef.current = false;
                console.log('👆 Scroll momentum ended - auto-scroll enabled');
              }, 500); // Shorter delay for momentum end
            }}
            ListEmptyComponent={
              <View style={[styles.emptyContainer, dynamicStyles.emptyContainer]}>
                <Text style={[styles.emptyText, dynamicStyles.emptyText]}>
                  No messages yet. Start the conversation!
                </Text>
              </View>
            }
            ListFooterComponent={
              isPartnerTyping ? (
                <TypingIndicator 
                  isTyping={true} 
                  username={partnerDetails.name} 
                />
              ) : null
            }
            refreshing={false}
            onRefresh={undefined}
            showsVerticalScrollIndicator={true}
            maintainVisibleContentPosition={{
              minIndexForVisible: 0,
            }}
          />
        )}
        
        {/* Scroll to bottom button */}
        {showScrollToBottom && (
          <TouchableOpacity 
            style={[styles.scrollToBottomButton, dynamicStyles.scrollToBottomButton]}
            onPress={handleScrollToBottom}
          >
            <Icon name="keyboard-arrow-down" size={24} color="white" />
          </TouchableOpacity>
        )}
        
        <View style={[styles.inputContainer, dynamicStyles.inputContainer]}>
          <TextInput
            style={[styles.input, dynamicStyles.input]}
            placeholder="Message"
            placeholderTextColor={theme.textTertiary}
            value={message}
            onChangeText={handleInputChange}
            multiline
          />
          <TouchableOpacity 
            style={[styles.sendButton, dynamicStyles.sendButton, !message.trim() && styles.sendButtonDisabled]} 
            onPress={handleSend}
            disabled={!message.trim()}
          >
            <Text style={styles.sendButtonText}>Send</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  keyboardAvoidingContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    height: 60,
  },
  backButton: {
    padding: 5,
    marginRight: 10,
  },
  headerUserInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  headerUserName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerUserStatus: {
    fontSize: 14,
  },
  headerAction: {
    padding: 8,
    marginLeft: 5,
  },
  messagesContainer: {
    padding: 10,
    paddingBottom: 20,
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
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 16,
  },
  sendButton: {
    marginLeft: 10,
    borderRadius: 24,
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  scrollToBottomButton: {
    position: 'absolute',
    bottom: 80,
    right: 20,
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
});

export default ChatDetailScreen; 
