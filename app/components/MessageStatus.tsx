import React from 'react';
import { View, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Message } from '../types/Message';

interface MessageStatusProps {
  message: Message;
  isSender: boolean;
}

/**
 * MessageStatus Component
 * Shows message delivery and read status for sent messages
 * 
 * Status Icons:
 * - ✓ Single check: Sent
 * - ✓✓ Double check gray: Delivered  
 * - ✓✓ Double check blue: Read
 */
const MessageStatus: React.FC<MessageStatusProps> = ({ message, isSender }) => {
  // Only show status for messages sent by current user
  if (!isSender) return null;

  const getStatusIcon = () => {
    switch (message.status) {
      case 'sent':
        return (
          <Icon 
            name="check" 
            size={16} 
            color="#999999" 
            style={styles.statusIcon}
          />
        );
      case 'delivered':
        return (
          <View style={styles.doubleCheck}>
            <Icon 
              name="done-all" 
              size={16} 
              color="#999999" 
              style={styles.statusIcon}
            />
          </View>
        );
      case 'read':
        return (
          <View style={styles.doubleCheck}>
            <Icon 
              name="done-all" 
              size={16} 
              color="#4FC3F7" 
              style={styles.statusIcon}
            />
          </View>
        );
      default:
        // Fallback for legacy messages
        if (message.read) {
          return (
            <View style={styles.doubleCheck}>
              <Icon 
                name="done-all" 
                size={16} 
                color="#4FC3F7" 
                style={styles.statusIcon}
              />
            </View>
          );
        }
        return (
          <Icon 
            name="check" 
            size={16} 
            color="#999999" 
            style={styles.statusIcon}
          />
        );
    }
  };

  return (
    <View style={styles.container}>
      {getStatusIcon()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
  },
  statusIcon: {
    // Base icon styling
  },
  doubleCheck: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

export default MessageStatus;

