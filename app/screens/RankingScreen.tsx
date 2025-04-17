import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface User {
  id: string;
  name: string;
  avatar: string;
  score: number;
  level: string;
  rank: number;
}

// Mock data for rankings
const TODAY_USERS: User[] = [
  { id: '1', name: 'Sarah Johnson', avatar: 'https://randomuser.me/api/portraits/women/1.jpg', score: 1250, level: 'Intermediate', rank: 1 },
  { id: '2', name: 'Michael Chen', avatar: 'https://randomuser.me/api/portraits/men/2.jpg', score: 980, level: 'Advanced', rank: 2 },
  { id: '3', name: 'Ana Garcia', avatar: 'https://randomuser.me/api/portraits/women/3.jpg', score: 820, level: 'Beginner', rank: 3 },
  { id: '4', name: 'David Kim', avatar: 'https://randomuser.me/api/portraits/men/4.jpg', score: 750, level: 'Intermediate', rank: 4 },
  { id: '5', name: 'Emma Wilson', avatar: 'https://randomuser.me/api/portraits/women/5.jpg', score: 720, level: 'Advanced', rank: 5 },
  { id: '6', name: 'James Brown', avatar: 'https://randomuser.me/api/portraits/men/6.jpg', score: 680, level: 'Intermediate', rank: 6 },
  { id: '7', name: 'Olivia Martin', avatar: 'https://randomuser.me/api/portraits/women/7.jpg', score: 650, level: 'Beginner', rank: 7 },
];

const WEEK_USERS: User[] = [
  { id: '2', name: 'Michael Chen', avatar: 'https://randomuser.me/api/portraits/men/2.jpg', score: 5400, level: 'Advanced', rank: 1 },
  { id: '1', name: 'Sarah Johnson', avatar: 'https://randomuser.me/api/portraits/women/1.jpg', score: 4800, level: 'Intermediate', rank: 2 },
  { id: '5', name: 'Emma Wilson', avatar: 'https://randomuser.me/api/portraits/women/5.jpg', score: 3950, level: 'Advanced', rank: 3 },
  { id: '3', name: 'Ana Garcia', avatar: 'https://randomuser.me/api/portraits/women/3.jpg', score: 3200, level: 'Beginner', rank: 4 },
  { id: '6', name: 'James Brown', avatar: 'https://randomuser.me/api/portraits/men/6.jpg', score: 2800, level: 'Intermediate', rank: 5 },
  { id: '4', name: 'David Kim', avatar: 'https://randomuser.me/api/portraits/men/4.jpg', score: 2500, level: 'Intermediate', rank: 6 },
  { id: '7', name: 'Olivia Martin', avatar: 'https://randomuser.me/api/portraits/women/7.jpg', score: 2100, level: 'Beginner', rank: 7 },
];

const MONTH_USERS: User[] = [
  { id: '5', name: 'Emma Wilson', avatar: 'https://randomuser.me/api/portraits/women/5.jpg', score: 24500, level: 'Advanced', rank: 1 },
  { id: '2', name: 'Michael Chen', avatar: 'https://randomuser.me/api/portraits/men/2.jpg', score: 22800, level: 'Advanced', rank: 2 },
  { id: '1', name: 'Sarah Johnson', avatar: 'https://randomuser.me/api/portraits/women/1.jpg', score: 19600, level: 'Intermediate', rank: 3 },
  { id: '6', name: 'James Brown', avatar: 'https://randomuser.me/api/portraits/men/6.jpg', score: 15400, level: 'Intermediate', rank: 4 },
  { id: '3', name: 'Ana Garcia', avatar: 'https://randomuser.me/api/portraits/women/3.jpg', score: 12800, level: 'Beginner', rank: 5 },
  { id: '4', name: 'David Kim', avatar: 'https://randomuser.me/api/portraits/men/4.jpg', score: 11200, level: 'Intermediate', rank: 6 },
  { id: '7', name: 'Olivia Martin', avatar: 'https://randomuser.me/api/portraits/women/7.jpg', score: 9500, level: 'Beginner', rank: 7 },
];

type RankingPeriod = 'today' | 'week' | 'month';

interface RankingItemProps {
  user: User;
  index: number;
}

const RankingItem: React.FC<RankingItemProps> = ({ user, index }) => {
  // Style based on rank
  const isTopThree = index < 3;
  
  return (
    <View style={styles.rankingItem}>
      <View style={[styles.rankContainer, isTopThree && styles[`rank${index + 1}Container` as keyof typeof styles]]}>
        <Text style={[styles.rankText, isTopThree && styles.topRankText]}>
          {index + 1}
        </Text>
      </View>
      
      <Image source={{ uri: user.avatar }} style={styles.avatar} />
      
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{user.name}</Text>
        <Text style={styles.userLevel}>{user.level}</Text>
      </View>
      
      <View style={styles.scoreContainer}>
        <Text style={styles.scoreText}>{user.score}</Text>
        <Text style={styles.scoreLabel}>points</Text>
      </View>
    </View>
  );
};

interface RankingScreenProps {
  navigation: any;
}

const RankingScreen: React.FC<RankingScreenProps> = ({ navigation }) => {
  const [activePeriod, setActivePeriod] = useState<RankingPeriod>('today');
  
  const renderRankingTabs = () => {
    return (
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, activePeriod === 'today' && styles.activeTab]} 
          onPress={() => setActivePeriod('today')}
        >
          <Text style={[styles.tabText, activePeriod === 'today' && styles.activeTabText]}>Today</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activePeriod === 'week' && styles.activeTab]} 
          onPress={() => setActivePeriod('week')}
        >
          <Text style={[styles.tabText, activePeriod === 'week' && styles.activeTabText]}>This Week</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activePeriod === 'month' && styles.activeTab]} 
          onPress={() => setActivePeriod('month')}
        >
          <Text style={[styles.tabText, activePeriod === 'month' && styles.activeTabText]}>This Month</Text>
        </TouchableOpacity>
      </View>
    );
  };
  
  const getRankingData = () => {
    switch (activePeriod) {
      case 'today':
        return TODAY_USERS;
      case 'week':
        return WEEK_USERS;
      case 'month':
        return MONTH_USERS;
      default:
        return TODAY_USERS;
    }
  };
  
  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title}>Leaderboard</Text>
      </View>
      
      {renderRankingTabs()}
      
      <FlatList
        data={getRankingData()}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <RankingItem user={item} index={index} />
        )}
        showsVerticalScrollIndicator={false}
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
  rankingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  rankContainer: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#E5E5E5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rank1Container: {
    backgroundColor: '#FFD700', // Gold
  },
  rank2Container: {
    backgroundColor: '#C0C0C0', // Silver
  },
  rank3Container: {
    backgroundColor: '#CD7F32', // Bronze
  },
  rankText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666666',
  },
  topRankText: {
    color: '#FFFFFF',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
  },
  userLevel: {
    fontSize: 12,
    color: '#666666',
  },
  scoreContainer: {
    alignItems: 'flex-end',
  },
  scoreText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4A90E2',
  },
  scoreLabel: {
    fontSize: 12,
    color: '#999999',
  },
});

export default RankingScreen; 