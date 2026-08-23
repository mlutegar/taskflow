import '@testing-library/jest-dom';

// ── localStorage mock ─────────────────────────────────────────────────────────

const localStorageStore = {};

const localStorageMock = {
  getItem: vi.fn((key) => localStorageStore[key] ?? null),
  setItem: vi.fn((key, value) => { localStorageStore[key] = String(value); }),
  removeItem: vi.fn((key) => { delete localStorageStore[key]; }),
  clear: vi.fn(() => { Object.keys(localStorageStore).forEach((k) => delete localStorageStore[k]); }),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// ── fetch mock ────────────────────────────────────────────────────────────────

global.fetch = vi.fn();

// ── Reset between tests ───────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  localStorageMock.clear();
});
