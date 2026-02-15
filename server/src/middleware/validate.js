/**
 * ──────────────────────────────────────────────────────────
 * Express-Validator Error Handler Middleware
 * ──────────────────────────────────────────────────────────
 * Collects validation errors produced by express-validator
 * chains in route definitions and returns a structured 400
 * response. This is the single point where all input
 * validation rejections exit the pipeline.
 *
 * Usage (in route file):
 *   const { body } = require('express-validator');
 *   const validate = require('../middleware/validate');
 *
 *   router.post('/',
 *     body('email').isEmail(),
 *     body('name').trim().notEmpty(),
 *     validate,     // <-- must come AFTER all validator chains
 *     controller.create,
 *   );
 * ──────────────────────────────────────────────────────────
 */
const { validationResult } = require('express-validator');

/**
 * Checks for express-validator errors and returns 400 with
 * structured error details if any validation rules failed.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {void} Calls next() on success, or responds 400
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

module.exports = validate;
