const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const c = require('../controllers/publicController');

// No authentication required for public routes

// Public events
router.get('/events', c.getPublicEvents);
router.get('/events/:id', c.getPublicEvent);
router.post('/events/tickets', [
  body('eventId').isUUID().withMessage('Valid eventId is required'),
  body('guestName').trim().notEmpty().withMessage('Guest name is required'),
  body('guestEmail').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('quantity').optional().isInt({ min: 1, max: 10 }).withMessage('Quantity must be 1-10'),
], validate, c.purchaseGuestTicket);

// Public shop
router.get('/shop', c.getPublicProducts);
router.post('/shop/orders', [
  body('guestName').trim().notEmpty().withMessage('Guest name is required'),
  body('guestEmail').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('items').isArray({ min: 1, max: 50 }).withMessage('Items array required (1-50)'),
  body('items.*.productId').isUUID().withMessage('Valid productId required'),
  body('items.*.quantity').isInt({ min: 1, max: 100 }).withMessage('Quantity must be 1-100'),
], validate, c.createGuestOrder);

// Public schools
router.get('/schools', c.getPublicSchools);

module.exports = router;
