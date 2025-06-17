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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { ContactsStackNavigationProp } from '../navigation/types';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../redux/store';
import { initiateCall } from '../redux/thunks/callThunks';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Ionicons';

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
  onRemovePress
}: { 
  friend: Friend; 
  onPress: () => void;
  onCallPress: () => void;
  onMessagePress: () => void;
  onRemovePress: () => void;
}) => {
  return (
    <TouchableOpacity 
      style={styles.contactItem} 
      onPress={onPress}
    >
      <View style={styles.avatarContainer}>
        {friend.profilePic ? (
          <Image 
            source={{ uri: friend.profilePic }} 
            style={styles.avatar} 
          />
        ) : (
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{friend.name.charAt(0)}</Text>
          </View>
        )}
        {friend.level && (
          <View style={styles.levelBadge}>
            <Text style={styles.levelText}>{friend.level}</Text>
          </View>
        )}
      </View>
      
      <View style={styles.contactInfo}>
        <Text style={styles.contactName}>{friend.name}</Text>
        {friend.country && (
          <Text style={styles.lastInteraction}>{friend.country}</Text>
        )}
      </View>
      
      <TouchableOpacity 
        style={styles.removeButton} 
        onPress={onRemovePress}
      >
        <Text style={styles.removeButtonText}>Remove</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

// Call history item component
const CallItem = ({ 
  call, 
  onPress,
  onCallPress,
}: { 
  call: CallHistoryItem; 
  onPress: () => void;
  onCallPress: () => void;
}) => {
  return (
    <TouchableOpacity 
      style={styles.contactItem} 
      onPress={onPress}
    >
      <View style={styles.avatarCircle}>
        <Text style={styles.avatarText}>{call.userName.charAt(0)}</Text>
      </View>
      
      <View style={styles.contactInfo}>
        <Text style={styles.contactName}>{call.userName}</Text>
        <Text style={styles.lastInteraction}>{formatDate(call.timestamp)}</Text>
      </View>
      
      <View style={styles.callInfo}>
        <Icon 
          name={call.wasVideoCall ? "videocam" : "call"} 
          size={16} 
          color="#4A90E2" 
          style={styles.callIcon}
        />
        <Text style={styles.durationText}>{formatDuration(call.duration)}</Text>
      </View>
    </TouchableOpacity>
  );
};

// Main component
const ContactsScreen = () => {
  const [activeTab, setActiveTab] = useState<ContactTab>('calls');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<Friend[]>([]);
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
  
  // Reload data when screen focuses
  useFocusEffect(
    useCallback(() => {
      loadStoredUsersData();
    }, [loadStoredUsersData])
  );
  
  // Initial load
  useEffect(() => {
    loadStoredUsersData();
  }, [loadStoredUsersData]);
  
  // Simple tab navigation
  const renderTabs = () => {
    return (
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'calls' && styles.activeTab]} 
          onPress={() => setActiveTab('calls')}
        >
          <Text style={[styles.tabText, activeTab === 'calls' && styles.activeTabText]}>Calls</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'friends' && styles.activeTab]} 
          onPress={() => setActiveTab('friends')}
        >
          <Text style={[styles.tabText, activeTab === 'friends' && styles.activeTabText]}>Friends</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'blocked' && styles.activeTab]} 
          onPress={() => setActiveTab('blocked')}
        >
          <Text style={[styles.tabText, activeTab === 'blocked' && styles.activeTabText]}>Blocked</Text>
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
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>{getEmptyMessage()}</Text>
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
      // Get current blocked users from AsyncStorage
      const blockedUsersString = await AsyncStorage.getItem('blockedUsers');
      if (!blockedUsersString) return;
      
      const blockedUsers = JSON.parse(blockedUsersString);
      // Remove the user from blocked list
      const updatedBlockedUsers = blockedUsers.filter((item: Friend) => item._id !== user._id);
      
      // Save updated blocked users back to AsyncStorage
      await AsyncStorage.setItem('blockedUsers', JSON.stringify(updatedBlockedUsers));
      
      // Update state
      setBlockedUsers(updatedBlockedUsers);
      
      // Notify user
      Alert.alert('Success', `${user.name} has been unblocked`);
    } catch (error) {
      console.error('Error unblocking user:', error);
      Alert.alert('Error', 'Failed to unblock user');
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
        <Text style={styles.dateHeader}>{date}</Text>
        {calls.map((call, index) => (
          <CallItem
            key={`${call.userId}-${call.timestamp}-${index}`}
            call={call}
            onPress={() => handleContactPress(call)}
            onCallPress={() => handleCallPress(call)}
          />
        ))}
      </View>
    ));
  };
  
  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      <View style={styles.header}>
        <Text style={styles.title}>Contacts</Text>
      </View>
      
      {renderTabs()}
      
      {activeTab === 'calls' && callHistory.length > 0 ? (
        <FlatList
          data={[]}
          ListHeaderComponent={renderCallsByDate}
          renderItem={null}
          keyExtractor={() => 'dummy'}
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
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#673AB7',
    backgroundColor: 'transparent',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#999999',
  },
  activeTabText: {
    color: '#673AB7',
    fontWeight: 'bold',
  },
  dateHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 8,
  },
  contactItem: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
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
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#673AB7',
  },
  levelBadge: {
    position: 'absolute',
    bottom: -5,
    right: -5,
    backgroundColor: 'white',
    borderRadius: 10,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#673AB7',
  },
  levelText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#673AB7',
  },
  contactInfo: {
    flex: 1,
    marginLeft: 12,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
  },
  lastInteraction: {
    fontSize: 12,
    color: '#666666',
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
    color: '#333333',
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
    color: '#666666',
    textAlign: 'center',
  },
  removeButton: {
    backgroundColor: 'white',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginLeft: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  removeButtonText: {
    color: '#333333',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default ContactsScreen; 