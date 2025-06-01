import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import axios, { AxiosError } from 'axios';
import { BASE_URL, API_URL, getAlternateUrls, BACKUP_IPS, DIRECT_IP } from './config';

/**
 * Utility to test API connectivity and diagnose connection issues
 */
export const testApiConnection = async () => {
  try {
    console.log('\n🧪 API CONNECTION TEST STARTED');
    console.log('===========================');
    
    // 1. Check device network status
    console.log('1️⃣ Checking network status...');
    const netInfo = await NetInfo.fetch();
    console.log(`   Connected: ${netInfo.isConnected ? '✅' : '❌'}`);
    console.log(`   Connection type: ${netInfo.type}`);
    
    if (!netInfo.isConnected) {
      console.log('❌ FAILED: Device is not connected to the internet');
      return false;
    }
    
    // 2. Determine API endpoint based on platform
    const platform = Platform.OS;
    console.log(`2️⃣ Device platform: ${platform}`);
    console.log(`   Configured API URL: ${API_URL}`);
    console.log(`   Configured BASE URL: ${BASE_URL}`);
    console.log(`   Direct IP: ${DIRECT_IP}`);
    
    // 3. Test the main configured endpoint
    console.log('3️⃣ Testing primary configured endpoint:');
    let mainEndpointWorks = false;
    
    try {
      console.log(`   Testing ${BASE_URL}/healthcheck`);
      const response = await axios.get(`${BASE_URL}/healthcheck`, { timeout: 5000 });
      console.log(`   ✅ SUCCESS: Primary endpoint responded with status ${response.status}`);
      console.log(`      Response: ${JSON.stringify(response.data)}`);
      mainEndpointWorks = true;
    } catch (error: any) {
      console.log(`   ❌ FAILED: Primary endpoint test failed`);
      console.log(`      Error: ${error.message}`);
    }
    
    // 4. If main endpoint failed, try alternate endpoints
    if (!mainEndpointWorks) {
      console.log('4️⃣ Testing alternate endpoints:');
      const alternateUrls = getAlternateUrls();
      
      for (let i = 0; i < Math.min(alternateUrls.length, 4); i++) {
        const url = alternateUrls[i];
        try {
          console.log(`   Testing ${url}/healthcheck`);
          const response = await axios.get(`${url}/healthcheck`, { timeout: 5000 });
          console.log(`   ✅ SUCCESS: ${url} responded with status ${response.status}`);
          console.log(`      Response: ${JSON.stringify(response.data)}`);
          mainEndpointWorks = true;
          break; // Stop after first success
        } catch (error: any) {
          console.log(`   ❌ FAILED: ${url}`);
          console.log(`      Error: ${error.message}`);
        }
      }
    } else {
      console.log('4️⃣ Skipping alternate endpoints as primary endpoint works');
    }
    
    // 5. If all else fails, try direct IP address combinations
    if (!mainEndpointWorks) {
      console.log('5️⃣ Testing direct IP connections:');
      
      // Try all backup IPs
      for (const ip of BACKUP_IPS) {
        try {
          const url = `http://${ip}:5000/healthcheck`;
          console.log(`   Testing ${url}`);
          const response = await axios.get(url, { timeout: 5000 });
          console.log(`   ✅ SUCCESS: ${url} responded with status ${response.status}`);
          console.log(`      Response: ${JSON.stringify(response.data)}`);
          mainEndpointWorks = true;
          break;
        } catch (error: any) {
          console.log(`   ❌ FAILED: ${ip}`);
          console.log(`      Error: ${error.message}`);
        }
      }
    } else {
      console.log('5️⃣ Skipping direct IP tests as earlier tests succeeded');
    }
    
    // 6. Final test with fetch API
    console.log('6️⃣ Testing with fetch API:');
    try {
      const response = await fetch(`${BASE_URL}/healthcheck`);
      const text = await response.text();
      console.log(`   ✅ Fetch API Success: Status ${response.status}`);
      console.log(`      Response: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`);
    } catch (error: any) {
      console.log(`   ❌ Fetch API Failed: ${error.message}`);
    }
    
    // Final diagnosis
    console.log('\n🔍 DIAGNOSIS:');
    if (mainEndpointWorks) {
      console.log('✅ Server is reachable');
      return true;
    } else {
      console.log('❌ Could not connect to the server. Possible issues:');
      console.log('   1. Server is not running');
      console.log('   2. Server is running on a different port');
      console.log('   3. Firewall is blocking the connection');
      console.log('   4. Incorrect IP address configuration');
      
      console.log('\n💡 SUGGESTIONS:');
      console.log(`   1. Make sure your server is running on port 5000`);
      console.log(`   2. Check your LOCAL_IP setting in config.ts (currently ${DIRECT_IP})`);
      console.log(`   3. Try these commands on your server to find the correct IP:`);
      console.log(`      • Windows: ipconfig`);
      console.log(`      • Mac/Linux: ifconfig or ip addr`);
      console.log(`   4. Make sure your phone and computer are on the same WiFi network`);
      console.log(`   5. Check if your server has a firewall blocking connections`);
      return false;
    }
  } catch (error: any) {
    console.error('Error in API connection test:', error);
    return false;
  }
};

export default testApiConnection; 