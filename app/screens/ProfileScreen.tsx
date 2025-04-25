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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../navigation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserProfile, UserProfile, testApiConnection } from '../utils/profileService';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';

// Define types for better type checking
interface Activity {
  text: string;
  time: string;
}

// Extend AuthContextType to include user
interface ExtendedAuthContext {
  signOut: () => void;
  user?: {
    _id?: string;
    name?: string;
    email?: string;
    profilePic?: string;
  };
}

// Define user data structure
interface UserData {
  _id?: string;
  name?: string;
  email?: string;
  profilePic?: string;
  level?: string;
  points?: number;
  streak?: number;
  calls?: number;
  minutes?: number;
  interests?: string[];
  bio?: string;
  country?: string;
  recentActivity?: Activity[];
}

// Default interests to use if user doesn't have any
const DEFAULT_INTERESTS = ['Travel', 'Movies', 'Technology', 'Sports', 'Food'];

const ProfileScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [activeTab, setActiveTab] = useState<'stats' | 'about'>('stats');
  const { signOut, user } = useAuth() as ExtendedAuthContext;
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<UserProfile | null>(null);
  
  // Fetch full user profile when screen loads
  useEffect(() => {
    fetchUserProfile();
  }, []);
  
  // Function to fetch the user profile
  const fetchUserProfile = async () => {
    try {
      setLoading(true);
      
      console.log('Attempting to fetch user profile from API...');
      
      // First test if API is reachable
      const isApiReachable = await testApiConnection();
      
      if (!isApiReachable) {
        console.log('⚠️ API server is not reachable, skipping profile fetch');
        // Proceed directly to fallback methods
        await loadFromCachedData();
        return;
      }
      
      // Try to get profile from API
      const profile = await getUserProfile();
      
      if (profile) {
        console.log('✅ Successfully received profile from API:', JSON.stringify(profile).substring(0, 200));
        
        // Set the user data with profile information
        setUserData({
          ...profile,
          // Set defaults for missing fields
          level: profile.level || 'Beginner',
          points: profile.points || 0,
          streak: profile.streak || 0,
          calls: profile.calls || 0,
          minutes: profile.minutes || 0,
          interests: profile.interests || DEFAULT_INTERESTS,
          bio: profile.bio || 'No bio yet',
          country: profile.country || 'Unknown',
          recentActivity: profile.recentActivity || []
        });
      } else {
        console.log('❌ Failed to get profile from API, falling back to cached data');
        await loadFromCachedData();
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      await loadFromCachedData();
    } finally {
      setLoading(false);
    }
  };
  
  // Helper function to load from cached data
  const loadFromCachedData = async () => {
    // Fallback to cached user data
    const cachedUser = await AsyncStorage.getItem('user');
    const userId = await AsyncStorage.getItem('userId') || '';
    
    if (cachedUser) {
      try {
        console.log('Found cached user data, parsing...');
        const parsedUser = JSON.parse(cachedUser);
        console.log('Cached user ID:', parsedUser._id);
        
        setUserData({
          _id: parsedUser._id || userId,
          name: parsedUser.name || 'User',
          email: parsedUser.email || '',
          profilePic: parsedUser.profilePic || 'https://randomuser.me/api/portraits/men/32.jpg',
          level: 'Beginner',
          points: 0,
          streak: 0,
          calls: 0,
          minutes: 0,
          interests: DEFAULT_INTERESTS,
          bio: 'No bio yet',
          country: 'Unknown'
        });
      } catch (parseError) {
        console.error('Error parsing cached user:', parseError);
        fallbackToAuthUser();
      }
    } else {
      console.log('No cached user data found, falling back to auth user');
      fallbackToAuthUser();
    }
  };
  
  // Helper function to use auth user as fallback
  const fallbackToAuthUser = () => {
    if (user) {
      setUserData({
        _id: user._id,
        name: user.name || 'User',
        email: user.email || '',
        profilePic: user.profilePic || 'https://randomuser.me/api/portraits/men/32.jpg',
        level: 'Beginner',
        points: 0,
        streak: 0,
        calls: 0,
        minutes: 0,
        interests: DEFAULT_INTERESTS,
        bio: 'No bio yet',
        country: 'Unknown'
      });
    } else {
      // Create minimal profile
      setUserData({
        name: 'Guest User',
        email: '',
        profilePic: 'https://randomuser.me/api/portraits/men/32.jpg',
        level: 'Beginner',
        interests: DEFAULT_INTERESTS,
        bio: 'No bio yet',
        country: 'Unknown'
      });
    }
  };
  
  const handleEditProfile = () => {
    // Navigate to edit profile screen
    if (userData) {
      navigation.navigate('EditProfile', { userData });
    } else {
      Alert.alert('Error', 'Unable to edit profile. Please try again later.');
    }
  };
  
  // Function to manually test API connection and retry profile fetch
  const handleRetryConnection = async () => {
    try {
      setLoading(true);
      
      Alert.alert('Testing Server Connection', 'Attempting to connect to the server...');
      
      const isConnected = await testApiConnection();
      
      if (isConnected) {
        Alert.alert('Connection Successful', 'Successfully connected to the server. Fetching profile data...');
        await fetchUserProfile();
      } else {
        Alert.alert('Connection Failed', 'Could not connect to the server. Please check your network connection and server status.');
      }
    } catch (error) {
      console.error('Error testing connection:', error);
      Alert.alert('Error', 'An error occurred while testing the connection.');
    } finally {
      setLoading(false);
    }
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
          onPress: signOut
        }
      ]
    );
  };
  
  const renderProfileHeader = () => {
    if (!userData) return null;
    
    return (
      <View style={styles.profileHeader}>
        <Image 
          source={{ 
            uri: userData.profilePic || 'https://randomuser.me/api/portraits/men/32.jpg' 
          }} 
          style={styles.avatar} 
        />
        <Text style={styles.userName}>{userData.name || 'User'}</Text>
        <View style={styles.levelContainer}>
          <Text style={styles.levelText}>{userData.level || 'Beginner'}</Text>
        </View>
        <Text style={styles.countryText}>{userData.country || 'Unknown'}</Text>
        
        <TouchableOpacity 
          style={styles.editButton}
          onPress={handleEditProfile}
        >
          <Text style={styles.editButtonText}>Edit Profile</Text>
        </TouchableOpacity>
      </View>
    );
  };
  
  const renderTabs = () => {
    return (
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'stats' && styles.activeTab]} 
          onPress={() => setActiveTab('stats')}
        >
          <Text style={[styles.tabText, activeTab === 'stats' && styles.activeTabText]}>Stats</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'about' && styles.activeTab]} 
          onPress={() => setActiveTab('about')}
        >
          <Text style={[styles.tabText, activeTab === 'about' && styles.activeTabText]}>About</Text>
        </TouchableOpacity>
      </View>
    );
  };
  
  const renderStatsContent = () => {
    if (!userData) return null;
    
    return (
      <View style={styles.statsContainer}>
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{userData.points || 0}</Text>
            <Text style={styles.statLabel}>Total Points</Text>
          </View>
          
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{userData.streak || 0}</Text>
            <Text style={styles.statLabel}>Day Streak</Text>
          </View>
        </View>
        
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{userData.calls || 0}</Text>
            <Text style={styles.statLabel}>Calls Made</Text>
          </View>
          
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{userData.minutes || 0}</Text>
            <Text style={styles.statLabel}>Minutes</Text>
          </View>
        </View>
        
        <View style={styles.activityContainer}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          {userData.recentActivity && userData.recentActivity.length > 0 ? (
            userData.recentActivity.map((activity: Activity, index: number) => (
              <View key={index} style={styles.activityItem}>
                <View style={styles.activityDot} />
                <Text style={styles.activityText}>{activity.text}</Text>
                <Text style={styles.activityTime}>{activity.time}</Text>
              </View>
            ))
          ) : (
            <>
              <View style={styles.activityItem}>
                <View style={styles.activityDot} />
                <Text style={styles.activityText}>No recent activity</Text>
                <Text style={styles.activityTime}></Text>
              </View>
            </>
          )}
        </View>
      </View>
    );
  };
  
  const renderAboutContent = () => {
    if (!userData) return null;
    
    const interests = userData.interests || DEFAULT_INTERESTS;
    
    return (
      <View style={styles.aboutContainer}>
        <View style={styles.bioContainer}>
          <Text style={styles.sectionTitle}>Bio</Text>
          <Text style={styles.bioText}>{userData.bio || 'No bio yet.'}</Text>
        </View>
        
        <View style={styles.interestsContainer}>
          <Text style={styles.sectionTitle}>Interests</Text>
          <View style={styles.interestsWrapper}>
            {interests.map((interest: string, index: number) => (
              <View key={index} style={styles.interestItem}>
                <Text style={styles.interestText}>{interest}</Text>
              </View>
            ))}
          </View>
        </View>
        
        <View style={styles.goalsContainer}>
          <Text style={styles.sectionTitle}>Learning Goals</Text>
          <View style={styles.goalItem}>
            <View style={styles.goalCheckbox} />
            <Text style={styles.goalText}>Have 30-minute conversations</Text>
          </View>
          <View style={styles.goalItem}>
            <View style={[styles.goalCheckbox, styles.goalCompleted]} />
            <Text style={[styles.goalText, styles.goalCompletedText]}>Speak with 5 different partners</Text>
          </View>
          <View style={styles.goalItem}>
            <View style={styles.goalCheckbox} />
            <Text style={styles.goalText}>Maintain a 14-day streak</Text>
          </View>
        </View>
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
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <ScrollView showsVerticalScrollIndicator={false}>
        {renderProfileHeader()}
        {renderTabs()}
        
        {activeTab === 'stats' ? renderStatsContent() : renderAboutContent()}
        
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
        
        {/* Add connection retry button */}
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={handleRetryConnection}
        >
          <Text style={styles.retryButtonText}>Test Server Connection</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 12,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 6,
  },
  levelContainer: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 50,
    marginBottom: 6,
  },
  levelText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  countryText: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 16,
  },
  editButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: '#4A90E2',
  },
  editButtonText: {
    color: '#4A90E2',
    fontWeight: '600',
    fontSize: 14,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 3,
    borderBottomColor: '#4A90E2',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666666',
  },
  activeTabText: {
    color: '#4A90E2',
  },
  statsContainer: {
    padding: 20,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginHorizontal: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4A90E2',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#666666',
  },
  activityContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 12,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  activityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4A90E2',
    marginRight: 10,
  },
  activityText: {
    flex: 1,
    fontSize: 14,
    color: '#333333',
  },
  activityTime: {
    fontSize: 12,
    color: '#999999',
  },
  aboutContainer: {
    padding: 20,
  },
  bioContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  bioText: {
    fontSize: 15,
    color: '#333333',
    lineHeight: 22,
  },
  interestsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  interestsWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  interestItem: {
    backgroundColor: '#F2F2F2',
    borderRadius: 50,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  interestText: {
    fontSize: 14,
    color: '#333333',
  },
  goalsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  goalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  goalCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#4A90E2',
    marginRight: 10,
  },
  goalCompleted: {
    backgroundColor: '#4A90E2',
  },
  goalText: {
    fontSize: 14,
    color: '#333333',
  },
  goalCompletedText: {
    textDecorationLine: 'line-through',
    color: '#999999',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 0,
    marginBottom: 20,
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
    color: '#333333',
    fontWeight: '600',
    fontSize: 16,
  },
  settingsButton: {
    flex: 1,
    backgroundColor: '#333333',
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
  },
  retryButton: {
    backgroundColor: '#4A90E2',
    paddingVertical: 12,
    borderRadius: 50,
    margin: 20,
    marginTop: 0,
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
});

export default ProfileScreen; 