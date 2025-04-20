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
import { useNavigation, useRoute } from '@react-navigation/native';
import { ChatDetailRouteProp } from '../navigation/types';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { safeParam } from '../utils/safeProps';
import { getMessages } from '../utils/messageService';
import { Message as MessageType, User } from '../types/Message';
import socketService from '../utils/socketService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isValidObjectId } from '../utils/validationUtils';

const ChatDetailScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<ChatDetailRouteProp>();
  
  // Safely extract parameters with defaults to prevent null reference errors
  const id = safeParam(route, 'id', '0');
  const name = safeParam(route, 'name', 'User');
  const avatar = route.params?.user?.profilePic || "https://randomuser.me/api/portraits/men/32.jpg";
  
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null);
  const [usingDummyData, setUsingDummyData] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const currentUserId = useRef<string | null>(null);

  // Fetch user ID once on component mount
  useEffect(() => {
    const getUserId = async () => {
      try {
        // Get the userId from AsyncStorage
        const userId = await AsyncStorage.getItem('userId');
        console.log('Current user ID:', userId);
        currentUserId.current = userId;
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
        
        // Check if this is a dummy chat (id starts with "dummy")
        if (id.startsWith('dummy')) {
          console.log('Using dummy messages for', id);
          setMessages(generateDummyMessages(id));
          setUsingDummyData(true);
        } 
        // Check if ID is valid (MongoDB ObjectIDs are 24 characters)
        else if (id === '0' || !isValidObjectId(id)) {
          console.log('Non-standard ID format:', id, 'Treating as new conversation');
          setMessages([]);
          setUsingDummyData(false);
          
          // Don't show alert, just start with an empty conversation
          // This allows new conversations with users regardless of ID format
        } else {
          // Fetch real messages
          console.log('Fetching real messages for user ID:', id);
          try {
            const fetchedMessages = await getMessages(id);
            if (fetchedMessages && fetchedMessages.length > 0) {
              console.log('Received real messages:', fetchedMessages.length);
              setMessages(fetchedMessages);
              setUsingDummyData(false);
            } else {
              console.log('No real messages found for this conversation');
              setMessages([]);
              setUsingDummyData(false);
            }
          } catch (error: any) {
            console.error('Error fetching real messages:', error);
            // Only show alert for serious errors, not ID validation errors
            if (!error.message.includes('Invalid ID format')) {
              Alert.alert(
                'Error Loading Messages',
                `Could not load messages: ${error.message || 'Unknown error'}. Using empty conversation.`,
                [{ text: 'OK' }]
              );
            }
            // If error fetching real messages, fallback to empty array
            setMessages([]);
            setUsingDummyData(false);
          }
        }
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, [id]);

  // Generate dummy messages for testing
  const generateDummyMessages = (chatId: string) => {
    const currentTime = new Date();
    const userId = currentUserId.current || 'currentUser';
    
    // Get chat name based on dummy ID
    let chatName = name;
    if (chatId === 'dummy1') chatName = 'John Doe';
    if (chatId === 'dummy2') chatName = 'Jane Smith';
    if (chatId === 'dummy3') chatName = 'Alex Johnson';
    
    const dummyMessages: MessageType[] = [
      {
        _id: `${chatId}_msg1`,
        content: `Hi there! I'm ${chatName}.`,
        sender: {
          _id: chatId,
          name: chatName,
          email: `${chatName.toLowerCase().replace(' ', '.')}@example.com`
        },
        receiver: userId,
        createdAt: new Date(currentTime.getTime() - 1000 * 60 * 60).toISOString(), // 1 hour ago
        read: true
      },
      {
        _id: `${chatId}_msg2`,
        content: `Hello ${chatName}, nice to meet you!`,
        sender: userId,
        receiver: chatId,
        createdAt: new Date(currentTime.getTime() - 1000 * 60 * 55).toISOString(), // 55 minutes ago
        read: true
      },
      {
        _id: `${chatId}_msg3`,
        content: `What brings you here today?`,
        sender: {
          _id: chatId,
          name: chatName,
          email: `${chatName.toLowerCase().replace(' ', '.')}@example.com`
        },
        receiver: userId,
        createdAt: new Date(currentTime.getTime() - 1000 * 60 * 50).toISOString(), // 50 minutes ago
        read: true
      },
      {
        _id: `${chatId}_msg4`,
        content: `I'm testing this chat app to see how it works`,
        sender: userId,
        receiver: chatId,
        createdAt: new Date(currentTime.getTime() - 1000 * 60 * 45).toISOString(), // 45 minutes ago
        read: true
      },
      {
        _id: `${chatId}_msg5`,
        content: `Great! The interface is really clean and simple to use.`,
        sender: {
          _id: chatId,
          name: chatName,
          email: `${chatName.toLowerCase().replace(' ', '.')}@example.com`
        },
        receiver: userId,
        createdAt: new Date(currentTime.getTime() - 1000 * 60 * 30).toISOString(), // 30 minutes ago
        read: true
      },
      {
        _id: `${chatId}_msg6`,
        content: `Thanks! I think so too.`,
        sender: userId,
        receiver: chatId,
        createdAt: new Date(currentTime.getTime() - 1000 * 60 * 25).toISOString(), // 25 minutes ago
        read: true
      },
      {
        _id: `${chatId}_msg7`,
        content: `Do you want to see more features?`,
        sender: {
          _id: chatId,
          name: chatName,
          email: `${chatName.toLowerCase().replace(' ', '.')}@example.com`
        },
        receiver: userId,
        createdAt: new Date(currentTime.getTime() - 1000 * 60 * 10).toISOString(), // 10 minutes ago
        read: true
      }
    ];
    
    return dummyMessages;
  };

  // Set up socket event listeners
  useEffect(() => {
    // Listen for new messages
    socketService.onNewMessage((data) => {
      // Only update if the message is from the current chat partner
      console.log('New message received:', data);
      
      if (data && data.message && data.from) {
        const senderId = typeof data.from === 'object' ? data.from._id : data.from;
        
        if (senderId === id || (data.message && data.message.sender === id)) {
          console.log('Adding new message to chat');
          
          // Format the message if needed
          const newMessage = data.message;
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
      if (usingDummyData) {
        // Simulated message for dummy chats
        const dummyMessage: MessageType = {
          _id: `local_${Date.now()}`,
          content: message.trim(),
          sender: currentUserId.current || 'currentUser',
          receiver: id,
          createdAt: new Date().toISOString(),
          read: true
        };
        
        setMessages(prev => [...prev, dummyMessage]);
        
        // Simulate a reply from the dummy user after a delay
        setTimeout(() => {
          const safeName = name || 'User';
          const safeEmail = `${safeName.toLowerCase().replace(' ', '.')}@example.com`;
          
          const dummyReply: MessageType = {
            _id: `dummy_${Date.now()}`,
            content: `This is a simulated reply to: "${message.trim()}"`,
            sender: {
              _id: id,
              name: safeName,
              email: safeEmail
            },
            receiver: currentUserId.current || 'currentUser',
            createdAt: new Date().toISOString(),
            read: false
          };
          
          setMessages(prev => [...prev, dummyReply]);
        }, 1000 + Math.random() * 2000); // Random delay between 1-3 seconds
      } else {
        // Send real message via socket
        console.log('Sending real message to:', id);
        socketService.sendPrivateMessage(id, message.trim());
        
        // Optimistically add the message to the UI
        const optimisticMessage: MessageType = {
          _id: `local_${Date.now()}`,
          content: message.trim(),
          sender: currentUserId.current || 'currentUser',
          receiver: id,
          createdAt: new Date().toISOString(),
          read: false
        };
        
        setMessages(prev => [...prev, optimisticMessage]);
      }
      
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
  
  const renderMessageItem = ({ item }: { item: MessageType }) => {
    if (!item) return null;
    
    const isMe = typeof item.sender === 'object' 
      ? item.sender?._id === currentUserId.current
      : item.sender === currentUserId.current;
    
    return (
      <View style={[styles.messageContainer, isMe ? styles.myMessageContainer : styles.otherMessageContainer]}>
        {!isMe && (
          <Image 
            source={{ uri: avatar }} 
            style={styles.messageBubbleAvatar} 
          />
        )}
        
        <View style={[styles.messageBubble, isMe ? styles.myMessageBubble : styles.otherMessageBubble]}>
          <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.otherMessageText]}>
            {item.content || ''}
          </Text>
          <Text style={styles.messageTime}>{item.createdAt ? formatTime(item.createdAt) : ''}</Text>
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
    const isUserOnline = route.params?.user?.isOnline || false;
    
    return (
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={handleBackPress} 
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.userInfo}
          onPress={() => {}}
        >
          <View style={styles.userInfoContainer}>
            <Image source={{ uri: avatar }} style={styles.avatar} />
            <View style={styles.userTextInfo}>
              <Text style={styles.userName}>{name}</Text>
              {isTyping ? (
                <Text style={styles.typingIndicator}>Typing...</Text>
              ) : (
                <Text style={styles.userStatus}>
                  {isUserOnline ? 'Online' : 'Offline'}
                </Text>
              )}
            </View>
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity 
          onPress={handleCall}
          style={styles.callButton}
        >
          <Text style={styles.callButtonText}>📞</Text>
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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      {renderHeader()}
      
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
          placeholder="Type a message..."
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
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    height: 60,
  },
  backButton: {
    padding: 5,
  },
  backButtonText: {
    fontSize: 24,
    color: '#4A90E2',
  },
  userInfo: {
    flex: 1,
    marginHorizontal: 10,
  },
  userInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  userTextInfo: {
    marginLeft: 10,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  userStatus: {
    fontSize: 12,
    color: '#999',
  },
  typingIndicator: {
    fontSize: 12,
    color: '#4A90E2',
    fontStyle: 'italic',
  },
  callButton: {
    padding: 5,
  },
  callButtonText: {
    fontSize: 20,
  },
  messagesContainer: {
    padding: 10,
    paddingBottom: 20,
  },
  messageContainer: {
    flexDirection: 'row',
    marginVertical: 5,
    maxWidth: '80%',
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
    backgroundColor: '#DCF8C6',
  },
  otherMessageBubble: {
    backgroundColor: '#FFF',
  },
  messageText: {
    fontSize: 16,
  },
  myMessageText: {
    color: '#000',
  },
  otherMessageText: {
    color: '#333',
  },
  messageTime: {
    fontSize: 10,
    color: '#999',
    alignSelf: 'flex-end',
    marginTop: 5,
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
    paddingVertical: 8,
    maxHeight: 120,
    fontSize: 16,
  },
  sendButton: {
    marginLeft: 10,
    backgroundColor: '#4A90E2',
    borderRadius: 20,
    padding: 10,
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
});

export default ChatDetailScreen; 
