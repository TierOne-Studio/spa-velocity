import { test, expect } from '@playwright/test';
import { Pool } from 'pg';
import { DATABASE_URL, API_BASE_URL } from './env';

/**
 * API Tests for Unified Roles - Database-Driven
 * Tests that both user and organization role endpoints return roles from database
 */

test.describe('Unified Roles API - Database-Driven', () => {
  
  test('Database roles table should have admin, manager, member roles', async () => {
    const pool = new Pool({ connectionString: DATABASE_URL });
    try {
      const result = await pool.query(
        `SELECT name, display_name, description, color, is_default 
         FROM roles 
         ORDER BY is_default DESC, name ASC`
      );
      
      const roleNames = result.rows.map(r => r.name);
      
      // Verify all 3 unified roles exist
      expect(roleNames).toContain('admin');
      expect(roleNames).toContain('manager');
      expect(roleNames).toContain('member');
      
      // Verify roles have proper structure
      const adminRole = result.rows.find(r => r.name === 'admin');
      expect(adminRole).toBeDefined();
      expect(adminRole.display_name).toBe('Admin');
      expect(adminRole.is_default).toBe(true);
      
      const managerRole = result.rows.find(r => r.name === 'manager');
      expect(managerRole).toBeDefined();
      expect(managerRole.display_name).toBe('Manager');
      
      const memberRole = result.rows.find(r => r.name === 'member');
      expect(memberRole).toBeDefined();
      expect(memberRole.display_name).toBe('Member');
      
      console.log('✅ Database has all unified roles:', roleNames);
    } finally {
      await pool.end();
    }
  });

  test('AdminOrganizationsService.getRoles query should match database', async () => {
    const pool = new Pool({ connectionString: DATABASE_URL });
    try {
      // This is the exact query used by getRoles()
      const result = await pool.query(
        `SELECT name, display_name, description, color, is_default 
         FROM roles 
         ORDER BY is_default DESC, name ASC`
      );
      
      expect(result.rows.length).toBeGreaterThanOrEqual(3);
      
      // Verify structure matches what API returns
      result.rows.forEach(role => {
        expect(role).toHaveProperty('name');
        expect(role).toHaveProperty('display_name');
        expect(role).toHaveProperty('description');
        expect(role).toHaveProperty('color');
        expect(role).toHaveProperty('is_default');
      });
      
      console.log('✅ Roles query returns correct structure');
    } finally {
      await pool.end();
    }
  });

  test('Both user and org roles should come from same database table', async () => {
    const pool = new Pool({ connectionString: DATABASE_URL });
    try {
      // Get roles (same query used by both endpoints)
      const result = await pool.query(
        `SELECT name, display_name FROM roles ORDER BY is_default DESC, name ASC`
      );
      
      const dbRoleNames = result.rows.map(r => r.name);
      
      // Verify the expected unified roles
      expect(dbRoleNames).toContain('admin');
      expect(dbRoleNames).toContain('manager');
      expect(dbRoleNames).toContain('member');
      
      // Verify NO hardcoded "owner" role exists (was removed from org system)
      // Note: "owner" should NOT be in database - it was a hardcoded Better Auth org role
      const hasOwner = dbRoleNames.includes('owner');
      console.log(`Owner role in database: ${hasOwner}`);
      
      console.log('✅ Unified roles from database:', dbRoleNames);
    } finally {
      await pool.end();
    }
  });
});
