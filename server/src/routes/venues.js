const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const c = require('../controllers/venueController');

// ─── Validation schemas ──────────────────────────────────
const venueRules = [
  body('name').trim().notEmpty().withMessage('name is required').isLength({ max: 200 }),
  body('address').optional().trim().isLength({ max: 500 }),
  body('capacity').optional().isInt({ min: 1, max: 100000 }).toInt(),
];

router.use(authenticate);

router.get('/', c.getVenues);
router.get('/:id', c.getVenue);
router.post('/', authorize('SUPER_ADMIN', 'OWNER', 'EVENT_COORDINATOR'), venueRules, validate, c.createVenue);
router.put('/:id', authorize('SUPER_ADMIN', 'OWNER', 'EVENT_COORDINATOR'), venueRules, validate, c.updateVenue);
router.delete('/:id', authorize('SUPER_ADMIN', 'OWNER'), c.deleteVenue);

module.exports = router;
