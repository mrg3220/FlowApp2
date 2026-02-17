import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { billingApi, schoolApi, enrollmentApi } from '../api/client';

const TABS = ['Summary', 'Subscriptions', 'Plans', 'Invoices', 'Payments', 'Settings'];

export default function BillingPage() {
  const { user, isSuperAdmin, isOwner, isInstructor, isStudent } = useAuth();
  const [activeTab, setActiveTab] = useState('Summary');
  const [schools, setSchools] = useState([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        if (isSuperAdmin) {
          const data = await schoolApi.getAll();
          setSchools(data);
          if (data.length) setSelectedSchoolId(data[0].id);
        } else if (user?.schoolId) {
          setSelectedSchoolId(user.schoolId);
        }
      } catch { /* ignore */ }
      setLoading(false);
    };
    load();
  }, [isSuperAdmin, user]);

  if (loading) return <div className="loading">Loading...</div>;

  // Students only see their invoices
  if (isStudent) {
    return (
      <div>
        <div className="page-header"><h1>My Billing</h1></div>
        {selectedSchoolId && <StudentInvoices schoolId={selectedSchoolId} />}
      </div>
    );
  }

  if (!selectedSchoolId) {
    return <div className="alert alert-error">No school found. Please contact an admin.</div>;
  }

  const visibleTabs = (isOwner || isSuperAdmin) ? TABS : TABS.filter(t => t !== 'Settings');

  return (
    <div>
      <div className="page-header">
        <h1>💰 Billing</h1>
        {isSuperAdmin && schools.length > 1 && (
          <select
            className="form-control"
            style={{ width: 'auto', minWidth: '200px' }}
            value={selectedSchoolId}
            onChange={(e) => setSelectedSchoolId(e.target.value)}
          >
            {schools.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}
      </div>

      <div className="billing-tabs">
        {visibleTabs.map((tab) => (
          <button
            key={tab}
            className={`billing-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="billing-content">
        {activeTab === 'Summary' && <BillingSummary schoolId={selectedSchoolId} />}
        {activeTab === 'Subscriptions' && <SubscriptionManager schoolId={selectedSchoolId} />}
        {activeTab === 'Plans' && <MembershipPlans schoolId={selectedSchoolId} />}
        {activeTab === 'Invoices' && <InvoiceManager schoolId={selectedSchoolId} />}
        {activeTab === 'Payments' && <PaymentHistory schoolId={selectedSchoolId} />}
        {activeTab === 'Settings' && <BillingSettings schoolId={selectedSchoolId} />}
      </div>
    </div>
  );
}

// ─── Summary Tab ──────────────────────────────────────────

function BillingSummary({ schoolId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    billingApi.getSummary(schoolId)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [schoolId]);

  if (loading) return <div className="loading">Loading summary...</div>;
  if (error) return <div className="alert alert-error">{error}</div>;
  if (!data) return null;

  const fmt = (v) => `$${Number(v || 0).toFixed(2)}`;

  return (
    <div>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{fmt(data.totalRevenue)}</div>
          <div className="stat-label">Total Revenue</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{fmt(data.monthlyRevenue)}</div>
          <div className="stat-label">This Month</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{data.outstandingCount}</div>
          <div className="stat-label">Outstanding Invoices</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{fmt(data.outstandingAmount)}</div>
          <div className="stat-label">Outstanding Amount</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{data.overdueCount}</div>
          <div className="stat-label">Overdue</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{data.activePlans}</div>
          <div className="stat-label">Active Plans</div>
        </div>
      </div>

      {data.recentPayments?.length > 0 && (
        <div className="card">
          <div className="card-header"><h2>Recent Payments</h2></div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Student</th>
                  <th>Amount</th>
                  <th>Method</th>
                </tr>
              </thead>
              <tbody>
                {data.recentPayments.map((p) => (
                  <tr key={p.id}>
                    <td>{new Date(p.paidAt).toLocaleDateString()}</td>
                    <td>{p.student?.firstName} {p.student?.lastName}</td>
                    <td>{fmt(p.amount)}</td>
                    <td><span className="badge">{p.method}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Membership Plans Tab ─────────────────────────────────

function MembershipPlans({ schoolId }) {
  const { isSuperAdmin, isOwner } = useAuth();
  const canEdit = isSuperAdmin || isOwner;
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editPlan, setEditPlan] = useState(null);
  const [form, setForm] = useState({
    name: '', description: '', price: '', billingCycle: 'MONTHLY', classCredits: '',
  });

  const fetchPlans = useCallback(() => {
    setLoading(true);
    billingApi.getPlans(schoolId, { includeInactive: true })
      .then(setPlans)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [schoolId]);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  const resetForm = () => {
    setForm({ name: '', description: '', price: '', billingCycle: 'MONTHLY', classCredits: '' });
    setEditPlan(null);
  };

  const openCreate = () => { resetForm(); setShowModal(true); };
  const openEdit = (p) => {
    setForm({
      name: p.name,
      description: p.description || '',
      price: String(p.price),
      billingCycle: p.billingCycle,
      classCredits: p.classCredits != null ? String(p.classCredits) : '',
    });
    setEditPlan(p);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const payload = {
      name: form.name,
      description: form.description || undefined,
      price: parseFloat(form.price),
      billingCycle: form.billingCycle,
      classCredits: form.classCredits ? parseInt(form.classCredits, 10) : null,
    };
    try {
      if (editPlan) {
        await billingApi.updatePlan(schoolId, editPlan.id, payload);
      } else {
        await billingApi.createPlan(schoolId, payload);
      }
      setShowModal(false);
      resetForm();
      fetchPlans();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (planId) => {
    if (!confirm('Deactivate this plan?')) return;
    try {
      await billingApi.deletePlan(schoolId, planId);
      fetchPlans();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <div className="loading">Loading plans...</div>;

  return (
    <div>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="card">
        <div className="card-header">
          <h2>Membership Plans</h2>
          {canEdit && (
            <button className="btn btn-primary btn-sm" onClick={openCreate}>+ New Plan</button>
          )}
        </div>

        {plans.length === 0 ? (
          <p style={{ color: 'var(--color-text-light)' }}>No plans yet. Create one to get started.</p>
        ) : (
          <div className="plans-grid">
            {plans.map((p) => (
              <div key={p.id} className={`plan-card ${!p.isActive ? 'plan-inactive' : ''}`}>
                <div className="plan-header">
                  <h3>{p.name}</h3>
                  {!p.isActive && <span className="badge badge-inactive">Inactive</span>}
                </div>
                <div className="plan-price">
                  ${Number(p.price).toFixed(2)}
                  <span className="plan-cycle">/ {p.billingCycle.toLowerCase()}</span>
                </div>
                {p.description && <p className="plan-desc">{p.description}</p>}
                <p className="plan-credits">
                  {p.classCredits != null ? `${p.classCredits} classes` : 'Unlimited classes'}
                </p>
                {canEdit && (
                  <div className="plan-actions">
                    <button className="btn btn-outline btn-sm" onClick={() => openEdit(p)}>Edit</button>
                    {p.isActive && (
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p.id)}>Deactivate</button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="modal">
            <h2>{editPlan ? 'Edit Plan' : 'New Membership Plan'}</h2>
            {error && <div className="alert alert-error">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Plan Name</label>
                <input className="form-control" value={form.name} required
                  onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea className="form-control" rows="2" value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Price ($)</label>
                  <input type="number" step="0.01" min="0" className="form-control"
                    value={form.price} required
                    onChange={(e) => setForm({ ...form, price: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Billing Cycle</label>
                  <select className="form-control" value={form.billingCycle}
                    onChange={(e) => setForm({ ...form, billingCycle: e.target.value })}>
                    <option value="WEEKLY">Weekly</option>
                    <option value="BIWEEKLY">Bi-Weekly</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="QUARTERLY">Quarterly</option>
                    <option value="SEMI_ANNUAL">Semi-Annual</option>
                    <option value="ANNUAL">Annual</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Class Credits (leave blank for unlimited)</label>
                <input type="number" min="1" className="form-control"
                  value={form.classCredits}
                  onChange={(e) => setForm({ ...form, classCredits: e.target.value })} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">
                  {editPlan ? 'Update Plan' : 'Create Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Invoices Tab ─────────────────────────────────────────

function InvoiceManager({ schoolId }) {
  const { isSuperAdmin, isOwner, isInstructor } = useAuth();
  const canCreate = isSuperAdmin || isOwner || isInstructor;
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [plans, setPlans] = useState([]);
  const [form, setForm] = useState({ studentId: '', planId: '', subtotal: '', dueDate: '', notes: '' });
  const [students, setStudents] = useState([]);

  const fetchInvoices = useCallback(() => {
    setLoading(true);
    billingApi.getInvoices(schoolId)
      .then(setInvoices)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [schoolId]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const openCreate = async () => {
    try {
      const [planData, enrollData] = await Promise.all([
        billingApi.getPlans(schoolId),
        schoolApi.getAll(),
      ]);
      setPlans(planData);
      // Get enrolled students for this school
      const school = enrollData.find(s => s.id === schoolId);
      setStudents(school?.enrollments?.map(e => e.student) || []);
    } catch { /* ignore */ }
    setForm({ studentId: '', planId: '', subtotal: '', dueDate: '', notes: '' });
    setShowModal(true);
  };

  const handlePlanSelect = (planId) => {
    const plan = plans.find(p => p.id === planId);
    setForm({
      ...form,
      planId,
      subtotal: plan ? String(plan.price) : form.subtotal,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const payload = {
      studentId: form.studentId,
      planId: form.planId || undefined,
      subtotal: parseFloat(form.subtotal),
      dueDate: form.dueDate,
      notes: form.notes || undefined,
    };
    try {
      await billingApi.createInvoice(schoolId, payload);
      setShowModal(false);
      fetchInvoices();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleStatusChange = async (invoiceId, status) => {
    try {
      await billingApi.updateInvoiceStatus(schoolId, invoiceId, status);
      fetchInvoices();
    } catch (err) {
      setError(err.message);
    }
  };

  const statusColor = (s) => {
    const map = {
      DRAFT: 'badge-scheduled',
      SENT: 'badge-in-progress',
      PAID: 'badge-completed',
      PAST_DUE: 'badge-cancelled',
      CANCELLED: 'badge-inactive',
      REFUNDED: 'badge-transferred',
    };
    return map[s] || '';
  };

  if (loading) return <div className="loading">Loading invoices...</div>;
  const fmt = (v) => `$${Number(v || 0).toFixed(2)}`;

  return (
    <div>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="card">
        <div className="card-header">
          <h2>Invoices</h2>
          {canCreate && (
            <button className="btn btn-primary btn-sm" onClick={openCreate}>+ New Invoice</button>
          )}
        </div>

        {invoices.length === 0 ? (
          <p style={{ color: 'var(--color-text-light)' }}>No invoices yet.</p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Student</th>
                  <th>Plan</th>
                  <th>Subtotal</th>
                  <th>Tax</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Due Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td><strong>{inv.invoiceNumber}</strong></td>
                    <td>{inv.student?.firstName} {inv.student?.lastName}</td>
                    <td>{inv.plan?.name || '—'}</td>
                    <td>{fmt(inv.subtotal)}</td>
                    <td>{fmt(inv.taxAmount)}</td>
                    <td><strong>{fmt(inv.totalAmount)}</strong></td>
                    <td><span className={`badge ${statusColor(inv.status)}`}>{inv.status}</span></td>
                    <td>{new Date(inv.dueDate).toLocaleDateString()}</td>
                    <td>
                      {canCreate && inv.status === 'DRAFT' && (
                        <button className="btn btn-sm btn-outline"
                          onClick={() => handleStatusChange(inv.id, 'SENT')}>Send</button>
                      )}
                      {canCreate && ['DRAFT', 'SENT', 'PAST_DUE'].includes(inv.status) && (
                        <button className="btn btn-sm btn-danger" style={{ marginLeft: '0.25rem' }}
                          onClick={() => handleStatusChange(inv.id, 'CANCELLED')}>Cancel</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="modal">
            <h2>Create Invoice</h2>
            {error && <div className="alert alert-error">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Student</label>
                <select className="form-control" required value={form.studentId}
                  onChange={(e) => setForm({ ...form, studentId: e.target.value })}>
                  <option value="">Select student...</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Membership Plan (optional)</label>
                <select className="form-control" value={form.planId}
                  onChange={(e) => handlePlanSelect(e.target.value)}>
                  <option value="">None / Custom</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} — ${Number(p.price).toFixed(2)}/{p.billingCycle.toLowerCase()}</option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Subtotal ($)</label>
                  <input type="number" step="0.01" min="0" className="form-control" required
                    value={form.subtotal}
                    onChange={(e) => setForm({ ...form, subtotal: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Due Date</label>
                  <input type="date" className="form-control" required value={form.dueDate}
                    onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea className="form-control" rows="2" value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Invoice</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Student Invoices (read-only) ─────────────────────────

function StudentInvoices({ schoolId }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    billingApi.getInvoices(schoolId)
      .then(setInvoices)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [schoolId]);

  if (loading) return <div className="loading">Loading your invoices...</div>;
  if (error) return <div className="alert alert-error">{error}</div>;

  const fmt = (v) => `$${Number(v || 0).toFixed(2)}`;
  const statusColor = (s) => {
    const map = {
      DRAFT: 'badge-scheduled', SENT: 'badge-in-progress', PAID: 'badge-completed',
      PAST_DUE: 'badge-cancelled', CANCELLED: 'badge-inactive', REFUNDED: 'badge-transferred',
    };
    return map[s] || '';
  };

  return (
    <div className="card">
      <div className="card-header"><h2>My Invoices</h2></div>
      {invoices.length === 0 ? (
        <p style={{ color: 'var(--color-text-light)' }}>No invoices found.</p>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Plan</th>
                <th>Total</th>
                <th>Status</th>
                <th>Due Date</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td><strong>{inv.invoiceNumber}</strong></td>
                  <td>{inv.plan?.name || '—'}</td>
                  <td><strong>{fmt(inv.totalAmount)}</strong></td>
                  <td><span className={`badge ${statusColor(inv.status)}`}>{inv.status}</span></td>
                  <td>{new Date(inv.dueDate).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Payments Tab ─────────────────────────────────────────

function PaymentHistory({ schoolId }) {
  const { isSuperAdmin, isOwner, isInstructor } = useAuth();
  const canRecord = isSuperAdmin || isOwner || isInstructor;
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [invoices, setInvoices] = useState([]);
  const [form, setForm] = useState({ invoiceId: '', amount: '', method: 'CASH', notes: '' });

  const fetchPayments = useCallback(() => {
    setLoading(true);
    billingApi.getPayments(schoolId)
      .then(setPayments)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [schoolId]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  const openRecord = async () => {
    try {
      const data = await billingApi.getInvoices(schoolId, { status: 'SENT' });
      setInvoices(data.filter(i => ['SENT', 'PAST_DUE'].includes(i.status)));
    } catch { /* ignore */ }
    setForm({ invoiceId: '', amount: '', method: 'CASH', notes: '' });
    setShowModal(true);
  };

  const handleInvoiceSelect = (invoiceId) => {
    const inv = invoices.find(i => i.id === invoiceId);
    setForm({ ...form, invoiceId, amount: inv ? String(inv.totalAmount) : '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await billingApi.recordPayment(schoolId, {
        invoiceId: form.invoiceId,
        amount: parseFloat(form.amount),
        method: form.method,
        notes: form.notes || undefined,
      });
      setShowModal(false);
      fetchPayments();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <div className="loading">Loading payments...</div>;
  const fmt = (v) => `$${Number(v || 0).toFixed(2)}`;

  return (
    <div>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="card">
        <div className="card-header">
          <h2>Payment History</h2>
          {canRecord && (
            <button className="btn btn-primary btn-sm" onClick={openRecord}>+ Record Payment</button>
          )}
        </div>

        {payments.length === 0 ? (
          <p style={{ color: 'var(--color-text-light)' }}>No payments recorded yet.</p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Student</th>
                  <th>Invoice</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Transaction ID</th>
                  <th>Recorded By</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td>{new Date(p.paidAt).toLocaleDateString()}</td>
                    <td>{p.student?.firstName} {p.student?.lastName}</td>
                    <td>{p.invoice?.invoiceNumber || '—'}</td>
                    <td><strong>{fmt(p.amount)}</strong></td>
                    <td><span className="badge">{p.method}</span></td>
                    <td style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>
                      {p.gatewayTransactionId || '—'}
                    </td>
                    <td>{p.recordedBy?.firstName} {p.recordedBy?.lastName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="modal">
            <h2>Record Payment</h2>
            {error && <div className="alert alert-error">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Invoice</label>
                <select className="form-control" required value={form.invoiceId}
                  onChange={(e) => handleInvoiceSelect(e.target.value)}>
                  <option value="">Select invoice...</option>
                  {invoices.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.invoiceNumber} — {i.student?.firstName} {i.student?.lastName} — ${Number(i.totalAmount).toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Amount ($)</label>
                  <input type="number" step="0.01" min="0" className="form-control" required
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Method</label>
                  <select className="form-control" value={form.method}
                    onChange={(e) => setForm({ ...form, method: e.target.value })}>
                    <option value="CASH">Cash</option>
                    <option value="CHECK">Check</option>
                    <option value="CARD">Card (manual)</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="GATEWAY">Online Payment</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea className="form-control" rows="2" value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-success">Record Payment</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Settings Tab (Gateway Config) ────────────────────────

function BillingSettings({ schoolId }) {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({
    gateway: 'MANUAL',
    gatewayPublicKey: '',
    gatewaySecretKey: '',
    gatewayMerchantId: '',
    currency: 'USD',
    taxRate: '0',
    lateFeeAmount: '0',
    gracePeriodDays: '7',
  });

  useEffect(() => {
    setLoading(true);
    billingApi.getConfig(schoolId)
      .then((data) => {
        setConfig(data);
        if (data) {
          setForm({
            gateway: data.gateway || 'MANUAL',
            gatewayPublicKey: data.gatewayPublicKey || '',
            gatewaySecretKey: '', // masked, don't prefill
            gatewayMerchantId: data.gatewayMerchantId || '',
            currency: data.currency || 'USD',
            taxRate: String(data.taxRate ?? 0),
            lateFeeAmount: String(data.lateFeeAmount ?? 0),
            gracePeriodDays: String(data.gracePeriodDays ?? 7),
          });
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [schoolId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    setSaving(true);
    const payload = {
      gateway: form.gateway,
      gatewayPublicKey: form.gatewayPublicKey || undefined,
      gatewaySecretKey: form.gatewaySecretKey || undefined,
      gatewayMerchantId: form.gatewayMerchantId || undefined,
      currency: form.currency,
      taxRate: parseFloat(form.taxRate),
      lateFeeAmount: parseFloat(form.lateFeeAmount),
      gracePeriodDays: parseInt(form.gracePeriodDays, 10),
    };
    try {
      await billingApi.updateConfig(schoolId, payload);
      setSuccess('Billing settings saved successfully!');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="loading">Loading settings...</div>;

  const showGatewayFields = form.gateway !== 'MANUAL';

  return (
    <div className="card">
      <div className="card-header"><h2>Payment Gateway Settings</h2></div>
      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Payment Gateway</label>
          <select className="form-control" value={form.gateway}
            onChange={(e) => setForm({ ...form, gateway: e.target.value })}>
            <option value="MANUAL">Manual (cash, check, etc.)</option>
            <option value="STRIPE">Stripe</option>
            <option value="SQUARE">Square</option>
          </select>
        </div>

        {showGatewayFields && (
          <>
            <div className="billing-gateway-notice">
              <strong>🔐 {form.gateway === 'STRIPE' ? 'Stripe' : 'Square'} Configuration</strong>
              <p>Enter your {form.gateway === 'STRIPE' ? 'Stripe API keys' : 'Square access token and location ID'} below.
              These are encrypted and stored securely per-school.</p>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>{form.gateway === 'STRIPE' ? 'Publishable Key' : 'Application ID'}</label>
                <input className="form-control" value={form.gatewayPublicKey}
                  placeholder={form.gateway === 'STRIPE' ? 'pk_live_...' : 'sq0idp-...'}
                  onChange={(e) => setForm({ ...form, gatewayPublicKey: e.target.value })} />
              </div>
              <div className="form-group">
                <label>{form.gateway === 'STRIPE' ? 'Secret Key' : 'Access Token'}</label>
                <input type="password" className="form-control" value={form.gatewaySecretKey}
                  placeholder={config?.gatewaySecretKey ? '••••••••  (saved)' : form.gateway === 'STRIPE' ? 'sk_live_...' : 'EAAAl...'}
                  onChange={(e) => setForm({ ...form, gatewaySecretKey: e.target.value })} />
              </div>
            </div>
            {form.gateway === 'SQUARE' && (
              <div className="form-group">
                <label>Location ID</label>
                <input className="form-control" value={form.gatewayMerchantId}
                  placeholder="L..."
                  onChange={(e) => setForm({ ...form, gatewayMerchantId: e.target.value })} />
              </div>
            )}
          </>
        )}

        <hr style={{ margin: '1.5rem 0', borderColor: 'var(--color-border)' }} />

        <div className="form-row">
          <div className="form-group">
            <label>Currency</label>
            <select className="form-control" value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}>
              <option value="USD">USD — US Dollar</option>
              <option value="CAD">CAD — Canadian Dollar</option>
              <option value="GBP">GBP — British Pound</option>
              <option value="EUR">EUR — Euro</option>
              <option value="AUD">AUD — Australian Dollar</option>
            </select>
          </div>
          <div className="form-group">
            <label>Tax Rate (%)</label>
            <input type="number" step="0.01" min="0" max="100" className="form-control"
              value={form.taxRate}
              onChange={(e) => setForm({ ...form, taxRate: e.target.value })} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Late Fee ($)</label>
            <input type="number" step="0.01" min="0" className="form-control"
              value={form.lateFeeAmount}
              onChange={(e) => setForm({ ...form, lateFeeAmount: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Grace Period (days)</label>
            <input type="number" min="0" className="form-control"
              value={form.gracePeriodDays}
              onChange={(e) => setForm({ ...form, gracePeriodDays: e.target.value })} />
          </div>
        </div>

        <div className="modal-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Subscriptions Tab ────────────────────────────────────

function SubscriptionManager({ schoolId }) {
  const { isSuperAdmin, isOwner } = useAuth();
  const canManage = isSuperAdmin || isOwner;
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [plans, setPlans] = useState([]);
  const [students, setStudents] = useState([]);
  const [form, setForm] = useState({ studentId: '', planId: '' });
  const [runningAutoInvoice, setRunningAutoInvoice] = useState(false);

  const fetchSubscriptions = useCallback(() => {
    setLoading(true);
    billingApi.getSubscriptions(schoolId)
      .then(setSubscriptions)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [schoolId]);

  useEffect(() => { fetchSubscriptions(); }, [fetchSubscriptions]);

  const openCreate = async () => {
    setError('');
    try {
      const [planData, schoolData] = await Promise.all([
        billingApi.getPlans(schoolId),
        schoolApi.getAll(),
      ]);
      setPlans(planData);
      const school = schoolData.find(s => s.id === schoolId);
      setStudents(school?.enrollments?.map(e => e.student) || []);
    } catch { /* ignore */ }
    setForm({ studentId: '', planId: '' });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await billingApi.createSubscription(schoolId, {
        studentId: form.studentId,
        planId: form.planId,
      });
      setShowModal(false);
      fetchSubscriptions();
    } catch (err) {
      setError(err.message);
    }
  };

  const handlePause = async (subId) => {
    try {
      await billingApi.updateSubscription(schoolId, subId, { status: 'PAUSED' });
      fetchSubscriptions();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleResume = async (subId) => {
    try {
      await billingApi.updateSubscription(schoolId, subId, { status: 'ACTIVE' });
      fetchSubscriptions();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCancel = async (subId) => {
    if (!confirm('Cancel this subscription? The student will no longer be auto-invoiced.')) return;
    try {
      await billingApi.cancelSubscription(schoolId, subId);
      fetchSubscriptions();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRunAutoInvoice = async () => {
    setRunningAutoInvoice(true);
    setSuccess('');
    setError('');
    try {
      const result = await billingApi.runAutoInvoice();
      setSuccess(
        `Auto-invoice complete: ${result.invoicesGenerated} invoices generated` +
        (result.overdueMarked ? `, ${result.overdueMarked} marked overdue` : '')
      );
      fetchSubscriptions();
    } catch (err) {
      setError(err.message);
    } finally {
      setRunningAutoInvoice(false);
    }
  };

  const statusBadge = (s) => {
    const map = { ACTIVE: 'badge-active', PAUSED: 'badge-in-progress', CANCELLED: 'badge-inactive' };
    return map[s] || '';
  };

  if (loading) return <div className="loading">Loading subscriptions...</div>;

  return (
    <div>
      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="card">
        <div className="card-header">
          <h2>Student Subscriptions</h2>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {isSuperAdmin && (
              <button
                className="btn btn-outline btn-sm"
                onClick={handleRunAutoInvoice}
                disabled={runningAutoInvoice}
              >
                {runningAutoInvoice ? '⏳ Running...' : '🔄 Run Auto-Invoice Now'}
              </button>
            )}
            {canManage && (
              <button className="btn btn-primary btn-sm" onClick={openCreate}>
                + Assign Plan
              </button>
            )}
          </div>
        </div>

        <div className="auto-invoice-info">
          <strong>📅 Auto-Invoicing:</strong> Invoices are automatically generated on the 1st of every month
          for all active subscriptions. Students can pay anytime during the month.
        </div>

        {subscriptions.length === 0 ? (
          <p style={{ color: 'var(--color-text-light)' }}>
            No subscriptions yet. Assign students to plans to enable auto-invoicing.
          </p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Plan</th>
                  <th>Price</th>
                  <th>Cycle</th>
                  <th>Status</th>
                  <th>Next Invoice</th>
                  <th>Start Date</th>
                  {canManage && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((sub) => (
                  <tr key={sub.id}>
                    <td><strong>{sub.student?.firstName} {sub.student?.lastName}</strong></td>
                    <td>{sub.plan?.name}</td>
                    <td>${Number(sub.plan?.price || 0).toFixed(2)}</td>
                    <td>{sub.plan?.billingCycle?.toLowerCase()}</td>
                    <td><span className={`badge ${statusBadge(sub.status)}`}>{sub.status}</span></td>
                    <td>
                      {sub.nextInvoiceDate
                        ? new Date(sub.nextInvoiceDate).toLocaleDateString()
                        : '—'}
                    </td>
                    <td>{new Date(sub.startDate).toLocaleDateString()}</td>
                    {canManage && (
                      <td>
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          {sub.status === 'ACTIVE' && (
                            <button className="btn btn-outline btn-sm" onClick={() => handlePause(sub.id)}>
                              Pause
                            </button>
                          )}
                          {sub.status === 'PAUSED' && (
                            <button className="btn btn-success btn-sm" onClick={() => handleResume(sub.id)}>
                              Resume
                            </button>
                          )}
                          {sub.status !== 'CANCELLED' && (
                            <button className="btn btn-danger btn-sm" onClick={() => handleCancel(sub.id)}>
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="modal">
            <h2>Assign Student to Plan</h2>
            {error && <div className="alert alert-error">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Student</label>
                <select className="form-control" required value={form.studentId}
                  onChange={(e) => setForm({ ...form, studentId: e.target.value })}>
                  <option value="">Select student...</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Membership Plan</label>
                <select className="form-control" required value={form.planId}
                  onChange={(e) => setForm({ ...form, planId: e.target.value })}>
                  <option value="">Select plan...</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — ${Number(p.price).toFixed(2)}/{p.billingCycle.toLowerCase()}
                    </option>
                  ))}
                </select>
              </div>
              <div className="auto-invoice-info" style={{ marginTop: '0.5rem' }}>
                The student will be automatically invoiced on the 1st of each billing cycle.
                Their first invoice will be generated on the next upcoming 1st.
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Assign Plan</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
