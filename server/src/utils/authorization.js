/**
 * ──────────────────────────────────────────────────────────
 * Authorization Helpers
 * ──────────────────────────────────────────────────────────
 * Shared utilities for controller-level authorization checks.
 * These supplement the route-level RBAC middleware with
 * resource-level ownership verification (preventing IDOR).
 *
 * Security design:
 *   - SUPER_ADMIN and IT_ADMIN bypass school-scoping checks
 *   - All other roles are restricted to their own school's data
 *   - Explicit deny-by-default: if schoolId is null, deny
 * ──────────────────────────────────────────────────────────
 */

/** Roles that have platform-wide access (bypass school scoping) */
const SUPER_ROLES = ['SUPER_ADMIN', 'IT_ADMIN'];

/**
 * Checks if the authenticated user has a platform-wide super role.
 *
 * @param {object} user - req.user from authenticate middleware
 * @returns {boolean} True if user is SUPER_ADMIN or IT_ADMIN
 */
function isSuperRole(user) {
  return SUPER_ROLES.includes(user?.role);
}

/**
 * Gets the school-scoping `where` clause for queries.
 * Super roles get an empty clause (no restriction);
 * other roles get `{ schoolId: user.schoolId }`.
 *
 * @param {object} user - req.user from authenticate middleware
 * @param {string} [schoolIdField='schoolId'] - The field name in the model
 * @returns {object} Prisma where clause fragment
 *
 * @example
 *   const where = { ...schoolScope(req.user), status: 'ACTIVE' };
 *   const items = await prisma.model.findMany({ where });
 */
function schoolScope(user, schoolIdField = 'schoolId') {
  if (isSuperRole(user)) return {};
  return { [schoolIdField]: user.schoolId };
}

/**
 * Verifies the user has access to a specific resource's school.
 * Returns true if the user is a super role OR belongs to the same school.
 *
 * @param {object} user - req.user from authenticate middleware
 * @param {string|null} resourceSchoolId - The schoolId of the resource
 * @returns {boolean}
 */
function canAccessSchool(user, resourceSchoolId) {
  if (isSuperRole(user)) return true;
  if (!user.schoolId) return false;
  return user.schoolId === resourceSchoolId;
}

module.exports = { SUPER_ROLES, isSuperRole, schoolScope, canAccessSchool };
