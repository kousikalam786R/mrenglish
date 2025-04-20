/**
 * Mr English App
 */

import React from 'react';
import {
  SafeAreaProvider, 
  initialWindowMetrics
} from 'react-native-safe-area-context';

import 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AppNavigator from './app/navigation/AppNavigator';
import { StyleSheet } from 'react-native';
import SocketProvider from './app/utils/SocketProvider';

function App(): React.JSX.Element {
  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <SocketProvider>
          <AppNavigator />
        </SocketProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default App;
