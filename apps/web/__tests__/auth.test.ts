/**
 * Authentication Token Handling Tests
 * Tests for the token storage consistency fix
 */

import { fetchJson } from '@/lib/api';

// Mock localStorage and sessionStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};

const mockSessionStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};

Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });
Object.defineProperty(window, 'sessionStorage', { value: mockSessionStorage });

// Mock fetch
global.fetch = jest.fn();

describe('Authentication Token Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fetch as jest.MockedFunction<typeof fetch>).mockClear();
  });

  test('should use localStorage token when available', async () => {
    const mockToken = 'localStorage-token';
    mockLocalStorage.getItem.mockReturnValue(mockToken);
    mockSessionStorage.getItem.mockReturnValue(null);

    (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    } as Response);

    await fetchJson('http://test.com/api');

    expect(fetch).toHaveBeenCalledWith(
      'http://test.com/api',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': `Bearer ${mockToken}`,
        }),
      })
    );
  });

  test('should fall back to sessionStorage token when localStorage is empty', async () => {
    const mockToken = 'sessionStorage-token';
    mockLocalStorage.getItem.mockReturnValue(null);
    mockSessionStorage.getItem.mockReturnValue(mockToken);

    (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    } as Response);

    await fetchJson('http://test.com/api');

    expect(fetch).toHaveBeenCalledWith(
      'http://test.com/api',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': `Bearer ${mockToken}`,
        }),
      })
    );
  });

  test('should prefer localStorage over sessionStorage when both exist', async () => {
    const localStorageToken = 'localStorage-token';
    const sessionStorageToken = 'sessionStorage-token';
    mockLocalStorage.getItem.mockReturnValue(localStorageToken);
    mockSessionStorage.getItem.mockReturnValue(sessionStorageToken);

    (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    } as Response);

    await fetchJson('http://test.com/api');

    expect(fetch).toHaveBeenCalledWith(
      'http://test.com/api',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': `Bearer ${localStorageToken}`,
        }),
      })
    );
  });

  test('should handle 401 errors by clearing tokens and reloading', async () => {
    const mockToken = 'expired-token';
    mockLocalStorage.getItem.mockReturnValue(mockToken);
    
    // Mock window.location.reload
    Object.defineProperty(window, 'location', {
      value: { reload: jest.fn() },
      writable: true,
    });

    (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
      ok: false,
      status: 401,
    } as Response);

    await fetchJson('http://test.com/api');

    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('auth_token');
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('role');
    expect(window.location.reload).toHaveBeenCalled();
  });

  test('should not include Authorization header when no token is available', async () => {
    mockLocalStorage.getItem.mockReturnValue(null);
    mockSessionStorage.getItem.mockReturnValue(null);

    (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    } as Response);

    await fetchJson('http://test.com/api');

    const [, options] = (fetch as jest.MockedFunction<typeof fetch>).mock.calls[0];
    const headers = new Headers(options?.headers);
    
    expect(headers.has('Authorization')).toBe(false);
  });
});