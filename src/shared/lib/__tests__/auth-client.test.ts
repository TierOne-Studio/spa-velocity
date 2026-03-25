import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';

const mockCreateAuthClient = vi.fn();

vi.mock('better-auth/react', () => ({
  createAuthClient: (...args: unknown[]) => mockCreateAuthClient(...args),
}));

vi.mock('better-auth/client/plugins', () => ({
  organizationClient: vi.fn(() => ({ type: 'organization' })),
  adminClient: vi.fn(() => ({ type: 'admin' })),
}));

type FetchOptionsConfig = {
  onSuccess: (ctx: { response: { headers: { get: (name: string) => string | null } } }) => void;
  auth: { type: string; token: () => string };
};

type CapturedConfig = {
  baseURL: string;
  plugins: unknown[];
  fetchOptions: FetchOptionsConfig;
};

let capturedConfig: CapturedConfig | null = null;

const fakeClient = {
  signIn: { email: vi.fn() },
  signUp: { email: vi.fn() },
  signOut: vi.fn(),
  useSession: vi.fn(),
  getSession: vi.fn(),
  organization: {},
  admin: {},
};

mockCreateAuthClient.mockImplementation((config: CapturedConfig) => {
  capturedConfig = config;
  return fakeClient;
});

describe('auth-client', () => {
  beforeAll(async () => {
    await import('../auth-client');
  });

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('creates authClient with a truthy baseURL', () => {
    expect(capturedConfig).not.toBeNull();
    expect(capturedConfig!.baseURL).toBeTruthy();
  });

  it('creates authClient with organization and admin plugins', () => {
    expect(capturedConfig).not.toBeNull();
    expect(Array.isArray(capturedConfig!.plugins)).toBe(true);
    expect(capturedConfig!.plugins).toHaveLength(2);
  });

  it('fetchOptions.onSuccess stores set-auth-token header in localStorage', () => {
    expect(capturedConfig).not.toBeNull();
    const ctx = {
      response: {
        headers: { get: vi.fn().mockReturnValue('my-token-123') },
      },
    };

    capturedConfig!.fetchOptions.onSuccess(ctx);

    expect(localStorage.getItem('bearer_token')).toBe('my-token-123');
  });

  it('fetchOptions.onSuccess does not store when header is null', () => {
    expect(capturedConfig).not.toBeNull();
    const ctx = {
      response: {
        headers: { get: vi.fn().mockReturnValue(null) },
      },
    };

    capturedConfig!.fetchOptions.onSuccess(ctx);

    expect(localStorage.getItem('bearer_token')).toBeNull();
  });

  it('fetchOptions.auth.token returns bearer_token from localStorage', () => {
    expect(capturedConfig).not.toBeNull();
    localStorage.setItem('bearer_token', 'stored-token');

    const token = capturedConfig!.fetchOptions.auth.token();
    expect(token).toBe('stored-token');
  });

  it('fetchOptions.auth.token returns empty string when no token in localStorage', () => {
    expect(capturedConfig).not.toBeNull();
    localStorage.removeItem('bearer_token');

    const token = capturedConfig!.fetchOptions.auth.token();
    expect(token).toBe('');
  });

  it('fetchOptions.auth has type Bearer', () => {
    expect(capturedConfig).not.toBeNull();
    expect(capturedConfig!.fetchOptions.auth.type).toBe('Bearer');
  });

  it('exports named auth methods from authClient', async () => {
    const module = await import('../auth-client');
    expect(module.signIn).toBeDefined();
    expect(module.signUp).toBeDefined();
    expect(module.signOut).toBeDefined();
    expect(module.useSession).toBeDefined();
    expect(module.getSession).toBeDefined();
    expect(module.organization).toBeDefined();
    expect(module.admin).toBeDefined();
    expect(module.auth).toBeDefined();
    expect(module.authClient).toBeDefined();
  });
});
