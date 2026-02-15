const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const c = require('../controllers/venueController');

router.use(authenticate);

router.get('/', c.getVenues);
router.get('/:id', c.getVenue);
router.post('/', authorize('SUPER_ADMIN', 'OWNER', 'EVENT_COORDINATOR'), c.createVenue);
router.put('/:id', authorize('SUPER_ADMIN', 'OWNER', 'EVENT_COORDINATOR'), c.updateVenue);
router.delete('/:id', authorize('SUPER_ADMIN', 'OWNER'), c.deleteVenue);

module.exports = router;
