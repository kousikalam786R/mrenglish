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
import apiClient from '../utils/apiClient';
import Toast from 'react-native-toast-message';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { updateUserProfile } from '../utils/profileService';
import { setUserData } from '../redux/slices/userSlice';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';

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
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();
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
  
  const handleOpenSettings = () => {
    navigation.navigate('Settings');
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
      <View style={[styles.profileHeader, { backgroundColor: theme.card }]}>
        <TouchableOpacity
          style={[styles.settingsIconButton, { backgroundColor: theme.primary + '15' }]}
          onPress={handleOpenSettings}
          accessibilityRole="button"
          accessibilityLabel="Open settings"
        >
          <Ionicons name="settings-outline" size={22} color={theme.text} />
        </TouchableOpacity>
        <View style={styles.profileImageContainer}>
          <Image 
            source={{ 
              uri: user.profilePic || 'https://randomuser.me/api/portraits/men/32.jpg' 
            }} 
            style={[styles.avatar, { borderColor: theme.warning }]} 
          />
          <View style={[styles.levelBadge, { backgroundColor: theme.textTertiary }]}>
            <Text style={styles.levelBadgeText}>{user.englishLevel || 'A2'}</Text>
          </View>
          <View style={[styles.crownIcon, { backgroundColor: theme.card }]}>
            <Text style={styles.crownText}>👑</Text>
          </View>
        </View>
        
        <Text style={[styles.userName, { color: theme.text }]}>{user.name || 'User'}</Text>
        
        {user.bio && (
          <Text style={[styles.bioText, { color: theme.textSecondary }]}>"{user.bio}"</Text>
        )}
        
        <TouchableOpacity 
          style={[styles.editButton, { backgroundColor: theme.inputBackground }]}
          onPress={handleEditProfile}
        >
          <Text style={[styles.editButtonText, { color: theme.text }]}>Edit profile</Text>
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
      <SafeAreaView style={[styles.interestModalContainer, { backgroundColor: theme.background }]}>
        <View style={[styles.interestModalHeader, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
          <TouchableOpacity
            style={styles.interestBackButton}
            onPress={() => setInterestModalVisible(false)}
          >
            <Ionicons name="chevron-back" size={26} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.interestModalTitle, { color: theme.text }]}>{t('profile.interests')}</Text>
          <View style={styles.interestHeaderSpacer} />
        </View>

        <View style={[styles.interestInputRow, { backgroundColor: theme.inputBackground }]}>
          <TextInput
            style={[styles.interestInput, { color: theme.text }]}
            placeholder={t('profile.addYourInterest')}
            placeholderTextColor={theme.textTertiary}
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
              { backgroundColor: theme.primary },
              interestInput.trim().length === 0 && { backgroundColor: theme.inputBackground, opacity: 0.5 },
            ]}
            onPress={handleAddInterest}
            disabled={interestInput.trim().length === 0}
          >
            <Text style={styles.interestAddButtonText}>Add</Text>
          </TouchableOpacity>
        </View>

        {interestError ? <Text style={[styles.interestErrorText, { color: theme.error }]}>{interestError}</Text> : null}

        <ScrollView
          style={styles.interestModalList}
          contentContainerStyle={styles.interestModalScroll}
          keyboardShouldPersistTaps="handled"
        >
          {pendingInterests.length > 0 ? (
            <View style={styles.interestChipsWrapper}>
              {pendingInterests.map((interest, index) => (
                <View key={`${interest}-${index}`} style={[styles.interestEditChip, { backgroundColor: theme.primary + '15', borderColor: theme.primary + '30' }]}>
                  <Text style={[styles.interestEditChipText, { color: theme.primary }]}>{interest}</Text>
                  <TouchableOpacity
                    style={styles.interestChipRemove}
                    onPress={() => handleRemoveInterest(interest)}
                  >
                    <Ionicons name="close" size={16} color={theme.text} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.interestEmptyState}>
              <Text style={[styles.interestEmptyText, { color: theme.textSecondary }]}>
                Add a few interests so partners know what to chat about.
              </Text>
            </View>
          )}
        </ScrollView>

        <TouchableOpacity
          style={[
            styles.interestDoneButton,
            { backgroundColor: theme.primary },
            savingInterests && { opacity: 0.7 },
          ]}
          onPress={handleSaveInterests}
          disabled={savingInterests}
        >
          {savingInterests ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.interestDoneButtonText}>{t('common.done')}</Text>
          )}
        </TouchableOpacity>
      </SafeAreaView>
    </Modal>
  );

  const renderStatsRow = () => {
    if (!stats) return null;
    
    return (
      <View style={[styles.statsRow, { backgroundColor: theme.card }]}>
        <View style={styles.statItem}>
          <Text style={styles.statIcon}>💬</Text>
          <Text style={[styles.statNumber, { color: theme.text }]}>{stats.positiveFeedback + stats.negativeFeedback}</Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{t('profile.stats.feedback')}</Text>
        </View>
        
        <View style={styles.statItem}>
          <Text style={styles.statIcon}>📞</Text>
          <Text style={[styles.statNumber, { color: theme.text }]}>{stats.totalCalls}</Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{t('profile.stats.talks')}</Text>
        </View>
        
        <View style={styles.statItem}>
          <Text style={styles.statIcon}>⏰</Text>
          <Text style={[styles.statNumber, { color: theme.text }]}>{stats.totalHours}</Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{t('profile.stats.hours')}</Text>
        </View>
      </View>
    );
  };

  const renderInformationSection = () => {
    if (!user) return null;
    
    return (
      <View style={[styles.section, { backgroundColor: theme.card }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Information</Text>
        
        <View style={[styles.infoItem, { borderBottomColor: theme.border }]}>
          <View style={[styles.infoIcon, { backgroundColor: theme.primary + '15' }]}>
            <Text style={[styles.infoIconText, { color: theme.primary }]}>Aa</Text>
          </View>
          <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>{t('profile.nativeLanguage')}</Text>
          <Text style={[styles.infoValue, { color: theme.text }]}>{user.nativeLanguage || t('profile.notSpecified')}</Text>
        </View>
        
        <View style={[styles.infoItem, { borderBottomColor: theme.border }]}>
          <View style={[styles.infoIcon, { backgroundColor: theme.primary + '15' }]}>
            <Text style={[styles.infoIconText, { color: theme.primary }]}>ENG</Text>
          </View>
          <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>{t('profile.englishLevel')}</Text>
          <Text style={[styles.infoValue, { color: theme.text }]}>{formatEnglishLevel(user.englishLevel)}</Text>
        </View>
        
        <View style={[styles.infoItem, { borderBottomColor: theme.border }]}>
          <View style={[styles.infoIcon, { backgroundColor: theme.primary + '15' }]}>
            <Text style={[styles.infoIconText, { color: theme.primary }]}>♂</Text>
          </View>
          <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>{t('profile.gender')}</Text>
          <Text style={[styles.infoValue, { color: theme.text }]}>{user.gender || t('profile.notSpecified')}</Text>
        </View>
        
        <View style={[styles.infoItem, { borderBottomColor: theme.border }]}>
          <View style={[styles.infoIcon, { backgroundColor: theme.primary + '15' }]}>
            <Text style={[styles.infoIconText, { color: theme.primary }]}>📅</Text>
          </View>
          <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>{t('profile.age')}</Text>
          <Text style={[styles.infoValue, { color: theme.text }]}>{user.age ? `${user.age} ${t('profile.yearsOld', { defaultValue: 'years old' })}` : t('profile.notSpecified')}</Text>
        </View>
      </View>
    );
  };

  const renderInterestsSection = () => {
    if (!user) return null;
    
    return (
      <View style={[styles.section, { backgroundColor: theme.card }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('profile.interests')}</Text>
        
        {user.interests && user.interests.length > 0 ? (
          <View style={styles.interestsGrid}>
            {user.interests.map((interest, index) => (
              <View key={index} style={[styles.interestChip, { backgroundColor: theme.primary + '15', borderColor: theme.primary + '30' }]}>
                <Text style={[styles.interestText, { color: theme.primary }]}>{interest}</Text>
              </View>
            ))}
            <TouchableOpacity style={[styles.addInterestButton, { backgroundColor: theme.primary }]} onPress={openInterestEditor}>
              <Text style={[styles.addInterestText, { color: '#FFFFFF' }]}>{t('profile.addInterest')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.noInterestsContainer, { backgroundColor: theme.card }]}>
            <Text style={[styles.noInterestsText, { color: theme.textSecondary }]}>{t('profile.noInterests')}</Text>
            <TouchableOpacity style={[styles.addInterestButton, { backgroundColor: theme.primary }]} onPress={openInterestEditor}>
              <Text style={[styles.addInterestText, { color: '#FFFFFF' }]}>{t('profile.addInterest')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderRatingSection = () => {
    if (!stats) return null;
    
    return (
      <View style={[styles.section, { backgroundColor: theme.card }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('profile.rating')}</Text>
        
        <View style={[styles.ratingCard, { backgroundColor: theme.success + '20' }]}>
          <Text style={[styles.satisfactionPercentage, { color: theme.success }]}>{stats.satisfactionPercentage}%</Text>
          <Text style={[styles.satisfactionText, { color: theme.textSecondary }]}>{t('profile.stats.satisfactionPercentage')}</Text>
        </View>
        
        <View style={styles.ratingStats}>
          <View style={[styles.ratingStatItem, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={styles.ratingIcon}>👍</Text>
            <Text style={[styles.ratingNumber, { color: theme.text }]}>{stats.positiveFeedback}</Text>
          </View>
          
          <View style={[styles.ratingStatItem, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={styles.ratingIcon}>👎</Text>
            <Text style={[styles.ratingNumber, { color: theme.text }]}>{stats.negativeFeedback}</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderComplimentsSection = () => {
    return (
      <View style={[styles.section, { backgroundColor: theme.card }]}>
        <TouchableOpacity 
          style={styles.sectionHeader}
          onPress={() => setComplimentsExpanded(!complimentsExpanded)}
        >
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('profile.compliments')}</Text>
          <Text style={[styles.chevronIcon, { color: theme.textSecondary }, complimentsExpanded && styles.chevronRotated]}>
            {complimentsExpanded ? '⌄' : '›'}
          </Text>
        </TouchableOpacity>
        
        {complimentsExpanded && (
          <View style={styles.complimentsList}>
            {compliments.map((compliment, index) => (
              <View key={index} style={[styles.complimentItem, { borderBottomColor: theme.border }]}>
                <View style={[
                  styles.complimentBadge,
                  { backgroundColor: compliment.count === 0 ? theme.inputBackground : theme.primary + '15' },
                  compliment.count === 0 && styles.complimentBadgeEmpty
                ]}>
                  <Text style={[styles.complimentCount, { color: compliment.count === 0 ? theme.textTertiary : theme.primary }]}>{compliment.count}</Text>
                </View>
                <Text style={[
                  styles.complimentText,
                  { color: compliment.count === 0 ? theme.textTertiary : theme.text },
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
      <View style={[styles.section, { backgroundColor: theme.card }]}>
        <TouchableOpacity 
          style={styles.sectionHeader}
          onPress={() => setAdviceExpanded(!adviceExpanded)}
        >
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('profile.advice')}</Text>
          <Text style={[styles.chevronIcon, { color: theme.textSecondary }, adviceExpanded && styles.chevronRotated]}>
            {adviceExpanded ? '⌄' : '›'}
          </Text>
        </TouchableOpacity>
        
        {adviceExpanded && (
          <View style={styles.adviceList}>
            {advice.map((adviceItem, index) => (
              <View key={index} style={[styles.adviceItem, { borderBottomColor: theme.border }]}>
                <View style={[
                  styles.adviceBadge,
                  { backgroundColor: adviceItem.count === 0 ? theme.inputBackground : theme.warning + '15' },
                  adviceItem.count === 0 && styles.adviceBadgeEmpty
                ]}>
                  <Text style={[styles.adviceCount, { color: adviceItem.count === 0 ? theme.textTertiary : theme.warning }]}>{adviceItem.count}</Text>
                </View>
                <Text style={[
                  styles.adviceText,
                  { color: adviceItem.count === 0 ? theme.textTertiary : theme.text },
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
      <View style={[styles.section, { backgroundColor: theme.card }]}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('profile.feedback')}</Text>
          <TouchableOpacity>
            <Text style={[styles.chevronIcon, { color: theme.textSecondary }]}>›</Text>
          </TouchableOpacity>
        </View>
        
        {feedback.slice(0, 3).map((item, index) => (
          <View key={index} style={[styles.feedbackItem, { borderBottomColor: theme.border }]}>
            <Image 
              source={{ 
                uri: item.feedbackBy.profilePic || 'https://randomuser.me/api/portraits/men/32.jpg' 
              }} 
              style={styles.feedbackAvatar} 
            />
            <View style={styles.feedbackContent}>
              <Text style={[styles.feedbackName, { color: theme.text }]}>{item.feedbackBy.name}</Text>
              <Text style={[styles.feedbackDate, { color: theme.textSecondary }]}>
                {new Date(item.createdAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </Text>
              {item.message?.trim() ? (
                <Text style={[styles.feedbackMessage, { color: theme.textSecondary }]}>
                  {item.message.trim()}
                </Text>
              ) : null}
            </View>
            <View style={[styles.feedbackIcon, { backgroundColor: theme.primary + '15' }]}>
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
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }
  
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.surface }]} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={theme.background} />
      <ScrollView 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.primary]}
            tintColor={theme.primary}
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

        {/* Test Notification Button */}
        {/* <View style={styles.testContainer}>
          <TouchableOpacity 
            style={[styles.testButton, { backgroundColor: theme.error }]}
            onPress={handleTestNotification}
          >
            <Text style={styles.testButtonText}>🔔 Test Push Notification</Text>
          </TouchableOpacity>
        </View> */}
      </ScrollView>
      {renderInterestsModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
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
  settingsIconButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
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
  },
  levelBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
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
    marginBottom: 8,
  },
  bioText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 20,
    fontStyle: 'italic',
  },
  editButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 8,
  },
  editButtonText: {
    fontWeight: '600',
    fontSize: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
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
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
  },
  section: {
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
    marginBottom: 16,
  },
  chevronIcon: {
    fontSize: 20,
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
    textAlign: 'center',
    paddingVertical: 16,
    fontStyle: 'italic',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  infoIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
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
    flex: 1,
  },
  infoValue: {
    fontSize: 16,
  },
  interestsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
  },
  interestText: {
    fontSize: 14,
  },
  interestModalContainer: {
    flex: 1,
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
  },
  interestHeaderSpacer: {
    width: 26,
  },
  interestInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  interestInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 8,
  },
  interestAddButton: {
    marginLeft: 12,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  interestAddButtonDisabled: {
    opacity: 0.5,
  },
  interestAddButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  interestErrorText: {
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
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 10,
  },
  interestEditChipText: {
    fontSize: 14,
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
    textAlign: 'center',
  },
  interestDoneButton: {
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
  },
  addInterestText: {
    fontSize: 14,
  },
  noInterestsContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  noInterestsText: {
    fontSize: 14,
    marginBottom: 12,
  },
  ratingCard: {
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  satisfactionPercentage: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  satisfactionText: {
    fontSize: 14,
    textAlign: 'center',
  },
  ratingStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  ratingStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  ratingIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  ratingNumber: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  feedbackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
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
    marginBottom: 4,
  },
  feedbackDate: {
    fontSize: 14,
  },
  feedbackMessage: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  feedbackIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
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
    borderBottomWidth: 1,
  },
  complimentBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
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
    flex: 1,
  },
  complimentBadgeEmpty: {
  },
  complimentTextEmpty: {
  },
  adviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  adviceBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
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
    flex: 1,
  },
  adviceBadgeEmpty: {
  },
  adviceTextEmpty: {
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  testContainer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  testButton: {
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