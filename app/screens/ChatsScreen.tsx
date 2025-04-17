import React from 'react';
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
import { ChatsStackNavigationProp } from '../navigation/types';

// Simple chat data structure
interface Chat {
  id: string;
  name: string;
  lastMessage: string;
  time: string;
  unread: number;
}

// Mock data
const CHATS: Chat[] = [
  {
    id: '1',
    name: 'Farijat Arzu',
    lastMessage: 'Thanks for the conversation today!',
    time: '2:30 PM',
    unread: 2,
  },
  {
    id: '2',
    name: 'Kousik Alam',
    lastMessage: 'Can we practice again tomorrow?',
    time: '11:15 AM',
    unread: 0,
  },
  {
    id: '3',
    name: 'Ana Garcia',
    lastMessage: 'I would love to learn more about your country',
    time: 'Yesterday',
    unread: 0,
  },
  {
    id: '4',
    name: 'David Kim',
    lastMessage: 'Good luck with your English test!',
    time: 'Yesterday',
    unread: 1,
  },
  {
    id: '5',
    name: 'Emma Wilson',
    lastMessage: 'Voice message',
    time: 'Monday',
    unread: 0,
  },
];

// Simple, stateless chat item component
const ChatItem = ({ 
  chat, 
  onPress 
}: { 
  chat: Chat; 
  onPress: () => void 
}) => {
  return (
    <TouchableOpacity 
      style={styles.chatItem} 
      onPress={onPress}
    >
      <View style={styles.avatarCircle}>
        <Text style={styles.avatarText}>{chat.name.charAt(0)}</Text>
      </View>
      
      <View style={styles.chatContent}>
        <View style={styles.chatHeader}>
          <Text style={styles.chatName}>{chat.name}</Text>
          <Text style={styles.chatTime}>{chat.time}</Text>
        </View>
        
        <View style={styles.chatFooter}>
          <Text 
            style={styles.lastMessage} 
            numberOfLines={1}
          >
            {chat.lastMessage}
          </Text>
          
          {chat.unread > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{chat.unread}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

// Main component
const ChatsScreen = () => {
  const navigation = useNavigation<ChatsStackNavigationProp>();

  // Simple navigation without animation or delay
  const handleChatPress = (chat: Chat) => {
    navigation.navigate('ChatDetail', { 
      id: chat.id,
      name: chat.name
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
      </View>
      
      <FlatList
        data={CHATS}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ChatItem
            chat={item}
            onPress={() => handleChatPress(item)}
          />
        )}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        removeClippedSubviews={true}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              No messages yet. Start a conversation with someone from your contacts.
            </Text>
          </View>
        }
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
    borderBottomColor: '#F2F2F2',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
  },
  chatItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F2',
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
  chatContent: {
    flex: 1,
    marginLeft: 12,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  chatName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
  },
  chatTime: {
    fontSize: 12,
    color: '#999999',
  },
  chatFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: {
    flex: 1,
    fontSize: 14,
    color: '#666666',
  },
  unreadBadge: {
    backgroundColor: '#4A90E2',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  unreadText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 50,
  },
  emptyText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
  },
});

export default ChatsScreen; 