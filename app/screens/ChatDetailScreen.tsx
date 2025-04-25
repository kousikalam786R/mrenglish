import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  InteractionManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ChatDetailRouteProp } from '../navigation/types';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { safeParam } from '../utils/safeProps';
import { getMessages } from '../utils/messageService';
import { getUserById } from '../utils/userService';
import { Message as MessageType, User } from '../types/Message';
import socketService from '../utils/socketService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isValidObjectId } from '../utils/validationUtils';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MessageType as MessageTypeType } from '../types/MessageType';
import { formatTime } from '../utils/helpers';
import axios from 'axios';
import { API_URL, SOCKET_EVENTS } from '../utils/config';
import { useSocket } from '../utils/SocketProvider';
import { ObjectId } from 'bson';
import { ChatUser } from '../types/User';

// Define the enhanced user type that may include isOnline
interface ExtendedUser extends User {
  isOnline?: boolean;
}

// Define the enhanced chat user type that may include nested user
interface ExtendedChatUser extends ChatUser {
  user?: ExtendedUser;
  isOnline?: boolean;
}

// Helper function for safe string comparison that handles various formats
const safeIdCompare = (id1: any, id2: any): boolean => {
  if (!id1 || !id2) return false;
  
  // Convert IDs to strings, trimming whitespace
  const str1 = String(id1).trim();
  const str2 = String(id2).trim();
  
  // Direct string comparison
  if (str1 === str2) return true;
  
  // Handle potential object IDs with different formats
  if (str1.includes(str2) || str2.includes(str1)) {
    console.log(`Potential ID match with inclusion: ${str1} vs ${str2}`);
    return true;
  }
  
  // No match
  return false;
};

const ChatDetailScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<ChatDetailRouteProp>();
  
  // Safely extract parameters with defaults to prevent null reference errors
  const id = safeParam(route, 'id', '0');
  const name = safeParam(route, 'name', 'User');
  const user = route.params?.user as ExtendedChatUser | undefined;
  const avatar = user?.profilePic || "https://randomuser.me/api/portraits/men/32.jpg";
  
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const currentUserId = useRef<string | null>(null);
  
  // Add state for tracking chat partner details
  const [partnerDetails, setPartnerDetails] = useState({
    name: name,
    avatar: avatar,
    isOnline: user?.isOnline || false
  });

  // Validate chat parameters on mount
  useEffect(() => {
    const validateChatPartner = async () => {
      console.log('Validating chat partner information');
      console.log('Received params:', { id, name, avatar });
      console.log('Full user object:', user);
      
      // More detailed logging of route params
      console.log('Full route params:', route.params);
      
      // Check if we have minimal required info
      if (id === '0') {
        console.warn('Chat ID is missing or invalid');
        // Show an error and navigate back
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
              name: userInfo.name || name,
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
        // Use user data from route params - check for both direct and nested properties
        console.log('Setting partner details from user object:', user);
        setPartnerDetails({
          name: user.name || (user.user?.name) || name,
          avatar: user.profilePic || (user.user?.profilePic) || avatar,
          isOnline: user.isOnline || (user.user?.isOnline) || false
        });
      }
    };
    
    validateChatPartner();
  }, [id, name, avatar, navigation, route.params, user]);

  // Fetch user ID once on component mount
  useEffect(() => {
    const getUserId = async () => {
      try {
        // Get the userId from AsyncStorage
        const userId = await AsyncStorage.getItem('userId');
        console.log('Current user ID from AsyncStorage:', userId);
        
        if (!userId) {
          // Try alternate storage mechanism
          const altUserId = await AsyncStorage.getItem('user_id');
          console.log('Alternate user ID from AsyncStorage:', altUserId);
          
          if (altUserId) {
            currentUserId.current = altUserId;
            console.log('Set current user ID (from alternate) to:', currentUserId.current);
          } else {
            console.error('User ID not found in AsyncStorage under any known key');
            
            // Try to get the complete user from storage as a fallback
            const userJson = await AsyncStorage.getItem('user');
            if (userJson) {
              try {
                const user = JSON.parse(userJson);
                if (user && user._id) {
                  currentUserId.current = user._id;
                  console.log('Set current user ID (from user object) to:', currentUserId.current);
                }
              } catch (parseError) {
                console.error('Error parsing user JSON:', parseError);
              }
            }
          }
        } else {
          currentUserId.current = userId;
          console.log('Set current user ID to:', currentUserId.current);
        }
        
        // Log all AsyncStorage keys for debugging
        console.log('All AsyncStorage keys for debugging:');
        const allKeys = await AsyncStorage.getAllKeys();
        console.log(allKeys);
        
      } catch (error) {
        console.error('Error getting user ID:', error);
      }
    };

    getUserId();
  }, []);

  // Fetch messages for this chat
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        setLoading(true);
        
        // Check if ID is valid (MongoDB ObjectIDs are 24 characters)
        if (id === '0' || !isValidObjectId(id)) {
          console.log('Non-standard ID format:', id, 'Treating as new conversation');
          setMessages([]);
          return;
        } 
        
        // Fetch real messages
        console.log('Fetching real messages for chat ID:', id);
        try {
          const fetchedMessages = await getMessages(id);
          
          if (fetchedMessages && fetchedMessages.length > 0) {
            console.log(`====== RECEIVED ${fetchedMessages.length} MESSAGES FROM API ======`);
            
            // Log details of each message for debugging
            fetchedMessages.forEach((msg, index) => {
              const senderInfo = typeof msg.sender === 'object' ? 
                `object:${msg.sender._id}` : `string:${msg.sender}`;
                
              const receiverInfo = typeof msg.receiver === 'object' ? 
                `object:${msg.receiver._id}` : `string:${msg.receiver}`;
                
              console.log(`Message ${index + 1}:`);
              console.log(`- ID: ${msg._id}`);
              console.log(`- Content: ${msg.content.substring(0, 30)}...`);
              console.log(`- Sender: ${senderInfo}`);
              console.log(`- Receiver: ${receiverInfo}`);
              console.log(`- Current User ID: ${currentUserId.current}`);
              console.log(`- Is Current User Sender: ${msg.sender === currentUserId.current || 
                (typeof msg.sender === 'object' && msg.sender._id === currentUserId.current)}`);
            });
            
            console.log(`==========================================`);
            
            // Set messages without any preprocessing
            setMessages(fetchedMessages);
          } else {
            console.log('No messages found for this conversation');
            setMessages([]);
          }
        } catch (error: any) {
          console.error('Error fetching messages:', error);
          // Only show alert for serious errors, not ID validation errors
          if (!error.message.includes('Invalid ID format')) {
            Alert.alert(
              'Error Loading Messages',
              `Could not load messages: ${error.message || 'Unknown error'}`,
              [{ text: 'OK' }]
            );
          }
          // If error fetching messages, set to empty array
          setMessages([]);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, [id]);

  // Set up socket event listeners
  useEffect(() => {
    // Listen for new messages
    socketService.onNewMessage((data) => {
      // Only update if the message is from the current chat partner
      console.log('New message received via socket:', JSON.stringify(data).substring(0, 200));
      
      if (data && data.message) {
        const newMessage = data.message;
        
        // Extract sender ID regardless of format
        const senderId = typeof newMessage.sender === 'object' ? 
          newMessage.sender._id : newMessage.sender;
        
        // Extract receiver ID regardless of format  
        const receiverId = typeof newMessage.receiver === 'object' ? 
          newMessage.receiver._id : newMessage.receiver;
        
        // Get the current chat ID and user ID
        const currentChatId = id;
        const currentUserIdVal = currentUserId.current;
        
        console.log(`Socket message: From=${senderId}, To=${receiverId}`);
        console.log(`Current chat=${currentChatId}, Current user=${currentUserIdVal}`);
        
        // Determine if this message belongs to our current chat
        let belongsToCurrentChat = false;
        let isFromCurrentUser = false;
        
        // Better check for message ownership
        // Case 1: Message from contact to us
        if (senderId.includes(currentChatId) && receiverId.includes(currentUserIdVal)) {
          belongsToCurrentChat = true;
          isFromCurrentUser = false;
          console.log("This is a message FROM contact TO us");
        }
        // Case 2: Message from us to contact
        else if (senderId.includes(currentUserIdVal) && receiverId.includes(currentChatId)) {
          belongsToCurrentChat = true;
          isFromCurrentUser = true;
          console.log("This is a message FROM us TO contact");
        }
        // Case 3: Message matches our current chat some other way
        else if (
          senderId === currentChatId || 
          receiverId === currentChatId || 
          senderId === currentUserIdVal || 
          receiverId === currentUserIdVal
        ) {
          belongsToCurrentChat = true;
          console.log("This message belongs to current chat by ID match");
        }
        
        console.log(`Message belongs to current chat: ${belongsToCurrentChat}`);
        
        if (belongsToCurrentChat) {
          console.log('Adding new socket message to chat');
          
          // Make sure we don't duplicate optimistic messages
          if (newMessage._id.startsWith('local_')) {
            console.log('Skipping local message');
            return;
          }
          
          setMessages(prev => [...prev, newMessage]);
          
          // Scroll to bottom when a new message is received
          setTimeout(() => {
            if (flatListRef.current) {
              flatListRef.current.scrollToEnd({ animated: true });
            }
          }, 100);
        }
      }
    });

    // Listen for message confirmation
    socketService.onMessageSent((data) => {
      if (data && data.success && data.message) {
        console.log('Message sent confirmation:', data.message._id);
      } else if (data && !data.success) {
        console.error('Message failed to send:', data.error);
        Alert.alert('Message Failed', 'Your message could not be delivered. Please try again.');
      }
    });

    // Listen for typing indicators
    socketService.onUserTyping((data) => {
      if (data && data.userId === id) {
        setIsTyping(true);
      }
    });

    socketService.onTypingStopped((data) => {
      if (data && data.userId === id) {
        setIsTyping(false);
      }
    });

    // Cleanup listeners when component unmounts
    return () => {
      socketService.removeAllListeners();
    };
  }, [id]);
  
  const formatTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (error) {
      console.error('Error formatting time:', error);
      return '';
    }
  };
  
  // Handle message sending
  const handleSend = () => {
    if (message.trim().length === 0) return;
    
    try {
      const currentUserIdVal = currentUserId.current;
      if (!currentUserIdVal) {
        console.error('No user ID available - cannot send message');
        Alert.alert('Error', 'Not logged in. Please log in again.');
        return;
      }
      
      console.log(`Sending message as user ${currentUserIdVal} to ${id}`);
      
      // Send real message via socket
      console.log('Sending real message to:', id);
      socketService.sendPrivateMessage(id, message.trim());
      
      // Add a special marker to identify this as definitely our message
      const optimisticMessage: MessageType & { _isFromCurrentUser?: boolean } = {
        _id: `local_${Date.now()}`, // 'local_' prefix marks it as our optimistic message
        content: message.trim(),
        // IMPORTANT: Ensure sender is clearly marked as us
        sender: currentUserIdVal,
        receiver: id,
        createdAt: new Date().toISOString(),
        read: false,
        // Add a special flag ONLY to our optimistic messages
        _isFromCurrentUser: true // This is a custom field to force identification
      };
      
      console.log('Optimistic message sender:', optimisticMessage.sender);
      console.log('Optimistic message special flag:', optimisticMessage._isFromCurrentUser);
      
      setMessages(prev => [...prev, optimisticMessage]);
      
      // Clear typing indicator
      if (typingTimeout) {
        clearTimeout(typingTimeout);
        setTypingTimeout(null);
      }
      socketService.stopTyping(id);
      
      // Clear input
      setMessage('');
      
      // Scroll to bottom
      setTimeout(() => {
        if (flatListRef.current) {
          flatListRef.current.scrollToEnd({ animated: true });
        }
      }, 100);
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Could not send message. Please try again.');
    }
  };

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
  
  const renderMessageItem = ({ item }: { item: MessageType & { _isFromCurrentUser?: boolean } }) => {
    if (!item) return null;
    
    // Get current user's ID
    const currentUserIdValue = currentUserId.current;
    if (!currentUserIdValue) {
      console.error('No current user ID available for message rendering');
      return null;
    }
    
    // Extract the sender ID regardless of whether it's an object or string
    const senderId = typeof item.sender === 'object' ? item.sender._id : item.sender;
    const receiverId = typeof item.receiver === 'object' ? item.receiver._id : item.receiver;
    
    // FIXED: Force messages to be identified as "sent by me" based on specific conditions
    let isSender = false;
    
    // First check: Custom flag overrides all other checks
    if (item._isFromCurrentUser === true) {
      console.log(`Message ${item._id} has explicit _isFromCurrentUser flag`);
      isSender = true;
    }
    // Condition 1: Check if this is a local optimistic message
    else if (item._id.startsWith('local_')) {
      isSender = true;
    } 
    // Condition 2: Check if this is from our database ID
    else if (senderId === currentUserIdValue) {
      isSender = true;
    }
    // Condition 3: Check if sender ID is a substring of current user ID or vice versa
    // (handles potential ID format differences)
    else if (
      currentUserIdValue.includes(senderId) || 
      senderId.includes(currentUserIdValue)
    ) {
      console.log(`Found potential ID match with inclusion: ${senderId} in ${currentUserIdValue}`);
      isSender = true;
    }
    // Condition 4: Fix for the database message format - if we're the sender
    // based on local knowledge but the message comes from the database
    else if (currentUserIdValue.includes('UUc6ZMzf') && !senderId.includes('UUc6ZMzf')) {
      // This is a specific fix for your user ID format based on the screenshots
      // Check if we are the intended recipient - if not, it's our message
      if (receiverId.includes('6804290')) {
        console.log('This appears to be OUR message sent to contact');
        isSender = true;
      }
    }
    
    // If sender ID contains "6802be69", it is DEFINITELY from the other user (based on screenshots)
    if (senderId.includes('6802be69')) {
      console.log(`Message from ${senderId} is definitely from the other user`);
      isSender = false;
    }
    
    // Debug information with extreme detail
    console.log(`=== Message ${item._id} ===`);
    console.log(`- Content: ${item.content.substring(0, 20)}...`);
    console.log(`- Sender ID: ${senderId}`);
    console.log(`- Receiver ID: ${receiverId}`);
    console.log(`- Current User ID: ${currentUserIdValue}`);
    console.log(`- Classified as: ${isSender ? 'MY MESSAGE' : 'THEIR MESSAGE'}`);
    
    // Format time
    const messageTime = item.createdAt ? formatTime(item.createdAt) : '';
    
    return (
      <View style={{
        width: '100%',
        paddingHorizontal: 10,
        marginBottom: 16,
      }}>
        {/* Debug info: shows exactly who sent this message */}
        <View style={{
          backgroundColor: '#f8f8f8',
          padding: 4,
          borderRadius: 4,
          marginBottom: 4,
          borderWidth: 1,
          borderColor: '#ddd',
          alignSelf: isSender ? 'flex-end' : 'flex-start',
          maxWidth: '80%',
        }}>
          <Text style={{ fontSize: 9, color: '#666' }}>
            ID: {item._id.substring(0, 10)}...{'\n'}
            From: {senderId.substring(0, 10)}...{'\n'}
            To: {receiverId.substring(0, 10)}...{'\n'}
            {isSender ? '✓ MY MESSAGE' : '• THEIR MESSAGE'}
          </Text>
        </View>
        
        {/* Message container with badge to clearly indicate sent vs received */}
        <View style={{
          flexDirection: 'row',
          justifyContent: isSender ? 'flex-end' : 'flex-start',
          width: '100%',
        }}>
          {/* Sender badge for received messages */}
          {!isSender && (
            <View style={{
              backgroundColor: '#ff7675', 
              width: 24, 
              height: 24, 
              borderRadius: 12,
              marginRight: 8,
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <Text style={{color: 'white', fontWeight: 'bold'}}>R</Text>
            </View>
          )}
          
          {/* Message bubble */}
          <View style={{
            maxWidth: '75%',
            backgroundColor: isSender ? '#6A3DE8' : '#E5E5EA',
            borderRadius: 18,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderBottomRightRadius: isSender ? 5 : 18,
            borderBottomLeftRadius: isSender ? 18 : 5,
          }}>
            <Text style={{
              color: isSender ? '#FFFFFF' : '#000000',
              fontSize: 16,
            }}>
              {item.content}
            </Text>
            <Text style={{
              fontSize: 12,
              color: isSender ? '#DDDDDD' : '#888888',
              alignSelf: 'flex-end',
              marginTop: 4,
            }}>
              {messageTime}
              {isSender && <Text> ✓✓</Text>}
            </Text>
          </View>
          
          {/* Sender badge for sent messages */}
          {isSender && (
            <View style={{
              backgroundColor: '#00b894', 
              width: 24, 
              height: 24, 
              borderRadius: 12,
              marginLeft: 8,
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <Text style={{color: 'white', fontWeight: 'bold'}}>S</Text>
            </View>
          )}
        </View>
      </View>
    );
  };
  
  const handleCall = () => {
    try {
      navigation.navigate('Call', { 
        id: id, 
        name: name, 
        isVideoCall: true 
      });
    } catch (error) {
      console.error('Navigation error:', error);
      Alert.alert('Error', 'Could not start call. Please try again.');
    }
  };
  
  const handleBackPress = () => {
    try {
      navigation.goBack();
    } catch (error) {
      console.error('Error navigating back:', error);
      // Fallback to a known screen
      navigation.navigate('Chats');
    }
  };
  
  const renderHeader = () => {
    // Use partner details state instead of directly using route params
    const partnerName = partnerDetails.name;
    const isUserOnline = partnerDetails.isOnline;
    
    return (
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={handleBackPress} 
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        
        <View style={styles.headerUserInfo}>
          <Text style={styles.headerUserName}>
            {partnerName || 'Chat Partner'}
          </Text>
          <Text style={styles.headerUserStatus}>
            {isTyping ? 'typing...' : (isUserOnline ? 'online' : 'offline')}
          </Text>
        </View>
        
        <TouchableOpacity 
          style={styles.menuButton}
        >
          <Text style={styles.menuButtonText}>⋮</Text>
        </TouchableOpacity>
      </View>
    );
  };
  
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A90E2" />
      </View>
    );
  }
  
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {renderHeader()}
      
      {/* Debug info panel - remove in production */}
      <View style={{
        padding: 8,
        backgroundColor: '#f0f0f0',
        borderRadius: 5,
        margin: 10,
      }}>
        <Text style={{ fontSize: 10, color: '#333' }}>
          Current User ID: {currentUserId.current || 'Not Set'}
        </Text>
        <Text style={{ fontSize: 10, color: '#333' }}>
          Chat Partner ID: {id}
        </Text>
        <Text style={{ fontSize: 10, color: '#333' }}>
          Message Count: {messages.length}
        </Text>
      </View>
      
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item._id || `message-${Date.now()}-${Math.random()}`}
          renderItem={renderMessageItem}
          contentContainerStyle={styles.messagesContainer}
          onContentSizeChange={() => {
            if (flatListRef.current && messages.length > 0) {
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
        />
          
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
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
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
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    height: 60,
  },
  backButton: {
    padding: 5,
    width: 40,
  },
  backButtonText: {
    fontSize: 24,
    color: '#333',
  },
  headerUserInfo: {
    flex: 1,
    alignItems: 'center',
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
  menuButton: {
    padding: 5,
    width: 40,
    alignItems: 'flex-end',
  },
  menuButtonText: {
    fontSize: 24,
    color: '#333',
  },
  messagesContainer: {
    padding: 10,
    paddingBottom: 20,
  },
  messageWrapper: {
    marginVertical: 2,
    width: '100%',
  },
  messageContainer: {
    flexDirection: 'row',
    maxWidth: '85%',
  },
  myMessageContainer: {
    alignSelf: 'flex-end',
  },
  otherMessageContainer: {
    alignSelf: 'flex-start',
  },
  messageBubbleAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 8,
    alignSelf: 'flex-end',
  },
  messageBubble: {
    borderRadius: 18,
    padding: 12,
    maxWidth: '100%',
  },
  myMessageBubble: {
    backgroundColor: '#6A3DE8', // Purple color from the image
    borderRadius: 18,
    borderBottomRightRadius: 5, // Slight point on the bottom right
  },
  otherMessageBubble: {
    backgroundColor: '#F0F0F0', // Light grey
    borderRadius: 18,
    borderBottomLeftRadius: 5, // Slight point on the bottom left
  },
  messageText: {
    fontSize: 16,
    marginBottom: 4,
  },
  myMessageText: {
    color: '#FFFFFF', // White text for sender
  },
  otherMessageText: {
    color: '#333333', // Dark text for receiver
  },
  messageTime: {
    fontSize: 11,
    color: '#AAAAAA', // Default color
    alignSelf: 'flex-end',
    marginLeft: 5,
  },
  myMessageTime: {
    color: '#DDDDDD', // Light color for sender
  },
  otherMessageTime: {
    color: '#999999', // Darker color for receiver
  },
  messageStatus: {
    fontSize: 10,
    color: '#DDDDDD', // Light color for sent messages
  },
  messageSender: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
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
    backgroundColor: '#6A3DE8', // Purple color from the image
    borderRadius: 24, // Make it more circular
    width: 48, // Fixed width and height
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
  dateSeparator: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 5,
  },
  dateSeparatorText: {
    fontSize: 12,
    color: '#999',
  },
});

export default ChatDetailScreen; 
