import type { TokenCache } from '@clerk/clerk-expo';
import * as SecureStore from 'expo-secure-store';

export const tokenCache: TokenCache = {
  async getToken(key: string) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.warn('SecureStore getItemAsync error: ', error);
      return null;
    }
  },
  async saveToken(key: string, token: string) {
    try {
      await SecureStore.setItemAsync(key, token);
    } catch (error) {
      console.warn('SecureStore setItemAsync error: ', error);
    }
  },
  clearToken(key: string) {
    SecureStore.deleteItemAsync(key).catch(error => {
      console.warn('SecureStore deleteItemAsync error: ', error);
    });
  },
};

