import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StatusBar,
  Animated,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAppDispatch, useAppSelector } from '../redux/hooks';
import { sendAIMessage, fetchConversation } from '../redux/thunks/aiThunks';
import { RootStackParamList } from '../navigation/types';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

// Define types for the chat interface
interface MessageProps {
  message: string;
  isAI: boolean;
}

interface MessageData {
  id: string;
  text: string;
  isAI: boolean;
}

// Define the AI conversation message structure
interface AIMessage {
  role: string;
  content: string;
  timestamp: string | Date;
}

// Define the AI conversation structure
interface AIConversation {
  _id: string;
  messages: AIMessage[];
}

// Define AI state in Redux
interface AIState {
  currentConversation: AIConversation | null;
  isTyping: boolean;
  loading: boolean;
  error: string | null;
}

// Message component to display individual chat messages
const MessageBubble: React.FC<MessageProps> = ({ message, isAI }) => {
  return (
    <View style={[
      styles.messageBubble,
      isAI ? styles.aiMessage : styles.userMessage
    ]}>
      <Text style={[
        styles.messageText,
        isAI ? styles.aiMessageText : styles.userMessageText
      ]}>
        {message}
      </Text>
    </View>
  );
};

// Typing indicator component
const TypingIndicator: React.FC = () => {
  return (
    <View style={[styles.messageBubble, styles.aiMessage, styles.typingIndicator]}>
      <View style={styles.typingDots}>
        <View style={styles.dot} />
        <View style={styles.dot} />
        <View style={styles.dot} />
      </View>
    </View>
  );
};

const AIChatScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'AIChat'>>();
  const [message, setMessage] = useState('');
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [topic, setTopic] = useState(route.params?.topic || 'general');
  const [level, setLevel] = useState(route.params?.level || 'intermediate');
  const insets = useSafeAreaInsets();
  
  // Get AI state from Redux
  const { currentConversation, isTyping, loading, error } = useAppSelector(
    (state) => state.ai as AIState
  );
  
  // Ref for flat list to scroll to bottom on new messages
  const flatListRef = useRef<FlatList>(null);
  
  // If we have a conversationId in params, fetch that conversation
  useEffect(() => {
    if (route.params?.conversationId) {
      setConversationId(route.params.conversationId);
      dispatch(fetchConversation(route.params.conversationId) as any);
    }
  }, [route.params?.conversationId, dispatch]);
  
  // Handler for sending messages
  const handleSend = async () => {
    if (!message.trim()) return;
    
    // Options for the AI based on the current topic and level
    const options = {
      topic,
      languageLevel: level
    };
    
    // Dispatch the send message action
    dispatch(sendAIMessage({
      message: message.trim(),
      conversationId,
      options
    }) as any);
    
    // Clear the input
    setMessage('');
  };
  
  // Prepare message data for the FlatList
  const getMessageData = (): MessageData[] => {
    if (!currentConversation) {
      // If no conversation yet, show an initial prompt
      return [
        {
          id: 'initial-message',
          text: `Hello! I'm RAHA AI, your English language practice partner. How can I help you today?`,
          isAI: true
        }
      ];
    }
    
    // Map conversation messages to the format needed for the FlatList
    return currentConversation.messages
      .filter((msg: AIMessage) => msg.role !== 'system') // Don't show system messages
      .map((msg: AIMessage, index: number) => ({
        id: `${index}-${msg.timestamp}`,
        text: msg.content,
        isAI: msg.role === 'assistant'
      }));
  };
  
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Chat with RAHA AI</Text>
        
        <TouchableOpacity style={styles.settingsButton}>
          <Icon name="settings-outline" size={24} color="#333" />
        </TouchableOpacity>
      </View>
      
      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={getMessageData()}
        keyExtractor={item => item.id}
        style={styles.messageList}
        contentContainerStyle={[
          styles.messageListContent,
          { paddingBottom: insets.bottom > 0 ? insets.bottom : 16 }
        ]}
        renderItem={({ item }) => (
          <MessageBubble message={item.text} isAI={item.isAI} />
        )}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        ListFooterComponent={() => isTyping ? <TypingIndicator /> : null}
      />
      
      {/* Input area */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        style={[
          styles.inputContainer,
          { paddingBottom: insets.bottom > 0 ? insets.bottom : 8 }
        ]}
      >
        <TextInput
          style={styles.input}
          placeholder="Type your message..."
          value={message}
          onChangeText={setMessage}
          multiline
          maxLength={500}
        />
        
        <TouchableOpacity 
          style={[
            styles.sendButton,
            (!message.trim() || loading) && styles.disabledButton
          ]}
          onPress={handleSend}
          disabled={!message.trim() || loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <Icon name="send" size={20} color="#FFF" />
          )}
        </TouchableOpacity>
      </KeyboardAvoidingView>
      
      {/* Error message if any */}
      {error && (
        <View style={[styles.errorContainer, { marginBottom: insets.bottom > 0 ? insets.bottom : 16 }]}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  settingsButton: {
    padding: 8,
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#4A90E2',
    borderTopRightRadius: 0,
  },
  aiMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#E5E5EA',
    borderTopLeftRadius: 0,
  },
  messageText: {
    fontSize: 16,
  },
  userMessageText: {
    color: '#FFFFFF',
  },
  aiMessageText: {
    color: '#333333',
  },
  typingIndicator: {
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  typingDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#999',
    marginHorizontal: 3,
    opacity: 0.7,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  input: {
    flex: 1,
    backgroundColor: '#F0F0F0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 100,
    fontSize: 16,
  },
  sendButton: {
    marginLeft: 8,
    backgroundColor: '#4A90E2',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#B0C4DE',
  },
  errorContainer: {
    backgroundColor: '#FFD2D2',
    padding: 8,
    margin: 16,
    borderRadius: 8,
  },
  errorText: {
    color: '#D8000C',
    textAlign: 'center',
  },
});

export default AIChatScreen; 