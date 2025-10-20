import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';

interface ConnectingScreenProps {
  visible: boolean;
  partnerName?: string;
  onCancel?: () => void;
}

const { width, height } = Dimensions.get('window');

const ConnectingScreen: React.FC<ConnectingScreenProps> = ({
  visible,
  partnerName = 'your partner',
  onCancel,
}) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const dotsAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Pulse animation for the connecting text
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );

      // Dots animation
      const dotsAnimation = Animated.loop(
        Animated.timing(dotsAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );

      pulseAnimation.start();
      dotsAnimation.start();

      return () => {
        pulseAnimation.stop();
        dotsAnimation.stop();
      };
    }
  }, [visible, pulseAnim, dotsAnim]);

  const dotsOpacity = dotsAnim.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [0.3, 1, 0.3, 0.3, 0.3],
  });

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      statusBarTranslucent
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Connecting</Text>
          </View>

          {/* Main Content */}
          <View style={styles.mainContent}>
            <Animated.View
              style={[
                styles.iconContainer,
                { transform: [{ scale: pulseAnim }] },
              ]}
            >
              <Icon name="call" size={80} color="#673AB7" />
            </Animated.View>

            <Text style={styles.message}>
              Be ready to meet {partnerName} :)
            </Text>

            {/* Loading Dots */}
            <View style={styles.dotsContainer}>
              <Animated.View style={[styles.dot, { opacity: dotsOpacity }]} />
              <Animated.View style={[styles.dot, { opacity: dotsOpacity }]} />
              <Animated.View style={[styles.dot, { opacity: dotsOpacity }]} />
              <Animated.View style={[styles.dot, { opacity: dotsOpacity }]} />
            </View>
          </View>

          {/* Cancel Button */}
          {onCancel && (
            <View style={styles.cancelContainer}>
              <Text style={styles.cancelText} onPress={onCancel}>
                Cancel
              </Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  header: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  mainContent: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
    shadowColor: '#673AB7',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  message: {
    fontSize: 20,
    color: '#666',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 28,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#673AB7',
    marginHorizontal: 4,
  },
  cancelContainer: {
    position: 'absolute',
    bottom: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 18,
    color: '#666',
    textDecorationLine: 'underline',
  },
});

export default ConnectingScreen;
