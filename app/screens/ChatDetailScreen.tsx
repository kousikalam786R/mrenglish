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
  SafeAreaView,
  Alert,
  InteractionManager,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ChatDetailRouteProp } from '../navigation/types';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { safeParam } from '../utils/safeProps';

interface Message {
  id: string;
  text: string;
  sender: 'me' | 'other';
  timestamp: Date;
  read: boolean;
  type: 'text' | 'voice' | 'image';
  duration?: number; // For voice messages
}

// Mock message data
const MESSAGES: Message[] = [
  {
    id: '1',
    text: 'Hi there! How are you today?',
    sender: 'other',
    timestamp: new Date(Date.now() - 3600000 * 5), // 5 hours ago
    read: true,
    type: 'text',
  },
  {
    id: '2',
    text: 'I\'m good, thanks for asking! How about you?',
    sender: 'me',
    timestamp: new Date(Date.now() - 3600000 * 4.8), // 4.8 hours ago
    read: true,
    type: 'text',
  },
  {
    id: '3',
    text: 'Doing great! Would you like to practice English later today?',
    sender: 'other',
    timestamp: new Date(Date.now() - 3600000 * 4.5), // 4.5 hours ago
    read: true,
    type: 'text',
  },
  {
    id: '4',
    text: 'Sure! What time works for you?',
    sender: 'me',
    timestamp: new Date(Date.now() - 3600000 * 4), // 4 hours ago
    read: true,
    type: 'text',
  },
  {
    id: '5',
    text: 'How about 5pm your time?',
    sender: 'other',
    timestamp: new Date(Date.now() - 3600000 * 3.5), // 3.5 hours ago
    read: true,
    type: 'text',
  },
  {
    id: '6',
    text: 'That works for me! What topics would you like to discuss?',
    sender: 'me',
    timestamp: new Date(Date.now() - 3600000 * 3), // 3 hours ago
    read: true,
    type: 'text',
  },
  {
    id: '7',
    text: 'I\'d love to practice discussing technology and travel.',
    sender: 'other',
    timestamp: new Date(Date.now() - 3600000 * 2.5), // 2.5 hours ago
    read: true,
    type: 'text',
  },
  {
    id: '8',
    text: 'Perfect! I just got back from a trip, so I have a lot to share about travel.',
    sender: 'me',
    timestamp: new Date(Date.now() - 3600000 * 2), // 2 hours ago
    read: true,
    type: 'text',
  },
  {
    id: '9',
    text: 'Great! Looking forward to our call!',
    sender: 'other',
    timestamp: new Date(Date.now() - 3600000 * 1), // 1 hour ago
    read: true,
    type: 'text',
  },
  {
    id: '10',
    text: 'Voice message',
    sender: 'me',
    timestamp: new Date(Date.now() - 1800000), // 30 minutes ago
    read: true,
    type: 'voice',
    duration: 35, // 35 seconds
  },
];

const ChatDetailScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<ChatDetailRouteProp>();
  
  // Safely extract parameters with defaults to prevent null reference errors
  const id = safeParam(route, 'id', '0');
  const name = safeParam(route, 'name', 'User');
  const avatar = "https://randomuser.me/api/portraits/men/32.jpg"; // Default avatar
  
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>(MESSAGES);
  const [isReady, setIsReady] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Wait for animations to complete before rendering content
  useEffect(() => {
    const timer = InteractionManager.runAfterInteractions(() => {
      setIsReady(true);
    });
    
    return () => timer.cancel();
  }, []);

  useEffect(() => {
    // Add a warning if required parameters are missing
    if (!route.params?.id || !route.params?.name) {
      console.warn('ChatDetailScreen: Missing required parameters');
    }
  }, [route.params]);
  
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  const handleSend = () => {
    if (message.trim().length === 0) return;
    
    const newMessage: Message = {
      id: (messages.length + 1).toString(),
      text: message,
      sender: 'me',
      timestamp: new Date(),
      read: false,
      type: 'text',
    };
    
    setMessages([...messages, newMessage]);
    setMessage('');
    
    // Scroll to the bottom
    setTimeout(() => {
      if (flatListRef.current) {
        flatListRef.current.scrollToEnd({ animated: true });
      }
    }, 200);
  };
  
  const renderMessageItem = ({ item }: { item: Message }) => {
    const isMe = item.sender === 'me';
    const isVoice = item.type === 'voice';
    
    return (
      <View style={[styles.messageContainer, isMe ? styles.myMessageContainer : styles.otherMessageContainer]}>
        {!isMe && (
          <Image source={{ uri: avatar }} style={styles.messageBubbleAvatar} />
        )}
        
        <View style={[styles.messageBubble, isMe ? styles.myMessageBubble : styles.otherMessageBubble]}>
          {isVoice ? (
            <View style={styles.voiceMessageContent}>
              <View style={styles.voiceIcon}>
                <Text>🎤</Text>
              </View>
              <View style={styles.voiceInfo}>
                <View style={styles.voiceWaveform}>
                  {[...Array(10)].map((_, index) => (
                    <View 
                      key={index} 
                      style={[
                        styles.voiceBar, 
                        { height: Math.random() * 12 + 4 }
                      ]} 
                    />
                  ))}
                </View>
                <Text style={styles.voiceDuration}>{item.duration}s</Text>
              </View>
            </View>
          ) : (
            <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.otherMessageText]}>
              {item.text}
            </Text>
          )}
          <Text style={styles.messageTime}>{formatTime(item.timestamp)}</Text>
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
          onPress={() => {
            // Navigate to user profile or something
          }}
        >
          <Image 
            source={{ uri: avatar }} 
            style={styles.avatar}
            onError={() => console.warn('Failed to load avatar')}
          />
          <View>
            <Text style={styles.userName}>{name}</Text>
            <Text style={styles.userStatus}>Online</Text>
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.callButton}
          onPress={handleCall}
        >
          <Text style={styles.callButtonText}>Call</Text>
        </TouchableOpacity>
      </View>
    );
  };
  
  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardAvoidingView}
        keyboardVerticalOffset={100}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessageItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          onLayout={() => {
            flatListRef.current?.scrollToEnd({ animated: false });
          }}
        />
        
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            value={message}
            onChangeText={setMessage}
            multiline
          />
          <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
            <Text style={styles.sendButtonText}>Send</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    backgroundColor: 'white',
  },
  backButton: {
    padding: 5,
  },
  backButtonText: {
    fontSize: 24,
    color: '#4A90E2',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  userStatus: {
    fontSize: 12,
    color: '#4CAF50',
  },
  callButton: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  callButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  messagesList: {
    padding: 10,
  },
  messageContainer: {
    marginBottom: 15,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  myMessageContainer: {
    justifyContent: 'flex-end',
  },
  otherMessageContainer: {
    justifyContent: 'flex-start',
  },
  messageBubbleAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 5,
  },
  messageBubble: {
    maxWidth: '75%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
  },
  myMessageBubble: {
    backgroundColor: '#DCF8C6',
    borderBottomRightRadius: 5,
  },
  otherMessageBubble: {
    backgroundColor: 'white',
    borderBottomLeftRadius: 5,
  },
  messageText: {
    fontSize: 16,
    marginBottom: 5,
  },
  myMessageText: {
    color: '#000',
  },
  otherMessageText: {
    color: '#000',
  },
  messageTime: {
    fontSize: 11,
    color: '#999',
    alignSelf: 'flex-end',
  },
  voiceMessageContent: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 150,
  },
  voiceIcon: {
    marginRight: 10,
  },
  voiceInfo: {
    flex: 1,
  },
  voiceWaveform: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 20,
    marginBottom: 5,
  },
  voiceBar: {
    width: 3,
    backgroundColor: '#666',
    borderRadius: 3,
    marginHorizontal: 1,
  },
  voiceDuration: {
    fontSize: 12,
    color: '#666',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    backgroundColor: 'white',
  },
  input: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    maxHeight: 100,
  },
  sendButton: {
    marginLeft: 10,
    backgroundColor: '#4A90E2',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
  },
  sendButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
});

export default ChatDetailScreen; 