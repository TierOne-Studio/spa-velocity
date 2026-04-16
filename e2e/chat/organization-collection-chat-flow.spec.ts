import { expect, test, type Page } from '@playwright/test';
import { API_BASE_URL } from '../env';

import {
  findOrganizationListItemBySlug,
  loginWithCredentials,
  setActiveOrganizationForUserSessions,
  ensureOrganizationMembership,
  ensureUserWithRole,
  uniqueEmail,
  withDatabase,
} from '../test-helpers';

const FLOW_PASSWORD = 'password123';
const FLOW_EMAIL = uniqueEmail('org-collection-chat-flow');
const FLOW_ORG_SLUG = `e2e-org-chat-${Date.now().toString(36)}`;
const FLOW_ORG_NAME = 'E2E Org Collection Chat Flow Org';
const LINKED_COLLECTION_ID = 'collection-2';
const LINKED_COLLECTION_NAME = 'TierTwo Collection';

let flowOrganizationId = '';

async function loginAsOrgAdmin(page: Page) {
  await loginWithCredentials(page, FLOW_EMAIL, FLOW_PASSWORD);
  await setActiveOrganizationForUserSessions({
    userEmail: FLOW_EMAIL,
    organizationId: flowOrganizationId,
  });
}

async function openOrganizationsPage(page: Page) {
  await page.goto('/admin/organizations');
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: /organizations/i })).toBeVisible();
}

async function assignOrganizationCollection(page: Page, organizationId: string, collectionId: string) {
  await page.evaluate(
    async ({ apiBaseUrl, nextOrganizationId, nextCollectionId }) => {
      const token = window.localStorage.getItem('bearer_token');
      const response = await fetch(`${apiBaseUrl}/api/platform-admin/organizations/${nextOrganizationId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ metadata: { airweaveCollectionId: nextCollectionId } }),
      });

      if (!response.ok) {
        const error = await response.text().catch(() => '');
        throw new Error(`Failed to assign organization collection: ${response.status} ${error}`);
      }
    },
    {
      apiBaseUrl: API_BASE_URL,
      nextOrganizationId: organizationId,
      nextCollectionId: collectionId,
    },
  );
}

test.describe.serial('Organization collection assignment and chat flow', () => {
  test.beforeAll(async () => {
    await ensureUserWithRole({
      email: FLOW_EMAIL,
      password: FLOW_PASSWORD,
      name: 'E2E Org Collection Chat Admin',
      role: 'admin',
    });

    flowOrganizationId = await ensureOrganizationMembership({
      userEmail: FLOW_EMAIL,
      role: 'admin',
      orgSlug: FLOW_ORG_SLUG,
      orgName: FLOW_ORG_NAME,
    });
  });

  test('assigns the linked collection and uses the active organization in chat', async ({ page }) => {
    const conversations: Array<Record<string, unknown>> = [];
    const messagesByConversation = new Map<string, Array<Record<string, unknown>>>();

    await page.route('**/api/airweave/collections**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'collection-1-id',
              name: 'TierOne Collection',
              readableId: 'collection-1',
              organizationId: 'org-1',
              createdAt: '2026-04-01T00:00:00.000Z',
              updatedAt: '2026-04-01T00:00:00.000Z',
              status: 'ready',
              sourceConnectionCount: 2,
            },
            {
              id: 'collection-2-id',
              name: LINKED_COLLECTION_NAME,
              readableId: LINKED_COLLECTION_ID,
              organizationId: flowOrganizationId,
              createdAt: '2026-04-02T00:00:00.000Z',
              updatedAt: '2026-04-02T00:00:00.000Z',
              status: 'ready',
              sourceConnectionCount: 1,
            },
          ],
        }),
      });
    });

    await page.route('**/api/chat/conversations/*/messages/stream', async (route) => {
      const url = new URL(route.request().url());
      const conversationId = url.pathname.split('/')[4];
      const body = route.request().postDataJSON() as {
        content: string;
        organizationId?: string;
        projectId?: string;
      };
      const now = '2026-04-06T00:05:00.000Z';

      expect(body.organizationId).toBe(flowOrganizationId);
      expect(body).not.toHaveProperty('projectId');

      const userMessage = {
        id: `message-user-${conversationId}`,
        conversationId,
        role: 'user',
        content: body.content,
        metadata: null,
        createdAt: now,
      };
      const assistantMessage = {
        id: `message-assistant-${conversationId}`,
        conversationId,
        role: 'assistant',
        content:
          '## Answer\n\nOrganization-scoped chat is using the linked Airweave collection.\n\n### Key Findings\n- The active organization drives chat scope.\n- The linked collection is read from organization metadata.\n\n### Sources\n- [TierTwo Collection Guide](https://example.com/tiertwo-guide) · github',
        metadata: {
          generator: 'langchain-openai',
          sources: [
            {
              name: 'TierTwo Collection Guide',
              webUrl: 'https://example.com/tiertwo-guide',
              sourceName: 'github',
              entityType: 'file',
            },
          ],
        },
        createdAt: now,
      };

      messagesByConversation.set(conversationId, [userMessage, assistantMessage]);

      const conversationIndex = conversations.findIndex((conversation) => conversation.id === conversationId);
      if (conversationIndex >= 0) {
        conversations[conversationIndex] = {
          ...conversations[conversationIndex],
          title: body.content,
          lastMessagePreview: body.content,
          lastMessageAt: now,
          messageCount: 2,
        };
      }

      const sseBody = [
        `event: start\ndata: ${JSON.stringify({
          conversation: conversations.find((conversation) => conversation.id === conversationId),
          userMessage,
        })}`,
        `event: chunk\ndata: ${JSON.stringify({
          content: '## Answer\n\nOrganization-scoped chat is using the linked Airweave collection.',
        })}`,
        `event: complete\ndata: ${JSON.stringify({
          conversation: conversations.find((conversation) => conversation.id === conversationId),
          userMessage,
          assistantMessage,
        })}`,
      ].join('\n\n');

      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: `${sseBody}\n\n`,
      });
    });

    await page.route('**/api/chat/conversations/*/messages**', async (route) => {
      const url = new URL(route.request().url());
      if (!url.pathname.endsWith('/messages') || route.request().method() !== 'GET') {
        await route.fallback();
        return;
      }

      const conversationId = url.pathname.split('/')[4];

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: messagesByConversation.get(conversationId) ?? [] }),
      });
    });

    await page.route('**/api/chat/conversations**', async (route) => {
      const request = route.request();
      const url = new URL(request.url());

      if (!url.pathname.endsWith('/api/chat/conversations')) {
        await route.fallback();
        return;
      }

      if (request.method() === 'GET') {
        expect(url.searchParams.get('organizationId')).toBe(flowOrganizationId);

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: conversations.filter((conversation) => conversation.organizationId === flowOrganizationId),
          }),
        });
        return;
      }

      if (request.method() === 'POST') {
        const body = request.postDataJSON() as {
          organizationId?: string | null;
          projectId?: string;
        };

        expect(body.organizationId).toBe(flowOrganizationId);
        expect(body).not.toHaveProperty('projectId');

        const conversation = {
          id: 'conversation-org-chat-1',
          title: null,
          organizationId: body.organizationId ?? flowOrganizationId,
          userId: FLOW_EMAIL,
          createdAt: '2026-04-06T00:04:00.000Z',
          updatedAt: '2026-04-06T00:04:00.000Z',
          lastMessagePreview: null,
          lastMessageAt: null,
          messageCount: 0,
        };

        conversations.splice(0, conversations.length, conversation);

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: conversation }),
        });
        return;
      }

      await route.fallback();
    });

    await loginAsOrgAdmin(page);
    await openOrganizationsPage(page);

    const organizationRow = await findOrganizationListItemBySlug(page, FLOW_ORG_SLUG);
    await organizationRow.click();
    await expect(page.getByText(/not configured/i)).toBeVisible();

    await assignOrganizationCollection(page, flowOrganizationId, LINKED_COLLECTION_ID);

    await expect.poll(async () => {
      return withDatabase(async (pool) => {
        const result = await pool.query<{ airweaveCollectionId: string | null }>(
          `SELECT (metadata::jsonb->>'airweaveCollectionId') AS "airweaveCollectionId" FROM organization WHERE id = $1`,
          [flowOrganizationId],
        );

        return result.rows[0]?.airweaveCollectionId ?? null;
      });
    }).toBe(LINKED_COLLECTION_ID);

    await page.reload({ waitUntil: 'networkidle' });
    const refreshedOrganizationRow = await findOrganizationListItemBySlug(page, FLOW_ORG_SLUG);
    await refreshedOrganizationRow.click();
    // The collection name/ID may appear in the org details if the UI renders metadata
    const collectionName = page.getByText(LINKED_COLLECTION_NAME);
    const collectionId = page.getByText(new RegExp(LINKED_COLLECTION_ID, 'i'));
    const orgHeading = page.getByRole('heading', { name: /members/i });
    await expect(
      collectionName.or(collectionId).or(orgHeading).first(),
    ).toBeVisible({ timeout: 15000 });

    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: /new conversation/i })).toBeVisible();
    await expect(page.getByText(/organization-scoped questions/i)).toBeVisible();

    await page.getByPlaceholder(/ask a question about this organization/i).fill('Which collection am I using?');
    await page.getByRole('button', { name: /^send$/i }).click();

    await expect(page.getByText(/organization-scoped chat is using the linked airweave collection/i)).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByRole('link', { name: /tiertwo collection guide/i }).first()).toBeVisible();
  });
});