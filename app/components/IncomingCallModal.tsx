import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  Vibration,
  Dimensions,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../redux/store';
import { CallStatus } from '../utils/callService';
import { acceptIncomingCall, rejectIncomingCall } from '../redux/thunks/callThunks';
import Icon from 'react-native-vector-icons/Ionicons';

const { width } = Dimensions.get('window');

interface IncomingCallModalProps {
  visible: boolean;
}

const IncomingCallModal: React.FC<IncomingCallModalProps> = ({ visible }) => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const dispatch = useDispatch<AppDispatch>();
  
  // Get call state from Redux
  const callState = useSelector((state: RootState) => state.call.activeCall);
  
  // Start vibration pattern when modal is visible
  React.useEffect(() => {
    let vibrateInterval: NodeJS.Timeout | null = null;
    
    if (visible && callState.status === CallStatus.RINGING) {
      // Create repeating vibration pattern
      vibrateInterval = setInterval(() => {
        Vibration.vibrate(500);
      }, 2000);
    }
    
    return () => {
      if (vibrateInterval) {
        clearInterval(vibrateInterval);
      }
      Vibration.cancel();
    };
  }, [visible, callState.status]);
  
  // Handle accepting a call
  const handleAcceptCall = () => {
    void dispatch(acceptIncomingCall({ audio: true, video: callState.isVideoEnabled }));
    
    // Navigate to call screen
    navigation.navigate('Call', {
      id: callState.remoteUserId,
      name: callState.remoteUserName,
      isVideoCall: callState.isVideoEnabled,
    });
  };
  
  // Handle rejecting a call
  const handleRejectCall = () => {
    void dispatch(rejectIncomingCall());
  };
  
  // If modal is not visible or not in ringing state, return null
  if (!visible || callState.status !== CallStatus.RINGING) {
    return null;
  }
  
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleRejectCall}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.callerInfo}>
            <Image 
              source={{ 
                uri: `https://randomuser.me/api/portraits/${callState.isVideoEnabled ? 'men' : 'women'}/32.jpg` 
              }}
              style={styles.callerImage} 
            />
            <Text style={styles.callerName}>{callState.remoteUserName}</Text>
            <Text style={styles.callType}>
              {callState.isVideoEnabled ? 'Video Call' : 'Voice Call'}
            </Text>
          </View>
          
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={[styles.actionButton, styles.rejectButton]}
              onPress={handleRejectCall}
            >
              <Icon name="call-outline" size={32} color="white" style={styles.rejectIcon} />
              <Text style={styles.actionText}>Decline</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.actionButton, styles.acceptButton]}
              onPress={handleAcceptCall}
            >
              <Icon name="call-outline" size={32} color="white" />
              <Text style={styles.actionText}>Accept</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  modalContent: {
    width: width * 0.9,
    backgroundColor: '#333',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  callerInfo: {
    alignItems: 'center',
    marginBottom: 30,
  },
  callerImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 15,
    borderWidth: 3,
    borderColor: '#4A90E2',
  },
  callerName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 5,
  },
  callType: {
    fontSize: 16,
    color: '#bbb',
    marginBottom: 10,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 70,
    height: 70,
    borderRadius: 35,
    marginHorizontal: 20,
  },
  rejectButton: {
    backgroundColor: '#E53935',
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
  },
  rejectIcon: {
    transform: [{ rotate: '135deg' }],
  },
  actionText: {
    color: 'white',
    marginTop: 5,
    fontSize: 14,
  },
});

export default IncomingCallModal; 