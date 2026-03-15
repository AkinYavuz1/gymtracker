import '@testing-library/jest-dom';

// Mock import.meta.env
if (!import.meta.env.VITE_SUPABASE_URL) {
  import.meta.env.VITE_SUPABASE_URL = 'https://test.supabase.co';
}
if (!import.meta.env.VITE_SUPABASE_ANON_KEY) {
  import.meta.env.VITE_SUPABASE_ANON_KEY = 'test-anon-key';
}

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: vi.fn((key) => store[key] ?? null),
    setItem: vi.fn((key, value) => { store[key] = String(value); }),
    removeItem: vi.fn((key) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
    get length() { return Object.keys(store).length; },
    key: vi.fn((i) => Object.keys(store)[i] ?? null),
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  configurable: true,
  get: () => window.__mockOnline ?? true,
});

// Mock window.alert
window.alert = vi.fn();

// Mock window.history
const pushStateSpy = vi.fn();
const replaceStateSpy = vi.fn();
Object.defineProperty(window, 'history', {
  value: {
    pushState: pushStateSpy,
    replaceState: replaceStateSpy,
    back: vi.fn(),
    forward: vi.fn(),
    go: vi.fn(),
    state: null,
    length: 1,
  },
  writable: true,
});

// Reset localStorage between tests
afterEach(() => {
  localStorageMock.clear();
  localStorageMock.getItem.mockClear();
  localStorageMock.setItem.mockClear();
  localStorageMock.removeItem.mockClear();
  window.__mockOnline = true;
});
