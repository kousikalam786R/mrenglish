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
import { RootStackParamList } from '../navigation/types';
import Icon from 'react-native-vector-icons/Ionicons';
import IconMaterial from 'react-native-vector-icons/MaterialIcons';
import { API_URL } from '../utils/config';
import { getAuthToken } from '../utils/authUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
}

type UserProfileScreenProps = NativeStackScreenProps<RootStackParamList, 'UserProfile'>;

const UserProfileScreen: React.FC<UserProfileScreenProps> = ({ route, navigation }) => {
  const { userId, userName } = route.params;
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);

  // Fetch user profile data
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        setLoading(true);
        
        // Get token for API request
        const token = await getAuthToken();
        
        // Fetch user profile from API
        const response = await fetch(`${API_URL}/auth/users/${userId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch user profile');
        }
        
        const userData = await response.json();
        
        // Check if user is in favorites
        const favoritesString = await AsyncStorage.getItem('favorites');
        const favorites = favoritesString ? JSON.parse(favoritesString) : [];
        const isUserFavorite = favorites.some((favUser: any) => favUser._id === userId);
        
        // Check if user is blocked
        const blockedUsersString = await AsyncStorage.getItem('blockedUsers');
        const blockedUsers = blockedUsersString ? JSON.parse(blockedUsersString) : [];
        const isUserBlocked = blockedUsers.some((blockedUser: any) => blockedUser._id === userId);
        
        setUser({
          ...userData,
          feedback: userData.feedback || 16,
          talks: userData.talks || 25,
          hours: userData.hours || 3,
          isFavorite: isUserFavorite,
          isBlocked: isUserBlocked
        });
        setIsFavorite(isUserFavorite);
        setIsBlocked(isUserBlocked);
      } catch (error) {
        console.error('Error fetching user profile:', error);
        
        // If API fails, create mock data based on passed user info
        setUser({
          _id: userId,
          name: userName,
          profilePic: 'https://randomuser.me/api/portraits/women/44.jpg',
          level: 'B1',
          country: 'Uzbekistan',
          gender: 'Female',
          age: 20,
          nativeLanguage: 'Uzbek',
          feedback: 16,
          talks: 25,
          hours: 3,
          location: 'Uzbekistan',
          rating: 94,
          isOnline: true,
          isFavorite: false,
          isBlocked: false
        });
        
        // Still check favorites and blocks
        const checkStoredData = async () => {
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
        };
        
        checkStoredData();
      } finally {
        setLoading(false);
      }
    };
    
    fetchUserProfile();
  }, [userId, userName]);

  // Toggle favorite status
  const toggleFavorite = async () => {
    try {
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
        
        Alert.alert('Success', `${userName} removed from your friends list`);
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
          
          Alert.alert('Success', `${userName} added to your friends list`);
        }
      }
    } catch (error) {
      console.error('Error updating favorites:', error);
      Alert.alert('Error', 'Failed to update friends list');
    }
  };

  // Block user function
  const blockUser = async () => {
    try {
      const blockedUsersString = await AsyncStorage.getItem('blockedUsers');
      const blockedUsers = blockedUsersString ? JSON.parse(blockedUsersString) : [];
      
      // Check if already blocked
      if (isBlocked) {
        // Unblock user
        const updatedBlockedUsers = blockedUsers.filter((blockedUser: any) => blockedUser._id !== userId);
        await AsyncStorage.setItem('blockedUsers', JSON.stringify(updatedBlockedUsers));
        setIsBlocked(false);
        
        if (user) {
          setUser({ ...user, isBlocked: false });
        }
        
        Alert.alert('Success', `${userName} has been unblocked`);
      } else {
        // Show confirmation modal
        setShowBlockModal(true);
      }
    } catch (error) {
      console.error('Error updating blocked users:', error);
      Alert.alert('Error', 'Failed to update blocked users');
    }
  };
  
  // Confirm block user
  const confirmBlockUser = async () => {
    try {
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
        
        blockedUsers.push(userToBlock);
        await AsyncStorage.setItem('blockedUsers', JSON.stringify(blockedUsers));
        
        // Also remove from favorites if they are a favorite
        if (isFavorite) {
          const favoritesString = await AsyncStorage.getItem('favorites');
          const favorites = favoritesString ? JSON.parse(favoritesString) : [];
          const updatedFavorites = favorites.filter((favUser: any) => favUser._id !== userId);
          await AsyncStorage.setItem('favorites', JSON.stringify(updatedFavorites));
          setIsFavorite(false);
        }
        
        setIsBlocked(true);
        setUser({ ...user, isBlocked: true, isFavorite: false });
        setShowBlockModal(false);
        
        // Navigate back after successful block
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error blocking user:', error);
      Alert.alert('Error', 'Failed to block user');
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
    
    navigation.navigate('Call', { 
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
    
    navigation.navigate('Call', { 
      id: userId, 
      name: userName, 
      isVideoCall: true 
    });
  };

  // Handle message user
  const handleMessageUser = () => {
    // Don't allow messaging blocked users
    if (isBlocked) {
      Alert.alert('Blocked', 'You cannot message a blocked user');
      return;
    }
    
    navigation.navigate('ChatDetail', { 
      id: userId, 
      name: userName 
    });
  };

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
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>User online</Text>
          </View>
        </View>
        
        {/* Action Buttons - only show if not blocked */}
        {!isBlocked && (
          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity 
              style={styles.messageButton} 
              onPress={handleMessageUser}
            >
              <Icon name="chatbubble-outline" size={24} color="#fff" />
              <Text style={styles.buttonText}>Message</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.callButton, styles.callButtonFullWidth]} 
              onPress={handleCallUser}
            >
              <Icon name="call-outline" size={24} color="#fff" />
              <Text style={styles.buttonText}>Call</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {/* Stats section */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Icon name="chatbubble-outline" size={24} color="#000" />
            <Text style={styles.statTitle}>Feedback</Text>
            <Text style={styles.statValue}>{user.feedback}</Text>
          </View>
          
          <View style={styles.statItem}>
            <Icon name="call-outline" size={24} color="#000" />
            <Text style={styles.statTitle}>Talks</Text>
            <Text style={styles.statValue}>{user.talks}</Text>
          </View>
          
          <View style={styles.statItem}>
            <Icon name="time-outline" size={24} color="#000" />
            <Text style={styles.statTitle}>Hours</Text>
            <Text style={styles.statValue}>{user.hours}</Text>
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
          
          <View style={styles.ratingContainer}>
            <Text style={styles.ratingValue}>{user.rating || 94}%</Text>
            <Text style={styles.ratingDescription}>of users are satisfied with this conversation partner</Text>
          </View>
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
    padding: 15,
    borderRadius: 10,
  },
  ratingValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  ratingDescription: {
    fontSize: 16,
    color: '#333333',
    marginTop: 5,
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