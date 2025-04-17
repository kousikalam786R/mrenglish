import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity,
  TextInputProps
} from 'react-native';

interface CustomInputProps extends TextInputProps {
  icon?: string;
  iconSize?: number;
  iconColor?: string;
  isPassword?: boolean;
  showPassword?: boolean;
  toggleShowPassword?: () => void;
  label?: string;
}

const CustomInput: React.FC<CustomInputProps> = ({
  icon,
  iconSize = 20,
  iconColor = '#999',
  isPassword = false,
  showPassword = false,
  toggleShowPassword,
  label,
  ...props
}) => {
  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.inputContainer}>
        {icon && (
          <Text style={[styles.iconPlaceholder, {color: iconColor}]}>
            {icon.includes('mail') ? 'M' : 
             icon.includes('lock') ? 'L' : 
             icon.includes('person') ? 'P' : '#'}
          </Text>
        )}
        <TextInput
          style={styles.input}
          placeholderTextColor="#999"
          secureTextEntry={isPassword && !showPassword}
          {...props}
        />
        {isPassword && (
          <TouchableOpacity onPress={toggleShowPassword}>
            <Text style={{color: iconColor, fontWeight: 'bold'}}>
              {showPassword ? 'HIDE' : 'SHOW'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: '#333',
    marginBottom: 6,
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  iconPlaceholder: {
    marginRight: 8,
    width: 20,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: '#333',
  },
});

export default CustomInput; 