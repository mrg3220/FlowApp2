const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const c = require('../controllers/eventController');

router.use(authenticate);

// Events CRUD
router.get('/', c.getEvents);
router.get('/:id', c.getEvent);
router.post('/', authorize('SUPER_ADMIN', 'OWNER', 'EVENT_COORDINATOR'), c.createEvent);
router.put('/:id', authorize('SUPER_ADMIN', 'OWNER', 'EVENT_COORDINATOR'), c.updateEvent);
router.delete('/:id', authorize('SUPER_ADMIN', 'OWNER'), c.deleteEvent);

// Tickets
router.post('/:eventId/tickets', c.purchaseTicket);
router.patch('/tickets/:ticketId/status', authorize('SUPER_ADMIN', 'OWNER', 'EVENT_COORDINATOR'), c.updateTicketStatus);

// Registrations
router.post('/:eventId/register', c.registerForEvent);
router.delete('/registrations/:regId', c.cancelRegistration);

// Tournament entries
router.post('/:eventId/tournament-entries', authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR', 'EVENT_COORDINATOR'), c.addTournamentEntry);
router.put('/tournament-entries/:entryId', authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR', 'EVENT_COORDINATOR'), c.updateTournamentEntry);
router.delete('/tournament-entries/:entryId', authorize('SUPER_ADMIN', 'OWNER', 'EVENT_COORDINATOR'), c.deleteTournamentEntry);

// Medal stats
router.get('/student/:studentId/medals', c.getStudentMedalStats);

module.exports = router;
