import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { familyApi, schoolApi, enrollmentApi } from '../api/client';

const FAMILY_ROLES = ['PRIMARY', 'SECONDARY', 'CHILD'];

export default function FamiliesPage() {
  const { isSuperAdmin, isOwner, isStaff } = useAuth();
  const [tab, setTab] = useState(isStaff ? 'MANAGE' : 'MY');

  const tabs = isStaff ? ['MANAGE', 'MY'] : ['MY'];

  return (
    <div className="page families-page">
      <h1>👨‍👩‍👧‍👦 Family Accounts</h1>
      <div className="tab-bar" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {tabs.map((t) => (
          <button key={t} className={`btn ${tab === t ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab(t)}>
            {t === 'MANAGE' ? 'Manage Families' : 'My Family'}
          </button>
        ))}
      </div>
      {tab === 'MANAGE' && isStaff && <ManageTab />}
      {tab === 'MY' && <MyFamilyTab />}
    </div>
  );
}

// ─── Staff: Manage Families ──────────────────────────────

function ManageTab() {
  const [schools, setSchools] = useState([]);
  const [selectedSchool, setSelectedSchool] = useState('');
  const [families, setFamilies] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedFamily, setSelectedFamily] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    schoolApi.getAll().then((d) => {
      const list = d.schools || d;
      setSchools(list);
      if (list.length > 0) setSelectedSchool(list[0].id);
    });
  }, []);

  const loadFamilies = useCallback(async () => {
    if (!selectedSchool) return;
    setLoading(true);
    try {
      const data = await familyApi.getBySchool(selectedSchool, search ? { search } : undefined);
      setFamilies(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [selectedSchool, search]);

  useEffect(() => { loadFamilies(); }, [loadFamilies]);

  if (selectedFamily) {
    return <FamilyDetail familyId={selectedFamily} schoolId={selectedSchool} onBack={() => { setSelectedFamily(null); loadFamilies(); }} />;
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <select className="form-input" value={selectedSchool} onChange={(e) => setSelectedSchool(e.target.value)} style={{ width: 'auto' }}>
          {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input className="form-input" placeholder="Search families…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: '200px' }} />
        <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>+ New Family</button>
      </div>

      {showCreate && (
        <CreateFamilyForm schoolId={selectedSchool} onCreated={() => { setShowCreate(false); loadFamilies(); }} onCancel={() => setShowCreate(false)} />
      )}

      {loading ? <p>Loading…</p> : (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {families.length === 0 && <p style={{ color: '#888' }}>No families found.</p>}
          {families.map((f) => (
            <div
              key={f.id}
              style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', cursor: 'pointer', background: '#fff' }}
              onClick={() => setSelectedFamily(f.id)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ fontSize: '1.1rem' }}>{f.name}</strong>
                  <span style={{ color: '#888', marginLeft: '0.75rem' }}>{f.members.length} members</span>
                </div>
                {f.email && <span style={{ color: '#666', fontSize: '0.85rem' }}>{f.email}</span>}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                {f.members.map((m) => (
                  <span key={m.id} style={{
                    display: 'inline-block', padding: '0.2rem 0.5rem', borderRadius: '20px', fontSize: '0.8rem',
                    background: m.familyRole === 'PRIMARY' ? '#3b82f6' : m.familyRole === 'SECONDARY' ? '#8b5cf6' : '#10b981',
                    color: '#fff',
                  }}>
                    {m.user.firstName} {m.user.lastName} ({m.familyRole})
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Create Family Form ─────────────────────────────────

function CreateFamilyForm({ schoolId, onCreated, onCancel }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', notes: '' });
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    try {
      await familyApi.create(schoolId, form);
      onCreated();
    } catch (e) { setError(e.message); }
  };

  return (
    <div className="card" style={{ padding: '1rem', marginBottom: '1rem', maxWidth: '500px' }}>
      <h3>Create Family</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <input className="form-input" placeholder="Family Name (e.g. Smith Family)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="form-input" placeholder="Contact Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input className="form-input" placeholder="Contact Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <textarea className="form-input" placeholder="Notes" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-primary btn-sm" onClick={handleSubmit}>Create</button>
          <button className="btn btn-outline btn-sm" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── Family Detail (with member management & billing) ───

function FamilyDetail({ familyId, schoolId, onBack }) {
  const [family, setFamily] = useState(null);
  const [billing, setBilling] = useState(null);
  const [students, setStudents] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ userId: '', familyRole: 'CHILD' });
  const [subTab, setSubTab] = useState('MEMBERS');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [fam, bill] = await Promise.all([
        familyApi.getById(familyId),
        familyApi.getBilling(familyId),
      ]);
      setFamily(fam);
      setBilling(bill);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [familyId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (schoolId) {
      enrollmentApi.getSchoolStudents(schoolId).then((data) => {
        setStudents(data.students || data);
      });
    }
  }, [schoolId]);

  const handleAddMember = async () => {
    if (!addForm.userId) return;
    await familyApi.addMember(familyId, addForm.userId, addForm.familyRole);
    setShowAdd(false);
    setAddForm({ userId: '', familyRole: 'CHILD' });
    load();
  };

  const handleRemove = async (memberId) => {
    if (!confirm('Remove this member from the family?')) return;
    await familyApi.removeMember(memberId);
    load();
  };

  if (loading) return <p>Loading…</p>;
  if (!family) return <p>Family not found.</p>;

  const memberUserIds = new Set(family.members.map((m) => m.user.id));

  return (
    <div>
      <button className="btn btn-outline btn-sm" onClick={onBack} style={{ marginBottom: '1rem' }}>← Back</button>
      <h2>{family.name}</h2>
      {family.email && <p style={{ color: '#666' }}>📧 {family.email} {family.phone && `• 📱 ${family.phone}`}</p>}
      {family.notes && <p style={{ color: '#888', fontStyle: 'italic' }}>{family.notes}</p>}

      {family.summary && (
        <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <div className="card" style={{ padding: '0.75rem 1.25rem' }}>
            <div style={{ fontWeight: 600, fontSize: '1.3rem' }}>{family.summary.memberCount}</div>
            <div style={{ color: '#888', fontSize: '0.85rem' }}>Members</div>
          </div>
          <div className="card" style={{ padding: '0.75rem 1.25rem' }}>
            <div style={{ fontWeight: 600, fontSize: '1.3rem' }}>${family.summary.totalOutstanding.toFixed(2)}</div>
            <div style={{ color: '#888', fontSize: '0.85rem' }}>Outstanding</div>
          </div>
          <div className="card" style={{ padding: '0.75rem 1.25rem' }}>
            <div style={{ fontWeight: 600, fontSize: '1.3rem' }}>{family.summary.activeSubscriptions}</div>
            <div style={{ color: '#888', fontSize: '0.85rem' }}>Active Subs</div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        {['MEMBERS', 'BILLING'].map((t) => (
          <button key={t} className={`btn btn-sm ${subTab === t ? 'btn-primary' : 'btn-outline'}`} onClick={() => setSubTab(t)}>{t}</button>
        ))}
      </div>

      {subTab === 'MEMBERS' && (
        <div>
          <button className="btn btn-sm btn-primary" style={{ marginBottom: '0.75rem' }} onClick={() => setShowAdd(!showAdd)}>
            {showAdd ? 'Cancel' : '+ Add Member'}
          </button>

          {showAdd && (
            <div className="card" style={{ padding: '1rem', marginBottom: '1rem', maxWidth: '400px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <select className="form-input" value={addForm.userId} onChange={(e) => setAddForm({ ...addForm, userId: e.target.value })}>
                  <option value="">Select user…</option>
                  {students.filter((s) => !memberUserIds.has(s.id)).map((s) => (
                    <option key={s.id} value={s.id}>{s.firstName} {s.lastName} — {s.email}</option>
                  ))}
                </select>
                <select className="form-input" value={addForm.familyRole} onChange={(e) => setAddForm({ ...addForm, familyRole: e.target.value })}>
                  {FAMILY_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                <button className="btn btn-primary btn-sm" onClick={handleAddMember}>Add</button>
              </div>
            </div>
          )}

          <table className="data-table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Family Role</th><th>Actions</th></tr></thead>
            <tbody>
              {family.members.map((m) => (
                <tr key={m.id}>
                  <td>{m.user.firstName} {m.user.lastName}</td>
                  <td>{m.user.email}</td>
                  <td>{m.user.role}</td>
                  <td>
                    <span style={{
                      padding: '0.15rem 0.5rem', borderRadius: '20px', fontSize: '0.8rem', color: '#fff',
                      background: m.familyRole === 'PRIMARY' ? '#3b82f6' : m.familyRole === 'SECONDARY' ? '#8b5cf6' : '#10b981',
                    }}>{m.familyRole}</span>
                  </td>
                  <td>
                    <button className="btn btn-sm btn-outline" style={{ color: 'red' }} onClick={() => handleRemove(m.id)}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {subTab === 'BILLING' && billing && (
        <div>
          <h3>Combined Billing</h3>
          <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <div className="card" style={{ padding: '0.75rem 1.25rem' }}>
              <div style={{ fontWeight: 600, fontSize: '1.3rem', color: '#e53e3e' }}>${billing.summary.totalOwed.toFixed(2)}</div>
              <div style={{ color: '#888', fontSize: '0.85rem' }}>Total Owed</div>
            </div>
            <div className="card" style={{ padding: '0.75rem 1.25rem' }}>
              <div style={{ fontWeight: 600, fontSize: '1.3rem', color: '#38a169' }}>${billing.summary.totalPaid.toFixed(2)}</div>
              <div style={{ color: '#888', fontSize: '0.85rem' }}>Total Paid</div>
            </div>
          </div>

          <h4>Invoices</h4>
          <table className="data-table">
            <thead><tr><th>Member</th><th>Description</th><th>Amount</th><th>Status</th><th>Due</th></tr></thead>
            <tbody>
              {billing.invoices.map((inv) => (
                <tr key={inv.id}>
                  <td>{inv.memberName}</td>
                  <td>{inv.description || '—'}</td>
                  <td>${Number(inv.amount).toFixed(2)}</td>
                  <td>{inv.status}</td>
                  <td>{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
              {billing.invoices.length === 0 && <tr><td colSpan="5" style={{ textAlign: 'center', color: '#888' }}>No invoices</td></tr>}
            </tbody>
          </table>

          <h4 style={{ marginTop: '1rem' }}>Active Subscriptions</h4>
          <table className="data-table">
            <thead><tr><th>Member</th><th>Plan</th><th>Price</th><th>Status</th></tr></thead>
            <tbody>
              {billing.subscriptions.map((sub) => (
                <tr key={sub.id}>
                  <td>{sub.memberName}</td>
                  <td>{sub.plan?.name}</td>
                  <td>${Number(sub.plan?.price || 0).toFixed(2)}</td>
                  <td>{sub.status}</td>
                </tr>
              ))}
              {billing.subscriptions.length === 0 && <tr><td colSpan="4" style={{ textAlign: 'center', color: '#888' }}>No subscriptions</td></tr>}
            </tbody>
          </table>

          <h4 style={{ marginTop: '1rem' }}>Recent Payments</h4>
          <table className="data-table">
            <thead><tr><th>Member</th><th>Amount</th><th>Method</th><th>Date</th></tr></thead>
            <tbody>
              {billing.payments.map((pay) => (
                <tr key={pay.id}>
                  <td>{pay.memberName}</td>
                  <td>${Number(pay.amount).toFixed(2)}</td>
                  <td>{pay.method}</td>
                  <td>{new Date(pay.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {billing.payments.length === 0 && <tr><td colSpan="4" style={{ textAlign: 'center', color: '#888' }}>No payments</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── My Family Tab (Student view) ───────────────────────

function MyFamilyTab() {
  const [families, setFamilies] = useState([]);
  const [selectedFamily, setSelectedFamily] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    familyApi.getMine().then(setFamilies).finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading…</p>;

  if (selectedFamily) {
    return (
      <div>
        <button className="btn btn-outline btn-sm" onClick={() => setSelectedFamily(null)} style={{ marginBottom: '1rem' }}>← Back</button>
        <FamilyDetail familyId={selectedFamily} onBack={() => setSelectedFamily(null)} />
      </div>
    );
  }

  return (
    <div>
      {families.length === 0 ? (
        <p style={{ color: '#888' }}>You are not part of any family account yet. Ask your school administrator to set one up.</p>
      ) : (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {families.map((f) => (
            <div
              key={f.id}
              style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', cursor: 'pointer', background: '#fff' }}
              onClick={() => setSelectedFamily(f.id)}
            >
              <strong>{f.name}</strong>
              <span style={{ color: '#888', marginLeft: '0.75rem' }}>Your role: {f.myRole}</span>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                {f.members.map((m) => (
                  <span key={m.id} style={{
                    display: 'inline-block', padding: '0.2rem 0.5rem', borderRadius: '20px', fontSize: '0.8rem',
                    background: m.familyRole === 'PRIMARY' ? '#3b82f6' : m.familyRole === 'SECONDARY' ? '#8b5cf6' : '#10b981', color: '#fff',
                  }}>{m.user.firstName} {m.user.lastName}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
