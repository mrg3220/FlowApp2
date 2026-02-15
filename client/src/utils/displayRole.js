/**
 * Maps backend role enum values to user-friendly display names.
 * OWNER → "Sifu" (the term for a Kung Fu school owner/master).
 */
export function displayRole(role) {
  const map = {
    SUPER_ADMIN: 'HQ Admin',
    OWNER: 'Sifu',
    INSTRUCTOR: 'Instructor',
    STUDENT: 'Student',
    EVENT_COORDINATOR: 'Event Coordinator',
    MARKETING: 'Marketing',
    SCHOOL_STAFF: 'School Staff',
  };
  return map[role] || role;
}

export function displayTitle(title) {
  const map = {
    NONE: '',
    LOHAN_CANDIDATE: 'Lohan Candidate',
    LOHAN_CERTIFIED: 'Lohan Certified',
    SIFU_ASSOCIATE: 'Sifu Associate',
    SIFU: 'Sifu',
  };
  return map[title] || '';
}
