import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock localStorage
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: vi.fn((key: string) => store[key] ?? null),
        setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
        removeItem: vi.fn((key: string) => { delete store[key]; }),
        clear: vi.fn(() => { store = {}; }),
    };
})();
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { fetchWithAuth } from '../fetch-with-auth';

describe('fetchWithAuth (PR#5 - Bearer token auth)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorageMock.clear();
        mockFetch.mockResolvedValue(new Response('ok', { status: 200 }));
    });

    it('should add Authorization header when bearer_token exists', async () => {
        localStorageMock.setItem('bearer_token', 'test-token-123');

        await fetchWithAuth('http://localhost:3000/api/test');

        expect(mockFetch).toHaveBeenCalledWith(
            'http://localhost:3000/api/test',
            expect.objectContaining({
                headers: expect.any(Headers),
            }),
        );

        const callArgs = mockFetch.mock.calls[0];
        const headers = callArgs[1].headers as Headers;
        expect(headers.get('Authorization')).toBe('Bearer test-token-123');
    });

    it('should NOT add Authorization header when no bearer_token', async () => {
        await fetchWithAuth('http://localhost:3000/api/test');

        const callArgs = mockFetch.mock.calls[0];
        const headers = callArgs[1].headers as Headers;
        expect(headers.get('Authorization')).toBeNull();
    });

    it('should preserve existing headers from options', async () => {
        localStorageMock.setItem('bearer_token', 'test-token');

        await fetchWithAuth('http://localhost:3000/api/test', {
            headers: { 'Content-Type': 'application/json' },
        });

        const callArgs = mockFetch.mock.calls[0];
        const headers = callArgs[1].headers as Headers;
        expect(headers.get('Content-Type')).toBe('application/json');
        expect(headers.get('Authorization')).toBe('Bearer test-token');
    });

    it('should include credentials by default for cookie-backed auth flows', async () => {
        await fetchWithAuth('http://localhost:3000/api/test');

        const callArgs = mockFetch.mock.calls[0];
        expect(callArgs[1].credentials).toBe('include');
    });

    it('should preserve explicit credentials when provided', async () => {
        await fetchWithAuth('http://localhost:3000/api/test', {
            credentials: 'omit',
        });

        const callArgs = mockFetch.mock.calls[0];
        expect(callArgs[1].credentials).toBe('omit');
    });

    it('should forward method and body options', async () => {
        await fetchWithAuth('http://localhost:3000/api/test', {
            method: 'POST',
            body: JSON.stringify({ key: 'value' }),
        });

        const callArgs = mockFetch.mock.calls[0];
        expect(callArgs[1].method).toBe('POST');
        expect(callArgs[1].body).toBe(JSON.stringify({ key: 'value' }));
    });

    it('should return the fetch response', async () => {
        const mockResponse = new Response('success', { status: 200 });
        mockFetch.mockResolvedValue(mockResponse);

        const result = await fetchWithAuth('http://localhost:3000/api/test');

        expect(result).toBe(mockResponse);
    });
});
