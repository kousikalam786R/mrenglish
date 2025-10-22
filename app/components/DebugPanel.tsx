import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useAppSelector } from '../redux/hooks';

/**
 * Debug Panel to show enhanced chat data
 * This will help us see if the enhanced features are working
 */
const DebugPanel: React.FC<{ chatId: string }> = ({ chatId }) => {
  const { messages } = useAppSelector(state => state.message);
  const chatMessages = messages[chatId] || [];
  
  // Get the last few messages to inspect
  const recentMessages = chatMessages.slice(-3);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔍 Debug Panel - Enhanced Features</Text>
      
      <ScrollView style={styles.scrollView}>
        <Text style={styles.sectionTitle}>Recent Messages Status:</Text>
        
        {recentMessages.map((msg, index) => (
          <View key={msg._id} style={styles.messageDebug}>
            <Text style={styles.messageId}>Message {index + 1}: {msg._id.substring(0, 8)}...</Text>
            <Text style={styles.status}>Status: {msg.status || 'undefined'}</Text>
            <Text style={styles.timestamp}>Sent: {msg.sentAt || 'undefined'}</Text>
            <Text style={styles.timestamp}>Delivered: {msg.deliveredAt || 'undefined'}</Text>
            <Text style={styles.timestamp}>Read: {msg.readAt || 'undefined'}</Text>
            <Text style={styles.content}>Content: {msg.content.substring(0, 30)}...</Text>
          </View>
        ))}

        {recentMessages.length === 0 && (
          <Text style={styles.noMessages}>No messages to debug</Text>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f0f0f0',
    padding: 10,
    margin: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  title: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  scrollView: {
    maxHeight: 200,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 4,
  },
  messageDebug: {
    backgroundColor: '#fff',
    padding: 8,
    marginBottom: 4,
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#4CAF50',
  },
  messageId: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#333',
  },
  status: {
    fontSize: 10,
    color: '#2196F3',
  },
  timestamp: {
    fontSize: 10,
    color: '#666',
  },
  content: {
    fontSize: 10,
    color: '#333',
    fontStyle: 'italic',
  },
  noMessages: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    padding: 20,
  },
});

export default DebugPanel;

