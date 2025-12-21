/**
 * Connecting Modal Component
 * 
 * Shows "Connecting" screen with loading indicator
 * Displayed when callState.status === "connecting"
 * 
 * Auto-transitions to CallScreen when callState.status === "connected"
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Dimensions,
  Animated,
} from 'react-native';
import { useSelector } from 'react-redux';
import { RootState } from '../redux/store';
import { CallStatus } from '../utils/callService';

const { width } = Dimensions.get('window');

const ConnectingModal: React.FC = () => {
  const callState = useSelector((state: RootState) => state.call.activeCall);
  
  // Show modal when status is CONNECTING
  // NOTE: For direct calls, we skip this modal completely - CallScreen shows directly after accept
  // This modal is disabled for now (can be enabled for match calls later if needed)
  const visible = false; // Disabled - direct calls go straight to CallScreen
  
  // Animation values for dots
  const dot1Anim = useRef(new Animated.Value(0.3)).current;
  const dot2Anim = useRef(new Animated.Value(0.3)).current;
  const dot3Anim = useRef(new Animated.Value(0.3)).current;
  const dot4Anim = useRef(new Animated.Value(0.3)).current;
  const dot5Anim = useRef(new Animated.Value(0.3)).current;
  
  // Animate dots with sequential wave animation
  useEffect(() => {
    if (visible) {
      const animateDot = (animValue: Animated.Value, delay: number) => {
        return Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(animValue, {
              toValue: 1,
              duration: 300,
              useNativeDriver: true,
            }),
            Animated.timing(animValue, {
              toValue: 0.3,
              duration: 300,
              useNativeDriver: true,
            }),
          ])
        );
      };
      
      // Create sequential wave animation (each dot lights up one after another)
      const anim1 = animateDot(dot1Anim, 0);
      const anim2 = animateDot(dot2Anim, 150);
      const anim3 = animateDot(dot3Anim, 300);
      const anim4 = animateDot(dot4Anim, 450);
      const anim5 = animateDot(dot5Anim, 600);
      
      anim1.start();
      anim2.start();
      anim3.start();
      anim4.start();
      anim5.start();
      
      return () => {
        anim1.stop();
        anim2.stop();
        anim3.stop();
        anim4.stop();
        anim5.stop();
        dot1Anim.setValue(0.3);
        dot2Anim.setValue(0.3);
        dot3Anim.setValue(0.3);
        dot4Anim.setValue(0.3);
        dot5Anim.setValue(0.3);
      };
    }
  }, [visible, dot1Anim, dot2Anim, dot3Anim, dot4Anim, dot5Anim]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.container}>
        <View style={styles.content}>
          {/* Title */}
          <Text style={styles.title}>Connecting</Text>
          
          {/* Subtitle */}
          <Text style={styles.subtitle}>Be ready to meet your partner :)</Text>
          
          {/* Loading Dots */}
          <View style={styles.loadingContainer}>
            <View style={styles.dotsContainer}>
              <Animated.View 
                style={[
                  styles.dot, 
                  styles.dot1,
                  {
                    opacity: dot1Anim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.3, 1],
                    }),
                    transform: [{
                      scale: dot1Anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.2],
                      }),
                    }],
                  }
                ]} 
              />
              <Animated.View 
                style={[
                  styles.dot, 
                  styles.dot2,
                  {
                    opacity: dot2Anim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.3, 1],
                    }),
                  }
                ]} 
              />
              <Animated.View 
                style={[
                  styles.dot, 
                  styles.dot3,
                  {
                    opacity: dot3Anim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.3, 1],
                    }),
                  }
                ]} 
              />
              <Animated.View 
                style={[
                  styles.dot, 
                  styles.dot4,
                  {
                    opacity: dot4Anim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.3, 1],
                    }),
                  }
                ]} 
              />
              <Animated.View 
                style={[
                  styles.dot, 
                  styles.dot5,
                  {
                    opacity: dot5Anim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.3, 1],
                    }),
                  }
                ]} 
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    width: width * 0.8,
    maxWidth: 350,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 32,
    textAlign: 'center',
  },
  loadingContainer: {
    marginTop: 24,
    alignItems: 'center',
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#6366F1', // Purple color matching the app theme
  },
  dot1: {},
  dot2: {},
  dot3: {},
  dot4: {},
  dot5: {},
});

export default ConnectingModal;

