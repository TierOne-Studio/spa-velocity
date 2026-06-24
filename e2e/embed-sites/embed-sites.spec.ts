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
  withDatabase,
} from '../test-helpers';

const ORG_SLUG = 'e2e-embed-sites';
const ORG_NAME = 'E2E Embed Sites';
const WIDGET_NAME = 'E2E Theme Widget';
const WIDGET_KEY = 'wgt_pub_e2e_theme_picker';

let organizationId: string;

// Seed one project + one embed_site so the admin list has a row whose
// "Get embed code" action opens the theme picker. Idempotent: dropping the
// project cascades to embed_site (FK ON DELETE CASCADE).
async function seedWidget(orgId: string): Promise<void> {
  await withDatabase(async (pool) => {
    const user = await pool.query<{ id: string }>(
      'SELECT id FROM "user" WHERE email = $1 LIMIT 1',
      [TEST_USER.email],
    );
    const createdBy = user.rows[0]?.id;
    if (!createdBy) {
      throw new Error(`Seed failed: no user row for ${TEST_USER.email}`);
    }
    await pool.query(
      'DELETE FROM project WHERE organization_id = $1 AND name = $2',
      [orgId, WIDGET_NAME],
    );
    const project = await pool.query<{ id: string }>(
      'INSERT INTO project (organization_id, name, created_by_user_id) VALUES ($1, $2, $3) RETURNING id',
      [orgId, WIDGET_NAME, createdBy],
    );
    await pool.query(
      `INSERT INTO embed_site (organization_id, project_id, name, public_key, allowed_origins)
       VALUES ($1, $2, $3, $4, $5)`,
      [orgId, project.rows[0].id, WIDGET_NAME, WIDGET_KEY, ['https://acme.test']],
    );
  });
}

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
    await seedWidget(organizationId);
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

  test('embed code modal offers four themes and writes data-theme into the snippet', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto('/embed-sites');

    await page
      .getByRole('button', { name: `Actions for ${WIDGET_NAME}` })
      .click();
    await page.getByRole('menuitem', { name: /get embed code/i }).click();

    const dialog = page.getByRole('dialog', { name: /embed code/i });
    await expect(dialog).toBeVisible();

    // Default selection is cloud, reflected in the snippet.
    await expect(dialog.getByTestId('embed-snippet')).toContainText(
      'data-theme="cloud"',
    );

    // All four themes are offered.
    for (const label of ['Cloud', 'Obsidian', 'Neo Brutalism', 'Mono Chrome']) {
      await expect(dialog.getByText(label, { exact: true })).toBeVisible();
    }

    // Picking Obsidian updates both the snippet and the live preview.
    await dialog.getByText('Obsidian', { exact: true }).click();
    await expect(dialog.getByTestId('embed-snippet')).toContainText(
      'data-theme="obsidian"',
    );
    await expect(
      dialog.getByRole('img', { name: /obsidian theme preview/i }),
    ).toBeVisible();
  });
});
