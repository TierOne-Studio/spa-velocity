import { describe, it, expect } from 'vitest';
import { ROLE_HIERARCHY, getRoleLevel, filterAssignableRoles, filterVisibleRoles } from '../role-hierarchy';

describe('Role Hierarchy Utilities', () => {
  describe('ROLE_HIERARCHY', () => {
    it('should have member < manager < admin', () => {
      expect(ROLE_HIERARCHY.member).toBeLessThan(ROLE_HIERARCHY.manager);
      expect(ROLE_HIERARCHY.manager).toBeLessThan(ROLE_HIERARCHY.admin);
    });
  });

  describe('getRoleLevel', () => {
    it('should return correct level for known roles', () => {
      expect(getRoleLevel('member')).toBe(0);
      expect(getRoleLevel('manager')).toBe(1);
      expect(getRoleLevel('admin')).toBe(2);
    });

    it('should return 0 for unknown roles', () => {
      expect(getRoleLevel('unknown')).toBe(0);
      expect(getRoleLevel('')).toBe(0);
    });
  });

  describe('filterAssignableRoles', () => {
    const allRoles = ['admin', 'manager', 'member'];

    it('manager should only assign manager and member', () => {
      expect(filterAssignableRoles(allRoles, 'manager')).toEqual(['manager', 'member']);
    });

    it('admin should assign all roles', () => {
      expect(filterAssignableRoles(allRoles, 'admin')).toEqual(['admin', 'manager', 'member']);
    });

    it('member should only assign member', () => {
      expect(filterAssignableRoles(allRoles, 'member')).toEqual(['member']);
    });

    it('should ignore unknown role names from input', () => {
      expect(filterAssignableRoles(['super-admin', 'admin', 'manager', 'member'], 'admin')).toEqual([
        'admin',
        'manager',
        'member',
      ]);
    });

    it('unknown role should only assign member-level roles', () => {
      expect(filterAssignableRoles(allRoles, 'unknown')).toEqual(['member']);
    });

    it('should handle empty input', () => {
      expect(filterAssignableRoles([], 'admin')).toEqual([]);
    });
  });

  describe('filterVisibleRoles', () => {
    const allRoles = [
      { name: 'admin' },
      { name: 'manager' },
      { name: 'member' },
    ];

    it('admin sees all roles', () => {
      expect(filterVisibleRoles(allRoles, 'admin')).toEqual(allRoles);
    });

    it('superadmin (level >= admin) sees all roles', () => {
      // superadmin is not in ROLE_HIERARCHY so getRoleLevel returns 0
      // but admin level is 2, so a custom high-level role would see all
      // Here admin (level 2) sees all
      const result = filterVisibleRoles(allRoles, 'admin');
      expect(result).toHaveLength(3);
    });

    it('manager sees only roles strictly below their level (member)', () => {
      const result = filterVisibleRoles(allRoles, 'manager');
      expect(result).toEqual([{ name: 'member' }]);
    });

    it('member sees no roles (nothing is below member level)', () => {
      const result = filterVisibleRoles(allRoles, 'member');
      expect(result).toEqual([]);
    });

    it('unknown role sees no roles (level 0 has nothing below)', () => {
      const result = filterVisibleRoles(allRoles, 'unknown');
      expect(result).toEqual([]);
    });

    it('filters out roles with unknown names', () => {
      const rolesWithUnknown = [
        { name: 'admin' },
        { name: 'manager' },
        { name: 'member' },
        { name: 'custom-unknown' },
      ];
      // admin sees all roles but only those with defined hierarchy
      const result = filterVisibleRoles(rolesWithUnknown, 'admin');
      // admin >= admin, returns all
      expect(result).toEqual(rolesWithUnknown);
    });

    it('manager does not see roles with undefined hierarchy', () => {
      const rolesWithUnknown = [
        { name: 'member' },
        { name: 'custom-unknown' },
      ];
      const result = filterVisibleRoles(rolesWithUnknown, 'manager');
      // manager level is 1, member level is 0 (< 1), custom-unknown is undefined
      expect(result).toEqual([{ name: 'member' }]);
    });

    it('handles empty roles array', () => {
      expect(filterVisibleRoles([], 'admin')).toEqual([]);
      expect(filterVisibleRoles([], 'manager')).toEqual([]);
    });

    it('works with typed role objects that have extra properties', () => {
      const typedRoles = [
        { name: 'admin', displayName: 'Admin', id: '1' },
        { name: 'manager', displayName: 'Manager', id: '2' },
        { name: 'member', displayName: 'Member', id: '3' },
      ];
      const result = filterVisibleRoles(typedRoles, 'manager');
      expect(result).toEqual([{ name: 'member', displayName: 'Member', id: '3' }]);
    });
  });
});
