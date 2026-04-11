import { expect, test } from '@playwright/test';
import {
  ensureOrganizationMembership,
  ensureUserWithRole,
  loginWithCredentials,
  setActiveOrganizationForUserSessions,
  uniqueEmail,
} from './test-helpers';

const FLOW_PASSWORD = 'password123';
const FLOW_EMAIL = uniqueEmail('champion-velocity-flow');
const FLOW_ORG_SLUG = `cv-flow-${Date.now().toString(36)}`;
const FLOW_ORG_NAME = 'E2E Champion Velocity Flow Org';

let flowOrganizationId = '';

test.describe.serial('Champion Velocity full flow', () => {
  test.beforeAll(async () => {
    await ensureUserWithRole({
      email: FLOW_EMAIL,
      password: FLOW_PASSWORD,
      name: 'E2E Champion Velocity Flow User',
      role: 'admin',
    });

    flowOrganizationId = await ensureOrganizationMembership({
      userEmail: FLOW_EMAIL,
      role: 'admin',
      orgSlug: FLOW_ORG_SLUG,
      orgName: FLOW_ORG_NAME,
    });
  });

  test('covers organization-scoped chat flow', async ({ page }) => {
    const conversations: Array<Record<string, unknown>> = [];
    const messagesByConversation = new Map<string, Array<Record<string, unknown>>>();

    await page.route('**/api/chat/conversations/*/messages/stream', async (route) => {
      const url = new URL(route.request().url());
      const conversationId = url.pathname.split('/')[4];
      const body = route.request().postDataJSON() as { content: string };
      const now = '2026-04-03T00:05:00.000Z';

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
        content: '## Answer\n\nDeployments run through the CI workflow.\n\n### Key Findings\n- CI validates and deploys the app.\n\n### Sources\n- [Deploy Guide](https://example.com/deploy-guide) · github',
        metadata: {
          generator: 'langchain-openai',
          sources: [
            {
              name: 'Deploy Guide',
              webUrl: 'https://example.com/deploy-guide',
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
        `event: chunk\ndata: ${JSON.stringify({ content: '## Answer\n\nDeployments run through the CI workflow.' })}`,
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
      if (!url.pathname.endsWith('/messages')) {
        await route.fallback();
        return;
      }

      if (route.request().method() !== 'GET') {
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
        const organizationId = url.searchParams.get('organizationId');

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: conversations.filter((conversation) => conversation.organizationId === organizationId),
          }),
        });
        return;
      }

      if (request.method() === 'POST') {
        const body = request.postDataJSON() as { organizationId?: string | null };
        const conversation = {
          id: 'conversation-flow-1',
          title: null,
          organizationId: body.organizationId ?? flowOrganizationId,
          userId: FLOW_EMAIL,
          createdAt: '2026-04-03T00:04:00.000Z',
          updatedAt: '2026-04-03T00:04:00.000Z',
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

    await loginWithCredentials(page, FLOW_EMAIL, FLOW_PASSWORD);
    await setActiveOrganizationForUserSessions({
      userEmail: FLOW_EMAIL,
      organizationId: flowOrganizationId,
    });

    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: /new conversation/i })).toBeVisible();
    await expect(page.getByText(/organization-scoped questions/i)).toBeVisible();

    await page.getByPlaceholder(/ask a question about this organization/i).fill('How do deployments work?');
    await page.getByRole('button', { name: /^send$/i }).click();

    await expect(page.getByText(/deployments run through the ci workflow/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('link', { name: /deploy guide/i }).first()).toBeVisible();
  });
});