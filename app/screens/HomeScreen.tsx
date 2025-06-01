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
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import IconMaterial from 'react-native-vector-icons/MaterialIcons';
import { RootScreenNavigationProp } from '../navigation/types';
import { useAppSelector } from '../redux/hooks';

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
  const [activeTab, setActiveTab] = useState('general');
  const [messages, setMessages] = useState([
    { id: 1, text: "Hello! I'm ARYA AI. How can I help you practice today?", isAI: true },
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
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
    // Navigate to the AI Chat screen with the selected topic
    navigation.navigate('AIChat', {
      topic: topic.title.toLowerCase().replace(/\s+/g, '-'),
      level: userData?.level || 'intermediate'
    });
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      
      {/* User Profile */}
      <TouchableOpacity 
        style={styles.userProfileContainer}
        onPress={navigateToUserProfile}
      >
        <Image 
          source={{ 
            uri: userData?.profilePic || 'https://randomuser.me/api/portraits/men/32.jpg' 
          }} 
          style={styles.userAvatar}
        />
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{userData?.name || 'User'}</Text>
          <View style={styles.levelContainer}>
            <Text style={styles.levelText}>Level: {userData?.level || 'Beginner'}</Text>
          </View>
        </View>
        <Icon name="chevron-forward" size={20} color="#999" />
      </TouchableOpacity>
      
      {/* Header with RAHA AI title */}
      <View style={styles.header}>
        <View style={styles.aiHeaderContainer}>
          <Image 
            source={{ uri: 'https://img.icons8.com/color/96/000000/robot.png' }} 
            style={styles.aiAvatar}
          />
          <Text style={styles.aiTitle}>RAHA AI</Text>
        </View>
        
        <TouchableOpacity style={styles.historyButton}>
          <Text style={styles.historyText}>History</Text>
        </TouchableOpacity>
      </View>
      
      {/* Custom Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity 
          style={[
            styles.tabButton, 
            activeTab === 'general' ? styles.activeTab : null
          ]} 
          onPress={() => setActiveTab('general')}
        >
          <Text style={[
            styles.tabText, 
            activeTab === 'general' ? styles.activeTabText : null
          ]}>
            General
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[
            styles.tabButton, 
            activeTab === 'interview' ? styles.activeTab : null
          ]} 
          onPress={() => setActiveTab('interview')}
        >
          <Text style={[
            styles.tabText, 
            activeTab === 'interview' ? styles.activeTabText : null
          ]}>
            Interview
          </Text>
        </TouchableOpacity>
      </View>
      
      {/* Tab Content */}
      {activeTab === 'general' ? renderGeneralTopics() : renderInterviewTopics()}
      
  
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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