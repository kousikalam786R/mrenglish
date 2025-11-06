import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/types';
import Icon from 'react-native-vector-icons/Ionicons';
import IconMaterial from 'react-native-vector-icons/MaterialIcons';
import { API_URL } from '../utils/config';
import { getAuthToken } from '../utils/authUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';
import simpleUserStatusService from '../services/simpleUserStatusService';
import { useUserStatus } from '../hooks/useUserStatus';
import Toast from 'react-native-toast-message';

// Interface for the user profile data
interface UserProfile {
  _id: string;
  name: string;
  profilePic?: string;
  level?: string;
  country?: string;
  gender?: string;
  age?: number;
  isOnline?: boolean;
  isFavorite?: boolean;
  isBlocked?: boolean;
  nativeLanguage?: string;
  feedback?: number;
  talks?: number;
  hours?: number;
  location?: string;
  rating?: number;
  englishLevel?: string;
}

// Interface for user stats from rating summary
interface UserStats {
  totalRatings: number;
  averageRating: number;
  positiveFeedback: number;
  negativeFeedback: number;
  satisfactionPercentage: number;
  totalCalls: number;
  totalHours: number;
  totalMinutes: number;
}

// Interface for rating summary
interface RatingSummary {
  stats: UserStats;
  recentRatings: any[];
  recentFeedback: any[];
  compliments: Array<{ _id: string; count: number }>;
  advice: Array<{ _id: string; count: number }>;
}

type UserProfileScreenProps = NativeStackScreenProps<RootStackParamList, 'UserProfile'>;

const UserProfileScreen: React.FC<UserProfileScreenProps> = ({ route, navigation }) => {
  const { userId, userName } = route.params;
  const [user, setUser] = useState<UserProfile | null>(null);
  const [ratingSummary, setRatingSummary] = useState<RatingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [isBlockedByUser, setIsBlockedByUser] = useState(false); // If current user is blocked by profile owner
  
  // Get real-time user status from status service
  const userStatus = useUserStatus(userId);

  // Fetch user profile data
  const fetchUserProfile = React.useCallback(async () => {
    try {
      setLoading(true);
      setIsBlockedByUser(false); // Reset blocked state at the start of fetch
      
      // Get token for API request
      const token = await getAuthToken();
      
      // Fetch user profile from API
      const userResponse = await fetch(`${API_URL}/auth/users/${userId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      // Check if user is blocked by profile owner (404 status with blocked flag)
      // Backend returns 404 to make it appear as if user doesn't exist
      if (userResponse.status === 404) {
        try {
          const errorData = await userResponse.json();
          if (errorData.blocked) {
            setIsBlockedByUser(true);
            setLoading(false);
            return;
          }
        } catch (e) {
          // If JSON parsing fails, treat as regular 404
          setIsBlockedByUser(true);
          setLoading(false);
          return;
        }
      }
      
      if (!userResponse.ok) {
        throw new Error('Failed to fetch user profile');
      }
      
      const userData = await userResponse.json();
      setIsBlockedByUser(false); // Reset blocked state if profile loads successfully
      
      // Fetch user rating summary
      let ratingData: RatingSummary | null = null;
      try {
        const ratingResponse = await fetch(`${API_URL}/ratings/summary/${userId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (ratingResponse.ok) {
          const ratingJson = await ratingResponse.json();
          ratingData = ratingJson.data;
          setRatingSummary(ratingData);
        }
      } catch (ratingError) {
        console.error('Error fetching rating summary:', ratingError);
        // Continue without rating data
      }
      
      // Check if user is in favorites and blocked - check from backend for accuracy (single API call)
      let isUserFavorite = false;
      let isUserBlocked = false;
      try {
        const currentUserResponse = await fetch(`${API_URL}/auth/me`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (currentUserResponse.ok) {
          const currentUserData = await currentUserResponse.json();
          const currentUser = currentUserData.user || currentUserData; // Handle both response formats
          
          // Check favorites
          if (currentUser.favorites && Array.isArray(currentUser.favorites)) {
            isUserFavorite = currentUser.favorites.some((favId: any) => {
              const favIdStr = favId.toString ? favId.toString() : String(favId);
              return favIdStr === userId;
            });
          }
          
          // Check blocked users
          if (currentUser.blockedUsers && Array.isArray(currentUser.blockedUsers)) {
            isUserBlocked = currentUser.blockedUsers.some((blockedId: any) => {
              const blockedIdStr = blockedId.toString ? blockedId.toString() : String(blockedId);
              return blockedIdStr === userId;
            });
          }
        }
      } catch (statusCheckError) {
        console.error('Error checking user status from backend:', statusCheckError);
        // Fallback to AsyncStorage if backend check fails
        const favoritesString = await AsyncStorage.getItem('favorites');
        const favorites = favoritesString ? JSON.parse(favoritesString) : [];
        isUserFavorite = favorites.some((favUser: any) => favUser._id === userId);
        
        const blockedUsersString = await AsyncStorage.getItem('blockedUsers');
        const blockedUsers = blockedUsersString ? JSON.parse(blockedUsersString) : [];
        isUserBlocked = blockedUsers.some((blockedUser: any) => blockedUser._id === userId);
      }
      
      // Sync AsyncStorage with backend result for favorites
      if (isUserFavorite) {
        const favoritesString = await AsyncStorage.getItem('favorites');
        const favorites = favoritesString ? JSON.parse(favoritesString) : [];
        const alreadyInStorage = favorites.some((favUser: any) => favUser._id === userId);
        if (!alreadyInStorage && userData) {
          const userToAdd = {
            _id: userData._id,
            name: userData.name,
            profilePic: userData.profilePic,
            level: userData.englishLevel || userData.level,
            country: userData.country
          };
          favorites.push(userToAdd);
          await AsyncStorage.setItem('favorites', JSON.stringify(favorites));
        }
      } else {
        // Remove from AsyncStorage if not favorite
        const favoritesString = await AsyncStorage.getItem('favorites');
        const favorites = favoritesString ? JSON.parse(favoritesString) : [];
        const updatedFavorites = favorites.filter((favUser: any) => favUser._id !== userId);
        await AsyncStorage.setItem('favorites', JSON.stringify(updatedFavorites));
      }
      
      // Sync AsyncStorage with backend result for blocked users
      if (isUserBlocked) {
        const blockedUsersString = await AsyncStorage.getItem('blockedUsers');
        const blockedUsers = blockedUsersString ? JSON.parse(blockedUsersString) : [];
        const alreadyInStorage = blockedUsers.some((blockedUser: any) => blockedUser._id === userId);
        if (!alreadyInStorage && userData) {
          const userToBlock = {
            _id: userData._id,
            name: userData.name,
            profilePic: userData.profilePic,
            level: userData.englishLevel || userData.level,
            country: userData.country
          };
          blockedUsers.push(userToBlock);
          await AsyncStorage.setItem('blockedUsers', JSON.stringify(blockedUsers));
        }
      } else {
        // Remove from AsyncStorage if not blocked
        const blockedUsersString = await AsyncStorage.getItem('blockedUsers');
        const blockedUsers = blockedUsersString ? JSON.parse(blockedUsersString) : [];
        const updatedBlockedUsers = blockedUsers.filter((blockedUser: any) => blockedUser._id !== userId);
        await AsyncStorage.setItem('blockedUsers', JSON.stringify(updatedBlockedUsers));
      }
      
      // Use real stats from rating summary if available
      const totalFeedback = ratingData 
        ? ratingData.stats.positiveFeedback + ratingData.stats.negativeFeedback 
        : 0;
      const totalCalls = ratingData?.stats.totalCalls || 0;
      const totalHours = ratingData?.stats.totalHours || 0;
      const satisfactionPercentage = ratingData?.stats.satisfactionPercentage || 0;
      
      setUser({
        ...userData,
        level: userData.englishLevel || userData.level,
        feedback: totalFeedback,
        talks: totalCalls,
        hours: totalHours,
        rating: satisfactionPercentage,
        isFavorite: isUserFavorite,
        isBlocked: isUserBlocked
      });
      setIsFavorite(isUserFavorite);
      setIsBlocked(isUserBlocked);
      } catch (error) {
        console.error('Error fetching user profile:', error);
        Alert.alert(
          'Error Loading Profile',
          'Failed to load user profile. Please check your connection and try again.'
        );
        
        // Still check favorites and blocks even if profile fetch fails
        try {
          const favoritesString = await AsyncStorage.getItem('favorites');
          const favorites = favoritesString ? JSON.parse(favoritesString) : [];
          const isUserFavorite = favorites.some((favUser: any) => favUser._id === userId);
          
          const blockedUsersString = await AsyncStorage.getItem('blockedUsers');
          const blockedUsers = blockedUsersString ? JSON.parse(blockedUsersString) : [];
          const isUserBlocked = blockedUsers.some((blockedUser: any) => blockedUser._id === userId);
          
          setIsFavorite(isUserFavorite);
          setIsBlocked(isUserBlocked);
        } catch (storageError) {
          console.error('Error checking stored data:', storageError);
        }
      } finally {
        setLoading(false);
      }
    }, [userId]);

  // Fetch profile when component mounts
  useEffect(() => {
    fetchUserProfile();
  }, [fetchUserProfile]);

  // Refetch profile when screen comes into focus (e.g., after unblocking)
  useFocusEffect(
    React.useCallback(() => {
      fetchUserProfile();
    }, [fetchUserProfile])
  );

  // Toggle favorite status
  const toggleFavorite = async () => {
    try {
      const token = await getAuthToken();
      
      // Call backend API first - ONLY update frontend if API call succeeds
      const response = await fetch(`${API_URL}/auth/users/${userId}/favorite`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ favorite: !isFavorite })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update friends list');
      }
      
      // Only update frontend if API call was successful
      const responseData = await response.json();
      if (responseData.success) {
        const favoritesString = await AsyncStorage.getItem('favorites');
        const favorites = favoritesString ? JSON.parse(favoritesString) : [];
        
        if (isFavorite) {
          // Remove from favorites
          const updatedFavorites = favorites.filter((favUser: any) => favUser._id !== userId);
          await AsyncStorage.setItem('favorites', JSON.stringify(updatedFavorites));
          setIsFavorite(false);
          
          if (user) {
            setUser({ ...user, isFavorite: false });
          }
          
          Toast.show({
            type: 'info',
            text1: 'Removed from Friends',
            text2: `${userName} has been removed from your friends list`,
            position: 'top',
            visibilityTime: 3000,
          });
        } else {
          // Add to favorites
          if (user) {
            const userToAdd = {
              _id: user._id,
              name: user.name,
              profilePic: user.profilePic,
              level: user.level,
              country: user.country
            };
            
            favorites.push(userToAdd);
            await AsyncStorage.setItem('favorites', JSON.stringify(favorites));
            setIsFavorite(true);
            setUser({ ...user, isFavorite: true });
            
            Toast.show({
              type: 'success',
              text1: 'Added to Friends',
              text2: `${userName} has been added to your friends list`,
              position: 'top',
              visibilityTime: 3000,
            });
          }
        }
      } else {
        throw new Error(responseData.message || 'Failed to update friends list');
      }
    } catch (error: any) {
      console.error('Error updating favorites:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to update friends list. Please try again.',
        position: 'top',
        visibilityTime: 3000,
      });
    }
  };

  // Block user function
  const blockUser = async () => {
    try {
      // Check if already blocked
      if (isBlocked) {
        // Unblock user - sync with backend
        const token = await getAuthToken();
        const response = await fetch(`${API_URL}/auth/users/${userId}/block`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ block: false })
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to unblock user');
        }
        
        // Also update local storage
        const blockedUsersString = await AsyncStorage.getItem('blockedUsers');
        const blockedUsers = blockedUsersString ? JSON.parse(blockedUsersString) : [];
        const updatedBlockedUsers = blockedUsers.filter((blockedUser: any) => blockedUser._id !== userId);
        await AsyncStorage.setItem('blockedUsers', JSON.stringify(updatedBlockedUsers));
        
        // Update state immediately
        setIsBlocked(false);
        if (user) {
          setUser({ ...user, isBlocked: false });
        }
        
        // Refetch profile to update the view
        await fetchUserProfile();
        
        Toast.show({
          type: 'success',
          text1: 'Unblocked',
          text2: `${userName} has been unblocked`,
          position: 'top',
          visibilityTime: 3000,
        });
      } else {
        // Show confirmation modal
        setShowBlockModal(true);
      }
    } catch (error: any) {
      console.error('Error updating blocked users:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to update blocked users. Please try again.',
        position: 'top',
        visibilityTime: 3000,
      });
    }
  };
  
  // Confirm block user
  const confirmBlockUser = async () => {
    try {
      const token = await getAuthToken();
      
      // Sync with backend first
      const response = await fetch(`${API_URL}/auth/users/${userId}/block`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ block: true })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to block user');
      }
      
      // Also update local storage for backward compatibility
      const blockedUsersString = await AsyncStorage.getItem('blockedUsers');
      const blockedUsers = blockedUsersString ? JSON.parse(blockedUsersString) : [];
      
      if (user) {
        // Add to blocked users
        const userToBlock = {
          _id: user._id,
          name: user.name,
          profilePic: user.profilePic,
          level: user.level,
          country: user.country
        };
        
        // Check if already blocked before adding
        const alreadyBlocked = blockedUsers.some((blockedUser: any) => blockedUser._id === userId);
        if (!alreadyBlocked) {
          blockedUsers.push(userToBlock);
          await AsyncStorage.setItem('blockedUsers', JSON.stringify(blockedUsers));
        }
        
        // Also remove from favorites if they are a favorite
        if (isFavorite) {
          const favoritesString = await AsyncStorage.getItem('favorites');
          const favorites = favoritesString ? JSON.parse(favoritesString) : [];
          const updatedFavorites = favorites.filter((favUser: any) => favUser._id !== userId);
          await AsyncStorage.setItem('favorites', JSON.stringify(updatedFavorites));
          setIsFavorite(false);
        }
        
        // Update state immediately
        setIsBlocked(true);
        if (user) {
          setUser({ ...user, isBlocked: true, isFavorite: false });
        }
        setShowBlockModal(false);
        
        Toast.show({
          type: 'success',
          text1: 'User Blocked',
          text2: `${userName} has been blocked`,
          position: 'top',
          visibilityTime: 3000,
        });
        
        // Navigate back after successful block
        navigation.goBack();
      }
    } catch (error: any) {
      console.error('Error blocking user:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to block user. Please try again.',
        position: 'top',
        visibilityTime: 3000,
      });
      setShowBlockModal(false);
    }
  };

  // Handle call user
  const handleCallUser = () => {
    // Don't allow calling blocked users
    if (isBlocked) {
      Alert.alert('Blocked', 'You cannot call a blocked user');
      return;
    }
    
    navigation.navigate('CallScreen', { 
      id: userId, 
      name: userName, 
      isVideoCall: false 
    });
  };

  // Handle video call user
  const handleVideoCallUser = () => {
    // Don't allow calling blocked users
    if (isBlocked) {
      Alert.alert('Blocked', 'You cannot call a blocked user');
      return;
    }
    
    navigation.navigate('CallScreen', { 
      id: userId, 
      name: userName, 
      isVideoCall: true 
    });
  };

  // Handle message user
  const handleMessageUser = () => {
    // Show toast for blocked users
    if (isBlocked) {
      Toast.show({
        type: 'error',
        text1: 'Blocked',
        text2: 'You cannot chat with user you blocked',
      });
      return;
    }
    
    navigation.navigate('ChatDetail', { 
      id: userId, 
      name: userName 
    });
  };

  // Show blocked message if user is blocked by profile owner
  if (isBlockedByUser) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => navigation.goBack()}
          >
            <Icon name="chevron-back" size={28} color="#000" />
          </TouchableOpacity>
        </View>
        <View style={styles.blockedContainer}>
          <View style={styles.userNotFoundIconContainer}>
            <IconMaterial name="person-off" size={80} color="#999" />
          </View>
          <Text style={styles.blockedTitle}>User Not Found</Text>
          <Text style={styles.blockedMessage}>
            This user doesn't exist or may have been removed from the platform.
          </Text>
          <TouchableOpacity 
            style={styles.goBackButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.goBackButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (loading || !user) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.loadingContainer}>
          <Text>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header with back button and like */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <Icon name="chevron-back" size={28} color="#000" />
        </TouchableOpacity>
        
        {/* Only show favorite button if user is not blocked */}
        {!isBlocked && (
          <TouchableOpacity 
            style={styles.likeButton} 
            onPress={toggleFavorite}
          >
            <Icon 
              name={isFavorite ? "heart" : "heart-outline"} 
              size={28} 
              color={isFavorite ? "red" : "#000"} 
            />
          </TouchableOpacity>
        )}
      </View>
      
      <ScrollView style={styles.scrollView}>
        {/* Profile section */}
        <View style={styles.profileSection}>
          <View style={styles.profileImageContainer}>
            <Image 
              source={{ uri: user.profilePic || 'https://randomuser.me/api/portraits/women/44.jpg' }} 
              style={styles.profileImage} 
            />
            {user.level && (
              <View style={styles.levelBadge}>
                <Text style={styles.levelText}>{user.level}</Text>
              </View>
            )}
          </View>
          
          <Text style={styles.userName}>
            {user.name} {user.gender === 'Female' ? '🌸' : user.gender === 'Male' ? '👨' : ''}
          </Text>
          
          <View style={styles.onlineStatus}>
            <View style={[
              styles.onlineDot, 
              { backgroundColor: (userStatus?.isOnline ?? user.isOnline) ? '#4CAF50' : '#F44336' }
            ]} />
            <Text style={[
              styles.onlineText,
              { color: (userStatus?.isOnline ?? user.isOnline) ? '#4CAF50' : '#F44336' }
            ]}>
              {(userStatus?.isOnline ?? user.isOnline) ? 'User online' : 'User offline'}
            </Text>
          </View>
        </View>
        
        {/* Action Buttons - always show */}
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity 
            style={styles.messageButton} 
            onPress={handleMessageUser}
          >
            <Icon name="chatbubble-outline" size={24} color="#fff" />
            <Text style={styles.buttonText}>Message</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.callButton, 
              styles.callButtonFullWidth,
              isBlocked && styles.buttonDisabled
            ]} 
            onPress={handleCallUser}
            disabled={isBlocked}
          >
            <Icon name="call-outline" size={24} color={isBlocked ? "#999" : "#fff"} />
            <Text style={[styles.buttonText, isBlocked && styles.buttonTextDisabled]}>Call</Text>
          </TouchableOpacity>
        </View>
        
        {/* Stats section */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Icon name="chatbubble-outline" size={24} color="#000" />
            <Text style={styles.statTitle}>Feedback</Text>
            <Text style={styles.statValue}>{user.feedback || 0}</Text>
          </View>
          
          <View style={styles.statItem}>
            <Icon name="call-outline" size={24} color="#000" />
            <Text style={styles.statTitle}>Talks</Text>
            <Text style={styles.statValue}>{user.talks || 0}</Text>
          </View>
          
          <View style={styles.statItem}>
            <Icon name="time-outline" size={24} color="#000" />
            <Text style={styles.statTitle}>Hours</Text>
            <Text style={styles.statValue}>{user.hours || 0}</Text>
          </View>
        </View>
        
        {/* Information section */}
        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>Information</Text>
          
          <View style={styles.infoItem}>
            <View style={styles.infoIconContainer}>
              <IconMaterial name="translate" size={24} color="#673AB7" />
            </View>
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>Native language</Text>
              <Text style={styles.infoValue}>{user.nativeLanguage || 'Not specified'}</Text>
            </View>
          </View>
          
          <View style={styles.infoItem}>
            <View style={styles.infoIconContainer}>
              <IconMaterial name="school" size={24} color="#673AB7" />
            </View>
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>English level</Text>
              <Text style={styles.infoValue}>{user.level ? `${user.level} (Intermediate)` : 'Not specified'}</Text>
            </View>
          </View>
          
          <View style={styles.infoItem}>
            <View style={styles.infoIconContainer}>
              <IconMaterial name="person" size={24} color="#673AB7" />
            </View>
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>Gender</Text>
              <Text style={styles.infoValue}>{user.gender || 'Not specified'}</Text>
            </View>
          </View>
          
          <View style={styles.infoItem}>
            <View style={styles.infoIconContainer}>
              <IconMaterial name="cake" size={24} color="#673AB7" />
            </View>
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>Age</Text>
              <Text style={styles.infoValue}>{user.age ? `${user.age} years old` : 'Not specified'}</Text>
            </View>
          </View>
          
          <View style={styles.infoItem}>
            <View style={styles.infoIconContainer}>
              <IconMaterial name="place" size={24} color="#673AB7" />
            </View>
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>Location</Text>
              <Text style={styles.infoValue}>{user.location || user.country || 'Not specified'}</Text>
            </View>
          </View>
        </View>
        
        {/* Rating section */}
        <View style={styles.ratingSection}>
          <Text style={styles.sectionTitle}>Rating</Text>
          
          {ratingSummary && ratingSummary.stats.totalRatings > 0 ? (
            <>
              <View style={styles.ratingContainer}>
                <Text style={styles.ratingValue}>{user.rating || 0}%</Text>
                <Text style={styles.ratingDescription}>of users are satisfied with this conversation partner</Text>
              </View>
              
              <View style={styles.thumbsContainer}>
                <View style={styles.thumbsUpCard}>
                  <Text style={styles.thumbsUpIcon}>👍</Text>
                  <Text style={styles.thumbsCount}>{ratingSummary.stats.positiveFeedback}</Text>
                </View>
                <View style={styles.thumbsDownCard}>
                  <Text style={styles.thumbsDownIcon}>👎</Text>
                  <Text style={styles.thumbsCount}>{ratingSummary.stats.negativeFeedback}</Text>
                </View>
              </View>
            </>
          ) : (
            <View style={styles.ratingContainer}>
              <Text style={styles.noRatingText}>No ratings yet</Text>
              <Text style={styles.ratingDescription}>
                This user hasn't received any ratings from other users yet
              </Text>
            </View>
          )}
        </View>
        
        {/* Feedback section */}
        <View style={styles.feedbackSection}>
          <Text style={styles.sectionTitle}>Feedback</Text>
          
          {ratingSummary && ratingSummary.recentFeedback.length > 0 ? (
            <View style={styles.feedbackList}>
              {ratingSummary.recentFeedback.slice(0, 10).map((feedback, index) => (
                <View key={index} style={styles.feedbackItem}>
                  <View style={styles.feedbackHeader}>
                    <Image 
                      source={{ uri: feedback.feedbackBy?.profilePic || 'https://randomuser.me/api/portraits/women/44.jpg' }} 
                      style={styles.feedbackAvatar} 
                    />
                    <View style={styles.feedbackInfo}>
                      <Text style={styles.feedbackName}>{feedback.feedbackBy?.name || 'Anonymous'}</Text>
                      <Text style={styles.feedbackDate}>
                        {new Date(feedback.createdAt).toLocaleDateString('en-US', {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </Text>
                    </View>
                    <View style={[
                      styles.feedbackSentiment,
                      feedback.feedbackType === 'positive' ? styles.positiveSentiment : styles.negativeSentiment
                    ]}>
                      <Text style={styles.sentimentIcon}>
                        {feedback.feedbackType === 'positive' ? '👍' : '👎'}
                      </Text>
                    </View>
                  </View>
                  {feedback.message && (
                    <Text style={styles.feedbackMessage}>{feedback.message}</Text>
                  )}
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.noFeedbackContainer}>
              <Text style={styles.noFeedbackText}>No feedback yet</Text>
              <Text style={styles.noFeedbackDescription}>
                This user hasn't received any feedback from other users yet
              </Text>
            </View>
          )}
        </View>
        
        {/* Block/Report buttons */}
        <View style={styles.actionSection}>
          <TouchableOpacity 
            style={styles.blockButton} 
            onPress={blockUser}
          >
            <Text style={styles.blockButtonText}>
              {isBlocked ? 'Unblock user' : 'Block user'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.reportButton} 
            onPress={() => Alert.alert('Report', 'This user has been reported')}
          >
            <Text style={styles.reportButtonText}>Report this user</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      
      {/* Block confirmation modal */}
      <Modal
        visible={showBlockModal}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Image 
                source={{ uri: user.profilePic || 'https://randomuser.me/api/portraits/women/44.jpg' }} 
                style={styles.modalAvatar} 
              />
            </View>
            
            <Text style={styles.modalTitle}>
              Are you sure you want to block <Text style={styles.modalName}>{user.name} {user.gender === 'Female' ? '🌸' : user.gender === 'Male' ? '👨' : ''}</Text>?
            </Text>
            
            <Text style={styles.modalDescription}>
              This user won't be able to call or message you.
              {'\n'}They'll always see you as offline.
            </Text>
            
            <TouchableOpacity 
              style={styles.blockConfirmButton} 
              onPress={confirmBlockUser}
            >
              <Text style={styles.blockConfirmText}>Block</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.cancelButton} 
              onPress={() => setShowBlockModal(false)}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  blockedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  userNotFoundIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  blockedTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 10,
    marginBottom: 12,
    textAlign: 'center',
  },
  blockedMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  goBackButton: {
    backgroundColor: '#673AB7',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
  },
  goBackButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  backButton: {
    padding: 5,
  },
  likeButton: {
    padding: 5,
  },
  scrollView: {
    flex: 1,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  profileImageContainer: {
    position: 'relative',
  },
  profileImage: {
    width: 160,
    height: 160,
    borderRadius: 80,
  },
  levelBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: 'white',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#673AB7',
  },
  levelText: {
    color: '#673AB7',
    fontWeight: 'bold',
  },
  userName: {
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 15,
    marginBottom: 5,
  },
  onlineStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
    marginRight: 5,
  },
  onlineText: {
    color: '#4CAF50',
    fontSize: 16,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  messageButton: {
    backgroundColor: '#673AB7',
    borderRadius: 30,
    paddingVertical: 12,
    paddingHorizontal: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginRight: 10,
  },
  callButton: {
    backgroundColor: '#2196F3',
    borderRadius: 30,
    paddingVertical: 12,
    paddingHorizontal: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginRight: 10,
  },
  callButtonFullWidth: {
    flex: 2,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },
  buttonDisabled: {
    backgroundColor: '#CCCCCC',
    opacity: 0.6,
  },
  buttonTextDisabled: {
    color: '#999999',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 25,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#EEEEEE',
    marginHorizontal: 10,
  },
  statItem: {
    alignItems: 'center',
  },
  statTitle: {
    fontSize: 16,
    marginTop: 5,
    color: '#666666',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 2,
  },
  infoSection: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  infoItem: {
    flexDirection: 'row',
    marginBottom: 25,
  },
  infoIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  infoTextContainer: {
    justifyContent: 'center',
    flex: 1,
  },
  infoLabel: {
    fontSize: 16,
    color: '#666666',
  },
  infoValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 3,
  },
  ratingSection: {
    padding: 20,
    backgroundColor: '#F8F8F8',
    marginTop: 10,
  },
  ratingContainer: {
    backgroundColor: '#E8F5E9',
    padding: 20,
    borderRadius: 12,
    marginBottom: 15,
    alignItems: 'center',
  },
  ratingValue: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 8,
  },
  ratingDescription: {
    fontSize: 16,
    color: '#333333',
    textAlign: 'center',
    lineHeight: 22,
  },
  thumbsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 15,
  },
  thumbsUpCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  thumbsDownCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  thumbsUpIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  thumbsDownIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  thumbsCount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
  },
  noRatingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666666',
    textAlign: 'center',
    marginBottom: 8,
  },
  feedbackSection: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    marginTop: 10,
  },
  feedbackList: {
    marginTop: 10,
  },
  feedbackItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  feedbackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  feedbackAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  feedbackInfo: {
    flex: 1,
  },
  feedbackName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 2,
  },
  feedbackDate: {
    fontSize: 14,
    color: '#666666',
  },
  feedbackSentiment: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  positiveSentiment: {
    backgroundColor: '#E8F5E9',
  },
  negativeSentiment: {
    backgroundColor: '#FFEBEE',
  },
  sentimentIcon: {
    fontSize: 18,
  },
  feedbackMessage: {
    fontSize: 15,
    color: '#333333',
    lineHeight: 20,
    marginTop: 5,
  },
  noFeedbackContainer: {
    backgroundColor: '#F8F8F8',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  noFeedbackText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666666',
    marginBottom: 8,
  },
  noFeedbackDescription: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 20,
  },
  actionSection: {
    padding: 20,
    marginBottom: 20,
  },
  blockButton: {
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FF5252',
    marginBottom: 15,
  },
  blockButtonText: {
    color: '#FF5252',
    fontSize: 16,
    fontWeight: '600',
  },
  reportButton: {
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#666666',
  },
  reportButtonText: {
    color: '#666666',
    fontSize: 16,
    fontWeight: '600',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '80%',
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 15,
  },
  modalName: {
    color: '#673AB7',
  },
  modalDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  blockConfirmButton: {
    backgroundColor: '#673AB7',
    paddingVertical: 12,
    paddingHorizontal: 50,
    borderRadius: 30,
    marginBottom: 10,
    width: '100%',
    alignItems: 'center',
  },
  blockConfirmText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelButton: {
    backgroundColor: '#F5F5F5',
    paddingVertical:.12,
    paddingHorizontal: 30,
    borderRadius: 30,
    width: '100%',
    alignItems: 'center',
  },
  cancelText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
    paddingVertical: 12,
  },
});

export default UserProfileScreen; 