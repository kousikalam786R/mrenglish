import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAppSelector } from '../redux/hooks';

/**
 * Message Debugger - Shows detailed message data for debugging
 */
const MessageDebugger: React.FC<{ chatId: string }> = ({ chatId }) => {
  const { messages } = useAppSelector(state => state.message);
  const chatMessages = messages[chatId] || [];
  
  // Get the last message to inspect
  const lastMessage = chatMessages[chatMessages.length - 1];

  if (!lastMessage) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>🔍 Message Debugger</Text>
        <Text style={styles.noMessage}>No messages yet</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔍 Last Message Debug</Text>
      
      <View style={styles.messageInfo}>
        <Text style={styles.label}>Message ID:</Text>
        <Text style={styles.value}>{lastMessage._id.substring(0, 12)}...</Text>
        
        <Text style={styles.label}>Status:</Text>
        <Text style={[styles.value, lastMessage.status ? styles.good : styles.bad]}>
          {lastMessage.status || 'undefined'}
        </Text>
        
        <Text style={styles.label}>Sent At:</Text>
        <Text style={[styles.value, lastMessage.sentAt ? styles.good : styles.bad]}>
          {lastMessage.sentAt ? new Date(lastMessage.sentAt).toLocaleTimeString() : 'undefined'}
        </Text>
        
        <Text style={styles.label}>Delivered At:</Text>
        <Text style={[styles.value, lastMessage.deliveredAt ? styles.good : styles.bad]}>
          {lastMessage.deliveredAt ? new Date(lastMessage.deliveredAt).toLocaleTimeString() : 'undefined'}
        </Text>
        
        <Text style={styles.label}>Read At:</Text>
        <Text style={[styles.value, lastMessage.readAt ? styles.good : styles.bad]}>
          {lastMessage.readAt ? new Date(lastMessage.readAt).toLocaleTimeString() : 'undefined'}
        </Text>
        
        <Text style={styles.label}>Read (legacy):</Text>
        <Text style={[styles.value, lastMessage.read ? styles.good : styles.bad]}>
          {lastMessage.read ? 'true' : 'false'}
        </Text>
        
        <Text style={styles.label}>Content:</Text>
        <Text style={styles.value}>{lastMessage.content.substring(0, 30)}...</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f8f8f8',
    padding: 10,
    margin: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  title: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  noMessage: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    padding: 10,
  },
  messageInfo: {
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 4,
  },
  value: {
    fontSize: 11,
    color: '#333',
    marginBottom: 2,
  },
  good: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  bad: {
    color: '#f44336',
    fontWeight: 'bold',
  },
});

export default MessageDebugger;

