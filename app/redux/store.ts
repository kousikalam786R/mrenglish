import { configureStore } from '@reduxjs/toolkit';
import userReducer from './slices/userSlice';
import authReducer from './slices/authSlice';
import messageReducer from './slices/messageSlice';
import callReducer from './slices/callSlice';

export const store = configureStore({
  reducer: {
    user: userReducer,
    auth: authReducer,
    message: messageReducer,
    call: callReducer,
  },
  middleware: (getDefaultMiddleware) => 
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;