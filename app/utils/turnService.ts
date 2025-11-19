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
    const { data } = await apiClient.get(BACKEND_ENDPOINT);
    const payload = data && typeof data === 'object' ? data : { iceServers: data };
    const backendServers = sanitizeIceServers(payload.iceServers || payload);

    if (backendServers.length > 0) {
      return backendServers;
    }

    console.warn('⚠️ Backend TURN endpoint responded without valid ICE servers');
  } catch (error) {
    console.warn('⚠️ Failed to fetch TURN credentials from backend:', error);
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
  const merged: IceServer[] = [...fallback];

  primary.forEach((server) => {
    const exists = merged.some(
      (candidate) =>
        JSON.stringify(candidate.urls) === JSON.stringify(server.urls) &&
        candidate.username === server.username &&
        candidate.credential === server.credential
    );

    if (!exists) {
      merged.push(server);
    }
  });

  return merged;
};

export const getMeteredIceServers = async (
  fallbackServers: IceServer[] = FALLBACK_ICE_SERVERS
): Promise<IceServer[]> => {
  const apiKey = METERED_TURN_API_KEY?.trim();
  const baseUrl = (METERED_TURN_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');

  // Attempt to use cached values first
  const cached = await readCachedServers();
  if (cached && cached.length > 0) {
    return mergeIceServers(fallbackServers, cached);
  }

  // Backend route already includes auth and hides the master API key
  const backendServers = await fetchIceServersFromBackend();
  if (backendServers && backendServers.length > 0) {
    await storeCachedServers(backendServers);
    return mergeIceServers(fallbackServers, backendServers);
  }

  if (!apiKey) {
    console.warn(
      '⚠️ No Metered TURN API key configured locally. Using fallback ICE servers only.'
    );
    return fallbackServers;
  }

  const requestUrl = `${baseUrl}/api/v1/turn/credentials?apiKey=${encodeURIComponent(apiKey)}`;

  try {
    const response = await fetch(requestUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const remoteServers = sanitizeIceServers(await response.json());

    if (remoteServers.length === 0) {
      console.warn('⚠️ Metered TURN response did not contain ICE servers. Using fallback.');
      return fallbackServers;
    }

    await storeCachedServers(remoteServers);
    return mergeIceServers(fallbackServers, remoteServers);
  } catch (error) {
    console.error('❌ Failed to fetch Metered TURN credentials directly from Metered:', error);
    return fallbackServers;
  }
};

/**
 * Clear the cached TURN ICE servers
 * Call this to force a fresh fetch on the next call
 */
export const clearIceServerCache = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(CACHE_STORAGE_KEY);
    console.log('✅ Cleared cached TURN ICE servers');
  } catch (error) {
    console.error('❌ Failed to clear ICE server cache:', error);
  }
};

export default {
  getMeteredIceServers,
  clearIceServerCache
};

