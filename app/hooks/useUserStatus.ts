import { useState, useEffect, useRef, useCallback } from 'react';
import simpleUserStatusService, { UserStatus } from '../services/simpleUserStatusService';

/**
 * Hook to manage user status for a specific user
 */
export const useUserStatus = (userId: string) => {
  const [status, setStatus] = useState<UserStatus | undefined>(undefined);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Memoize the callback to prevent infinite re-renders
  const handleStatusUpdate = useCallback((allStatuses: Map<string, UserStatus>) => {
    const userStatus = allStatuses.get(userId);
    if (userStatus) {
      console.log(`🔄 useUserStatus: Status updated for ${userId}:`, {
        isOnline: userStatus.isOnline,
        lastSeenAt: userStatus.lastSeenAt,
        isTyping: userStatus.isTyping
      });
      setStatus(userStatus);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    // Add user to tracking if not already tracked
    simpleUserStatusService.addUserToTracking(userId);

    // Get initial status
    const initialStatus = simpleUserStatusService.getUserStatus(userId);
    setStatus(initialStatus);

    // Subscribe to status updates
    const unsubscribe = simpleUserStatusService.subscribeToStatusUpdates(handleStatusUpdate);

    unsubscribeRef.current = unsubscribe;

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [userId, handleStatusUpdate]);

  return status;
};

/**
 * Hook to manage multiple user statuses
 */
export const useMultipleUserStatuses = (userIds: string[]) => {
  const [statuses, setStatuses] = useState<Map<string, UserStatus>>(new Map());
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Memoize the callback to prevent infinite re-renders
  const handleStatusUpdate = useCallback((allStatuses: Map<string, UserStatus>) => {
    const updatedStatuses = new Map<string, UserStatus>();
    userIds.forEach(userId => {
      const status = allStatuses.get(userId);
      if (status) {
        updatedStatuses.set(userId, status);
      }
    });
    setStatuses(updatedStatuses);
  }, [userIds]);

  useEffect(() => {
    if (!userIds.length) return;

    // Add all users to tracking
    userIds.forEach(userId => {
      simpleUserStatusService.addUserToTracking(userId);
    });

    // Get initial statuses
    const initialStatuses = new Map<string, UserStatus>();
    userIds.forEach(userId => {
      const status = simpleUserStatusService.getUserStatus(userId);
      if (status) {
        initialStatuses.set(userId, status);
      }
    });
    setStatuses(initialStatuses);

    // Subscribe to all status updates
    const unsubscribe = simpleUserStatusService.subscribeToStatusUpdates(handleStatusUpdate);

    unsubscribeRef.current = unsubscribe;

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [userIds, handleStatusUpdate]);

  return statuses;
};

/**
 * Hook to get all user statuses
 */
export const useAllUserStatuses = () => {
  const [statuses, setStatuses] = useState<Map<string, UserStatus>>(new Map());
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Memoize the callback to prevent infinite re-renders
  const handleStatusUpdate = useCallback((allStatuses: Map<string, UserStatus>) => {
    setStatuses(new Map(allStatuses));
  }, []);

  useEffect(() => {
    // Get initial statuses
    const initialStatuses = simpleUserStatusService.getAllUserStatuses();
    setStatuses(initialStatuses);

    // Subscribe to all status updates
    const unsubscribe = simpleUserStatusService.subscribeToStatusUpdates(handleStatusUpdate);

    unsubscribeRef.current = unsubscribe;

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [handleStatusUpdate]);

  return statuses;
};

/**
 * Hook to initialize the user status service
 */
export const useUserStatusService = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initialize = async () => {
      try {
        await simpleUserStatusService.initialize();
        setIsInitialized(true);
        setError(null);
      } catch (err) {
        console.error('Failed to initialize user status service:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setIsInitialized(false);
      }
    };

    initialize();

    return () => {
      simpleUserStatusService.destroy();
    };
  }, []);

  return { isInitialized, error };
};
