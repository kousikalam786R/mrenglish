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
import { Provider } from 'react-redux';
import { store } from './app/redux/store'; // Adjust this import path if needed

function App(): React.JSX.Element {
  return (
    <GestureHandlerRootView style={styles.container}>
      <Provider store={store}>
        <SafeAreaProvider initialMetrics={initialWindowMetrics}>
          <SocketProvider>
            <AppNavigator />
          </SocketProvider>
        </SafeAreaProvider>
      </Provider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default App;
