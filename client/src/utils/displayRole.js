/**
 * Maps backend role enum values to user-friendly display names.
 * OWNER → "Sifu" (the term for a Kung Fu school owner/master).
 */
export function displayRole(role) {
  const map = {
    SUPER_ADMIN: 'Super Admin',
    OWNER: 'Sifu',
    INSTRUCTOR: 'Instructor',
    STUDENT: 'Student',
  };
  return map[role] || role;
}
