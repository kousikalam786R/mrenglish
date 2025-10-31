import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import notificationService from '../utils/notificationService';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useAppSelector, useAppDispatch } from '../redux/hooks';
import { signOut } from '../redux/thunks/authThunks';
import apiClient from '../utils/apiClient';
import Toast from 'react-native-toast-message';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { updateUserProfile } from '../utils/profileService';
import { setUserData } from '../redux/slices/userSlice';

// Define types for better type checking
interface Activity {
  text: string;
  time: string;
  timestamp: Date;
}

interface User {
  id: string;
  name: string;
  email: string;
  bio?: string;
  age?: number;
  gender?: string;
  country?: string;
  nativeLanguage?: string;
  englishLevel?: string;
  interests?: string[];
  profilePic?: string;
  createdAt: Date;
  lastLoginAt: Date;
}

interface UserStats {
  totalCalls: number;
  totalMinutes: number;
  totalHours: number;
  averageCallDuration: number;
  points: number;
  streak: number;
  recentActivity: Activity[];
  // Rating and feedback stats
  totalRatings: number;
  averageRating: number;
  positiveFeedback: number;
  negativeFeedback: number;
  satisfactionPercentage: number;
}

interface Rating {
  _id: string;
  rating: number;
  comment?: string;
  ratedBy: {
    _id: string;
    name: string;
    profilePic?: string;
  };
  createdAt: string;
}

interface Feedback {
  _id: string;
  feedbackType: 'positive' | 'negative';
  message?: string;
  feedbackBy: {
    _id: string;
    name: string;
    profilePic?: string;
  };
  createdAt: string;
}

interface Compliment {
  _id: string;
  count: number;
}

interface Advice {
  _id: string;
  count: number;
}

const ENGLISH_LEVEL_LABELS: Record<string, string> = {
  A1: 'Beginner',
  A2: 'Elementary',
  B1: 'Intermediate',
  B2: 'Upper intermediate',
  C1: 'Advanced',
  C2: 'Proficiency',
};

const formatEnglishLevel = (level?: string | null): string => {
  if (!level) {
    return 'Not specified';
  }

  const trimmed = level.trim();
  if (!trimmed) {
    return 'Not specified';
  }

  const code = trimmed.toUpperCase().split(/[^A-Z0-9]/)[0];
  const description = ENGLISH_LEVEL_LABELS[code];

  if (description) {
    return `${code} (${description})`;
  }

  return trimmed;
};

const ProfileScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [activeTab, setActiveTab] = useState<'stats' | 'about'>('stats');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [compliments, setCompliments] = useState<Compliment[]>([]);
  const [advice, setAdvice] = useState<Advice[]>([]);
  const [complimentsExpanded, setComplimentsExpanded] = useState(false);
  const [adviceExpanded, setAdviceExpanded] = useState(false);
  const [interestModalVisible, setInterestModalVisible] = useState(false);
  const [pendingInterests, setPendingInterests] = useState<string[]>([]);
  const [interestInput, setInterestInput] = useState('');
  const [interestError, setInterestError] = useState<string | null>(null);
  const [savingInterests, setSavingInterests] = useState(false);
  
  const dispatch = useAppDispatch();
  const { isSignedIn } = useAppSelector(state => state.auth);
  
  // Fetch profile data when screen loads
  useEffect(() => {
    fetchProfileData();
  }, []);

  // Refresh data when screen comes into focus (after submitting feedback)
  useFocusEffect(
    React.useCallback(() => {
      console.log('ProfileScreen focused - refreshing data');
      // Don't show loading spinner when refreshing on focus
      fetchProfileData(false);
    }, [])
  );

  const fetchProfileData = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      
      // First fetch profile to get user ID
      const profileResponse = await apiClient.get('/profile');
      
      if (!profileResponse.data.success) {
        throw new Error('Failed to fetch profile');
      }
      
      const currentUser = profileResponse.data.user;
      setUser(currentUser);
      setPendingInterests(currentUser.interests || []);
      
      // Then fetch stats and rating data
      const [statsResponse, ratingResponse] = await Promise.all([
        apiClient.get('/profile/stats'),
        apiClient.get('/ratings/summary/me').catch(() => null)
      ]);

      if (statsResponse.data.success) {
        setStats(statsResponse.data.stats);
      }

      if (ratingResponse?.data?.success) {
        console.log('Updated compliments:', ratingResponse.data.data.compliments);
        console.log('Updated advice:', ratingResponse.data.data.advice);
        setRatings(ratingResponse.data.data.recentRatings || []);
        setFeedback(ratingResponse.data.data.recentFeedback || []);
        setCompliments(ratingResponse.data.data.compliments || []);
        setAdvice(ratingResponse.data.data.advice || []);
      }
    } catch (error: any) {
      console.error('Error fetching profile data:', error);
      if (showLoading) {
        Toast.show({
          type: 'error',
          text1: 'Error loading profile',
          text2: error.response?.data?.message || 'Please try again later'
        });
      }
    } finally {
      if (showLoading) {
        setLoading(false);
      } else {
        setRefreshing(false);
      }
    }
  };

  const handleRefresh = () => {
    fetchProfileData(false);
  };

  const openInterestEditor = () => {
    if (!user) return;
    setPendingInterests(user.interests ? [...user.interests] : []);
    setInterestInput('');
    setInterestError(null);
    setInterestModalVisible(true);
  };

  const handleAddInterest = () => {
    const value = interestInput.trim();
    if (!value) {
      return;
    }

    if (value.length > 40) {
      setInterestError('Please keep interests under 40 characters.');
      return;
    }

    const exists = pendingInterests.some(
      interest => interest.toLowerCase() === value.toLowerCase()
    );

    if (exists) {
      setInterestError('You already added this interest.');
      return;
    }

    setPendingInterests(prev => [...prev, value]);
    setInterestInput('');
    setInterestError(null);
  };

  const handleRemoveInterest = (interestToRemove: string) => {
    setPendingInterests(prev => prev.filter(interest => interest !== interestToRemove));
  };

  const handleSaveInterests = async () => {
    if (!user) return;

    try {
      setSavingInterests(true);
      const updatedProfile = await updateUserProfile({ interests: pendingInterests });

      const updatedUser = {
        ...user,
        interests: [...pendingInterests],
        ...(updatedProfile || {}),
      } as User;

      setUser(updatedUser);
      setPendingInterests(updatedUser.interests || []);
      await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
      dispatch(setUserData(updatedUser as any));

      Toast.show({
        type: 'success',
        text1: 'Interests updated',
      });

      setInterestModalVisible(false);
    } catch (error: any) {
      console.error('Error updating interests:', error);
      Toast.show({
        type: 'error',
        text1: 'Could not update interests',
        text2: error.response?.data?.message || error.message || 'Please try again.',
      });
    } finally {
      setSavingInterests(false);
    }
  };
  
  const handleEditProfile = () => {
    // Navigate to edit profile screen
    navigation.navigate('EditProfile' as any);
  };
  
  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Sign Out',
          onPress: () => dispatch(signOut())
        }
      ]
    );
  };

  const handleTestNotification = async () => {
    try {
      Alert.alert(
        'Test Notification',
        'This will send a test push notification to your device.',
        [
          {
            text: 'Cancel',
            style: 'cancel'
          },
          {
            text: 'Send',
            onPress: async () => {
              const success = await notificationService.sendTestNotification();
              if (success) {
                Alert.alert('Success', 'Test notification sent! Check your notification tray.');
              } else {
                Alert.alert('Error', 'Failed to send test notification. Make sure you\'re logged in.');
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error sending test notification:', error);
      Alert.alert('Error', 'Failed to send test notification');
    }
  };
  
  const renderProfileHeader = () => {
    if (!user) return null;
    
    return (
      <View style={styles.profileHeader}>
        <View style={styles.profileImageContainer}>
          <Image 
            source={{ 
              uri: user.profilePic || 'https://randomuser.me/api/portraits/men/32.jpg' 
            }} 
            style={styles.avatar} 
          />
          <View style={styles.levelBadge}>
            <Text style={styles.levelBadgeText}>{user.englishLevel || 'A2'}</Text>
          </View>
          <View style={styles.crownIcon}>
            <Text style={styles.crownText}>👑</Text>
          </View>
        </View>
        
        <Text style={styles.userName}>{user.name || 'User'}</Text>
        
        {user.bio && (
          <Text style={styles.bioText}>"{user.bio}"</Text>
        )}
        
        <TouchableOpacity 
          style={styles.editButton}
          onPress={handleEditProfile}
        >
          <Text style={styles.editButtonText}>Edit profile</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderInterestsModal = () => (
    <Modal
      visible={interestModalVisible}
      animationType="slide"
      onRequestClose={() => setInterestModalVisible(false)}
    >
      <SafeAreaView style={styles.interestModalContainer}>
        <View style={styles.interestModalHeader}>
          <TouchableOpacity
            style={styles.interestBackButton}
            onPress={() => setInterestModalVisible(false)}
          >
            <Ionicons name="chevron-back" size={26} color="#2C2C47" />
          </TouchableOpacity>
          <Text style={styles.interestModalTitle}>Interests</Text>
          <View style={styles.interestHeaderSpacer} />
        </View>

        <View style={styles.interestInputRow}>
          <TextInput
            style={styles.interestInput}
            placeholder="Add your interest"
            placeholderTextColor="#A0A0B2"
            value={interestInput}
            onChangeText={text => {
              setInterestInput(text);
              if (interestError) {
                setInterestError(null);
              }
            }}
            maxLength={40}
          />
          <TouchableOpacity
            style={[
              styles.interestAddButton,
              interestInput.trim().length === 0 && styles.interestAddButtonDisabled,
            ]}
            onPress={handleAddInterest}
            disabled={interestInput.trim().length === 0}
          >
            <Text style={styles.interestAddButtonText}>Add</Text>
          </TouchableOpacity>
        </View>

        {interestError ? <Text style={styles.interestErrorText}>{interestError}</Text> : null}

        <ScrollView
          style={styles.interestModalList}
          contentContainerStyle={styles.interestModalScroll}
          keyboardShouldPersistTaps="handled"
        >
          {pendingInterests.length > 0 ? (
            <View style={styles.interestChipsWrapper}>
              {pendingInterests.map((interest, index) => (
                <View key={`${interest}-${index}`} style={styles.interestEditChip}>
                  <Text style={styles.interestEditChipText}>{interest}</Text>
                  <TouchableOpacity
                    style={styles.interestChipRemove}
                    onPress={() => handleRemoveInterest(interest)}
                  >
                    <Ionicons name="close" size={16} color="#4A4A62" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.interestEmptyState}>
              <Text style={styles.interestEmptyText}>
                Add a few interests so partners know what to chat about.
              </Text>
            </View>
          )}
        </ScrollView>

        <TouchableOpacity
          style={[
            styles.interestDoneButton,
            savingInterests && styles.interestDoneButtonDisabled,
          ]}
          onPress={handleSaveInterests}
          disabled={savingInterests}
        >
          {savingInterests ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.interestDoneButtonText}>Done</Text>
          )}
        </TouchableOpacity>
      </SafeAreaView>
    </Modal>
  );

  const renderStatsRow = () => {
    if (!stats) return null;
    
    return (
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statIcon}>💬</Text>
          <Text style={styles.statNumber}>{stats.positiveFeedback + stats.negativeFeedback}</Text>
          <Text style={styles.statLabel}>Feedback</Text>
        </View>
        
        <View style={styles.statItem}>
          <Text style={styles.statIcon}>📞</Text>
          <Text style={styles.statNumber}>{stats.totalCalls}</Text>
          <Text style={styles.statLabel}>Talks</Text>
        </View>
        
        <View style={styles.statItem}>
          <Text style={styles.statIcon}>⏰</Text>
          <Text style={styles.statNumber}>{stats.totalHours}</Text>
          <Text style={styles.statLabel}>Hours</Text>
        </View>
      </View>
    );
  };

  const renderInformationSection = () => {
    if (!user) return null;
    
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Information</Text>
        
        <View style={styles.infoItem}>
          <View style={styles.infoIcon}>
            <Text style={styles.infoIconText}>Aa</Text>
          </View>
          <Text style={styles.infoLabel}>Native language</Text>
          <Text style={styles.infoValue}>{user.nativeLanguage || 'Not specified'}</Text>
        </View>
        
        <View style={styles.infoItem}>
          <View style={styles.infoIcon}>
            <Text style={styles.infoIconText}>ENG</Text>
          </View>
          <Text style={styles.infoLabel}>English level</Text>
          <Text style={styles.infoValue}>{formatEnglishLevel(user.englishLevel)}</Text>
        </View>
        
        <View style={styles.infoItem}>
          <View style={styles.infoIcon}>
            <Text style={styles.infoIconText}>♂</Text>
          </View>
          <Text style={styles.infoLabel}>Gender</Text>
          <Text style={styles.infoValue}>{user.gender || 'Not specified'}</Text>
        </View>
        
        <View style={styles.infoItem}>
          <View style={styles.infoIcon}>
            <Text style={styles.infoIconText}>📅</Text>
          </View>
          <Text style={styles.infoLabel}>Age</Text>
          <Text style={styles.infoValue}>{user.age ? `${user.age} years old` : 'Not specified'}</Text>
        </View>
      </View>
    );
  };

  const renderInterestsSection = () => {
    if (!user) return null;
    
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Interests</Text>
        
        {user.interests && user.interests.length > 0 ? (
          <View style={styles.interestsGrid}>
            {user.interests.map((interest, index) => (
              <View key={index} style={styles.interestChip}>
                <Text style={styles.interestText}>{interest}</Text>
              </View>
            ))}
            <TouchableOpacity style={styles.addInterestButton} onPress={openInterestEditor}>
              <Text style={styles.addInterestText}>Add +</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.noInterestsContainer}>
            <Text style={styles.noInterestsText}>No interests added yet</Text>
            <TouchableOpacity style={styles.addInterestButton} onPress={openInterestEditor}>
              <Text style={styles.addInterestText}>Add +</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderRatingSection = () => {
    if (!stats) return null;
    
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Rating</Text>
        
        <View style={styles.ratingCard}>
          <Text style={styles.satisfactionPercentage}>{stats.satisfactionPercentage}%</Text>
          <Text style={styles.satisfactionText}>of users are satisfied with this conversation partner</Text>
        </View>
        
        <View style={styles.ratingStats}>
          <View style={styles.ratingStatItem}>
            <Text style={styles.ratingIcon}>👍</Text>
            <Text style={styles.ratingNumber}>{stats.positiveFeedback}</Text>
          </View>
          
          <View style={styles.ratingStatItem}>
            <Text style={styles.ratingIcon}>👎</Text>
            <Text style={styles.ratingNumber}>{stats.negativeFeedback}</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderComplimentsSection = () => {
    return (
      <View style={styles.section}>
        <TouchableOpacity 
          style={styles.sectionHeader}
          onPress={() => setComplimentsExpanded(!complimentsExpanded)}
        >
          <Text style={styles.sectionTitle}>Compliments</Text>
          <Text style={[styles.chevronIcon, complimentsExpanded && styles.chevronRotated]}>
            {complimentsExpanded ? '⌄' : '›'}
          </Text>
        </TouchableOpacity>
        
        {complimentsExpanded && (
          <View style={styles.complimentsList}>
            {compliments.map((compliment, index) => (
              <View key={index} style={styles.complimentItem}>
                <View style={[
                  styles.complimentBadge,
                  compliment.count === 0 && styles.complimentBadgeEmpty
                ]}>
                  <Text style={styles.complimentCount}>{compliment.count}</Text>
                </View>
                <Text style={[
                  styles.complimentText,
                  compliment.count === 0 && styles.complimentTextEmpty
                ]}>
                  {compliment._id}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderAdviceSection = () => {
    return (
      <View style={styles.section}>
        <TouchableOpacity 
          style={styles.sectionHeader}
          onPress={() => setAdviceExpanded(!adviceExpanded)}
        >
          <Text style={styles.sectionTitle}>Advice</Text>
          <Text style={[styles.chevronIcon, adviceExpanded && styles.chevronRotated]}>
            {adviceExpanded ? '⌄' : '›'}
          </Text>
        </TouchableOpacity>
        
        {adviceExpanded && (
          <View style={styles.adviceList}>
            {advice.map((adviceItem, index) => (
              <View key={index} style={styles.adviceItem}>
                <View style={[
                  styles.adviceBadge,
                  adviceItem.count === 0 && styles.adviceBadgeEmpty
                ]}>
                  <Text style={styles.adviceCount}>{adviceItem.count}</Text>
                </View>
                <Text style={[
                  styles.adviceText,
                  adviceItem.count === 0 && styles.adviceTextEmpty
                ]}>
                  {adviceItem._id}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderFeedbackSection = () => {
    if (!feedback || feedback.length === 0) return null;
    
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Feedback</Text>
          <TouchableOpacity>
            <Text style={styles.chevronIcon}>›</Text>
          </TouchableOpacity>
        </View>
        
        {feedback.slice(0, 3).map((item, index) => (
          <View key={index} style={styles.feedbackItem}>
            <Image 
              source={{ 
                uri: item.feedbackBy.profilePic || 'https://randomuser.me/api/portraits/men/32.jpg' 
              }} 
              style={styles.feedbackAvatar} 
            />
            <View style={styles.feedbackContent}>
              <Text style={styles.feedbackName}>{item.feedbackBy.name}</Text>
              <Text style={styles.feedbackDate}>
                {new Date(item.createdAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </Text>
            </View>
            <View style={styles.feedbackIcon}>
              <Text style={styles.feedbackEmoji}>
                {item.feedbackType === 'positive' ? '👍' : '👎'}
              </Text>
            </View>
          </View>
        ))}
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
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <ScrollView 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#4A90E2']}
            tintColor="#4A90E2"
          />
        }
      >
        {renderProfileHeader()}
        
        {/* Stats Row */}
        {renderStatsRow()}
        
        {/* Information Section */}
        {renderInformationSection()}
        
        {/* Interests Section */}
        {renderInterestsSection()}
        
        {/* Rating Section */}
        {renderRatingSection()}
        
        {/* Compliments Section */}
        {renderComplimentsSection()}
        
        {/* Advice Section */}
        {renderAdviceSection()}
        
        {/* Feedback Section */}
        {renderFeedbackSection()}
        
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={styles.logoutButton}
            onPress={handleLogout}
          >
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.settingsButton}>
            <Text style={styles.settingsButtonText}>Settings</Text>
          </TouchableOpacity>
        </View>
        
        {/* Test Notification Button */}
        <View style={styles.testContainer}>
          <TouchableOpacity 
            style={styles.testButton}
            onPress={handleTestNotification}
          >
            <Text style={styles.testButtonText}>🔔 Test Push Notification</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      {renderInterestsModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  profileImageContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#FF8C00',
  },
  levelBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: '#666666',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  levelBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  crownIcon: {
    position: 'absolute',
    top: -8,
    right: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  crownText: {
    fontSize: 12,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
  },
  bioText: {
    fontSize: 16,
    color: '#333333',
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 20,
    fontStyle: 'italic',
  },
  editButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    backgroundColor: '#F5F5F5',
    marginTop: 8,
  },
  editButtonText: {
    color: '#333333',
    fontWeight: '600',
    fontSize: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 20,
    marginHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statItem: {
    alignItems: 'center',
  },
  statIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#666666',
  },
  section: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginHorizontal: 16,
    borderRadius: 12,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 16,
  },
  chevronIcon: {
    fontSize: 20,
    color: '#666666',
    transform: [{ rotate: '0deg' }],
  },
  chevronRotated: {
    transform: [{ rotate: '90deg' }],
  },
  complimentsList: {
    marginTop: 8,
  },
  adviceList: {
    marginTop: 8,
  },
  noDataText: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
    paddingVertical: 16,
    fontStyle: 'italic',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  infoIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoIconText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  infoLabel: {
    fontSize: 16,
    color: '#333333',
    flex: 1,
  },
  infoValue: {
    fontSize: 16,
    color: '#666666',
  },
  interestsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestChip: {
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
  },
  interestText: {
    fontSize: 14,
    color: '#333333',
  },
  interestModalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
  },
  interestModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    paddingTop: 12,
  },
  interestBackButton: {
    paddingRight: 12,
    paddingVertical: 6,
  },
  interestModalTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '600',
    color: '#2C2C47',
  },
  interestHeaderSpacer: {
    width: 26,
  },
  interestInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5FA',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  interestInput: {
    flex: 1,
    fontSize: 16,
    color: '#2C2C47',
    paddingVertical: 8,
  },
  interestAddButton: {
    marginLeft: 12,
    backgroundColor: '#6C5CE7',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  interestAddButtonDisabled: {
    backgroundColor: '#C9C5F5',
  },
  interestAddButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  interestErrorText: {
    color: '#E74C3C',
    marginTop: 8,
    marginBottom: 4,
  },
  interestModalList: {
    flex: 1,
  },
  interestModalScroll: {
    paddingVertical: 20,
  },
  interestChipsWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  interestEditChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1EFFF',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 10,
  },
  interestEditChipText: {
    fontSize: 14,
    color: '#4A4A62',
    marginRight: 8,
  },
  interestChipRemove: {
    padding: 4,
  },
  interestEmptyState: {
    paddingVertical: 40,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  interestEmptyText: {
    fontSize: 15,
    color: '#8B8BA4',
    textAlign: 'center',
  },
  interestDoneButton: {
    backgroundColor: '#6C5CE7',
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    marginHorizontal: 10,
    marginBottom: 24,
  },
  interestDoneButtonDisabled: {
    opacity: 0.6,
  },
  interestDoneButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  addInterestButton: {
    backgroundColor: '#E5E5E5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
  },
  addInterestText: {
    fontSize: 14,
    color: '#666666',
  },
  noInterestsContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  noInterestsText: {
    fontSize: 14,
    color: '#999999',
    marginBottom: 12,
  },
  ratingCard: {
    backgroundColor: '#E8F5E8',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  satisfactionPercentage: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 8,
  },
  satisfactionText: {
    fontSize: 14,
    color: '#333333',
    textAlign: 'center',
  },
  ratingStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  ratingStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  ratingIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  ratingNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
  },
  feedbackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  feedbackAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  feedbackContent: {
    flex: 1,
  },
  feedbackName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },
  feedbackDate: {
    fontSize: 14,
    color: '#666666',
  },
  feedbackIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  feedbackEmoji: {
    fontSize: 16,
  },
  complimentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  complimentBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  complimentCount: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  complimentText: {
    fontSize: 14,
    color: '#333333',
    flex: 1,
  },
  complimentBadgeEmpty: {
    backgroundColor: '#E0E0E0',
  },
  complimentTextEmpty: {
    color: '#999999',
  },
  adviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  adviceBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#9C27B0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  adviceCount: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  adviceText: {
    fontSize: 14,
    color: '#333333',
    flex: 1,
  },
  adviceBadgeEmpty: {
    backgroundColor: '#E0E0E0',
  },
  adviceTextEmpty: {
    color: '#999999',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginHorizontal: 16,
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginTop: 8,
  },
  logoutButton: {
    flex: 1,
    backgroundColor: '#F2F2F2',
    paddingVertical: 12,
    borderRadius: 50,
    marginRight: 8,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: '#666666',
    fontWeight: '600',
    fontSize: 16,
  },
  settingsButton: {
    flex: 1,
    backgroundColor: '#4A90E2',
    paddingVertical: 12,
    borderRadius: 50,
    marginLeft: 8,
    alignItems: 'center',
  },
  settingsButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  testContainer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  testButton: {
    backgroundColor: '#FF6B6B',
    paddingVertical: 12,
    borderRadius: 25,
    alignItems: 'center',
    marginBottom: 20,
  },
  testButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
});

export default ProfileScreen;