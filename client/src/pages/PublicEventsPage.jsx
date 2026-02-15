import { useState, useEffect } from 'react';
import { publicApi } from '../api/client';

const EVENT_TYPE_ICONS = { TOURNAMENT: '🏆', SEMINAR: '📖', PARTY: '🎉', CEREMONY: '🎓', WORKSHOP: '🔧', OTHER: '📌' };

export default function PublicEventsPage() {
  const [events, setEvents] = useState([]);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState('');
  const [ticketForm, setTicketForm] = useState({ guestName: '', guestEmail: '', guestPhone: '', quantity: 1 });
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { loadEvents(); }, [filter]);

  const loadEvents = async () => {
    try {
      const params = {};
      if (filter) params.eventType = filter;
      setEvents(await publicApi.getEvents(params));
    } catch (e) { setError(e.message); }
  };

  const loadEvent = async (id) => {
    try { setSelected(await publicApi.getEvent(id)); setShowTicketForm(false); setSuccess(''); } catch (e) { setError(e.message); }
  };

  const handlePurchase = async () => {
    try {
      setError('');
      await publicApi.purchaseTicket({ eventId: selected.id, ...ticketForm });
      setSuccess('Ticket purchased successfully! Check your email for confirmation.');
      setShowTicketForm(false);
      setTicketForm({ guestName: '', guestEmail: '', guestPhone: '', quantity: 1 });
    } catch (e) { setError(e.message); }
  };

  // Detail view
  if (selected) {
    return (
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem 1rem' }}>
        <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: '#0d6efd', cursor: 'pointer', fontSize: '1rem', marginBottom: '1rem' }}>← Back to Events</button>

        <div className="card">
          {selected.imageUrl && <img src={selected.imageUrl} alt={selected.name} style={{ width: '100%', maxHeight: '300px', objectFit: 'cover', borderRadius: '8px', marginBottom: '1rem' }} />}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <span className="badge">{selected.eventType}</span>
            {selected.scope === 'HQ' && <span className="badge badge-primary">Organization Event</span>}
          </div>
          <h1 style={{ margin: '0.5rem 0' }}>{EVENT_TYPE_ICONS[selected.eventType]} {selected.name}</h1>
          {selected.description && <p style={{ color: '#555', fontSize: '1.1rem', lineHeight: 1.6 }}>{selected.description}</p>}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', margin: '1.5rem 0', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
            <div>📅 <strong>Date:</strong><br />{new Date(selected.startDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
            {selected.venue && <div>📍 <strong>Venue:</strong><br />{selected.venue.name}{selected.venue.address ? `, ${selected.venue.address}` : ''}{selected.venue.city ? `, ${selected.venue.city}, ${selected.venue.state}` : ''}</div>}
            {selected.school && <div>🏫 <strong>School:</strong><br />{selected.school.name}</div>}
            <div>🎟️ <strong>Price:</strong><br />{selected.ticketPrice > 0 ? `$${selected.ticketPrice}` : 'Free'}</div>
            {selected.maxCapacity && <div>👥 <strong>Capacity:</strong><br />{selected.maxCapacity}</div>}
            {selected.registrationDeadline && <div>⏰ <strong>Register by:</strong><br />{new Date(selected.registrationDeadline).toLocaleDateString()}</div>}
          </div>

          {/* Purchase ticket */}
          {success && <div style={{ padding: '1rem', background: '#d4edda', border: '1px solid #c3e6cb', borderRadius: '8px', color: '#155724', marginBottom: '1rem' }}>{success}</div>}

          {!showTicketForm ? (
            <button className="btn" style={{ fontSize: '1.1rem', padding: '0.75rem 2rem' }} onClick={() => setShowTicketForm(true)}>
              {selected.ticketPrice > 0 ? `Get Tickets ($${selected.ticketPrice})` : 'Register (Free)'}
            </button>
          ) : (
            <div style={{ padding: '1.5rem', border: '2px solid var(--primary)', borderRadius: '8px' }}>
              <h3>Get Your Tickets</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div className="form-group"><label>Name *</label><input value={ticketForm.guestName} onChange={(e) => setTicketForm({ ...ticketForm, guestName: e.target.value })} /></div>
                <div className="form-group"><label>Email *</label><input type="email" value={ticketForm.guestEmail} onChange={(e) => setTicketForm({ ...ticketForm, guestEmail: e.target.value })} /></div>
                <div className="form-group"><label>Phone</label><input value={ticketForm.guestPhone} onChange={(e) => setTicketForm({ ...ticketForm, guestPhone: e.target.value })} /></div>
                <div className="form-group"><label>Quantity</label><input type="number" min="1" value={ticketForm.quantity} onChange={(e) => setTicketForm({ ...ticketForm, quantity: parseInt(e.target.value) || 1 })} /></div>
              </div>
              {selected.ticketPrice > 0 && <p style={{ fontWeight: 600, fontSize: '1.1rem' }}>Total: ${(selected.ticketPrice * ticketForm.quantity).toFixed(2)}</p>}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn" onClick={handlePurchase} disabled={!ticketForm.guestName || !ticketForm.guestEmail}>Confirm</button>
                <button className="btn btn-outline" onClick={() => setShowTicketForm(false)}>Cancel</button>
              </div>
            </div>
          )}
        </div>
        {error && <div className="error-message">{error}</div>}
      </div>
    );
  }

  // List view
  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2.5rem', margin: 0 }}>🎪 Upcoming Events</h1>
        <p style={{ color: '#666', fontSize: '1.1rem' }}>Tournaments, Seminars, Workshops & More</p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <button className={`btn btn-sm ${!filter ? '' : 'btn-outline'}`} onClick={() => setFilter('')}>All</button>
        {Object.entries(EVENT_TYPE_ICONS).map(([type, icon]) => (
          <button key={type} className={`btn btn-sm ${filter === type ? '' : 'btn-outline'}`} onClick={() => setFilter(type)}>{icon} {type}</button>
        ))}
      </div>

      {error && <div className="error-message">{error}</div>}

      {/* Events Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.5rem' }}>
        {events.map((ev) => (
          <div key={ev.id} className="card" style={{ cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }}
            onClick={() => loadEvent(ev.id)}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = ''; }}>
            {ev.imageUrl && <img src={ev.imageUrl} alt={ev.name} style={{ width: '100%', height: '160px', objectFit: 'cover', borderRadius: '8px', marginBottom: '0.75rem' }} />}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <span className="badge">{ev.eventType}</span>
              {ev.scope === 'HQ' && <span className="badge badge-primary">ORG</span>}
            </div>
            <h2 style={{ margin: '0.25rem 0', fontSize: '1.2rem' }}>{EVENT_TYPE_ICONS[ev.eventType]} {ev.name}</h2>
            <p style={{ color: '#666', fontSize: '0.95rem', margin: '0.5rem 0' }}>
              📅 {new Date(ev.startDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </p>
            {ev.venue && <p style={{ color: '#888', fontSize: '0.9rem', margin: '0.25rem 0' }}>📍 {ev.venue.name}{ev.venue.city ? `, ${ev.venue.city}` : ''}</p>}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem' }}>
              <span style={{ fontWeight: 600, fontSize: '1.1rem', color: 'var(--primary)' }}>{ev.ticketPrice > 0 ? `$${ev.ticketPrice}` : 'Free'}</span>
              <span style={{ color: '#888', fontSize: '0.85rem' }}>👥 {ev._count?.registrations || 0} attending</span>
            </div>
          </div>
        ))}
      </div>
      {events.length === 0 && <p style={{ textAlign: 'center', color: '#888', marginTop: '3rem', fontSize: '1.1rem' }}>No upcoming events at this time. Check back soon!</p>}
    </div>
  );
}
