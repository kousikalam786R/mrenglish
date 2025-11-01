import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Image, 
  FlatList,
  TextInput,
  ActivityIndicator,
  ScrollView,
  StatusBar,
  Platform,
  Dimensions,
  Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import IconMaterial from 'react-native-vector-icons/MaterialIcons';
import { RootScreenNavigationProp } from '../navigation/types';
import { useAppSelector } from '../redux/hooks';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';

const { width } = Dimensions.get('window');
const cardWidth = (width - 48) / 2;

// Topic type definition
interface Topic {
  id: number;
  title: string;
  image: any;
  practiced: boolean;
  difficulty: string;
  lastChat?: string;
}

// Main Home Screen Component
const HomeScreen = () => {
  const navigation = useNavigation<RootScreenNavigationProp>();
  // Get user data from Redux store instead of local state
  const userData = useAppSelector(state => state.user);
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('general');
  const [messages, setMessages] = useState([
    { id: 1, text: "Hello! I'm RAHA AI. How can I help you practice today?", isAI: true },
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  
  const handleSend = async () => {
    if (inputText.trim() === '') return;
    
    // Add user message
    const userMessage = { id: messages.length + 1, text: inputText, isAI: false };
    setMessages([...messages, userMessage]);
    setInputText('');
    setIsLoading(true);
    
    // Simulate AI response (in a real app, this would call your AI backend)
    setTimeout(() => {
      const aiResponses = [
        "That's a great question! Let's practice that together.",
        "I understand what you're asking. Here's how we can practice that.",
        "Let me help you improve your English skills on that topic.",
        "Would you like to practice this in a more structured conversation?",
        "I can guide you through this. Let's break it down step by step."
      ];
      
      const randomResponse = aiResponses[Math.floor(Math.random() * aiResponses.length)];
      setMessages(prev => [...prev, { id: prev.length + 1, text: randomResponse, isAI: true }]);
      setIsLoading(false);
    }, 1000);
  };

  const handleTopicSelect = (topic: Topic) => {
    // Set selected topic and show modal instead of direct navigation
    setSelectedTopic(topic);
    setModalVisible(true);
  };

  const handlePracticeMode = (mode: 'voiceChat' | 'call') => {
    // Close the modal
    setModalVisible(false);
    
    if (!selectedTopic) return;
    
    // Common parameters
    const topicParam = selectedTopic.title.toLowerCase().replace(/\s+/g, '-');
    const levelParam = userData?.level || 'intermediate';
    
    if (mode === 'voiceChat') {
      // Navigate to AIChat screen with voice chat flag
      navigation.navigate('AIChat', { 
        topic: topicParam,
        level: levelParam,
        isVoiceChat: true
      });
    } else if (mode === 'call') {
      // Navigate to AICallScreen screen with adapted parameters
      navigation.navigate('AICallScreen', {
        id: `topic-${selectedTopic.id}`,
        name: selectedTopic.title,
        topic: topicParam,
        level: levelParam
      });
      
      // Log the navigation for debugging
      console.log('Navigating to AICallScreen with params:', {
        id: `topic-${selectedTopic.id}`,
        name: selectedTopic.title,
        topic: topicParam,
        level: levelParam
      });
    }
  };

  const navigateToUserProfile = () => {
    // Navigate to Profile screen instead of UserProfile
    navigation.navigate('Profile');
  };

  const renderGeneralTopics = () => {
    const topics: Topic[] = [
      { 
        id: 1, 
        title: 'Talk about anything', 
        image: { uri: 'https://img.icons8.com/color/96/000000/chat--v1.png' },
        practiced: true,
        lastChat: '31 May 2025',
        difficulty: 'Easy'
      },
      { 
        id: 2, 
        title: 'Daily routine', 
        image: { uri: 'https://img.icons8.com/color/96/000000/calendar.png' },
        practiced: false,
        difficulty: 'Easy'
      },
      { 
        id: 3, 
        title: "Let's Improve vocabulary", 
        image: { uri: 'https://img.icons8.com/color/96/000000/literature.png' },
        practiced: false,
        difficulty: 'Easy'
      },
      { 
        id: 4, 
        title: 'Talk about your childhood memory', 
        image: { uri: 'https://img.icons8.com/color/96/000000/child.png' },
        practiced: true,
        lastChat: '27 May 2025',
        difficulty: 'Easy'
      },
      { 
        id: 5, 
        title: 'Talk about the weather', 
        image: { uri: 'https://img.icons8.com/color/96/000000/partly-cloudy-day.png' },
        practiced: false,
        difficulty: 'Easy'
      },
      { 
        id: 6, 
        title: 'Talk about your family', 
        image: { uri: 'https://img.icons8.com/color/96/000000/family.png' },
        practiced: false,
        difficulty: 'Easy'
      },
    ];

    return (
      <View style={styles.topicsContainer}>
        <FlatList
          data={topics}
          keyExtractor={item => item.id.toString()}
          numColumns={2}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.topicCard}
              onPress={() => handleTopicSelect(item)}
            >
              <View style={styles.cardHeader}>
                <View style={styles.difficultyContainer}>
                  <View style={styles.difficultyIndicator} />
                  <Text style={styles.difficultyText}>{item.difficulty}</Text>
                </View>
                {item.practiced && (
                  <View style={styles.practicedBadge}>
                    <Text style={styles.practicedText}>Practiced 1 time</Text>
                  </View>
                )}
              </View>
              
              <Image 
                source={item.image} 
                style={styles.topicImage}
              />
              
              <Text style={styles.topicTitle}>{item.title}</Text>
              
              {item.lastChat && (
                <Text style={styles.lastChatText}>Last chat: {item.lastChat}</Text>
              )}
            </TouchableOpacity>
          )}
        />
      </View>
    );
  };

  const renderInterviewTopics = () => {
    const topics: Topic[] = [
      { 
        id: 1, 
        title: 'Practice Interview Introduction', 
        image: { uri: 'https://img.icons8.com/color/96/000000/handshake.png' },
        practiced: false,
        difficulty: 'Easy'
      },
      { 
        id: 2, 
        title: 'Talk about your career plans', 
        image: { uri: 'https://img.icons8.com/color/96/000000/personal-growth.png' },
        practiced: false,
        difficulty: 'Easy'
      },
      { 
        id: 3, 
        title: 'Practice a job interview', 
        image: { uri: 'https://img.icons8.com/color/96/000000/meeting.png' },
        practiced: false,
        difficulty: 'Easy'
      },
      { 
        id: 4, 
        title: 'Practice UPSC Interview', 
        image: { uri: 'https://img.icons8.com/color/96/000000/conference.png' },
        practiced: false,
        difficulty: 'Easy'
      },
      { 
        id: 5, 
        title: 'General Interview Tips', 
        image: { uri: 'https://img.icons8.com/color/96/000000/idea.png' },
        practiced: false,
        difficulty: 'Easy'
      },
      { 
        id: 6, 
        title: 'Practice Teaching', 
        image: { uri: 'https://img.icons8.com/color/96/000000/classroom.png' },
        practiced: false,
        difficulty: 'Easy'
      },
    ];

    return (
      <View style={styles.topicsContainer}>
        <FlatList
          data={topics}
          keyExtractor={item => item.id.toString()}
          numColumns={2}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.topicCard}
              onPress={() => handleTopicSelect(item)}
            >
              <View style={styles.cardHeader}>
                <View style={styles.difficultyContainer}>
                  <View style={styles.difficultyIndicator} />
                  <Text style={styles.difficultyText}>{item.difficulty}</Text>
                </View>
                {item.practiced && (
                  <View style={styles.practicedBadge}>
                    <Text style={styles.practicedText}>Practiced 1 time</Text>
                  </View>
                )}
              </View>
              
              <Image 
                source={item.image} 
                style={styles.topicImage}
              />
              
              <Text style={styles.topicTitle}>{item.title}</Text>
              
              {item.lastChat && (
                <Text style={styles.lastChatText}>Last chat: {item.lastChat}</Text>
              )}
            </TouchableOpacity>
          )}
        />
      </View>
    );
  };

  // Practice Mode Selection Modal
  const renderPracticeModeModal = () => {
    return (
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <View style={[styles.modalContainer, { backgroundColor: theme.card }]}>
            <TouchableOpacity 
              style={styles.closeButton} 
              onPress={() => setModalVisible(false)}
            >
              <Icon name="close" size={24} color={theme.text} />
            </TouchableOpacity>
            
            <Text style={[styles.modalTitle, { color: theme.text }]}>{t('home.selectMode')}</Text>
            
            {/* Progress bar */}
            <View style={styles.progressContainer}>
              <View style={[styles.progressBar, { backgroundColor: theme.inputBackground }]}>
                <View style={[styles.progressFill, { backgroundColor: theme.primary }]} />
              </View>
              <Text style={[styles.timerText, { color: theme.textSecondary }]}>18:05 {t('home.minutesRemaining')}</Text>
            </View>
            
            {/* Voice Chat Option */}
            <TouchableOpacity 
              style={[styles.practiceOption, { backgroundColor: theme.card }]}
              onPress={() => handlePracticeMode('voiceChat')}
            >
              <View style={[styles.optionIconContainer, { backgroundColor: theme.primary }]}>
                <Icon name="chatbubble-ellipses" size={28} color="#fff" />
              </View>
              <View style={styles.optionTextContainer}>
                <Text style={[styles.optionTitle, { color: theme.text }]}>{t('home.voiceChat')}</Text>
                <Text style={[styles.optionDescription, { color: theme.textSecondary }]}>{t('home.voiceChatDesc')}</Text>
              </View>
            </TouchableOpacity>
            
            {/* Call Option */}
            <TouchableOpacity 
              style={[styles.practiceOption, { backgroundColor: theme.card }]}
              onPress={() => handlePracticeMode('call')}
            >
              <View style={[styles.optionIconContainer, { backgroundColor: theme.primary }]}>
                <Icon name="call" size={28} color="#fff" />
              </View>
              <View style={styles.optionTextContainer}>
                <Text style={[styles.optionTitle, { color: theme.text }]}>{t('home.call')}</Text>
                <Text style={[styles.optionDescription, { color: theme.textSecondary }]}>{t('home.callDesc')}</Text>
              </View>
            </TouchableOpacity>
            
            {/* Start Practice Button */}
            <TouchableOpacity 
              style={[styles.startPracticeButton, { backgroundColor: theme.primary }]}
              onPress={() => handlePracticeMode('voiceChat')} // Default to voice chat
            >
              <Text style={styles.startPracticeText}>{t('home.startPractice')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.surface }]} edges={['top']}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={theme.background} />
      
      {/* User Profile */}
      <TouchableOpacity 
        style={[styles.userProfileContainer, { backgroundColor: theme.card }]}
        onPress={navigateToUserProfile}
      >
        <Image 
          source={{ 
            uri: userData?.profilePic || 'https://randomuser.me/api/portraits/men/32.jpg' 
          }} 
          style={styles.userAvatar}
        />
        <View style={styles.userInfo}>
          <Text style={[styles.userName, { color: theme.text }]}>{userData?.name || 'User'}</Text>
          <View style={styles.levelContainer}>
            <Text style={[styles.levelText, { color: theme.textSecondary }]}>Level: {userData?.level || 'Beginner'}</Text>
          </View>
        </View>
        <Icon name="chevron-forward" size={20} color={theme.textTertiary} />
      </TouchableOpacity>
      
      {/* Header with RAHA AI title */}
      <View style={[styles.header, { backgroundColor: theme.card }]}>
        <View style={styles.aiHeaderContainer}>
          <Image 
            source={{ uri: 'https://img.icons8.com/color/96/000000/robot.png' }} 
            style={styles.aiAvatar}
          />
          <Text style={[styles.aiTitle, { color: theme.text }]}>RAHA AI</Text>
        </View>
        
        <TouchableOpacity style={styles.historyButton}>
          <Text style={[styles.historyText, { color: theme.primary }]}>History</Text>
        </TouchableOpacity>
      </View>
      
      {/* Custom Tabs */}
      <View style={[styles.tabBar, { backgroundColor: theme.card }]}>
        <TouchableOpacity 
          style={[
            styles.tabButton, 
            activeTab === 'general' && { backgroundColor: theme.primary + '15' }
          ]} 
          onPress={() => setActiveTab('general')}
        >
          <Text style={[
            styles.tabText,
            { color: activeTab === 'general' ? theme.primary : theme.textSecondary }
          ]}>
            {t('home.general')}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[
            styles.tabButton, 
            activeTab === 'interview' && { backgroundColor: theme.primary + '15' }
          ]} 
          onPress={() => setActiveTab('interview')}
        >
          <Text style={[
            styles.tabText,
            { color: activeTab === 'interview' ? theme.primary : theme.textSecondary }
          ]}>
            {t('home.interview')}
          </Text>
        </TouchableOpacity>
      </View>
      
      {/* Tab Content */}
      {activeTab === 'general' ? renderGeneralTopics() : renderInterviewTopics()}
      
      {/* Practice Mode Selection Modal */}
      {renderPracticeModeModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor will be set dynamically with theme
  },
  userProfileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  levelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  levelText: {
    fontSize: 14,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  aiHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aiAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
  },
  aiTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  historyButton: {
    padding: 8,
  },
  historyText: {
    color: '#666',
    fontSize: 16,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#888',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#4A90E2',
  },
  activeTabText: {
    color: '#4A90E2',
  },
  topicsContainer: {
    flex: 1,
    padding: 8,
  },
  topicCard: {
    width: cardWidth,
    backgroundColor: '#ffffff',
    margin: 8,
    borderRadius: 12,
    overflow: 'hidden',
    padding: 12,
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  difficultyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  difficultyIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
    marginRight: 4,
  },
  difficultyText: {
    color: '#888',
    fontSize: 12,
  },
  practicedBadge: {
    backgroundColor: '#25AE88',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  practicedText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  topicImage: {
    width: '100%',
    height: 80,
    resizeMode: 'contain',
    marginBottom: 12,
    alignSelf: 'center',
  },
  topicTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  lastChatText: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 20,
  },
  progressContainer: {
    width: '100%',
    marginBottom: 30,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    marginBottom: 10,
    width: '100%',
  },
  progressFill: {
    height: '100%',
    width: '20%',
    backgroundColor: '#FF9B42',
    borderRadius: 4,
  },
  timerText: {
    color: '#666',
    fontSize: 14,
  },
  practiceOption: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
  },
  optionIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 14,
    color: '#666',
  },
  startPracticeButton: {
    width: '100%',
    backgroundColor: '#4A90E2',
    borderRadius: 30,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 20,
  },
  startPracticeText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  promotionalBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#1C2371',
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  promotionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  promotionTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 8,
  },
  promotionRight: {
    alignItems: 'center',
  },
  offerText: {
    color: 'white',
    fontSize: 12,
    marginBottom: 4,
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timerBox: {
    backgroundColor: '#121726',
    borderRadius: 8,
    padding: 4,
    alignItems: 'center',
    minWidth: 40,
  },
  timerNumber: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  timerLabel: {
    color: '#8F92A1',
    fontSize: 10,
  },
  timerSeparator: {
    color: 'white',
    fontSize: 16,
    marginHorizontal: 4,
  },
  bottomNavigation: {
    flexDirection: 'row',
    backgroundColor: '#1C2138',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#2A2E3D',
  },
  navButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  navText: {
    fontSize: 12,
    color: '#8F92A1',
    marginTop: 4,
  },
});

export default HomeScreen;