import { Pool } from 'pg';
import { DATABASE_URL, API_BASE_URL, TEST_USER, ENV_TEST_PATH } from './env';

const TEST_USER_EMAIL = TEST_USER.email;
const TEST_USER_PASSWORD = TEST_USER.password;

async function ensureDefaultRolePermissions(pool: Pool): Promise<void> {
  await pool.query(
    `INSERT INTO role_permissions (role_id, permission_id)
     SELECT r.id, p.id
     FROM roles r
     CROSS JOIN permissions p
     WHERE r.name = 'admin'
     ON CONFLICT DO NOTHING`,
  );

  const managerPermissions = [
    ['user', 'read'],
    ['user', 'update'],
    ['user', 'ban'],
    ['session', 'read'],
    ['session', 'revoke'],
    ['organization', 'read'],
    ['organization', 'invite'],
    ['role', 'read'],
    ['role', 'assign'],
    ['role', 'update'],
  ] as const;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Clear existing manager permissions to ensure clean state
    await client.query(
      `DELETE FROM role_permissions
       WHERE role_id = (SELECT id FROM roles WHERE name = 'manager')`,
    );

    for (const [resource, action] of managerPermissions) {
      await client.query(
        `INSERT INTO role_permissions (role_id, permission_id)
         SELECT r.id, p.id
         FROM roles r
         JOIN permissions p ON p.resource = $2 AND p.action = $3
         WHERE r.name = $1`,
        ['manager', resource, action],
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  const memberPermissions = [
    ['user', 'read'],
    ['organization', 'read'],
    ['role', 'read'],
  ] as const;

  for (const [resource, action] of memberPermissions) {
    await pool.query(
      `INSERT INTO role_permissions (role_id, permission_id)
       SELECT r.id, p.id
       FROM roles r
       JOIN permissions p ON p.resource = $2 AND p.action = $3
       WHERE r.name = $1
       ON CONFLICT DO NOTHING`,
      ['member', resource, action],
    );
  }
}

/**
 * Global setup for Playwright tests.
 * Creates test user if not exists, sets as admin, and clears sessions.
 */
async function globalSetup() {
  const databaseUrl = DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      `E2E setup failed: DATABASE_URL is missing. Set E2E_DATABASE_URL or provide DATABASE_URL in ${ENV_TEST_PATH}.`,
    );
  }
  
  const pool = new Pool({
    connectionString: databaseUrl,
  });

  try {
    // Check if test user exists
    const existingUser = await pool.query(
      `SELECT id FROM "user" WHERE email = $1`,
      [TEST_USER_EMAIL]
    );

    if (existingUser.rowCount === 0) {
      // Create test user via Better Auth API
      console.log('📝 Creating test user via API...');
      const response = await fetch(`${API_BASE_URL}/api/auth/sign-up/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: TEST_USER_EMAIL,
          password: TEST_USER_PASSWORD,
          name: 'Test User',
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        // Some providers may fail after user creation (e.g. email quota) or race on duplicate keys.
        // Re-check DB presence and proceed if the user now exists.
        const postCreateCheck = await pool.query(
          `SELECT id FROM "user" WHERE email = $1`,
          [TEST_USER_EMAIL],
        );

        if (postCreateCheck.rowCount === 0) {
          throw new Error(
            `Failed to create test user via ${API_BASE_URL}/api/auth/sign-up/email: ${JSON.stringify(error)}`,
          );
        }

        console.warn('⚠️ Sign-up API returned non-OK, but test user exists in DB. Continuing setup.');
      } else {
        console.log('✅ Test user created successfully');
      }
    }

    // Set test user as admin with verified email
    const result = await pool.query(
      `UPDATE "user" SET role = 'admin', "emailVerified" = true WHERE email = $1 RETURNING id, email, role`,
      [TEST_USER_EMAIL]
    );

    if (result.rowCount === 0) {
      console.log('⚠️ Test user not found after creation attempt.');
    } else {
      const userId = result.rows[0].id;
      console.log(`✅ Set ${result.rows[0].email} as admin (id: ${userId})`);
      
      // Clear all sessions for this user to force fresh login with new role
      const sessionsResult = await pool.query(
        `DELETE FROM session WHERE "userId" = $1`,
        [userId]
      );
      console.log(`✅ Cleared ${sessionsResult.rowCount} existing sessions`);
    }

    await ensureDefaultRolePermissions(pool);
    console.log('✅ Ensured default role_permissions for admin/manager/member');
  } catch (error) {
    console.error('❌ Failed to set up test user:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

export default globalSetup;
