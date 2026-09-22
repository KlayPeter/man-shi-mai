import { describe, it, expect, beforeEach } from 'vitest';

// Define a robust localStorage mock for JSDOM / Node environments
class LocalStorageMock {
  private store: Record<string, string> = {};

  clear() {
    this.store = {};
  }

  getItem(key: string): string | null {
    return this.store[key] || null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }

  removeItem(key: string): void {
    delete this.store[key];
  }
}

const mockLocalStorage = new LocalStorageMock();

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    value: mockLocalStorage,
    writable: true,
  });
}

Object.defineProperty(globalThis, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
  configurable: true,
});

import { useUserStore } from '../../src/stores/userStore';

describe('useUserStore', () => {
  beforeEach(() => {
    // Reset state before each test
    useUserStore.setState({
      userInfo: {},
      isLogin: false,
      token: '',
      resumes: [],
      hydrated: false,
    });
    localStorage.clear();
  });

  it('should set token and set isLogin to true', () => {
    useUserStore.getState().setToken('mock-jwt-token');

    const state = useUserStore.getState();
    expect(state.token).toBe('mock-jwt-token');
    expect(state.isLogin).toBe(true);
    expect(localStorage.getItem('token')).toBe('mock-jwt-token');
  });

  it('should update user info successfully', () => {
    useUserStore.getState().updateUserInfo({
      username: 'Alice',
      email: 'alice@example.com',
    });

    const state = useUserStore.getState();
    expect(state.userInfo).toEqual({
      username: 'Alice',
      email: 'alice@example.com',
    });
  });

  it('should clean state on logout', () => {
    // Setup initial state
    useUserStore.setState({
      token: 'jwt-123',
      isLogin: true,
      userInfo: { username: 'Bob' },
    });

    useUserStore.getState().logout();

    const state = useUserStore.getState();
    expect(state.token).toBe('');
    expect(state.isLogin).toBe(false);
    expect(state.userInfo).toEqual({});
    expect(localStorage.getItem('token')).toBeNull();
  });
});
