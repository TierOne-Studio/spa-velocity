import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Stub `@airweave/connect-react` at the suite level. Upstream's published
// package.json declares `"airweave-connect": "file:../.."` — a workspace
// link that doesn't resolve once the tarball is installed. Any test that
// transitively imports the SDK (e.g. AppRoutes pulling in the Airweave
// page) crashes at module-load with `Cannot find package 'airweave-connect'`.
// Suites that exercise the SDK contract (useAirweaveConnectModal,
// ReauthSourceConnectionButton, etc.) re-mock this module locally with
// vi.mock — those local mocks win over this setup-level fallback.
vi.mock('@airweave/connect-react', () => ({
  useAirweaveConnect: () => ({ open: vi.fn(), isLoading: false }),
}));

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(function () {
  return {
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  };
}) as unknown as typeof ResizeObserver;

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
})) as unknown as typeof IntersectionObserver;
