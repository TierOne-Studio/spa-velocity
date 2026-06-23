/**
 * E2E for the Public Widget (embed sites) admin feature (SPEC-003 SPA side).
 *
 * Proves end-to-end against the REAL backend (real route guard + real
 * DB-backed `embed-site:*` permissions from the boot-time
 * `rbac_025_add_embed_site_permissions` migration):
 *  1. The sidebar shows "Public Widget" under Main when the caller holds
 *     `embed-site:read`.
 *  2. `/embed-sites` renders the page for an admin with an active org.
 *  3. An admin (holds `embed-site:create`) sees the Create button, and the
 *     Create dialog wires the project picker + allowed-origins field.
 *
 * The RBAC *gating logic* (member/manager hide create/delete) is proven
 * non-vacuously at the component layer in
 * `src/features/EmbedSites/views/__tests__/EmbedSitesPage.test.tsx`; this spec
 * proves the live route-guard + permission integration for the admin path.
 */
import { test, expect, type Page } from '@playwright/test';
import { TEST_USER } from '../env';
import {
  loginWithCredentials,
  ensureOrganizationMembership,
  setActiveOrganizationForUserSessions,
} from '../test-helpers';

const ORG_SLUG = 'e2e-embed-sites';
const ORG_NAME = 'E2E Embed Sites';

let organizationId: string;

async function loginAsAdmin(page: Page): Promise<void> {
  await loginWithCredentials(page, TEST_USER.email, TEST_USER.password);
  await setActiveOrganizationForUserSessions({
    userEmail: TEST_USER.email,
    organizationId,
  });
}

test.describe('Public Widget (embed sites) — admin', () => {
  test.beforeAll(async () => {
    organizationId = await ensureOrganizationMembership({
      userEmail: TEST_USER.email,
      role: 'admin',
      orgSlug: ORG_SLUG,
      orgName: ORG_NAME,
    });
  });

  test('sidebar shows "Public Widget" under Main for an admin', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/chat');
    await expect(
      page.getByRole('link', { name: 'Public Widget' }),
    ).toBeVisible();
  });

  test('/embed-sites renders the page with the Create button for an admin', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto('/embed-sites');

    await expect(page.locator('[data-testid="embed-sites-page"]')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: /public widget/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /create widget/i }),
    ).toBeVisible();
  });

  test('Create dialog wires the project picker and allowed-origins field', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto('/embed-sites');

    await page.getByRole('button', { name: /create widget/i }).click();

    await expect(
      page.getByRole('dialog', { name: /create public widget/i }),
    ).toBeVisible();
    await expect(page.locator('#embed-create-name')).toBeVisible();
    await expect(page.locator('#embed-create-project')).toBeVisible();
    await expect(page.locator('#embed-create-origins')).toBeVisible();
  });
});
