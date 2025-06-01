import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import testApiConnection from '../utils/apiTester';

interface LogEntry {
  text: string;
  type: 'info' | 'success' | 'error' | 'header';
}

const NetworkTester = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Custom logger to capture logs
  const captureLog = (text: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [...prev, { text, type }]);
  };

  // Override console methods to capture logs
  const setupLogCapture = () => {
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;

    console.log = (...args: any[]) => {
      const text = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');
      
      if (text.includes('SUCCESS') || text.includes('✅')) {
        captureLog(text, 'success');
      } else if (text.includes('FAILED') || text.includes('❌')) {
        captureLog(text, 'error');
      } else if (text.includes('===') || text.startsWith('🧪') || text.startsWith('🔍') || text.match(/^[0-9]️⃣/)) {
        captureLog(text, 'header');
      } else {
        captureLog(text, 'info');
      }
      
      originalConsoleLog.apply(console, args);
    };

    console.error = (...args: any[]) => {
      const text = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');
      captureLog(text, 'error');
      originalConsoleError.apply(console, args);
    };

    // Return a function to restore original console methods
    return () => {
      console.log = originalConsoleLog;
      console.error = originalConsoleError;
    };
  };

  const runNetworkTest = async () => {
    setLogs([]);
    setIsLoading(true);
    
    const restoreConsole = setupLogCapture();
    
    try {
      await testApiConnection();
    } catch (error) {
      console.error('Test failed with uncaught error:', error);
    } finally {
      restoreConsole();
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Network Connectivity Tester</Text>
      
      <TouchableOpacity 
        style={[styles.button, isLoading && styles.buttonDisabled]}
        onPress={runNetworkTest}
        disabled={isLoading}
      >
        <Text style={styles.buttonText}>
          {isLoading ? 'Running Tests...' : 'Run Network Test'}
        </Text>
      </TouchableOpacity>
      
      <ScrollView style={styles.logContainer}>
        {logs.map((log, index) => (
          <Text 
            key={index} 
            style={[
              styles.logText, 
              log.type === 'success' && styles.successText,
              log.type === 'error' && styles.errorText,
              log.type === 'header' && styles.headerText
            ]}
          >
            {log.text}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#4a86e8',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonDisabled: {
    backgroundColor: '#a9c4f5',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  logContainer: {
    flex: 1,
    backgroundColor: '#252526',
    borderRadius: 8,
    padding: 12,
  },
  logText: {
    color: '#f8f8f8',
    fontFamily: 'monospace',
    fontSize: 12,
    marginBottom: 4,
  },
  successText: {
    color: '#8cd28c',
  },
  errorText: {
    color: '#ff7575',
  },
  headerText: {
    color: '#ffcb6b',
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 4,
  },
});

export default NetworkTester; 