import { test, expect, type Page } from '@playwright/test';
import { TEST_USER } from '../env';
import {
  loginWithCredentials,
  ensureOrganizationMembership,
  setActiveOrganizationForUserSessions,
} from '../test-helpers';
import {
  installAirweaveMocks,
  newCalls,
  type AirweaveMockState,
} from './airweave-helpers';

/**
 * Pins the SPA-side OAuth handoff per ADR-011 § Amendment 2:
 *
 *   Dialog submit → POST create with `{kind:'oauth'}` →
 *   backend returns `{sourceConnection, sessionToken}` →
 *   dialog calls page's `onOAuthSubmit(token)` → dialog closes →
 *   page writes `pendingTokenRef = token` then calls SDK `open()`.
 *
 * The SDK's iframe handshake against connect.airweave.ai is covered by
 * the unit suite (useAirweaveConnectModal.test.tsx). e2e pins the
 * observable contract BEFORE the SDK opens: wire shape, token-carry,
 * dialog-close, and the "no sessionToken" defensive branch.
 */
const ORG_SLUG = 'e2e-airweave-oauth';
const ORG_NAME = 'E2E Airweave OAuth';
const COLLECTION_READABLE_ID = 'e2e-oauth-kb-9999aaaa';

let organizationId: string;

async function loginAsAdmin(page: Page): Promise<void> {
  await loginWithCredentials(page, TEST_USER.email, TEST_USER.password);
  await setActiveOrganizationForUserSessions({
    userEmail: TEST_USER.email,
    organizationId,
  });
}

function freshState(): AirweaveMockState {
  return {
    collections: [
      {
        id: 'col-1',
        name: 'Knowledge Base',
        readableId: COLLECTION_READABLE_ID,
        organizationId,
        createdAt: '',
        updatedAt: '',
        status: 'active',
        sourceConnectionCount: 0,
      },
    ],
    sources: [],
    seq: 20,
  };
}

test.describe('Airweave OAuth — dialog handoff (admin)', () => {
  test.beforeAll(async () => {
    organizationId = await ensureOrganizationMembership({
      userEmail: TEST_USER.email,
      role: 'admin',
      orgSlug: ORG_SLUG,
      orgName: ORG_NAME,
    });
  });

  test('OAuth tab → submit → POST sent with {kind:oauth} → dialog closes (token handed up)', async ({
    page,
  }) => {
    const calls = newCalls();
    await installAirweaveMocks(page, freshState(), calls, {
      nextSessionToken: 'tok-fresh-oauth',
    });

    await loginAsAdmin(page);
    await page.goto(`/admin/airweave/${COLLECTION_READABLE_ID}`);
    await page.getByRole('button', { name: /add source/i }).click();
    const dialog = page.getByRole('dialog');

    // Switch to OAuth tab
    await dialog.getByRole('tab', { name: /^oauth$/i }).click();

    await dialog.getByRole('textbox', { name: 'Name' }).fill('Acme Slack');
    await dialog.getByRole('textbox', { name: /source type/i }).fill('slack');
    await dialog.getByRole('button', { name: /start oauth/i }).click();

    // Wire-shape pin: POST goes out with the OAuth discriminant
    await expect.poll(() => calls.createSource.length).toBe(1);
    expect(calls.createSource[0].body).toMatchObject({
      name: 'Acme Slack',
      shortName: 'slack',
      authentication: { kind: 'oauth' },
    });
    // No `redirectUri` field — ADR-011 Amendment 2 cleanup
    expect(calls.createSource[0].body).not.toHaveProperty('redirectUri');

    // Dialog closes (the SDK iframe takes over from here, mocked away)
    await expect(
      page.getByRole('heading', { name: /add source connection/i }),
    ).toHaveCount(0);
  });

  test('OAuth response missing sessionToken → error toast surfaces + dialog still closes (defensive UX)', async ({
    page,
  }) => {
    const calls = newCalls();
    // null = backend "succeeds" but omits sessionToken (contract violation)
    await installAirweaveMocks(page, freshState(), calls, {
      nextSessionToken: null,
    });

    await loginAsAdmin(page);
    await page.goto(`/admin/airweave/${COLLECTION_READABLE_ID}`);
    await page.getByRole('button', { name: /add source/i }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('tab', { name: /^oauth$/i }).click();

    await dialog.getByRole('textbox', { name: 'Name' }).fill('Slack Without Token');
    await dialog.getByRole('textbox', { name: /source type/i }).fill('slack');
    await dialog.getByRole('button', { name: /start oauth/i }).click();

    // The contract-violation toast surfaces (Sonner renders to a portal)
    await expect(page.getByText(/no OAuth session token/i)).toBeVisible({
      timeout: 5000,
    });

    // Dialog still closes — failure mode #5 from the plan
    await expect(
      page.getByRole('heading', { name: /add source connection/i }),
    ).toHaveCount(0);

    // Backend WAS called (the SPA didn't short-circuit before sending)
    expect(calls.createSource).toHaveLength(1);
  });
});
