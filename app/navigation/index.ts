import React, { createContext, useContext } from 'react';

// Define the auth context type
export type AuthContextType = {
  isSignedIn: boolean;
  signIn: () => void;
  signOut: () => void;
  user?: {
    _id?: string;
    name?: string;
    email?: string;
    profilePic?: string;
  };
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
  user: undefined
});

// Create a custom hook to use the auth context
export const useAuth = () => useContext(AuthContext);

// Export the AppNavigator
export { default } from './AppNavigator';