import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { eventApi, venueApi, schoolApi, enrollmentApi } from '../api/client';

const EVENT_TYPES = ['TOURNAMENT', 'SEMINAR', 'PARTY', 'CEREMONY', 'WORKSHOP', 'OTHER'];
const EVENT_TYPE_ICONS = { TOURNAMENT: '🏆', SEMINAR: '📖', PARTY: '🎉', CEREMONY: '🎓', WORKSHOP: '🔧', OTHER: '📌' };

export default function EventsPage() {
  const { user, isSuperAdmin, isOwner, isEventCoordinator, isStaff } = useAuth();
  const [events, setEvents] = useState([]);
  const [venues, setVenues] = useState([]);
  const [schools, setSchools] = useState([]);
  const [students, setStudents] = useState([]);
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState('upcoming');
  const [showForm, setShowForm] = useState(false);
  const [showVenueForm, setShowVenueForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', eventType: 'TOURNAMENT', scope: 'SCHOOL', schoolId: '', venueId: '', startDate: '', endDate: '', isPublic: false, ticketPrice: '', maxCapacity: '', registrationDeadline: '', imageUrl: '' });
  const [venueForm, setVenueForm] = useState({ name: '', address: '', city: '', state: '', zipCode: '', capacity: '', contactName: '', contactPhone: '' });
  const [entryForm, setEntryForm] = useState({ userId: '', weightClass: '', division: '' });
  const [filter, setFilter] = useState({ eventType: '', schoolId: '' });
  const [error, setError] = useState('');
  const canManage = isSuperAdmin || isOwner || isEventCoordinator;

  useEffect(() => { loadEvents(); loadVenues(); loadSchools(); }, []);

  const loadEvents = async () => {
    try {
      const params = {};
      if (filter.eventType) params.eventType = filter.eventType;
      if (filter.schoolId) params.schoolId = filter.schoolId;
      if (tab === 'upcoming') params.upcoming = 'true';
      setEvents(await eventApi.getAll(params));
    } catch (e) { setError(e.message); }
  };

  const loadVenues = async () => { try { setVenues(await venueApi.getAll()); } catch {} };
  const loadSchools = async () => { try { setSchools(await schoolApi.getAll()); } catch {} };

  const loadStudents = async (schoolId) => {
    if (!schoolId) return;
    try { setStudents(await enrollmentApi.getSchoolStudents(schoolId)); } catch {}
  };

  useEffect(() => { loadEvents(); }, [tab, filter.eventType, filter.schoolId]);

  const handleSave = async () => {
    try {
      setError('');
      const data = { ...form };
      if (data.ticketPrice) data.ticketPrice = parseFloat(data.ticketPrice);
      if (data.maxCapacity) data.maxCapacity = parseInt(data.maxCapacity);
      if (!data.schoolId) delete data.schoolId;
      if (!data.venueId) delete data.venueId;

      if (selected) {
        await eventApi.update(selected.id, data);
      } else {
        await eventApi.create(data);
      }
      setShowForm(false); setSelected(null); loadEvents();
    } catch (e) { setError(e.message); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this event?')) return;
    try { await eventApi.remove(id); loadEvents(); setSelected(null); } catch (e) { setError(e.message); }
  };

  const handleSaveVenue = async () => {
    try {
      const data = { ...venueForm };
      if (data.capacity) data.capacity = parseInt(data.capacity);
      await venueApi.create(data);
      setShowVenueForm(false); loadVenues();
    } catch (e) { setError(e.message); }
  };

  const handleRegister = async (eventId) => {
    try { await eventApi.register(eventId); loadEventDetail(eventId); } catch (e) { setError(e.message); }
  };

  const handlePurchaseTicket = async (eventId) => {
    try { await eventApi.purchaseTicket(eventId, { quantity: 1 }); loadEventDetail(eventId); } catch (e) { setError(e.message); }
  };

  const handleAddEntry = async () => {
    try {
      await eventApi.addTournamentEntry(selected.id, entryForm);
      setEntryForm({ userId: '', weightClass: '', division: '' });
      loadEventDetail(selected.id);
    } catch (e) { setError(e.message); }
  };

  const handleUpdateEntry = async (entryId, data) => {
    try { await eventApi.updateTournamentEntry(entryId, data); loadEventDetail(selected.id); } catch (e) { setError(e.message); }
  };

  const loadEventDetail = async (id) => {
    try {
      const ev = await eventApi.getById(id);
      setSelected(ev);
      if (ev.schoolId) loadStudents(ev.schoolId);
    } catch (e) { setError(e.message); }
  };

  const editEvent = (ev) => {
    setForm({
      name: ev.name, description: ev.description || '', eventType: ev.eventType,
      scope: ev.scope, schoolId: ev.schoolId || '', venueId: ev.venueId || '',
      startDate: ev.startDate?.substring(0, 16) || '', endDate: ev.endDate?.substring(0, 16) || '',
      isPublic: ev.isPublic, ticketPrice: ev.ticketPrice || '', maxCapacity: ev.maxCapacity || '',
      registrationDeadline: ev.registrationDeadline?.substring(0, 16) || '', imageUrl: ev.imageUrl || '',
    });
    setSelected(ev);
    setShowForm(true);
  };

  const newEvent = () => {
    setForm({ name: '', description: '', eventType: 'TOURNAMENT', scope: user?.role === 'SUPER_ADMIN' ? 'HQ' : 'SCHOOL', schoolId: user?.schoolId || '', venueId: '', startDate: '', endDate: '', isPublic: false, ticketPrice: '', maxCapacity: '', registrationDeadline: '', imageUrl: '' });
    setSelected(null);
    setShowForm(true);
  };

  // ─── Detail View ────────────────────────────────────────
  if (selected && !showForm) {
    return (
      <div className="page">
        <button className="btn btn-outline" onClick={() => setSelected(null)} style={{ marginBottom: '1rem' }}>← Back to Events</button>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h2>{EVENT_TYPE_ICONS[selected.eventType]} {selected.name}</h2>
              <span className={`badge badge-${selected.scope === 'HQ' ? 'primary' : 'info'}`} style={{ marginRight: '0.5rem' }}>{selected.scope}</span>
              <span className="badge">{selected.eventType}</span>
            </div>
            {canManage && (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-sm" onClick={() => editEvent(selected)}>Edit</button>
                <button className="btn btn-sm btn-outline" style={{ color: '#e74c3c' }} onClick={() => handleDelete(selected.id)}>Delete</button>
              </div>
            )}
          </div>
          {selected.description && <p style={{ marginTop: '0.5rem', color: '#666' }}>{selected.description}</p>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
            <div><strong>Date:</strong> {new Date(selected.startDate).toLocaleDateString()}{selected.endDate ? ` - ${new Date(selected.endDate).toLocaleDateString()}` : ''}</div>
            {selected.venue && <div><strong>Venue:</strong> {selected.venue.name}{selected.venue.city ? `, ${selected.venue.city}` : ''}</div>}
            {selected.school && <div><strong>School:</strong> {selected.school.name}</div>}
            {selected.ticketPrice > 0 && <div><strong>Ticket Price:</strong> ${selected.ticketPrice}</div>}
            {selected.maxCapacity && <div><strong>Capacity:</strong> {selected.maxCapacity}</div>}
            {selected.isPublic && <div><span className="badge badge-success">Public Event</span></div>}
          </div>
        </div>

        {/* Action buttons for attendees */}
        <div style={{ display: 'flex', gap: '0.5rem', margin: '1rem 0' }}>
          <button className="btn" onClick={() => handleRegister(selected.id)}>Register</button>
          {selected.ticketPrice > 0 && <button className="btn btn-outline" onClick={() => handlePurchaseTicket(selected.id)}>Purchase Ticket</button>}
        </div>

        {/* Registrations */}
        <div className="card" style={{ marginTop: '1rem' }}>
          <h3>Registrations ({selected.registrations?.length || 0})</h3>
          {selected.registrations?.length > 0 ? (
            <table className="data-table"><thead><tr><th>Name</th><th>Email</th><th>Status</th><th>Date</th></tr></thead><tbody>
              {selected.registrations.map((r) => (
                <tr key={r.id}><td>{r.user.firstName} {r.user.lastName}</td><td>{r.user.email}</td><td><span className="badge">{r.status}</span></td><td>{new Date(r.registeredAt).toLocaleDateString()}</td></tr>
              ))}
            </tbody></table>
          ) : <p className="empty-state">No registrations yet</p>}
        </div>

        {/* Tickets */}
        <div className="card" style={{ marginTop: '1rem' }}>
          <h3>Tickets ({selected.tickets?.length || 0})</h3>
          {selected.tickets?.length > 0 ? (
            <table className="data-table"><thead><tr><th>Name</th><th>Qty</th><th>Total</th><th>Status</th></tr></thead><tbody>
              {selected.tickets.map((t) => (
                <tr key={t.id}>
                  <td>{t.user ? `${t.user.firstName} ${t.user.lastName}` : t.guestName || 'Guest'}</td>
                  <td>{t.quantity}</td><td>${t.totalPrice?.toFixed(2)}</td>
                  <td>
                    {canManage ? (
                      <select value={t.status} onChange={(e) => eventApi.updateTicketStatus(t.id, e.target.value).then(() => loadEventDetail(selected.id))}>
                        {['RESERVED', 'PAID', 'CANCELLED', 'REFUNDED', 'CHECKED_IN'].map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    ) : <span className="badge">{t.status}</span>}
                  </td>
                </tr>
              ))}
            </tbody></table>
          ) : <p className="empty-state">No tickets sold</p>}
        </div>

        {/* Tournament Entries (for tournaments only) */}
        {selected.eventType === 'TOURNAMENT' && (
          <div className="card" style={{ marginTop: '1rem' }}>
            <h3>Tournament Entries ({selected.tournamentEntries?.length || 0})</h3>
            {canManage && (
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                <select value={entryForm.userId} onChange={(e) => setEntryForm({ ...entryForm, userId: e.target.value })}>
                  <option value="">Select Student</option>
                  {students.map((s) => <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>)}
                </select>
                <input placeholder="Division" value={entryForm.division} onChange={(e) => setEntryForm({ ...entryForm, division: e.target.value })} />
                <input placeholder="Weight Class" value={entryForm.weightClass} onChange={(e) => setEntryForm({ ...entryForm, weightClass: e.target.value })} />
                <button className="btn btn-sm" onClick={handleAddEntry} disabled={!entryForm.userId}>Add Entry</button>
              </div>
            )}
            {selected.tournamentEntries?.length > 0 ? (
              <table className="data-table"><thead><tr><th>Student</th><th>Division</th><th>Weight</th><th>Medal</th><th>Place</th>{canManage && <th>Actions</th>}</tr></thead><tbody>
                {selected.tournamentEntries.map((e) => (
                  <tr key={e.id}>
                    <td>{e.user.firstName} {e.user.lastName}</td>
                    <td>{e.division || '-'}</td><td>{e.weightClass || '-'}</td>
                    <td>
                      {canManage ? (
                        <select value={e.medalType} onChange={(ev) => handleUpdateEntry(e.id, { medalType: ev.target.value })}>
                          {['NONE', 'GOLD', 'SILVER', 'BRONZE'].map((m) => <option key={m} value={m}>{m}</option>)}
                        </select>
                      ) : <span>{e.medalType === 'GOLD' ? '🥇' : e.medalType === 'SILVER' ? '🥈' : e.medalType === 'BRONZE' ? '🥉' : '-'}</span>}
                    </td>
                    <td>
                      {canManage ? (
                        <input type="number" value={e.placement || ''} style={{ width: '60px' }} onChange={(ev) => handleUpdateEntry(e.id, { placement: parseInt(ev.target.value) || null })} />
                      ) : (e.placement || '-')}
                    </td>
                    {canManage && <td><button className="btn btn-sm btn-outline" style={{ color: '#e74c3c' }} onClick={() => eventApi.deleteTournamentEntry(e.id).then(() => loadEventDetail(selected.id))}>Remove</button></td>}
                  </tr>
                ))}
              </tbody></table>
            ) : <p className="empty-state">No entries yet</p>}
          </div>
        )}

        {error && <div className="error-message">{error}</div>}
      </div>
    );
  }

  // ─── List / Form View ──────────────────────────────────
  return (
    <div className="page">
      <div className="page-header">
        <h1>🎪 Events</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {canManage && <button className="btn" onClick={newEvent}>+ New Event</button>}
          {canManage && <button className="btn btn-outline" onClick={() => setShowVenueForm(true)}>+ New Venue</button>}
        </div>
      </div>
      {error && <div className="error-message">{error}</div>}

      {/* Filters */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className={`btn btn-sm ${tab === 'upcoming' ? '' : 'btn-outline'}`} onClick={() => setTab('upcoming')}>Upcoming</button>
            <button className={`btn btn-sm ${tab === 'all' ? '' : 'btn-outline'}`} onClick={() => setTab('all')}>All Events</button>
          </div>
          <select value={filter.eventType} onChange={(e) => setFilter({ ...filter, eventType: e.target.value })}>
            <option value="">All Types</option>
            {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          {(isSuperAdmin || isEventCoordinator) && (
            <select value={filter.schoolId} onChange={(e) => setFilter({ ...filter, schoolId: e.target.value })}>
              <option value="">All Schools</option>
              {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Event Form Modal */}
      {showForm && (
        <div className="card" style={{ marginBottom: '1rem', border: '2px solid var(--primary)' }}>
          <h3>{selected ? 'Edit Event' : 'New Event'}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
            <div className="form-group"><label>Name *</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="form-group"><label>Type</label>
              <select value={form.eventType} onChange={(e) => setForm({ ...form, eventType: e.target.value })}>
                {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Scope</label>
              <select value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })}>
                <option value="HQ">HQ (Org-wide)</option><option value="SCHOOL">School</option>
              </select>
            </div>
            {form.scope === 'SCHOOL' && (
              <div className="form-group"><label>School</label>
                <select value={form.schoolId} onChange={(e) => setForm({ ...form, schoolId: e.target.value })}>
                  <option value="">Select School</option>
                  {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}
            <div className="form-group"><label>Venue</label>
              <select value={form.venueId} onChange={(e) => setForm({ ...form, venueId: e.target.value })}>
                <option value="">Select Venue</option>
                {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Start Date *</label><input type="datetime-local" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
            <div className="form-group"><label>End Date</label><input type="datetime-local" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></div>
            <div className="form-group"><label>Ticket Price ($)</label><input type="number" step="0.01" value={form.ticketPrice} onChange={(e) => setForm({ ...form, ticketPrice: e.target.value })} placeholder="0 = Free" /></div>
            <div className="form-group"><label>Max Capacity</label><input type="number" value={form.maxCapacity} onChange={(e) => setForm({ ...form, maxCapacity: e.target.value })} /></div>
            <div className="form-group"><label>Registration Deadline</label><input type="datetime-local" value={form.registrationDeadline} onChange={(e) => setForm({ ...form, registrationDeadline: e.target.value })} /></div>
            <div className="form-group"><label>Image URL</label><input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} /></div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '1.5rem' }}>
              <input type="checkbox" checked={form.isPublic} onChange={(e) => setForm({ ...form, isPublic: e.target.checked })} id="isPublic" />
              <label htmlFor="isPublic" style={{ margin: 0 }}>Public (visible without login)</label>
            </div>
          </div>
          <div className="form-group"><label>Description</label><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} /></div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
            <button className="btn" onClick={handleSave}>{selected ? 'Update' : 'Create'}</button>
            <button className="btn btn-outline" onClick={() => { setShowForm(false); setSelected(null); }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Venue Form Modal */}
      {showVenueForm && (
        <div className="card" style={{ marginBottom: '1rem', border: '2px solid var(--secondary)' }}>
          <h3>New Venue</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div className="form-group"><label>Name *</label><input value={venueForm.name} onChange={(e) => setVenueForm({ ...venueForm, name: e.target.value })} /></div>
            <div className="form-group"><label>Address</label><input value={venueForm.address} onChange={(e) => setVenueForm({ ...venueForm, address: e.target.value })} /></div>
            <div className="form-group"><label>City</label><input value={venueForm.city} onChange={(e) => setVenueForm({ ...venueForm, city: e.target.value })} /></div>
            <div className="form-group"><label>State</label><input value={venueForm.state} onChange={(e) => setVenueForm({ ...venueForm, state: e.target.value })} /></div>
            <div className="form-group"><label>Capacity</label><input type="number" value={venueForm.capacity} onChange={(e) => setVenueForm({ ...venueForm, capacity: e.target.value })} /></div>
            <div className="form-group"><label>Contact Name</label><input value={venueForm.contactName} onChange={(e) => setVenueForm({ ...venueForm, contactName: e.target.value })} /></div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
            <button className="btn" onClick={handleSaveVenue}>Create Venue</button>
            <button className="btn btn-outline" onClick={() => setShowVenueForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Events Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
        {events.map((ev) => (
          <div key={ev.id} className="card" style={{ cursor: 'pointer', transition: 'transform 0.2s' }} onClick={() => loadEventDetail(ev.id)} onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <h3 style={{ margin: 0 }}>{EVENT_TYPE_ICONS[ev.eventType]} {ev.name}</h3>
              {ev.isPublic && <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>PUBLIC</span>}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <span className="badge">{ev.eventType}</span>
              <span className={`badge badge-${ev.scope === 'HQ' ? 'primary' : 'info'}`}>{ev.scope}</span>
            </div>
            <p style={{ color: '#666', fontSize: '0.9rem', margin: '0.5rem 0' }}>
              📅 {new Date(ev.startDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
            {ev.venue && <p style={{ color: '#888', fontSize: '0.85rem', margin: 0 }}>📍 {ev.venue.name}{ev.venue.city ? `, ${ev.venue.city}` : ''}</p>}
            {ev.school && <p style={{ color: '#888', fontSize: '0.85rem', margin: 0 }}>🏫 {ev.school.name}</p>}
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', fontSize: '0.85rem', color: '#555' }}>
              {ev.ticketPrice > 0 && <span>🎟️ ${ev.ticketPrice}</span>}
              <span>👥 {ev._count?.registrations || 0} registered</span>
              {ev._count?.tournamentEntries > 0 && <span>⚔️ {ev._count.tournamentEntries} entries</span>}
            </div>
          </div>
        ))}
      </div>
      {events.length === 0 && <p className="empty-state" style={{ textAlign: 'center', marginTop: '2rem' }}>No events found. {canManage ? 'Create one to get started!' : ''}</p>}
    </div>
  );
}
