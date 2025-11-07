import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  Platform,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { ContactsStackNavigationProp } from '../navigation/types';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../redux/store';
import { initiateCall, fetchCallHistory } from '../redux/thunks/callThunks';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Ionicons';
import { API_URL } from '../utils/config';
import { getAuthToken } from '../utils/authUtils';
import Toast from 'react-native-toast-message';
import { useTheme } from '../context/ThemeContext';

// Friend interface
interface Friend {
  _id: string;
  name: string;
  profilePic?: string;
  level?: string;
  country?: string;
}

// Call history interface
interface CallHistoryItem {
  userId: string;
  userName: string;
  timestamp: number;
  duration: number;
  wasVideoCall: boolean;
  wasIncoming: boolean;
  profilePic?: string | null;
}

// Tab types
type ContactTab = 'calls' | 'friends' | 'blocked';

// Format duration in minutes
const formatDuration = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  return `${minutes} min`;
};

// Format date to display in a readable format
const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (date.getDate() === today.getDate() && 
      date.getMonth() === today.getMonth() && 
      date.getFullYear() === today.getFullYear()) {
    return `Today, ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
  } else if (date.getDate() === yesterday.getDate() && 
             date.getMonth() === yesterday.getMonth() && 
             date.getFullYear() === yesterday.getFullYear()) {
    return `Yesterday, ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
  } else {
    return `${date.toLocaleDateString([], {month: 'short', day: 'numeric'})}, ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
  }
};

// Friend item component
const FriendItem = ({ 
  friend, 
  onPress,
  onCallPress,
  onMessagePress,
  onRemovePress,
  theme
}: { 
  friend: Friend; 
  onPress: () => void;
  onCallPress: () => void;
  onMessagePress: () => void;
  onRemovePress: () => void;
  theme: any;
}) => {
  const dynamicStyles = {
    contactItem: { backgroundColor: theme.card },
    avatarCircle: { backgroundColor: theme.inputBackground },
    avatarText: { color: theme.primary },
    levelBadge: { backgroundColor: theme.background, borderColor: theme.primary },
    levelText: { color: theme.primary },
    contactName: { color: theme.text },
    lastInteraction: { color: theme.textSecondary },
    removeButton: { borderColor: theme.border, backgroundColor: theme.background },
    removeButtonText: { color: theme.text },
  };

  return (
    <TouchableOpacity 
      style={[styles.contactItem, dynamicStyles.contactItem]} 
      onPress={onPress}
    >
      <View style={styles.avatarContainer}>
        {friend.profilePic ? (
          <Image 
            source={{ uri: friend.profilePic }} 
            style={styles.avatar} 
          />
        ) : (
          <View style={[styles.avatarCircle, dynamicStyles.avatarCircle]}>
            <Text style={[styles.avatarText, dynamicStyles.avatarText]}>{friend.name.charAt(0)}</Text>
          </View>
        )}
        {friend.level && (
          <View style={[styles.levelBadge, dynamicStyles.levelBadge]}>
            <Text style={[styles.levelText, dynamicStyles.levelText]}>{friend.level}</Text>
          </View>
        )}
      </View>
      
      <View style={styles.contactInfo}>
        <Text style={[styles.contactName, dynamicStyles.contactName]}>{friend.name}</Text>
        {friend.country && (
          <Text style={[styles.lastInteraction, dynamicStyles.lastInteraction]}>{friend.country}</Text>
        )}
      </View>
      
      <TouchableOpacity 
        style={[styles.removeButton, dynamicStyles.removeButton]} 
        onPress={onRemovePress}
      >
        <Text style={[styles.removeButtonText, dynamicStyles.removeButtonText]}>Remove</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

// Call history item component
const CallItem = ({ 
  call, 
  onPress,
  onCallPress,
  theme
}: { 
  call: CallHistoryItem; 
  onPress: () => void;
  onCallPress: () => void;
  theme: any;
}) => {
  const dynamicStyles = {
    contactItem: { backgroundColor: theme.card },
    avatarCircle: { backgroundColor: theme.inputBackground },
    avatarText: { color: theme.primary },
    contactName: { color: theme.text },
    lastInteraction: { color: theme.textSecondary },
    durationText: { color: theme.text },
  };

  return (
    <TouchableOpacity 
      style={[styles.contactItem, dynamicStyles.contactItem]} 
      onPress={onPress}
    >
      <View style={styles.avatarContainer}>
        {call.profilePic ? (
          <Image 
            source={{ uri: call.profilePic }} 
            style={styles.avatar}
          />
        ) : (
          <View style={[styles.avatarCircle, dynamicStyles.avatarCircle]}>
            <Text style={[styles.avatarText, dynamicStyles.avatarText]}>{call.userName.charAt(0)}</Text>
          </View>
        )}
      </View>
      
      <View style={styles.contactInfo}>
        <Text style={[styles.contactName, dynamicStyles.contactName]}>{call.userName}</Text>
        <Text style={[styles.lastInteraction, dynamicStyles.lastInteraction]}>{formatDate(call.timestamp)}</Text>
      </View>
      
      <View style={styles.callInfo}>
        <Icon 
          name={call.wasVideoCall ? "videocam" : "call"} 
          size={16} 
          color={theme.primary} 
          style={styles.callIcon}
        />
        <Text style={[styles.durationText, dynamicStyles.durationText]}>{formatDuration(call.duration)}</Text>
      </View>
    </TouchableOpacity>
  );
};

// Main component
const ContactsScreen = () => {
  const { theme, isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<ContactTab>('calls');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation<ContactsStackNavigationProp>();
  const dispatch = useDispatch<AppDispatch>();
  const callHistory = useSelector((state: RootState) => state.call.callHistory);
  
  // Load stored users data (friends, blocked)
  const loadStoredUsersData = useCallback(async () => {
    try {
      // Load friends
      const friendsData = await AsyncStorage.getItem('favorites');
      if (friendsData) {
        setFriends(JSON.parse(friendsData));
      } else {
        setFriends([]);
      }
      
      // Load blocked users
      const blockedData = await AsyncStorage.getItem('blockedUsers');
      if (blockedData) {
        setBlockedUsers(JSON.parse(blockedData));
      } else {
        setBlockedUsers([]);
      }
    } catch (error) {
      console.error('Error loading stored users data:', error);
    }
  }, []);
  
  // Fetch call history from backend
  const loadCallHistory = useCallback(async () => {
    try {
      setLoading(true);
      await dispatch(fetchCallHistory()).unwrap();
    } catch (error) {
      console.error('Error loading call history:', error);
      // Don't show alert, just log the error
    } finally {
      setLoading(false);
    }
  }, [dispatch]);
  
  // Reload data when screen focuses
  useFocusEffect(
    useCallback(() => {
      loadStoredUsersData();
      loadCallHistory();
    }, [loadStoredUsersData, loadCallHistory])
  );
  
  // Initial load
  useEffect(() => {
    loadStoredUsersData();
    loadCallHistory();
  }, [loadStoredUsersData, loadCallHistory]);
  
  // Simple tab navigation
  const renderTabs = () => {
    const dynamicStyles = {
      tabContainer: { backgroundColor: theme.background, borderBottomColor: theme.border },
      activeTab: { borderBottomColor: theme.primary },
      tabText: { color: theme.textTertiary },
      activeTabText: { color: theme.primary },
    };

    return (
      <View style={[styles.tabContainer, dynamicStyles.tabContainer]}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'calls' && [styles.activeTab, dynamicStyles.activeTab]]} 
          onPress={() => setActiveTab('calls')}
        >
          <Text style={[styles.tabText, dynamicStyles.tabText, activeTab === 'calls' && [styles.activeTabText, dynamicStyles.activeTabText]]}>Calls</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'friends' && [styles.activeTab, dynamicStyles.activeTab]]} 
          onPress={() => setActiveTab('friends')}
        >
          <Text style={[styles.tabText, dynamicStyles.tabText, activeTab === 'friends' && [styles.activeTabText, dynamicStyles.activeTabText]]}>Friends</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'blocked' && [styles.activeTab, dynamicStyles.activeTab]]} 
          onPress={() => setActiveTab('blocked')}
        >
          <Text style={[styles.tabText, dynamicStyles.tabText, activeTab === 'blocked' && [styles.activeTabText, dynamicStyles.activeTabText]]}>Blocked</Text>
        </TouchableOpacity>
      </View>
    );
  };
  
  // Get data based on selected tab
  const getData = () => {
    switch (activeTab) {
      case 'calls':
        return callHistory;
      case 'friends':
        return friends;
      case 'blocked':
        return blockedUsers;
      default:
        return [];
    }
  };
  
  // Simple message for empty state
  const getEmptyMessage = () => {
    switch (activeTab) {
      case 'calls':
        return "You haven't made any calls yet";
      case 'friends':
        return "You don't have any friends yet";
      case 'blocked':
        return "You haven't blocked anyone";
      default:
        return "No contacts found";
    }
  };
  
  // Simple empty state component
  const EmptyList = () => {
    const dynamicStyles = {
      emptyText: { color: theme.textSecondary },
    };

    if (loading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.emptyText, dynamicStyles.emptyText, { marginTop: 16 }]}>Loading...</Text>
        </View>
      );
    }
    
    return (
      <View style={styles.emptyContainer}>
        <Text style={[styles.emptyText, dynamicStyles.emptyText]}>{getEmptyMessage()}</Text>
      </View>
    );
  };
  
  // Navigation handlers
  const handleContactPress = (contact: Friend | CallHistoryItem) => {
    const userId = 'userId' in contact ? contact.userId : contact._id;
    const userName = 'userName' in contact ? contact.userName : contact.name;
    
    // Navigate to UserProfile through the root navigation
    // @ts-ignore - This works but TypeScript doesn't understand the parent navigator access
    navigation.getParent()?.navigate('UserProfile', { userId, userName });
  };
  
  // Handle call press with call service
  const handleCallPress = (contact: Friend | CallHistoryItem) => {
    const userId = 'userId' in contact ? contact.userId : contact._id;
    const userName = 'userName' in contact ? contact.userName : contact.name;
    
    // Initiate the call
    void dispatch(initiateCall({
      userId,
      userName,
      options: { audio: true, video: false }
    }));
    
    // Navigate to call screen
    navigation.navigate('CallScreen', { 
      id: userId, 
      name: userName, 
      isVideoCall: false 
    });
  };
  
  const handleMessagePress = (contact: Friend | CallHistoryItem) => {
    const userId = 'userId' in contact ? contact.userId : contact._id;
    const userName = 'userName' in contact ? contact.userName : contact.name;
    
    navigation.navigate('ChatDetail', { id: userId, name: userName });
  };
  
  // Handle remove friend
  const handleRemoveFriend = async (friend: Friend) => {
    try {
      // Get current favorites from AsyncStorage
      const favoritesString = await AsyncStorage.getItem('favorites');
      if (!favoritesString) return;
      
      const favorites = JSON.parse(favoritesString);
      // Remove the friend
      const updatedFavorites = favorites.filter((item: Friend) => item._id !== friend._id);
      
      // Save updated favorites back to AsyncStorage
      await AsyncStorage.setItem('favorites', JSON.stringify(updatedFavorites));
      
      // Update state
      setFriends(updatedFavorites);
      
      // Notify user
      Alert.alert('Success', `${friend.name} removed from your friends list`);
    } catch (error) {
      console.error('Error removing friend:', error);
      Alert.alert('Error', 'Failed to remove friend');
    }
  };
  
  // Handle unblock user
  const handleUnblockUser = async (user: Friend) => {
    try {
      // First, sync with backend API - ONLY update frontend if API call succeeds
      const token = await getAuthToken();
      const response = await fetch(`${API_URL}/auth/users/${user._id}/block`, {
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
      
      // Only update frontend if API call was successful
      const responseData = await response.json();
      if (responseData.success) {
        // Update local storage
        const blockedUsersString = await AsyncStorage.getItem('blockedUsers');
        if (!blockedUsersString) return;
        
        const blockedUsers = JSON.parse(blockedUsersString);
        // Remove the user from blocked list
        const updatedBlockedUsers = blockedUsers.filter((item: Friend) => item._id !== user._id);
        
        // Save updated blocked users back to AsyncStorage
        await AsyncStorage.setItem('blockedUsers', JSON.stringify(updatedBlockedUsers));
        
        // Update state
        setBlockedUsers(updatedBlockedUsers);
        
        // Notify user with toast
        Toast.show({
          type: 'success',
          text1: 'Unblocked',
          text2: `${user.name} has been unblocked`,
          position: 'top',
          visibilityTime: 3000,
        });
      } else {
        throw new Error(responseData.message || 'Failed to unblock user');
      }
    } catch (error: any) {
      console.error('Error unblocking user:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to unblock user. Please try again.',
        position: 'top',
        visibilityTime: 3000,
      });
    }
  };
  
  // Render appropriate item based on tab
  const renderItem = ({ item }: { item: Friend | CallHistoryItem }) => {
    if (activeTab === 'calls') {
      return (
        <CallItem
          call={item as CallHistoryItem}
          onPress={() => handleContactPress(item)}
          onCallPress={() => handleCallPress(item)}
          theme={theme}
        />
      );
    } else if (activeTab === 'friends') {
      return (
        <FriendItem
          friend={item as Friend}
          onPress={() => handleContactPress(item)}
          onCallPress={() => handleCallPress(item)}
          onMessagePress={() => handleMessagePress(item)}
          onRemovePress={() => handleRemoveFriend(item as Friend)}
          theme={theme}
        />
      );
    } else {
      // Blocked users
      return (
        <FriendItem
          friend={item as Friend}
          onPress={() => handleContactPress(item)}
          onCallPress={() => handleCallPress(item)}
          onMessagePress={() => handleMessagePress(item)}
          onRemovePress={() => handleUnblockUser(item as Friend)}
          theme={theme}
        />
      );
    }
  };
  
  // Group calls by date
  const renderCallsByDate = () => {
    if (activeTab !== 'calls' || callHistory.length === 0) {
      return null;
    }
    
    // Group calls by date
    const groupedCalls: { [key: string]: CallHistoryItem[] } = {};
    callHistory.forEach(call => {
      const date = new Date(call.timestamp);
      const month = date.toLocaleString('default', { month: 'long' });
      const year = date.getFullYear();
      const key = `${month} ${year}`;
      
      if (!groupedCalls[key]) {
        groupedCalls[key] = [];
      }
      
      groupedCalls[key].push(call);
    });
    
    // Convert to array for FlatList
    return Object.entries(groupedCalls).map(([date, calls]) => (
      <View key={date}>
        <Text style={[styles.dateHeader, { backgroundColor: theme.surface, color: theme.text }]}>{date}</Text>
        {calls.map((call, index) => (
          <CallItem
            key={`${call.userId}-${call.timestamp}-${index}`}
            call={call}
            onPress={() => handleContactPress(call)}
            onCallPress={() => handleCallPress(call)}
            theme={theme}
          />
        ))}
      </View>
    ));
  };
  
  const dynamicStyles = {
    container: { backgroundColor: theme.background },
    header: { borderBottomColor: theme.border, backgroundColor: theme.background },
    title: { color: theme.text },
    dateHeader: { backgroundColor: theme.surface, color: theme.text },
  };

  return (
    <SafeAreaView style={[styles.container, dynamicStyles.container]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
      
      <View style={[styles.header, dynamicStyles.header]}>
        <Text style={[styles.title, dynamicStyles.title]}>Contacts</Text>
      </View>
      
      {renderTabs()}
      
      {activeTab === 'calls' && callHistory.length > 0 ? (
        <FlatList
          data={[]}
          ListHeaderComponent={renderCallsByDate}
          renderItem={null}
          keyExtractor={() => 'dummy'}
          style={{ backgroundColor: theme.surface }}
        />
      ) : (
        <FlatList
          data={getData()}
          keyExtractor={(item, index) => {
            if ('userId' in item) {
              return `${item.userId}-${item.timestamp}`;
            }
            return `${item._id}-${index}`;
          }}
          renderItem={renderItem}
          ListEmptyComponent={<EmptyList />}
          style={{ backgroundColor: theme.surface }}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    backgroundColor: 'transparent',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
  },
  activeTabText: {
    fontWeight: 'bold',
  },
  dateHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 8,
  },
  contactItem: {
    flexDirection: 'row',
    padding: 16,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  levelBadge: {
    position: 'absolute',
    bottom: -5,
    right: -5,
    borderRadius: 10,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  levelText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  contactInfo: {
    flex: 1,
    marginLeft: 12,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
  },
  lastInteraction: {
    fontSize: 12,
    marginTop: 4,
  },
  callInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  callIcon: {
    marginRight: 4,
  },
  durationText: {
    fontSize: 14,
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
  },
  callButton: {
    backgroundColor: '#673AB7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  callButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  messageButton: {
    backgroundColor: '#F2F2F2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  messageButtonText: {
    color: '#333333',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 32,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
  removeButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginLeft: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  removeButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default ContactsScreen; 