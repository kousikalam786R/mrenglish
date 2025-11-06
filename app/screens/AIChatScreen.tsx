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
  Image,
  PermissionsAndroid,
  Alert,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAppDispatch, useAppSelector } from '../redux/hooks';
import { sendAIMessage, fetchConversation } from '../redux/thunks/aiThunks';
import { RootStackParamList } from '../navigation/types';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';

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

// Define message type for voice chat
interface VoiceChatMessage {
  id: number;
  text: string;
  translation: string;
  isUser: boolean;
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
const MessageBubble: React.FC<MessageProps & { theme: any }> = ({ message, isAI, theme }) => {
  return (
    <View style={[
      styles.messageBubble,
      isAI ? { backgroundColor: theme.card } : { backgroundColor: theme.primary },
      isAI ? styles.aiMessage : styles.userMessage
    ]}>
      <Text style={[
        styles.messageText,
        isAI ? { color: theme.text } : { color: '#FFFFFF' }
      ]}>
        {message}
      </Text>
    </View>
  );
};

// Typing indicator component
const TypingIndicator: React.FC<{ theme: any }> = ({ theme }) => {
  return (
    <View style={[styles.messageBubble, { backgroundColor: theme.card }, styles.typingIndicator]}>
      <View style={styles.typingDots}>
        <View style={[styles.dot, { backgroundColor: theme.textSecondary }]} />
        <View style={[styles.dot, { backgroundColor: theme.textSecondary }]} />
        <View style={[styles.dot, { backgroundColor: theme.textSecondary }]} />
      </View>
    </View>
  );
};

const AIChatScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'AIChat'>>();
  const { theme, isDark } = useTheme();
  const [message, setMessage] = useState('');
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [topic, setTopic] = useState(route.params?.topic || 'general');
  const [level, setLevel] = useState(route.params?.level || 'intermediate');
  const isVoiceChat = route.params?.isVoiceChat || false;
  const insets = useSafeAreaInsets();
  const [isPaused, setIsPaused] = useState(false);
  
  // Replace real Voice implementation with simulation
  const [isListening, setIsListening] = useState(false);
  const [hasCorrectResponse, setHasCorrectResponse] = useState(false);
  const [recordingTimeout, setRecordingTimeout] = useState<NodeJS.Timeout | null>(null);
  
  // Additional state for voice chat mode
  const [voiceChatMessages, setVoiceChatMessages] = useState<VoiceChatMessage[]>([
    {
      id: 1,
      text: 'Hello Kousik! I\'m RAHA AI, your enthusiastic English teacher. I\'m excited to help you improve your vocabulary! Are you ready to learn some new words today?',
      translation: 'হ্যালো কৌসিক! আমি আর্য, আপনার উৎসাহী ইংরেজি শিক্ষক। আমি আপনাকে আপনার শব্দভাণ্ডার উন্নত করতে সাহায্য করতে আগ্রহী! আপনি কি আজ কিছু নতুন শব্দ শিখতে প্রস্তুত?',
      isUser: false
    }
  ]);

  // Replace real Voice setup that's causing errors
  // Replace with simulation
  const simulateVoiceRecognition = () => {
    setIsListening(true);
    
    // Sample responses to randomly choose from
    const sampleResponses = [
      "Hello teacher",
      "How do you say 'important' in English?",
      "I want to learn new vocabulary",
      "Thank you for helping me",
      "Can you explain this word to me?",
      "I practiced speaking yesterday",
      "What's the difference between 'affect' and 'effect'?",
    ];
    
    // Set a timeout to simulate processing time (2-3 seconds)
    const timeout = setTimeout(() => {
      // Pick a random response
      const response = sampleResponses[Math.floor(Math.random() * sampleResponses.length)];
      
      // Set the message and stop listening
      setMessage(response);
      setIsListening(false);
    }, 2000 + Math.random() * 1000);
    
    // Save timeout ID for cleanup
    setRecordingTimeout(timeout);
  };

  // Clean up function for simulated recording
  const stopSimulation = () => {
    if (recordingTimeout) {
      clearTimeout(recordingTimeout);
    }
    setIsListening(false);
  };

  // Replace real Voice handlers with simulation
  const startListening = () => {
    simulateVoiceRecognition();
  };

  const stopListening = () => {
    stopSimulation();
  };

  // Format topic title for display
  const formatTopicTitle = (topic?: string) => {
    if (!topic) return 'Talk about anything';
    return topic.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };
  
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
  
  // Add comments explaining how to set up Voice recognition properly in the future
  /* 
   * VOICE RECOGNITION SETUP INSTRUCTIONS:
   * To implement real voice recognition with @react-native-voice/voice, you need to:
   * 
   * 1. Install the package:
   *    npm install --save @react-native-voice/voice
   * 
   * 2. For Android, add the following to android/app/src/main/AndroidManifest.xml:
   *    <uses-permission android:name="android.permission.RECORD_AUDIO" />
   * 
   * 3. For iOS, add the following to Info.plist:
   *    <key>NSMicrophoneUsageDescription</key>
   *    <string>This app needs microphone access to record your voice</string>
   *    <key>NSSpeechRecognitionUsageDescription</key>
   *    <string>This app needs speech recognition to convert your voice to text</string>
   * 
   * 4. For iOS, also run:
   *    cd ios && pod install
   * 
   * 5. Restart your app completely after setup
   */

  // Modify handleSend to better support backend processing
  const handleSend = async (text?: string) => {
    const messageToSend = text || message;
    if (!messageToSend.trim()) return;
    
    if (isVoiceChat) {
      // Create new user message object
      const newUserMessage: VoiceChatMessage = {
        id: voiceChatMessages.length + 1,
        text: messageToSend,
        translation: '', // Empty translation for user messages
        isUser: true
      };
      
      // Add message to UI immediately
      setVoiceChatMessages([...voiceChatMessages, newUserMessage]);
      
      // Clear the input field
      setMessage('');
      
      // Generate a temporary "typing" indication while waiting for API
      const typingIndicator: VoiceChatMessage = {
        id: Date.now(), // Use timestamp as temporary ID
        text: "...", // Typing indicator
        translation: '',
        isUser: false
      };
      
      // Only show typing indicator if this is not the first message
      if (voiceChatMessages.length > 1) {
        setVoiceChatMessages(prev => [...prev, typingIndicator]);
      }
      
      // Options for the AI request
      const options = {
        topic,
        languageLevel: level,
        mode: 'voiceChat'
      };
      
      // Set a random "correct response" indicator for demo purposes
      // In a real app, this would come from the API
      setHasCorrectResponse(Math.random() > 0.3);
      
      try {
        // Send to backend API
        const response = await dispatch(sendAIMessage({
          message: messageToSend.trim(),
          conversationId,
          options
        }) as any);
        
        // Process the response from backend
        // This assumes your Redux action returns the API response
        console.log("Backend response:", response);
        
        // Remove the typing indicator and add the real response
        // In a real app, you would use the actual response from the API
        setTimeout(() => {
          setVoiceChatMessages(prev => {
            // Filter out the typing indicator
            const withoutTyping = prev.filter(msg => msg.id !== typingIndicator.id);
            
            // Create the AI response message
            const aiResponse: VoiceChatMessage = {
              id: Date.now(),
              text: "That's a great question! I'll help you improve your vocabulary. What specific topics are you interested in?",
              translation: "এটা একটি দুর্দান্ত প্রশ্ন! আমি আপনাকে আপনার শব্দভাণ্ডার উন্নত করতে সাহায্য করব। আপনি কোন নির্দিষ্ট বিষয়ে আগ্রহী?",
              isUser: false
            };
            
            // Return messages with the new AI response
            return [...withoutTyping, aiResponse];
          });
        }, 1500); // Simulate API delay
      } catch (error) {
        console.error("Error sending message to backend:", error);
        // Handle error - remove typing indicator
        setVoiceChatMessages(prev => prev.filter(msg => msg.id !== typingIndicator.id));
        
        // Show error message
        Alert.alert("Error", "Failed to get response from AI. Please try again.");
      }
      
      return;
    }
    
    // Text chat mode remains unchanged
    const options = {
      topic,
      languageLevel: level
    };
    
    // Dispatch the send message action
    dispatch(sendAIMessage({
      message: messageToSend.trim(),
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

  // Add animation state for mic button
  const micAnimation = useRef(new Animated.Value(1)).current;

  // Start animation when isListening changes
  useEffect(() => {
    if (isListening) {
      // Create pulsating animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(micAnimation, {
            toValue: 1.3,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(micAnimation, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      // Stop animation
      Animated.timing(micAnimation, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [isListening, micAnimation]);

  // Render the Voice Chat UI
  const renderVoiceChatUI = () => {
    return (
      <SafeAreaView style={[styles.voiceChatContainer, { backgroundColor: theme.surface, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={theme.background} />
        
        {/* Header */}
        <View style={[styles.voiceChatHeader, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Icon name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.voiceChatHeaderTitle, { color: theme.text }]}>{formatTopicTitle(topic)}</Text>
          <TouchableOpacity style={styles.settingsButton}>
            <Icon name="settings-outline" size={24} color={theme.text} />
          </TouchableOpacity>
        </View>
        
        {/* Progress Bar */}
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBar, { backgroundColor: theme.inputBackground }]}>
            <View style={[styles.progressFilled, { backgroundColor: theme.success }]} />
          </View>
          <TouchableOpacity style={[styles.feedbackButton, { backgroundColor: theme.inputBackground }]}>
            <Text style={[styles.feedbackText, { color: theme.textSecondary }]}>Feedback</Text>
            <Icon name="lock-closed" size={12} color={theme.warning} />
          </TouchableOpacity>
        </View>
        
        {/* Chat Messages */}
        <FlatList
          data={voiceChatMessages}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.voiceChatMessageList}
          renderItem={({ item, index }) => (
            <View style={styles.voiceChatMessageContainer}>
              {/* User Message */}
              {item.isUser && (
                <>
                  <View style={[styles.voiceChatMessageHeader, styles.userMessageHeader]}>
                    <Text style={[styles.messageSender, { color: theme.text }]}>
                      KOUSIK
                    </Text>
                    <Image 
                      source={{ uri: 'https://randomuser.me/api/portraits/men/32.jpg' }} 
                      style={styles.messageAvatar}
                    />
                  </View>
                  
                  <View style={[styles.voiceChatMessage, { backgroundColor: theme.primary }]}>
                    <Text style={[styles.voiceChatMessageText, { color: '#FFFFFF' }]}>{item.text}</Text>
                  </View>
                  
                  {/* Show "Well done" indicator if this message has a response */}
                  {hasCorrectResponse && index === voiceChatMessages.length - 2 && (
                    <View style={[styles.correctResponseContainer, { backgroundColor: theme.success + '20' }]}>
                      <Icon name="sunny" size={16} color={theme.warning} />
                      <Text style={[styles.correctResponseText, { color: theme.success }]}>Well done! Correct response</Text>
                    </View>
                  )}
                </>
              )}
              
              {/* AI Message */}
              {!item.isUser && (
                <>
                  <View style={[styles.voiceChatMessageHeader, styles.aiMessageHeader]}>
                    <Image 
                      source={{ uri: 'https://img.icons8.com/color/96/000000/robot.png' }} 
                      style={styles.messageAvatar}
                    />
                    <Text style={[styles.messageSender, { color: theme.text }]}>
                      RAHA AI Teacher
                    </Text>
                    <View style={styles.aiControls}>
                      <TouchableOpacity>
                        <Text style={[styles.translateText, { color: theme.primary }]}>ꜳ</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setIsPaused(!isPaused)}>
                        <Icon name={isPaused ? "play" : "pause"} size={20} color={theme.primary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  
                  <View style={[styles.voiceChatMessage, { backgroundColor: theme.card }]}>
                    <Text style={[styles.voiceChatMessageText, { color: theme.text }]}>{item.text}</Text>
                    {item.translation && (
                      <>
                        <View style={[styles.translationDivider, { backgroundColor: theme.border }]} />
                        <Text style={[styles.translationText, { color: theme.textSecondary }]}>{item.translation}</Text>
                      </>
                    )}
                  </View>
                </>
              )}
            </View>
          )}
        />
        
        {/* Pro Tip */}
        {/* <View style={styles.proTipContainer}>
          <Icon name="star" size={20} color="#FFC107" />
          <Text style={styles.proTipTitle}>PRO TIP</Text>
        </View>
        <Text style={styles.proTipText}>
          For the best experience, tap on mic and speak like you are talking to a real person. Reply with full sentences and you will be amazed to see how RAHA AI can talk like humans and help you.
        </Text> */}
        
        {/* Input area */}
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={[styles.voiceChatInputContainer, { backgroundColor: theme.card, borderTopColor: theme.border }]}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <View style={[styles.voiceChatInputWrapper, { backgroundColor: theme.inputBackground }]}>
            <TextInput
              style={[styles.voiceChatInput, { color: theme.text }]}
              placeholder={isListening ? "Listening..." : "Type your message.."}
              placeholderTextColor={isListening ? theme.primary : theme.textTertiary}
              value={message}
              onChangeText={setMessage}
            />
            <TouchableOpacity 
              style={styles.sendButtonWrapper} 
              onPress={message.trim() ? () => handleSend() : isListening ? stopListening : startListening}
            >
              <Animated.View 
                style={[
                  styles.sendIconButton, 
                  { backgroundColor: theme.primary },
                  !message.trim() ? styles.disabledSendButton : null,
                  isListening && !message.trim() ? [styles.recordingButton, { backgroundColor: theme.error }] : null,
                  {transform: [{ scale: message.trim() ? 1 : micAnimation }]}
                ]}
              >
                {message.trim() ? (
                  <Icon name="arrow-forward" size={20} color="#fff" />
                ) : (
                  <Icon name={isListening ? "stop-circle" : "mic"} size={20} color="#fff" />
                )}
              </Animated.View>
            </TouchableOpacity>
          </View>
          
          {/* Add recording instructions */}
          {isListening && !message.trim() && (
            <View style={[styles.recordingInstructions, { backgroundColor: theme.overlay }]}>
              <Text style={styles.recordingText}>Speak now... tap stop when finished</Text>
            </View>
          )}
          
          <TouchableOpacity style={styles.hintButton}>
            <Icon name="sparkles-outline" size={24} color={theme.textTertiary} />
            <Text style={[styles.hintText, { color: theme.textTertiary }]}>Hint</Text>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  };
  
  // Render the Text Chat UI
  const renderTextChatUI = () => {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.surface, paddingTop: insets.top }]}>
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={theme.background} />
        
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Icon name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          
          <Text style={[styles.headerTitle, { color: theme.text }]}>Chat with RAHA AI</Text>
          
          <TouchableOpacity style={styles.settingsButton}>
            <Icon name="settings-outline" size={24} color={theme.text} />
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
            <MessageBubble message={item.text} isAI={item.isAI} theme={theme} />
          )}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          ListFooterComponent={() => isTyping ? <TypingIndicator theme={theme} /> : null}
        />
        
        {/* Input area */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
          style={[
            styles.inputContainer,
            { backgroundColor: theme.card, borderTopColor: theme.border, paddingBottom: insets.bottom > 0 ? insets.bottom : 8 }
          ]}
        >
          <TextInput
            style={[styles.input, { backgroundColor: theme.inputBackground, color: theme.text }]}
            placeholder="Type your message..."
            placeholderTextColor={theme.textTertiary}
            value={message}
            onChangeText={setMessage}
            multiline
            maxLength={500}
          />
          
          <TouchableOpacity 
            style={[
              styles.sendButton,
              { backgroundColor: theme.primary },
              (!message.trim() || loading) && { backgroundColor: theme.textTertiary, opacity: 0.5 }
            ]}
            onPress={() => handleSend()}
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
          <View style={[styles.errorContainer, { backgroundColor: theme.error + '20', marginBottom: insets.bottom > 0 ? insets.bottom : 16 }]}>
            <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
          </View>
        )}
      </SafeAreaView>
    );
  };
  
  // Return the appropriate UI based on the mode
  return isVoiceChat ? renderVoiceChatUI() : renderTextChatUI();
};

const styles = StyleSheet.create({
  // Common styles
  backButton: {
    padding: 8,
  },
  settingsButton: {
    padding: 8,
  },

  // Text Chat UI styles
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
    fontSize: 18,
    fontWeight: 'bold',
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
    borderTopRightRadius: 0,
  },
  aiMessage: {
    alignSelf: 'flex-start',
    borderTopLeftRadius: 0,
  },
  messageText: {
    fontSize: 16,
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
    marginHorizontal: 3,
    opacity: 0.7,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 100,
    fontSize: 16,
  },
  sendButton: {
    marginLeft: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    padding: 8,
    margin: 16,
    borderRadius: 8,
  },
  errorText: {
    textAlign: 'center',
  },

  // Voice Chat UI styles
  voiceChatContainer: {
    flex: 1,
  },
  voiceChatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  voiceChatHeaderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    flex: 1,
    marginRight: 16,
  },
  progressFilled: {
    height: '100%',
    width: '30%',
    borderRadius: 2,
  },
  feedbackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 15,
  },
  feedbackText: {
    fontSize: 12,
    marginRight: 4,
  },
  voiceChatMessageList: {
    padding: 16,
    flexGrow: 1,
  },
  voiceChatMessageContainer: {
    marginBottom: 20,
  },
  voiceChatMessageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  userMessageHeader: {
    justifyContent: 'flex-end',
    flexDirection: 'row',
  },
  aiMessageHeader: {
    justifyContent: 'flex-start',
  },
  messageAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 8,
  },
  messageSender: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  aiControls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
  },
  translateText: {
    fontSize: 18,
    marginRight: 12,
  },
  voiceChatMessage: {
    padding: 16,
    borderRadius: 12,
    maxWidth: '80%',
  },
  voiceChatUserMessage: {
    alignSelf: 'flex-end',
    marginRight: 10,
  },
  voiceChatAIMessage: {
    alignSelf: 'flex-start',
    marginLeft: 10,
  },
  voiceChatMessageText: {
    fontSize: 16,
    lineHeight: 24,
  },
  translationDivider: {
    height: 1,
    marginVertical: 12,
  },
  translationText: {
    fontSize: 14,
    lineHeight: 20,
  },
  proTipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 8,
  },
  proTipTitle: {
    fontSize: 14,
    color: '#666',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  proTipText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    paddingHorizontal: 16,
    marginTop: 4,
    marginBottom: 16,
  },
  voiceChatInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 1,
  },
  voiceChatInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 22,
    paddingLeft: 16,
  },
  voiceChatInput: {
    flex: 1,
    height: 44,
    fontSize: 16,
  },
  sendButtonWrapper: {
    margin: 4,
  },
  sendIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledSendButton: {
    // Keep same color for mic
  },
  hintButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  hintText: {
    fontSize: 14,
    marginLeft: 4,
  },
  correctResponseContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    padding: 8,
    borderRadius: 16,
    marginTop: 8,
    marginBottom: 16,
  },
  correctResponseText: {
    fontSize: 14,
    marginLeft: 4,
  },
  recordingButton: {
    borderWidth: 4,
    borderColor: 'rgba(255, 74, 74, 0.3)',
  },
  recordingInstructions: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingVertical: 10,
  },
  recordingText: {
    color: '#fff',
    fontSize: 14,
  },
});

export default AIChatScreen; 