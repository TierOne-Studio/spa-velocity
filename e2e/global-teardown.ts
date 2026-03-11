import { Pool } from 'pg';
import { DATABASE_URL, TEST_USER, ENV_TEST_PATH } from './env';

const TEST_USER_EMAIL = TEST_USER.email;

/**
 * Global teardown for Playwright tests.
 * Deletes test user and related data after all tests complete.
 */
async function globalTeardown() {
  const databaseUrl = DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      `E2E teardown failed: DATABASE_URL is missing. Set E2E_DATABASE_URL or provide DATABASE_URL in ${ENV_TEST_PATH}.`,
    );
  }
  
  const pool = new Pool({
    connectionString: databaseUrl,
  });

  try {
    const userResult = await pool.query<{ id: string }>(
      `SELECT id
       FROM "user"
       WHERE email = $1
          OR email LIKE $2`,
      [TEST_USER_EMAIL, 'delivered+e2e-%@resend.dev']
    );

    if (userResult.rowCount === 0) {
      console.log('ℹ️ E2E users not found, nothing to clean up');
      return;
    }

    const userIds = userResult.rows.map((row) => row.id);

    await pool.query(`DELETE FROM session WHERE "userId" = ANY($1::text[])`, [userIds]);
    await pool.query(`DELETE FROM member WHERE "userId" = ANY($1::text[])`, [userIds]);
    await pool.query(`DELETE FROM account WHERE "userId" = ANY($1::text[])`, [userIds]);
    await pool.query(`DELETE FROM "user" WHERE id = ANY($1::text[])`, [userIds]);

    console.log(`🧹 Cleaned up ${userIds.length} E2E user(s) including ${TEST_USER_EMAIL}`);
  } catch (error) {
    console.error('❌ Failed to clean up test user:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

export default globalTeardown;
