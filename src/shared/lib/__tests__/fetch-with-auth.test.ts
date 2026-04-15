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

import { fetchWithAuth, fetchApi } from '../fetch-with-auth';

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

    it('should omit credentials by default so cookies never conflict with the bearer token', async () => {
        await fetchWithAuth('http://localhost:3000/api/test');

        const callArgs = mockFetch.mock.calls[0];
        expect(callArgs[1].credentials).toBe('omit');
    });

    it('should preserve explicit credentials when provided', async () => {
        await fetchWithAuth('http://localhost:3000/api/test', {
            credentials: 'include',
        });

        const callArgs = mockFetch.mock.calls[0];
        expect(callArgs[1].credentials).toBe('include');
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

describe('fetchApi', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorageMock.clear();
    });

    it('should return parsed JSON on success', async () => {
        const payload = { id: 1, name: 'test' };
        mockFetch.mockResolvedValue(
            new Response(JSON.stringify(payload), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            }),
        );

        const result = await fetchApi<{ id: number; name: string }>(
            'http://localhost:3000/api/test',
        );

        expect(result).toEqual(payload);
    });

    it('should throw with server error message on non-2xx', async () => {
        mockFetch.mockResolvedValue(
            new Response(JSON.stringify({ message: 'User not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            }),
        );

        await expect(
            fetchApi('http://localhost:3000/api/test'),
        ).rejects.toThrow('User not found');
    });

    it('should throw with fallback message when server returns no message', async () => {
        mockFetch.mockResolvedValue(
            new Response('', { status: 500 }),
        );

        await expect(
            fetchApi('http://localhost:3000/api/test', undefined, 'Custom fallback'),
        ).rejects.toThrow('Custom fallback');
    });

    it('should throw with default fallback when no fallback provided', async () => {
        mockFetch.mockResolvedValue(
            new Response('not json', { status: 500 }),
        );

        await expect(
            fetchApi('http://localhost:3000/api/test'),
        ).rejects.toThrow('Request failed');
    });

    it('should return undefined for 204 No Content', async () => {
        mockFetch.mockResolvedValue(
            new Response(null, { status: 204 }),
        );

        const result = await fetchApi('http://localhost:3000/api/test');

        expect(result).toBeUndefined();
    });

    it('should forward options to fetchWithAuth', async () => {
        localStorageMock.setItem('bearer_token', 'my-token');
        mockFetch.mockResolvedValue(
            new Response(JSON.stringify({ ok: true }), { status: 200 }),
        );

        await fetchApi('http://localhost:3000/api/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: 'val' }),
        });

        const callArgs = mockFetch.mock.calls[0];
        expect(callArgs[1].method).toBe('POST');
        expect(callArgs[1].body).toBe(JSON.stringify({ key: 'val' }));
        const headers = callArgs[1].headers as Headers;
        expect(headers.get('Authorization')).toBe('Bearer my-token');
    });
});
