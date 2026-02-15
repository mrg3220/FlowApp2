const prisma = require('../config/database');

// ─── Products ────────────────────────────────────────────

const getProducts = async (req, res, next) => {
  try {
    const { schoolId } = req.params;
    const { category, search, active } = req.query;
    const where = { schoolId };
    if (category) where.category = category;
    if (active !== undefined) where.isActive = active === 'true';
    if (search) where.name = { contains: search, mode: 'insensitive' };

    const products = await prisma.product.findMany({
      where,
      include: { inventory: true },
      orderBy: { name: 'asc' },
    });
    res.json(products);
  } catch (error) { next(error); }
};

const createProduct = async (req, res, next) => {
  try {
    const product = await prisma.product.create({
      data: { schoolId: req.params.schoolId, ...req.body },
    });
    res.status(201).json(product);
  } catch (error) { next(error); }
};

const updateProduct = async (req, res, next) => {
  try {
    const product = await prisma.product.update({ where: { id: req.params.id }, data: req.body });
    res.json(product);
  } catch (error) { next(error); }
};

// ─── Inventory ───────────────────────────────────────────

const updateInventory = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { size, color, quantity, lowStockThreshold } = req.body;

    const inv = await prisma.inventory.upsert({
      where: { productId_size_color: { productId, size: size || '', color: color || '' } },
      update: { quantity, lowStockThreshold },
      create: { productId, size, color, quantity, lowStockThreshold },
    });
    res.json(inv);
  } catch (error) { next(error); }
};

const getLowStock = async (req, res, next) => {
  try {
    const { schoolId } = req.params;
    const items = await prisma.inventory.findMany({
      where: {
        product: { schoolId },
        quantity: { lte: prisma.inventory.fields ? 5 : 5 },
      },
      include: { product: { select: { name: true, sku: true } } },
    });
    // Filter in JS since Prisma can't compare two columns
    const low = items.filter((i) => i.quantity <= i.lowStockThreshold);
    res.json(low);
  } catch (error) { next(error); }
};

// ─── Orders ──────────────────────────────────────────────

const getOrders = async (req, res, next) => {
  try {
    const { schoolId } = req.params;
    const { status } = req.query;
    const where = { schoolId };
    if (status) where.status = status;

    const orders = await prisma.order.findMany({
      where,
      include: {
        customer: { select: { id: true, firstName: true, lastName: true } },
        items: { include: { product: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(orders);
  } catch (error) { next(error); }
};

const createOrder = async (req, res, next) => {
  try {
    const { schoolId } = req.params;
    const { customerId, items, notes } = req.body;

    // Calculate totals
    let subtotal = 0;
    const orderItems = [];
    for (const item of items) {
      const product = await prisma.product.findUnique({ where: { id: item.productId } });
      if (!product) return res.status(400).json({ error: `Product ${item.productId} not found` });
      const unitPrice = product.price;
      subtotal += unitPrice * item.quantity;
      orderItems.push({ productId: item.productId, quantity: item.quantity, unitPrice, size: item.size, color: item.color });
    }

    const config = await prisma.paymentConfig.findUnique({ where: { schoolId } });
    const taxRate = config?.taxRate || 0;
    const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100;
    const totalAmount = subtotal + taxAmount;

    const count = await prisma.order.count({ where: { schoolId } });
    const orderNumber = `ORD-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    const order = await prisma.order.create({
      data: {
        orderNumber, schoolId, customerId, subtotal, taxAmount, totalAmount, notes,
        items: { create: orderItems },
      },
      include: { items: { include: { product: { select: { name: true } } } } },
    });

    // Decrease inventory
    for (const item of items) {
      await prisma.inventory.updateMany({
        where: { productId: item.productId, size: item.size || '', color: item.color || '' },
        data: { quantity: { decrement: item.quantity } },
      });
    }

    res.status(201).json(order);
  } catch (error) { next(error); }
};

const updateOrderStatus = async (req, res, next) => {
  try {
    const order = await prisma.order.update({ where: { id: req.params.id }, data: { status: req.body.status } });
    res.json(order);
  } catch (error) { next(error); }
};

module.exports = { getProducts, createProduct, updateProduct, updateInventory, getLowStock, getOrders, createOrder, updateOrderStatus };
