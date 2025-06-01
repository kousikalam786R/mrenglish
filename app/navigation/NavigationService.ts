import { createNavigationContainerRef, CommonActions } from '@react-navigation/native';
import { RootStackParamList } from './types';
import { Platform } from 'react-native';

// Create a navigation reference that can be used outside of React components
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

// Create a queue for navigation actions that need to be performed when the navigator becomes ready
type QueuedAction = {
  type: 'navigate' | 'reset' | 'goBack';
  payload?: any;
  timestamp: number;
};

const queuedActions: QueuedAction[] = [];
// Track if navigation is in progress to prevent overlapping transitions
let isNavigating = false;

// Function to process the queued actions once the navigator is ready
export function processQueuedActions() {
  if (!navigationRef.isReady() || isNavigating) return;
  
  // Sort actions by timestamp to ensure they're processed in order
  queuedActions.sort((a, b) => a.timestamp - b.timestamp);
  
  if (queuedActions.length > 0) {
    const action = queuedActions.shift(); // Get the first action
    
    if (!action) return;
    
    isNavigating = true;
    
    try {
      switch (action.type) {
        case 'navigate':
          // @ts-ignore
          navigationRef.navigate(action.payload.name, action.payload.params);
          break;
        case 'reset':
          navigationRef.dispatch(
            CommonActions.reset(action.payload)
          );
          break;
        case 'goBack':
          navigationRef.goBack();
          break;
      }
    } catch (error) {
      console.error('Navigation error:', error);
    }
    
    // On Android, add a delay to prevent UI frame errors during transitions
    if (Platform.OS === 'android') {
      setTimeout(() => {
        isNavigating = false;
        // Process next action if available
        processQueuedActions();
      }, 100);
    } else {
      isNavigating = false;
      // Process next action immediately on iOS
      processQueuedActions();
    }
  }
}

/**
 * Navigate to a screen
 * @param name - The name of the screen to navigate to
 * @param params - The params to pass to the screen
 */
export function navigate(name: keyof RootStackParamList, params?: any) {
  if (navigationRef.isReady() && !isNavigating) {
    isNavigating = true;
    // @ts-ignore - This is a workaround for TypeScript not handling the types correctly
    navigationRef.navigate(name, params);
    
    // Reset navigation lock after a short delay on Android
    if (Platform.OS === 'android') {
      setTimeout(() => {
        isNavigating = false;
        processQueuedActions(); // Process any actions that were queued during navigation
      }, 100);
    } else {
      isNavigating = false;
    }
  } else {
    // Queue navigation for when the navigator becomes ready
    queuedActions.push({
      type: 'navigate',
      payload: { name, params },
      timestamp: Date.now()
    });
    console.log('Navigation queued:', name);
  }
}

/**
 * Reset the navigation state
 * @param routes - The new routes to add to the navigation state
 * @param index - The active route index
 */
export function reset(routes: Array<{name: keyof RootStackParamList, params?: any}>, index: number = 0) {
  if (navigationRef.isReady() && !isNavigating) {
    isNavigating = true;
    navigationRef.dispatch(
      CommonActions.reset({
        index,
        routes,
      })
    );
    
    // Reset navigation lock after a short delay on Android
    if (Platform.OS === 'android') {
      setTimeout(() => {
        isNavigating = false;
        processQueuedActions();
      }, 100);
    } else {
      isNavigating = false;
    }
  } else {
    // Queue reset for when the navigator becomes ready
    queuedActions.push({
      type: 'reset',
      payload: {
        index,
        routes
      },
      timestamp: Date.now()
    });
    console.log('Navigation reset queued:', routes[0]?.name);
  }
}

/**
 * Go back to the previous screen
 */
export function goBack() {
  if (navigationRef.isReady() && navigationRef.canGoBack() && !isNavigating) {
    isNavigating = true;
    navigationRef.goBack();
    
    // Reset navigation lock after a short delay on Android
    if (Platform.OS === 'android') {
      setTimeout(() => {
        isNavigating = false;
        processQueuedActions();
      }, 100);
    } else {
      isNavigating = false;
    }
  } else if (!navigationRef.isReady() || isNavigating) {
    // Queue goBack for when the navigator becomes ready
    queuedActions.push({
      type: 'goBack',
      timestamp: Date.now()
    });
    console.log('Navigation goBack queued');
  }
}

/**
 * Open the network debug screen
 */
export function openNetworkDebugger() {
  if (__DEV__) {
    navigate('NetworkDebug');
  } else {
    console.log('Network debugger is only available in development mode');
  }
}

// Export default object for more intuitive imports
export default {
  navigate,
  reset,
  goBack,
  navigationRef,
  processQueuedActions,
  openNetworkDebugger
}; 