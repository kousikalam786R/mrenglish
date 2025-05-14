import { createNavigationContainerRef, CommonActions } from '@react-navigation/native';
import { RootStackParamList } from './types';

// Create a navigation reference that can be used outside of React components
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

// Create a queue for navigation actions that need to be performed when the navigator becomes ready
type QueuedAction = {
  type: 'navigate' | 'reset' | 'goBack';
  payload?: any;
};

const queuedActions: QueuedAction[] = [];

// Function to process the queued actions once the navigator is ready
export function processQueuedActions() {
  if (!navigationRef.isReady()) return;
  
  queuedActions.forEach(action => {
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
  });
  
  // Clear the queue after processing
  queuedActions.length = 0;
}

/**
 * Navigate to a screen
 * @param name - The name of the screen to navigate to
 * @param params - The params to pass to the screen
 */
export function navigate(name: keyof RootStackParamList, params?: any) {
  if (navigationRef.isReady()) {
    // @ts-ignore - This is a workaround for TypeScript not handling the types correctly
    navigationRef.navigate(name, params);
  } else {
    // Queue navigation for when the navigator becomes ready
    queuedActions.push({
      type: 'navigate',
      payload: { name, params }
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
  if (navigationRef.isReady()) {
    navigationRef.dispatch(
      CommonActions.reset({
        index,
        routes,
      })
    );
  } else {
    // Queue reset for when the navigator becomes ready
    queuedActions.push({
      type: 'reset',
      payload: {
        index,
        routes
      }
    });
    console.log('Navigation reset queued:', routes[0]?.name);
  }
}

/**
 * Go back to the previous screen
 */
export function goBack() {
  if (navigationRef.isReady() && navigationRef.canGoBack()) {
    navigationRef.goBack();
  } else if (!navigationRef.isReady()) {
    // Queue goBack for when the navigator becomes ready
    queuedActions.push({
      type: 'goBack'
    });
    console.log('Navigation goBack queued');
  }
}

// Export default object for more intuitive imports
export default {
  navigate,
  reset,
  goBack,
  navigationRef,
  processQueuedActions
}; 