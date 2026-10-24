import { ApiConfigError, resolveApiUrl } from '../src/api/config';

const dev = { isDev: true, platform: 'android', hostUri: undefined, envUrl: undefined };
const release = { ...dev, isDev: false };

describe('resolveApiUrl', () => {
  test('uses EXPO_PUBLIC_API_URL when set, without trailing slashes', () => {
    expect(resolveApiUrl({ ...dev, envUrl: ' https://api.pawpal.example/ ' })).toBe('https://api.pawpal.example');
    expect(resolveApiUrl({ ...release, envUrl: 'https://api.pawpal.example//' })).toBe('https://api.pawpal.example');
  });

  test('development falls back to port 4000 on the computer serving the bundle', () => {
    expect(resolveApiUrl({ ...dev, platform: 'web', hostUri: '192.168.1.5:8081' })).toBe('http://localhost:4000');
    expect(resolveApiUrl({ ...dev, hostUri: '192.168.1.5:8081' })).toBe('http://192.168.1.5:4000');
    expect(resolveApiUrl({ ...dev, platform: 'ios', hostUri: 'exp://10.0.0.7:8082/--/path' })).toBe('http://10.0.0.7:4000');
    expect(resolveApiUrl(dev)).toBe('http://localhost:4000');
  });

  test('development may use plain HTTP', () => {
    expect(resolveApiUrl({ ...dev, envUrl: 'http://10.0.2.2:4000' })).toBe('http://10.0.2.2:4000');
  });

  test('release builds fail loudly without the URL', () => {
    expect(() => resolveApiUrl(release)).toThrow(ApiConfigError);
    expect(() => resolveApiUrl({ ...release, envUrl: '   ' })).toThrow(/EXPO_PUBLIC_API_URL is not set/);
  });

  test('release builds need HTTPS', () => {
    expect(() => resolveApiUrl({ ...release, envUrl: 'http://api.pawpal.example' })).toThrow(/HTTPS/);
  });

  test('rejects something that isn’t a URL', () => {
    expect(() => resolveApiUrl({ ...dev, envUrl: 'api.pawpal.example' })).toThrow(ApiConfigError);
  });
});
