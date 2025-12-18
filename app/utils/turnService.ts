import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from './apiClient';
import { METERED_TURN_API_KEY, METERED_TURN_BASE_URL } from './config';

type IceServer = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

type CachedIceServers = {
  expiresAt: number;
  servers: IceServer[];
};

const CACHE_STORAGE_KEY = 'metered_turn_ice_servers_v1';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_BASE_URL = 'https://mr_english.metered.live';
const BACKEND_ENDPOINT = '/webrtc/ice-config';
const FETCH_TIMEOUT_MS = 2000; // 2 seconds timeout for TURN fetch
const BACKEND_FETCH_TIMEOUT_MS = 1500; // 1.5 seconds for backend fetch
const MAX_BLOCK_TIME_MS = 2000; // Maximum time to block waiting for TURN servers

const FALLBACK_ICE_SERVERS: IceServer[] = [
  {
    urls: [
      'stun:stun.l.google.com:19302',
      'stun:stun1.l.google.com:19302',
      'stun:stun2.l.google.com:19302',
      'stun:stun3.l.google.com:19302',
      'stun:stun4.l.google.com:19302'
    ]
  }
];

const isValidIceServer = (value: any): value is IceServer =>
  Boolean(
    value &&
      (typeof value.urls === 'string' ||
        (Array.isArray(value.urls) && value.urls.every((url: unknown) => typeof url === 'string')))
  );

const sanitizeIceServers = (servers: any): IceServer[] => {
  if (!Array.isArray(servers)) {
    return [];
  }

  return servers.filter(isValidIceServer);
};

const fetchIceServersFromBackend = async (): Promise<IceServer[] | null> => {
  try {
    // Create a timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Backend fetch timeout')), BACKEND_FETCH_TIMEOUT_MS);
    });

    // Race between the API call and timeout
    const { data } = await Promise.race([
      apiClient.get(BACKEND_ENDPOINT),
      timeoutPromise
    ]) as { data: any };

    const payload = data && typeof data === 'object' ? data : { iceServers: data };
    const backendServers = sanitizeIceServers(payload.iceServers || payload);

    if (backendServers.length > 0) {
      return backendServers;
    }

    console.warn('⚠️ Backend TURN endpoint responded without valid ICE servers');
  } catch (error: any) {
    if (error.message !== 'Backend fetch timeout') {
      console.warn('⚠️ Failed to fetch TURN credentials from backend:', error.message || error);
    }
  }

  return null;
};

const readCachedServers = async (): Promise<IceServer[] | null> => {
  try {
    const cachedRaw = await AsyncStorage.getItem(CACHE_STORAGE_KEY);
    if (!cachedRaw) {
      return null;
    }

    const cached: CachedIceServers = JSON.parse(cachedRaw);
    if (!cached || typeof cached.expiresAt !== 'number' || !Array.isArray(cached.servers)) {
      return null;
    }

    if (cached.expiresAt > Date.now()) {
      return sanitizeIceServers(cached.servers);
    }
  } catch (error) {
    console.warn('⚠️ Failed to read cached TURN credentials:', error);
  }

  return null;
};

const storeCachedServers = async (servers: IceServer[]): Promise<void> => {
  try {
    const payload: CachedIceServers = {
      expiresAt: Date.now() + CACHE_TTL_MS,
      servers
    };
    await AsyncStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('⚠️ Failed to cache TURN credentials:', error);
  }
};

const mergeIceServers = (fallback: IceServer[], primary: IceServer[]): IceServer[] => {
  // Prioritize TURN servers (primary) over STUN fallback servers
  // TURN servers should come first so they're tried first
  const merged: IceServer[] = [...primary]; // TURN servers first

  // Add fallback STUN servers only if they don't already exist
  fallback.forEach((server) => {
    const exists = merged.some(
      (candidate) =>
        JSON.stringify(candidate.urls) === JSON.stringify(server.urls) &&
        candidate.username === server.username &&
        candidate.credential === server.credential
    );

    if (!exists) {
      merged.push(server); // STUN fallback servers last
    }
  });

  return merged;
};

// Background fetch to update cache without blocking
let backgroundFetchPromise: Promise<IceServer[] | null> | null = null;

const fetchTURNInBackground = async (): Promise<IceServer[] | null> => {
  if (backgroundFetchPromise) {
    return backgroundFetchPromise;
  }

  backgroundFetchPromise = (async () => {
    try {
      // Try backend first (faster, uses our server)
      const backendServers = await fetchIceServersFromBackend();
      if (backendServers && backendServers.length > 0) {
        await storeCachedServers(backendServers);
        return backendServers;
      }

      // Fallback to direct Metered API if backend fails
      const apiKey = METERED_TURN_API_KEY?.trim();
      if (!apiKey) {
        return null;
      }

      const baseUrl = (METERED_TURN_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
      const requestUrl = `${baseUrl}/api/v1/turn/credentials?apiKey=${encodeURIComponent(apiKey)}`;

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Metered API timeout')), FETCH_TIMEOUT_MS);
      });

      const response = await Promise.race([
        fetch(requestUrl),
        timeoutPromise
      ]);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const remoteServers = sanitizeIceServers(await response.json());
      if (remoteServers.length > 0) {
        await storeCachedServers(remoteServers);
        return remoteServers;
      }
    } catch (error: any) {
      if (error.message !== 'Metered API timeout' && error.message !== 'Backend fetch timeout') {
        console.warn('⚠️ Background TURN fetch failed:', error.message || error);
      }
    } finally {
      backgroundFetchPromise = null;
    }

    return null;
  })();

  return backgroundFetchPromise;
};

export const getMeteredIceServers = async (
  fallbackServers: IceServer[] = FALLBACK_ICE_SERVERS
): Promise<IceServer[]> => {
  const startTime = Date.now();
  const blockUntil = startTime + MAX_BLOCK_TIME_MS;

  // Step 1: Check cache first (fastest)
  let cached = await readCachedServers();
  if (cached && cached.length > 0) {
    console.log(`✅ Using cached TURN servers (${Date.now() - startTime}ms)`);
    
    // Fetch fresh servers in background for next time
    fetchTURNInBackground().catch(() => {});
    
    // Merge TURN servers with fallback STUN servers (TURN first, then STUN)
    return mergeIceServers(fallbackServers, cached);
  }

  // Step 2: Try backend endpoint (blocking, with timeout)
  console.log('🔄 Fetching TURN servers from backend...');
  let backendServers: IceServer[] | null = null;
  try {
    backendServers = await fetchIceServersFromBackend();
    if (backendServers && backendServers.length > 0) {
      console.log(`✅ Got TURN servers from backend (${Date.now() - startTime}ms)`);
      await storeCachedServers(backendServers);
      
      // Merge TURN servers with fallback STUN servers (TURN first, then STUN)
      return mergeIceServers(fallbackServers, backendServers);
    }
  } catch (error: any) {
    console.warn('⚠️ Backend fetch failed:', error.message || error);
  }

  // Step 3: Try direct Metered API (if we still have time)
  const timeRemaining = blockUntil - Date.now();
  if (timeRemaining > 500) {
    const apiKey = METERED_TURN_API_KEY?.trim();
    if (apiKey) {
      console.log('🔄 Fetching TURN servers from Metered API...');
      try {
        const baseUrl = (METERED_TURN_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
        const requestUrl = `${baseUrl}/api/v1/turn/credentials?apiKey=${encodeURIComponent(apiKey)}`;

        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Metered API timeout')), Math.min(timeRemaining, FETCH_TIMEOUT_MS));
        });

        const response = await Promise.race([
          fetch(requestUrl),
          timeoutPromise
        ]) as Response;

        if (response.ok) {
          const remoteServers = sanitizeIceServers(await response.json());
          if (remoteServers.length > 0) {
            console.log(`✅ Got TURN servers from Metered API (${Date.now() - startTime}ms)`);
            await storeCachedServers(remoteServers);
            
            // Merge TURN servers with fallback STUN servers (TURN first, then STUN)
            return mergeIceServers(fallbackServers, remoteServers);
          }
        }
      } catch (error: any) {
        if (error.message !== 'Metered API timeout') {
          console.warn('⚠️ Metered API fetch failed:', error.message || error);
        }
      }
    }
  }

  // Step 4: Only return fallback STUN servers if all TURN attempts failed
  const elapsed = Date.now() - startTime;
  console.log(`⚠️ No TURN servers available after ${elapsed}ms`);
  
  // If fallback servers were provided, use them; otherwise use default STUN servers
  if (fallbackServers.length > 0) {
    console.log('⚠️ Using provided STUN fallback servers - connection may fail on WiFi→Mobile or Mobile→Mobile');
    return fallbackServers;
  } else {
    console.log('⚠️ Using default STUN fallback servers - connection may fail on WiFi→Mobile or Mobile→Mobile');
    return FALLBACK_ICE_SERVERS;
  }
};

/**
 * Pre-fetch TURN servers in the background
 * Call this when app starts or before entering call screen for faster connections
 */
export const prefetchIceServers = async (): Promise<void> => {
  // Check if we have valid cache first
  const cached = await readCachedServers();
  if (cached && cached.length > 0) {
    console.log('✅ TURN servers already cached, skipping prefetch');
    return;
  }

  console.log('🔄 Pre-fetching TURN servers in background...');
  fetchTURNInBackground()
    .then((servers) => {
      if (servers && servers.length > 0) {
        console.log('✅ TURN servers pre-fetched successfully');
      } else {
        console.log('⚠️ TURN servers pre-fetch completed but no servers received');
      }
    })
    .catch((error) => {
      console.warn('⚠️ TURN servers pre-fetch failed:', error.message || error);
    });
};

/**
 * Clear the cached TURN ICE servers
 * Call this to force a fresh fetch on the next call
 */
export const clearIceServerCache = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(CACHE_STORAGE_KEY);
    backgroundFetchPromise = null; // Reset background fetch
    console.log('✅ Cleared cached TURN ICE servers');
  } catch (error) {
    console.error('❌ Failed to clear ICE server cache:', error);
  }
};

export default {
  getMeteredIceServers,
  prefetchIceServers,
  clearIceServerCache
};

