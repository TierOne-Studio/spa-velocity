import { test, expect, type Page } from '@playwright/test';

import { TEST_USER } from '../env';
import {
  ensureOrganizationMembership,
  loginWithCredentials,
  setActiveOrganizationForUserSessions,
  withDatabase,
} from '../test-helpers';

const ORG_SLUG = 'e2e-projects-crud';
const ORG_NAME = 'E2E Projects CRUD';

let organizationId: string;

async function loginAndSetOrg(page: Page) {
  await loginWithCredentials(page, TEST_USER.email, TEST_USER.password);
  await setActiveOrganizationForUserSessions({
    userEmail: TEST_USER.email,
    organizationId,
  });
}

type MockProject = {
  id: string;
  name: string;
  description?: string | null;
  sourceCount: number;
  conversationCount: number;
  sources?: Array<{
    id: string;
    kind: 'airweave_collection';
    name: string;
    config: { collectionReadableId: string; collectionName: string };
    status: 'ready';
    statusDetail: null;
    createdAt: string;
    updatedAt: string;
    projectId: string;
  }>;
};

async function mockProjectsApi(
  page: Page,
  projects: MockProject[],
  calls?: { addSource?: unknown[]; removeSource?: unknown[]; create?: unknown[]; update?: unknown[]; del?: unknown[] },
) {
  await page.route('**/api/airweave/collections**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          { id: 'c1', name: 'Alpha', readableId: 'alpha', organizationId, createdAt: '', updatedAt: '', status: null, sourceConnectionCount: 0 },
          { id: 'c2', name: 'Beta', readableId: 'beta', organizationId, createdAt: '', updatedAt: '', status: null, sourceConnectionCount: 0 },
        ],
      }),
    });
  });

  await page.route('**/api/vector-dbs**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          {
            id: 'vdb-1',
            organizationId,
            name: 'Handbook',
            description: null,
            vectorStoreKind: 'qdrant',
            vectorStoreRef: 'vdb_vdb-1',
            status: 'ready',
            statusError: null,
            documentCount: 2,
            version: 1,
            processingStartedAt: null,
            lastIngestedAt: null,
            createdAt: '',
            updatedAt: '',
          },
        ],
      }),
    });
  });

  await page.route('**/api/projects**', async (route, request) => {
    const url = new URL(request.url());
    const method = request.method();

    // Source mutations
    const addSourceMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/sources$/);
    const removeSourceMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/sources\/([^/]+)$/);

    if (method === 'POST' && addSourceMatch) {
      const body = request.postDataJSON();
      calls?.addSource?.push(body);
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            id: `new-src-${Date.now()}`,
            projectId: addSourceMatch[1],
            kind: 'airweave_collection',
            ...body,
            status: 'ready',
            statusDetail: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        }),
      });
      return;
    }
    if (method === 'DELETE' && removeSourceMatch) {
      calls?.removeSource?.push({ projectId: removeSourceMatch[1], sourceId: removeSourceMatch[2] });
      await route.fulfill({ status: 204, body: '' });
      return;
    }

    // List
    if (method === 'GET' && url.pathname === '/api/projects') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: projects }),
      });
      return;
    }

    // Detail
    if (method === 'GET' && /\/api\/projects\/[^/]+$/.test(url.pathname)) {
      const id = url.pathname.split('/').pop();
      const project = projects.find((p) => p.id === id);
      if (!project) {
        await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ message: 'Not found' }) });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            ...project,
            organizationId,
            description: project.description ?? null,
            sources: project.sources ?? [],
          },
        }),
      });
      return;
    }

    // Create
    if (method === 'POST' && url.pathname === '/api/projects') {
      const body = request.postDataJSON();
      calls?.create?.push(body);
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            id: 'new-project-id',
            name: body.name,
            description: body.description ?? null,
            organizationId,
            sourceCount: 0,
            conversationCount: 0,
            sources: [],
          },
        }),
      });
      return;
    }

    // Update
    if (method === 'PATCH' && /\/api\/projects\/[^/]+$/.test(url.pathname)) {
      const body = request.postDataJSON();
      calls?.update?.push(body);
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { ...body } }) });
      return;
    }

    // Delete
    if (method === 'DELETE' && /\/api\/projects\/[^/]+$/.test(url.pathname)) {
      const id = url.pathname.split('/').pop();
      calls?.del?.push({ id });
      await route.fulfill({ status: 204, body: '' });
      return;
    }

    await route.continue();
  });
}

test.describe('Projects CRUD', () => {
  test.beforeAll(async () => {
    await withDatabase(async (pool) => {
      await pool.query(`UPDATE "user" SET role = 'superadmin' WHERE email = $1`, [TEST_USER.email]);
    });
    organizationId = await ensureOrganizationMembership({
      userEmail: TEST_USER.email,
      role: 'admin',
      orgSlug: ORG_SLUG,
      orgName: ORG_NAME,
    });
  });

  test('shows empty table when no projects exist', async ({ page }) => {
    await mockProjectsApi(page, []);
    await loginAndSetOrg(page);
    await page.goto('/projects', { waitUntil: 'domcontentloaded' });

    await expect(page.getByTestId('projects-page')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/no results/i)).toBeVisible();
  });

  test('lists existing projects in the data table', async ({ page }) => {
    await mockProjectsApi(page, [
      { id: 'p-1', name: 'General', description: 'Default project', sourceCount: 1, conversationCount: 3 },
      { id: 'p-2', name: 'Research', description: null, sourceCount: 0, conversationCount: 0 },
    ]);
    await loginAndSetOrg(page);
    await page.goto('/projects', { waitUntil: 'domcontentloaded' });

    await expect(page.getByTestId('project-name-p-1')).toHaveText('General');
    await expect(page.getByTestId('project-name-p-2')).toHaveText('Research');
  });

  test('creates a new project via the form dialog', async ({ page }) => {
    const calls = { create: [] as unknown[] };
    await mockProjectsApi(page, [], calls);
    await loginAndSetOrg(page);
    await page.goto('/projects', { waitUntil: 'domcontentloaded' });

    await page.getByTestId('projects-new-button').click();
    await expect(page.getByTestId('project-form-dialog')).toBeVisible();

    await page.getByLabel('Name').fill('My New Project');
    await page.getByLabel('Description').fill('For testing');
    await page.getByTestId('project-form-submit').click();

    await expect(page.getByText(/project created/i)).toBeVisible({ timeout: 10000 });
    expect(calls.create.length).toBeGreaterThan(0);
  });

  test('creates a project with a vector_db source attached', async ({ page }) => {
    const calls = { create: [] as unknown[] };
    await mockProjectsApi(page, [], calls);
    await loginAndSetOrg(page);
    await page.goto('/projects', { waitUntil: 'domcontentloaded' });

    await page.getByTestId('projects-new-button').click();
    await expect(page.getByTestId('project-form-dialog')).toBeVisible();

    await page.getByLabel('Name').fill('RAG Project');
    await page.getByRole('button', { name: /select vector databases/i }).click();
    await page.getByRole('option', { name: /handbook/i }).click();
    await page.keyboard.press('Escape');
    await page.getByTestId('project-form-submit').click();

    await expect(page.getByText(/project created/i)).toBeVisible({ timeout: 10000 });
    const created = calls.create[0] as { initialSources?: Array<{ kind: string; config: { vectorDbId: string } }> };
    expect(created.initialSources).toEqual([
      {
        kind: 'vector_db',
        name: 'Handbook',
        config: { vectorDbId: 'vdb-1', vectorDbName: 'Handbook' },
      },
    ]);
  });

  test('opens the edit dialog with Organization disabled and keeps row in place', async ({ page }) => {
    await mockProjectsApi(page, [
      {
        id: 'p-edit',
        name: 'Editable',
        description: 'Initial',
        sourceCount: 0,
        conversationCount: 0,
        sources: [],
      },
    ]);
    await loginAndSetOrg(page);
    await page.goto('/projects', { waitUntil: 'domcontentloaded' });

    await page.getByTestId('project-row-actions-p-edit').click();
    await page.getByTestId('project-edit-p-edit').click();

    await expect(page.getByTestId('project-form-dialog')).toBeVisible();
    const orgTrigger = page.getByTestId('project-organization-trigger');
    const orgField = page.getByTestId('project-organization');

    await expect
      .poll(async () => {
        if (await orgTrigger.count()) return 'trigger';
        if (await orgField.count()) return 'field';
        return 'pending';
      })
      .not.toBe('pending');

    if (await orgTrigger.count()) {
      await expect(orgTrigger).toBeDisabled();
    } else {
      await expect(orgField).toBeVisible();
      await expect(page.getByText(/organization cannot be changed after creation/i)).toBeVisible();
    }
  });

  test('deletes a project via the row action + confirmation dialog', async ({ page }) => {
    const calls = { del: [] as unknown[] };
    await mockProjectsApi(
      page,
      [{ id: 'p-doomed', name: 'Doomed', description: null, sourceCount: 0, conversationCount: 0 }],
      calls,
    );
    await loginAndSetOrg(page);
    await page.goto('/projects', { waitUntil: 'domcontentloaded' });

    await page.getByTestId('project-row-actions-p-doomed').click();
    await page.getByTestId('project-delete-p-doomed').click();
    await page.getByTestId('project-delete-confirm').click();

    await expect(page.getByText(/project deleted/i)).toBeVisible({ timeout: 10000 });
    expect(calls.del.length).toBeGreaterThan(0);
  });
});
