import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Platform,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import apiClient from '../utils/apiClient';
import Toast from 'react-native-toast-message';

interface User {
  id: string;
  name: string;
  avatar: string;
  score: number;
  level: string;
  rank: number;
  country?: string;
}

type RankingPeriod = 'today' | 'week' | 'month';

interface RankingItemProps {
  user: User;
  index: number;
}

const RankingItem: React.FC<RankingItemProps> = ({ user, index }) => {
  // Style based on rank
  const isTopThree = index < 3;
  
  // Format score (duration in seconds) to display
  const formatScore = (score: number) => {
    const minutes = Math.floor(score / 60);
    const seconds = score % 60;
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };
  
  // Get rank badge style based on position
  const getRankBadgeStyle = () => {
    if (index === 0) return styles.rank1Container;
    if (index === 1) return styles.rank2Container;
    if (index === 2) return styles.rank3Container;
    return null;
  };
  
  return (
    <View style={styles.rankingItem}>
      <View style={[styles.rankContainer, isTopThree && getRankBadgeStyle()]}>
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
        <Text style={styles.scoreText}>{formatScore(user.score)}</Text>
        <Text style={styles.scoreLabel}>talk time</Text>
      </View>
    </View>
  );
};

interface RankingScreenProps {
  navigation: any;
}

const RankingScreen: React.FC<RankingScreenProps> = ({ navigation }) => {
  const [activePeriod, setActivePeriod] = useState<RankingPeriod>('today');
  const [rankings, setRankings] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [myRanking, setMyRanking] = useState<User | null>(null);
  
  // Fetch rankings when component mounts or period changes
  useEffect(() => {
    fetchRankings();
  }, [activePeriod]);
  
  const fetchRankings = async () => {
    try {
      setLoading(true);
      
      // Fetch rankings and my ranking in parallel
      // Note: baseURL already includes '/api', so we don't add it here
      const [rankingsResponse, myRankingResponse] = await Promise.all([
        apiClient.get(`/rankings?period=${activePeriod}`),
        apiClient.get(`/rankings/me?period=${activePeriod}`)
      ]);
      
      let allRankings = rankingsResponse.data.rankings || [];
      let myRankingData: User | null = null;
      
      if (myRankingResponse.data.success) {
        myRankingData = myRankingResponse.data.myRanking;
        setMyRanking(myRankingData);
        
        // Filter out the current user from the main rankings list
        // so they only appear in the "Your Ranking" card
        if (myRankingData && myRankingData.id) {
          allRankings = allRankings.filter((user: User) => user.id !== myRankingData!.id);
        }
      }
      
      if (rankingsResponse.data.success) {
        setRankings(allRankings);
      }
    } catch (error: any) {
      console.error('Error fetching rankings:', error);
      Toast.show({
        type: 'error',
        text1: 'Error loading rankings',
        text2: error.response?.data?.message || 'Please try again later'
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  const handleRefresh = () => {
    setRefreshing(true);
    fetchRankings();
  };
  
  const handlePeriodChange = (period: RankingPeriod) => {
    if (period !== activePeriod) {
      setActivePeriod(period);
    }
  };
  
  const formatScore = (score: number) => {
    // Score is in seconds, convert to minutes for display
    const minutes = Math.floor(score / 60);
    const seconds = score % 60;
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };
  
  const renderRankingTabs = () => {
    return (
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, activePeriod === 'today' && styles.activeTab]} 
          onPress={() => handlePeriodChange('today')}
          disabled={loading}
        >
          <Text style={[styles.tabText, activePeriod === 'today' && styles.activeTabText]}>Today</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activePeriod === 'week' && styles.activeTab]} 
          onPress={() => handlePeriodChange('week')}
          disabled={loading}
        >
          <Text style={[styles.tabText, activePeriod === 'week' && styles.activeTabText]}>This Week</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activePeriod === 'month' && styles.activeTab]} 
          onPress={() => handlePeriodChange('month')}
          disabled={loading}
        >
          <Text style={[styles.tabText, activePeriod === 'month' && styles.activeTabText]}>This Month</Text>
        </TouchableOpacity>
      </View>
    );
  };
  
  const renderMyRanking = () => {
    if (!myRanking) return null;
    
    return (
      <View style={styles.myRankingContainer}>
        <Text style={styles.myRankingTitle}>Your Ranking</Text>
        <View style={styles.myRankingCard}>
          <View style={[styles.rankContainer, styles.myRankBadge]}>
            <Text style={[styles.rankText, styles.topRankText]}>
              #{myRanking.rank}
            </Text>
          </View>
          
          <Image source={{ uri: myRanking.avatar }} style={styles.avatar} />
          
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{myRanking.name}</Text>
            <Text style={styles.userLevel}>{myRanking.level}</Text>
          </View>
          
          <View style={styles.scoreContainer}>
            <Text style={styles.scoreText}>{formatScore(myRanking.score)}</Text>
            <Text style={styles.scoreLabel}>talk time</Text>
          </View>
        </View>
      </View>
    );
  };
  
  const renderEmptyList = () => {
    if (loading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color="#4A90E2" />
          <Text style={styles.emptyText}>Loading rankings...</Text>
        </View>
      );
    }
    
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No rankings available yet</Text>
        <Text style={styles.emptySubtext}>
          Start making calls to appear on the leaderboard!
        </Text>
      </View>
    );
  };
  
  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title}>Leaderboard</Text>
      </View>
      
      {renderRankingTabs()}
      {renderMyRanking()}
      
      <FlatList
        data={rankings}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <RankingItem user={item} index={index} />
        )}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmptyList}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#4A90E2']}
            tintColor="#4A90E2"
          />
        }
        contentContainerStyle={rankings.length === 0 ? styles.emptyListContainer : undefined}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
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
  myRankingContainer: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  myRankingTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
    marginBottom: 8,
  },
  myRankingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F0F8FF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#4A90E2',
  },
  myRankBadge: {
    backgroundColor: '#4A90E2',
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666666',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999999',
    marginTop: 8,
    textAlign: 'center',
  },
  emptyListContainer: {
    flexGrow: 1,
  },
});

export default RankingScreen; 