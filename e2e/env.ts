import { existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { DEFAULT_E2E_TEST_USER_EMAIL } from '../src/shared/utils/resendTestEmail';

/**
 * Shared E2E environment configuration.
 *
 * Reads values from the backend's .env.test so that every E2E spec,
 * global-setup, and global-teardown use the same test credentials and
 * database without hard-coding them.
 *
 * IMPORTANT: The .env.test file is the single source of truth for the test
 * database URL. Ambient environment variables (e.g. DATABASE_URL from a shell
 * profile) are intentionally ignored to prevent tests from accidentally
 * running against the development database.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function parseEnvFile(filePath: string): Record<string, string> {
  const content = readFileSync(filePath, 'utf-8');
  const env: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    env[key] = value;
  }
  return env;
}

function resolveBackendProjectRoot(): string {
  const candidates = [
    process.env.E2E_BACKEND_PROJECT_ROOT,
    resolve(__dirname, '../../api-velocity'),
    resolve(__dirname, '../../api-ampliri'),
    resolve(__dirname, '../../nestjs-api-starter'),
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return resolve(__dirname, '../../api-velocity');
}

function resolveBackendEnvFile(backendProjectRoot: string): string {
  const candidates = [
    process.env.E2E_BACKEND_ENV_FILE,
    resolve(backendProjectRoot, '.env.test'),
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `E2E env resolution failed: could not find .env.test in ${backendProjectRoot}. ` +
    `Create the file or set E2E_BACKEND_ENV_FILE to point to your test env file.`,
  );
}

/**
 * Validate that a database URL points to a test database, not a development/production one.
 * Throws if the URL looks like it targets a non-test database.
 */
function assertTestDatabaseUrl(url: string, source: string): void {
  const dbName = url.split('/').pop()?.split('?')[0] || '';
  if (!dbName.includes('test')) {
    throw new Error(
      `E2E safety check failed: DATABASE_URL from ${source} points to database "${dbName}" ` +
      `which does not contain "test" in its name. Refusing to run E2E tests against a ` +
      `non-test database to prevent data loss. ` +
      `Expected a database name containing "test" (e.g. nestjs-api-starter-test).`,
    );
  }
}

const backendProjectRoot = resolveBackendProjectRoot();
const envTestPath = resolveBackendEnvFile(backendProjectRoot);
const envVars = parseEnvFile(envTestPath);

export const BACKEND_PROJECT_ROOT = backendProjectRoot;

/** Absolute path to .env.test — used by playwright.config.ts to tell the backend which env file to load */
export const ENV_TEST_PATH = envTestPath;

/** All raw key-value pairs from .env.test (useful for passing to webServer env) */
export const ENV_VARS = envVars;

/**
 * PostgreSQL connection string for E2E tests.
 *
 * Priority: E2E_DATABASE_URL (explicit override) > .env.test value.
 * We intentionally do NOT fall back to process.env.DATABASE_URL because that
 * typically contains the development database URL and would break isolation.
 */
export const DATABASE_URL = process.env.E2E_DATABASE_URL || envVars.DATABASE_URL;

// Validate at import time — fail fast before any test infrastructure starts.
if (DATABASE_URL) {
  assertTestDatabaseUrl(DATABASE_URL, process.env.E2E_DATABASE_URL ? 'E2E_DATABASE_URL' : envTestPath);
}

/** Backend base URL (e.g. http://localhost:3000) */
export const API_BASE_URL = process.env.E2E_API_BASE_URL || envVars.BASE_URL || `http://localhost:${envVars.PORT || '3000'}`;

/** Frontend base URL */
export const FE_URL = process.env.E2E_FE_URL || envVars.FE_URL || 'http://localhost:5173';

/** Pre-seeded test user credentials */
export const TEST_USER = {
  email: process.env.E2E_TEST_USER_EMAIL || DEFAULT_E2E_TEST_USER_EMAIL,
  password: process.env.E2E_TEST_USER_PASSWORD || 'password123',
};
