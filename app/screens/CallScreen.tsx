import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  SafeAreaView,
  StatusBar,
  Alert,
  InteractionManager,
  BackHandler,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { CallRouteProp } from '../navigation/types';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { safeParam } from '../utils/safeProps';

const CallScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<CallRouteProp>();
  
  // Safely extract parameters with defaults
  const id = safeParam(route, 'id', '0');
  const name = safeParam(route, 'name', 'User');
  const isVideoCall = safeParam(route, 'isVideoCall', false);
  const avatar = "https://randomuser.me/api/portraits/men/32.jpg"; // Default avatar
  
  const [callDuration, setCallDuration] = useState(0); // Duration in seconds
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(isVideoCall);
  const [isReady, setIsReady] = useState(false);
  
  // Handle back button
  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = () => {
        handleEndCall();
        return true;
      };
      
      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      
      return () => subscription.remove();
    }, [])
  );
  
  // Wait for animations to complete before rendering content
  useEffect(() => {
    const timer = InteractionManager.runAfterInteractions(() => {
      setIsReady(true);
    });
    
    return () => timer.cancel();
  }, []);
  
  // Start timer when call screen loads
  useEffect(() => {
    const timerId = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
    
    // Clear timer on component unmount
    return () => clearInterval(timerId);
  }, []);

  useEffect(() => {
    // Add a warning if required parameters are missing
    if (!route.params?.id || !route.params?.name) {
      console.warn('CallScreen: Missing required parameters');
    }
  }, [route.params]);
  
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };
  
  const handleEndCall = () => {
    try {
      navigation.goBack();
    } catch (error) {
      console.error('Error navigating back:', error);
      // Fallback navigation
      navigation.navigate('Chats');
    }
  };
  
  const toggleMute = () => {
    setIsMuted(!isMuted);
  };
  
  const toggleSpeaker = () => {
    setIsSpeakerOn(!isSpeakerOn);
  };
  
  const toggleVideo = () => {
    setIsVideoOn(!isVideoOn);
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#333333" />
      
      <View style={styles.callInfoContainer}>
        <Image source={{ uri: avatar }} style={styles.avatar} />
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.status}>
          {callDuration === 0 ? 'Connecting...' : formatTime(callDuration)}
        </Text>
      </View>
      
      <View style={styles.actionsContainer}>
        <TouchableOpacity 
          style={[styles.actionButton, isMuted && styles.actionButtonActive]} 
          onPress={toggleMute}
        >
          <Text style={styles.actionButtonIcon}>{isMuted ? '🔇' : '🔊'}</Text>
          <Text style={styles.actionButtonText}>Mute</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.actionButton, isSpeakerOn && styles.actionButtonActive]} 
          onPress={toggleSpeaker}
        >
          <Text style={styles.actionButtonIcon}>📢</Text>
          <Text style={styles.actionButtonText}>Speaker</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.actionButton, isVideoOn && styles.actionButtonActive]} 
          onPress={toggleVideo}
        >
          <Text style={styles.actionButtonIcon}>{isVideoOn ? '📹' : '📷'}</Text>
          <Text style={styles.actionButtonText}>Video</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.noteContainer}>
        <Text style={styles.noteTitle}>📝 Discussion Topics</Text>
        <View style={styles.noteItem}>
          <Text style={styles.noteText}>• Technology trends in 2023</Text>
        </View>
        <View style={styles.noteItem}>
          <Text style={styles.noteText}>• Travel experiences in Europe</Text>
        </View>
        <View style={styles.noteItem}>
          <Text style={styles.noteText}>• Business English vocabulary</Text>
        </View>
      </View>
      
      <TouchableOpacity style={styles.endCallButton} onPress={handleEndCall}>
        <Text style={styles.endCallText}>End Call</Text>
      </TouchableOpacity>
      
      <View style={styles.tipsContainer}>
        <Text style={styles.tipsTitle}>💡 Conversation Tips</Text>
        <Text style={styles.tipsText}>
          Remember to speak clearly and don't be afraid to ask for clarification if needed.
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#333333',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
  },
  callInfoContainer: {
    alignItems: 'center',
    marginTop: 40,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#4A90E2',
    marginBottom: 20,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  status: {
    fontSize: 18,
    color: '#BBBBBB',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginVertical: 30,
  },
  actionButton: {
    alignItems: 'center',
    padding: 16,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  actionButtonActive: {
    backgroundColor: '#4A90E2',
  },
  actionButtonIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 14,
  },
  noteContainer: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  noteTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 12,
  },
  noteItem: {
    marginBottom: 8,
  },
  noteText: {
    fontSize: 16,
    color: '#DDDDDD',
  },
  endCallButton: {
    backgroundColor: '#E53935',
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 50,
    marginBottom: 20,
  },
  endCallText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  tipsContainer: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  tipsText: {
    fontSize: 14,
    color: '#DDDDDD',
    lineHeight: 20,
  },
});

export default CallScreen;