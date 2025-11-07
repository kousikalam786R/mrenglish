import { Platform } from 'react-native';
import apiClient from './apiClient';

export interface ImageKitAuthResponse {
  success: boolean;
  token: string;
  signature: string;
  expire: number;
  publicKey: string;
  urlEndpoint: string;
  folder?: string;
}

export interface UploadImageParams {
  uri: string;
  type?: string | null;
  name?: string | null;
}

export interface UploadImageOptions {
  folder?: string;
  tags?: string[];
  useUniqueFileName?: boolean;
}

export interface ImageKitUploadResult {
  fileId: string;
  url: string;
  thumbnailUrl?: string;
  name?: string;
  height?: number;
  width?: number;
}

const IMAGEKIT_UPLOAD_ENDPOINT = 'https://upload.imagekit.io/api/v1/files/upload';

export const fetchImageKitAuth = async (): Promise<ImageKitAuthResponse> => {
  const response = await apiClient.get('/profile/imagekit/auth');

  if (!response.data?.success) {
    throw new Error(
      response.data?.message || 'Failed to obtain ImageKit authentication parameters.'
    );
  }

  return response.data;
};

const normalizeFileName = (name?: string | null) => {
  if (name && name.trim().length > 0) {
    return name.trim();
  }

  return `profile-${Date.now()}.jpg`;
};

const normalizeMimeType = (type?: string | null) => {
  if (type && type.trim().length > 0) {
    return type;
  }

  return 'image/jpeg';
};

const normalizeUri = (uri: string) => {
  if (Platform.OS === 'ios' && uri.startsWith('file://')) {
    return uri;
  }

  return uri;
};

export const uploadImageToImageKit = async (
  file: UploadImageParams,
  options?: UploadImageOptions
): Promise<ImageKitUploadResult> => {
  if (!file?.uri) {
    throw new Error('A valid image URI is required to upload.');
  }

  const auth = await fetchImageKitAuth();
  const fileName = normalizeFileName(file.name);
  const mimeType = normalizeMimeType(file.type);
  const folder = options?.folder ?? auth.folder;

  const formData = new FormData();

  formData.append('file', {
    uri: normalizeUri(file.uri),
    type: mimeType,
    name: fileName,
  } as any);

  formData.append('fileName', fileName);
  formData.append('publicKey', auth.publicKey);
  formData.append('token', auth.token);
  formData.append('signature', auth.signature);
  formData.append('expire', String(auth.expire));
  formData.append(
    'useUniqueFileName',
    options?.useUniqueFileName === false ? 'false' : 'true'
  );

  if (folder) {
    formData.append('folder', folder);
  }

  if (options?.tags?.length) {
    formData.append('tags', options.tags.join(','));
  }

  const response = await fetch(IMAGEKIT_UPLOAD_ENDPOINT, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `ImageKit upload failed with status ${response.status}: ${errorText}`
    );
  }

  const data = await response.json();

  return {
    fileId: data.fileId,
    url: data.url,
    thumbnailUrl: data.thumbnailUrl,
    name: data.name,
    height: data.height,
    width: data.width,
  };
};

