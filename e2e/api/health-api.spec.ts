import { test, expect } from '@playwright/test';
import { API_BASE_URL } from '../env';

/**
 * Health Endpoint API Tests
 *
 * Verifies the backend /health endpoint returns correct status, timestamp, and uptime.
 */

test.describe('Health Endpoint', () => {
  test('GET /health should return 200 with status ok', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/health`);
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(body.timestamp).toBeDefined();
    expect(typeof body.uptime).toBe('number');
    expect(body.uptime).toBeGreaterThan(0);
  });

  test('GET /health should return valid ISO 8601 timestamp', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/health`);
    const body = await response.json();

    const parsed = new Date(body.timestamp);
    expect(parsed.toISOString()).toBe(body.timestamp);
  });
});
