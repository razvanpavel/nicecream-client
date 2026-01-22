import axios, { type InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://api.nicecream.fm';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig): Promise<InternalAxiosRequestConfig> => {
    // SecureStore is only available on native platforms
    if (Platform.OS !== 'web') {
      const token = await SecureStore.getItemAsync('authToken');
      if (token !== null) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  }
);
