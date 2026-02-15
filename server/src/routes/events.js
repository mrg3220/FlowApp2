const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const c = require('../controllers/eventController');

router.use(authenticate);

// Events CRUD
router.get('/', c.getEvents);
router.get('/:id', c.getEvent);
router.post('/', authorize('SUPER_ADMIN', 'OWNER', 'EVENT_COORDINATOR'), [
  body('name').trim().notEmpty().withMessage('Event name is required'),
  body('eventType').notEmpty().withMessage('Event type is required'),
  body('startDate').isISO8601().withMessage('Valid start date required'),
  body('schoolId').optional().isUUID(),
], validate, c.createEvent);
router.put('/:id', authorize('SUPER_ADMIN', 'OWNER', 'EVENT_COORDINATOR'), c.updateEvent);
router.delete('/:id', authorize('SUPER_ADMIN', 'OWNER'), c.deleteEvent);

// Tickets
router.post('/:eventId/tickets', [
  body('quantity').optional().isInt({ min: 1, max: 20 }).withMessage('Quantity must be 1-20'),
], validate, c.purchaseTicket);
router.patch('/tickets/:ticketId/status', authorize('SUPER_ADMIN', 'OWNER', 'EVENT_COORDINATOR'), [
  body('status').isIn(['RESERVED', 'PAID', 'CHECKED_IN', 'CANCELLED', 'REFUNDED']).withMessage('Invalid ticket status'),
], validate, c.updateTicketStatus);

// Registrations
router.post('/:eventId/register', c.registerForEvent);
router.delete('/registrations/:regId', c.cancelRegistration);

// Tournament entries
router.post('/:eventId/tournament-entries', authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR', 'EVENT_COORDINATOR'), [
  body('userId').isUUID().withMessage('Valid userId required'),
  body('division').trim().notEmpty().withMessage('Division is required'),
], validate, c.addTournamentEntry);
router.put('/tournament-entries/:entryId', authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR', 'EVENT_COORDINATOR'), c.updateTournamentEntry);
router.delete('/tournament-entries/:entryId', authorize('SUPER_ADMIN', 'OWNER', 'EVENT_COORDINATOR'), c.deleteTournamentEntry);

// Medal stats
router.get('/student/:studentId/medals', c.getStudentMedalStats);

module.exports = router;
