import { test, expect } from '@playwright/test';
import { API_BASE_URL } from '../env';
import {
  setUserRole,
  signInAndGetAuthHeaders,
} from '../rbac-role-helpers';

test.describe('API Permission Restrictions', () => {
  // Note: 401 = Unauthorized (not authenticated), 403 = Forbidden (authenticated but not allowed)
  // Without authentication, we expect 401 or 403 depending on the endpoint

  test('should reject role creation without authentication', async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/api/rbac/roles`, {
      data: { name: 'hacker-role', displayName: 'Hacker Role' },
    });
    expect([401, 403]).toContain(response.status());
  });

  test('should reject role update without authentication', async ({ request }) => {
    const response = await request.put(`${API_BASE_URL}/api/rbac/roles/some-id`, {
      data: { displayName: 'Hacked Role' },
    });
    expect([401, 403]).toContain(response.status());
  });

  test('should reject role deletion without authentication', async ({ request }) => {
    const response = await request.delete(`${API_BASE_URL}/api/rbac/roles/some-id`);
    expect([401, 403]).toContain(response.status());
  });

  test('should reject permission assignment without authentication', async ({ request }) => {
    const response = await request.put(`${API_BASE_URL}/api/rbac/roles/some-id/permissions`, {
      data: { permissionIds: [] },
    });
    expect([401, 403]).toContain(response.status());
  });

  test('should reject platform admin org listing without authentication', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/api/platform-admin/organizations`);
    expect([401, 403]).toContain(response.status());
  });

  test('should reject platform admin org update without authentication', async ({ request }) => {
    const response = await request.put(`${API_BASE_URL}/api/platform-admin/organizations/some-id`, {
      data: { name: 'Hacked Org' },
    });
    expect([401, 403]).toContain(response.status());
  });

  test('should reject platform admin org deletion without authentication', async ({ request }) => {
    const response = await request.delete(`${API_BASE_URL}/api/platform-admin/organizations/some-id`);
    expect([401, 403]).toContain(response.status());
  });

  test('should reject org impersonation without authentication', async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/api/organization/some-org-id/impersonate`, {
      data: { userId: 'target-user-id' },
    });
    expect([401, 403]).toContain(response.status());
  });

  test('should forbid role creation for authenticated manager', async ({ request }) => {
    await setUserRole('manager');
    const headers = await signInAndGetAuthHeaders(request);

    const response = await request.post(`${API_BASE_URL}/api/rbac/roles`, {
      headers,
      data: { name: `mgr-blocked-${Date.now()}`, displayName: 'Manager Blocked Role' },
    });

    expect(response.status()).toBe(403);
  });

  test('should forbid role creation for authenticated member', async ({ request }) => {
    await setUserRole('member');
    const headers = await signInAndGetAuthHeaders(request);

    const response = await request.post(`${API_BASE_URL}/api/rbac/roles`, {
      headers,
      data: { name: `member-blocked-${Date.now()}`, displayName: 'Member Blocked Role' },
    });

    expect(response.status()).toBe(403);
  });
});
