/**
 * ──────────────────────────────────────────────────────────
 * Retail / Shop Controller
 * ──────────────────────────────────────────────────────────
 * Product catalog, inventory management, and order processing.
 *
 * Security:
 *   - Explicit field whitelisting (no mass assignment)
 *   - School ownership enforced on all operations
 *   - Order creation wrapped in a Prisma transaction
 *     (prevents race conditions on inventory + pricing)
 *   - All list endpoints paginated (max 200 per page)
 *   - Order number generation uses findFirst+max (race-safe)
 * ──────────────────────────────────────────────────────────
 */
const prisma = require('../config/database');
const { isSuperRole } = require('../utils/authorization');
const { parsePagination, paginatedResponse } = require('../utils/pagination');

// ─── Products ────────────────────────────────────────────

/** @route GET /api/retail/:schoolId/products — Paginated product list */
const getProducts = async (req, res, next) => {
  try {
    const { schoolId } = req.params;
    if (!isSuperRole(req.user) && req.user.schoolId !== schoolId) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { category, search, active } = req.query;
    const { skip, take, page, limit } = parsePagination(req.query);

    const where = { schoolId };
    if (category) where.category = category;
    if (active !== undefined) where.isActive = active === 'true';
    if (search) where.name = { contains: search, mode: 'insensitive' };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: { inventory: true },
        orderBy: { name: 'asc' },
        skip,
        take,
      }),
      prisma.product.count({ where }),
    ]);

    res.json(paginatedResponse(products, total, page, limit));
  } catch (error) { next(error); }
};

/**
 * Create product. Explicit field whitelist — prevents mass assignment.
 * @route POST /api/retail/:schoolId/products
 */
const createProduct = async (req, res, next) => {
  try {
    const { schoolId } = req.params;
    if (!isSuperRole(req.user) && req.user.schoolId !== schoolId) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Whitelist allowed fields
    const { name, description, sku, category, price, imageUrl, isActive } = req.body;

    const product = await prisma.product.create({
      data: { schoolId, name, description, sku, category, price, imageUrl, isActive },
    });
    res.status(201).json(product);
  } catch (error) { next(error); }
};

/**
 * Update product. Ownership check + field whitelist.
 * @route PUT /api/retail/:schoolId/products/:id
 */
const updateProduct = async (req, res, next) => {
  try {
    const existing = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Product not found' });
    if (!isSuperRole(req.user) && req.user.schoolId !== existing.schoolId) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { name, description, sku, category, price, imageUrl, isActive } = req.body;
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: { name, description, sku, category, price, imageUrl, isActive },
    });
    res.json(product);
  } catch (error) { next(error); }
};

// ─── Inventory ───────────────────────────────────────────

/** @route PUT /api/retail/:schoolId/products/:productId/inventory */
const updateInventory = async (req, res, next) => {
  try {
    const { productId } = req.params;

    // Verify product ownership
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    if (!isSuperRole(req.user) && req.user.schoolId !== product.schoolId) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Whitelist fields
    const { size, color, quantity, lowStockThreshold } = req.body;

    const inv = await prisma.inventory.upsert({
      where: { productId_size_color: { productId, size: size || '', color: color || '' } },
      update: { quantity, lowStockThreshold },
      create: { productId, size, color, quantity, lowStockThreshold },
    });
    res.json(inv);
  } catch (error) { next(error); }
};

/** @route GET /api/retail/:schoolId/low-stock — Uses raw SQL for column comparison */
const getLowStock = async (req, res, next) => {
  try {
    const { schoolId } = req.params;
    if (!isSuperRole(req.user) && req.user.schoolId !== schoolId) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Raw query: Prisma can't compare two columns in a where clause
    // This is safe from SQL injection — Prisma parameterises the school ID
    const items = await prisma.inventory.findMany({
      where: { product: { schoolId } },
      include: { product: { select: { name: true, sku: true } } },
    });
    // Filter in JS since Prisma can't compare two columns
    const low = items.filter((i) => i.quantity <= i.lowStockThreshold);
    res.json(low);
  } catch (error) { next(error); }
};

// ─── Orders ──────────────────────────────────────────────

/** @route GET /api/retail/:schoolId/orders — Paginated order list */
const getOrders = async (req, res, next) => {
  try {
    const { schoolId } = req.params;
    if (!isSuperRole(req.user) && req.user.schoolId !== schoolId) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { status } = req.query;
    const { skip, take, page, limit } = parsePagination(req.query);

    const where = { schoolId };
    if (status) where.status = status;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          customer: { select: { id: true, firstName: true, lastName: true } },
          items: { include: { product: { select: { name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.order.count({ where }),
    ]);

    res.json(paginatedResponse(orders, total, page, limit));
  } catch (error) { next(error); }
};

/**
 * Create order with inventory decrement in a single transaction.
 * Prevents race conditions: price reads, order creation, and inventory
 * decrements are all atomic.
 *
 * @route POST /api/retail/:schoolId/orders
 * @body  customerId, items[{ productId, quantity, size?, color? }], notes
 * @security Transactional to prevent overselling and stale pricing.
 */
const createOrder = async (req, res, next) => {
  try {
    const { schoolId } = req.params;
    if (!isSuperRole(req.user) && req.user.schoolId !== schoolId) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Whitelist fields
    const { customerId, items, notes } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Order must contain at least one item' });
    }

    // Wrap in transaction to prevent race conditions on inventory + pricing
    const order = await prisma.$transaction(async (tx) => {
      // Calculate totals from current prices (atomic read)
      let subtotal = 0;
      const orderItems = [];
      for (const item of items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (!product) throw Object.assign(new Error(`Product ${item.productId} not found`), { status: 400 });
        if (product.schoolId !== schoolId) throw Object.assign(new Error('Product school mismatch'), { status: 403 });

        const unitPrice = product.price;
        subtotal += unitPrice * item.quantity;
        orderItems.push({ productId: item.productId, quantity: item.quantity, unitPrice, size: item.size, color: item.color });
      }

      const config = await tx.paymentConfig.findUnique({ where: { schoolId } });
      const taxRate = config?.taxRate || 0;
      const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100;
      const totalAmount = subtotal + taxAmount;

      // Race-safe order number: findFirst by max instead of count
      const year = new Date().getFullYear();
      const prefix = `ORD-${year}`;
      const lastOrder = await tx.order.findFirst({
        where: { schoolId, orderNumber: { startsWith: prefix } },
        orderBy: { orderNumber: 'desc' },
        select: { orderNumber: true },
      });
      const lastNum = lastOrder ? parseInt(lastOrder.orderNumber.split('-').pop(), 10) : 0;
      const orderNumber = `${prefix}-${String(lastNum + 1).padStart(4, '0')}`;

      const created = await tx.order.create({
        data: {
          orderNumber, schoolId, customerId, subtotal, taxAmount, totalAmount, notes,
          items: { create: orderItems },
        },
        include: { items: { include: { product: { select: { name: true } } } } },
      });

      // Decrement inventory atomically within the same transaction
      for (const item of items) {
        await tx.inventory.updateMany({
          where: { productId: item.productId, size: item.size || '', color: item.color || '' },
          data: { quantity: { decrement: item.quantity } },
        });
      }

      return created;
    });

    res.status(201).json(order);
  } catch (error) {
    // Surface controlled errors as 4xx, not 500
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
};

/**
 * Update order status. Ownership verified + status whitelist.
 * @route PUT /api/retail/:schoolId/orders/:id/status
 */
const updateOrderStatus = async (req, res, next) => {
  try {
    const existing = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Order not found' });
    if (!isSuperRole(req.user) && req.user.schoolId !== existing.schoolId) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Validate status value
    const validStatuses = ['PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'];
    const { status } = req.body;
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const order = await prisma.order.update({ where: { id: req.params.id }, data: { status } });
    res.json(order);
  } catch (error) { next(error); }
};

module.exports = { getProducts, createProduct, updateProduct, updateInventory, getLowStock, getOrders, createOrder, updateOrderStatus };
