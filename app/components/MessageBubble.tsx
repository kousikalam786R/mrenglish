import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';

interface MessageBubbleProps {
  content: string;
  time: string;
  isSender: boolean;
  read?: boolean;
  avatar?: string;
  username?: string;
  showAvatar?: boolean;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  content,
  time,
  isSender,
  read = false,
  avatar,
  username,
  showAvatar = true,
}) => {
  // Generate a color based on the username (for consistent message colors)
  const getAvatarLetter = () => {
    if (!username || username.length === 0) return '?';
    return username.charAt(0).toUpperCase();
  };

  // Get avatar component based on props
  const renderAvatar = () => {
    if (!showAvatar) return null;
    
    if (avatar) {
      return (
        <Image 
          source={{ uri: avatar }} 
          style={styles.avatar}
        />
      );
    }
    
    return (
      <View style={[
        styles.avatarFallback, 
        isSender ? styles.senderAvatar : styles.receiverAvatar
      ]}>
        <Text style={styles.avatarText}>{getAvatarLetter()}</Text>
      </View>
    );
  };

  return (
    <View style={[
      styles.messageContainer,
      isSender ? styles.senderMessageContainer : styles.receiverMessageContainer
    ]}>
      {/* Only show avatar for received messages */}
      {/* {!isSender && renderAvatar()} */}
      
      <View style={[
        styles.bubble,
        isSender ? styles.senderBubble : styles.receiverBubble,
      ]}>
        <Text style={[
          styles.messageText,
          isSender ? styles.senderText : styles.receiverText
        ]}>
          {content}
        </Text>
        
        <View style={styles.timeContainer}>
          <Text style={[
            styles.time,
            isSender ? styles.senderTime : styles.receiverTime
          ]}>
            {time}
          </Text>
          
          {isSender && (
            <Text style={styles.readStatus}>
              {read ? '✓✓' : '✓'}
            </Text>
          )}
        </View>
      </View>
      
      {/* Only show avatar for sent messages */}
      {/* {isSender && renderAvatar()} */}
    </View>
  );
};

const styles = StyleSheet.create({
  messageContainer: {
    flexDirection: 'row',
    marginVertical: 4,
    paddingHorizontal: 12,
    alignItems: 'flex-end',
  },
  senderMessageContainer: {
    justifyContent: 'flex-end',
  },
  receiverMessageContainer: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '75%',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 8,
  },
  senderBubble: {
    backgroundColor: '#6A3DE8',
    borderBottomRightRadius: 4,
  },
  receiverBubble: {
    backgroundColor: '#F2F2F2',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  senderText: {
    color: '#FFFFFF',
  },
  receiverText: {
    color: '#333333',
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  time: {
    fontSize: 11,
    marginRight: 2,
  },
  senderTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  receiverTime: {
    color: '#888888',
  },
  readStatus: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  avatarFallback: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  senderAvatar: {
    backgroundColor: '#4CAF50',
  },
  receiverAvatar: {
    backgroundColor: '#FF5722',
  },
  avatarText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default MessageBubble; 