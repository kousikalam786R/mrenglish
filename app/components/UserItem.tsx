import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

interface UserItemProps {
  id: string;
  name: string;
  subtitle?: string;
  avatar?: string;
  isOnline?: boolean;
  onPress: (id: string, name: string, avatar?: string) => void;
}

const UserItem: React.FC<UserItemProps> = ({ id, name, subtitle, avatar, isOnline = false, onPress }) => {
  // Default avatar if not provided
  const defaultAvatar = 'https://randomuser.me/api/portraits/men/32.jpg';
  
  return (
    <TouchableOpacity 
      style={styles.container} 
      onPress={() => onPress(id, name, avatar)}
      activeOpacity={0.7}
    >
      <View style={styles.avatarContainer}>
        <Image 
          source={{ uri: avatar || defaultAvatar }}
          style={styles.avatar}
        />
        {isOnline && <View style={styles.onlineIndicator} />}
      </View>
      
      <View style={styles.textContainer}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{name}</Text>
          {isOnline ? (
            <Text style={styles.onlineText}>Online</Text>
          ) : (
            <Text style={styles.offlineText}>Offline</Text>
          )}
        </View>
        {subtitle ? (
          <Text style={styles.subtitle}>{subtitle}</Text>
        ) : null}
      </View>
      
      <Icon name="chevron-forward" size={24} color="#999" />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 12,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: '#fff',
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  onlineText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  offlineText: {
    fontSize: 12,
    color: '#9E9E9E',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
});

export default UserItem; 