import { test, expect, type Page } from '@playwright/test';

import { TEST_USER } from '../env';
import {
  ensureOrganizationMembership,
  loginWithCredentials,
  setActiveOrganizationForUserSessions,
  withDatabase,
} from '../test-helpers';

const ORG_SLUG = 'e2e-chat-with-project';
const ORG_NAME = 'E2E Chat With Project';

let organizationId: string;

async function loginAndSetOrg(page: Page) {
  await loginWithCredentials(page, TEST_USER.email, TEST_USER.password);
  await setActiveOrganizationForUserSessions({
    userEmail: TEST_USER.email,
    organizationId,
  });
}

async function mockProjectAndConversations(page: Page) {
  // List projects (for picker dialog and rail lookup)
  await page.route('**/api/projects**', async (route, request) => {
    const url = new URL(request.url());
    const method = request.method();

    if (method === 'GET' && url.pathname === '/api/projects') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'proj-general',
              name: 'General',
              description: null,
              organizationId,
              sourceCount: 2,
              conversationCount: 1,
            },
          ],
        }),
      });
      return;
    }

    if (method === 'GET' && /\/api\/projects\/[^/]+$/.test(url.pathname)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            id: 'proj-general',
            name: 'General',
            description: null,
            organizationId,
            sourceCount: 2,
            conversationCount: 1,
            sources: [
              {
                id: 'src-1',
                kind: 'airweave_collection',
                name: 'Handbook',
                status: 'ready',
                config: { collectionReadableId: 'handbook', collectionName: 'Handbook' },
              },
              {
                id: 'src-2',
                kind: 'airweave_collection',
                name: 'Wiki',
                status: 'ready',
                config: { collectionReadableId: 'wiki', collectionName: 'Wiki' },
              },
            ],
          },
        }),
      });
      return;
    }

    await route.continue();
  });

  // Conversations list grouped under General project
  await page.route('**/api/chat/conversations*', async (route, request) => {
    if (request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'conv-1',
              title: 'Kickoff chat',
              organizationId,
              projectId: 'proj-general',
              projectName: 'General',
              projectSourceCount: 2,
              lastMessageAt: new Date().toISOString(),
              lastMessagePreview: 'Hey there!',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        }),
      });
      return;
    }
    await route.continue();
  });
}

test.describe('Chat with projects', () => {
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

  test('rail groups conversations by project', async ({ page }) => {
    await mockProjectAndConversations(page);
    await loginAndSetOrg(page);
    await page.goto('/chat', { waitUntil: 'domcontentloaded' });

    // Rail group header shows project name
    await expect(page.getByTestId('rail-project-group-proj-general')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('rail-project-group-proj-general')).toContainText(/general/i);
  });

  test('clicking New opens the pick-project dialog', async ({ page }) => {
    await mockProjectAndConversations(page);
    await loginAndSetOrg(page);
    await page.goto('/chat', { waitUntil: 'domcontentloaded' });

    const newButton = page.getByRole('button', { name: /^new$/i }).first();
    await expect(newButton).toBeVisible({ timeout: 15000 });
    await newButton.click();

    await expect(page.getByTestId('pick-project-dialog')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('pick-project-option-proj-general')).toBeVisible();
  });

  test('selected conversation header shows project chip with source count', async ({ page }) => {
    await mockProjectAndConversations(page);
    await loginAndSetOrg(page);
    await page.goto('/chat/conv-1', { waitUntil: 'domcontentloaded' });

    const chip = page.getByTestId('chat-project-chip');
    await expect(chip).toBeVisible({ timeout: 15000 });
    await expect(chip).toContainText(/general/i);
    await expect(chip).toContainText(/2 sources/i);
  });

  test('clicking header chip opens the project sources drawer', async ({ page }) => {
    await mockProjectAndConversations(page);
    await loginAndSetOrg(page);
    await page.goto('/chat/conv-1', { waitUntil: 'domcontentloaded' });

    await page.getByTestId('chat-project-chip').click();

    await expect(page.getByTestId('project-sources-drawer')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Handbook')).toBeVisible();
    await expect(page.getByText('Wiki')).toBeVisible();
  });

  test('Switch project button opens picker with current project badged and disabled', async ({ page }) => {
    await mockProjectAndConversations(page);
    await loginAndSetOrg(page);
    await page.goto('/chat/conv-1', { waitUntil: 'domcontentloaded' });

    const switchButton = page.getByTestId('chat-switch-project-button');
    await expect(switchButton).toBeVisible({ timeout: 15000 });
    await switchButton.click();

    const dialog = page.getByTestId('pick-project-dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });
    await expect(dialog).toContainText(/switch project/i);
    await expect(page.getByTestId('pick-project-current-proj-general')).toBeVisible();
    await expect(page.getByTestId('pick-project-option-proj-general')).toBeDisabled();
  });
});
