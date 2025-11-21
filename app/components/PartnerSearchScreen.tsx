import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Easing,
  BackHandler,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import IconMaterial from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../context/ThemeContext';

interface PartnerSearchScreenProps {
  visible: boolean;
  onCancel: () => void;
  onSettings: () => void;
  emoji?: string;
}

const PartnerSearchScreen: React.FC<PartnerSearchScreenProps> = ({
  visible,
  onCancel,
  onSettings,
  emoji = '👨‍🍳',
}) => {
  const { theme, isDark } = useTheme();
  const [seconds, setSeconds] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const rotationAnim = useRef(new Animated.Value(0)).current;
  
  // Format the timer as MM:SS
  const formatTime = () => {
    const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
    const formattedSeconds = seconds < 10 ? `0${seconds}` : seconds;
    return `${formattedMinutes}:${formattedSeconds}`;
  };
  
  // Reset timer when modal opens/closes
  useEffect(() => {
    if (visible) {
      // Reset timer when opening
      setSeconds(0);
      setMinutes(0);
    }
  }, [visible]);
  
  // Set up the timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (visible) {
      interval = setInterval(() => {
        setSeconds((prevSeconds) => {
          if (prevSeconds >= 59) {
            setMinutes((prevMinutes) => prevMinutes + 1);
            return 0;
          }
          return prevSeconds + 1;
        });
      }, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [visible]);
  
  // Set up the rotation animation
  useEffect(() => {
    if (visible) {
      Animated.loop(
        Animated.timing(rotationAnim, {
          toValue: 1,
          duration: 3000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    } else {
      rotationAnim.setValue(0);
    }
    
    return () => {
      rotationAnim.stopAnimation();
    };
  }, [visible, rotationAnim]);
  
  // Handle back button press on Android
  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (visible) {
          onCancel();
          return true;
        }
        return false;
      }
    );
    
    return () => backHandler.remove();
  }, [visible, onCancel]);
  
  // Calculate the interpolated rotation for the animation
  const spin = rotationAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  
  if (!visible) return null;
  
  const dynamicStyles = {
    container: { backgroundColor: theme.background },
    header: { borderBottomColor: theme.border },
    title: { color: theme.text },
    lookingText: { color: theme.text },
    perfectPartnerText: { color: theme.text },
    timerText: { color: theme.text },
    waitingText: { color: theme.textSecondary },
    instructionText: { color: theme.textSecondary },
    progressCircle: { 
      borderColor: isDark ? 'rgba(103, 58, 183, 0.2)' : 'rgba(103, 58, 183, 0.1)',
      borderTopColor: theme.primary,
      borderRightColor: theme.primary,
    },
    settingsText: { color: theme.primary },
    cancelButton: { backgroundColor: theme.inputBackground },
    cancelText: { color: theme.text },
  };
  
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      onRequestClose={onCancel}
    >
      <SafeAreaView style={[styles.container, dynamicStyles.container]}>
        <View style={[styles.header, dynamicStyles.header]}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={onCancel}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          >
            <Icon name="chevron-back" size={28} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.title, dynamicStyles.title]}>Find a partner</Text>
        </View>
        
        <View style={styles.content}>
          <View style={styles.searchInfoContainer}>
            <Text style={[styles.lookingText, dynamicStyles.lookingText]}>Looking for</Text>
            <Text style={[styles.perfectPartnerText, dynamicStyles.perfectPartnerText]}>the perfect partner</Text>
          </View>
          
          <View style={styles.loaderContainer}>
            <Animated.View
              style={[
                styles.progressCircle,
                dynamicStyles.progressCircle,
                { transform: [{ rotate: spin }] },
              ]}
            />
            <View style={styles.emojiContainer}>
              <Text style={styles.emojiText}>{emoji}</Text>
              <Text style={[styles.timerText, dynamicStyles.timerText]}>{formatTime()}</Text>
              <Text style={[styles.waitingText, dynamicStyles.waitingText]}>
                Waiting time{'\n'}0-2 minutes
              </Text>
            </View>
          </View>
          
          <Text style={[styles.instructionText, dynamicStyles.instructionText]}>
            Don't lock the screen or exit the app
            {'\n'}during the search
          </Text>
          
          <TouchableOpacity 
            style={styles.settingsButton}
            onPress={onSettings}
          >
            <IconMaterial name="tune" size={24} color={theme.primary} />
            <Text style={[styles.settingsText, dynamicStyles.settingsText]}>Search settings</Text>
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity 
          style={[styles.cancelButton, dynamicStyles.cancelButton]}
          onPress={onCancel}
        >
          <Text style={[styles.cancelText, dynamicStyles.cancelText]}>Cancel the search</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    position: 'relative',
    borderBottomWidth: 1,
  },
  backButton: {
    position: 'absolute',
    left: 15,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  searchInfoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  lookingText: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  perfectPartnerText: {
    fontSize: 30,
    fontWeight: 'bold',
  },
  loaderContainer: {
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
  },
  progressCircle: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 8,
  },
  emojiContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiText: {
    fontSize: 40,
    marginBottom: 5,
  },
  timerText: {
    fontSize: 42,
    fontWeight: 'bold',
  },
  waitingText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 5,
  },
  instructionText: {
    fontSize: 16,
    textAlign: 'center',
    marginVertical: 30,
  },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  settingsText: {
    fontSize: 16,
    marginLeft: 8,
  },
  cancelButton: {
    borderRadius: 30,
    paddingVertical: 15,
    paddingHorizontal: 30,
    alignSelf: 'center',
    marginBottom: 30,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '500',
  },
});

export default PartnerSearchScreen; 