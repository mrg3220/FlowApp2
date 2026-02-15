const express = require('express');
const router = express.Router();
const c = require('../controllers/publicController');

// No authentication required for public routes

// Public events
router.get('/events', c.getPublicEvents);
router.get('/events/:id', c.getPublicEvent);
router.post('/events/tickets', c.purchaseGuestTicket);

// Public shop
router.get('/shop', c.getPublicProducts);
router.post('/shop/orders', c.createGuestOrder);

// Public schools
router.get('/schools', c.getPublicSchools);

module.exports = router;
