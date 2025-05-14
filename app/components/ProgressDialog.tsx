import React from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';

interface ProgressDialogProps {
  visible: boolean;
  title?: string;
  message?: string;
  onCancel?: () => void;
  cancelable?: boolean;
}

/**
 * A progress dialog component that shows loading state with a message
 */
const ProgressDialog: React.FC<ProgressDialogProps> = ({
  visible,
  title = 'Please wait',
  message = 'Loading...',
  onCancel,
  cancelable = false,
}) => {
  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={cancelable ? onCancel : undefined}
    >
      <View style={styles.container}>
        <View style={styles.dialogContainer}>
          {title && <Text style={styles.title}>{title}</Text>}
          
          <View style={styles.contentContainer}>
            <ActivityIndicator size="large" color="#4A90E2" />
            {message && <Text style={styles.message}>{message}</Text>}
          </View>
          
          {cancelable && onCancel && (
            <TouchableOpacity 
              style={styles.cancelButton} 
              onPress={onCancel}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  dialogContainer: {
    width: '80%',
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
  },
  message: {
    fontSize: 16,
    color: '#666',
    marginLeft: 15,
    flex: 1,
  },
  cancelButton: {
    marginTop: 15,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 5,
    backgroundColor: '#f0f0f0',
  },
  cancelText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default ProgressDialog; 