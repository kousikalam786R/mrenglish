import { createNavigationContainerRef, CommonActions } from '@react-navigation/native';
import type { RootStackParamList } from './types';
import { Platform } from 'react-native';

// Dynamic import for StackActions to handle cases where it might not be available
let StackActions: any = null;
try {
  const nativeStackModule = require('@react-navigation/native-stack');
  StackActions = nativeStackModule.StackActions;
} catch (error) {
  console.warn('⚠️ [NavigationService] Could not import StackActions:', error);
}

// Create a navigation reference that can be used outside of React components
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

// Create a queue for navigation actions that need to be performed when the navigator becomes ready
type QueuedAction = {
  type: 'navigate' | 'reset' | 'goBack' | 'replace';
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
        case 'replace':
          try {
            // Try to use StackActions.replace if available
            if (StackActions && typeof StackActions.replace === 'function') {
              navigationRef.dispatch(
                StackActions.replace(action.payload.name, action.payload.params)
              );
            } else {
              // Fallback: Use reset to replace current screen
              const rootState = navigationRef.getRootState();
              if (rootState && rootState.routes && rootState.routes.length > 0) {
                const routesBeforeCurrent = rootState.routes.slice(0, -1);
                const newRoutes = [
                  ...routesBeforeCurrent,
                  { 
                    name: action.payload.name, 
                    params: action.payload.params, 
                    key: `${action.payload.name}-${Date.now()}` 
                  } as any
                ];
                
                navigationRef.dispatch(
                  CommonActions.reset({
                    index: newRoutes.length - 1,
                    routes: newRoutes,
                  })
                );
              } else {
                // Final fallback: Just navigate normally
                // @ts-ignore
                navigationRef.navigate(action.payload.name, action.payload.params);
              }
            }
          } catch (error) {
            console.error('Navigation replace error:', error);
            // Fallback: Just navigate normally
            try {
              // @ts-ignore
              navigationRef.navigate(action.payload.name, action.payload.params);
            } catch (navError) {
              console.error('Fallback navigation also failed:', navError);
            }
          }
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
 * Replace the current screen with a new screen
 * @param name - The name of the screen to replace with
 * @param params - The params to pass to the screen
 */
export function replace(name: keyof RootStackParamList, params?: any) {
  if (navigationRef.isReady() && !isNavigating) {
    isNavigating = true;
    try {
      // Try to use StackActions.replace if available
      if (StackActions && typeof StackActions.replace === 'function') {
        console.log('✅ [NavigationService] Using StackActions.replace');
        // @ts-ignore - This is a workaround for TypeScript not handling the types correctly
        navigationRef.dispatch(
          StackActions.replace(name, params)
        );
      } else {
        // Fallback: Use reset to replace current screen
        console.log('⚠️ [NavigationService] StackActions.replace not available, using reset fallback');
        // Get current navigation state
        const rootState = navigationRef.getRootState();
        if (rootState && rootState.routes && rootState.routes.length > 0) {
          // Get routes before the current one (remove last route which is CallScreen)
          const routesBeforeCurrent = rootState.routes.slice(0, -1);
          // Add the new screen
          const newRoutes = [
            ...routesBeforeCurrent,
            { name, params, key: `${name}-${Date.now()}` } as any
          ];
          
          console.log('📊 [NavigationService] Resetting navigation with routes:', newRoutes.map(r => r.name));
          // Reset navigation stack with new routes
          navigationRef.dispatch(
            CommonActions.reset({
              index: newRoutes.length - 1,
              routes: newRoutes,
            })
          );
        } else {
          // Final fallback: Just navigate normally
          console.warn('⚠️ [NavigationService] Could not get root state, using navigate instead');
          // @ts-ignore
          navigationRef.navigate(name, params);
        }
      }
    } catch (error) {
      console.error('❌ [NavigationService] Error in replace:', error);
      // Fallback: Just navigate normally
      try {
        console.log('⚠️ [NavigationService] Using fallback navigate');
        // @ts-ignore
        navigationRef.navigate(name, params);
      } catch (navError) {
        console.error('❌ [NavigationService] Fallback navigation also failed:', navError);
      }
    }
    
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
    // Queue replace for when the navigator becomes ready
    queuedActions.push({
      type: 'replace',
      payload: { name, params },
      timestamp: Date.now()
    });
    console.log('Navigation replace queued:', name);
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
  replace,
  reset,
  goBack,
  navigationRef,
  processQueuedActions,
  openNetworkDebugger
}; 