import { useState, useEffect } from 'react';
import { reportingApi, schoolApi } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function ReportingPage() {
  const { user, isSuperAdmin } = useAuth();
  const [schools, setSchools] = useState([]);
  const [schoolId, setSchoolId] = useState('');
  const [dashboard, setDashboard] = useState(null);
  const [bySchool, setBySchool] = useState([]);
  const [paymentStats, setPaymentStats] = useState([]);
  const [tab, setTab] = useState('OVERVIEW');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    schoolApi.getAll().then((s) => { setSchools(s); if (s.length) setSchoolId(s[0].id); });
  }, []);

  useEffect(() => {
    if (!schoolId) return;
    setLoading(true);
    Promise.all([
      reportingApi.getDashboard(schoolId),
      reportingApi.getPaymentStats(schoolId),
    ]).then(([d, p]) => { setDashboard(d); setPaymentStats(p); }).finally(() => setLoading(false));
  }, [schoolId]);

  useEffect(() => {
    if (isSuperAdmin) reportingApi.getBySchool().then(setBySchool);
  }, []);

  const fmt = (n) => '$' + (Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="page">
      <h1>📊 Financial Reports</h1>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={schoolId} onChange={(e) => setSchoolId(e.target.value)} className="form-input" style={{ width: 'auto' }}>
          {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button className={`btn ${tab === 'OVERVIEW' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('OVERVIEW')}>Overview</button>
        <button className={`btn ${tab === 'MONTHLY' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('MONTHLY')}>Monthly</button>
        <button className={`btn ${tab === 'PLANS' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('PLANS')}>By Plan</button>
        {isSuperAdmin && <button className={`btn ${tab === 'SCHOOLS' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('SCHOOLS')}>By School</button>}
      </div>

      {loading && <p>Loading reports...</p>}

      {!loading && dashboard && tab === 'OVERVIEW' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div className="card" style={{ padding: '1rem', textAlign: 'center', borderTop: '4px solid #22c55e' }}>
              <div style={{ fontSize: '0.85rem', color: '#888' }}>Total Revenue</div>
              <div style={{ fontSize: '2rem', fontWeight: 700 }}>{fmt(dashboard.totalRevenue)}</div>
            </div>
            <div className="card" style={{ padding: '1rem', textAlign: 'center', borderTop: '4px solid #f59e0b' }}>
              <div style={{ fontSize: '0.85rem', color: '#888' }}>Outstanding</div>
              <div style={{ fontSize: '2rem', fontWeight: 700 }}>{fmt(dashboard.outstandingBalance)}</div>
            </div>
            <div className="card" style={{ padding: '1rem', textAlign: 'center', borderTop: '4px solid #3b82f6' }}>
              <div style={{ fontSize: '0.85rem', color: '#888' }}>Active Subscriptions</div>
              <div style={{ fontSize: '2rem', fontWeight: 700 }}>{dashboard.activeSubscriptions || 0}</div>
            </div>
          </div>

          <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
            <h3>Invoice Status</h3>
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
              {dashboard.invoicesByStatus?.map((s) => (
                <div key={s.status} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{s._count}</div>
                  <div style={{ fontSize: '0.8rem', color: '#888' }}>{s.status}</div>
                  <div style={{ fontSize: '0.85rem' }}>{fmt(s._sum?.totalAmount)}</div>
                </div>
              ))}
            </div>
          </div>

          {paymentStats.length > 0 && (
            <div className="card" style={{ padding: '1rem' }}>
              <h3>Payment Methods</h3>
              <table className="data-table">
                <thead><tr><th>Method</th><th>Count</th><th>Total</th></tr></thead>
                <tbody>
                  {paymentStats.map((p) => (
                    <tr key={p.paymentMethod || 'none'}>
                      <td>{p.paymentMethod || 'Not Set'}</td>
                      <td>{p._count}</td>
                      <td>{fmt(p._sum?.totalAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {!loading && dashboard && tab === 'MONTHLY' && (
        <div className="card" style={{ padding: '1rem' }}>
          <h3>Revenue by Month (Last 12 Months)</h3>
          <table className="data-table">
            <thead><tr><th>Month</th><th>Revenue</th><th>Invoices</th></tr></thead>
            <tbody>
              {dashboard.revenueByMonth?.map((m) => (
                <tr key={m.month}>
                  <td>{m.month}</td>
                  <td style={{ fontWeight: 600, color: '#22c55e' }}>{fmt(m.revenue)}</td>
                  <td>{m.count}</td>
                </tr>
              ))}
              {(!dashboard.revenueByMonth || dashboard.revenueByMonth.length === 0) && (
                <tr><td colSpan={3} style={{ textAlign: 'center', color: '#888' }}>No data yet</td></tr>
              )}
            </tbody>
          </table>
          {dashboard.revenueByMonth?.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <h4>Revenue Chart</h4>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '200px', padding: '0 1rem' }}>
                {dashboard.revenueByMonth.map((m) => {
                  const max = Math.max(...dashboard.revenueByMonth.map((x) => x.revenue), 1);
                  const h = (m.revenue / max) * 180;
                  return (
                    <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{ fontSize: '0.65rem', color: '#888', marginBottom: '2px' }}>{fmt(m.revenue)}</div>
                      <div style={{ width: '100%', height: `${h}px`, background: '#3b82f6', borderRadius: '4px 4px 0 0', minHeight: '2px' }} />
                      <div style={{ fontSize: '0.6rem', color: '#888', marginTop: '4px', transform: 'rotate(-45deg)', whiteSpace: 'nowrap' }}>{m.month}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {!loading && dashboard && tab === 'PLANS' && (
        <div className="card" style={{ padding: '1rem' }}>
          <h3>Revenue by Plan</h3>
          <table className="data-table">
            <thead><tr><th>Plan</th><th>Revenue</th><th>Invoices</th></tr></thead>
            <tbody>
              {dashboard.revenueByPlan?.map((p) => (
                <tr key={p.planName || 'none'}>
                  <td>{p.planName || 'No Plan'}</td>
                  <td style={{ fontWeight: 600 }}>{fmt(p.revenue)}</td>
                  <td>{p.count}</td>
                </tr>
              ))}
              {(!dashboard.revenueByPlan || dashboard.revenueByPlan.length === 0) && (
                <tr><td colSpan={3} style={{ textAlign: 'center', color: '#888' }}>No data</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {!loading && tab === 'SCHOOLS' && isSuperAdmin && (
        <div className="card" style={{ padding: '1rem' }}>
          <h3>Revenue by School</h3>
          <table className="data-table">
            <thead><tr><th>School</th><th>Revenue</th><th>Outstanding</th><th>Invoices</th></tr></thead>
            <tbody>
              {bySchool.map((s) => (
                <tr key={s.schoolId}>
                  <td><strong>{s.schoolName}</strong></td>
                  <td style={{ color: '#22c55e', fontWeight: 600 }}>{fmt(s.totalRevenue)}</td>
                  <td style={{ color: '#f59e0b' }}>{fmt(s.outstanding)}</td>
                  <td>{s.invoiceCount}</td>
                </tr>
              ))}
              {bySchool.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', color: '#888' }}>No data</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
