import { useState, useEffect } from 'react';
import { payrollApi, schoolApi } from '../api/client';
import { useAuth } from '../context/AuthContext';

const STATUS_COLORS = { PENDING: '#f59e0b', APPROVED: '#3b82f6', PAID: '#22c55e' };

export default function PayrollPage() {
  const { user } = useAuth();
  const [schools, setSchools] = useState([]);
  const [schoolId, setSchoolId] = useState('');
  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState([]);
  const [tab, setTab] = useState('ENTRIES');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ instructorId: '', sessionId: '', date: '', hoursWorked: '', hourlyRate: '', notes: '' });
  const [selectedIds, setSelectedIds] = useState([]);
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => {
    schoolApi.getAll().then((s) => { setSchools(s); if (s.length) setSchoolId(s[0].id); });
  }, []);

  useEffect(() => {
    if (!schoolId) return;
    loadEntries();
    payrollApi.getSummary(schoolId).then(setSummary);
  }, [schoolId, filterStatus]);

  const loadEntries = () => {
    const params = {};
    if (filterStatus) params.status = filterStatus;
    payrollApi.getBySchool(schoolId, params).then(setEntries);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    await payrollApi.create(schoolId, {
      instructorId: form.instructorId,
      sessionId: form.sessionId || undefined,
      date: new Date(form.date).toISOString(),
      hoursWorked: Number(form.hoursWorked),
      hourlyRate: Number(form.hourlyRate),
      notes: form.notes || undefined,
    });
    setShowForm(false);
    setForm({ instructorId: '', sessionId: '', date: '', hoursWorked: '', hourlyRate: '', notes: '' });
    loadEntries();
    payrollApi.getSummary(schoolId).then(setSummary);
  };

  const handleApprove = async () => {
    if (!selectedIds.length) return;
    await payrollApi.approve(selectedIds);
    setSelectedIds([]);
    loadEntries();
    payrollApi.getSummary(schoolId).then(setSummary);
  };

  const handleMarkPaid = async () => {
    if (!selectedIds.length) return;
    await payrollApi.markPaid(selectedIds);
    setSelectedIds([]);
    loadEntries();
    payrollApi.getSummary(schoolId).then(setSummary);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this entry?')) return;
    await payrollApi.delete(id);
    loadEntries();
    payrollApi.getSummary(schoolId).then(setSummary);
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const selectAll = () => {
    const pendingIds = entries.filter((e) => e.status === 'PENDING' || e.status === 'APPROVED').map((e) => e.id);
    setSelectedIds((prev) => prev.length === pendingIds.length ? [] : pendingIds);
  };

  const fmt = (n) => '$' + Number(n).toFixed(2);

  return (
    <div className="page">
      <h1>💰 Instructor Payroll</h1>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={schoolId} onChange={(e) => setSchoolId(e.target.value)} className="form-input" style={{ width: 'auto' }}>
          {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button className={`btn ${tab === 'ENTRIES' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('ENTRIES')}>Entries</button>
        <button className={`btn ${tab === 'SUMMARY' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('SUMMARY')}>Summary</button>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>+ New Entry</button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
          <h3>New Payroll Entry</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
            <input className="form-input" placeholder="Instructor User ID *" required value={form.instructorId} onChange={(e) => setForm({ ...form, instructorId: e.target.value })} />
            <input className="form-input" placeholder="Session ID (optional)" value={form.sessionId} onChange={(e) => setForm({ ...form, sessionId: e.target.value })} />
            <input className="form-input" type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            <input className="form-input" type="number" step="0.25" placeholder="Hours *" required value={form.hoursWorked} onChange={(e) => setForm({ ...form, hoursWorked: e.target.value })} />
            <input className="form-input" type="number" step="0.01" placeholder="Hourly Rate *" required value={form.hourlyRate} onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })} />
          </div>
          <textarea className="form-input" placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} style={{ marginTop: '0.5rem' }} />
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button type="submit" className="btn btn-primary">Save</button>
            <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      {tab === 'ENTRIES' && (
        <>
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', alignItems: 'center' }}>
            <select className="form-input" style={{ width: 'auto' }} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="PAID">Paid</option>
            </select>
            {selectedIds.length > 0 && (
              <>
                <span>{selectedIds.length} selected</span>
                <button className="btn btn-sm" style={{ background: '#3b82f6', color: '#fff' }} onClick={handleApprove}>✓ Approve</button>
                <button className="btn btn-sm" style={{ background: '#22c55e', color: '#fff' }} onClick={handleMarkPaid}>💵 Mark Paid</button>
              </>
            )}
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th><input type="checkbox" onChange={selectAll} checked={selectedIds.length > 0} /></th>
                <th>Instructor</th>
                <th>Date</th>
                <th>Hours</th>
                <th>Rate</th>
                <th>Total</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td><input type="checkbox" checked={selectedIds.includes(e.id)} onChange={() => toggleSelect(e.id)} /></td>
                  <td><strong>{e.instructor?.firstName} {e.instructor?.lastName}</strong></td>
                  <td>{new Date(e.date).toLocaleDateString()}</td>
                  <td>{e.hoursWorked}h</td>
                  <td>{fmt(e.hourlyRate)}</td>
                  <td style={{ fontWeight: 600 }}>{fmt(e.totalPay)}</td>
                  <td>
                    <span style={{ padding: '0.15rem 0.5rem', borderRadius: '10px', fontSize: '0.8rem', background: (STATUS_COLORS[e.status] || '#888') + '20', color: STATUS_COLORS[e.status] || '#888' }}>
                      {e.status}
                    </span>
                  </td>
                  <td>
                    {e.status === 'PENDING' && <button className="btn btn-sm btn-outline" style={{ color: '#ef4444' }} onClick={() => handleDelete(e.id)}>Delete</button>}
                  </td>
                </tr>
              ))}
              {entries.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', color: '#888' }}>No entries</td></tr>}
            </tbody>
          </table>
        </>
      )}

      {tab === 'SUMMARY' && (
        <div className="card" style={{ padding: '1rem' }}>
          <h3>Payroll Summary by Instructor</h3>
          <table className="data-table">
            <thead><tr><th>Instructor ID</th><th>Status</th><th>Entries</th><th>Total Hours</th><th>Total Pay</th></tr></thead>
            <tbody>
              {summary.map((s, i) => (
                <tr key={i}>
                  <td>{s.instructorId?.slice(0, 8)}...</td>
                  <td>
                    <span style={{ padding: '0.15rem 0.5rem', borderRadius: '10px', fontSize: '0.8rem', background: (STATUS_COLORS[s.status] || '#888') + '20', color: STATUS_COLORS[s.status] || '#888' }}>
                      {s.status}
                    </span>
                  </td>
                  <td>{s._count}</td>
                  <td>{Number(s._sum?.hoursWorked || 0).toFixed(1)}h</td>
                  <td style={{ fontWeight: 600 }}>{fmt(s._sum?.totalPay)}</td>
                </tr>
              ))}
              {summary.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: '#888' }}>No data</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
