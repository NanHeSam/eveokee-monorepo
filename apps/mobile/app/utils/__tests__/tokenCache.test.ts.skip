import * as SecureStore from 'expo-secure-store';
import { tokenCache } from '../tokenCache';

describe('tokenCache', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('reads tokens via SecureStore', async () => {
    const getSpy = jest.spyOn(SecureStore, 'getItemAsync').mockResolvedValue('token');

    await expect(tokenCache.getToken('key')).resolves.toBe('token');
    expect(getSpy).toHaveBeenCalledWith('key');
  });

  it('returns null and logs when SecureStore throws', async () => {
    const error = new Error('fail');
    jest.spyOn(SecureStore, 'getItemAsync').mockRejectedValue(error);

    await expect(tokenCache.getToken('bad')).resolves.toBeNull();
    expect(console.warn).toHaveBeenCalledWith('SecureStore getItemAsync error: ', error);
  });

  it('persists tokens via SecureStore', async () => {
    const setSpy = jest.spyOn(SecureStore, 'setItemAsync').mockResolvedValue();

    await tokenCache.saveToken('key', 'value');
    expect(setSpy).toHaveBeenCalledWith('key', 'value');
  });

  it('logs when save fails', async () => {
    const error = new Error('write');
    jest.spyOn(SecureStore, 'setItemAsync').mockRejectedValue(error);

    await tokenCache.saveToken('key', 'value');
    expect(console.warn).toHaveBeenCalledWith('SecureStore setItemAsync error: ', error);
  });

  it('clears tokens via SecureStore', async () => {
    const deleteSpy = jest.spyOn(SecureStore, 'deleteItemAsync').mockResolvedValue();

    tokenCache.clearToken('key');
    expect(deleteSpy).toHaveBeenCalledWith('key');
  });

  it('logs when clear fails', async () => {
    const error = new Error('delete');
    jest.spyOn(SecureStore, 'deleteItemAsync').mockRejectedValue(error);

    tokenCache.clearToken('key');
    await Promise.resolve();
    expect(console.warn).toHaveBeenCalledWith('SecureStore deleteItemAsync error: ', error);
  });
});
