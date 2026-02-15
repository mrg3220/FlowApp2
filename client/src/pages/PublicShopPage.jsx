import { useState, useEffect } from 'react';
import { publicApi } from '../api/client';

export default function PublicShopPage() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [filter, setFilter] = useState('');
  const [categories, setCategories] = useState([]);
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutForm, setCheckoutForm] = useState({ guestName: '', guestEmail: '', guestPhone: '' });
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { loadProducts(); }, [filter]);

  const loadProducts = async () => {
    try {
      const params = {};
      if (filter) params.category = filter;
      const prods = await publicApi.getProducts(params);
      setProducts(prods);
      const cats = [...new Set(prods.map((p) => p.category).filter(Boolean))];
      setCategories(cats);
    } catch (e) { setError(e.message); }
  };

  const addToCart = (product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) return prev.map((i) => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { productId: product.id, name: product.name, price: product.price, quantity: 1, imageUrl: product.imageUrl }];
    });
  };

  const updateQuantity = (productId, qty) => {
    if (qty < 1) {
      setCart((prev) => prev.filter((i) => i.productId !== productId));
    } else {
      setCart((prev) => prev.map((i) => i.productId === productId ? { ...i, quantity: qty } : i));
    }
  };

  const cartTotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);

  const handleCheckout = async () => {
    try {
      setError('');
      const items = cart.map((i) => ({ productId: i.productId, quantity: i.quantity }));
      await publicApi.createOrder({ ...checkoutForm, items });
      setSuccess('Order placed successfully! Check your email for confirmation.');
      setCart([]); setShowCheckout(false);
      setCheckoutForm({ guestName: '', guestEmail: '', guestPhone: '' });
    } catch (e) { setError(e.message); }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2.5rem', margin: 0 }}>🛍️ Official Merchandise</h1>
        <p style={{ color: '#666', fontSize: '1.1rem' }}>Gear, Apparel & Equipment</p>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div style={{ padding: '1rem', background: '#d4edda', border: '1px solid #c3e6cb', borderRadius: '8px', color: '#155724', marginBottom: '1rem', textAlign: 'center' }}>{success}</div>}

      {/* Category Filters */}
      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <button className={`btn btn-sm ${!filter ? '' : 'btn-outline'}`} onClick={() => setFilter('')}>All</button>
        {categories.map((c) => <button key={c} className={`btn btn-sm ${filter === c ? '' : 'btn-outline'}`} onClick={() => setFilter(c)}>{c}</button>)}
      </div>

      <div style={{ display: 'flex', gap: '2rem', flexDirection: window.innerWidth < 768 ? 'column' : 'row' }}>
        {/* Products Grid */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1.5rem' }}>
            {products.map((p) => (
              <div key={p.id} className="card" style={{ textAlign: 'center' }}>
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt={p.name} style={{ width: '100%', height: '180px', objectFit: 'cover', borderRadius: '8px', marginBottom: '0.75rem' }} />
                ) : (
                  <div style={{ width: '100%', height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0f0f0', borderRadius: '8px', marginBottom: '0.75rem', fontSize: '3rem' }}>🥋</div>
                )}
                {p.category && <span className="badge" style={{ marginBottom: '0.25rem' }}>{p.category}</span>}
                {p.isOrgWide && <span className="badge badge-primary" style={{ marginLeft: '0.25rem' }}>Official</span>}
                <h3 style={{ margin: '0.25rem 0' }}>{p.name}</h3>
                {p.description && <p style={{ color: '#666', fontSize: '0.85rem', margin: '0.25rem 0' }}>{p.description.substring(0, 80)}{p.description.length > 80 ? '...' : ''}</p>}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem' }}>
                  <span style={{ fontWeight: 700, fontSize: '1.2rem', color: 'var(--primary)' }}>${p.price.toFixed(2)}</span>
                  <button className="btn btn-sm" onClick={() => addToCart(p)}>Add to Cart</button>
                </div>
              </div>
            ))}
          </div>
          {products.length === 0 && <p style={{ textAlign: 'center', color: '#888', marginTop: '2rem' }}>No products available</p>}
        </div>

        {/* Cart */}
        <div style={{ minWidth: '300px' }}>
          <div className="card" style={{ position: 'sticky', top: '1rem' }}>
            <h3>🛒 Cart ({cart.reduce((s, i) => s + i.quantity, 0)})</h3>
            {cart.length === 0 ? (
              <p style={{ color: '#888', textAlign: 'center' }}>Your cart is empty</p>
            ) : (
              <>
                {cart.map((item) => (
                  <div key={item.productId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid #eee' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{item.name}</div>
                      <div style={{ color: '#666', fontSize: '0.85rem' }}>${item.price.toFixed(2)} each</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <button onClick={() => updateQuantity(item.productId, item.quantity - 1)} style={{ width: '28px', height: '28px', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer', background: '#fff' }}>-</button>
                      <span style={{ minWidth: '30px', textAlign: 'center' }}>{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.productId, item.quantity + 1)} style={{ width: '28px', height: '28px', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer', background: '#fff' }}>+</button>
                    </div>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', fontWeight: 700, fontSize: '1.1rem' }}>
                  <span>Total:</span><span>${cartTotal.toFixed(2)}</span>
                </div>
                {!showCheckout ? (
                  <button className="btn" style={{ width: '100%', marginTop: '1rem' }} onClick={() => setShowCheckout(true)}>Checkout</button>
                ) : (
                  <div style={{ marginTop: '1rem' }}>
                    <div className="form-group"><label>Name *</label><input value={checkoutForm.guestName} onChange={(e) => setCheckoutForm({ ...checkoutForm, guestName: e.target.value })} /></div>
                    <div className="form-group"><label>Email *</label><input type="email" value={checkoutForm.guestEmail} onChange={(e) => setCheckoutForm({ ...checkoutForm, guestEmail: e.target.value })} /></div>
                    <div className="form-group"><label>Phone</label><input value={checkoutForm.guestPhone} onChange={(e) => setCheckoutForm({ ...checkoutForm, guestPhone: e.target.value })} /></div>
                    <button className="btn" style={{ width: '100%' }} onClick={handleCheckout} disabled={!checkoutForm.guestName || !checkoutForm.guestEmail}>Place Order</button>
                    <button className="btn btn-outline" style={{ width: '100%', marginTop: '0.5rem' }} onClick={() => setShowCheckout(false)}>Cancel</button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
