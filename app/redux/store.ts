import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import userReducer from './slices/userSlice';
import aiReducer from './slices/aiSlice';
import callReducer from './slices/callSlice';
import messageReducer from './slices/messageSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    user: userReducer,
    ai: aiReducer,
    call: callReducer,
    message: messageReducer,
  },
  middleware: (getDefaultMiddleware) => 
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;