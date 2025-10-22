import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { User } from '../types/Message';

interface OnlineStatusProps {
  user: User;
  showLastSeen?: boolean;
  compact?: boolean;
}

/**
 * OnlineStatus Component
 * Shows user online/offline status and last seen information
 */
const OnlineStatus: React.FC<OnlineStatusProps> = ({ 
  user, 
  showLastSeen = true, 
  compact = false 
}) => {
  const formatLastSeen = (lastSeenAt: string) => {
    const now = new Date();
    const lastSeen = new Date(lastSeenAt);
    const diffMs = now.getTime() - lastSeen.getTime();
    
    // Less than 1 minute
    if (diffMs < 60000) {
      return 'Just now';
    }
    
    // Less than 1 hour
    if (diffMs < 3600000) {
      const minutes = Math.floor(diffMs / 60000);
      return `${minutes}m ago`;
    }
    
    // Less than 24 hours
    if (diffMs < 86400000) {
      const hours = Math.floor(diffMs / 3600000);
      return `${hours}h ago`;
    }
    
    // Less than 7 days
    if (diffMs < 604800000) {
      const days = Math.floor(diffMs / 86400000);
      return `${days}d ago`;
    }
    
    // More than 7 days - show date
    return lastSeen.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const getStatusText = () => {
    if (user.isOnline) {
      if (user.isTyping) {
        return 'Typing...';
      }
      return 'Online';
    } else if (showLastSeen && user.lastSeenAt) {
      return `Last seen ${formatLastSeen(user.lastSeenAt)}`;
    } else {
      return 'Offline';
    }
  };

  const getStatusColor = () => {
    if (user.isOnline) {
      if (user.isTyping) {
        return '#4CAF50'; // Green for typing
      }
      return '#4CAF50'; // Green for online
    }
    return '#999999'; // Gray for offline
  };

  const getStatusDotColor = () => {
    return user.isOnline ? '#4CAF50' : '#999999';
  };

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <View 
          style={[
            styles.statusDot, 
            { backgroundColor: getStatusDotColor() }
          ]} 
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View 
        style={[
          styles.statusDot, 
          { backgroundColor: getStatusDotColor() }
        ]} 
      />
      <Text 
        style={[
          styles.statusText, 
          { color: getStatusColor() }
        ]}
        numberOfLines={1}
      >
        {getStatusText()}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  compactContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
});

export default OnlineStatus;

