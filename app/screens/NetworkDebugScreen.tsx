import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator,
  Platform
} from 'react-native';
import NetworkTester from '../components/NetworkTester';
import { API_URL, BASE_URL, DIRECT_IP, BACKUP_IPS } from '../utils/config';
import axios from 'axios';
import NetInfo from '@react-native-community/netinfo';

const NetworkDebugScreen = () => {
  const [isTestingServer, setIsTestingServer] = useState(false);
  const [serverStatus, setServerStatus] = useState<'unknown' | 'online' | 'offline'>('unknown');
  const [serverStatusDetails, setServerStatusDetails] = useState<string>('');
  const [networkInfo, setNetworkInfo] = useState<any>(null);

  useEffect(() => {
    // Get network info when component mounts
    fetchNetworkInfo();
  }, []);

  const fetchNetworkInfo = async () => {
    try {
      const info = await NetInfo.fetch();
      setNetworkInfo(info);
    } catch (error) {
      console.error('Error fetching network info:', error);
    }
  };

  const testServer = async () => {
    setIsTestingServer(true);
    setServerStatus('unknown');
    setServerStatusDetails('Testing server connection...');

    try {
      // First try the configured BASE_URL
      const response = await axios.get(`${BASE_URL}/healthcheck`, { timeout: 5000 });
      setServerStatus('online');
      setServerStatusDetails(`Server is online! Status: ${response.status}`);
      return;
    } catch (error: any) {
      console.log('Error testing primary endpoint:', error.message);
      setServerStatusDetails('Primary endpoint failed, trying alternatives...');
    }

    // Try direct IP approach as fallback
    try {
      const directUrl = `http://${DIRECT_IP}:5000/healthcheck`;
      const response = await axios.get(directUrl, { timeout: 5000 });
      setServerStatus('online');
      setServerStatusDetails(`Server is online via direct IP! Status: ${response.status}`);
      return;
    } catch (error) {
      console.log('Error testing direct IP endpoint:', error);
      setServerStatusDetails('Direct IP connection failed, trying more options...');
    }

    // If all else fails, set server as offline
    setServerStatus('offline');
    setServerStatusDetails('Could not connect to server. Check IP address and make sure server is running.');
    setIsTestingServer(false);
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Network Debugging</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Environment Configuration</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Platform:</Text>
          <Text style={styles.infoValue}>{Platform.OS}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>API URL:</Text>
          <Text style={styles.infoValue}>{API_URL}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Base URL:</Text>
          <Text style={styles.infoValue}>{BASE_URL}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Direct IP:</Text>
          <Text style={styles.infoValue}>{DIRECT_IP}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Dev Mode:</Text>
          <Text style={styles.infoValue}>{__DEV__ ? 'Yes' : 'No'}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Network Status</Text>
        {networkInfo ? (
          <>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Connected:</Text>
              <Text style={[
                styles.infoValue, 
                { color: networkInfo.isConnected ? 'green' : 'red' }
              ]}>
                {networkInfo.isConnected ? 'Yes' : 'No'}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Type:</Text>
              <Text style={styles.infoValue}>{networkInfo.type}</Text>
            </View>
            {networkInfo.type === 'wifi' && networkInfo.details && (
              <>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>WiFi SSID:</Text>
                  <Text style={styles.infoValue}>{networkInfo.details.ssid || 'Unknown'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>IP Address:</Text>
                  <Text style={styles.infoValue}>{networkInfo.details.ipAddress || 'Unknown'}</Text>
                </View>
              </>
            )}
            <TouchableOpacity 
              style={styles.button} 
              onPress={fetchNetworkInfo}
            >
              <Text style={styles.buttonText}>Refresh Network Info</Text>
            </TouchableOpacity>
          </>
        ) : (
          <ActivityIndicator size="small" color="#0000ff" />
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Server Connection</Text>
        <View style={styles.serverStatus}>
          {serverStatus === 'unknown' ? (
            <Text style={styles.serverStatusUnknown}>Status: Not tested</Text>
          ) : serverStatus === 'online' ? (
            <Text style={styles.serverStatusOnline}>Server Online ✓</Text>
          ) : (
            <Text style={styles.serverStatusOffline}>Server Offline ✗</Text>
          )}
          <Text style={styles.serverStatusDetails}>{serverStatusDetails}</Text>
        </View>
        <TouchableOpacity 
          style={styles.button} 
          onPress={testServer}
          disabled={isTestingServer}
        >
          <Text style={styles.buttonText}>
            {isTestingServer ? 'Testing...' : 'Test Server Connection'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Backup IPs</Text>
        <ScrollView style={styles.backupIpList}>
          {BACKUP_IPS.map((ip, index) => (
            <Text key={index} style={styles.backupIp}>• {ip}</Text>
          ))}
        </ScrollView>
      </View>

      <View style={styles.fullWidthSection}>
        <Text style={styles.sectionTitle}>Advanced Network Test</Text>
        <NetworkTester />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  fullWidthSection: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
    height: 400,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  infoLabel: {
    width: 100,
    fontWeight: '600',
    color: '#555',
  },
  infoValue: {
    flex: 1,
    color: '#333',
  },
  button: {
    backgroundColor: '#4a86e8',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  serverStatus: {
    alignItems: 'center',
    marginBottom: 12,
  },
  serverStatusUnknown: {
    fontSize: 16,
    color: '#888',
    marginBottom: 4,
  },
  serverStatusOnline: {
    fontSize: 16,
    color: 'green',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  serverStatusOffline: {
    fontSize: 16,
    color: 'red',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  serverStatusDetails: {
    textAlign: 'center',
    color: '#666',
  },
  backupIpList: {
    maxHeight: 120,
  },
  backupIp: {
    marginBottom: 4,
    color: '#555',
  },
});

export default NetworkDebugScreen; 