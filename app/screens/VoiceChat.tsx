import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  StatusBar,
  TextInput,
  Platform,
  KeyboardAvoidingView,
  SafeAreaView
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import { VoiceChatRouteProp } from '../navigation/types';

// Define message type
interface Message {
  id: number;
  text: string;
  translation: string;
  isUser: boolean;
}

const VoiceChat = () => {
  const navigation = useNavigation();
  const route = useRoute<VoiceChatRouteProp>();
  const { topic, level } = route.params;
  
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      text: 'Hello, Kousik! How was your day today? What did you do?',
      translation: 'হ্যালো, কৌসিক! আজ তোমার দিন কেমন ছিল? তুমি কি করেছ?',
      isUser: false
    }
  ]);
  
  const formatTopicTitle = (topic?: string) => {
    if (!topic) return 'Talk about anything';
    return topic.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const handleSend = () => {
    if (!message.trim()) return;
    
    // Add user message
    const newUserMessage: Message = {
      id: messages.length + 1,
      text: message,
      translation: '', // Empty translation for user messages
      isUser: true
    };
    
    setMessages([...messages, newUserMessage]);
    setMessage('');
    
    // Simulate AI response after a short delay
    setTimeout(() => {
      const aiResponses = [
        {
          text: "That sounds interesting! Can you tell me more about it?",
          translation: "এটা শুনতে মজার! আপনি কি এ সম্পর্কে আরও বলতে পারেন?"
        },
        {
          text: "I understand. How did that make you feel?",
          translation: "আমি বুঝতে পারছি। এটি আপনাকে কেমন অনুভব করতে সাহায্য করেছে?"
        },
        {
          text: "Sure! Which movie do you want to talk about? What do you find interesting about it?",
          translation: "নিশ্চয়! আপনি কোন সিনেমা সম্পর্কে কথা বলতে চান? আপনি এটি সম্পর্কে কী আকর্ষণীয় মনে করেন?"
        },
        {
          text: "That's a great question. Let me help you practice that.",
          translation: "এটা একটি দুর্দান্ত প্রশ্ন। আমাকে আপনাকে এটি অনুশীলন করতে সাহায্য করতে দিন।"
        }
      ];
      
      const randomResponse = aiResponses[Math.floor(Math.random() * aiResponses.length)];
      
      const newAIMessage: Message = {
        id: messages.length + 2,
        text: randomResponse.text,
        translation: randomResponse.translation,
        isUser: false
      };
      
      setMessages(prev => [...prev, newAIMessage]);
    }, 1000);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{formatTopicTitle(topic)}</Text>
        <TouchableOpacity style={styles.settingsButton}>
          <Icon name="settings-outline" size={24} color="#333" />
        </TouchableOpacity>
      </View>
      
      {/* Chat Area */}
      <View style={styles.chatContainer}>
        {/* Display robot avatar and "RAHA Speaking" */}
        <View style={styles.aryaSpeakingContainer}>
          <View style={styles.avatarCircle}>
            <Image 
              source={{ uri: 'https://img.icons8.com/color/96/000000/robot.png' }} 
              style={styles.avatarImage}
            />
          </View>
          <Text style={styles.aryaSpeakingText}>RAHA Speaking</Text>
        </View>
        
        {/* User avatar and "Wait for your turn" */}
        <View style={styles.userContainer}>
          <View style={styles.avatarCircle}>
            <Image 
              source={{ uri: 'https://randomuser.me/api/portraits/men/32.jpg' }} 
              style={styles.avatarImage}
            />
          </View>
          <Text style={styles.waitTurnText}>Wait for your turn</Text>
        </View>
        
        {/* Captions */}
        <View style={styles.captionsContainer}>
          <View style={styles.captionsHeader}>
            <Icon name="closed-captioning" size={20} color="#FFC107" />
            <Text style={styles.captionsTitle}>RAHA Captions</Text>
            <TouchableOpacity>
              <Icon name="close" size={20} color="#666" />
            </TouchableOpacity>
          </View>
          <Text style={styles.captionText}>
            {messages[messages.length - 1]?.isUser ? 
              "I'm listening..." : 
              messages[messages.length - 1]?.text}
          </Text>
        </View>
      </View>
      
      {/* Bottom Controls */}
      <View style={styles.controlsContainer}>
        <TouchableOpacity style={styles.controlButton}>
          <Icon name="sparkles-outline" size={24} color="#fff" />
          <Text style={styles.controlText}>Hint</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.controlButton}>
          <Icon name="closed-captioning" size={24} color="#fff" />
          <Text style={styles.controlText}>Caption</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.controlButton}>
          <Icon name="pause" size={24} color="#fff" />
          <Text style={styles.controlText}>Pause</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.controlButton}>
          <Icon name="play" size={24} color="#fff" />
          <Text style={styles.controlText}>Continue</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.controlButton, styles.endButton]}>
          <Icon name="close" size={24} color="#fff" />
          <Text style={styles.controlText}>End</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  settingsButton: {
    padding: 8,
  },
  chatContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: '#f5f5f5',
  },
  aryaSpeakingContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  avatarCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  aryaSpeakingText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  userContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  waitTurnText: {
    fontSize: 18,
    color: '#666',
  },
  captionsContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  captionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  captionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFC107',
    flex: 1,
    marginLeft: 8,
  },
  captionText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#4A90E2',
  },
  controlButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  endButton: {
    backgroundColor: '#F44336',
  },
  controlText: {
    fontSize: 12,
    color: '#fff',
    marginTop: 4,
  },
});

export default VoiceChat; 