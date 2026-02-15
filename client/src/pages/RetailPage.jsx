import { useState, useEffect } from 'react';
import { retailApi, schoolApi } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function RetailPage() {
  const { user } = useAuth();
  const isStaff = user && !['STUDENT'].includes(user.role);
  const [schools, setSchools] = useState([]);
  const [schoolId, setSchoolId] = useState('');
  const [tab, setTab] = useState('PRODUCTS');
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [showProductForm, setShowProductForm] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', sku: '', price: '', category: '', imageUrl: '', isActive: true });
  const [cart, setCart] = useState([]);
  const [showCart, setShowCart] = useState(false);

  useEffect(() => {
    schoolApi.getAll().then((s) => { setSchools(s); if (s.length) setSchoolId(s[0].id); });
  }, []);

  useEffect(() => {
    if (!schoolId) return;
    loadProducts();
    if (isStaff) {
      retailApi.getOrders(schoolId).then(setOrders);
      retailApi.getLowStock(schoolId).then(setLowStock).catch(() => setLowStock([]));
    }
  }, [schoolId]);

  const loadProducts = () => retailApi.getProducts(schoolId).then(setProducts);
  const loadOrders = () => retailApi.getOrders(schoolId).then(setOrders);

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    const data = { ...form, price: Number(form.price) };
    if (editProduct) {
      await retailApi.updateProduct(editProduct.id, data);
    } else {
      await retailApi.createProduct(schoolId, data);
    }
    setShowProductForm(false);
    setEditProduct(null);
    setForm({ name: '', description: '', sku: '', price: '', category: '', imageUrl: '', isActive: true });
    loadProducts();
  };

  const addToCart = (product) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.productId === product.id);
      if (existing) return prev.map((c) => c.productId === product.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { productId: product.id, name: product.name, price: product.price, quantity: 1 }];
    });
    setShowCart(true);
  };

  const removeFromCart = (productId) => setCart((prev) => prev.filter((c) => c.productId !== productId));

  const handleCheckout = async () => {
    if (!cart.length) return;
    const items = cart.map((c) => ({ productId: c.productId, quantity: c.quantity, unitPrice: c.price }));
    await retailApi.createOrder(schoolId, { items });
    setCart([]);
    setShowCart(false);
    loadProducts();
    if (isStaff) loadOrders();
    alert('Order placed!');
  };

  const handleOrderStatus = async (id, status) => {
    await retailApi.updateOrderStatus(id, status);
    loadOrders();
  };

  const fmt = (n) => '$' + Number(n).toFixed(2);

  return (
    <div className="page">
      <h1>🛍️ Shop & Inventory</h1>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={schoolId} onChange={(e) => setSchoolId(e.target.value)} className="form-input" style={{ width: 'auto' }}>
          {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button className={`btn ${tab === 'PRODUCTS' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('PRODUCTS')}>Products</button>
        {isStaff && <button className={`btn ${tab === 'ORDERS' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('ORDERS')}>Orders</button>}
        {isStaff && <button className={`btn ${tab === 'INVENTORY' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('INVENTORY')}>Inventory</button>}
        <button className="btn btn-outline" onClick={() => setShowCart(!showCart)} style={{ position: 'relative' }}>
          🛒 Cart {cart.length > 0 && <span style={{ background: '#ef4444', color: '#fff', borderRadius: '50%', padding: '0 6px', fontSize: '0.75rem', marginLeft: '4px' }}>{cart.reduce((s, c) => s + c.quantity, 0)}</span>}
        </button>
        {isStaff && <button className="btn btn-primary" onClick={() => { setShowProductForm(!showProductForm); setEditProduct(null); setForm({ name: '', description: '', sku: '', price: '', category: '', imageUrl: '', isActive: true }); }}>+ Add Product</button>}
      </div>

      {lowStock.length > 0 && isStaff && (
        <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '8px', padding: '0.75rem', marginBottom: '1rem' }}>
          ⚠️ <strong>Low Stock Alert:</strong> {lowStock.map((p) => p.name).join(', ')}
        </div>
      )}

      {showCart && (
        <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
          <h3>Shopping Cart</h3>
          {cart.length === 0 ? <p style={{ color: '#888' }}>Cart is empty</p> : (
            <>
              {cart.map((c) => (
                <div key={c.productId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid #eee' }}>
                  <span>{c.name} × {c.quantity}</span>
                  <span>{fmt(c.price * c.quantity)} <button className="btn btn-sm btn-outline" style={{ marginLeft: '0.5rem', color: '#ef4444' }} onClick={() => removeFromCart(c.productId)}>✕</button></span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.75rem', fontWeight: 700, fontSize: '1.1rem' }}>
                <span>Total</span><span>{fmt(cart.reduce((s, c) => s + c.price * c.quantity, 0))}</span>
              </div>
              <button className="btn btn-primary" style={{ width: '100%', marginTop: '0.75rem' }} onClick={handleCheckout}>Place Order</button>
            </>
          )}
        </div>
      )}

      {showProductForm && isStaff && (
        <form onSubmit={handleSaveProduct} className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
          <h3>{editProduct ? 'Edit' : 'New'} Product</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <input className="form-input" placeholder="Name *" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className="form-input" placeholder="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
            <input className="form-input" type="number" step="0.01" placeholder="Price *" required value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            <input className="form-input" placeholder="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            <input className="form-input" placeholder="Image URL" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} />
          </div>
          <textarea className="form-input" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={{ marginTop: '0.5rem' }} />
          <label style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Active</label>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button type="submit" className="btn btn-primary">Save</button>
            <button type="button" className="btn btn-outline" onClick={() => setShowProductForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      {tab === 'PRODUCTS' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' }}>
          {products.filter((p) => p.isActive || isStaff).map((p) => (
            <div key={p.id} className="card" style={{ padding: '1rem' }}>
              {p.imageUrl && <img src={p.imageUrl} alt={p.name} style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '6px', marginBottom: '0.5rem' }} />}
              <h3 style={{ margin: '0 0 0.25rem' }}>{p.name}</h3>
              {p.category && <span style={{ fontSize: '0.8rem', background: '#e0e7ff', padding: '0.1rem 0.4rem', borderRadius: '8px', color: '#3730a3' }}>{p.category}</span>}
              <div style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0.5rem 0' }}>{fmt(p.price)}</div>
              <p style={{ fontSize: '0.85rem', color: '#666', margin: '0 0 0.5rem' }}>{p.description?.slice(0, 80)}</p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-primary btn-sm" onClick={() => addToCart(p)}>Add to Cart</button>
                {isStaff && <button className="btn btn-outline btn-sm" onClick={() => { setEditProduct(p); setForm({ name: p.name, description: p.description || '', sku: p.sku || '', price: p.price, category: p.category || '', imageUrl: p.imageUrl || '', isActive: p.isActive }); setShowProductForm(true); }}>Edit</button>}
              </div>
              {!p.isActive && <span style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.25rem' }}>Inactive</span>}
            </div>
          ))}
          {products.length === 0 && <p style={{ color: '#888' }}>No products</p>}
        </div>
      )}

      {tab === 'ORDERS' && isStaff && (
        <table className="data-table">
          <thead><tr><th>Order #</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td><strong>{o.orderNumber}</strong></td>
                <td>{o.user?.firstName} {o.user?.lastName}</td>
                <td>{o.items?.length}</td>
                <td style={{ fontWeight: 600 }}>{fmt(o.totalAmount)}</td>
                <td>
                  <select value={o.status} onChange={(e) => handleOrderStatus(o.id, e.target.value)} style={{ padding: '0.2rem 0.4rem', borderRadius: '4px', border: '1px solid #ccc', fontSize: '0.8rem' }}>
                    {['PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'].map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td>{new Date(o.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
            {orders.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: '#888' }}>No orders</td></tr>}
          </tbody>
        </table>
      )}

      {tab === 'INVENTORY' && isStaff && (
        <table className="data-table">
          <thead><tr><th>Product</th><th>SKU</th><th>Price</th><th>Stock</th><th>Min Stock</th><th>Status</th></tr></thead>
          <tbody>
            {products.map((p) => {
              const inv = p.inventory || [];
              const totalQty = inv.reduce((s, i) => s + i.quantity, 0);
              const minStock = p.minStockLevel || 5;
              return (
                <tr key={p.id}>
                  <td><strong>{p.name}</strong></td>
                  <td>{p.sku || '—'}</td>
                  <td>{fmt(p.price)}</td>
                  <td>{totalQty}</td>
                  <td>{minStock}</td>
                  <td>{totalQty <= minStock ? <span style={{ color: '#ef4444', fontWeight: 600 }}>⚠️ Low</span> : <span style={{ color: '#22c55e' }}>✅ OK</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
