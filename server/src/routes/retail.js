const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const c = require('../controllers/retailController');

router.use(authenticate);

// Products
router.get('/products/:schoolId', c.getProducts);
router.post('/products/:schoolId', authorize('SUPER_ADMIN', 'OWNER'), c.createProduct);
router.put('/products/:id', authorize('SUPER_ADMIN', 'OWNER'), c.updateProduct);

// Inventory
router.put('/inventory/:productId', authorize('SUPER_ADMIN', 'OWNER'), c.updateInventory);
router.get('/low-stock/:schoolId', authorize('SUPER_ADMIN', 'OWNER'), c.getLowStock);

// Orders
router.get('/orders/:schoolId', authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'), c.getOrders);
router.post('/orders/:schoolId', c.createOrder);
router.patch('/orders/:id/status', authorize('SUPER_ADMIN', 'OWNER'), c.updateOrderStatus);

module.exports = router;
