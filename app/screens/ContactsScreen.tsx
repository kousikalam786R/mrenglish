import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ContactsStackNavigationProp } from '../navigation/types';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../redux/store';
import { initiateCall } from '../redux/thunks/callThunks';

// Simple contact data structure
interface Contact {
  id: string;
  name: string;
  lastInteraction?: string;
  isFriend: boolean;
  isBlocked: boolean;
}

// Mock data
const CONTACTS: Contact[] = [
  {
    id: '1',
    name: 'Sarah Johnson',
    lastInteraction: '2 days ago',
    isFriend: true,
    isBlocked: false,
  },
  {
    id: '2',
    name: 'Michael Chen',
    lastInteraction: 'Yesterday',
    isFriend: true,
    isBlocked: false,
  },
  {
    id: '3',
    name: 'Ana Garcia',
    lastInteraction: '1 week ago',
    isFriend: true,
    isBlocked: false,
  },
  {
    id: '4',
    name: 'David Kim',
    lastInteraction: '3 days ago',
    isFriend: false,
    isBlocked: true,
  },
  {
    id: '5',
    name: 'Emma Wilson',
    lastInteraction: '5 days ago',
    isFriend: true,
    isBlocked: false,
  },
  {
    id: '6',
    name: 'James Brown',
    lastInteraction: '2 weeks ago',
    isFriend: false,
    isBlocked: true,
  },
  {
    id: '7',
    name: 'Olivia Martin',
    lastInteraction: '3 weeks ago',
    isFriend: true,
    isBlocked: false,
  },
];

// Simple, stateless contact item component
const ContactItem = ({ 
  contact, 
  onPress,
  onCallPress,
  onMessagePress 
}: { 
  contact: Contact; 
  onPress: () => void;
  onCallPress: () => void;
  onMessagePress: () => void;
}) => {
  return (
    <TouchableOpacity 
      style={styles.contactItem} 
      onPress={onPress}
    >
      <View style={styles.avatarCircle}>
        <Text style={styles.avatarText}>{contact.name.charAt(0)}</Text>
      </View>
      
      <View style={styles.contactInfo}>
        <Text style={styles.contactName}>{contact.name}</Text>
        {contact.lastInteraction && (
          <Text style={styles.lastInteraction}>Last call: {contact.lastInteraction}</Text>
        )}
      </View>
      
      <View style={styles.actionButtons}>
        <TouchableOpacity 
          style={styles.callButton} 
          onPress={onCallPress}
        >
          <Text style={styles.callButtonText}>Call</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.messageButton} 
          onPress={onMessagePress}
        >
          <Text style={styles.messageButtonText}>Message</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

type ContactTab = 'calls' | 'friends' | 'blocked';

// Main component
const ContactsScreen = () => {
  const [activeTab, setActiveTab] = useState<ContactTab>('calls');
  const navigation = useNavigation<ContactsStackNavigationProp>();
  const dispatch = useDispatch<AppDispatch>();
  
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
  
  // Filter contacts based on selected tab
  const getFilteredContacts = () => {
    switch (activeTab) {
      case 'calls':
        return CONTACTS.filter(contact => contact.lastInteraction);
      case 'friends':
        return CONTACTS.filter(contact => contact.isFriend);
      case 'blocked':
        return CONTACTS.filter(contact => contact.isBlocked);
      default:
        return CONTACTS;
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
  
  // Simple navigation handlers
  const handleContactPress = (contact: Contact) => {
    navigation.navigate('ChatDetail', { id: contact.id, name: contact.name });
  };
  
  // Handle call press with call service
  const handleCallPress = (contact: Contact) => {
    // Initiate the call
    void dispatch(initiateCall({
      userId: contact.id,
      userName: contact.name,
      options: { audio: true, video: false }
    }));
    
    // Navigate to call screen
    navigation.navigate('Call', { 
      id: contact.id, 
      name: contact.name, 
      isVideoCall: false 
    });
  };
  
  const handleMessagePress = (contact: Contact) => {
    navigation.navigate('ChatDetail', { id: contact.id, name: contact.name });
  };
  
  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      <View style={styles.header}>
        <Text style={styles.title}>Contacts</Text>
      </View>
      
      {renderTabs()}
      
      <FlatList
        data={getFilteredContacts()}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ContactItem
            contact={item}
            onPress={() => handleContactPress(item)}
            onCallPress={() => handleCallPress(item)}
            onMessagePress={() => handleMessagePress(item)}
          />
        )}
        ListEmptyComponent={<EmptyList />}
      />
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
    borderRadius: 20,
    marginHorizontal: 4,
  },
  activeTab: {
    backgroundColor: '#4A90E2',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: 16,
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
    color: '#4A90E2',
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
  actionButtons: {
    flexDirection: 'row',
  },
  callButton: {
    backgroundColor: '#4A90E2',
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
});

export default ContactsScreen; 