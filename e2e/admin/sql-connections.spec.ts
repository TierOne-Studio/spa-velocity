import { test, expect, type Page } from '@playwright/test';

import { TEST_USER } from '../env';
import {
  ensureOrganizationMembership,
  loginWithCredentials,
  setActiveOrganizationForUserSessions,
} from '../test-helpers';

const ORG_SLUG = 'e2e-sql-connections';
const ORG_NAME = 'E2E SQL Connections';

let organizationId: string;

type StoredConnection = {
  id: string;
  organizationId: string;
  name: string;
  host: string;
  port: number;
  database: string;
  username: string;
  ssl: boolean;
  schemaName: string;
  status: 'connecting' | 'ready' | 'error';
  statusError: string | null;
  createdAt: string;
  updatedAt: string;
};

async function mockSqlConnectionsApi(page: Page) {
  const store: StoredConnection[] = [];

  await page.route('**/api/sql-connections*', async (route, request) => {
    const url = new URL(request.url());
    const method = request.method();

    if (method === 'GET' && url.pathname === '/api/sql-connections') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: store }),
      });
      return;
    }

    if (method === 'POST' && url.pathname === '/api/sql-connections') {
      const body = JSON.parse(request.postData() ?? '{}') as Record<string, unknown>;
      const now = new Date().toISOString();
      const record: StoredConnection = {
        id: `conn-${store.length + 1}`,
        organizationId,
        name: String(body.name ?? ''),
        host: String(body.host ?? ''),
        port: Number(body.port ?? 5432),
        database: String(body.database ?? ''),
        username: String(body.username ?? ''),
        ssl: body.ssl === true,
        schemaName: String(body.schemaName ?? 'public'),
        status: 'ready',
        statusError: null,
        createdAt: now,
        updatedAt: now,
      };
      store.push(record);
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ data: record }),
      });
      return;
    }

    const deleteMatch =
      method === 'DELETE' && url.pathname.match(/^\/api\/sql-connections\/([^/]+)$/);
    if (deleteMatch) {
      const idx = store.findIndex((c) => c.id === deleteMatch[1]);
      if (idx >= 0) store.splice(idx, 1);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: true }),
      });
      return;
    }

    await route.fallback();
  });
}

test.describe.serial('SQL Connections admin UI', () => {
  test.beforeAll(async () => {
    organizationId = await ensureOrganizationMembership({
      userEmail: TEST_USER.email,
      role: 'admin',
      orgSlug: ORG_SLUG,
      orgName: ORG_NAME,
    });
  });

  test.beforeEach(async ({ page }) => {
    await loginWithCredentials(page, TEST_USER.email, TEST_USER.password);
    await setActiveOrganizationForUserSessions({
      userEmail: TEST_USER.email,
      organizationId,
    });
    await mockSqlConnectionsApi(page);
  });

  test('shows empty state and creates a new SQL connection', async ({ page }) => {
    await page.goto('/admin/organizations');

    await page.getByText(ORG_NAME, { exact: true }).first().click();

    // Open edit dialog from row actions.
    const editButton = page.getByRole('button', { name: /edit/i }).first();
    await editButton.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const section = dialog.getByTestId('org-sql-connections-section');
    await expect(section).toBeVisible();
    await expect(section.getByTestId('org-sql-empty')).toBeVisible();

    await section.getByTestId('org-sql-add').click();
    const formDialog = page.getByTestId('sql-connection-form-dialog');
    await expect(formDialog).toBeVisible();

    await formDialog.getByTestId('sql-conn-name').fill('Reporting DB');
    await formDialog.getByTestId('sql-conn-host').fill('db.example.com');
    await formDialog.getByTestId('sql-conn-port').fill('5432');
    await formDialog.getByTestId('sql-conn-database').fill('reporting');
    await formDialog.getByTestId('sql-conn-username').fill('reader');
    await formDialog.getByTestId('sql-conn-password').fill('super-secret');
    await formDialog.getByTestId('sql-conn-submit').click();

    await expect(formDialog).toBeHidden();
    await expect(section.getByTestId('org-sql-list')).toBeVisible();
    await expect(section.getByText('Reporting DB')).toBeVisible();
    await expect(section.getByText('ready').first()).toBeVisible();
  });
});
