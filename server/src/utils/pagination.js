/**
 * ──────────────────────────────────────────────────────────
 * Pagination Utilities
 * ──────────────────────────────────────────────────────────
 * Shared helpers for consistent pagination across all list
 * endpoints. Defence-in-depth: limits are clamped server-side
 * regardless of what the client sends.
 *
 * Usage:
 *   const { skip, take, page, limit } = parsePagination(req.query);
 *   const [data, total] = await Promise.all([
 *     prisma.model.findMany({ where, skip, take, orderBy }),
 *     prisma.model.count({ where }),
 *   ]);
 *   res.json(paginatedResponse(data, total, page, limit));
 * ──────────────────────────────────────────────────────────
 */

/** Maximum records per page — prevents abuse via large limit values */
const MAX_PAGE_SIZE = 200;

/** Default records per page when not specified */
const DEFAULT_PAGE_SIZE = 50;

/**
 * Parses and clamps pagination parameters from query string.
 *
 * @param {object} query - Express req.query object
 * @param {string|number} [query.page] - Page number (1-based, default 1)
 * @param {string|number} [query.limit] - Records per page (default 50, max 200)
 * @returns {{ skip: number, take: number, page: number, limit: number }}
 */
function parsePagination(query = {}) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(
    Math.max(parseInt(query.limit, 10) || DEFAULT_PAGE_SIZE, 1),
    MAX_PAGE_SIZE,
  );
  return {
    skip: (page - 1) * limit,
    take: limit,
    page,
    limit,
  };
}

/**
 * Builds a standardised paginated response envelope.
 *
 * @param {Array} data - The result rows
 * @param {number} total - Total matching records (from count query)
 * @param {number} page - Current page number
 * @param {number} limit - Records per page
 * @returns {{ data: Array, pagination: { page, limit, total, totalPages } }}
 */
function paginatedResponse(data, total, page, limit) {
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

module.exports = { parsePagination, paginatedResponse, MAX_PAGE_SIZE, DEFAULT_PAGE_SIZE };
