import { useState, useEffect } from 'react';
import { leadApi, schoolApi } from '../api/client';
import { useAuth } from '../context/AuthContext';

const STATUSES = ['NEW', 'CONTACTED', 'TRIAL_SCHEDULED', 'TRIAL_COMPLETED', 'CONVERTED', 'LOST'];
const SOURCES = ['WEBSITE', 'REFERRAL', 'WALK_IN', 'SOCIAL_MEDIA', 'ADVERTISING', 'EVENT', 'OTHER'];
const STATUS_COLORS = { NEW: '#3b82f6', CONTACTED: '#8b5cf6', TRIAL_SCHEDULED: '#f59e0b', TRIAL_COMPLETED: '#10b981', CONVERTED: '#22c55e', LOST: '#ef4444' };

export default function LeadsPage() {
  const { user, isSuperAdmin, isOwner } = useAuth();
  const [schools, setSchools] = useState([]);
  const [schoolId, setSchoolId] = useState('');
  const [leads, setLeads] = useState([]);
  const [funnel, setFunnel] = useState(null);
  const [tab, setTab] = useState('LIST');
  const [selectedLead, setSelectedLead] = useState(null);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', source: 'WALK_IN', notes: '' });
  const [showForm, setShowForm] = useState(false);
  const [activityForm, setActivityForm] = useState({ action: 'NOTE', notes: '' });
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => {
    schoolApi.getAll().then((s) => { setSchools(s); if (s.length) setSchoolId(s[0].id); });
  }, []);

  useEffect(() => {
    if (!schoolId) return;
    loadLeads();
    leadApi.getFunnel(schoolId).then(setFunnel);
  }, [schoolId, filterStatus]);

  const loadLeads = () => {
    const params = {};
    if (filterStatus) params.status = filterStatus;
    leadApi.getBySchool(schoolId, params).then(setLeads);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    await leadApi.create(schoolId, form);
    setForm({ firstName: '', lastName: '', email: '', phone: '', source: 'WALK_IN', notes: '' });
    setShowForm(false);
    loadLeads();
    leadApi.getFunnel(schoolId).then(setFunnel);
  };

  const handleStatusChange = async (id, status) => {
    await leadApi.update(id, { status });
    loadLeads();
    leadApi.getFunnel(schoolId).then(setFunnel);
    if (selectedLead?.id === id) loadDetail(id);
  };

  const loadDetail = async (id) => {
    const lead = await leadApi.getById(id);
    setSelectedLead(lead);
  };

  const handleAddActivity = async (e) => {
    e.preventDefault();
    await leadApi.addActivity(selectedLead.id, activityForm);
    setActivityForm({ action: 'NOTE', notes: '' });
    loadDetail(selectedLead.id);
  };

  return (
    <div className="page">
      <h1>📋 Lead Management</h1>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={schoolId} onChange={(e) => setSchoolId(e.target.value)} className="form-input" style={{ width: 'auto' }}>
          {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button className={`btn ${tab === 'LIST' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('LIST')}>Lead List</button>
        <button className={`btn ${tab === 'FUNNEL' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('FUNNEL')}>Funnel</button>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>+ New Lead</button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
          <h3>New Lead</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <input className="form-input" placeholder="First Name *" required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            <input className="form-input" placeholder="Last Name *" required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            <input className="form-input" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <input className="form-input" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <select className="form-input" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
              {SOURCES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <textarea className="form-input" placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} style={{ marginTop: '0.5rem' }} />
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button type="submit" className="btn btn-primary">Save Lead</button>
            <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      {tab === 'FUNNEL' && funnel && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
            {STATUSES.map((s) => (
              <div key={s} className="card" style={{ padding: '0.75rem', textAlign: 'center', borderTop: `4px solid ${STATUS_COLORS[s]}` }}>
                <div style={{ fontSize: '1.8rem', fontWeight: 700 }}>{funnel.counts[s] || 0}</div>
                <div style={{ fontSize: '0.8rem', color: '#888' }}>{s.replace(/_/g, ' ')}</div>
              </div>
            ))}
          </div>
          <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
            <strong>Conversion Rate: </strong>
            <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#22c55e' }}>{funnel.conversionRate}%</span>
            <span style={{ color: '#888', marginLeft: '0.5rem' }}>({funnel.counts.CONVERTED || 0} of {funnel.total})</span>
          </div>
        </div>
      )}

      {tab === 'LIST' && (
        <>
          <div style={{ marginBottom: '0.75rem' }}>
            <select className="form-input" style={{ width: 'auto' }} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="">All Statuses</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <div style={{ flex: 2 }}>
              <table className="data-table">
                <thead><tr><th>Name</th><th>Contact</th><th>Source</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {leads.map((l) => (
                    <tr key={l.id} onClick={() => loadDetail(l.id)} style={{ cursor: 'pointer', background: selectedLead?.id === l.id ? '#eef6ff' : undefined }}>
                      <td><strong>{l.firstName} {l.lastName}</strong></td>
                      <td>{l.email || l.phone || '—'}</td>
                      <td>{l.source.replace(/_/g, ' ')}</td>
                      <td>
                        <select value={l.status} onClick={(e) => e.stopPropagation()} onChange={(e) => handleStatusChange(l.id, e.target.value)}
                          style={{ padding: '0.2rem 0.4rem', borderRadius: '4px', border: '1px solid #ccc', background: STATUS_COLORS[l.status] + '20', fontSize: '0.8rem' }}>
                          {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                        </select>
                      </td>
                      <td><button className="btn btn-sm btn-outline" onClick={(e) => { e.stopPropagation(); loadDetail(l.id); }}>View</button></td>
                    </tr>
                  ))}
                  {leads.length === 0 && <tr><td colSpan="5" style={{ textAlign: 'center', color: '#888' }}>No leads found</td></tr>}
                </tbody>
              </table>
            </div>

            {selectedLead && (
              <div className="card" style={{ padding: '1rem', flex: 1 }}>
                <h3>{selectedLead.firstName} {selectedLead.lastName}</h3>
                <p>{selectedLead.email} {selectedLead.phone && `| ${selectedLead.phone}`}</p>
                <p style={{ fontSize: '0.85rem', color: '#888' }}>Source: {selectedLead.source} | Assigned: {selectedLead.assignedTo ? `${selectedLead.assignedTo.firstName} ${selectedLead.assignedTo.lastName}` : 'None'}</p>
                {selectedLead.notes && <p style={{ fontSize: '0.85rem' }}>{selectedLead.notes}</p>}

                <h4 style={{ marginTop: '1rem' }}>Activity Log</h4>
                <form onSubmit={handleAddActivity} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <select className="form-input" style={{ width: 'auto' }} value={activityForm.action} onChange={(e) => setActivityForm({ ...activityForm, action: e.target.value })}>
                    <option value="NOTE">Note</option>
                    <option value="CALLED">Called</option>
                    <option value="EMAILED">Emailed</option>
                    <option value="TRIAL_CLASS">Trial Class</option>
                  </select>
                  <input className="form-input" placeholder="Details" value={activityForm.notes} onChange={(e) => setActivityForm({ ...activityForm, notes: e.target.value })} />
                  <button type="submit" className="btn btn-primary btn-sm">Add</button>
                </form>

                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {selectedLead.activities?.map((a) => (
                    <div key={a.id} style={{ padding: '0.5rem', borderBottom: '1px solid #eee', fontSize: '0.85rem' }}>
                      <strong>{a.action}</strong> {a.user && <span>by {a.user.firstName}</span>}
                      <div style={{ color: '#888' }}>{a.notes}</div>
                      <div style={{ color: '#aaa', fontSize: '0.75rem' }}>{new Date(a.createdAt).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
