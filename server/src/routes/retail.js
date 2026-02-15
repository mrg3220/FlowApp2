const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const c = require('../controllers/retailController');

router.use(authenticate);

// Products
router.get('/products/:schoolId', c.getProducts);
router.post('/products/:schoolId', authorize('SUPER_ADMIN', 'OWNER'), [
  body('name').trim().notEmpty().withMessage('Product name is required'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
], validate, c.createProduct);
router.put('/products/:id', authorize('SUPER_ADMIN', 'OWNER'), c.updateProduct);

// Inventory
router.put('/inventory/:productId', authorize('SUPER_ADMIN', 'OWNER'), [
  body('quantity').isInt({ min: 0 }).withMessage('Quantity must be a non-negative integer'),
], validate, c.updateInventory);
router.get('/low-stock/:schoolId', authorize('SUPER_ADMIN', 'OWNER'), c.getLowStock);

// Orders
router.get('/orders/:schoolId', authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'), c.getOrders);
router.post('/orders/:schoolId', [
  body('items').isArray({ min: 1 }).withMessage('At least one item required'),
  body('items.*.productId').isUUID().withMessage('Valid productId required'),
  body('items.*.quantity').isInt({ min: 1, max: 100 }).withMessage('Quantity must be 1-100'),
], validate, c.createOrder);
router.patch('/orders/:id/status', authorize('SUPER_ADMIN', 'OWNER'), c.updateOrderStatus);

module.exports = router;
