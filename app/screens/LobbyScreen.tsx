import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  Image, 
  StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';

// Define user type
interface User {
  id: string;
  name: string;
  avatar: string;
  level: string;
  country: string;
  status: string;
}

// Mock data for online users
const USERS: User[] = [
  {
    id: '1',
    name: 'Farihat Arzu',
    avatar: 'https://randomuser.me/api/portraits/women/10.jpg',
    level: 'Intermediate',
    country: '🇬🇧 UK',
    status: 'online',
  },
  {
    id: '2',
    name: 'Kousik Alam',
    avatar: 'https://randomuser.me/api/portraits/men/4.jpg',
    level: 'Advanced',
    country: '🇯🇵 Japan',
    status: 'online',
  },
  {
    id: '3',
    name: 'Ana Garcia',
    avatar: 'https://randomuser.me/api/portraits/women/3.jpg',
    level: 'Beginner',
    country: '🇪🇸 Spain',
    status: 'online',
  },
  {
    id: '4',
    name: 'David Kim',
    avatar: 'https://randomuser.me/api/portraits/men/2.jpg',
    level: 'Intermediate',
    country: '🇰🇷 South Korea',
    status: 'online',
  },
  {
    id: '5',
    name: 'Emma Wilson',
    avatar: 'https://randomuser.me/api/portraits/women/5.jpg',
    level: 'Advanced',
    country: '🇦🇺 Australia',
    status: 'online',
  },
];

interface UserCardProps {
  user: User;
  onPress: () => void;
}

const UserCard = ({ user, onPress }: UserCardProps) => {
  return (
    <TouchableOpacity 
      style={styles.userCard}
      onPress={onPress}
    >
      <View style={styles.userCardContent}>
        <Image source={{ uri: user.avatar }} style={styles.avatar} />
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{user.name}</Text>
          <Text style={styles.userMeta}>{user.level} • {user.country}</Text>
        </View>
        <View style={styles.callButton}>
          <Text style={styles.callButtonText}>Call</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

interface LobbyScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList>;
}

const LobbyScreen = ({ navigation }: LobbyScreenProps) => {
  const [refreshing, setRefreshing] = useState(false);

  const handleUserPress = (user: User) => {
    // Navigate to call screen or user profile
    navigation.navigate('Call', { id: user.id, name: user.name });
  };

  const handleRefresh = () => {
    setRefreshing(true);
    // In a real app, fetch new data here
    setTimeout(() => {
      setRefreshing(false);
    }, 1500);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      <View style={styles.header}>
        <Text style={styles.title}>Online Now</Text>
        <Text style={styles.subtitle}>{USERS.length} people ready to practice</Text>
      </View>
      
      <FlatList
        data={USERS}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <UserCard user={item} onPress={() => handleUserPress(item)} />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={handleRefresh}
      />
      
      <TouchableOpacity style={styles.randomCallButton}>
        <Text style={styles.randomCallText}>Random Call</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 10,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  listContent: {
    padding: 15,
  },
  userCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  userCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  userMeta: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  callButton: {
    backgroundColor: '#4A90E2',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 50,
  },
  callButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  randomCallButton: {
    backgroundColor: '#4A90E2',
    margin: 20,
    padding: 16,
    borderRadius: 50,
    alignItems: 'center',
    shadowColor: '#4A90E2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  randomCallText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default LobbyScreen; 