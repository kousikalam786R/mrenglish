import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ActivityIndicator, Platform, UIManager, InteractionManager } from 'react-native';
import ErrorBoundary from './ErrorBoundary';

// Disable LayoutAnimation on Android as it can cause issues with ViewManager
if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(false);
  }
}

interface SafeTabViewProps {
  children: React.ReactNode;
  isVisible: boolean;
}

/**
 * A component that safely renders tab content with error boundaries 
 * and handles the mounting/unmounting during tab switching
 */
const SafeTabView: React.FC<SafeTabViewProps> = ({ children, isVisible }) => {
  const [isMounted, setIsMounted] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const mountedRef = useRef(false);
  
  // Handle component cleanup
  useEffect(() => {
    mountedRef.current = true;
    
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Safely mount/unmount on visibility changes - with much longer delays
  useEffect(() => {
    let mountTimer: NodeJS.Timeout | null = null;
    let readyTimer: NodeJS.Timeout | null = null;
    let unmountTimer: NodeJS.Timeout | null = null;
    
    if (isVisible && !isMounted) {
      // Use a direct setTimeout instead of InteractionManager
      mountTimer = setTimeout(() => {
        if (mountedRef.current) {
          setIsMounted(true);
          
          // Longer delay for setting ready state
          readyTimer = setTimeout(() => {
            if (mountedRef.current) {
              setIsReady(true);
            }
          }, 300);
        }
      }, 300);
    } else if (!isVisible && isMounted) {
      // First hide content, then unmount
      setIsReady(false);
      
      unmountTimer = setTimeout(() => {
        if (!isVisible) {
          setIsMounted(false);
        }
      }, 300);
    }
    
    return () => {
      if (mountTimer) clearTimeout(mountTimer);
      if (readyTimer) clearTimeout(readyTimer);
      if (unmountTimer) clearTimeout(unmountTimer);
    };
  }, [isVisible, isMounted]);

  // Only render when visible
  if (!isVisible) {
    return null;
  }

  const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
    console.error('Tab view error:', error, errorInfo);
  };

  // Create a simple wrapper to avoid direct rendering
  const renderContent = () => {
    if (!isMounted) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A90E2" />
        </View>
      );
    }
    
    return (
      <View style={[styles.contentContainer, !isReady && styles.hidden]}>
        {children}
      </View>
    );
  };

  return (
    <ErrorBoundary
      onError={handleError}
      fallbackComponent={
        <View style={styles.container}>
          <ActivityIndicator size="large" color="#4A90E2" />
        </View>
      }
    >
      <View style={styles.container}>
        {renderContent()}
      </View>
    </ErrorBoundary>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  contentContainer: {
    flex: 1,
  },
  hidden: {
    opacity: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default SafeTabView; 