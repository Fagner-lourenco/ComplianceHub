import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

const storage = new Map();

const localStorageMock = {
    getItem: vi.fn((key) => (storage.has(key) ? storage.get(key) : null)),
    setItem: vi.fn((key, value) => {
        storage.set(key, String(value));
    }),
    removeItem: vi.fn((key) => {
        storage.delete(key);
    }),
    clear: vi.fn(() => {
        storage.clear();
    }),
};

Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    configurable: true,
});

beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
});

afterEach(() => {
    cleanup();
    localStorageMock.clear();
});
