import React, { createContext, useContext } from 'react';

// Define the auth context type
export type AuthContextType = {
  isSignedIn: boolean;
  signIn: () => void;
  signOut: () => void;
};

// Create the auth context with default values
export const AuthContext = createContext<AuthContextType>({
  isSignedIn: false,
  signIn: () => {
    console.warn('AuthContext.signIn() was called without a provider');
  },
  signOut: () => {
    console.warn('AuthContext.signOut() was called without a provider');
  },
});

// Create a custom hook to use the auth context
export const useAuth = () => useContext(AuthContext);

// Export the AppNavigator
export { default } from './AppNavigator'; 