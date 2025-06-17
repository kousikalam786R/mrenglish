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
import { fetchMessages, sendNewMessage } from '../redux/thunks/messageThunks';
import { setCurrentChat, setTypingStatus } from '../redux/slices/messageSlice';
import MessageBubble from '../components/MessageBubble';
import DateSeparator from '../components/DateSeparator';
import TypingIndicator from '../components/TypingIndicator';

// Define the Extended user interface
interface ExtendedUser extends User {
  isOnline?: boolean;
}

// Chat partner details type
interface ChatPartnerDetails {
  name: string;
  avatar?: string;
  isOnline: boolean;
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
    isOnline: false
  });
  
  // References
  const flatListRef = useRef<FlatList>(null);
  const currentUserId = useRef<string>('');
  
  // Get dispatch and Redux state
  const dispatch = useAppDispatch();
  const { messages, loading, error, typingUsers } = useAppSelector(state => state.message);
  
  // Get navigation and route
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<ChatDetailRouteProp>();
  
  // Extract chat partner details from route params with proper typing
  const id = route.params?.id as string || '0';
  const name = route.params?.name as string || '';
  const avatar = route.params?.avatar;
  const user = route.params?.user as ChatUser | undefined;
  
  // Check if partner is typing
  const isPartnerTyping = typingUsers[id] || false;
  
  // Get messages for this chat
  const chatMessages = messages[id] || [];
  
  // Debug logs to see what we're working with
  useEffect(() => {
    console.log('Chat ID:', id);
    console.log('Current messages count:', chatMessages.length);
    console.log('Messages state keys:', Object.keys(messages));
  }, [id, messages, chatMessages]);
  
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
              isOnline: false
            });
          } else {
            console.warn('Could not fetch user info, using default values');
            // Use defaults from route params
            setPartnerDetails({
              name: name || 'User',
              avatar: avatar,
              isOnline: false
            });
          }
        } catch (error) {
          console.error('Error fetching user info:', error);
          // Use defaults
          setPartnerDetails({
            name: name || 'User',
            avatar: avatar,
            isOnline: false
          });
        }
      } else {
        // Use user data from route params
        console.log('Setting partner details from user object:', user);
        setPartnerDetails({
          name: user.name || name || 'User',
          avatar: user.profilePic || avatar,
          isOnline: user.isOnline || false
        });
      }
    };
    
    validateChatPartner();
  }, [id, name, avatar, navigation, route.params, user]);
  
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
      dispatch(setCurrentChat(id));
      loadMessages();
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
          // Scroll to bottom after loading messages
          setTimeout(() => {
            if (flatListRef.current) {
              flatListRef.current.scrollToEnd({ animated: false });
            }
          }, 300);
        })
        .catch(error => {
          console.error('Error loading messages:', error);
        });
    }
  }
  
  // Set up socket listeners
  useEffect(() => {
    // Initialize socket connection
    socketService.initialize();
    
    // Listen for user status changes
    socketService.onUserStatus((data) => {
      if (data && data.userId === id) {
        setPartnerDetails(prev => ({
          ...prev,
          isOnline: data.status === 'online'
        }));
      }
    });
    
    // Listen for typing indicators
    socketService.onUserTyping((data) => {
      if (data && data.userId === id) {
        dispatch(setTypingStatus({ userId: id, isTyping: true }));
      }
    });
    
    socketService.onTypingStopped((data) => {
      if (data && data.userId === id) {
        dispatch(setTypingStatus({ userId: id, isTyping: false }));
      }
    });
    
    // Listen for new messages
    socketService.onNewMessage((data) => {
      // Refresh messages when we receive a new one
      if (data && (data.sender === id || data.receiver === id)) {
        loadMessages();
      }
    });
    
    // Clean up listeners when component unmounts
    return () => {
      socketService.removeAllListeners();
    };
  }, [id, dispatch]);
  
  // Handle sending a message
  const handleSend = () => {
    if (message.trim().length === 0) return;
    
    dispatch(sendNewMessage({ receiverId: id, content: message.trim() }));
    
    // Clear input
    setMessage('');
    
    // Scroll to bottom
    setTimeout(() => {
      if (flatListRef.current) {
        flatListRef.current.scrollToEnd({ animated: true });
      }
    }, 100);
  };
  
  // Handle typing indicators
  const handleInputChange = (text: string) => {
    setMessage(text);
    
    // Handle typing indicator
    if (text.length > 0 && !typingTimeout) {
      socketService.startTyping(id);
      
      // Set a timeout to stop the typing indicator after 2 seconds of inactivity
      const timeout = setTimeout(() => {
        socketService.stopTyping(id);
        setTypingTimeout(null);
      }, 2000);
      
      setTypingTimeout(timeout as unknown as NodeJS.Timeout);
    } else if (text.length === 0 && typingTimeout) {
      clearTimeout(typingTimeout);
      setTypingTimeout(null);
      socketService.stopTyping(id);
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
  
  // Render header with user info and actions
  const renderHeader = () => {
    return (
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
          <Icon name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        
        <View style={styles.headerUserInfo}>
          <Text style={styles.headerUserName}>{partnerDetails.name}</Text>
          <Text style={styles.headerUserStatus}>
            {partnerDetails.isOnline ? 'Online' : 'Offline'}
          </Text>
        </View>
        
        <TouchableOpacity style={styles.headerAction} onPress={handleCall}>
          <Icon name="call" size={24} color="#6A3DE8" />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.headerAction} onPress={() => {}}>
          <Icon name="videocam" size={24} color="#6A3DE8" />
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
    
    // Check if the current user is the sender
    const isSender = 
      item._id.startsWith('local_') || 
      senderId === currentUserIdValue ||
      (currentUserIdValue.includes(senderId) || senderId.includes(currentUserIdValue));
    
    // Use key to ensure unique component instances
    return (
      <View key={`message-${item._id}`}>
        <MessageBubble
          content={item.content}
          time={formatTime(item.createdAt)}
          isSender={isSender}
          read={item.read}
          username={partnerDetails.name}
          avatar={partnerDetails.avatar}
          showAvatar={false} // Disable avatar to prevent UI hierarchy issues
        />
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
  
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {renderHeader()}
      
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6A3DE8" />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={prepareFlatListData()}
            keyExtractor={(item) => item._id || `message-${Date.now()}-${Math.random()}`}
            renderItem={renderMessageItem}
            contentContainerStyle={styles.messagesContainer}
            onContentSizeChange={() => {
              if (flatListRef.current && chatMessages.length > 0) {
                flatListRef.current.scrollToEnd({ animated: false });
              }
            }}
            onLayout={() => {
              if (flatListRef.current && chatMessages.length > 0) {
                flatListRef.current.scrollToEnd({ animated: false });
              }
            }}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
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
            refreshing={loading}
            onRefresh={loadMessages}
          />
        )}
        
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Message"
            placeholderTextColor="#999"
            value={message}
            onChangeText={handleInputChange}
            multiline
          />
          <TouchableOpacity 
            style={[styles.sendButton, !message.trim() && styles.sendButtonDisabled]} 
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
    backgroundColor: '#FFFFFF',
  },
  keyboardAvoidingContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
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
    color: '#333',
  },
  headerUserStatus: {
    fontSize: 14,
    color: '#999',
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
    color: '#666666',
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: '#F0F0F0',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 16,
    color: '#333333',
  },
  sendButton: {
    marginLeft: 10,
    backgroundColor: '#6A3DE8',
    borderRadius: 24,
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#B0C4DE',
  },
  sendButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
  },
});

export default ChatDetailScreen; 
